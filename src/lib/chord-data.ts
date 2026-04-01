// Bibliothèque de données d'accords pour tous les instruments
import type { StringChord, PianoChord, Instrument, InstrumentId, FingerPosition } from '@/types';

// ─── Configuration des instruments ────────────────────────────────────────────

export const INSTRUMENT_CONFIG: Record<InstrumentId, Instrument> = {
  guitar: { id: 'guitar', label: 'Guitare', strings: 6 },
  mandolin: { id: 'mandolin', label: 'Mandoline', strings: 4 },
  banjo: { id: 'banjo', label: 'Banjo', strings: 5 },
  ukulele: { id: 'ukulele', label: 'Ukulélé', strings: 4 },
  piano: { id: 'piano', label: 'Piano', strings: 0 },
};

// ─── Catégories d'accords ─────────────────────────────────────────────────────

const STRING_CATS = [
  { id: 'all',   label: 'Tous' },
  { id: 'major', label: 'Majeurs' },
  { id: 'minor', label: 'Mineurs' },
  { id: 'dom7',  label: '7' },
  { id: 'maj7',  label: 'Maj7' },
  { id: 'min7',  label: 'Min7' },
  { id: 'dim',   label: 'Dim' },
  { id: 'aug',   label: 'Aug' },
];

export const CHORD_CATEGORIES = {
  guitar:   STRING_CATS,
  ukulele:  STRING_CATS,
  mandolin: STRING_CATS,
  banjo:    STRING_CATS,
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
  // Majeurs
  { id: "gC", name: "C", full: "C major", category: "major", fingers: [[2,1,1],[4,2,1],[5,3,1]], open: [1,3], muted: [6], startFret: 1 },
  { id: "gDb", name: "Db", full: "Db major", category: "major", barre: { fret: 4, fromString: 1, toString: 5 }, fingers: [[4,6,1],[3,6,1],[2,6,1]], open: [], muted: [6], startFret: 4 },
  { id: "gD", name: "D", full: "D major", category: "major", fingers: [[3,2,1],[2,3,1],[1,2,1]], open: [4,5], muted: [6], startFret: 1 },
  { id: "gEb", name: "Eb", full: "Eb major", category: "major", fingers: [[4,1,1],[3,3,1],[2,4,1],[1,3,1]], open: [], muted: [5,6], startFret: 1 },
  { id: "gE", name: "E", full: "E major", category: "major", fingers: [[3,1,1],[4,2,1],[5,2,1]], open: [1,2,6], muted: [], startFret: 1 },
  { id: "gF", name: "F", full: "F major", category: "major", barre: { fret: 1, fromString: 1, toString: 6 }, fingers: [[5,3,1],[4,3,1],[3,2,1]], open: [], muted: [], startFret: 1 },
  { id: "gFs", name: "F#", full: "F# major", category: "major", barre: { fret: 2, fromString: 1, toString: 6 }, fingers: [[5,4,1],[4,4,1],[3,3,1]], open: [], muted: [], startFret: 2 },
  { id: "gG", name: "G", full: "G major", category: "major", fingers: [[1,3,1],[5,2,1],[6,3,1]], open: [2,3,4], muted: [], startFret: 1 },
  { id: "gAb", name: "Ab", full: "Ab major", category: "major", barre: { fret: 4, fromString: 1, toString: 6 }, fingers: [[5,6,1],[4,6,1],[3,5,1]], open: [], muted: [], startFret: 4 },
  { id: "gA", name: "A", full: "A major", category: "major", fingers: [[2,2,1],[3,2,1],[4,2,1]], open: [1,5], muted: [6], startFret: 1 },
  { id: "gBb", name: "Bb", full: "Bb major", category: "major", barre: { fret: 1, fromString: 1, toString: 5 }, fingers: [[4,3,1],[3,3,1],[2,3,1]], open: [], muted: [6], startFret: 1 },
  { id: "gB", name: "B", full: "B major", category: "major", barre: { fret: 2, fromString: 1, toString: 5 }, fingers: [[4,4,1],[3,4,1],[2,4,1]], open: [], muted: [6], startFret: 2 },
  // Mineurs
  { id: "gCm", name: "Cm", full: "C minor", category: "minor", barre: { fret: 3, fromString: 1, toString: 5 }, fingers: [[4,5,1],[3,5,1],[2,4,1]], open: [], muted: [6], startFret: 3 },
  { id: "gDbm", name: "Dbm", full: "Db minor", category: "minor", barre: { fret: 4, fromString: 1, toString: 5 }, fingers: [[4,6,1],[3,6,1],[2,5,1]], open: [], muted: [6], startFret: 4 },
  { id: "gDm", name: "Dm", full: "D minor", category: "minor", fingers: [[1,1,1],[2,3,1],[3,2,1]], open: [4,5], muted: [6], startFret: 1 },
  { id: "gEbm", name: "Ebm", full: "Eb minor", category: "minor", fingers: [[1,2,1],[2,4,1],[3,3,1],[4,1,1]], open: [], muted: [5,6], startFret: 1 },
  { id: "gEm", name: "Em", full: "E minor", category: "minor", fingers: [[4,2,1],[5,2,1]], open: [1,2,3,6], muted: [], startFret: 1 },
  { id: "gFm", name: "Fm", full: "F minor", category: "minor", barre: { fret: 1, fromString: 1, toString: 6 }, fingers: [[5,3,1],[4,3,1]], open: [], muted: [], startFret: 1 },
  { id: "gFsm", name: "F#m", full: "F# minor", category: "minor", barre: { fret: 2, fromString: 1, toString: 6 }, fingers: [[5,4,1],[4,4,1]], open: [], muted: [], startFret: 2 },
  { id: "gGm", name: "Gm", full: "G minor", category: "minor", fingers: [[1,3,1],[2,3,1],[5,1,1],[6,3,1]], open: [3,4], muted: [], startFret: 1 },
  { id: "gAbm", name: "Abm", full: "Ab minor", category: "minor", barre: { fret: 4, fromString: 1, toString: 6 }, fingers: [[5,6,1],[4,6,1]], open: [], muted: [], startFret: 4 },
  { id: "gAm", name: "Am", full: "A minor", category: "minor", fingers: [[2,1,1],[3,2,1],[4,2,1]], open: [1,5], muted: [6], startFret: 1 },
  { id: "gBbm", name: "Bbm", full: "Bb minor", category: "minor", barre: { fret: 1, fromString: 1, toString: 5 }, fingers: [[4,3,1],[3,3,1],[2,2,1]], open: [], muted: [6], startFret: 1 },
  { id: "gBm", name: "Bm", full: "B minor", category: "minor", barre: { fret: 2, fromString: 1, toString: 5 }, fingers: [[4,4,1],[3,4,1],[2,3,1]], open: [], muted: [6], startFret: 2 },
  // 7
  { id: "gC7", name: "C7", full: "C dom7", category: "dom7", fingers: [[5,3,1],[4,2,1],[3,3,1],[2,1,1]], open: [1], muted: [6], startFret: 1 },
  { id: "gDb7", name: "Db7", full: "Db dom7", category: "dom7", barre: { fret: 4, fromString: 1, toString: 5 }, fingers: [[4,6,1],[2,6,1]], open: [], muted: [6], startFret: 4 },
  { id: "gD7", name: "D7", full: "D dom7", category: "dom7", fingers: [[1,2,1],[2,1,1],[3,2,1]], open: [4,5], muted: [6], startFret: 1 },
  { id: "gEb7", name: "Eb7", full: "Eb dom7", category: "dom7", fingers: [[1,3,1],[2,2,1],[4,1,1]], open: [3], muted: [5,6], startFret: 1 },
  { id: "gE7", name: "E7", full: "E dom7", category: "dom7", fingers: [[3,1,1],[5,2,1]], open: [1,2,4,6], muted: [], startFret: 1 },
  { id: "gF7", name: "F7", full: "F dom7", category: "dom7", barre: { fret: 1, fromString: 1, toString: 6 }, fingers: [[5,3,1],[3,2,1]], open: [], muted: [], startFret: 1 },
  { id: "gFs7", name: "F#7", full: "F# dom7", category: "dom7", barre: { fret: 2, fromString: 1, toString: 6 }, fingers: [[5,4,1],[3,3,1]], open: [], muted: [], startFret: 2 },
  { id: "gG7", name: "G7", full: "G dom7", category: "dom7", fingers: [[1,1,1],[5,2,1],[6,3,1]], open: [2,3,4], muted: [], startFret: 1 },
  { id: "gAb7", name: "Ab7", full: "Ab dom7", category: "dom7", barre: { fret: 4, fromString: 1, toString: 6 }, fingers: [[5,6,1],[3,5,1]], open: [], muted: [], startFret: 4 },
  { id: "gA7", name: "A7", full: "A dom7", category: "dom7", fingers: [[2,2,1],[4,2,1]], open: [1,3,5], muted: [6], startFret: 1 },
  { id: "gBb7", name: "Bb7", full: "Bb dom7", category: "dom7", barre: { fret: 1, fromString: 1, toString: 5 }, fingers: [[4,3,1],[2,3,1]], open: [], muted: [6], startFret: 1 },
  { id: "gB7", name: "B7", full: "B dom7", category: "dom7", fingers: [[5,2,1],[4,1,1],[3,2,1],[1,2,1]], open: [2], muted: [6], startFret: 1 },
  // Maj7
  { id: "gCmaj7", name: "Cmaj7", full: "C maj7", category: "maj7", fingers: [[5,3,1],[4,2,1]], open: [1,2,3], muted: [6], startFret: 1 },
  { id: "gDbmaj7", name: "Dbmaj7", full: "Db maj7", category: "maj7", barre: { fret: 4, fromString: 1, toString: 5 }, fingers: [[4,6,1],[3,5,1],[2,6,1]], open: [], muted: [6], startFret: 4 },
  { id: "gDmaj7", name: "Dmaj7", full: "D maj7", category: "maj7", fingers: [[1,2,1],[2,2,1],[3,2,1]], open: [4,5], muted: [6], startFret: 1 },
  { id: "gEbmaj7", name: "Ebmaj7", full: "Eb maj7", category: "maj7", fingers: [[4,1,1],[3,3,1],[2,3,1],[1,3,1]], open: [], muted: [5,6], startFret: 1 },
  { id: "gEmaj7", name: "Emaj7", full: "E maj7", category: "maj7", fingers: [[3,1,1],[4,1,1],[5,2,1]], open: [1,2,6], muted: [], startFret: 1 },
  { id: "gFmaj7", name: "Fmaj7", full: "F maj7", category: "maj7", fingers: [[4,3,1],[3,2,1],[2,1,1]], open: [1,5], muted: [6], startFret: 1 },
  { id: "gFsmaj7", name: "F#maj7", full: "F# maj7", category: "maj7", barre: { fret: 2, fromString: 1, toString: 6 }, fingers: [[5,4,1],[4,3,1],[3,3,1]], open: [], muted: [], startFret: 2 },
  { id: "gGmaj7", name: "Gmaj7", full: "G maj7", category: "maj7", fingers: [[1,2,1],[5,2,1],[6,3,1]], open: [2,3,4], muted: [], startFret: 1 },
  { id: "gAbmaj7", name: "Abmaj7", full: "Ab maj7", category: "maj7", barre: { fret: 4, fromString: 1, toString: 6 }, fingers: [[5,6,1],[4,5,1],[3,5,1]], open: [], muted: [], startFret: 4 },
  { id: "gAmaj7", name: "Amaj7", full: "A maj7", category: "maj7", fingers: [[2,2,1],[3,1,1],[4,2,1]], open: [1,5], muted: [6], startFret: 1 },
  { id: "gBbmaj7", name: "Bbmaj7", full: "Bb maj7", category: "maj7", fingers: [[5,1,1],[3,2,1],[2,3,1],[1,1,1]], open: [4], muted: [6], startFret: 1 },
  { id: "gBmaj7", name: "Bmaj7", full: "B maj7", category: "maj7", fingers: [[1,2,1],[3,3,1],[4,1,1],[5,2,1]], open: [2], muted: [6], startFret: 1 },
  // Min7
  { id: "gCm7", name: "Cm7", full: "C min7", category: "min7", barre: { fret: 3, fromString: 1, toString: 5 }, fingers: [[4,5,1],[2,4,1]], open: [], muted: [6], startFret: 3 },
  { id: "gDbm7", name: "Dbm7", full: "Db min7", category: "min7", barre: { fret: 4, fromString: 1, toString: 5 }, fingers: [[4,6,1],[2,5,1]], open: [], muted: [6], startFret: 4 },
  { id: "gDm7", name: "Dm7", full: "D min7", category: "min7", fingers: [[1,1,1],[2,1,1],[3,2,1]], open: [4,5], muted: [6], startFret: 1 },
  { id: "gEbm7", name: "Ebm7", full: "Eb min7", category: "min7", fingers: [[1,2,1],[2,2,1],[3,3,1],[4,1,1]], open: [], muted: [5,6], startFret: 1 },
  { id: "gEm7", name: "Em7", full: "E min7", category: "min7", fingers: [[5,2,1]], open: [1,2,3,4,6], muted: [], startFret: 1 },
  { id: "gFm7", name: "Fm7", full: "F min7", category: "min7", barre: { fret: 1, fromString: 1, toString: 6 }, fingers: [[5,3,1]], open: [], muted: [], startFret: 1 },
  { id: "gFsm7", name: "F#m7", full: "F# min7", category: "min7", barre: { fret: 2, fromString: 1, toString: 6 }, fingers: [[5,4,1]], open: [], muted: [], startFret: 2 },
  { id: "gGm7", name: "Gm7", full: "G min7", category: "min7", fingers: [[1,1,1],[2,3,1],[5,1,1],[6,3,1]], open: [3,4], muted: [], startFret: 1 },
  { id: "gAbm7", name: "Abm7", full: "Ab min7", category: "min7", barre: { fret: 4, fromString: 1, toString: 6 }, fingers: [[5,6,1]], open: [], muted: [], startFret: 4 },
  { id: "gAm7", name: "Am7", full: "A min7", category: "min7", fingers: [[2,1,1],[4,2,1]], open: [1,3,5], muted: [6], startFret: 1 },
  { id: "gBbm7", name: "Bbm7", full: "Bb min7", category: "min7", barre: { fret: 1, fromString: 1, toString: 5 }, fingers: [[4,3,1],[2,2,1]], open: [], muted: [6], startFret: 1 },
  { id: "gBm7", name: "Bm7", full: "B min7", category: "min7", fingers: [[5,2,1],[3,2,1],[1,2,1]], open: [2,4], muted: [6], startFret: 1 },
  // Dim
  { id: "gCdim", name: "Cdim", full: "C dim", category: "dim", fingers: [[1,2,1],[2,1,1],[4,1,1],[5,3,1],[6,2,1]], open: [], muted: [3], startFret: 1 },
  { id: "gDbdim", name: "Dbdim", full: "Db dim", category: "dim", fingers: [[2,2,1],[4,2,1],[5,4,1]], open: [1,3,6], muted: [], startFret: 1 },
  { id: "gDdim", name: "Ddim", full: "D dim", category: "dim", fingers: [[1,1,1],[2,3,1],[3,1,1],[6,1,1]], open: [4], muted: [5], startFret: 1 },
  { id: "gEbdim", name: "Ebdim", full: "Eb dim", category: "dim", fingers: [[1,2,1],[2,4,1],[3,2,1],[4,1,1],[6,2,1]], open: [5], muted: [], startFret: 1 },
  { id: "gEdim", name: "Edim", full: "E dim", category: "dim", fingers: [[4,2,1],[5,1,1]], open: [1,3,6], muted: [2], startFret: 1 },
  { id: "gFdim", name: "Fdim", full: "F dim", category: "dim", fingers: [[1,1,1],[3,1,1],[4,3,1],[5,2,1],[6,1,1]], open: [2], muted: [], startFret: 1 },
  { id: "gFsdim", name: "F#dim", full: "F# dim", category: "dim", fingers: [[1,2,1],[2,1,1],[3,2,1],[4,4,1],[6,2,1]], open: [5], muted: [], startFret: 1 },
  { id: "gGdim", name: "Gdim", full: "G dim", category: "dim", fingers: [[1,3,1],[2,2,1],[5,1,1],[6,3,1]], open: [3], muted: [4], startFret: 1 },
  { id: "gAbdim", name: "Abdim", full: "Ab dim", category: "dim", fingers: [[1,4,1],[3,1,1],[5,2,1],[6,4,1]], open: [2,4], muted: [], startFret: 1 },
  { id: "gAdim", name: "Adim", full: "A dim", category: "dim", fingers: [[1,5,1],[2,1,1],[3,2,1],[4,1,1],[5,3,1],[6,5,1]], open: [], muted: [], startFret: 1 },
  { id: "gBbdim", name: "Bbdim", full: "Bb dim", category: "dim", fingers: [[2,2,1],[3,3,1],[4,2,1],[5,1,1]], open: [1,6], muted: [], startFret: 1 },
  { id: "gBdim", name: "Bdim", full: "B dim", category: "dim", fingers: [[1,1,1],[3,4,1],[5,2,1],[6,1,1]], open: [2,4], muted: [], startFret: 1 },
  // Aug
  { id: "gCaug", name: "Caug", full: "C aug", category: "aug", fingers: [[2,1,1],[3,1,1],[4,2,1],[5,3,1]], open: [1,6], muted: [], startFret: 1 },
  { id: "gDbaug", name: "Dbaug", full: "Db aug", category: "aug", fingers: [[1,1,1],[2,2,1],[3,2,1],[4,3,1],[6,1,1]], open: [5], muted: [], startFret: 1 },
  { id: "gDaug", name: "Daug", full: "D aug", category: "aug", fingers: [[1,2,1],[2,3,1],[3,3,1],[5,1,1],[6,2,1]], open: [4], muted: [], startFret: 1 },
  { id: "gEbaug", name: "Ebaug", full: "Eb aug", category: "aug", fingers: [[1,3,1],[4,1,1],[5,2,1],[6,3,1]], open: [2,3], muted: [], startFret: 1 },
  { id: "gEaug", name: "Eaug", full: "E aug", category: "aug", fingers: [[2,1,1],[3,1,1],[4,2,1],[5,3,1]], open: [1,6], muted: [], startFret: 1 },
  { id: "gFaug", name: "Faug", full: "F aug", category: "aug", fingers: [[1,1,1],[2,2,1],[3,2,1],[4,3,1],[6,1,1]], open: [5], muted: [], startFret: 1 },
  { id: "gFsaug", name: "F#aug", full: "F# aug", category: "aug", fingers: [[1,2,1],[2,3,1],[3,3,1],[5,1,1],[6,2,1]], open: [4], muted: [], startFret: 1 },
  { id: "gGaug", name: "Gaug", full: "G aug", category: "aug", fingers: [[1,3,1],[4,1,1],[5,2,1],[6,3,1]], open: [2,3], muted: [], startFret: 1 },
  { id: "gAbaug", name: "Abaug", full: "Ab aug", category: "aug", fingers: [[2,1,1],[3,1,1],[4,2,1],[5,3,1]], open: [1,6], muted: [], startFret: 1 },
  { id: "gAaug", name: "Aaug", full: "A aug", category: "aug", fingers: [[1,1,1],[2,2,1],[3,2,1],[4,3,1],[6,1,1]], open: [5], muted: [], startFret: 1 },
  { id: "gBbaug", name: "Bbaug", full: "Bb aug", category: "aug", fingers: [[1,2,1],[2,3,1],[3,3,1],[5,1,1],[6,2,1]], open: [4], muted: [], startFret: 1 },
  { id: "gBaug", name: "Baug", full: "B aug", category: "aug", fingers: [[1,3,1],[4,1,1],[5,2,1],[6,3,1]], open: [2,3], muted: [], startFret: 1 },
];

