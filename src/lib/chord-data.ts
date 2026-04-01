// Bibliothèque de données d'accords pour tous les instruments
import type { StringChord, PianoChord, Instrument, InstrumentId } from '@/types';

// ─── Configuration des instruments ────────────────────────────────────────────

export const INSTRUMENT_CONFIG: Record<InstrumentId, Instrument> = {
  guitar: { id: 'guitar', label: 'Guitare', strings: 6 },
  mandolin: { id: 'mandolin', label: 'Mandoline', strings: 4 },
  banjo: { id: 'banjo', label: 'Banjo', strings: 5 },
  ukulele: { id: 'ukulele', label: 'Ukulélé', strings: 4 },
  piano: { id: 'piano', label: 'Piano', strings: 0 },
};

// ─── Catégories d'accords ─────────────────────────────────────────────────────

export const CHORD_CATEGORIES = {
  guitar: [
    { id: 'all', label: 'Tous' },
    { id: 'open', label: 'Ouverts' },
    { id: 'barre', label: 'Barrés' },
    { id: 'jazz', label: 'Jazz / Ext.' },
  ],
  mandolin: [
    { id: 'all', label: 'Tous' },
    { id: 'open', label: 'Ouverts' },
    { id: 'seventh', label: '7ème' },
    { id: 'barre', label: 'Barrés' },
  ],
  banjo: [
    { id: 'all', label: 'Tous' },
    { id: 'open', label: 'Ouverts' },
    { id: 'seventh', label: '7ème' },
    { id: 'barre', label: 'Barrés' },
  ],
  ukulele: [
    { id: 'all', label: 'Tous' },
    { id: 'open', label: 'Ouverts' },
    { id: 'seventh', label: '7ème' },
    { id: 'barre', label: 'Barrés' },
  ],
  piano: [
    { id: 'all',   label: 'Tous' },
    { id: 'major', label: 'Majeurs' },
    { id: 'minor', label: 'Mineurs' },
    { id: 'dom7',  label: '7' },
    { id: 'maj7',  label: 'Maj7' },
    { id: 'min7',  label: 'Min7' },
    { id: 'dim',   label: 'Dim' },
    { id: 'aug',   label: 'Aug' },
    { id: 'sus',   label: 'Sus' },
    { id: 'add9',  label: 'Add9' },
  ],
};

// ─── Accords Guitare ──────────────────────────────────────────────────────────

