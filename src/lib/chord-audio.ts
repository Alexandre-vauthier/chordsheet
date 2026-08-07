// Système audio pour jouer les accords
import type { StringChord, PianoChord, InstrumentId } from '@/types';
import { isPianoChord } from '@/types';
import { chargerInstrumentSound, preloadInstrumentSound, isInstrumentSoundReady, playSampledNote } from './instrument-sounds';

// Fréquence (Hz) → numéro MIDI le plus proche. Nos accordages sont tempérés égaux
// et les frettes des demi-tons entiers, donc l'arrondi est exact (à l'erreur flottante près).
function freqToMidi(freq: number): number {
  return Math.round(69 + 12 * Math.log2(freq / 440));
}

// Fréquences des cordes à vide (string 1 = aigu, string N = grave)
export const OPEN_FREQS: Record<string, Record<number, number>> = {
  guitar: { 1: 329.63, 2: 246.94, 3: 196.00, 4: 146.83, 5: 110.00, 6: 82.41 },
  ukulele: { 1: 440.00, 2: 329.63, 3: 261.63, 4: 392.00 },
  mandolin: { 1: 659.25, 2: 440.00, 3: 293.66, 4: 196.00 },
  banjo: { 1: 293.66, 2: 246.94, 3: 196.00, 4: 146.83, 5: 392.00 },
  bass: { 1: 98.00, 2: 73.42, 3: 55.00, 4: 41.20 },  // G2 D2 A1 E1
};

// Conversion nom de note vers fréquence (ex: "C4" -> 261.63)
export function noteNameToFreq(name: string): number | null {
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

/**
 * Le contexte a-t-il ete suspendu par le navigateur ?
 *
 * Cela arrive sans prevenir : onglet passe en arriere-plan, fenetre masquee, machine
 * mise en veille. Pendant ce temps `currentTime` **se fige**, ce qui suffit a
 * derouter toute planification calee dessus.
 */
export function isAudioSuspended(): boolean {
  return audioContext?.state === 'suspended';
}

export function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

export async function ensureAudioContext(): Promise<void> {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }
}

// Obtenir les fréquences d'un accord pour instrument à cordes
function getStringChordFrequencies(chord: StringChord, instrumentId: InstrumentId, capo = 0): number[] {
  const tuning = OPEN_FREQS[instrumentId];
  if (!tuning) return [];

  const { fingers = [], barre, open = [], muted = [] } = chord;
  const numStrings = Object.keys(tuning).length;
  const freqs: { s: number; freq: number }[] = [];
  const capoShift = Math.pow(2, capo / 12);

  for (let s = 1; s <= numStrings; s++) {
    if (muted.includes(s)) continue;

    const openFreq = tuning[s];
    if (!openFreq) continue;

    // Si corde ouverte (sonne au capo)
    if (open.includes(s)) {
      freqs.push({ s, freq: openFreq * capoShift });
      continue;
    }

    // Vérifier si un doigt est sur cette corde
    const finger = fingers.find(([fs]) => fs === s);
    if (finger) {
      freqs.push({ s, freq: openFreq * Math.pow(2, (finger[1] + capo) / 12) });
      continue;
    }

    // Vérifier le barré
    if (barre && s >= Math.min(barre.fromString, barre.toString)
              && s <= Math.max(barre.fromString, barre.toString)) {
      freqs.push({ s, freq: openFreq * Math.pow(2, (barre.fret + capo) / 12) });
      continue;
    }

    // Corde non définie → ne pas la jouer (évite les notes parasites)
  }

  // Ordre grave→aigu pour le strum
  return freqs.sort((a, b) => b.s - a.s).map(x => x.freq);
}

// Obtenir les fréquences d'un accord piano (capo = décalage en demi-tons)
function getPianoChordFrequencies(chord: PianoChord, capo = 0): number[] {
  const capoShift = Math.pow(2, capo / 12);
  return (chord.notes || [])
    .map(noteNameToFreq)
    .filter((f): f is number => f !== null)
    .map(f => f * capoShift);
}

// Précharge l'instrument échantillonné pour cet instrumentId (idempotent, no-op pour
// voice/percussion). À appeler dès qu'on sait quel instrument va être joué (montage de
// la vue, changement d'instrument) pour qu'il soit prêt au premier clic.
export function preloadInstrument(instrumentId: InstrumentId): void {
  preloadInstrumentSound(getAudioContext(), instrumentId);
}

/** Attendre que l'instrument soit réellement prêt à sonner. */
export function prepareInstrument(instrumentId: InstrumentId): Promise<boolean> {
  return chargerInstrumentSound(getAudioContext(), instrumentId);
}