// ─── Accords Ukulélé ──────────────────────────────────────────────────────────

export const UKULELE_CHORDS: StringChord[] = [
  // Majeurs
  { id: "uC", name: "C", full: "C major", category: "major", fingers: [[1,3,1]], open: [2,3,4], muted: [], startFret: 1 },
  { id: "uDb", name: "Db", full: "Db major", category: "major", barre: { fret: 1, fromString: 2, toString: 4 }, fingers: [[1,4,1]], open: [], muted: [], startFret: 1 },
  { id: "uD", name: "D", full: "D major", category: "major", fingers: [[2,2,1],[3,2,1],[4,2,1]], open: [1], muted: [], startFret: 1 },
  { id: "uEb", name: "Eb", full: "Eb major", category: "major", fingers: [[1,1,1],[2,3,1],[3,3,1]], open: [4], muted: [], startFret: 1 },
  { id: "uE", name: "E", full: "E major", category: "major", fingers: [[1,2,1],[3,4,1],[4,1,1]], open: [2], muted: [], startFret: 1 },
  { id: "uF", name: "F", full: "F major", category: "major", fingers: [[2,1,1],[4,2,1]], open: [1,3], muted: [], startFret: 1 },
  { id: "uFs", name: "F#", full: "F# major", category: "major", fingers: [[1,1,1],[2,2,1],[3,1,1],[4,3,1]], open: [], muted: [], startFret: 1 },
  { id: "uG", name: "G", full: "G major", category: "major", fingers: [[1,2,1],[2,3,1],[3,2,1]], open: [4], muted: [], startFret: 1 },
  { id: "uAb", name: "Ab", full: "Ab major", category: "major", fingers: [[1,3,1],[2,4,1],[4,1,1]], open: [3], muted: [], startFret: 1 },
  { id: "uA", name: "A", full: "A major", category: "major", fingers: [[3,1,1],[4,2,1]], open: [1,2], muted: [], startFret: 1 },
  { id: "uBb", name: "Bb", full: "Bb major", category: "major", barre: { fret: 1, fromString: 1, toString: 2 }, fingers: [[4,3,1],[3,2,1]], open: [], muted: [], startFret: 1 },
  { id: "uB", name: "B", full: "B major", category: "major", barre: { fret: 2, fromString: 1, toString: 2 }, fingers: [[4,4,1],[3,3,1]], open: [], muted: [], startFret: 2 },
  // Mineurs
  { id: "uCm", name: "Cm", full: "C minor", category: "minor", fingers: [[1,3,1],[2,3,1]], open: [3,4], muted: [], startFret: 1 },
  { id: "uDbm", name: "Dbm", full: "Db minor", category: "minor", fingers: [[1,4,1],[3,1,1],[4,1,1]], open: [2], muted: [], startFret: 1 },
  { id: "uDm", name: "Dm", full: "D minor", category: "minor", fingers: [[2,1,1],[3,2,1],[4,2,1]], open: [1], muted: [], startFret: 1 },
  { id: "uEbm", name: "Ebm", full: "Eb minor", category: "minor", fingers: [[1,1,1],[2,2,1],[3,3,1],[4,3,1]], open: [], muted: [], startFret: 1 },
  { id: "uEm", name: "Em", full: "E minor", category: "minor", fingers: [[1,2,1],[3,4,1]], open: [2,4], muted: [], startFret: 1 },
  { id: "uFm", name: "Fm", full: "F minor", category: "minor", fingers: [[1,3,1],[2,1,1],[4,1,1]], open: [3], muted: [], startFret: 1 },
  { id: "uFsm", name: "F#m", full: "F# minor", category: "minor", fingers: [[2,2,1],[3,1,1],[4,2,1]], open: [1], muted: [], startFret: 1 },
  { id: "uGm", name: "Gm", full: "G minor", category: "minor", fingers: [[1,1,1],[2,3,1],[3,2,1]], open: [4], muted: [], startFret: 1 },
  { id: "uAbm", name: "Abm", full: "Ab minor", category: "minor", fingers: [[1,2,1],[2,4,1],[3,3,1],[4,1,1]], open: [], muted: [], startFret: 1 },
  { id: "uAm", name: "Am", full: "A minor", category: "minor", fingers: [[4,2,1]], open: [1,2,3], muted: [], startFret: 1 },
  { id: "uBbm", name: "Bbm", full: "Bb minor", category: "minor", barre: { fret: 1, fromString: 1, toString: 3 }, fingers: [[4,3,1]], open: [], muted: [], startFret: 1 },
  { id: "uBm", name: "Bm", full: "B minor", category: "minor", barre: { fret: 2, fromString: 1, toString: 3 }, fingers: [[4,4,1]], open: [], muted: [], startFret: 2 },
  // 7
  { id: "uC7", name: "C7", full: "C dom7", category: "dom7", fingers: [[1,1,1]], open: [2,3,4], muted: [], startFret: 1 },
  { id: "uDb7", name: "Db7", full: "Db dom7", category: "dom7", fingers: [[1,2,1],[2,1,1],[3,1,1],[4,1,1]], open: [], muted: [], startFret: 1 },
  { id: "uD7", name: "D7", full: "D dom7", category: "dom7", fingers: [[2,2,1],[4,2,1]], open: [1,3], muted: [], startFret: 1 },
  { id: "uEb7", name: "Eb7", full: "Eb dom7", category: "dom7", fingers: [[1,1,1],[2,3,1],[3,1,1]], open: [4], muted: [], startFret: 1 },
  { id: "uE7", name: "E7", full: "E dom7", category: "dom7", fingers: [[1,2,1],[3,2,1],[4,1,1]], open: [2], muted: [], startFret: 1 },
  { id: "uF7", name: "F7", full: "F dom7", category: "dom7", fingers: [[2,1,1],[4,2,1]], open: [1,3], muted: [], startFret: 1 },
  { id: "uFs7", name: "F#7", full: "F# dom7", category: "dom7", fingers: [[1,1,1],[3,1,1],[4,3,1]], open: [2], muted: [], startFret: 1 },
  { id: "uG7", name: "G7", full: "G dom7", category: "dom7", fingers: [[1,2,1],[2,1,1],[3,2,1]], open: [4], muted: [], startFret: 1 },
  { id: "uAb7", name: "Ab7", full: "Ab dom7", category: "dom7", fingers: [[1,3,1],[2,2,1],[4,1,1]], open: [3], muted: [], startFret: 1 },
  { id: "uA7", name: "A7", full: "A dom7", category: "dom7", fingers: [[3,1,1]], open: [1,2,4], muted: [], startFret: 1 },
  { id: "uBb7", name: "Bb7", full: "Bb dom7", category: "dom7", barre: { fret: 1, fromString: 1, toString: 4 }, fingers: [[3,2,1]], open: [], muted: [], startFret: 1 },
  { id: "uB7", name: "B7", full: "B dom7", category: "dom7", fingers: [[2,2,1],[3,3,1],[4,2,1]], open: [1], muted: [], startFret: 1 },
  // Maj7
  { id: "uCmaj7", name: "Cmaj7", full: "C maj7", category: "maj7", fingers: [[1,2,1]], open: [2,3,4], muted: [], startFret: 1 },
  { id: "uDbmaj7", name: "Dbmaj7", full: "Db maj7", category: "maj7", fingers: [[1,3,1],[2,1,1],[4,1,1]], open: [3], muted: [], startFret: 1 },
  { id: "uDmaj7", name: "Dmaj7", full: "D maj7", category: "maj7", fingers: [[2,2,1],[3,1,1],[4,2,1]], open: [1], muted: [], startFret: 1 },
  { id: "uEbmaj7", name: "Ebmaj7", full: "Eb maj7", category: "maj7", fingers: [[1,1,1],[2,3,1],[3,2,1]], open: [4], muted: [], startFret: 1 },
  { id: "uEmaj7", name: "Emaj7", full: "E maj7", category: "maj7", fingers: [[1,2,1],[3,3,1],[4,1,1]], open: [2], muted: [], startFret: 1 },
  { id: "uFmaj7", name: "Fmaj7", full: "F maj7", category: "maj7", fingers: [[4,2,1]], open: [1,2,3], muted: [], startFret: 1 },
  { id: "uFsmaj7", name: "F#maj7", full: "F# maj7", category: "maj7", fingers: [[1,1,1],[2,1,1],[3,1,1],[4,3,1]], open: [], muted: [], startFret: 1 },
  { id: "uGmaj7", name: "Gmaj7", full: "G maj7", category: "maj7", fingers: [[1,2,1],[2,2,1],[3,2,1]], open: [4], muted: [], startFret: 1 },
  { id: "uAbmaj7", name: "Abmaj7", full: "Ab maj7", category: "maj7", fingers: [[1,3,1],[2,3,1]], open: [3,4], muted: [], startFret: 1 },
  { id: "uAmaj7", name: "Amaj7", full: "A maj7", category: "maj7", fingers: [[3,1,1],[4,1,1]], open: [1,2], muted: [], startFret: 1 },
  { id: "uBbmaj7", name: "Bbmaj7", full: "Bb maj7", category: "maj7", fingers: [[2,1,1],[3,2,1],[4,2,1]], open: [1], muted: [], startFret: 1 },
  { id: "uBmaj7", name: "Bmaj7", full: "B maj7", category: "maj7", fingers: [[1,1,1],[2,2,1],[3,3,1],[4,3,1]], open: [], muted: [], startFret: 1 },
  // Min7
  { id: "uCm7", name: "Cm7", full: "C min7", category: "min7", fingers: [[1,1,1],[2,3,1]], open: [3,4], muted: [], startFret: 1 },
  { id: "uDbm7", name: "Dbm7", full: "Db min7", category: "min7", fingers: [[1,2,1],[3,1,1],[4,1,1]], open: [2], muted: [], startFret: 1 },
  { id: "uDm7", name: "Dm7", full: "D min7", category: "min7", fingers: [[2,1,1],[4,2,1]], open: [1,3], muted: [], startFret: 1 },
  { id: "uEbm7", name: "Ebm7", full: "Eb min7", category: "min7", fingers: [[1,1,1],[2,2,1],[3,1,1],[4,3,1]], open: [], muted: [], startFret: 1 },
  { id: "uEm7", name: "Em7", full: "E min7", category: "min7", fingers: [[1,2,1],[3,2,1]], open: [2,4], muted: [], startFret: 1 },
  { id: "uFm7", name: "Fm7", full: "F min7", category: "min7", fingers: [[1,3,1],[2,1,1],[4,1,1]], open: [3], muted: [], startFret: 1 },
  { id: "uFsm7", name: "F#m7", full: "F# min7", category: "min7", fingers: [[3,1,1],[4,2,1]], open: [1,2], muted: [], startFret: 1 },
  { id: "uGm7", name: "Gm7", full: "G min7", category: "min7", fingers: [[1,1,1],[2,1,1],[3,2,1]], open: [4], muted: [], startFret: 1 },
  { id: "uAbm7", name: "Abm7", full: "Ab min7", category: "min7", fingers: [[1,2,1],[2,2,1],[3,3,1],[4,1,1]], open: [], muted: [], startFret: 1 },
  { id: "uAm7", name: "Am7", full: "A min7", category: "min7", fingers: [], open: [1,2,3,4], muted: [], startFret: 1 },
  { id: "uBbm7", name: "Bbm7", full: "Bb min7", category: "min7", barre: { fret: 1, fromString: 1, toString: 4 }, fingers: [], open: [], muted: [], startFret: 1 },
  { id: "uBm7", name: "Bm7", full: "B min7", category: "min7", barre: { fret: 2, fromString: 2, toString: 4 }, fingers: [], open: [1], muted: [], startFret: 2 },
  // Dim
  { id: "uCdim", name: "Cdim", full: "C dim", category: "dim", fingers: [[1,3,1],[2,2,1]], open: [3], muted: [4], startFret: 1 },
  { id: "uDbdim", name: "Dbdim", full: "Db dim", category: "dim", fingers: [[1,4,1],[3,1,1]], open: [2,4], muted: [], startFret: 1 },
  { id: "uDdim", name: "Ddim", full: "D dim", category: "dim", fingers: [[2,1,1],[3,2,1],[4,1,1]], open: [], muted: [1], startFret: 1 },
  { id: "uEbdim", name: "Ebdim", full: "Eb dim", category: "dim", fingers: [[2,2,1],[3,3,1],[4,2,1]], open: [1], muted: [], startFret: 1 },
  { id: "uEdim", name: "Edim", full: "E dim", category: "dim", fingers: [[1,1,1],[3,4,1]], open: [2,4], muted: [], startFret: 1 },
  { id: "uFdim", name: "Fdim", full: "F dim", category: "dim", fingers: [[1,2,1],[2,1,1],[4,1,1]], open: [], muted: [3], startFret: 1 },
  { id: "uFsdim", name: "F#dim", full: "F# dim", category: "dim", fingers: [[2,2,1],[4,2,1]], open: [1,3], muted: [], startFret: 1 },
  { id: "uGdim", name: "Gdim", full: "G dim", category: "dim", fingers: [[1,1,1],[2,3,1],[3,1,1]], open: [4], muted: [], startFret: 1 },
  { id: "uAbdim", name: "Abdim", full: "Ab dim", category: "dim", fingers: [[1,2,1],[2,4,1],[3,2,1],[4,1,1]], open: [], muted: [], startFret: 1 },
  { id: "uAdim", name: "Adim", full: "A dim", category: "dim", fingers: [[4,2,1]], open: [1,3], muted: [2], startFret: 1 },
  { id: "uBbdim", name: "Bbdim", full: "Bb dim", category: "dim", fingers: [[1,1,1],[3,1,1],[4,3,1]], open: [2], muted: [], startFret: 1 },
  { id: "uBdim", name: "Bdim", full: "B dim", category: "dim", fingers: [[1,2,1],[2,1,1],[3,2,1],[4,4,1]], open: [], muted: [], startFret: 1 },
  // Aug
  { id: "uCaug", name: "Caug", full: "C aug", category: "aug", fingers: [[1,3,1],[4,1,1]], open: [2,3], muted: [], startFret: 1 },
  { id: "uDbaug", name: "Dbaug", full: "Db aug", category: "aug", fingers: [[2,1,1],[3,1,1],[4,2,1]], open: [1], muted: [], startFret: 1 },
  { id: "uDaug", name: "Daug", full: "D aug", category: "aug", fingers: [[1,1,1],[2,2,1],[3,2,1],[4,3,1]], open: [], muted: [], startFret: 1 },
  { id: "uEbaug", name: "Ebaug", full: "Eb aug", category: "aug", fingers: [[1,2,1],[2,3,1],[3,3,1]], open: [4], muted: [], startFret: 1 },
  { id: "uEaug", name: "Eaug", full: "E aug", category: "aug", fingers: [[1,3,1],[4,1,1]], open: [2,3], muted: [], startFret: 1 },
  { id: "uFaug", name: "Faug", full: "F aug", category: "aug", fingers: [[2,1,1],[3,1,1],[4,2,1]], open: [1], muted: [], startFret: 1 },
  { id: "uFsaug", name: "F#aug", full: "F# aug", category: "aug", fingers: [[1,1,1],[2,2,1],[3,2,1],[4,3,1]], open: [], muted: [], startFret: 1 },
  { id: "uGaug", name: "Gaug", full: "G aug", category: "aug", fingers: [[1,2,1],[2,3,1],[3,3,1]], open: [4], muted: [], startFret: 1 },
  { id: "uAbaug", name: "Abaug", full: "Ab aug", category: "aug", fingers: [[1,3,1],[4,1,1]], open: [2,3], muted: [], startFret: 1 },
  { id: "uAaug", name: "Aaug", full: "A aug", category: "aug", fingers: [[2,1,1],[3,1,1],[4,2,1]], open: [1], muted: [], startFret: 1 },
  { id: "uBbaug", name: "Bbaug", full: "Bb aug", category: "aug", fingers: [[1,1,1],[2,2,1],[3,2,1],[4,3,1]], open: [], muted: [], startFret: 1 },
  { id: "uBaug", name: "Baug", full: "B aug", category: "aug", fingers: [[1,2,1],[2,3,1],[3,3,1]], open: [4], muted: [], startFret: 1 },
];