export const GUITAR_CHORDS: StringChord[] = [
  // Ouverts
  { id: 'Em', name: 'Em', full: 'E minor', category: 'open', fingers: [[4,2,2],[5,2,3]], open: [1,2,3,6], muted: [], startFret: 1 },
  { id: 'E', name: 'E', full: 'E major', category: 'open', fingers: [[3,1,1],[4,2,2],[5,2,3]], open: [1,2,6], muted: [], startFret: 1 },
  { id: 'E7', name: 'E7', full: 'E dominant 7', category: 'open', fingers: [[3,1,1],[5,2,2]], open: [1,2,4,6], muted: [], startFret: 1 },
  { id: 'Am', name: 'Am', full: 'A minor', category: 'open', fingers: [[2,1,1],[3,2,2],[4,2,3]], open: [1,5], muted: [6], startFret: 1 },
  { id: 'A', name: 'A', full: 'A major', category: 'open', fingers: [[2,2,1],[3,2,2],[4,2,3]], open: [1,5], muted: [6], startFret: 1 },
  { id: 'A7', name: 'A7', full: 'A dominant 7', category: 'open', fingers: [[2,2,1],[4,2,2]], open: [1,3,5], muted: [6], startFret: 1 },
  { id: 'Am7', name: 'Am7', full: 'A minor 7', category: 'open', fingers: [[2,1,1],[4,2,2]], open: [1,3,5], muted: [6], startFret: 1 },
  { id: 'D', name: 'D', full: 'D major', category: 'open', fingers: [[1,2,1],[2,3,3],[3,2,2]], open: [4], muted: [5,6], startFret: 1 },
  { id: 'Dm', name: 'Dm', full: 'D minor', category: 'open', fingers: [[1,1,1],[2,3,3],[3,2,2]], open: [4], muted: [5,6], startFret: 1 },
  { id: 'D7', name: 'D7', full: 'D dominant 7', category: 'open', fingers: [[1,2,3],[2,1,1],[3,2,2]], open: [4], muted: [5,6], startFret: 1 },
  { id: 'G', name: 'G', full: 'G major', category: 'open', fingers: [[1,3,4],[5,2,2],[6,3,3]], open: [2,3,4], muted: [], startFret: 1 },
  { id: 'G7', name: 'G7', full: 'G dominant 7', category: 'open', fingers: [[1,1,1],[5,2,2],[6,3,3]], open: [2,3,4], muted: [], startFret: 1 },
  { id: 'C', name: 'C', full: 'C major', category: 'open', fingers: [[2,1,1],[4,2,2],[5,3,3]], open: [1,3], muted: [6], startFret: 1 },
  { id: 'C7', name: 'C7', full: 'C dominant 7', category: 'open', fingers: [[2,1,1],[3,3,3],[4,2,2],[5,3,4]], open: [1], muted: [6], startFret: 1 },
  { id: 'F', name: 'F', full: 'F major', category: 'open', fingers: [[3,2,3],[4,3,4]], open: [], muted: [5,6], startFret: 1, barre: { fret: 1, fromString: 1, toString: 2 } },
  { id: 'B7', name: 'B7', full: 'B dominant 7', category: 'open', fingers: [[1,2,1],[3,2,3],[4,1,2],[5,2,4]], open: [2], muted: [6], startFret: 1 },

  // Barrés
  { id: 'F_barre', name: 'F', full: 'F major (barré)', category: 'barre', fingers: [[3,2,2],[4,3,4],[5,3,3]], open: [], muted: [], startFret: 1, barre: { fret: 1, fromString: 1, toString: 6 } },
  { id: 'Fm', name: 'Fm', full: 'F minor (barré)', category: 'barre', fingers: [[4,3,3],[5,3,4]], open: [], muted: [], startFret: 1, barre: { fret: 1, fromString: 1, toString: 6 } },
  { id: 'Gm', name: 'Gm', full: 'G minor', category: 'barre', fingers: [[4,5,3],[5,5,4]], open: [], muted: [], startFret: 3, barre: { fret: 3, fromString: 1, toString: 6 } },
  { id: 'Cm', name: 'Cm', full: 'C minor', category: 'barre', fingers: [[3,5,3],[4,5,4]], open: [], muted: [], startFret: 3, barre: { fret: 3, fromString: 1, toString: 5 } },
  { id: 'Bb', name: 'Bb', full: 'Bb major', category: 'barre', fingers: [[2,3,4],[3,3,3],[4,3,2]], open: [], muted: [], startFret: 1, barre: { fret: 1, fromString: 1, toString: 5 } },
  { id: 'Bbm', name: 'Bbm', full: 'Bb minor', category: 'barre', fingers: [[3,3,2],[4,3,3]], open: [], muted: [], startFret: 1, barre: { fret: 1, fromString: 1, toString: 5 } },
  { id: 'B', name: 'B', full: 'B major', category: 'barre', fingers: [[2,4,4],[3,4,3],[4,4,2]], open: [], muted: [], startFret: 2, barre: { fret: 2, fromString: 1, toString: 5 } },
  { id: 'Bm', name: 'Bm', full: 'B minor', category: 'barre', fingers: [[3,4,2],[4,4,3]], open: [], muted: [], startFret: 2, barre: { fret: 2, fromString: 1, toString: 5 } },
  { id: 'Db', name: 'Db', full: 'Db major', category: 'barre', fingers: [[2,6,4],[3,6,3],[4,6,2]], open: [], muted: [], startFret: 4, barre: { fret: 4, fromString: 1, toString: 5 } },
  { id: 'Eb', name: 'Eb', full: 'Eb major', category: 'barre', fingers: [[2,8,4],[3,8,3],[4,8,2]], open: [], muted: [], startFret: 6, barre: { fret: 6, fromString: 1, toString: 5 } },
  { id: 'Ab', name: 'Ab', full: 'Ab major', category: 'barre', fingers: [[3,5,2],[4,6,4],[5,6,3]], open: [], muted: [], startFret: 4, barre: { fret: 4, fromString: 1, toString: 6 } },
  { id: 'Abm', name: 'Abm', full: 'Ab minor', category: 'barre', fingers: [[4,6,2],[5,6,3]], open: [], muted: [], startFret: 4, barre: { fret: 4, fromString: 1, toString: 6 } },

  // Jazz / Extensions
  { id: 'Cmaj7', name: 'Cmaj7', full: 'C major 7', category: 'jazz', fingers: [[4,2,2],[5,3,3]], open: [1,2,3], muted: [6], startFret: 1 },
  { id: 'Gmaj7', name: 'Gmaj7', full: 'G major 7', category: 'jazz', fingers: [[1,2,2],[5,2,3],[6,3,4]], open: [2,3,4], muted: [], startFret: 1 },
  { id: 'Dmaj7', name: 'Dmaj7', full: 'D major 7', category: 'jazz', fingers: [[1,2,1],[2,2,2],[3,2,3]], open: [4], muted: [5,6], startFret: 1 },
  { id: 'Amaj7', name: 'Amaj7', full: 'A major 7', category: 'jazz', fingers: [[2,2,2],[4,2,1]], open: [1,3,5], muted: [6], startFret: 1 },
  { id: 'Emaj7', name: 'Emaj7', full: 'E major 7', category: 'jazz', fingers: [[3,1,1],[4,1,2],[5,2,3]], open: [1,2,6], muted: [], startFret: 1 },
  { id: 'Dm7', name: 'Dm7', full: 'D minor 7', category: 'jazz', fingers: [[1,1,1],[2,1,2],[3,2,3]], open: [4], muted: [5,6], startFret: 1 },
  { id: 'Em7', name: 'Em7', full: 'E minor 7', category: 'jazz', fingers: [[5,2,1]], open: [1,2,3,4,6], muted: [], startFret: 1 },
  { id: 'Fm7', name: 'Fm7', full: 'F minor 7', category: 'jazz', fingers: [[4,3,2],[5,3,3]], open: [], muted: [], startFret: 1, barre: { fret: 1, fromString: 1, toString: 6 } },
  { id: 'Gm7', name: 'Gm7', full: 'G minor 7', category: 'jazz', fingers: [[4,5,2],[5,5,3]], open: [], muted: [], startFret: 3, barre: { fret: 3, fromString: 1, toString: 6 } },
  { id: 'Cm7', name: 'Cm7', full: 'C minor 7', category: 'jazz', fingers: [[2,4,2],[4,5,3]], open: [], muted: [], startFret: 3, barre: { fret: 3, fromString: 1, toString: 5 } },
  { id: 'Bm7', name: 'Bm7', full: 'B minor 7', category: 'jazz', fingers: [[2,3,2],[4,4,3]], open: [], muted: [], startFret: 2, barre: { fret: 2, fromString: 1, toString: 5 } },
  { id: 'Csus2', name: 'Csus2', full: 'C suspended 2', category: 'jazz', fingers: [[1,3,4],[2,1,1],[5,3,3]], open: [3,4], muted: [6], startFret: 1 },
  { id: 'Csus4', name: 'Csus4', full: 'C suspended 4', category: 'jazz', fingers: [[1,1,1],[2,1,2],[4,3,3],[5,3,4]], open: [3], muted: [6], startFret: 1 },
  { id: 'Dsus2', name: 'Dsus2', full: 'D suspended 2', category: 'jazz', fingers: [[2,3,3],[3,2,2]], open: [1,4], muted: [5,6], startFret: 1 },
  { id: 'Dsus4', name: 'Dsus4', full: 'D suspended 4', category: 'jazz', fingers: [[1,3,3],[2,3,4],[3,2,2]], open: [4], muted: [5,6], startFret: 1 },
  { id: 'Esus4', name: 'Esus4', full: 'E suspended 4', category: 'jazz', fingers: [[3,2,2],[4,2,3]], open: [1,2,5,6], muted: [], startFret: 1 },
  { id: 'Asus4', name: 'Asus4', full: 'A suspended 4', category: 'jazz', fingers: [[2,3,3],[3,2,2],[4,2,1]], open: [1,5], muted: [6], startFret: 1 },
  { id: 'Asus2', name: 'Asus2', full: 'A suspended 2', category: 'jazz', fingers: [[3,2,2],[4,2,1]], open: [1,2,5], muted: [6], startFret: 1 },
  { id: 'Cadd9', name: 'Cadd9', full: 'C add 9', category: 'jazz', fingers: [[1,3,4],[2,3,3],[4,2,2],[5,3,1]], open: [3], muted: [6], startFret: 1 },
  { id: 'Gadd9', name: 'Gadd9', full: 'G add 9', category: 'jazz', fingers: [[1,3,4],[2,3,3],[6,3,2]], open: [3,4], muted: [5], startFret: 1 },
];

