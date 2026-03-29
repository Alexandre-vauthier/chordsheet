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
    { id: 'all', label: 'Tous' },
    { id: 'major', label: 'Majeurs' },
    { id: 'minor', label: 'Mineurs' },
    { id: 'seventh', label: '7ièmes' },
    { id: 'dim', label: 'Dim / Aug' },
    { id: 'ext', label: 'Extensions' },
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
  // Majeurs
  { id: 'pC', name: 'C', full: 'C majeur', category: 'major', notes: ['C4','E4','G4'] },
  { id: 'pDb', name: 'Db', full: 'Db majeur', category: 'major', notes: ['Db4','F4','Ab4'] },
  { id: 'pD', name: 'D', full: 'D majeur', category: 'major', notes: ['D4','F#4','A4'] },
  { id: 'pEb', name: 'Eb', full: 'Eb majeur', category: 'major', notes: ['Eb4','G4','Bb4'] },
  { id: 'pE', name: 'E', full: 'E majeur', category: 'major', notes: ['E4','G#4','B4'] },
  { id: 'pF', name: 'F', full: 'F majeur', category: 'major', notes: ['F4','A4','C5'] },
  { id: 'pFs', name: 'F#', full: 'F# majeur', category: 'major', notes: ['F#4','A#4','C#5'] },
  { id: 'pG', name: 'G', full: 'G majeur', category: 'major', notes: ['G4','B4','D5'] },
  { id: 'pAb', name: 'Ab', full: 'Ab majeur', category: 'major', notes: ['Ab4','C5','Eb5'] },
  { id: 'pA', name: 'A', full: 'A majeur', category: 'major', notes: ['A4','C#5','E5'] },
  { id: 'pBb', name: 'Bb', full: 'Bb majeur', category: 'major', notes: ['Bb4','D5','F5'] },
  { id: 'pB', name: 'B', full: 'B majeur', category: 'major', notes: ['B4','D#5','F#5'] },

  // Mineurs
  { id: 'pCm', name: 'Cm', full: 'C mineur', category: 'minor', notes: ['C4','Eb4','G4'] },
  { id: 'pDm', name: 'Dm', full: 'D mineur', category: 'minor', notes: ['D4','F4','A4'] },
  { id: 'pEm', name: 'Em', full: 'E mineur', category: 'minor', notes: ['E4','G4','B4'] },
  { id: 'pFm', name: 'Fm', full: 'F mineur', category: 'minor', notes: ['F4','Ab4','C5'] },
  { id: 'pGm', name: 'Gm', full: 'G mineur', category: 'minor', notes: ['G4','Bb4','D5'] },
  { id: 'pAm', name: 'Am', full: 'A mineur', category: 'minor', notes: ['A4','C5','E5'] },
  { id: 'pBm', name: 'Bm', full: 'B mineur', category: 'minor', notes: ['B4','D5','F#5'] },

  // Septièmes
  { id: 'pC7', name: 'C7', full: 'C dominant 7', category: 'seventh', notes: ['C4','E4','G4','Bb4'] },
  { id: 'pD7', name: 'D7', full: 'D dominant 7', category: 'seventh', notes: ['D4','F#4','A4','C5'] },
  { id: 'pE7', name: 'E7', full: 'E dominant 7', category: 'seventh', notes: ['E4','G#4','B4','D5'] },
  { id: 'pG7', name: 'G7', full: 'G dominant 7', category: 'seventh', notes: ['G4','B4','D5','F5'] },
  { id: 'pA7', name: 'A7', full: 'A dominant 7', category: 'seventh', notes: ['A4','C#5','E5','G5'] },
  { id: 'pCmaj7', name: 'Cmaj7', full: 'C major 7', category: 'seventh', notes: ['C4','E4','G4','B4'] },
  { id: 'pDmaj7', name: 'Dmaj7', full: 'D major 7', category: 'seventh', notes: ['D4','F#4','A4','C#5'] },
  { id: 'pGmaj7', name: 'Gmaj7', full: 'G major 7', category: 'seventh', notes: ['G4','B4','D5','F#5'] },
  { id: 'pAm7', name: 'Am7', full: 'A mineur 7', category: 'seventh', notes: ['A4','C5','E5','G5'] },
  { id: 'pDm7', name: 'Dm7', full: 'D mineur 7', category: 'seventh', notes: ['D4','F4','A4','C5'] },
  { id: 'pEm7', name: 'Em7', full: 'E mineur 7', category: 'seventh', notes: ['E4','G4','B4','D5'] },

  // Diminués & Augmentés
  { id: 'pCdim', name: 'Cdim', full: 'C diminué', category: 'dim', notes: ['C4','Eb4','Gb4'] },
  { id: 'pDdim', name: 'Ddim', full: 'D diminué', category: 'dim', notes: ['D4','F4','Ab4'] },
  { id: 'pCaug', name: 'Caug', full: 'C augmenté', category: 'dim', notes: ['C4','E4','G#4'] },
  { id: 'pGaug', name: 'Gaug', full: 'G augmenté', category: 'dim', notes: ['G4','B4','D#5'] },

  // Extensions
  { id: 'pCsus2', name: 'Csus2', full: 'C suspendu 2', category: 'ext', notes: ['C4','D4','G4'] },
  { id: 'pCsus4', name: 'Csus4', full: 'C suspendu 4', category: 'ext', notes: ['C4','F4','G4'] },
  { id: 'pDsus4', name: 'Dsus4', full: 'D suspendu 4', category: 'ext', notes: ['D4','G4','A4'] },
  { id: 'pCadd9', name: 'Cadd9', full: 'C add 9', category: 'ext', notes: ['C4','E4','G4','D5'] },
  { id: 'pGadd9', name: 'Gadd9', full: 'G add 9', category: 'ext', notes: ['G4','B4','D5','A5'] },
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