// ─── Accords Mandoline ──────────────────────────────────────────────────────────

export const MANDOLIN_CHORDS: StringChord[] = [
  // Majeurs
  { id: "mC", name: "C", full: "C major", category: "major", fingers: [[2,3,1],[3,2,1]], open: [1,4], muted: [], startFret: 1 },
  { id: "mDb", name: "Db", full: "Db major", category: "major", fingers: [[1,1,1],[2,4,1],[3,3,1],[4,1,1]], open: [], muted: [], startFret: 1 },
  { id: "mD", name: "D", full: "D major", category: "major", fingers: [[1,2,1],[4,2,1]], open: [2,3], muted: [], startFret: 1 },
  { id: "mEb", name: "Eb", full: "Eb major", category: "major", fingers: [[1,3,1],[2,1,1],[3,1,1]], open: [4], muted: [], startFret: 1 },
  { id: "mE", name: "E", full: "E major", category: "major", fingers: [[2,2,1],[3,2,1],[4,1,1]], open: [1], muted: [], startFret: 1 },
  { id: "mF", name: "F", full: "F major", category: "major", fingers: [[1,1,1],[3,3,1],[4,2,1]], open: [2], muted: [], startFret: 1 },
  { id: "mFs", name: "F#", full: "F# major", category: "major", fingers: [[1,2,1],[2,1,1],[3,4,1],[4,3,1]], open: [], muted: [], startFret: 1 },
  { id: "mG", name: "G", full: "G major", category: "major", fingers: [[1,3,1],[2,2,1]], open: [3,4], muted: [], startFret: 1 },
  { id: "mAb", name: "Ab", full: "Ab major", category: "major", fingers: [[1,4,1],[2,3,1],[3,1,1],[4,1,1]], open: [], muted: [], startFret: 1 },
  { id: "mA", name: "A", full: "A major", category: "major", fingers: [[3,2,1],[4,2,1]], open: [1,2], muted: [], startFret: 1 },
  { id: "mBb", name: "Bb", full: "Bb major", category: "major", barre: { fret: 1, fromString: 1, toString: 2 }, fingers: [[4,3,1]], open: [3], muted: [], startFret: 1 },
  { id: "mB", name: "B", full: "B major", category: "major", barre: { fret: 2, fromString: 1, toString: 2 }, fingers: [[4,4,1],[3,1,1]], open: [], muted: [], startFret: 2 },
  // Mineurs
  { id: "mCm", name: "Cm", full: "C minor", category: "minor", fingers: [[1,3,1],[2,3,1],[3,1,1]], open: [4], muted: [], startFret: 1 },
  { id: "mDbm", name: "Dbm", full: "Db minor", category: "minor", fingers: [[2,4,1],[3,2,1],[4,1,1]], open: [1], muted: [], startFret: 1 },
  { id: "mDm", name: "Dm", full: "D minor", category: "minor", fingers: [[1,1,1],[4,2,1]], open: [2,3], muted: [], startFret: 1 },
  { id: "mEbm", name: "Ebm", full: "Eb minor", category: "minor", fingers: [[1,2,1],[2,1,1],[3,1,1],[4,3,1]], open: [], muted: [], startFret: 1 },
  { id: "mEm", name: "Em", full: "E minor", category: "minor", fingers: [[2,2,1],[3,2,1]], open: [1,4], muted: [], startFret: 1 },
  { id: "mFm", name: "Fm", full: "F minor", category: "minor", fingers: [[1,1,1],[2,3,1],[3,3,1],[4,1,1]], open: [], muted: [], startFret: 1 },
  { id: "mFsm", name: "F#m", full: "F# minor", category: "minor", fingers: [[1,2,1],[3,4,1],[4,2,1]], open: [2], muted: [], startFret: 1 },
  { id: "mGm", name: "Gm", full: "G minor", category: "minor", fingers: [[1,3,1],[2,1,1]], open: [3,4], muted: [], startFret: 1 },
  { id: "mAbm", name: "Abm", full: "Ab minor", category: "minor", fingers: [[1,4,1],[2,2,1],[3,1,1],[4,1,1]], open: [], muted: [], startFret: 1 },
  { id: "mAm", name: "Am", full: "A minor", category: "minor", fingers: [[3,2,1],[4,2,1]], open: [1,2], muted: [], startFret: 1 },
  { id: "mBbm", name: "Bbm", full: "Bb minor", category: "minor", barre: { fret: 1, fromString: 1, toString: 2 }, fingers: [[4,3,1],[3,3,1]], open: [], muted: [], startFret: 1 },
  { id: "mBm", name: "Bm", full: "B minor", category: "minor", barre: { fret: 2, fromString: 1, toString: 2 }, fingers: [[4,4,1]], open: [3], muted: [], startFret: 2 },
  // 7
  { id: "mC7", name: "C7", full: "C dom7", category: "dom7", fingers: [[2,1,1],[3,2,1]], open: [1,4], muted: [], startFret: 1 },
  { id: "mDb7", name: "Db7", full: "Db dom7", category: "dom7", fingers: [[1,1,1],[2,2,1],[3,3,1],[4,1,1]], open: [], muted: [], startFret: 1 },
  { id: "mD7", name: "D7", full: "D dom7", category: "dom7", fingers: [[1,2,1],[4,2,1]], open: [2,3], muted: [], startFret: 1 },
  { id: "mEb7", name: "Eb7", full: "Eb dom7", category: "dom7", fingers: [[1,3,1],[2,1,1],[3,1,1]], open: [4], muted: [], startFret: 1 },
  { id: "mE7", name: "E7", full: "E dom7", category: "dom7", fingers: [[2,2,1],[4,1,1]], open: [1,3], muted: [], startFret: 1 },
  { id: "mF7", name: "F7", full: "F dom7", category: "dom7", fingers: [[1,1,1],[3,1,1],[4,2,1]], open: [2], muted: [], startFret: 1 },
  { id: "mFs7", name: "F#7", full: "F# dom7", category: "dom7", fingers: [[2,1,1],[3,2,1],[4,3,1]], open: [1], muted: [], startFret: 1 },
  { id: "mG7", name: "G7", full: "G dom7", category: "dom7", fingers: [[1,1,1],[2,2,1]], open: [3,4], muted: [], startFret: 1 },
  { id: "mAb7", name: "Ab7", full: "Ab dom7", category: "dom7", fingers: [[1,2,1],[2,3,1],[3,1,1],[4,1,1]], open: [], muted: [], startFret: 1 },
  { id: "mA7", name: "A7", full: "A dom7", category: "dom7", fingers: [[3,2,1]], open: [1,2,4], muted: [], startFret: 1 },
  { id: "mBb7", name: "Bb7", full: "Bb dom7", category: "dom7", fingers: [[1,1,1],[2,1,1],[4,1,1]], open: [3], muted: [], startFret: 1 },
  { id: "mB7", name: "B7", full: "B dom7", category: "dom7", fingers: [[1,2,1],[3,1,1],[4,2,1]], open: [2], muted: [], startFret: 1 },
  // Maj7
  { id: "mCmaj7", name: "Cmaj7", full: "C maj7", category: "maj7", fingers: [[2,2,1],[3,2,1]], open: [1,4], muted: [], startFret: 1 },
  { id: "mDbmaj7", name: "Dbmaj7", full: "Db maj7", category: "maj7", fingers: [[1,1,1],[2,3,1],[3,3,1],[4,1,1]], open: [], muted: [], startFret: 1 },
  { id: "mDmaj7", name: "Dmaj7", full: "D maj7", category: "maj7", fingers: [[1,2,1],[4,2,1]], open: [2,3], muted: [], startFret: 1 },
  { id: "mEbmaj7", name: "Ebmaj7", full: "Eb maj7", category: "maj7", fingers: [[1,3,1],[2,1,1]], open: [3,4], muted: [], startFret: 1 },
  { id: "mEmaj7", name: "Emaj7", full: "E maj7", category: "maj7", fingers: [[2,2,1],[3,1,1],[4,1,1]], open: [1], muted: [], startFret: 1 },
  { id: "mFmaj7", name: "Fmaj7", full: "F maj7", category: "maj7", fingers: [[3,2,1],[4,2,1]], open: [1,2], muted: [], startFret: 1 },
  { id: "mFsmaj7", name: "F#maj7", full: "F# maj7", category: "maj7", fingers: [[1,1,1],[2,1,1],[3,3,1],[4,3,1]], open: [], muted: [], startFret: 1 },
  { id: "mGmaj7", name: "Gmaj7", full: "G maj7", category: "maj7", fingers: [[1,2,1],[2,2,1]], open: [3,4], muted: [], startFret: 1 },
  { id: "mAbmaj7", name: "Abmaj7", full: "Ab maj7", category: "maj7", fingers: [[1,3,1],[2,3,1],[3,1,1]], open: [4], muted: [], startFret: 1 },
  { id: "mAmaj7", name: "Amaj7", full: "A maj7", category: "maj7", fingers: [[3,2,1],[4,1,1]], open: [1,2], muted: [], startFret: 1 },
  { id: "mBbmaj7", name: "Bbmaj7", full: "Bb maj7", category: "maj7", fingers: [[1,1,1],[4,2,1]], open: [2,3], muted: [], startFret: 1 },
  { id: "mBmaj7", name: "Bmaj7", full: "B maj7", category: "maj7", fingers: [[1,2,1],[2,1,1],[3,1,1],[4,3,1]], open: [], muted: [], startFret: 1 },
  // Min7
  { id: "mCm7", name: "Cm7", full: "C min7", category: "min7", fingers: [[1,3,1],[2,1,1],[3,1,1]], open: [4], muted: [], startFret: 1 },
  { id: "mDbm7", name: "Dbm7", full: "Db min7", category: "min7", fingers: [[2,2,1],[3,2,1],[4,1,1]], open: [1], muted: [], startFret: 1 },
  { id: "mDm7", name: "Dm7", full: "D min7", category: "min7", fingers: [[1,1,1],[4,2,1]], open: [2,3], muted: [], startFret: 1 },
  { id: "mEbm7", name: "Ebm7", full: "Eb min7", category: "min7", fingers: [[1,2,1],[2,1,1],[3,1,1],[4,3,1]], open: [], muted: [], startFret: 1 },
  { id: "mEm7", name: "Em7", full: "E min7", category: "min7", fingers: [[2,2,1]], open: [1,3,4], muted: [], startFret: 1 },
  { id: "mFm7", name: "Fm7", full: "F min7", category: "min7", fingers: [[1,1,1],[2,3,1],[3,1,1],[4,1,1]], open: [], muted: [], startFret: 1 },
  { id: "mFsm7", name: "F#m7", full: "F# min7", category: "min7", fingers: [[3,2,1],[4,2,1]], open: [1,2], muted: [], startFret: 1 },
  { id: "mGm7", name: "Gm7", full: "G min7", category: "min7", fingers: [[1,1,1],[2,1,1]], open: [3,4], muted: [], startFret: 1 },
  { id: "mAbm7", name: "Abm7", full: "Ab min7", category: "min7", fingers: [[1,2,1],[2,2,1],[3,1,1],[4,1,1]], open: [], muted: [], startFret: 1 },
  { id: "mAm7", name: "Am7", full: "A min7", category: "min7", fingers: [[3,2,1]], open: [1,2,4], muted: [], startFret: 1 },
  { id: "mBbm7", name: "Bbm7", full: "Bb min7", category: "min7", fingers: [[1,1,1],[2,1,1],[3,3,1],[4,1,1]], open: [], muted: [], startFret: 1 },
  { id: "mBm7", name: "Bm7", full: "B min7", category: "min7", fingers: [[1,2,1],[4,2,1]], open: [2,3], muted: [], startFret: 1 },
  // Dim
  { id: "mCdim", name: "Cdim", full: "C dim", category: "dim", fingers: [[1,2,1],[2,3,1],[3,1,1]], open: [], muted: [4], startFret: 1 },
  { id: "mDbdim", name: "Dbdim", full: "Db dim", category: "dim", fingers: [[2,4,1],[3,2,1]], open: [1,4], muted: [], startFret: 1 },
  { id: "mDdim", name: "Ddim", full: "D dim", category: "dim", fingers: [[1,1,1],[4,1,1]], open: [3], muted: [2], startFret: 1 },
  { id: "mEbdim", name: "Ebdim", full: "Eb dim", category: "dim", fingers: [[1,2,1],[3,1,1],[4,2,1]], open: [2], muted: [], startFret: 1 },
  { id: "mEdim", name: "Edim", full: "E dim", category: "dim", fingers: [[2,1,1],[3,2,1]], open: [1,4], muted: [], startFret: 1 },
  { id: "mFdim", name: "Fdim", full: "F dim", category: "dim", fingers: [[1,1,1],[2,2,1],[3,3,1],[4,1,1]], open: [], muted: [], startFret: 1 },
  { id: "mFsdim", name: "F#dim", full: "F# dim", category: "dim", fingers: [[1,2,1],[3,4,1],[4,2,1]], open: [2], muted: [], startFret: 1 },
  { id: "mGdim", name: "Gdim", full: "G dim", category: "dim", fingers: [[1,3,1],[2,1,1]], open: [4], muted: [3], startFret: 1 },
  { id: "mAbdim", name: "Abdim", full: "Ab dim", category: "dim", fingers: [[1,4,1],[2,2,1],[4,1,1]], open: [3], muted: [], startFret: 1 },
  { id: "mAdim", name: "Adim", full: "A dim", category: "dim", fingers: [[3,1,1],[4,2,1]], open: [2], muted: [1], startFret: 1 },
  { id: "mBbdim", name: "Bbdim", full: "Bb dim", category: "dim", fingers: [[2,1,1],[3,2,1],[4,3,1]], open: [1], muted: [], startFret: 1 },
  { id: "mBdim", name: "Bdim", full: "B dim", category: "dim", fingers: [[1,1,1],[2,2,1],[4,4,1]], open: [3], muted: [], startFret: 1 },
  // Aug
  { id: "mCaug", name: "Caug", full: "C aug", category: "aug", fingers: [[2,3,1],[3,2,1],[4,1,1]], open: [1], muted: [], startFret: 1 },
  { id: "mDbaug", name: "Dbaug", full: "Db aug", category: "aug", fingers: [[1,1,1],[3,3,1],[4,2,1]], open: [2], muted: [], startFret: 1 },
  { id: "mDaug", name: "Daug", full: "D aug", category: "aug", fingers: [[1,2,1],[2,1,1],[4,3,1]], open: [3], muted: [], startFret: 1 },
  { id: "mEbaug", name: "Ebaug", full: "Eb aug", category: "aug", fingers: [[1,3,1],[2,2,1],[3,1,1]], open: [4], muted: [], startFret: 1 },
  { id: "mEaug", name: "Eaug", full: "E aug", category: "aug", fingers: [[2,3,1],[3,2,1],[4,1,1]], open: [1], muted: [], startFret: 1 },
  { id: "mFaug", name: "Faug", full: "F aug", category: "aug", fingers: [[1,1,1],[3,3,1],[4,2,1]], open: [2], muted: [], startFret: 1 },
  { id: "mFsaug", name: "F#aug", full: "F# aug", category: "aug", fingers: [[1,2,1],[2,1,1],[4,3,1]], open: [3], muted: [], startFret: 1 },
  { id: "mGaug", name: "Gaug", full: "G aug", category: "aug", fingers: [[1,3,1],[2,2,1],[3,1,1]], open: [4], muted: [], startFret: 1 },
  { id: "mAbaug", name: "Abaug", full: "Ab aug", category: "aug", fingers: [[2,3,1],[3,2,1],[4,1,1]], open: [1], muted: [], startFret: 1 },
  { id: "mAaug", name: "Aaug", full: "A aug", category: "aug", fingers: [[1,1,1],[3,3,1],[4,2,1]], open: [2], muted: [], startFret: 1 },
  { id: "mBbaug", name: "Bbaug", full: "Bb aug", category: "aug", fingers: [[1,2,1],[2,1,1],[4,3,1]], open: [3], muted: [], startFret: 1 },
  { id: "mBaug", name: "Baug", full: "B aug", category: "aug", fingers: [[1,3,1],[2,2,1],[3,1,1]], open: [4], muted: [], startFret: 1 },
];