// ─── Accords Ukulélé ──────────────────────────────────────────────────────────

export const UKULELE_CHORDS: StringChord[] = [
  // Ouverts
  { id: 'uC', name: 'C', full: 'C majeur', category: 'open', fingers: [[1,3,1]], open: [2,3,4], muted: [], startFret: 1 },
  { id: 'uAm', name: 'Am', full: 'A mineur', category: 'open', fingers: [[4,2,1]], open: [1,2,3], muted: [], startFret: 1 },
  { id: 'uF', name: 'F', full: 'F majeur', category: 'open', fingers: [[4,2,2],[2,1,1]], open: [1,3], muted: [], startFret: 1 },
  { id: 'uG', name: 'G', full: 'G majeur', category: 'open', fingers: [[3,2,1],[1,2,2],[2,3,3]], open: [4], muted: [], startFret: 1 },
  { id: 'uDm', name: 'Dm', full: 'D mineur', category: 'open', fingers: [[2,1,1],[4,2,2],[3,2,3]], open: [1], muted: [], startFret: 1 },
  { id: 'uA', name: 'A', full: 'A majeur', category: 'open', fingers: [[4,2,2],[3,1,1]], open: [1,2], muted: [], startFret: 1 },
  { id: 'uEm', name: 'Em', full: 'E mineur', category: 'open', fingers: [[3,4,3],[2,3,2],[1,2,1]], open: [4], muted: [], startFret: 1 },
  { id: 'uGm', name: 'Gm', full: 'G mineur', category: 'open', fingers: [[1,1,1],[3,2,2],[2,3,3]], open: [4], muted: [], startFret: 1 },
  { id: 'uCm', name: 'Cm', full: 'C mineur', category: 'open', fingers: [], open: [4], muted: [], startFret: 1, barre: { fret: 3, fromString: 1, toString: 3 } },
  { id: 'uAm7', name: 'Am7', full: 'A mineur 7', category: 'open', fingers: [], open: [1,2,3,4], muted: [], startFret: 1 },
  { id: 'uC7', name: 'C7', full: 'C dominant 7', category: 'open', fingers: [[1,1,1]], open: [2,3,4], muted: [], startFret: 1 },
  { id: 'uA7', name: 'A7', full: 'A dominant 7', category: 'open', fingers: [[3,1,1]], open: [1,2,4], muted: [], startFret: 1 },

  // Septièmes
  { id: 'uG7', name: 'G7', full: 'G dominant 7', category: 'seventh', fingers: [[2,1,1],[3,2,2],[1,2,3]], open: [4], muted: [], startFret: 1 },
  { id: 'uE7', name: 'E7', full: 'E dominant 7', category: 'seventh', fingers: [[4,1,1],[3,2,2],[1,2,3]], open: [2], muted: [], startFret: 1 },
  { id: 'uCmaj7', name: 'Cmaj7', full: 'C majeur 7', category: 'seventh', fingers: [[1,2,1]], open: [2,3,4], muted: [], startFret: 1 },
  { id: 'uGmaj7', name: 'Gmaj7', full: 'G majeur 7', category: 'seventh', fingers: [], open: [4], muted: [], startFret: 1, barre: { fret: 2, fromString: 1, toString: 3 } },

  // Barrés
  { id: 'uD', name: 'D', full: 'D majeur', category: 'barre', fingers: [[4,2,1],[3,2,2],[2,2,3]], open: [1], muted: [], startFret: 2 },
  { id: 'uE', name: 'E', full: 'E majeur', category: 'barre', fingers: [[4,4,4],[3,4,3],[2,4,2],[1,2,1]], open: [], muted: [], startFret: 2 },
  { id: 'uBb', name: 'Bb', full: 'Bb majeur', category: 'barre', fingers: [[4,3,4],[3,2,3],[2,1,1],[1,1,2]], open: [], muted: [], startFret: 1 },
  { id: 'uB', name: 'B', full: 'B majeur', category: 'barre', fingers: [[3,3,1],[4,4,2]], open: [], muted: [], startFret: 2, barre: { fret: 2, fromString: 1, toString: 2 } },
];

