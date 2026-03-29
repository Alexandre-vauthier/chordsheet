'use client';

import { useMemo } from 'react';
import type { Section, InstrumentId } from '@/types';
import { ChordCard } from './chord-card';
import { findChordByName } from '@/lib/chord-data';

interface ChordSummaryProps {
  sections: Section[];
  instrumentId: InstrumentId;
}

/**
 * Affiche un rappel des accords utilisés dans la grille
 * - Sans doublons
 * - Dans l'ordre de première apparition
 * - Avec possibilité de jouer chaque accord
 */
export function ChordSummary({ sections, instrumentId }: ChordSummaryProps) {
  // Extraire les accords uniques dans l'ordre de première apparition
  const uniqueChords = useMemo(() => {
    const seen = new Set<string>();
    const chords: string[] = [];

    for (const section of sections) {
      for (const row of section.rows) {
        for (const cell of row) {
          const chord = cell.chord.trim();
          if (chord && !seen.has(chord.toLowerCase())) {
            seen.add(chord.toLowerCase());
            chords.push(chord);
          }
        }
      }
    }

    return chords;
  }, [sections]);

  if (uniqueChords.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg border border-[var(--line)] p-4">
      <h3 className="text-sm font-medium text-[var(--ink-light)] mb-3">
        Accords utilisés ({uniqueChords.length})
      </h3>
      <div className="flex flex-wrap gap-3">
        {uniqueChords.map((chordName) => {
          const chordData = findChordByName(chordName, instrumentId);

          if (!chordData) {
            // Accord non trouvé dans la bibliothèque - afficher juste le nom
            return (
              <div
                key={chordName}
                className="flex flex-col items-center p-2 bg-gray-50 rounded-lg border border-dashed border-[var(--line)] min-w-[80px]"
              >
                <span className="font-mono text-sm font-medium text-[var(--ink)]">
                  {chordName}
                </span>
                <span className="text-[10px] text-[var(--ink-faint)] mt-1">
                  Non trouvé
                </span>
              </div>
            );
          }

          return (
            <ChordCard
              key={chordName}
              chord={chordData}
              instrumentId={instrumentId}
              size="sm"
            />
          );
        })}
      </div>
    </div>
  );
}