// ─── Accords Banjo ──────────────────────────────────────────────────────────

export const BANJO_CHORDS: StringChord[] = [
  // Majeurs
  { id: "bC", name: "C", full: "C major", category: "major", fingers: [[1,2,1],[2,1,1],[4,2,1]], open: [3,5], muted: [], startFret: 1 },
  { id: "bDb", name: "Db", full: "Db major", category: "major", fingers: [[1,3,1],[2,2,1],[3,1,1],[4,3,1],[5,1,1]], open: [], muted: [], startFret: 1 },
  { id: "bD", name: "D", full: "D major", category: "major", fingers: [[2,3,1],[3,2,1],[5,2,1]], open: [1,4], muted: [], startFret: 1 },
  { id: "bEb", name: "Eb", full: "Eb major", category: "major", fingers: [[1,1,1],[2,4,1],[4,1,1]], open: [3,5], muted: [], startFret: 1 },
  { id: "bE", name: "E", full: "E major", category: "major", fingers: [[1,2,1],[3,1,1],[4,2,1],[5,1,1]], open: [2], muted: [], startFret: 1 },
  { id: "bF", name: "F", full: "F major", category: "major", fingers: [[1,3,1],[2,1,1],[3,2,1],[4,3,1],[5,2,1]], open: [], muted: [], startFret: 1 },
  { id: "bFs", name: "F#", full: "F# major", category: "major", fingers: [[1,4,1],[2,2,1],[3,3,1],[4,4,1],[5,3,1]], open: [], muted: [], startFret: 1 },
  { id: "bG", name: "G", full: "G major", category: "major", fingers: [], open: [1,2,3,4,5], muted: [], startFret: 1 },
  { id: "bAb", name: "Ab", full: "Ab major", category: "major", barre: { fret: 1, fromString: 1, toString: 5 }, fingers: [], open: [], muted: [], startFret: 1 },
  { id: "bA", name: "A", full: "A major", category: "major", barre: { fret: 2, fromString: 1, toString: 5 }, fingers: [], open: [], muted: [], startFret: 2 },
  { id: "bBb", name: "Bb", full: "Bb major", category: "major", fingers: [[2,3,1],[3,3,1],[5,3,1]], open: [1,4], muted: [], startFret: 1 },
  { id: "bB", name: "B", full: "B major", category: "major", fingers: [[1,1,1],[3,4,1],[4,1,1],[5,4,1]], open: [2], muted: [], startFret: 1 },
  // Mineurs
  { id: "bCm", name: "Cm", full: "C minor", category: "minor", fingers: [[1,1,1],[2,1,1],[4,1,1]], open: [3,5], muted: [], startFret: 1 },
  { id: "bDbm", name: "Dbm", full: "Db minor", category: "minor", fingers: [[1,2,1],[2,2,1],[3,1,1],[4,2,1],[5,1,1]], open: [], muted: [], startFret: 1 },
  { id: "bDm", name: "Dm", full: "D minor", category: "minor", fingers: [[2,3,1],[3,2,1],[5,2,1]], open: [1,4], muted: [], startFret: 1 },
  { id: "bEbm", name: "Ebm", full: "Eb minor", category: "minor", fingers: [[1,1,1],[2,4,1],[3,3,1],[4,1,1],[5,3,1]], open: [], muted: [], startFret: 1 },
  { id: "bEm", name: "Em", full: "E minor", category: "minor", fingers: [[1,2,1],[4,2,1]], open: [2,3,5], muted: [], startFret: 1 },
  { id: "bFm", name: "Fm", full: "F minor", category: "minor", fingers: [[1,3,1],[2,1,1],[3,1,1],[4,3,1],[5,1,1]], open: [], muted: [], startFret: 1 },
  { id: "bFsm", name: "F#m", full: "F# minor", category: "minor", fingers: [[1,4,1],[2,2,1],[3,2,1],[4,4,1],[5,2,1]], open: [], muted: [], startFret: 1 },
  { id: "bGm", name: "Gm", full: "G minor", category: "minor", fingers: [[2,3,1]], open: [1,3,4,5], muted: [], startFret: 1 },
  { id: "bAbm", name: "Abm", full: "Ab minor", category: "minor", fingers: [[1,1,1],[3,1,1],[4,1,1],[5,1,1]], open: [2], muted: [], startFret: 1 },
  { id: "bAm", name: "Am", full: "A minor", category: "minor", fingers: [[1,2,1],[2,1,1],[3,2,1],[4,2,1],[5,2,1]], open: [], muted: [], startFret: 1 },
  { id: "bBbm", name: "Bbm", full: "Bb minor", category: "minor", fingers: [[1,3,1],[2,2,1],[3,3,1],[4,3,1],[5,3,1]], open: [], muted: [], startFret: 1 },
  { id: "bBm", name: "Bm", full: "B minor", category: "minor", fingers: [[3,4,1],[5,4,1]], open: [1,2,4], muted: [], startFret: 1 },
  // 7
  { id: "bC7", name: "C7", full: "C dom7", category: "dom7", fingers: [[1,2,1],[2,1,1],[4,2,1]], open: [3,5], muted: [], startFret: 1 },
  { id: "bDb7", name: "Db7", full: "Db dom7", category: "dom7", fingers: [[1,3,1],[3,1,1],[4,3,1],[5,1,1]], open: [2], muted: [], startFret: 1 },
  { id: "bD7", name: "D7", full: "D dom7", category: "dom7", fingers: [[2,1,1],[3,2,1],[5,2,1]], open: [1,4], muted: [], startFret: 1 },
  { id: "bEb7", name: "Eb7", full: "Eb dom7", category: "dom7", fingers: [[1,1,1],[2,2,1],[4,1,1]], open: [3,5], muted: [], startFret: 1 },
  { id: "bE7", name: "E7", full: "E dom7", category: "dom7", fingers: [[3,1,1],[5,1,1]], open: [1,2,4], muted: [], startFret: 1 },
  { id: "bF7", name: "F7", full: "F dom7", category: "dom7", fingers: [[1,1,1],[2,1,1],[3,2,1],[4,1,1],[5,2,1]], open: [], muted: [], startFret: 1 },
  { id: "bFs7", name: "F#7", full: "F# dom7", category: "dom7", fingers: [[1,2,1],[2,2,1],[3,3,1],[4,2,1],[5,3,1]], open: [], muted: [], startFret: 1 },
  { id: "bG7", name: "G7", full: "G dom7", category: "dom7", fingers: [], open: [1,2,3,4,5], muted: [], startFret: 1 },
  { id: "bAb7", name: "Ab7", full: "Ab dom7", category: "dom7", fingers: [[1,1,1],[2,1,1],[3,1,1],[4,1,1],[5,1,1]], open: [], muted: [], startFret: 1 },
  { id: "bA7", name: "A7", full: "A dom7", category: "dom7", fingers: [[1,2,1],[2,2,1],[4,2,1]], open: [3,5], muted: [], startFret: 1 },
  { id: "bBb7", name: "Bb7", full: "Bb dom7", category: "dom7", fingers: [[2,3,1],[3,1,1],[5,1,1]], open: [1,4], muted: [], startFret: 1 },
  { id: "bB7", name: "B7", full: "B dom7", category: "dom7", fingers: [[1,1,1],[3,2,1],[4,1,1],[5,2,1]], open: [2], muted: [], startFret: 1 },
  // Maj7
  { id: "bCmaj7", name: "Cmaj7", full: "C maj7", category: "maj7", fingers: [[1,2,1],[4,2,1]], open: [2,3,5], muted: [], startFret: 1 },
  { id: "bDbmaj7", name: "Dbmaj7", full: "Db maj7", category: "maj7", fingers: [[1,3,1],[2,1,1],[3,1,1],[4,3,1],[5,1,1]], open: [], muted: [], startFret: 1 },
  { id: "bDmaj7", name: "Dmaj7", full: "D maj7", category: "maj7", fingers: [[2,2,1],[3,2,1],[5,2,1]], open: [1,4], muted: [], startFret: 1 },
  { id: "bEbmaj7", name: "Ebmaj7", full: "Eb maj7", category: "maj7", fingers: [[2,3,1]], open: [1,3,4,5], muted: [], startFret: 1 },
  { id: "bEmaj7", name: "Emaj7", full: "E maj7", category: "maj7", fingers: [[1,1,1],[3,1,1],[4,1,1],[5,1,1]], open: [2], muted: [], startFret: 1 },
  { id: "bFmaj7", name: "Fmaj7", full: "F maj7", category: "maj7", fingers: [[1,2,1],[2,1,1],[3,2,1],[4,2,1],[5,2,1]], open: [], muted: [], startFret: 1 },
  { id: "bFsmaj7", name: "F#maj7", full: "F# maj7", category: "maj7", fingers: [[1,3,1],[2,2,1],[3,3,1],[4,3,1],[5,3,1]], open: [], muted: [], startFret: 1 },
  { id: "bGmaj7", name: "Gmaj7", full: "G maj7", category: "maj7", fingers: [], open: [1,2,3,4,5], muted: [], startFret: 1 },
  { id: "bAbmaj7", name: "Abmaj7", full: "Ab maj7", category: "maj7", fingers: [[1,1,1],[2,1,1],[4,1,1]], open: [3,5], muted: [], startFret: 1 },
  { id: "bAmaj7", name: "Amaj7", full: "A maj7", category: "maj7", fingers: [[1,2,1],[2,2,1],[3,1,1],[4,2,1],[5,1,1]], open: [], muted: [], startFret: 1 },
  { id: "bBbmaj7", name: "Bbmaj7", full: "Bb maj7", category: "maj7", fingers: [[2,3,1],[3,2,1],[5,2,1]], open: [1,4], muted: [], startFret: 1 },
  { id: "bBmaj7", name: "Bmaj7", full: "B maj7", category: "maj7", fingers: [[1,1,1],[3,3,1],[4,1,1],[5,3,1]], open: [2], muted: [], startFret: 1 },
  // Min7
  { id: "bCm7", name: "Cm7", full: "C min7", category: "min7", fingers: [[1,1,1],[2,1,1],[4,1,1]], open: [3,5], muted: [], startFret: 1 },
  { id: "bDbm7", name: "Dbm7", full: "Db min7", category: "min7", fingers: [[1,2,1],[3,1,1],[4,2,1],[5,1,1]], open: [2], muted: [], startFret: 1 },
  { id: "bDm7", name: "Dm7", full: "D min7", category: "min7", fingers: [[2,1,1],[3,2,1],[5,2,1]], open: [1,4], muted: [], startFret: 1 },
  { id: "bEbm7", name: "Ebm7", full: "Eb min7", category: "min7", fingers: [[1,1,1],[2,2,1],[3,3,1],[4,1,1],[5,3,1]], open: [], muted: [], startFret: 1 },
  { id: "bEm7", name: "Em7", full: "E min7", category: "min7", fingers: [], open: [1,2,3,4,5], muted: [], startFret: 1 },
  { id: "bFm7", name: "Fm7", full: "F min7", category: "min7", fingers: [[1,1,1],[2,1,1],[3,1,1],[4,1,1],[5,1,1]], open: [], muted: [], startFret: 1 },
  { id: "bFsm7", name: "F#m7", full: "F# min7", category: "min7", fingers: [[1,2,1],[2,2,1],[3,2,1],[4,2,1],[5,2,1]], open: [], muted: [], startFret: 1 },
  { id: "bGm7", name: "Gm7", full: "G min7", category: "min7", fingers: [[2,3,1]], open: [1,3,4,5], muted: [], startFret: 1 },
  { id: "bAbm7", name: "Abm7", full: "Ab min7", category: "min7", fingers: [[1,1,1],[3,1,1],[4,1,1],[5,1,1]], open: [2], muted: [], startFret: 1 },
  { id: "bAm7", name: "Am7", full: "A min7", category: "min7", fingers: [[1,2,1],[2,1,1],[4,2,1]], open: [3,5], muted: [], startFret: 1 },
  { id: "bBbm7", name: "Bbm7", full: "Bb min7", category: "min7", fingers: [[1,3,1],[2,2,1],[3,1,1],[4,3,1],[5,1,1]], open: [], muted: [], startFret: 1 },
  { id: "bBm7", name: "Bm7", full: "B min7", category: "min7", fingers: [[3,2,1],[5,2,1]], open: [1,2,4], muted: [], startFret: 1 },
  // Dim
  { id: "bCdim", name: "Cdim", full: "C dim", category: "dim", fingers: [[1,1,1],[2,1,1],[4,1,1]], open: [], muted: [3,5], startFret: 1 },
  { id: "bDbdim", name: "Dbdim", full: "Db dim", category: "dim", fingers: [[1,2,1],[2,2,1],[4,2,1]], open: [3,5], muted: [], startFret: 1 },
  { id: "bDdim", name: "Ddim", full: "D dim", category: "dim", fingers: [[2,3,1],[3,1,1],[5,1,1]], open: [1,4], muted: [], startFret: 1 },
  { id: "bEbdim", name: "Ebdim", full: "Eb dim", category: "dim", fingers: [[1,1,1],[2,4,1],[3,2,1],[4,1,1],[5,2,1]], open: [], muted: [], startFret: 1 },
  { id: "bEdim", name: "Edim", full: "E dim", category: "dim", fingers: [[1,2,1],[4,2,1]], open: [3,5], muted: [2], startFret: 1 },
  { id: "bFdim", name: "Fdim", full: "F dim", category: "dim", fingers: [[1,3,1],[3,1,1],[4,3,1],[5,1,1]], open: [2], muted: [], startFret: 1 },
  { id: "bFsdim", name: "F#dim", full: "F# dim", category: "dim", fingers: [[1,4,1],[2,1,1],[3,2,1],[4,4,1],[5,2,1]], open: [], muted: [], startFret: 1 },
  { id: "bGdim", name: "Gdim", full: "G dim", category: "dim", fingers: [[2,2,1]], open: [3,5], muted: [1,4], startFret: 1 },
  { id: "bAbdim", name: "Abdim", full: "Ab dim", category: "dim", fingers: [[3,1,1],[5,1,1]], open: [1,2,4], muted: [], startFret: 1 },
  { id: "bAdim", name: "Adim", full: "A dim", category: "dim", fingers: [[1,1,1],[2,1,1],[3,2,1],[4,1,1],[5,2,1]], open: [], muted: [], startFret: 1 },
  { id: "bBbdim", name: "Bbdim", full: "Bb dim", category: "dim", fingers: [[1,2,1],[2,2,1],[3,3,1],[4,2,1],[5,3,1]], open: [], muted: [], startFret: 1 },
  { id: "bBdim", name: "Bdim", full: "B dim", category: "dim", fingers: [[3,4,1],[5,4,1]], open: [1,2,4], muted: [], startFret: 1 },
  // Aug
  { id: "bCaug", name: "Caug", full: "C aug", category: "aug", fingers: [[1,2,1],[2,1,1],[3,1,1],[4,2,1],[5,1,1]], open: [], muted: [], startFret: 1 },
  { id: "bDbaug", name: "Dbaug", full: "Db aug", category: "aug", fingers: [[1,3,1],[2,2,1],[3,2,1],[4,3,1],[5,2,1]], open: [], muted: [], startFret: 1 },
  { id: "bDaug", name: "Daug", full: "D aug", category: "aug", fingers: [[2,3,1],[3,3,1],[5,3,1]], open: [1,4], muted: [], startFret: 1 },
  { id: "bEbaug", name: "Ebaug", full: "Eb aug", category: "aug", fingers: [[1,1,1],[4,1,1]], open: [2,3,5], muted: [], startFret: 1 },
  { id: "bEaug", name: "Eaug", full: "E aug", category: "aug", fingers: [[1,2,1],[2,1,1],[3,1,1],[4,2,1],[5,1,1]], open: [], muted: [], startFret: 1 },
  { id: "bFaug", name: "Faug", full: "F aug", category: "aug", fingers: [[1,3,1],[2,2,1],[3,2,1],[4,3,1],[5,2,1]], open: [], muted: [], startFret: 1 },
  { id: "bFsaug", name: "F#aug", full: "F# aug", category: "aug", fingers: [[2,3,1],[3,3,1],[5,3,1]], open: [1,4], muted: [], startFret: 1 },
  { id: "bGaug", name: "Gaug", full: "G aug", category: "aug", fingers: [[1,1,1],[4,1,1]], open: [2,3,5], muted: [], startFret: 1 },
  { id: "bAbaug", name: "Abaug", full: "Ab aug", category: "aug", fingers: [[1,2,1],[2,1,1],[3,1,1],[4,2,1],[5,1,1]], open: [], muted: [], startFret: 1 },
  { id: "bAaug", name: "Aaug", full: "A aug", category: "aug", fingers: [[1,3,1],[2,2,1],[3,2,1],[4,3,1],[5,2,1]], open: [], muted: [], startFret: 1 },
  { id: "bBbaug", name: "Bbaug", full: "Bb aug", category: "aug", fingers: [[2,3,1],[3,3,1],[5,3,1]], open: [1,4], muted: [], startFret: 1 },
  { id: "bBaug", name: "Baug", full: "B aug", category: "aug", fingers: [[1,1,1],[4,1,1]], open: [2,3,5], muted: [], startFret: 1 },
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

// ─── Accords slash (ex: A/G = La en basse de Sol) ─────────────────────────────

const NOTE_SEMITONES: Record<string, number> = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
  'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8,
  'A': 9, 'A#': 10, 'Bb': 10, 'B': 11,
};