// ─── Accords Mandoline ────────────────────────────────────────────────────────

export const MANDOLIN_CHORDS: StringChord[] = [
  // Ouverts
  { id: 'mG', name: 'G', full: 'G majeur', category: 'open', fingers: [[2,2,1],[1,3,2]], open: [3,4], muted: [], startFret: 1 },
  { id: 'mC', name: 'C', full: 'C majeur', category: 'open', fingers: [[3,2,1],[2,3,2]], open: [1,4], muted: [], startFret: 1 },
  { id: 'mD', name: 'D', full: 'D majeur', category: 'open', fingers: [[1,2,1]], open: [2,3], muted: [4], startFret: 1 },
  { id: 'mA', name: 'A', full: 'A majeur', category: 'open', fingers: [[4,2,1],[3,2,2],[2,4,3]], open: [1], muted: [], startFret: 1 },
  { id: 'mE', name: 'E', full: 'E majeur', category: 'open', fingers: [[4,1,1],[3,2,2],[2,2,3]], open: [1], muted: [], startFret: 1 },
  { id: 'mEm', name: 'Em', full: 'E mineur', category: 'open', fingers: [[3,2,1],[2,2,2]], open: [1,4], muted: [], startFret: 1 },
  { id: 'mAm', name: 'Am', full: 'A mineur', category: 'open', fingers: [[4,2,1],[3,2,2],[2,3,3]], open: [1], muted: [], startFret: 1 },
  { id: 'mDm', name: 'Dm', full: 'D mineur', category: 'open', fingers: [[2,3,2],[1,1,1]], open: [3], muted: [4], startFret: 1 },

  // Septièmes
  { id: 'mG7', name: 'G7', full: 'G dominant 7', category: 'seventh', fingers: [[2,2,2],[1,1,1]], open: [3,4], muted: [], startFret: 1 },
  { id: 'mD7', name: 'D7', full: 'D dominant 7', category: 'seventh', fingers: [[4,2,1],[2,3,2],[1,2,3]], open: [3], muted: [], startFret: 1 },
  { id: 'mA7', name: 'A7', full: 'A dominant 7', category: 'seventh', fingers: [[2,4,1],[3,2,2]], open: [1,4], muted: [], startFret: 1 },
  { id: 'mE7', name: 'E7', full: 'E dominant 7', category: 'seventh', fingers: [[4,1,1],[2,2,2]], open: [1,3], muted: [], startFret: 1 },

  // Barrés
  { id: 'mF', name: 'F', full: 'F majeur', category: 'barre', fingers: [[4,2,2],[1,1,1]], open: [], muted: [], startFret: 1, barre: { fret: 3, fromString: 2, toString: 3 } },
  { id: 'mBb', name: 'Bb', full: 'Bb majeur', category: 'barre', fingers: [[4,3,1],[3,3,2]], open: [], muted: [], startFret: 1, barre: { fret: 1, fromString: 1, toString: 2 } },
  { id: 'mBm', name: 'Bm', full: 'B mineur', category: 'barre', fingers: [[4,4,1],[3,4,2],[2,2,3],[1,2,4]], open: [], muted: [], startFret: 2 },
];

// ─── Accords Banjo ────────────────────────────────────────────────────────────

