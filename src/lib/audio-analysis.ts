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

// Durée médiane d'un temps (intervalles entre temps détectés) — plus stable que le BPM.
function medianBeatDur(tl: Timeline): number {
  const times = tl.downbeats.map((d) => d[0]).sort((a, b) => a - b);
  const diffs: number[] = [];
  for (let i = 1; i < times.length; i++) { const d = times[i] - times[i - 1]; if (d > 0.05 && d < 3) diffs.push(d); }
  if (!diffs.length) return tl.bpm > 0 ? 60 / tl.bpm : 0.5;
  diffs.sort((a, b) => a - b);
  return diffs[Math.floor(diffs.length / 2)];
}

// Filtre anti-parasites : supprime les segments d'accord trop courts (blips de
// détection) en les absorbant dans le précédent, puis re-fusionne les identiques.
function dropShortChords(chords: Timeline['chords'], minDur: number): Timeline['chords'] {
  const kept: Timeline['chords'] = [];
  for (const c of chords) {
    if (c.end - c.start < minDur && kept.length) kept[kept.length - 1] = { ...kept[kept.length - 1], end: c.end };
    else kept.push({ ...c });
  }
  const merged: Timeline['chords'] = [];
  for (const c of kept) {
    const last = merged[merged.length - 1];
    if (last && madmomToChord(last.label) === madmomToChord(c.label)) last.end = c.end;
    else merged.push({ ...c });
  }
  return merged;
}