// Accordages par instrument (demi-tons, corde 1 = aigu, corde N = grave)
const INSTRUMENT_TUNINGS: Partial<Record<InstrumentId, number[]>> = {
  guitar:   [4, 11, 7, 2, 9, 4],  // E4 B3 G3 D3 A2 E2
  ukulele:  [9, 4, 0, 7],          // A4 E4 C4 G4
  mandolin: [4, 9, 2, 7],          // E5 A4 D4 G3
  banjo:    [2, 11, 7, 2, 7],      // D4 B3 G3 D3 G4
};

// Note canonique pour le piano par demi-ton
const PIANO_NOTE_BY_SEMI: Record<number, string> = {
  0:'C', 1:'C#', 2:'D', 3:'Eb', 4:'E', 5:'F',
  6:'F#', 7:'G', 8:'Ab', 9:'A', 10:'Bb', 11:'B',
};

// Détecte et parse une notation slash (ex: "Am/G" → { base:"Am", bass:"G" })
export function parseSlashChord(name: string): { base: string; bass: string } | null {
  const idx = name.lastIndexOf('/');
  if (idx === -1) return null;
  const base = name.slice(0, idx).trim();
  const bass = name.slice(idx + 1).trim();
  if (!base || !bass || NOTE_SEMITONES[bass] === undefined) return null;
  return { base, bass };
}