export const BANJO_CHORDS: StringChord[] = [
  // Ouverts (Open G tuning)
  { id: 'bG', name: 'G', full: 'G majeur', category: 'open', fingers: [], open: [1,2,3,4,5], muted: [], startFret: 1 },
  { id: 'bC', name: 'C', full: 'C majeur', category: 'open', fingers: [[4,2,2],[2,1,1],[1,2,3]], open: [3,5], muted: [], startFret: 1 },
  { id: 'bD', name: 'D', full: 'D majeur', category: 'open', fingers: [[4,4,2],[3,2,1],[2,3,3],[1,4,4]], open: [5], muted: [], startFret: 1 },
  { id: 'bAm', name: 'Am', full: 'A mineur', category: 'open', fingers: [[4,2,2],[3,2,3],[2,1,1],[1,2,4]], open: [5], muted: [], startFret: 1 },
  { id: 'bEm', name: 'Em', full: 'E mineur', category: 'open', fingers: [[4,2,1],[1,2,2]], open: [2,3,5], muted: [], startFret: 1 },

  // Septièmes
  { id: 'bG7', name: 'G7', full: 'G dominant 7', category: 'seventh', fingers: [[1,3,1]], open: [2,3,4,5], muted: [], startFret: 1 },
  { id: 'bA7', name: 'A7', full: 'A dominant 7', category: 'seventh', fingers: [], open: [5], muted: [], startFret: 1, barre: { fret: 2, fromString: 1, toString: 4 } },
  { id: 'bC7', name: 'C7', full: 'C dominant 7', category: 'seventh', fingers: [[2,1,1],[4,2,2],[1,2,3],[3,3,4]], open: [5], muted: [], startFret: 1 },

  // Barrés
  { id: 'bF', name: 'F', full: 'F majeur', category: 'barre', fingers: [[2,1,1],[3,2,2],[4,3,3],[1,3,4]], open: [], muted: [5], startFret: 1 },
  { id: 'bA', name: 'A', full: 'A majeur', category: 'barre', fingers: [], open: [], muted: [5], startFret: 1, barre: { fret: 2, fromString: 1, toString: 4 } },
  { id: 'bBb', name: 'Bb', full: 'Bb majeur', category: 'barre', fingers: [], open: [], muted: [5], startFret: 1, barre: { fret: 3, fromString: 1, toString: 4 } },
];

// ─── Accords Piano ────────────────────────────────────────────────────────────

