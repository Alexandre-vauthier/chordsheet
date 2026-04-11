import { useMemo } from 'react';
import { useLibraryChords, libraryKey } from './library-chords-context';
import { findChordVariants, enharmonicEquivalent } from './chord-data';
import type { StringChord, PianoChord, InstrumentId } from '@/types';

/**
 * Variantes d'un accord en tenant compte des overrides/ajouts de la bibliothèque Firestore.
 * Priorité : override admin > ajouts admin > bibliothèque statique
 * Gère les alias enharmoniques (C# ↔ Db, etc.)
 */
export function useChordVariants(
  name: string,
  instrumentId: InstrumentId,
): (StringChord | PianoChord)[] {
  const { overrides, additions } = useLibraryChords();

  return useMemo(() => {
    if (!name.trim()) return [];

    // Chercher l'override par nom direct OU nom enharmonique
    const key = libraryKey(name, instrumentId);
    const enh = enharmonicEquivalent(name);
    const enhKey = enh ? libraryKey(enh, instrumentId) : null;
    const override = overrides.get(key) ?? (enhKey ? overrides.get(enhKey) : undefined);

    const staticVariants = findChordVariants(name, instrumentId);

    // Ajouts correspondant au nom saisi (direct ou enharmonique)
    const nameLower = name.trim().toLowerCase();
    const enhLower = enh?.trim().toLowerCase();
    const matchingAdditions = additions
      .filter(
        (a) =>
          a.instrumentId === instrumentId &&
          (a.chord.name.trim().toLowerCase() === nameLower ||
           (enhLower && a.chord.name.trim().toLowerCase() === enhLower)),
      )
      .map((a) => a.chord);

    if (override) {
      // L'override remplace la variante de base, les ajouts viennent après
      return [override.chord, ...matchingAdditions];
    }

    // Les ajouts enrichissent la liste, la variante statique de base reste en [0]
    return [...staticVariants, ...matchingAdditions];
  }, [name, instrumentId, overrides, additions]);
}
