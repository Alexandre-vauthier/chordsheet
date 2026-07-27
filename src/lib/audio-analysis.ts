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

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

type Segment = { chord: string; start: number; end: number };

// Fusionne les segments d'accords consécutifs identiques (madmom → maj/min).
function mergeSegments(chords: Timeline['chords']): Segment[] {
  const out: Segment[] = [];
  for (const c of chords) {
    const chord = madmomToChord(c.label);
    const last = out[out.length - 1];
    if (last && last.chord === chord) last.end = c.end;
    else out.push({ chord, start: c.start, end: c.end });
  }
  return out;
}

// Supprime les segments trop courts (bruit / accords parasites) en les absorbant
// dans le précédent, puis re-fusionne. Nettoie la suite d'accords avant analyse.
function dropShortSegments(segs: Segment[], minDur: number): Segment[] {
  const kept: Segment[] = [];
  for (const s of segs) {
    if (s.end - s.start < minDur && kept.length) kept[kept.length - 1].end = s.end;
    else kept.push({ ...s });
  }
  const merged: Segment[] = [];
  for (const s of kept) {
    const last = merged[merged.length - 1];
    if (last && last.chord === s.chord) last.end = s.end;
    else merged.push({ ...s });
  }
  return merged;
}

// Plus petite période (en NOMBRE D'ACCORDS) de la suite de labels — robuste au
// tempo puisqu'elle ne dépend que de l'ordre des accords, pas de leur durée.
function detectLabelPeriod(labels: string[]): number | null {
  const n = labels.length;
  if (n < 4) return null;
  for (let p = 1; p <= Math.floor(n / 2); p++) {
    let ok = 0, tot = 0;
    for (let i = 0; i + p < n; i++) { tot++; if (labels[i] === labels[i + p]) ok++; }
    if (tot && ok / tot >= 0.8) return p;
  }
  return null;
}

// Fait tourner le motif (au temps près) pour qu'aucun accord ne soit coupé par une
// barre de mesure : choisit le décalage qui minimise les accords à cheval.
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
  const raw = mergeSegments(tl.chords).filter((s) => s.end > s.start);
  if (!raw.length) return [];

  // Durée d'un temps / d'une mesure : médiane des intervalles entre temps.
  const beatTimes = tl.downbeats.map((d) => d[0]).sort((a, b) => a - b);
  const diffs: number[] = [];
  for (let i = 1; i < beatTimes.length; i++) {
    const d = beatTimes[i] - beatTimes[i - 1];
    if (d > 0.05 && d < 3) diffs.push(d);
  }
  const beatDur = diffs.length ? median(diffs) : (tl.bpm > 0 ? 60 / tl.bpm : 0.5);
  const measureDur = beatsPerBar * beatDur;
  const songDur = tl.duration || raw[raw.length - 1].end;

  // Nettoie les micro-parasites, puis on travaille sur la SUITE d'accords.
  const segs = dropShortSegments(raw, beatDur * 0.5);
  const period = measureDur > 0 ? detectLabelPeriod(segs.map((s) => s.chord)) : null;

  // Longueurs autorisées par accord, en fraction de mesure (arrondi tolérant au tempo).
  const allowed = beatsPerBar === 3 ? [1, 2, 3, 4] : [0.5, 1, 1.5, 2, 3, 4];
  const snapMeasures = (durSec: number): number => {
    const ratio = durSec / measureDur;
    let best = allowed[0];
    for (const a of allowed) if (Math.abs(a - ratio) < Math.abs(best - ratio)) best = a;
    return best;
  };

  if (period) {
    // 1) DESSINE LE MOTIF : accord majoritaire + longueur médiane par position.
    const pattern: { chord: string; beats: number }[] = [];
    for (let j = 0; j < period; j++) {
      const durs: number[] = [];
      const counts: Record<string, number> = {};
      for (let i = j; i < segs.length; i += period) {
        durs.push(segs[i].end - segs[i].start);
        counts[segs[i].chord] = (counts[segs[i].chord] ?? 0) + 1;
      }
      const chord = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
      pattern.push({ chord, beats: Math.max(1, Math.round(snapMeasures(median(durs)) * beatsPerBar)) });
    }
    // 2) Cale la longueur du motif sur des mesures pleines.
    let totalBeats = pattern.reduce((a, c) => a + c.beats, 0);
    const rem = ((totalBeats % beatsPerBar) + beatsPerBar) % beatsPerBar;
    if (rem !== 0) {
      const idx = pattern.reduce((bi, c, i, arr) => (c.beats > arr[bi].beats ? i : bi), 0);
      pattern[idx].beats = Math.max(1, pattern[idx].beats + (rem <= beatsPerBar / 2 ? -rem : beatsPerBar - rem));
      totalBeats = pattern.reduce((a, c) => a + c.beats, 0);
    }
    // 3) POSITIONNE dans la grille : motif → temps, calé pour ne couper aucun accord.
    let loopPerBeat: string[] = [];
    for (const c of pattern) for (let k = 0; k < c.beats; k++) loopPerBeat.push(c.chord);
    loopPerBeat = rotateForMeasurePhase(loopPerBeat, beatsPerBar);

    // 4) Répète le motif propre sur toute la durée du morceau.
    const measuresInLoop = Math.max(1, Math.round(loopPerBeat.length / beatsPerBar));
    const totalMeasures = Math.max(measuresInLoop, Math.round(songDur / measureDur));
    const measures: Measure[] = [];
    for (let m = 0; m < totalMeasures; m++) {
      const s = (m % measuresInLoop) * beatsPerBar;
      measures.push(groupBeats(loopPerBeat.slice(s, s + beatsPerBar), beatsPerBar));
    }
    return measures;
  }

  // Repli (pas de boucle nette) : chaque accord positionné à sa longueur arrondie.
  const flat: string[] = [];
  for (const s of segs) {
    const beats = Math.max(1, Math.round(snapMeasures(s.end - s.start) * beatsPerBar));
    for (let k = 0; k < beats; k++) flat.push(s.chord);
  }
  const measures: Measure[] = [];
  for (let i = 0; i < flat.length; i += beatsPerBar) {
    const slice = flat.slice(i, i + beatsPerBar);
    if (!slice.length) break;
    measures.push(reduceMeasure(slice, beatsPerBar));
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