export const PIANO_CHORDS: PianoChord[] = [
  // ── Majeurs ──────────────────────────────────────────────────────────────
  { id: 'pC',   name: 'C',   full: 'C majeur',   category: 'major', notes: ['C4','E4','G4'] },
  { id: 'pDb',  name: 'Db',  full: 'Db majeur',  category: 'major', notes: ['Db4','F4','Ab4'] },
  { id: 'pD',   name: 'D',   full: 'D majeur',   category: 'major', notes: ['D4','F#4','A4'] },
  { id: 'pEb',  name: 'Eb',  full: 'Eb majeur',  category: 'major', notes: ['Eb4','G4','Bb4'] },
  { id: 'pE',   name: 'E',   full: 'E majeur',   category: 'major', notes: ['E4','G#4','B4'] },
  { id: 'pF',   name: 'F',   full: 'F majeur',   category: 'major', notes: ['F4','A4','C5'] },
  { id: 'pFs',  name: 'F#',  full: 'F# majeur',  category: 'major', notes: ['F#4','A#4','C#5'] },
  { id: 'pG',   name: 'G',   full: 'G majeur',   category: 'major', notes: ['G4','B4','D5'] },
  { id: 'pAb',  name: 'Ab',  full: 'Ab majeur',  category: 'major', notes: ['Ab4','C5','Eb5'] },
  { id: 'pA',   name: 'A',   full: 'A majeur',   category: 'major', notes: ['A4','C#5','E5'] },
  { id: 'pBb',  name: 'Bb',  full: 'Bb majeur',  category: 'major', notes: ['Bb4','D5','F5'] },
  { id: 'pB',   name: 'B',   full: 'B majeur',   category: 'major', notes: ['B4','D#5','F#5'] },

  // ── Mineurs ──────────────────────────────────────────────────────────────
  { id: 'pCm',  name: 'Cm',  full: 'C mineur',   category: 'minor', notes: ['C4','Eb4','G4'] },
  { id: 'pCsm', name: 'C#m', full: 'C# mineur',  category: 'minor', notes: ['C#4','E4','G#4'] },
  { id: 'pDm',  name: 'Dm',  full: 'D mineur',   category: 'minor', notes: ['D4','F4','A4'] },
  { id: 'pEbm', name: 'Ebm', full: 'Eb mineur',  category: 'minor', notes: ['Eb4','Gb4','Bb4'] },
  { id: 'pEm',  name: 'Em',  full: 'E mineur',   category: 'minor', notes: ['E4','G4','B4'] },
  { id: 'pFm',  name: 'Fm',  full: 'F mineur',   category: 'minor', notes: ['F4','Ab4','C5'] },
  { id: 'pFsm', name: 'F#m', full: 'F# mineur',  category: 'minor', notes: ['F#4','A4','C#5'] },
  { id: 'pGm',  name: 'Gm',  full: 'G mineur',   category: 'minor', notes: ['G4','Bb4','D5'] },
  { id: 'pAbm', name: 'Abm', full: 'Ab mineur',  category: 'minor', notes: ['Ab4','B4','Eb5'] },
  { id: 'pAm',  name: 'Am',  full: 'A mineur',   category: 'minor', notes: ['A4','C5','E5'] },
  { id: 'pBbm', name: 'Bbm', full: 'Bb mineur',  category: 'minor', notes: ['Bb4','Db5','F5'] },
  { id: 'pBm',  name: 'Bm',  full: 'B mineur',   category: 'minor', notes: ['B4','D5','F#5'] },

  // ── Dominantes 7 ─────────────────────────────────────────────────────────
  { id: 'pC7',  name: 'C7',  full: 'C dom. 7',   category: 'dom7', notes: ['C4','E4','G4','Bb4'] },
  { id: 'pDb7', name: 'Db7', full: 'Db dom. 7',  category: 'dom7', notes: ['Db4','F4','Ab4','B4'] },
  { id: 'pD7',  name: 'D7',  full: 'D dom. 7',   category: 'dom7', notes: ['D4','F#4','A4','C5'] },
  { id: 'pEb7', name: 'Eb7', full: 'Eb dom. 7',  category: 'dom7', notes: ['Eb4','G4','Bb4','Db5'] },
  { id: 'pE7',  name: 'E7',  full: 'E dom. 7',   category: 'dom7', notes: ['E4','G#4','B4','D5'] },
  { id: 'pF7',  name: 'F7',  full: 'F dom. 7',   category: 'dom7', notes: ['F4','A4','C5','Eb5'] },
  { id: 'pFs7', name: 'F#7', full: 'F# dom. 7',  category: 'dom7', notes: ['F#4','A#4','C#5','E5'] },
  { id: 'pG7',  name: 'G7',  full: 'G dom. 7',   category: 'dom7', notes: ['G4','B4','D5','F5'] },
  { id: 'pAb7', name: 'Ab7', full: 'Ab dom. 7',  category: 'dom7', notes: ['Ab4','C5','Eb5','Gb5'] },
  { id: 'pA7',  name: 'A7',  full: 'A dom. 7',   category: 'dom7', notes: ['A4','C#5','E5','G5'] },
  { id: 'pBb7', name: 'Bb7', full: 'Bb dom. 7',  category: 'dom7', notes: ['Bb4','D5','F5','Ab5'] },
  { id: 'pB7',  name: 'B7',  full: 'B dom. 7',   category: 'dom7', notes: ['B4','D#5','F#5','A5'] },

  // ── Majeures 7 ───────────────────────────────────────────────────────────
  { id: 'pCmaj7',  name: 'Cmaj7',  full: 'C maj. 7',   category: 'maj7', notes: ['C4','E4','G4','B4'] },
  { id: 'pDbmaj7', name: 'Dbmaj7', full: 'Db maj. 7',  category: 'maj7', notes: ['Db4','F4','Ab4','C5'] },
  { id: 'pDmaj7',  name: 'Dmaj7',  full: 'D maj. 7',   category: 'maj7', notes: ['D4','F#4','A4','C#5'] },
  { id: 'pEbmaj7', name: 'Ebmaj7', full: 'Eb maj. 7',  category: 'maj7', notes: ['Eb4','G4','Bb4','D5'] },
  { id: 'pEmaj7',  name: 'Emaj7',  full: 'E maj. 7',   category: 'maj7', notes: ['E4','G#4','B4','D#5'] },
  { id: 'pFmaj7',  name: 'Fmaj7',  full: 'F maj. 7',   category: 'maj7', notes: ['F4','A4','C5','E5'] },
  { id: 'pFsmaj7', name: 'F#maj7', full: 'F# maj. 7',  category: 'maj7', notes: ['F#4','A#4','C#5','F5'] },
  { id: 'pGmaj7',  name: 'Gmaj7',  full: 'G maj. 7',   category: 'maj7', notes: ['G4','B4','D5','F#5'] },
  { id: 'pAbmaj7', name: 'Abmaj7', full: 'Ab maj. 7',  category: 'maj7', notes: ['Ab4','C5','Eb5','G5'] },
  { id: 'pAmaj7',  name: 'Amaj7',  full: 'A maj. 7',   category: 'maj7', notes: ['A4','C#5','E5','G#5'] },
  { id: 'pBbmaj7', name: 'Bbmaj7', full: 'Bb maj. 7',  category: 'maj7', notes: ['Bb4','D5','F5','A5'] },
  { id: 'pBmaj7',  name: 'Bmaj7',  full: 'B maj. 7',   category: 'maj7', notes: ['B4','D#5','F#5','A#5'] },

  // ── Mineures 7 ───────────────────────────────────────────────────────────
  { id: 'pCm7',  name: 'Cm7',  full: 'C min. 7',   category: 'min7', notes: ['C4','Eb4','G4','Bb4'] },
  { id: 'pCsm7', name: 'C#m7', full: 'C# min. 7',  category: 'min7', notes: ['C#4','E4','G#4','B4'] },
  { id: 'pDm7',  name: 'Dm7',  full: 'D min. 7',   category: 'min7', notes: ['D4','F4','A4','C5'] },
  { id: 'pEbm7', name: 'Ebm7', full: 'Eb min. 7',  category: 'min7', notes: ['Eb4','Gb4','Bb4','Db5'] },
  { id: 'pEm7',  name: 'Em7',  full: 'E min. 7',   category: 'min7', notes: ['E4','G4','B4','D5'] },
  { id: 'pFm7',  name: 'Fm7',  full: 'F min. 7',   category: 'min7', notes: ['F4','Ab4','C5','Eb5'] },
  { id: 'pFsm7', name: 'F#m7', full: 'F# min. 7',  category: 'min7', notes: ['F#4','A4','C#5','E5'] },
  { id: 'pGm7',  name: 'Gm7',  full: 'G min. 7',   category: 'min7', notes: ['G4','Bb4','D5','F5'] },
  { id: 'pAbm7', name: 'Abm7', full: 'Ab min. 7',  category: 'min7', notes: ['Ab4','B4','Eb5','Gb5'] },
  { id: 'pAm7',  name: 'Am7',  full: 'A min. 7',   category: 'min7', notes: ['A4','C5','E5','G5'] },
  { id: 'pBbm7', name: 'Bbm7', full: 'Bb min. 7',  category: 'min7', notes: ['Bb4','Db5','F5','Ab5'] },
  { id: 'pBm7',  name: 'Bm7',  full: 'B min. 7',   category: 'min7', notes: ['B4','D5','F#5','A5'] },

  // ── Diminués ─────────────────────────────────────────────────────────────
  { id: 'pCdim',  name: 'Cdim',  full: 'C diminué',   category: 'dim', notes: ['C4','Eb4','Gb4'] },
  { id: 'pCsdim', name: 'C#dim', full: 'C# diminué',  category: 'dim', notes: ['C#4','E4','G4'] },
  { id: 'pDdim',  name: 'Ddim',  full: 'D diminué',   category: 'dim', notes: ['D4','F4','Ab4'] },
  { id: 'pEbdim', name: 'Ebdim', full: 'Eb diminué',  category: 'dim', notes: ['Eb4','Gb4','A4'] },
  { id: 'pEdim',  name: 'Edim',  full: 'E diminué',   category: 'dim', notes: ['E4','G4','Bb4'] },
  { id: 'pFdim',  name: 'Fdim',  full: 'F diminué',   category: 'dim', notes: ['F4','Ab4','B4'] },
  { id: 'pFsdim', name: 'F#dim', full: 'F# diminué',  category: 'dim', notes: ['F#4','A4','C5'] },
  { id: 'pGdim',  name: 'Gdim',  full: 'G diminué',   category: 'dim', notes: ['G4','Bb4','Db5'] },
  { id: 'pAbdim', name: 'Abdim', full: 'Ab diminué',  category: 'dim', notes: ['Ab4','B4','D5'] },
  { id: 'pAdim',  name: 'Adim',  full: 'A diminué',   category: 'dim', notes: ['A4','C5','Eb5'] },
  { id: 'pBbdim', name: 'Bbdim', full: 'Bb diminué',  category: 'dim', notes: ['Bb4','Db5','E5'] },
  { id: 'pBdim',  name: 'Bdim',  full: 'B diminué',   category: 'dim', notes: ['B4','D5','F5'] },

  // ── Augmentés ────────────────────────────────────────────────────────────
  { id: 'pCaug',  name: 'Caug',  full: 'C augmenté',  category: 'aug', notes: ['C4','E4','G#4'] },
  { id: 'pCsaug', name: 'C#aug', full: 'C# augmenté', category: 'aug', notes: ['C#4','F4','A4'] },
  { id: 'pDaug',  name: 'Daug',  full: 'D augmenté',  category: 'aug', notes: ['D4','F#4','A#4'] },
  { id: 'pEbaug', name: 'Ebaug', full: 'Eb augmenté', category: 'aug', notes: ['Eb4','G4','B4'] },
  { id: 'pEaug',  name: 'Eaug',  full: 'E augmenté',  category: 'aug', notes: ['E4','G#4','C5'] },
  { id: 'pFaug',  name: 'Faug',  full: 'F augmenté',  category: 'aug', notes: ['F4','A4','C#5'] },
  { id: 'pFsaug', name: 'F#aug', full: 'F# augmenté', category: 'aug', notes: ['F#4','A#4','D5'] },
  { id: 'pGaug',  name: 'Gaug',  full: 'G augmenté',  category: 'aug', notes: ['G4','B4','Eb5'] },
  { id: 'pAbaug', name: 'Abaug', full: 'Ab augmenté', category: 'aug', notes: ['Ab4','C5','E5'] },
  { id: 'pAaug',  name: 'Aaug',  full: 'A augmenté',  category: 'aug', notes: ['A4','C#5','F5'] },
  { id: 'pBbaug', name: 'Bbaug', full: 'Bb augmenté', category: 'aug', notes: ['Bb4','D5','F#5'] },
  { id: 'pBaug',  name: 'Baug',  full: 'B augmenté',  category: 'aug', notes: ['B4','Eb5','G5'] },

  // ── Sus 2 ────────────────────────────────────────────────────────────────
  { id: 'pCsus2',  name: 'Csus2',  full: 'C sus. 2',   category: 'sus', notes: ['C4','D4','G4'] },
  { id: 'pDbsus2', name: 'Dbsus2', full: 'Db sus. 2',  category: 'sus', notes: ['Db4','Eb4','Ab4'] },
  { id: 'pDsus2',  name: 'Dsus2',  full: 'D sus. 2',   category: 'sus', notes: ['D4','E4','A4'] },
  { id: 'pEbsus2', name: 'Ebsus2', full: 'Eb sus. 2',  category: 'sus', notes: ['Eb4','F4','Bb4'] },
  { id: 'pEsus2',  name: 'Esus2',  full: 'E sus. 2',   category: 'sus', notes: ['E4','F#4','B4'] },
  { id: 'pFsus2',  name: 'Fsus2',  full: 'F sus. 2',   category: 'sus', notes: ['F4','G4','C5'] },
  { id: 'pFssus2', name: 'F#sus2', full: 'F# sus. 2',  category: 'sus', notes: ['F#4','G#4','C#5'] },
  { id: 'pGsus2',  name: 'Gsus2',  full: 'G sus. 2',   category: 'sus', notes: ['G4','A4','D5'] },
  { id: 'pAbsus2', name: 'Absus2', full: 'Ab sus. 2',  category: 'sus', notes: ['Ab4','Bb4','Eb5'] },
  { id: 'pAsus2',  name: 'Asus2',  full: 'A sus. 2',   category: 'sus', notes: ['A4','B4','E5'] },
  { id: 'pBbsus2', name: 'Bbsus2', full: 'Bb sus. 2',  category: 'sus', notes: ['Bb4','C5','F5'] },
  { id: 'pBsus2',  name: 'Bsus2',  full: 'B sus. 2',   category: 'sus', notes: ['B4','C#5','F#5'] },

  // ── Sus 4 ────────────────────────────────────────────────────────────────
  { id: 'pCsus4',  name: 'Csus4',  full: 'C sus. 4',   category: 'sus', notes: ['C4','F4','G4'] },
  { id: 'pDbsus4', name: 'Dbsus4', full: 'Db sus. 4',  category: 'sus', notes: ['Db4','Gb4','Ab4'] },
  { id: 'pDsus4',  name: 'Dsus4',  full: 'D sus. 4',   category: 'sus', notes: ['D4','G4','A4'] },
  { id: 'pEbsus4', name: 'Ebsus4', full: 'Eb sus. 4',  category: 'sus', notes: ['Eb4','Ab4','Bb4'] },
  { id: 'pEsus4',  name: 'Esus4',  full: 'E sus. 4',   category: 'sus', notes: ['E4','A4','B4'] },
  { id: 'pFsus4',  name: 'Fsus4',  full: 'F sus. 4',   category: 'sus', notes: ['F4','Bb4','C5'] },
  { id: 'pFssus4', name: 'F#sus4', full: 'F# sus. 4',  category: 'sus', notes: ['F#4','B4','C#5'] },
  { id: 'pGsus4',  name: 'Gsus4',  full: 'G sus. 4',   category: 'sus', notes: ['G4','C5','D5'] },
  { id: 'pAbsus4', name: 'Absus4', full: 'Ab sus. 4',  category: 'sus', notes: ['Ab4','Db5','Eb5'] },
  { id: 'pAsus4',  name: 'Asus4',  full: 'A sus. 4',   category: 'sus', notes: ['A4','D5','E5'] },
  { id: 'pBbsus4', name: 'Bbsus4', full: 'Bb sus. 4',  category: 'sus', notes: ['Bb4','Eb5','F5'] },
  { id: 'pBsus4',  name: 'Bsus4',  full: 'B sus. 4',   category: 'sus', notes: ['B4','E5','F#5'] },

  // ── Add 9 ────────────────────────────────────────────────────────────────
  { id: 'pCadd9',  name: 'Cadd9',  full: 'C add 9',    category: 'add9', notes: ['C4','E4','G4','D5'] },
  { id: 'pDbadd9', name: 'Dbadd9', full: 'Db add 9',   category: 'add9', notes: ['Db4','F4','Ab4','Eb5'] },
  { id: 'pDadd9',  name: 'Dadd9',  full: 'D add 9',    category: 'add9', notes: ['D4','F#4','A4','E5'] },
  { id: 'pEbadd9', name: 'Ebadd9', full: 'Eb add 9',   category: 'add9', notes: ['Eb4','G4','Bb4','F5'] },
  { id: 'pEadd9',  name: 'Eadd9',  full: 'E add 9',    category: 'add9', notes: ['E4','G#4','B4','F#5'] },
  { id: 'pFadd9',  name: 'Fadd9',  full: 'F add 9',    category: 'add9', notes: ['F4','A4','C5','G5'] },
  { id: 'pFsadd9', name: 'F#add9', full: 'F# add 9',   category: 'add9', notes: ['F#4','A#4','C#5','G#5'] },
  { id: 'pGadd9',  name: 'Gadd9',  full: 'G add 9',    category: 'add9', notes: ['G4','B4','D5','A5'] },
  { id: 'pAbadd9', name: 'Abadd9', full: 'Ab add 9',   category: 'add9', notes: ['Ab4','C5','Eb5','Bb5'] },
  { id: 'pAadd9',  name: 'Aadd9',  full: 'A add 9',    category: 'add9', notes: ['A4','C#5','E5','B5'] },
  { id: 'pBbadd9', name: 'Bbadd9', full: 'Bb add 9',   category: 'add9', notes: ['Bb4','D5','F5','C6'] },
];