function deriveSlashStringChord(
  baseChord: StringChord,
  bassNote: string,
  instrumentId: InstrumentId,
): StringChord | null {
  const tuning = INSTRUMENT_TUNINGS[instrumentId];
  if (!tuning) return null;

  const bassSemi = NOTE_SEMITONES[bassNote];
  if (bassSemi === undefined) return null;

  const numStrings = tuning.length;

  // Chercher la note basse sur la corde la plus grave (fret 0-5 max)
  let bassString = -1;
  let bassFret = -1;
  for (let s = numStrings; s >= 1; s--) {
    const fret = (bassSemi - tuning[s - 1] % 12 + 12) % 12;
    if (fret <= 5) { bassString = s; bassFret = fret; break; }
  }
  if (bassString === -1) return null;

  // Construire la nouvelle voix
  const newFingers = baseChord.fingers.filter(([s]) => s !== bassString);
  const newOpen    = baseChord.open.filter(s => s !== bassString);
  const newMuted   = baseChord.muted.filter(s => s !== bassString);

  if (bassFret === 0) {
    newOpen.push(bassString);
  } else {
    newFingers.push([bassString, bassFret, 1]);
  }

  // Muter les cordes de hauteur inférieure à la corde de basse
  for (let s = bassString + 1; s <= numStrings; s++) {
    if (!newMuted.includes(s)) newMuted.push(s);
  }

  // Vérifier la jouabilité : écart max 4 cases entre tous les doigts pressés
  const allFrets = newFingers.map(([, f]) => f).filter(f => f > 0);
  if (allFrets.length > 1) {
    const span = Math.max(...allFrets) - Math.min(...allFrets);
    if (span > 4) return null;
  }

  const newStartFret = bassFret > 0
    ? Math.min(baseChord.startFret, bassFret)
    : baseChord.startFret;

  return {
    ...baseChord,
    id: `${baseChord.id}/${bassNote}`,
    name: `${baseChord.name}/${bassNote}`,
    full: `${baseChord.full} (basse ${bassNote})`,
    fingers: newFingers,
    open: newOpen,
    muted: newMuted,
    startFret: newStartFret,
  };
}

