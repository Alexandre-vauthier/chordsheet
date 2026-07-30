// Données de l'accordeur : cordes cibles par instrument + conversion fréquence↔note.
// Référence A4 = 440 Hz.

const A4 = 440;
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function freqFromMidi(midi: number): number {
  return A4 * Math.pow(2, (midi - 69) / 12);
}

function midiFromName(note: string, octave: number): number {
  return (octave + 1) * 12 + NAMES.indexOf(note);
}

export interface TunerString {
  label: string;   // ex. « E2 »
  note: string;    // ex. « E »
  octave: number;
  midi: number;
  freq: number;
}

function s(note: string, octave: number): TunerString {
  const midi = midiFromName(note, octave);
  return { label: `${note}${octave}`, note, octave, midi, freq: freqFromMidi(midi) };
}

// Instruments à cordes proposés (grave → aigu), accordage standard.
export type TunerInstrument = 'guitar' | 'bass' | 'ukulele' | 'mandolin' | 'banjo';

export const TUNINGS: Record<TunerInstrument, TunerString[]> = {
  guitar:   [s('E', 2), s('A', 2), s('D', 3), s('G', 3), s('B', 3), s('E', 4)],
  bass:     [s('E', 1), s('A', 1), s('D', 2), s('G', 2)],
  ukulele:  [s('G', 4), s('C', 4), s('E', 4), s('A', 4)],
  mandolin: [s('G', 3), s('D', 4), s('A', 4), s('E', 5)],
  banjo:    [s('G', 4), s('D', 3), s('G', 3), s('B', 3), s('D', 4)],
};

export interface NoteInfo {
  midi: number;     // note chromatique la plus proche (entier)
  note: string;
  octave: number;
  label: string;
  cents: number;    // écart en cents vs cette note (-50..+50)
  midiFloat: number;
}

// Fréquence détectée → note chromatique la plus proche + écart en cents.
export function analyzeFreq(freq: number): NoteInfo {
  const midiFloat = 69 + 12 * Math.log2(freq / A4);
  const midi = Math.round(midiFloat);
  const cents = Math.round((midiFloat - midi) * 100);
  const note = NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return { midi, note, octave, label: `${note}${octave}`, cents, midiFloat };
}

// Corde cible correspondant à la fréquence détectée, en REPLIANT par octaves sur les
// cordes connues. Comme on connaît la fréquence/octave de chaque corde, une détection
// à l'octave (ex. 160 Hz au lieu de 80) est ramenée sur la bonne corde → plus d'erreur
// d'octave possible en mode instrument. On pénalise les grands sauts d'octave pour
// lever l'ambiguïté quand deux cordes portent la même note à une octave d'écart.
export function matchString(strings: TunerString[], freq: number): { index: number; string: TunerString; cents: number } {
  const m = 69 + 12 * Math.log2(freq / A4);
  let bestIdx = 0;
  let bestScore = Infinity;
  let bestFolded = m;
  for (let i = 0; i < strings.length; i++) {
    const sMidi = strings[i].midi;
    let folded = m;
    let shifts = 0;
    while (folded - sMidi > 6) { folded -= 12; shifts++; }
    while (sMidi - folded > 6) { folded += 12; shifts++; }
    const score = Math.abs(folded - sMidi) + 0.5 * shifts;
    if (score < bestScore) { bestScore = score; bestIdx = i; bestFolded = folded; }
  }
  const cents = Math.round((bestFolded - strings[bestIdx].midi) * 100);
  return { index: bestIdx, string: strings[bestIdx], cents };
}