// Suite d'accords temps par temps, construite depuis la DURÉE de chaque segment
// d'accord (fiable) quantifiée en temps. Robuste au jitter des temps individuels,
// tout en conservant les accords tenus sur plusieurs mesures. Silence de tête/queue retiré.
function chordPerBeat(chords: Timeline['chords'], beatDur: number): string[] {
  const perBeat: string[] = [];
  for (const c of chords) {
    const beats = Math.max(1, Math.round((c.end - c.start) / beatDur));
    const ch = madmomToChord(c.label);
    for (let k = 0; k < beats; k++) perBeat.push(ch);
  }
  let a = 0;
  while (a < perBeat.length && !perBeat[a]) a++;
  let b = perBeat.length;
  while (b > a && !perBeat[b - 1]) b--;
  return perBeat.slice(a, b);
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

// Redimensionne des durées de runs pour totaliser `target` temps (proportionnel,
// min 1, somme exacte). Sert à caler la boucle sur un nombre entier de mesures.
function rescaleRuns(runs: { chord: string; beats: number }[], target: number): number[] {
  const sum = runs.reduce((a, r) => a + r.beats, 0) || 1;
  const b = runs.map((r) => Math.max(1, Math.round((r.beats * target) / sum)));
  let s = b.reduce((a, x) => a + x, 0);
  let guard = 1000;
  while (s !== target && guard-- > 0) {
    if (s < target) { const i = b.indexOf(Math.max(...b)); b[i]++; s++; }
    else { let i = b.indexOf(Math.max(...b)); if (b[i] <= 1) break; b[i]--; s--; void i; }
  }
  return b;
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

// Accord tonique déduit de la tonalité (ex. "e minor" → "Em"), en écriture dièse
// pour comparer aux accords madmom.
function keyTonic(key: string): string {
  const m = (key || '').trim().match(/^([A-Ga-g])([#b]?)\s*(maj|min|major|minor)?/i);
  if (!m) return '';
  const root = FLAT_TO_SHARP[m[1].toUpperCase() + (m[2] || '')] ?? (m[1].toUpperCase() + (m[2] || ''));
  return root + (/min/i.test(m[3] || '') ? 'm' : '');
}

// Fait démarrer la boucle sur l'accord STABLE : de préférence la TONIQUE (accord de
// repos) tenue sur une mesure ; à défaut, le début de la plus longue série de mesures
// d'un même accord. Ne tourne que par mesures entières (calage rythmique préservé).
function rotateToStableStart(canon: string[], beatsPerBar: number, tonic: string): string[] {
  const mil = Math.floor(canon.length / beatsPerBar);
  if (mil < 2) return canon;
  const measureChord: (string | null)[] = [];
  for (let m = 0; m < mil; m++) {
    const sl = canon.slice(m * beatsPerBar, (m + 1) * beatsPerBar);
    measureChord.push(sl.every((c) => c && c === sl[0]) ? sl[0] : null);
  }
  const isRunStart = (s: number): boolean => measureChord[(s - 1 + mil) % mil] !== measureChord[s];
  const runLen = (s: number): number => {
    let len = 1;
    while (len < mil && measureChord[(s + len) % mil] === measureChord[s]) len++;
    return len;
  };
  const pick = (filter: (c: string) => boolean): number => {
    let best = -1, bestLen = 0;
    for (let s = 0; s < mil; s++) {
      const c = measureChord[s];
      if (!c || !filter(c) || !isRunStart(s)) continue;
      const len = runLen(s);
      if (len > bestLen) { bestLen = len; best = s; }
    }
    return best;
  };
  // 1) démarrer sur la tonique si elle apparaît comme mesure tenue ; 2) sinon plus longue série.
  let start = tonic ? pick((c) => c === tonic) : -1;
  if (start < 0) start = pick(() => true);
  if (start <= 0) return canon;
  const off = start * beatsPerBar;
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

// Fraction de correspondance entre deux blocs de longueur `len` (positions a et b).
function blockMatch(seq: string[], a: number, b: number, len: number): number {
  let m = 0, t = 0;
  for (let i = 0; i < len; i++) {
    if (b + i >= seq.length) break;
    t++;
    if (seq[a + i] && seq[a + i] === seq[b + i]) m++;
  }
  return t ? m / t : 0;
}

// Plus petite période P telle que le bloc démarrant en `pos` se répète juste après
// (boucle LOCALE — permet à la boucle de changer d'une section à l'autre).
function detectLocalLoop(seq: string[], pos: number): number | null {
  // Plafonné à 32 temps (≈ 8 mesures) : une boucle de section est courte ; au-delà
  // c'est une fausse boucle (partie complexe non répétitive) → mieux vaut du solo.
  const maxP = Math.min(32, Math.floor((seq.length - pos) / 2));
  for (let P = 2; P <= maxP; P++) {
    if (blockMatch(seq, pos, pos + P, P) >= 0.75) return P;
  }
  return null;
}

// Construit les mesures d'une section bouclée : canon (période quelconque) calé sur
// un nombre entier de mesures, redimensionné, rotations, puis répété `reps` fois.
function buildLoopMeasures(canon: string[], reps: number, beatsPerBar: number, tonic: string): Measure[] {
  const runs: { chord: string; beats: number }[] = [];
  for (const ch of canon) { const l = runs[runs.length - 1]; if (l && l.chord === ch) l.beats++; else runs.push({ chord: ch, beats: 1 }); }
  const solid = runs.filter((r) => r.chord);
  if (!solid.length) return [];
  const measuresInLoop = Math.max(1, Math.round(canon.length / beatsPerBar));
  const target = measuresInLoop * beatsPerBar;
  const scaled = rescaleRuns(solid, target);
  let lpb: string[] = [];
  solid.forEach((r, i) => { for (let k = 0; k < scaled[i]; k++) lpb.push(r.chord); });
  lpb = rotateForMeasurePhase(lpb, beatsPerBar);
  lpb = rotateToStableStart(lpb, beatsPerBar, tonic);
  const out: Measure[] = [];
  for (let m = 0; m < reps * measuresInLoop; m++) {
    const s = (m % measuresInLoop) * beatsPerBar;
    out.push(groupBeats(lpb.slice(s, s + beatsPerBar), beatsPerBar));
  }
  return out;
}

export function toMeasures(tl: Timeline, beatsPerBar: number, debug?: Record<string, unknown>): Measure[] {
  const beatDur = medianBeatDur(tl);
  // Filtre parasites (blips < ~0.45 temps) puis suite d'accords temps par temps.
  const segs = dropShortChords(tl.chords, beatDur * 0.45);
  const perBeat = chordPerBeat(segs, beatDur);
  if (!perBeat.length) return [];
  const tonic = keyTonic(tl.key);

  // Découpage EN SECTIONS : on avance dans le morceau, on détecte une boucle locale,
  // on l'étend tant qu'elle se répète, puis on recommence (nouvelle section) quand le
  // motif change. Les zones sans boucle nette sortent en mesures simples.
  const measures: Measure[] = [];
  const sectionsDbg: string[] = [];
  let pos = 0, guard = 100000;
  while (pos < perBeat.length && guard-- > 0) {
    const P = detectLocalLoop(perBeat, pos);
    if (P) {
      let reps = 1;
      while (pos + (reps + 1) * P <= perBeat.length && blockMatch(perBeat, pos, pos + reps * P, P) >= 0.65) reps++;
      if (reps >= 2) {
        const secSeq = perBeat.slice(pos, pos + reps * P);
        const canon = repairBigrams(majorityFold(secSeq, P), secSeq, frequentChords(secSeq));
        const secMeasures = buildLoopMeasures(canon, reps, beatsPerBar, tonic);
        measures.push(...secMeasures);
        sectionsDbg.push(`loop P${P}x${reps}(${secMeasures.length}mes)`);
        pos += reps * P;
        continue;
      }
    }
    measures.push(reduceMeasure(perBeat.slice(pos, pos + beatsPerBar), beatsPerBar));
    sectionsDbg.push('solo');
    pos += beatsPerBar;
  }

  if (debug) {
    debug.bpm = tl.bpm;
    debug.key = tl.key;
    debug.tonic = tonic;
    debug.beatDurMedian = beatDur;
    debug.perBeatHead = perBeat.slice(0, 96).join(' ');
    debug.sections = sectionsDbg.slice(0, 40).join(' | ');
    debug.measuresHead = measures
      .slice(0, 16)
      .map((mz) => mz.map((c) => `${c.chord || '-'}${c.beats > 1 ? '·' + c.beats : ''}`).join(' '))
      .join(' | ');
    debug.segDurHead = segs
      .slice(0, 48)
      .map((c) => `${madmomToChord(c.label) || '-'}:${(c.end - c.start).toFixed(2)}`)
      .join(' ');
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