function deriveSlashPianoChord(
  baseChord: PianoChord,
  bassNote: string,
): PianoChord | null {
  const bassSemi = NOTE_SEMITONES[bassNote];
  if (bassSemi === undefined) return null;

  const bassName = PIANO_NOTE_BY_SEMI[bassSemi];

  // Si la note basse est déjà dans l'accord (renversement), juste renommer
  const noteNames = baseChord.notes.map(n => n.replace(/\d/, ''));
  if (noteNames.includes(bassName)) {
    return {
      ...baseChord,
      id: `${baseChord.id}/${bassNote}`,
      name: `${baseChord.name}/${bassNote}`,
      full: `${baseChord.full} (basse ${bassNote})`,
    };
  }

  // Note basse absente : l'ajouter à l'octave 4 (plus grave que les notes habituelles)
  return {
    ...baseChord,
    id: `${baseChord.id}/${bassNote}`,
    name: `${baseChord.name}/${bassNote}`,
    full: `${baseChord.full} (basse ${bassNote})`,
    notes: [`${bassName}4`, ...baseChord.notes],
  };
}

// ─── Génération algorithmique d'accords étendus ───────────────────────────────

// Formules : intervalles en demi-tons depuis la fondamentale
const EXTENDED_FORMULAS: Record<string, { intervals: number[]; category: string; label: string }> = {
  // Minor major
  'mMaj7':   { intervals: [0,3,7,11],          category:'mMaj7',  label:'minor maj.7' },
  'mMaj9':   { intervals: [0,3,7,11,14],        category:'mMaj7',  label:'minor maj.9' },
  // Demi-diminué / mineur altéré
  'm7b5':    { intervals: [0,3,6,10],           category:'dim',    label:'demi-dim.7' },
  'dim7':    { intervals: [0,3,6,9],            category:'dim',    label:'dim.7' },
  'm7#5':    { intervals: [0,3,8,10],           category:'aug',    label:'min.7 #5' },
  'm7b9':    { intervals: [0,3,7,10,13],        category:'min7',   label:'min.7 b9' },
  'm7#9':    { intervals: [0,3,7,10,15],        category:'min7',   label:'min.7 #9' },
  'm7b13':   { intervals: [0,3,7,10,20],        category:'min7',   label:'min.7 b13' },
  'm7#13':   { intervals: [0,3,7,10,22],        category:'min7',   label:'min.7 #13' },
  // Augmenté 7
  'aug7':    { intervals: [0,4,8,10],           category:'aug',    label:'aug.7' },
  'augMaj7': { intervals: [0,4,8,11],           category:'aug',    label:'aug.maj.7' },
  // 6e
  '6':       { intervals: [0,4,7,9],            category:'major',  label:'major 6' },
  'm6':      { intervals: [0,3,7,9],            category:'minor',  label:'minor 6' },
  // 9e
  '9':       { intervals: [0,4,7,10,14],        category:'dom7',   label:'dom.9' },
  'maj9':    { intervals: [0,4,7,11,14],        category:'maj7',   label:'maj.9' },
  'min9':    { intervals: [0,3,7,10,14],        category:'min7',   label:'min.9' },
  // add9 (sans 7e)
  'add9':    { intervals: [0,4,7,14],           category:'add9',   label:'add9' },
  'madd9':   { intervals: [0,3,7,14],           category:'minor',  label:'min.add9' },
  // 11e
  '11':      { intervals: [0,4,7,10,14,17],     category:'dom7',   label:'dom.11' },
  'maj11':   { intervals: [0,4,7,11,14,17],     category:'maj7',   label:'maj.11' },
  'min11':   { intervals: [0,3,7,10,14,17],     category:'min7',   label:'min.11' },
  // 13e
  '13':      { intervals: [0,4,7,10,14,21],     category:'dom7',   label:'dom.13' },
  'maj13':   { intervals: [0,4,7,11,14,21],     category:'maj7',   label:'maj.13' },
  'min13':   { intervals: [0,3,7,10,14,21],     category:'min7',   label:'min.13' },
  // Dominantes altérées
  '7b5':     { intervals: [0,4,6,10],           category:'dom7',   label:'7 b5' },
  '7#5':     { intervals: [0,4,8,10],           category:'dom7',   label:'7 #5' },
  '7b9':     { intervals: [0,4,7,10,13],        category:'dom7',   label:'7 b9' },
  '7#9':     { intervals: [0,4,7,10,15],        category:'dom7',   label:'7 #9' },
  '7#11':    { intervals: [0,4,7,10,18],        category:'dom7',   label:'7 #11' },
  '7b13':    { intervals: [0,4,7,10,20],        category:'dom7',   label:'7 b13' },
  '7#13':    { intervals: [0,4,7,10,22],        category:'dom7',   label:'7 #13' },
  // Sus (instruments à cordes — le piano les a déjà en bibliothèque)
  'sus2':    { intervals: [0,2,7],              category:'sus',    label:'sus.2' },
  'sus4':    { intervals: [0,5,7],              category:'sus',    label:'sus.4' },
};