// Jouer une seule note
export function playNote(freq: number, isPiano = false, instrumentId?: InstrumentId): void {
  const ctx = getAudioContext();
  const targetInstrument = instrumentId ?? (isPiano ? 'piano' : undefined);

  if (targetInstrument && isInstrumentSoundReady(targetInstrument)) {
    playSampledNote(targetInstrument, freqToMidi(freq), ctx.currentTime, 1.4);
    return;
  }

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

// Voix en cours, indexées PAR INSTRUMENT : ainsi jouer un accord sur plusieurs
// instruments simultanément (guitare + basse + piano) ne les coupe pas entre eux
// — chaque instrument ne coupe que sa propre voix précédente.
interface ActiveVoice {
  nodes: { osc: OscillatorNode; gain: GainNode }[]; // repli oscillateur
  stopFns: ((at?: number) => void)[];               // voix échantillonnées (instrument-sounds.ts)
}
const activeByInstrument = new Map<InstrumentId, ActiveVoice>();

// Couper le son en cours (fade out rapide). Sans argument : coupe tous les
// instruments ; avec un instrument : ne coupe que celui-ci.
/**
 * Couper le son en cours, éventuellement à un instant futur.
 *
 * `at` sert à la lecture d'une grille, qui programme ses accords en avance : sans
 * lui, poser l'accord suivant coupait le précédent au moment de la *programmation*
 * et non à celui où il cède la place. Chaque accord perdait la fin de sa durée, et
 * la grille sonnait hachée.
 */
function stopActiveChord(instrumentId?: InstrumentId, at?: number) {
  const ctx = audioContext;
  const stopOne = (v: ActiveVoice) => {
    if (ctx) {
      const now = Math.max(at ?? ctx.currentTime, ctx.currentTime);
      for (const { osc, gain } of v.nodes) {
        try {
          gain.gain.cancelScheduledValues(now);
          gain.gain.setValueAtTime(gain.gain.value, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
          osc.stop(now + 0.06);
        } catch { /* already stopped */ }
      }
    }
    for (const stop of v.stopFns) {
      try { stop(at); } catch { /* already stopped */ }
    }
  };

  if (instrumentId) {
    const v = activeByInstrument.get(instrumentId);
    if (v) { stopOne(v); activeByInstrument.delete(instrumentId); }
  } else {
    for (const v of activeByInstrument.values()) stopOne(v);
    activeByInstrument.clear();
  }
}

/**
 * Coupe le son de tous les instruments (fondu rapide).
 *
 * La lecture d'une grille, elle, ne coupe rien : le dernier accord finit de sonner,
 * ce qui est musicalement juste. C'est un bouton d'arrêt explicite qui a besoin de
 * faire taire l'instant même.
 */
export function stopAllChords(): void {
  stopActiveChord();
}

// Jouer un tick de métronome (click court et sec)
// atTime : horloge Web Audio (ctx.currentTime) pour scheduling précis, sinon "maintenant"
export function playMetronomeTick(accent = false, atTime?: number): void {
  const ctx = getAudioContext();
  const t = atTime ?? ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type = 'square';
  osc.frequency.setValueAtTime(accent ? 1200 : 800, t);
  gain.gain.setValueAtTime(accent ? 0.35 : 0.2, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);

  osc.start(t);
  osc.stop(t + 0.05);
}

// Métronome sans dérive : planifie les beats via l'horloge hardware de l'AudioContext
// Retourne une fonction stop() à appeler pour arrêter.
export function startScheduledMetronome(bpm: number, beatsPerMeasure: number): () => void {
  const ctx = getAudioContext();
  const beatSec = 60 / bpm;
  const lookAheadSec = 0.1; // planifier 100 ms à l'avance
  const schedulerMs = 25;   // vérifier toutes les 25 ms

  let nextBeatTime = ctx.currentTime;
  let beat = 0;

  function schedule() {
    while (nextBeatTime < ctx.currentTime + lookAheadSec) {
      playMetronomeTick(beat === 0, nextBeatTime);
      beat = (beat + 1) % beatsPerMeasure;
      nextBeatTime += beatSec;
    }
  }

  const id = setInterval(schedule, schedulerMs);
  schedule(); // première passe immédiate

  return () => clearInterval(id);
}

// Jouer un accord complet
/**
 * Durée pendant laquelle un accord continue de sonner.
 *
 * Exportée par `chordDurationMs` : une animation qui accompagne le son doit durer
 * ce que dure le son, et non une valeur recopiée à côté qui dériverait au premier
 * réglage.
 */
const DECAY_S = { piano: 1.8, cordes: 2.2 };

/** Combien de temps un accord de cet instrument reste audible, en millisecondes. */
export function chordDurationMs(instrumentId: InstrumentId): number {
  return DECAY_S[instrumentId === 'piano' ? 'piano' : 'cordes'] * 1000;
}

export function playChord(
  chord: StringChord | PianoChord,
  instrumentId: InstrumentId,
  capo = 0,
  /**
   * Instant d'attaque sur l'horloge audio. Par défaut : maintenant.
   *
   * La lecture d'une grille s'en sert pour poser l'accord à l'instant exact du
   * temps, et non au réveil de son minuteur : un `setTimeout` se réveille avec
   * quelques millisecondes de retard, variables, et cela s'entend contre une
   * batterie programmée à l'échantillon près.
   */
  when?: number,
): void {
  const ctx = getAudioContext();
  // Un instant déjà passé vaut « tout de suite » : le programmer tel quel ferait
  // sonner l'accord sans son enveloppe.
  const depart = Math.max(when ?? ctx.currentTime, ctx.currentTime);
  const isPiano = instrumentId === 'piano';

  // Couper l'accord précédent DE CET INSTRUMENT uniquement (les autres continuent),
  // au moment où celui-ci prend sa place et non à celui de la programmation.
  stopActiveChord(instrumentId, depart);

  const freqs = isPianoChord(chord)
    ? getPianoChordFrequencies(chord, capo)
    : getStringChordFrequencies(chord, instrumentId, capo);

  const strumDelay = isPiano ? 0.06 : 0.04;
  const decay = DECAY_S[isPiano ? 'piano' : 'cordes'];
  const vol = isPiano ? 0.22 : 0.28;

  if (isInstrumentSoundReady(instrumentId)) {
    const stopFns = freqs
      .map((freq, i) => playSampledNote(instrumentId, freqToMidi(freq), depart + i * strumDelay, decay))
      .filter((stop): stop is () => void => stop !== null);
    activeByInstrument.set(instrumentId, { nodes: [], stopFns });
    return;
  }

  const nodes: { osc: OscillatorNode; gain: GainNode }[] = [];

  freqs.forEach((freq, i) => {
    const t = depart + i * strumDelay;
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
    nodes.push({ osc, gain });
  });

  activeByInstrument.set(instrumentId, { nodes, stopFns: [] });
}

// Ordre montant-descendant sur les index des notes de l'accord :
// 3 notes -> [0,1,2,1], 4 notes -> [0,1,2,3,2,1].
function buildArpOrder(n: number): number[] {
  if (n <= 1) return [0];
  const order: number[] = [];
  for (let i = 0; i < n; i++) order.push(i);
  for (let i = n - 2; i >= 1; i--) order.push(i);
  return order;
}

// Jouer un accord en arpège : ses notes une par une, cadencées (stepMs), sur
// `steps` pas, motif montant-descendant. Utilisé en lecture (Play) pour un
// accompagnement qui suit le tempo. Les voix sont indexées par instrument comme
// playChord (chaque nouvel accord de l'instrument coupe l'arpège précédent).
export function playArpeggio(
  chord: StringChord | PianoChord,
  instrumentId: InstrumentId,
  capo = 0,
  stepMs = 250,
  steps = 8,
  /** Instant de la première note, sur l'horloge audio. Par défaut : maintenant. */
  when?: number,
): void {
  const ctx = getAudioContext();
  const depart = Math.max(when ?? ctx.currentTime, ctx.currentTime);
  const isPiano = instrumentId === 'piano';

  stopActiveChord(instrumentId, depart);

  const freqs = isPianoChord(chord)
    ? getPianoChordFrequencies(chord, capo)
    : getStringChordFrequencies(chord, instrumentId, capo);
  if (!freqs.length) return;

  const order = buildArpOrder(freqs.length);
  const noteDecay = isPiano ? 1.4 : 1.1;
  const vol = isPiano ? 0.24 : 0.3;
  const sampled = isInstrumentSoundReady(instrumentId);

  const nodes: { osc: OscillatorNode; gain: GainNode }[] = [];
  const stopFns: ((at?: number) => void)[] = [];

  for (let k = 0; k < steps; k++) {
    const t = depart + (k * stepMs) / 1000;
    const freq = freqs[order[k % order.length]];

    if (sampled) {
      const stop = playSampledNote(instrumentId, freqToMidi(freq), t, noteDecay);
      if (stop) stopFns.push(stop);
      continue;
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = isPiano ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + noteDecay);
    osc.start(t);
    osc.stop(t + noteDecay);
    nodes.push({ osc, gain });
  }

  activeByInstrument.set(instrumentId, { nodes, stopFns });
}