// ─── Accès aux accords par instrument ─────────────────────────────────────────

export function getChordsByInstrument(instrumentId: InstrumentId): (StringChord | PianoChord)[] {
  switch (instrumentId) {
    case 'guitar': return GUITAR_CHORDS;
    case 'ukulele': return UKULELE_CHORDS;
    case 'mandolin': return MANDOLIN_CHORDS;
    case 'banjo': return BANJO_CHORDS;
    case 'piano': return PIANO_CHORDS;
    default: return GUITAR_CHORDS;
  }
}

// Rechercher un accord par nom
export function findChordByName(name: string, instrumentId: InstrumentId): (StringChord | PianoChord) | undefined {
  const chords = getChordsByInstrument(instrumentId);
  // Normaliser le nom (enlever espaces, mettre en minuscule pour comparaison)
  const normalizedName = name.trim().toLowerCase();
  return chords.find(c => c.name.toLowerCase() === normalizedName);
}

// Rechercher tous les accords correspondant à un nom (peut retourner plusieurs variantes)
export function findChordVariants(name: string, instrumentId: InstrumentId): (StringChord | PianoChord)[] {
  const chords = getChordsByInstrument(instrumentId);
  const normalizedName = name.trim().toLowerCase();
  return chords.filter(c => c.name.toLowerCase() === normalizedName);
}
