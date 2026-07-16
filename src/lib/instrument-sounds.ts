'use client';

import { Soundfont, SplendidGrandPiano } from 'smplr';
import type { InstrumentId } from '@/types';

interface SmplrInstance {
  load: Promise<unknown>;
  start: (event: { note: number; time: number; duration?: number; velocity?: number }) => (time?: number) => void;
}

// Un seul échantillon General MIDI par instrument de l'app. Ukulélé et mandoline n'ont pas
// d'échantillon dédié dans les bibliothèques libres trouvées (WebAudioFont, smplr, VCSL) —
// approximés par la guitare nylon la plus proche, limitation assumée.
const SOUNDFONT_PRESET: Partial<Record<InstrumentId, string>> = {
  guitar: 'acoustic_guitar_steel',
  ukulele: 'acoustic_guitar_nylon',
  mandolin: 'acoustic_guitar_nylon',
  banjo: 'banjo',
  bass: 'electric_bass_finger',
};

const instances = new Map<InstrumentId, SmplrInstance>();
const readyInstruments = new Set<InstrumentId>();

// Déclenche le chargement de l'instrument échantillonné (idempotent). Ne fait rien pour
// 'voice'/'percussion' (aucune donnée d'accord pour ces instruments) ni si déjà en cours/chargé.
export function preloadInstrumentSound(ctx: AudioContext, instrumentId: InstrumentId): void {
  if (instances.has(instrumentId)) return;

  let instance: SmplrInstance;
  if (instrumentId === 'piano') {
    instance = SplendidGrandPiano(ctx) as unknown as SmplrInstance;
  } else {
    const preset = SOUNDFONT_PRESET[instrumentId];
    if (!preset) return;
    instance = Soundfont(ctx, { instrument: preset }) as unknown as SmplrInstance;
  }

  instances.set(instrumentId, instance);
  instance.load
    .then(() => { readyInstruments.add(instrumentId); })
    .catch(() => { instances.delete(instrumentId); });
}

export function isInstrumentSoundReady(instrumentId: InstrumentId): boolean {
  return readyInstruments.has(instrumentId);
}

// Joue une note échantillonnée. `atTime` en secondes, sur l'horloge de l'AudioContext
// (mêmes conventions que le reste de chord-audio.ts). Renvoie une fonction pour l'arrêter.
export function playSampledNote(
  instrumentId: InstrumentId,
  midiNote: number,
  atTime: number,
  duration: number,
): (() => void) | null {
  const instance = instances.get(instrumentId);
  if (!instance || !readyInstruments.has(instrumentId)) return null;
  const stop = instance.start({ note: midiNote, time: atTime, duration });
  return () => stop();
}
