/**
 * Transposition d'accords.
 * Gère les notations : Am, G7, Cmaj7, F#m, Bbsus4, A/E...
 */

const SHARP_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NOTES  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// Notes qui préfèrent les bémols
const PREFER_FLAT = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb']);

function noteToSemitone(note: string): number {
  const idx = SHARP_NOTES.indexOf(note);
  if (idx !== -1) return idx;
  return FLAT_NOTES.indexOf(note);
}

function semitoneToNote(semi: number, preferFlat: boolean): string {
  const n = ((semi % 12) + 12) % 12;
  if (preferFlat) return FLAT_NOTES[n];
  return SHARP_NOTES[n];
}

// Extrait la note racine (ex: "F#", "Bb", "C") depuis le début d'une chaîne
function parseRoot(s: string): { root: string; rest: string } | null {
  // 2 chars : C#, Db, D#, Eb, F#, Gb, G#, Ab, A#, Bb
  if (s.length >= 2 && (s[1] === '#' || s[1] === 'b')) {
    const root = s.slice(0, 2);
    if (noteToSemitone(root) !== -1) return { root, rest: s.slice(2) };
  }
  // 1 char
  if (noteToSemitone(s[0]) !== -1) return { root: s[0], rest: s.slice(1) };
  return null;
}

export function transposeChord(chord: string, semitones: number): string {
  if (!chord.trim()) return chord;

  // Gestion des accords slash (A/E → transpose les deux)
  const slashIdx = chord.lastIndexOf('/');
  if (slashIdx > 0) {
    const left = chord.slice(0, slashIdx);
    const right = chord.slice(slashIdx + 1);
    return `${transposeChord(left, semitones)}/${transposeChord(right, semitones)}`;
  }

  const parsed = parseRoot(chord);
  if (!parsed) return chord;

  const { root, rest } = parsed;
  const semi = noteToSemitone(root);
  if (semi === -1) return chord;

  const newSemi = semi + semitones;
  // Décider bémol ou dièse : si la note transposée atterrit sur du # ou du b,
  // on suit la logique de la tonalité cible
  const transposedSharp = semitoneToNote(newSemi, false);
  const preferFlat = PREFER_FLAT.has(transposedSharp) || chord.includes('b');
  const newRoot = semitoneToNote(newSemi, preferFlat);

  return newRoot + rest;
}

export function transposeSections(
  sections: import('@/types').Section[],
  semitones: number,
): import('@/types').Section[] {
  if (semitones === 0) return sections;
  return sections.map(section => ({
    ...section,
    rows: section.rows.map(row =>
      row.map(cell => ({
        ...cell,
        chord: transposeChord(cell.chord, semitones),
      })),
    ),
  }));
}

export function transposeKey(key: string, semitones: number): string {
  if (!key) return key;
  return transposeChord(key, semitones);
}
