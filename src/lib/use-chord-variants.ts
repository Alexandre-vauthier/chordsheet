import { useMemo } from 'react';
import { useLibraryChords, libraryKey } from './library-chords-context';
import { findChordVariants, enharmonicEquivalent } from './chord-data';
import type { StringChord, PianoChord, InstrumentId } from '@/types';

type Overrides = Map<string, { chord: StringChord | PianoChord }>;
type Additions = { instrumentId: InstrumentId; chord: StringChord | PianoChord }[];

/**
 * Variantes d'un accord, dans l'ordre où on veut les proposer.
 *
 * Un **override** remplace le doigté de la bibliothèque ; un **ajout** vient en
 * plus, après lui. La distinction se perd facilement : la lecture d'une grille en
 * avait sa propre copie qui préférait l'ajout au doigté de la bibliothèque, si
 * bien qu'on entendait autre chose que ce que la grille affichait. La règle vit
 * ici désormais, et les deux chemins l'appellent.
 *
 * Les alias enharmoniques sont pris en compte : un override posé sur « C# »
 * s'applique à « Db ».
 */
export function chordVariants(
  name: string,
  instrumentId: InstrumentId,
  overrides: Overrides,
  additions: Additions,
): (StringChord | PianoChord)[] {
  {
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
  }
}

/** La même règle, branchée sur la bibliothèque Firestore. */
export function useChordVariants(
  name: string,
  instrumentId: InstrumentId,
): (StringChord | PianoChord)[] {
  const { overrides, additions } = useLibraryChords();
  return useMemo(
    () => chordVariants(name, instrumentId, overrides, additions),
    [name, instrumentId, overrides, additions],
  );
}
