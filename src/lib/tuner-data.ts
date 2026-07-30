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

// Corde cible la plus proche de la fréquence détectée (mode instrument).
export function nearestString(strings: TunerString[], midiFloat: number): { index: number; string: TunerString; cents: number } {
  let best = 0;
  for (let i = 1; i < strings.length; i++) {
    if (Math.abs(strings[i].midi - midiFloat) < Math.abs(strings[best].midi - midiFloat)) best = i;
  }
  const cents = Math.round((midiFloat - strings[best].midi) * 100);
  return { index: best, string: strings[best], cents };
}
