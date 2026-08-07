'use client';

import { useMemo } from 'react';
import { ChordFinder } from '@/components/chord/chord-finder';
import { useLibraryChords } from '@/lib/library-chords-context';
import { chordVariants } from '@/lib/use-chord-variants';
import { getChordsByInstrument, getAllExtendedChords } from '@/lib/chord-data';
import { useAuth } from '@/lib/auth-context';
import { INSTRUMENTS, type InstrumentId, type StringChord, type PianoChord } from '@/types';

/** Les instruments qui ont un manche ou un clavier : la voix n'a rien à chercher. */
const CHERCHABLES: InstrumentId[] = INSTRUMENTS.filter((i) => i !== 'voice');

/**
 * Le chercheur, en page.
 *
 * Il reçoit la même réserve d'accords que la fenêtre de la bibliothèque, surcharges
 * et ajouts compris : chercher par les notes doit rendre le doigté qu'on verra
 * ensuite, pas celui d'origine.
 */
export function ChordFinderClient() {
  const { user } = useAuth();
  const { overrides, additions } = useLibraryChords();

  const pool = useMemo(() => {
    const out = {} as Record<InstrumentId, (StringChord | PianoChord)[]>;
    for (const id of CHERCHABLES) {
      const noms = new Set([
        ...getChordsByInstrument(id).map((c) => c.name),
        ...getAllExtendedChords(id).map((c) => c.name),
      ]);
      out[id] = [...noms].flatMap((nom) => chordVariants(nom, id, overrides, additions));
    }
    return out;
  }, [overrides, additions]);

  return (
    <ChordFinder
      variante="page"
      initialInstrument={user?.preferredInstrument ?? 'guitar'}
      allChords={pool}
    />
  );
}
