'use client';

import { useMemo, useState } from 'react';
import type { Section, InstrumentId, StringChord, PianoChord } from '@/types';
import { ChordCard } from './chord-card';
import { findChordVariants } from '@/lib/chord-data';
import { useChordNotation } from '@/lib/use-chord-notation';

// Type pour les accords personnalisés stockés dans la grille
export type CustomChordMap = Record<string, StringChord | PianoChord>;

interface ChordSummaryProps {
  sections: Section[];
  instrumentId: InstrumentId;
  customChords?: CustomChordMap;
  onEditChord?: (chordName: string, currentChord: StringChord | PianoChord | null) => void;
  onDeleteCustomChord?: (chordName: string) => void;
  editable?: boolean;
}

/**
 * Affiche un rappel des accords utilisés dans la grille
 * - Sans doublons
 * - Dans l'ordre de première apparition
 * - Avec possibilité de jouer chaque accord
 * - Navigation entre variantes
 * - Bouton modifier (si editable)
 */
export function ChordSummary({
  sections,
  instrumentId,
  customChords = {},
  onEditChord,
  onDeleteCustomChord,
  editable = false,
}: ChordSummaryProps) {
  const translate = useChordNotation();

  // État pour les indices de variante sélectionnée par accord
  const [variantIndices, setVariantIndices] = useState<Record<string, number>>({});

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

  // Naviguer vers la variante précédente
  const prevVariant = (chordName: string, totalVariants: number) => {
    setVariantIndices(prev => {
      const current = prev[chordName] || 0;
      return { ...prev, [chordName]: current > 0 ? current - 1 : totalVariants - 1 };
    });
  };

  // Naviguer vers la variante suivante
  const nextVariant = (chordName: string, totalVariants: number) => {
    setVariantIndices(prev => {
      const current = prev[chordName] || 0;
      return { ...prev, [chordName]: (current + 1) % totalVariants };
    });
  };

  return (
    <div className="bg-white rounded-lg border border-[var(--line)] p-4">
      {!editable && (
        <h3 className="text-sm font-medium text-[var(--ink-light)] mb-3">
          Accords utilisés ({uniqueChords.length})
        </h3>
      )}
      <div className="flex flex-wrap gap-4">
        {uniqueChords.map((chordName) => {
          // Chercher d'abord dans les accords personnalisés de la grille
          const customChordKey = `${chordName.toLowerCase()}-${instrumentId}`;
          const customChord = customChords[customChordKey];

          // Chercher toutes les variantes dans la bibliothèque
          const libraryVariants = findChordVariants(chordName, instrumentId);

          // Construire la liste de toutes les variantes disponibles
          const allVariants: (StringChord | PianoChord)[] = [];
          if (customChord) {
            allVariants.push(customChord);
          }
          allVariants.push(...libraryVariants);

          const currentIndex = variantIndices[chordName] || 0;
          const currentChord = allVariants[currentIndex] || null;
          const hasMultipleVariants = allVariants.length > 1;

          if (!currentChord) {
            // Accord non trouvé - afficher bouton pour créer
            return (
              <div
                key={chordName}
                className="flex flex-col items-center"
              >
                <div className="flex flex-col items-center p-3 bg-gray-50 rounded-lg border border-dashed border-[var(--line)] min-w-[90px]">
                  <span className="font-mono text-sm font-medium text-[var(--ink)]">
                    {translate(chordName)}
                  </span>
                  <span className="text-[10px] text-[var(--ink-faint)] mt-1">
                    Non trouvé
                  </span>
                </div>
                {editable && onEditChord && (
                  <button
                    onClick={() => onEditChord(chordName, null)}
                    className="mt-2 text-xs text-[var(--accent)] hover:underline"
                  >
                    + Créer
                  </button>
                )}
              </div>
            );
          }

          return (
            <div key={chordName} className="flex flex-col items-center">
              {/* Navigation variantes */}
              {hasMultipleVariants && (
                <div className="flex items-center gap-2 mb-1">
                  <button
                    onClick={() => prevVariant(chordName, allVariants.length)}
                    className="w-5 h-5 flex items-center justify-center text-xs text-[var(--ink-light)] hover:text-[var(--ink)] hover:bg-gray-100 rounded"
                  >
                    ‹
                  </button>
                  <span className="text-[10px] text-[var(--ink-faint)]">
                    {currentIndex + 1}/{allVariants.length}
                  </span>
                  <button
                    onClick={() => nextVariant(chordName, allVariants.length)}
                    className="w-5 h-5 flex items-center justify-center text-xs text-[var(--ink-light)] hover:text-[var(--ink)] hover:bg-gray-100 rounded"
                  >
                    ›
                  </button>
                </div>
              )}

              {/* Carte de l'accord */}
              <ChordCard
                chord={currentChord}
                instrumentId={instrumentId}
                size="sm"
              />

              {/* Badge si c'est un accord personnalisé */}
              {currentIndex === 0 && customChord && (
                <span className="text-[9px] text-[var(--accent)] mt-1">personnalisé</span>
              )}

              {/* Boutons modifier / supprimer */}
              {editable && (
                <div className="flex gap-2 mt-2">
                  {onEditChord && (
                    <button
                      onClick={() => onEditChord(chordName, currentChord)}
                      className="text-xs text-[var(--ink-light)] hover:text-[var(--accent)] hover:underline"
                    >
                      Modifier
                    </button>
                  )}
                  {onDeleteCustomChord && customChord && (
                    <button
                      onClick={() => onDeleteCustomChord(chordName)}
                      className="text-xs text-[var(--ink-faint)] hover:text-red-500 hover:underline"
                      title="Supprimer la version personnalisée"
                    >
                      Supprimer
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
