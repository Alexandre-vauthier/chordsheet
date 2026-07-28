/**
 * Logique partagée de l'analyse audio (routes start/finish).
 * Transformation timeline → mesures, prompt de structuration IA, quota OCR mutualisé.
 */
import { getAdminDb, getAdminFieldValue } from '@/lib/firebase-admin';

export const FREE_LIMIT = 2;

// ── Timeline renvoyée par le service Cloud Run ──────────────────────────────
export interface Timeline {
  bpm: number;
  key: string;
  duration: number;
  downbeats: [number, number][]; // [temps, position dans la mesure 1..4]
  chords: { start: number; end: number; label: string }[];
}

export function madmomToChord(label: string): string {
  if (!label || label === 'N') return '';
  const m = label.match(/^([A-G][#b]?):(maj|min)$/);
  if (!m) return '';
  return m[2] === 'min' ? `${m[1]}m` : m[1];
}

function chordAt(chords: Timeline['chords'], t: number): string {
  for (const c of chords) if (c.start <= t && t < c.end) return c.label;
  return 'N';
}

// Une cellule = un accord tenu sur `beats` temps consécutifs dans la mesure.
export interface BarCell { chord: string; beats: number }
export interface Bar { cells: BarCell[] }

// Découpe la timeline temps par temps (échantillon à 40% de l'intervalle pour
// éviter les frontières), puis regroupe les temps consécutifs de même accord
// dans chaque mesure. Résultat : au plus `beatsPerBar` cellules par mesure.
export function toBars(tl: Timeline): { bars: Bar[]; beatsPerBar: 3 | 4 } {
  const beats = [...tl.downbeats].sort((a, b) => a[0] - b[0]);
  const maxBeat = beats.reduce((m, d) => Math.max(m, d[1]), 4);
  const beatsPerBar: 3 | 4 = maxBeat === 3 ? 3 : 4;

  const perBeat = beats.map(([t, pos], i) => {
    const next = beats[i + 1]?.[0] ?? t + 0.5;
    const sample = t + (next - t) * 0.4;
    return { pos, chord: madmomToChord(chordAt(tl.chords, sample)) };
  });

  const makeBar = (bts: { chord: string }[]): Bar => {
    const cells: BarCell[] = [];
    for (const b of bts) {
      const last = cells[cells.length - 1];
      if (last && last.chord === b.chord) last.beats += 1;
      else cells.push({ chord: b.chord, beats: 1 });
    }
    return { cells };
  };

  const bars: Bar[] = [];
  let cur: { pos: number; chord: string }[] = [];
  for (const b of perBeat) {
    if (b.pos === 1 && cur.length) { bars.push(makeBar(cur)); cur = []; }
    cur.push(b);
  }
  if (cur.length) bars.push(makeBar(cur));
  return { bars, beatsPerBar };
}

// ── Découpage DÉTERMINISTE en mesures régulières ────────────────────────────
// Une mesure = un tableau de cellules {chord, beats} dont la somme des beats vaut
// exactement beatsPerBar. Garantit un métrique uniforme (la détection des temps
// étant bruitée), avec au plus 2 accords par mesure.
export type Measure = { chord: string; beats: number }[];

// Accord qui couvre le plus de temps dans l'intervalle [t0, t1[.
function dominantChordInInterval(chords: Timeline['chords'], t0: number, t1: number): string {
  const cover: Record<string, number> = {};
  for (const c of chords) {
    const s = Math.max(c.start, t0);
    const e = Math.min(c.end, t1);
    if (e > s) {
      const ch = madmomToChord(c.label);
      cover[ch] = (cover[ch] ?? 0) + (e - s);
    }
  }
  let best = '', bestV = 0;
  for (const [ch, v] of Object.entries(cover)) if (v > bestV) { bestV = v; best = ch; }
  return best;
}

// Suite d'accords sur les VRAIS temps détectés (chaque temps = intervalle entre
// deux temps consécutifs). Suit le tempo qui respire, calée sur le premier temps fort.
function chordPerBeat(tl: Timeline, songDur: number): string[] {
  const beats = [...tl.downbeats].sort((a, b) => a[0] - b[0]);
  if (beats.length < 2) return [];
  const perBeat: string[] = [];
  for (let k = 0; k < beats.length - 1; k++) {
    perBeat.push(dominantChordInInterval(tl.chords, beats[k][0], beats[k + 1][0]));
  }
  perBeat.push(dominantChordInInterval(tl.chords, beats[beats.length - 1][0], songDur));
  let start = beats.findIndex((b) => b[1] === 1);
  if (start < 0) start = 0;
  return perBeat.slice(start);
}

// Replie les répétitions sur une période et vote à la majorité par position.
function majorityFold(seq: string[], period: number): string[] {
  const canon: string[] = [];
  for (let j = 0; j < period; j++) {
    const counts: Record<string, number> = {};
    for (let i = j; i < seq.length; i += period) counts[seq[i] ?? ''] = (counts[seq[i] ?? ''] ?? 0) + 1;
    let best = '', bestN = -1;
    for (const [c, cnt] of Object.entries(counts)) if (cnt > bestN) { bestN = cnt; best = c; }
    canon.push(best);
  }
  return canon;
}

// Accords "fréquents" (présents dans la boucle, pas des parasites d'un seul tour).
function frequentChords(seq: string[]): Set<string> {
  const freq: Record<string, number> = {};
  for (const c of seq) if (c) freq[c] = (freq[c] ?? 0) + 1;
  const min = Math.max(3, seq.length * 0.06);
  return new Set(Object.entries(freq).filter(([, n]) => n >= min).map(([c]) => c));
}

// Période de la boucle (en temps, multiple de la mesure) + motif canonique, en
// n'acceptant une période QUE si le canonique garde tous les accords fréquents.
function selectLoop(seq: string[], beatsPerBar: number): { period: number; canon: string[] } | null {
  const n = seq.length;
  if (n < 2 * beatsPerBar) return null;
  const freq = frequentChords(seq);
  if (freq.size === 0) return null;
  const maxP = Math.min(16 * beatsPerBar, Math.floor(n / 2));
  const scoreAt = (p: number): number => {
    let match = 0, total = 0;
    for (let i = 0; i + p < n; i++) { total++; if (seq[i] && seq[i] === seq[i + p]) match++; }
    return total ? match / total : 0;
  };
  let bestScore = 0;
  for (let p = beatsPerBar; p <= maxP; p += beatsPerBar) bestScore = Math.max(bestScore, scoreAt(p));
  if (bestScore < 0.55) return null;
  for (let p = beatsPerBar; p <= maxP; p += beatsPerBar) {
    if (scoreAt(p) < bestScore - 0.03) continue;
    const canon = majorityFold(seq, p);
    const canonSet = new Set(canon.filter(Boolean));
    if ([...freq].every((c) => canonSet.has(c))) return { period: p, canon };
  }
  return null;
}

// Réparation par bigramme : apprend depuis la détection brute quel accord précède
// habituellement chaque accord, et le restaure dans le canonique là où le vote
// majoritaire l'a effacé (ex. un Am d'un temps avant un D, mangé sur un tour).
function repairBigrams(canon: string[], raw: string[], freq: Set<string>): string[] {
  const predCount: Record<string, Record<string, number>> = {};
  for (let i = 1; i < raw.length; i++) {
    const y = raw[i], p = raw[i - 1];
    if (!y || !p || y === p) continue;
    (predCount[y] ??= {})[p] = (predCount[y][p] ?? 0) + 1;
  }
  const domPred: Record<string, { chord: string; frac: number }> = {};
  for (const y in predCount) {
    const entries = Object.entries(predCount[y]);
    const total = entries.reduce((a, [, n]) => a + n, 0);
    const [chord, n] = entries.sort((a, b) => b[1] - a[1])[0];
    domPred[y] = { chord, frac: n / total };
  }
  const L = canon.length;
  const out = [...canon];
  for (let i = 0; i < L; i++) {
    const y = out[i];
    if (!y) continue;
    const dp = domPred[y];
    if (dp && dp.frac >= 0.5 && freq.has(dp.chord)) {
      const pi = (i - 1 + L) % L;
      if (out[pi] !== dp.chord && out[pi] !== y) out[pi] = dp.chord;
    }
  }
  return out;
}

// Fait tourner le motif pour qu'aucun accord ne soit coupé par une barre de mesure
// (minimise les accords à cheval sur une barre).
function rotateForMeasurePhase(loopPerBeat: string[], beatsPerBar: number): string[] {
  const L = loopPerBeat.length;
  if (L === 0) return loopPerBeat;
  let bestO = 0, bestPen = Infinity;
  for (let o = 0; o < beatsPerBar; o++) {
    let pen = 0;
    for (let b = o; b < L; b += beatsPerBar) {
      const cur = loopPerBeat[b % L];
      const prev = loopPerBeat[(b - 1 + L) % L];
      if (cur && cur === prev) pen++;
    }
    if (pen < bestPen) { bestPen = pen; bestO = o; }
  }
  return loopPerBeat.slice(bestO).concat(loopPerBeat.slice(0, bestO));
}

// Fait démarrer la boucle sur l'accord STABLE : le début de la plus longue série
// de mesures « pleines » d'un même accord (la tonique tenue), plutôt que sur une
// mesure de transition (ex. Am D). Ne tourne que par mesures entières.
function rotateToStableStart(canon: string[], beatsPerBar: number): string[] {
  const mil = Math.floor(canon.length / beatsPerBar);
  if (mil < 2) return canon;
  const measureChord: (string | null)[] = [];
  for (let m = 0; m < mil; m++) {
    const sl = canon.slice(m * beatsPerBar, (m + 1) * beatsPerBar);
    measureChord.push(sl.every((c) => c && c === sl[0]) ? sl[0] : null);
  }
  let bestStart = -1, bestLen = 0;
  for (let s = 0; s < mil; s++) {
    const c = measureChord[s];
    if (!c) continue;
    if (measureChord[(s - 1 + mil) % mil] === c) continue; // pas un vrai début de série
    let len = 1;
    while (len < mil && measureChord[(s + len) % mil] === c) len++;
    if (len > bestLen) { bestLen = len; bestStart = s; }
  }
  if (bestStart <= 0) return canon;
  const off = bestStart * beatsPerBar;
  return canon.slice(off).concat(canon.slice(0, off));
}

// Regroupe une tranche de temps en cellules {chord, beats} (temps consécutifs
// identiques fusionnés), complétée à beatsPerBar temps si la mesure est courte.
function groupBeats(perBeat: string[], beatsPerBar: number): Measure {
  const cells: Measure = [];
  for (const ch of perBeat) {
    const last = cells[cells.length - 1];
    if (last && last.chord === ch) last.beats += 1;
    else cells.push({ chord: ch, beats: 1 });
  }
  const total = cells.reduce((a, c) => a + c.beats, 0);
  if (total < beatsPerBar && cells.length) cells[cells.length - 1].beats += beatsPerBar - total;
  return cells;
}

// Variante « nettoyante » (morceaux non répétitifs) : au plus 2 accords/mesure,
// une mesure trop agitée (≥3 changements) est ramenée à son accord dominant.
function reduceMeasure(perBeat: string[], beatsPerBar: number): Measure {
  const groups = groupBeats(perBeat, beatsPerBar);
  if (groups.length <= 2) return groups;
  const dom = groups.reduce((best, g) => (g.beats > best.beats ? g : best), groups[0]).chord;
  return [{ chord: dom, beats: beatsPerBar }];
}

export function toMeasures(tl: Timeline, beatsPerBar: number): Measure[] {
  const songDur = tl.duration || (tl.chords.length ? tl.chords[tl.chords.length - 1].end : 0);
  // Suite d'accords sur les vrais temps détectés (suit le tempo réel).
  const perBeat = chordPerBeat(tl, songDur);
  if (!perBeat.length) return [];

  // Boucle nette et sûre : période + vote majoritaire (parasites effacés, aucun
  // accord fréquent perdu), puis calage du départ des mesures.
  const loop = selectLoop(perBeat, beatsPerBar);
  let canon = loop?.canon ?? null;
  if (canon) {
    canon = repairBigrams(canon, perBeat, frequentChords(perBeat));
    canon = rotateForMeasurePhase(canon, beatsPerBar);
    canon = rotateToStableStart(canon, beatsPerBar);
  }
  // Motif propre répété sur toute la longueur (ou la suite brute si pas de boucle).
  const seq = canon ? perBeat.map((_, i) => canon[i % canon.length]) : perBeat;

  const measures: Measure[] = [];
  for (let i = 0; i < seq.length; i += beatsPerBar) {
    const slice = seq.slice(i, i + beatsPerBar);
    if (!slice.length) break;
    measures.push(canon ? groupBeats(slice, beatsPerBar) : reduceMeasure(slice, beatsPerBar));
  }
  return measures;
}

// ── Respelling enharmonique selon la tonalité ───────────────────────────────
const SHARP_TO_FLAT: Record<string, string> = { 'A#': 'Bb', 'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab' };
const FLAT_TO_SHARP: Record<string, string> = { Bb: 'A#', Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#' };
// Tonalités qui s'écrivent avec des dièses (le reste : bémols par défaut).
const SHARP_KEYS = new Set(['g', 'd', 'a', 'e', 'b', 'f#', 'em', 'bm', 'f#m', 'c#m', 'g#m', 'd#m', 'a#m']);

export function keyPrefersSharps(key: string): boolean {
  const k = (key || '').toLowerCase().replace(/\s+(major|minor|maj|min)/, (_m, q) => (q.startsWith('mi') ? 'm' : '')).trim();
  return SHARP_KEYS.has(k);
}

export function respellChord(chord: string, sharps: boolean): string {
  const m = chord.match(/^([A-G][#b]?)(.*)$/);
  if (!m) return chord;
  const root = m[1];
  const suffix = m[2];
  const newRoot = sharps ? (FLAT_TO_SHARP[root] ?? root) : (SHARP_TO_FLAT[root] ?? root);
  return newRoot + suffix;
}

// Prompt LÉGER : l'IA ne reçoit que la liste des mesures déjà régulières et ne
// décide QUE du découpage en sections et des répétitions (jamais des mesures).
export function buildSectionPrompt(
  measureLabels: string[],
  beatsPerBar: number,
  meta: { title: string; author: string },
): string {
  const list = measureLabels.map((m, i) => `${i + 1}:${m}`).join('  ');
  return `Voici les mesures d'un morceau, déjà découpées et régulières (une entrée = une mesure de ${beatsPerBar} temps).
${meta.title ? `Titre : ${meta.title}${meta.author ? ' — ' + meta.author : ''}\n` : ''}Mesures (numéro:accords) :
${list}

Découpe ces ${measureLabels.length} mesures en SECTIONS musicales et repère les répétitions.
Une vraie chanson a peu de motifs qui reviennent ; les sections font typiquement 4, 8 ou 16 mesures.

Renvoie UNIQUEMENT ce JSON (aucun texte autour) :
{ "sections": [ { "label": "Intro", "count": 4, "repeat": 1 }, { "label": "Couplet", "count": 8, "repeat": 2 } ] }
- label : Intro, Couplet, Refrain, Pont, Outro…
- count : nombre de mesures d'UNE occurrence de la section.
- repeat : nombre de fois où cette section est jouée d'affilée.
- La somme de (count × repeat) sur toutes les sections doit valoir EXACTEMENT ${measureLabels.length}.
Ne modifie pas les accords, ne renvoie que le découpage.`;
}

export function buildPrompt(
  bars: Bar[],
  beatsPerBar: number,
  tl: Timeline,
  meta: { title: string; author: string },
): string {
  const seq = bars
    .map((bar, i) => `M${i + 1}:${bar.cells.map((c) => `${c.chord || '-'}(${c.beats})`).join(' ')}`)
    .join(' | ');
  return `Tu structures une grille d'accords à partir d'une détection automatique (audio → accords).

Contexte :
- Titre : ${meta.title || 'inconnu'}
- Artiste : ${meta.author || 'inconnu'}
- Tonalité estimée : ${tl.key || 'inconnue'}
- Tempo : ${Math.round(tl.bpm)} BPM
- Mesure : ${beatsPerBar}/4

Séquence détectée par l'algorithme, une entrée par mesure. Format : Mn:accord(durée_en_temps)…
"-" = temps sans accord clair.
${seq}

IMPORTANT — la détection ci-dessus est APPROXIMATIVE et bruitée : durées imprécises,
petits fragments parasites (1 temps isolé), accords qui vacillent. La musique, elle,
est RÉGULIÈRE. Ton rôle est d'en déduire la structure propre sous-jacente, pas de
recopier le bruit. Raisonne comme un musicien qui relève une grille à l'oreille.

Ta tâche :
1. Régularise le rythme harmonique. Dans la grande majorité des morceaux, un accord tient
   une mesure entière (beats=${beatsPerBar}) ou une demi-mesure (beats=${Math.round(beatsPerBar / 2)}).
   Les changements tombent sur les temps forts (1er temps, éventuellement mi-mesure).
   Quantifie les durées détectées vers ces valeurs. Élimine les fragments parasites
   (durée de 1 temps isolée, accord qui n'apparaît qu'une fois entre deux autres) en les
   absorbant dans l'accord voisin dominant. Vise 1 à 2 accords par mesure, rarement plus.
2. Exploite la RÉPÉTITION, clé de la structure musicale : repère les mesures et les blocs
   qui reviennent à l'identique. Regroupe en SECTIONS (Intro, Couplet, Refrain, Pont…) et
   utilise "repeat" au lieu de recopier (une section de 4 mesures jouée 2 fois → repeat=2).
   Une section fait typiquement 4, 8 ou 16 mesures. Cherche activement ces régularités.
3. Chaque mesure fait EXACTEMENT ${beatsPerBar} temps : la somme des "beats" des accords
   consécutifs doit se regrouper en mesures pleines de ${beatsPerBar} temps (ex. en 4/4 :
   un accord de 4, ou 2+2, ou 4×1 ; jamais 3+2 ou 1+2).
4. Reste fidèle aux ACCORDS eux-mêmes (n'invente pas d'accords hors de ceux détectés,
   respelle selon la tonalité : A#→Bb, D#→Eb, G#→Ab). La détection ne donne que majeurs
   et mineurs ; n'ajoute pas de 7e/sus. Tu régularises le RYTHME et la STRUCTURE, pas
   l'harmonie.

Réponds UNIQUEMENT avec ce JSON (sans texte autour) :
{
  "title": "${meta.title ? meta.title.replace(/"/g, '\\"') : ''}",
  "artist": "${meta.author ? meta.author.replace(/"/g, '\\"') : ''}",
  "key": "",
  "timeSignature": "${beatsPerBar}/4",
  "tempo": "${Math.round(tl.bpm)}",
  "sections": [
    { "label": "Couplet", "repeat": 2, "chords": [ { "chord": "Am", "beats": ${beatsPerBar} }, { "chord": "G", "beats": ${beatsPerBar} } ] }
  ]
}

Règles JSON : tout accord commence par A-G (majuscule) + éventuellement # ou b + suffixe (m).
Chaque "beats" est un entier de 1 à ${beatsPerBar}, et les accords d'une section se
regroupent en mesures pleines de ${beatsPerBar} temps.`;
}

// Deuxième passe : relecture/critique de la grille assemblée (générateur → critique).
export function buildReviewPrompt(
  gridJson: string,
  beatsPerBar: number,
  tl: Timeline,
  meta: { title: string; author: string },
): string {
  const half = Math.round(beatsPerBar / 2);
  return `Tu es un relecteur musical exigeant. Voici une grille d'accords BROUILLON, issue
d'une détection audio approximative puis d'une première structuration automatique. Elle
contient probablement des irrégularités. Corrige-la pour qu'elle soit MUSICALEMENT
COHÉRENTE et RÉGULIÈRE, comme la relèverait un musicien expérimenté.

Contexte : ${meta.title || 'morceau'}${meta.author ? ' — ' + meta.author : ''}, tonalité ${tl.key || 'inconnue'}, ${Math.round(tl.bpm)} BPM, mesure ${beatsPerBar}/4.

Grille à relire (JSON) :
${gridJson}

Vérifie et corrige, dans cet ordre :
1. MESURES RÉGULIÈRES : dans chaque section, les "beats" consécutifs doivent se regrouper
   en mesures pleines de EXACTEMENT ${beatsPerBar} temps (ex. en 4/4 : 4, ou 2+2, ou 4×1 ;
   jamais 3+2). Un accord tient le plus souvent une mesure (${beatsPerBar}) ou une demi-mesure (${half}).
   Supprime les durées bizarres et les fragments parasites (accord d'1 temps qui n'apparaît
   qu'une fois entre deux autres) en les absorbant dans l'accord voisin dominant.
2. RÉPÉTITION ET STRUCTURE : une vraie chanson a PEU de motifs distincts qui reviennent.
   Les sections font typiquement 4, 8 ou 16 mesures. Repère les progressions qui se répètent,
   factorise-les avec "repeat", et nomme les sections (Intro, Couplet, Refrain, Pont…).
   Si deux sections voisines sont identiques, fusionne-les avec un repeat.
3. COHÉRENCE HARMONIQUE : en tonalité ${tl.key || '?'}, un accord isolé qui casse une boucle
   par ailleurs répétée est très probablement une erreur de détection → aligne-le sur le motif.
   Ne touche pas aux accords clairement établis et récurrents.
4. Accords majeurs/mineurs uniquement, respellés selon la tonalité (A#→Bb, D#→Eb, G#→Ab).
   N'invente pas de 7e/sus. Tu régularises le RYTHME et la STRUCTURE, tu ne réharmonises pas.

Réponds UNIQUEMENT avec le même schéma JSON, sans texte autour :
{ "title": "${meta.title ? meta.title.replace(/"/g, '\\"') : ''}", "artist": "${meta.author ? meta.author.replace(/"/g, '\\"') : ''}", "key": "", "timeSignature": "${beatsPerBar}/4", "tempo": "${Math.round(tl.bpm)}", "sections": [ { "label": "Couplet", "repeat": 2, "chords": [ { "chord": "Am", "beats": ${beatsPerBar} } ] } ] }
Chaque "beats" est un entier de 1 à ${beatsPerBar} et les accords d'une section se regroupent en mesures pleines de ${beatsPerBar} temps.`;
}

// Normalise les accords produits par l'IA (comme analyze-sheet).
export function normalizeSections(parsed: { sections?: unknown[] }, beatsPerBar: number): void {
  const validRoot = /^[A-G][#b]?/;
  if (!Array.isArray(parsed.sections)) return;
  for (const section of parsed.sections as { chords?: unknown[] }[]) {
    if (!Array.isArray(section.chords)) continue;
    section.chords = section.chords.map((c: unknown) => {
      const obj = c as { chord?: string; beats?: number };
      const chord = typeof obj.chord === 'string' && (obj.chord === '' || validRoot.test(obj.chord)) ? obj.chord : '';
      const beats = typeof obj.beats === 'number' && obj.beats > 0 ? obj.beats : beatsPerBar;
      return { chord, beats };
    });
  }
}

export async function fetchOEmbed(url: string): Promise<{ title: string; author: string }> {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
    if (!res.ok) return { title: '', author: '' };
    const d = await res.json();
    return { title: d.title ?? '', author: d.author_name ?? '' };
  } catch {
    return { title: '', author: '' };
  }
}

export const isYoutubeUrl = (u: string): boolean =>
  /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(u);

// ── Quota OCR (mutualisé analyse photo + audio) ─────────────────────────────
/** true si l'utilisateur peut lancer une analyse (Pro ou quota restant). */
export async function canAnalyze(userId: string): Promise<boolean> {
  try {
    const db = getAdminDb();
    const sub = (await db.collection('users').doc(userId).collection('private').doc('subscription').get()).data();
    const isPro = sub?.plan === 'pro' && (sub?.status === 'active' || sub?.status === 'trialing');
    if (isPro) return true;
    const resetAt = sub?.ocrResetAt?.toDate?.();
    const used = resetAt && new Date() > resetAt ? 0 : (sub?.ocrUsedThisMonth ?? 0);
    const credits = sub?.earnedOcrCredits ?? 0;
    return used < FREE_LIMIT || credits > 0;
  } catch (e) {
    console.error('[audio] canAnalyze error (non-blocking, autorise):', e);
    return true; // ne pas bloquer sur une erreur de lecture quota
  }
}

/** Décompte une analyse réussie (gratuite). No-op pour les Pro. */
export async function consumeAnalysis(userId: string): Promise<void> {
  try {
    const db = getAdminDb();
    const FieldValue = getAdminFieldValue();
    const subRef = db.collection('users').doc(userId).collection('private').doc('subscription');
    const sub = (await subRef.get()).data();
    const isPro = sub?.plan === 'pro' && (sub?.status === 'active' || sub?.status === 'trialing');
    if (isPro) return;
    const resetAt = sub?.ocrResetAt?.toDate?.();
    const nextReset = new Date();
    nextReset.setMonth(nextReset.getMonth() + 1);
    const used = resetAt && new Date() > resetAt ? 0 : (sub?.ocrUsedThisMonth ?? 0);
    const credits = sub?.earnedOcrCredits ?? 0;
    if (used >= FREE_LIMIT && credits > 0) {
      await subRef.set({ earnedOcrCredits: FieldValue.increment(-1) }, { merge: true });
    } else if (resetAt && new Date() > resetAt) {
      await subRef.set({ ocrUsedThisMonth: 1, ocrResetAt: nextReset }, { merge: true });
    } else {
      await subRef.set({ ocrUsedThisMonth: FieldValue.increment(1), ocrResetAt: resetAt ?? nextReset }, { merge: true });
    }
  } catch (e) {
    console.error('[audio] consumeAnalysis failed:', e);
  }
}
