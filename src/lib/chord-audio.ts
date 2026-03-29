// Système audio pour jouer les accords
import type { StringChord, PianoChord, InstrumentId } from '@/types';
import { isPianoChord } from '@/types';

// Fréquences des cordes à vide (string 1 = aigu, string N = grave)
const OPEN_FREQS: Record<string, Record<number, number>> = {
  guitar: { 1: 329.63, 2: 246.94, 3: 196.00, 4: 146.83, 5: 110.00, 6: 82.41 },
  ukulele: { 1: 440.00, 2: 329.63, 3: 261.63, 4: 392.00 },
  mandolin: { 1: 659.25, 2: 440.00, 3: 293.66, 4: 196.00 },
  banjo: { 1: 293.66, 2: 246.94, 3: 196.00, 4: 146.83, 5: 392.00 },
};

// Conversion nom de note vers fréquence (ex: "C4" -> 261.63)
function noteNameToFreq(name: string): number | null {
  const noteMap: Record<string, number> = {
    'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
    'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
    'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11,
  };

  const match = name.match(/^([A-G][b#]?)(\d)$/);
  if (!match) return null;

  const [, noteName, octaveStr] = match;
  const octave = parseInt(octaveStr, 10);
  const noteValue = noteMap[noteName];

  if (noteValue === undefined) return null;

  const midi = (octave + 1) * 12 + noteValue;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Singleton AudioContext
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

// Obtenir les fréquences d'un accord pour instrument à cordes
function getStringChordFrequencies(chord: StringChord, instrumentId: InstrumentId): number[] {
  const tuning = OPEN_FREQS[instrumentId];
  if (!tuning) return [];

  const { fingers = [], barre, open = [], muted = [] } = chord;
  const numStrings = Object.keys(tuning).length;
  const freqs: { s: number; freq: number }[] = [];

  for (let s = 1; s <= numStrings; s++) {
    if (muted.includes(s)) continue;

    const openFreq = tuning[s];
    if (!openFreq) continue;

    // Si corde ouverte
    if (open.includes(s)) {
      freqs.push({ s, freq: openFreq });
      continue;
    }

    // Vérifier si un doigt est sur cette corde
    const finger = fingers.find(([fs]) => fs === s);
    if (finger) {
      freqs.push({ s, freq: openFreq * Math.pow(2, finger[1] / 12) });
      continue;
    }

    // Vérifier le barré
    if (barre && s >= Math.min(barre.fromString, barre.toString)
              && s <= Math.max(barre.fromString, barre.toString)) {
      freqs.push({ s, freq: openFreq * Math.pow(2, barre.fret / 12) });
      continue;
    }

    // Par défaut : corde à vide
    freqs.push({ s, freq: openFreq });
  }

  // Ordre grave→aigu pour le strum
  return freqs.sort((a, b) => b.s - a.s).map(x => x.freq);
}

// Obtenir les fréquences d'un accord piano
function getPianoChordFrequencies(chord: PianoChord): number[] {
  return (chord.notes || [])
    .map(noteNameToFreq)
    .filter((f): f is number => f !== null);
}

// Jouer une seule note
export function playNote(freq: number, isPiano = false): void {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type = isPiano ? 'sine' : 'triangle';
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  gain.gain.setValueAtTime(0.28, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.4);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 1.4);
}

// Jouer un accord complet
export function playChord(
  chord: StringChord | PianoChord,
  instrumentId: InstrumentId
): void {
  const ctx = getAudioContext();
  const isPiano = instrumentId === 'piano';

  const freqs = isPianoChord(chord)
    ? getPianoChordFrequencies(chord)
    : getStringChordFrequencies(chord, instrumentId);

  const strumDelay = isPiano ? 0.06 : 0.04;
  const decay = isPiano ? 1.8 : 2.2;
  const vol = isPiano ? 0.22 : 0.28;

  freqs.forEach((freq, i) => {
    const t = ctx.currentTime + i * strumDelay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = isPiano ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + decay);

    osc.start(t);
    osc.stop(t + decay);
  });
}
