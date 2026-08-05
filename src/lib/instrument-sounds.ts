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
/** Chargements en cours, pour pouvoir les attendre plutôt que de jouer un bip. */
const chargements = new Map<InstrumentId, Promise<boolean>>();

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
  const chargement = instance.load
    .then(() => { readyInstruments.add(instrumentId); return true; })
    .catch(() => { instances.delete(instrumentId); chargements.delete(instrumentId); return false; });
  chargements.set(instrumentId, chargement);
}

/**
 * Le même chargement, mais attendable.
 *
 * Sans cela, jouer un accord avant la fin du téléchargement retombait sur
 * l'oscillateur de secours : un bip, là où la page promet le son de l'instrument.
 * Le repli garde son utilité quand aucun échantillon n'existe (la voix), pas
 * quand il suffisait d'attendre une seconde.
 */
export function chargerInstrumentSound(ctx: AudioContext, instrumentId: InstrumentId): Promise<boolean> {
  if (readyInstruments.has(instrumentId)) return Promise.resolve(true);
  preloadInstrumentSound(ctx, instrumentId);
  return chargements.get(instrumentId) ?? Promise.resolve(false);
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
