import type { StringChord, PianoChord, InstrumentId, FingerPosition, ChordBarre } from '@/types';
import { isPianoChord } from '@/types';

// Pitch class (0–11) de chaque corde à vide, par instrument
// Corde 1 = la plus aiguë
const OPEN_PC: Record<string, Record<number, number>> = {
  guitar:   { 6: 4, 5: 9, 4: 2, 3: 7, 2: 11, 1: 4 }, // E A D G B E
  ukulele:  { 4: 7, 3: 0, 2: 4,  1: 9 },              // G C E A
  mandolin: { 4: 7, 3: 2, 2: 9,  1: 4 },              // G D A E
  banjo:    { 5: 7, 4: 2, 3: 7, 2: 11, 1: 2 },        // G D G B D
};

const NOTE_PC: Record<string, number> = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
  'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
  'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11,
};

function noteToPitchClass(note: string): number | null {
  const m = note.match(/^([A-G][b#]?)/);
  if (!m) return null;
  return NOTE_PC[m[1]] ?? null;
}

export function selectionToPitchClasses(
  instrumentId: InstrumentId,
  fingers: FingerPosition[],
  openStrings: number[],
  barre: ChordBarre | null,
): Set<number> {
  const pcs = new Set<number>();
  const openPc = OPEN_PC[instrumentId];
  if (!openPc) return pcs;

  for (const s of openStrings) {
    const base = openPc[s];
    if (base !== undefined) pcs.add(base % 12);
  }
  for (const [s, f] of fingers) {
    const base = openPc[s];
    if (base !== undefined) pcs.add((base + f) % 12);
  }
  if (barre) {
    const min = Math.min(barre.fromString, barre.toString);
    const max = Math.max(barre.fromString, barre.toString);
    for (let s = min; s <= max; s++) {
      if (!fingers.some(([fs]) => fs === s)) {
        const base = openPc[s];
        if (base !== undefined) pcs.add((base + barre.fret) % 12);
      }
    }
  }
  return pcs;
}

export function pianoPitchClasses(notes: string[]): Set<number> {
  const pcs = new Set<number>();
  for (const note of notes) {
    const pc = noteToPitchClass(note);
    if (pc !== null) pcs.add(pc);
  }
  return pcs;
}

function chordToPitchClasses(chord: StringChord | PianoChord, instrumentId: InstrumentId): Set<number> {
  if (isPianoChord(chord)) return pianoPitchClasses(chord.notes);
  return selectionToPitchClasses(instrumentId, chord.fingers, chord.open, chord.barre ?? null);
}

function jaccard(a: Set<number>, b: Set<number>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const pc of a) if (b.has(pc)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export interface ChordMatch {
  chord: StringChord | PianoChord;
  score: number; // 0–1
}

export function findMatchingChords(
  selectionPcs: Set<number>,
  allChords: (StringChord | PianoChord)[],
  instrumentId: InstrumentId,
  minScore = 0.4,
  maxResults = 8,
): ChordMatch[] {
  if (selectionPcs.size === 0) return [];

  // Garder le meilleur score par nom d'accord
  const bestByName = new Map<string, ChordMatch>();
  for (const chord of allChords) {
    const score = jaccard(selectionPcs, chordToPitchClasses(chord, instrumentId));
    if (score >= minScore) {
      const existing = bestByName.get(chord.name);
      if (!existing || score > existing.score) {
        bestByName.set(chord.name, { chord, score });
      }
    }
  }

  return Array.from(bestByName.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
}
