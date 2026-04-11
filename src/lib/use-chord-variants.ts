import { useMemo } from 'react';
import { useLibraryChords, libraryKey } from './library-chords-context';
import { findChordVariants } from './chord-data';
import type { StringChord, PianoChord, InstrumentId } from '@/types';

/**
 * Variantes d'un accord en tenant compte des overrides/ajouts de la bibliothèque Firestore.
 * Priorité : override admin > bibliothèque statique
 * Les ajouts apparaissent si leur nom correspond.
 */
export function useChordVariants(
  name: string,
  instrumentId: InstrumentId,
): (StringChord | PianoChord)[] {
  const { overrides, additions } = useLibraryChords();

  return useMemo(() => {
    if (!name.trim()) return [];

    const key = libraryKey(name, instrumentId);
    const override = overrides.get(key);
    const staticVariants = findChordVariants(name, instrumentId);

    // Ajouts correspondant au nom saisi
    const matchingAdditions = additions
      .filter(
        (a) =>
          a.instrumentId === instrumentId &&
          a.chord.name.trim().toLowerCase() === name.trim().toLowerCase(),
      )
      .map((a) => a.chord);

    if (override) {
      // L'override remplace la première variante statique ; les suivantes restent disponibles
      return [override.chord, ...matchingAdditions, ...staticVariants];
    }

    return [...matchingAdditions, ...staticVariants];
  }, [name, instrumentId, overrides, additions]);
}