// Correspondance suffixe → clé de formule (ordre : plus spécifique en premier)
const FORMULA_KEY_BY_SUFFIX: Array<[RegExp, string]> = [
  [/^m(?:in)?[Mm]aj9$/,          'mMaj9'],
  [/^m(?:in)?[Mm]aj7$/,          'mMaj7'],
  [/^m(?:in)?7[bB]5$/,           'm7b5'],
  [/^[øØ]7?$/,                   'm7b5'],
  [/^m(?:in)?7[#♯]5$/,           'm7#5'],
  [/^m(?:in)?7[bB]9$/,           'm7b9'],
  [/^m(?:in)?7[#♯]9$/,           'm7#9'],
  [/^m(?:in)?7[bB]13$/,          'm7b13'],
  [/^m(?:in)?7[#♯]13$/,          'm7#13'],
  [/^dim7$/i,                    'dim7'],
  [/^aug[Mm]aj7$/i,              'augMaj7'],
  [/^aug7$/i,                    'aug7'],
  [/^m(?:in)?13$/,               'min13'],
  [/^[Mm]aj13$/,                 'maj13'],
  [/^13$/,                       '13'],
  [/^m(?:in)?11$/,               'min11'],
  [/^[Mm]aj11$/,                 'maj11'],
  [/^11$/,                       '11'],
  [/^m(?:in)?9$/,                'min9'],
  [/^[Mm]aj9$/,                  'maj9'],
  [/^9$/,                        '9'],
  [/^m(?:in)?[Aa]dd(?:9|2)$/,    'madd9'],
  [/^[Aa]dd(?:9|2)$/,            'add9'],
  [/^7[bB]5$/,                   '7b5'],
  [/^7[#♯]5$/,                   '7#5'],
  [/^7[bB]9$/,                   '7b9'],
  [/^7[#♯]9$/,                   '7#9'],
  [/^7[#♯]11$/,                  '7#11'],
  [/^7[bB]13$/,                  '7b13'],
  [/^7[#♯]13$/,                  '7#13'],
  [/^m(?:in)?6$/,                'm6'],
  [/^6$/,                        '6'],
  [/^sus2$/,                     'sus2'],
  [/^sus4?$/,                    'sus4'],
];

// Parse "Dmmaj7", "G7#9", "Dm7(♯13)" → { root, rootSemi, formulaKey }
function parseExtendedChordName(name: string): { root: string; rootSemi: number; formulaKey: string } | null {
  // Normaliser les symboles unicode et parenthèses
  const cleaned = name.replace(/♯/g, '#').replace(/♭/g, 'b').replace(/[()]/g, '');
  const rootMatch = cleaned.match(/^([A-G][#b]?)/);
  if (!rootMatch) return null;

  const root = rootMatch[1];
  const rootSemi = NOTE_SEMITONES[root];
  if (rootSemi === undefined) return null;

  const suffix = cleaned.slice(root.length);
  for (const [pattern, key] of FORMULA_KEY_BY_SUFFIX) {
    if (pattern.test(suffix)) return { root, rootSemi, formulaKey: key };
  }
  return null;
}

// Réduit la liste d'intervalles au nombre de cordes disponibles
// Priorité d'omission : 5te, 11e, 9e, puis reste
function prioritizeIntervals(intervals: number[], maxNotes: number): number[] {
  if (intervals.length <= maxNotes) return intervals;

  const omitOrder = [7, 17, 14, 21]; // 5te, 11e, 9e, 13e
  let result = [...intervals];
  for (const omit of omitOrder) {
    if (result.length <= maxNotes) break;
    result = result.filter(i => i % 12 !== omit % 12);
  }
  return result.slice(0, maxNotes);
}

// Génère un voicing pour instrument à cordes via fenêtre de cases glissante
function generateStringVoicing(
  rootSemi: number,
  intervals: number[],
  instrumentId: InstrumentId,
  id: string, name: string, full: string, category: string,
): StringChord | null {
  const tuning = INSTRUMENT_TUNINGS[instrumentId];
  if (!tuning) return null;

  const numStrings = tuning.length;
  const targets = prioritizeIntervals(intervals, numStrings).map(i => (rootSemi + i) % 12);
  const uniqueTargets = [...new Set(targets)];

  let best: { fingers: FingerPosition[]; open: number[]; muted: number[]; startFret: number; score: number } | null = null;

  for (let w = 0; w <= 9; w++) {
    const fingers: FingerPosition[] = [];
    const open: number[] = [];
    const muted: number[] = [];
    const used = new Set<number>();

    for (let s = 1; s <= numStrings; s++) {
      const strSemi = tuning[s - 1] % 12;

      // Cases à tester : corde à vide (0) + fenêtre [w, w+4]
      const fretsToTry = [0];
      for (let f = Math.max(1, w); f <= Math.max(1, w) + 4; f++) fretsToTry.push(f);

      let placed = false;
      for (const fret of fretsToTry) {
        const noteSemi = (strSemi + fret) % 12;
        if (uniqueTargets.includes(noteSemi)) {
          if (fret === 0) open.push(s);
          else fingers.push([s, fret, 1]);
          used.add(noteSemi);
          placed = true;
          break;
        }
      }
      if (!placed) muted.push(s);
    }

    // Vérifier la jouabilité : écart de cases ≤ 4
    const pressedFrets = fingers.map(([, f]) => f);
    if (pressedFrets.length > 1) {
      const span = Math.max(...pressedFrets) - Math.min(...pressedFrets);
      if (span > 4) continue;
    }

    const coverage = used.size / uniqueTargets.length;
    if (coverage < 0.6) continue;

    // La fondamentale doit être sur la corde la plus grave jouée
    const playedStrings = [...open, ...fingers.map(([s]) => s)].sort((a, b) => b - a);
    if (playedStrings.length === 0) continue;
    const bassStr = playedStrings[0];
    const bassFret = open.includes(bassStr) ? 0 : (fingers.find(([s]) => s === bassStr)?.[1] ?? 0);
    const bassNote = (tuning[bassStr - 1] + bassFret) % 12;
    const rootInBass = bassNote === rootSemi;

    const startFret = pressedFrets.length > 0 ? Math.min(...pressedFrets) : 1;
    const score = coverage * 100
      + (rootInBass ? 20 : 0)
      - muted.length * 8
      - w * 0.5
      + open.length * 3;

    if (!best || score > best.score) {
      best = { fingers, open, muted, startFret, score };
    }
  }

  if (!best) return null;
  return { id, name, full, category, fingers: best.fingers, open: best.open, muted: best.muted, startFret: best.startFret };
}

// Génère un voicing piano dans la plage C4–C6
function generatePianoVoicing(
  rootSemi: number,
  intervals: number[],
  id: string, name: string, full: string, category: string,
): PianoChord {
  // Fondamentale à l'octave 4 (MIDI 60 = C4)
  const rootMidi = 60 + rootSemi;
  const notes: string[] = [];

  for (const interval of intervals) {
    // Réduire les extensions > 24 demi-tons (13e = 21, etc.) dans la fenêtre
    let midi = rootMidi + interval;
    while (midi > 84) midi -= 12; // Max C6
    while (midi < 60) midi += 12; // Min C4
    if (midi > 84) continue;

    const semi = midi % 12;
    const octave = Math.floor(midi / 12) - 1;
    const noteName = PIANO_NOTE_BY_SEMI[semi];
    if (noteName) notes.push(`${noteName}${octave}`);
  }

  return { id, name, full, category, notes };
}

// Rechercher un accord par nom
export function findChordByName(name: string, instrumentId: InstrumentId): (StringChord | PianoChord) | undefined {
  return findChordVariants(name, instrumentId)[0];
}

// Correspondances enharmoniques vers les noms de la bibliothèque
const ENHARMONIC_MAP: Record<string, string> = {
  'C#': 'Db', 'D#': 'Eb', 'E#': 'F', 'G#': 'Ab', 'A#': 'Bb', 'B#': 'C',
  'Cb': 'B', 'Fb': 'E', 'Gb': 'F#',
};

function normalizeEnharmonic(name: string): string {
  const match = name.trim().match(/^([A-G][b#]?)(.*)$/);
  if (!match) return name;
  const [, root, suffix] = match;
  const mapped = ENHARMONIC_MAP[root];
  return mapped ? mapped + suffix : name;
}

// Rechercher tous les accords correspondant à un nom (peut retourner plusieurs variantes)
export function findChordVariants(
  name: string,
  instrumentId: InstrumentId,
  _visited: Set<string> = new Set(),
): (StringChord | PianoChord)[] {
  const visitKey = `${name.trim()}|${instrumentId}`;
  if (_visited.has(visitKey)) return [];
  _visited.add(visitKey);

  // 0. Normalisation enharmonique (C# → Db, Gb → F#, Cb → B, etc.)
  const enharmonicName = normalizeEnharmonic(name);
  if (enharmonicName !== name.trim()) return findChordVariants(enharmonicName, instrumentId, _visited);

  const chords = getChordsByInstrument(instrumentId);
  const normalizedName = name.trim().toLowerCase();

  // 1. Recherche directe dans la bibliothèque
  const direct = chords.filter(c => c.name.toLowerCase() === normalizedName);
  if (direct.length > 0) return direct;

  // 2. Accord slash (A/G, C/E…)
  const slash = parseSlashChord(name);
  if (slash) {
    const baseVariants = findChordVariants(slash.base, instrumentId, _visited);
    if (baseVariants.length > 0) {
      const derived: (StringChord | PianoChord)[] = [];
      for (const base of baseVariants) {
        const result = instrumentId === 'piano'
          ? deriveSlashPianoChord(base as PianoChord, slash.bass)
          : deriveSlashStringChord(base as StringChord, slash.bass, instrumentId);
        if (result) { derived.push(result); break; }
      }
      if (derived.length > 0) return derived;
    }
  }

  // 3. Génération algorithmique depuis formule (mMaj7, 7#9, dim7, 9, 11, 13…)
  const parsed = parseExtendedChordName(name);
  if (parsed) {
    const formula = EXTENDED_FORMULAS[parsed.formulaKey];
    if (formula) {
      const safeId = name.replace(/[^a-zA-Z0-9]/g, '_');
      const id = `gen_${instrumentId}_${safeId}`;
      const full = `${parsed.root} ${formula.label}`;

      if (instrumentId === 'piano') {
        return [generatePianoVoicing(parsed.rootSemi, formula.intervals, id, name, full, formula.category)];
      }
      const chord = generateStringVoicing(parsed.rootSemi, formula.intervals, instrumentId, id, name, full, formula.category);
      if (chord) return [chord];
    }
  }

  return [];
}

// ─── Traduction notation française ───────────────────────────────────────────

const FR_NOTES: Record<string, string> = {
  'C#': 'Do#', 'Cb': 'Dob', 'C': 'Do',
  'D#': 'Ré#', 'Db': 'Réb', 'D': 'Ré',
  'E#': 'Mi#', 'Eb': 'Mib', 'E': 'Mi',
  'F#': 'Fa#', 'Fb': 'Fab', 'F': 'Fa',
  'G#': 'Sol#', 'Gb': 'Solb', 'G': 'Sol',
  'A#': 'La#', 'Ab': 'Lab', 'A': 'La',
  'B#': 'Si#', 'Bb': 'Sib', 'B': 'Si',
};

export function translateChordName(name: string, notation: 'american' | 'french'): string {
  if (!name || notation === 'american') return name;
  // Accord slash : traduire chaque côté
  const slashIdx = name.indexOf('/');
  if (slashIdx > 0) {
    return translateChordName(name.slice(0, slashIdx), notation)
      + '/' + translateChordName(name.slice(slashIdx + 1), notation);
  }
  // Extraire la fondamentale (ex: "F#", "Bb", "C") puis le suffixe
  const match = name.trim().match(/^([A-G][b#]?)(.*)$/);
  if (!match) return name;
  const [, root, suffix] = match;
  return (FR_NOTES[root] ?? root) + suffix;
}
