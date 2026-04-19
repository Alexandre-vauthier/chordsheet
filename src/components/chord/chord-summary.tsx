'use client';

import { useMemo, useState } from 'react';
import type { Section, InstrumentId, StringChord, PianoChord } from '@/types';
import { ChordCard } from './chord-card';
import { useChordNotation } from '@/lib/use-chord-notation';
import { useLibraryChords, libraryKey } from '@/lib/library-chords-context';
import { findChordVariants, enharmonicEquivalent } from '@/lib/chord-data';
import { transposeChord } from '@/lib/transpose';

// Type pour les accords personnalisés stockés dans la grille
export type CustomChordMap = Record<string, StringChord | PianoChord>;

interface ChordSummaryProps {
  sections: Section[];
  instrumentId: InstrumentId;
  customChords?: CustomChordMap;
  onEditChord?: (chordName: string, currentChord: StringChord | PianoChord | null) => void;
  onDeleteCustomChord?: (chordName: string) => void;
  editable?: boolean;
  onVariantChange?: (chordName: string, chord: StringChord | PianoChord) => void;
  capo?: number;
  compact?: boolean;
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
  onVariantChange,
  capo = 0,
  compact = false,
}: ChordSummaryProps) {
  const translate = useChordNotation();
  const { overrides, additions } = useLibraryChords();

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
  const prevVariant = (chordName: string, allVariants: (StringChord | PianoChord)[]) => {
    const current = variantIndices[chordName] || 0;
    const next = current > 0 ? current - 1 : allVariants.length - 1;
    setVariantIndices(prev => ({ ...prev, [chordName]: next }));
    onVariantChange?.(chordName, allVariants[next]);
  };

  // Naviguer vers la variante suivante
  const nextVariant = (chordName: string, allVariants: (StringChord | PianoChord)[]) => {
    const current = variantIndices[chordName] || 0;
    const next = (current + 1) % allVariants.length;
    setVariantIndices(prev => ({ ...prev, [chordName]: next }));
    onVariantChange?.(chordName, allVariants[next]);
  };

  return (
    <div className="bg-[var(--cell-bg)] rounded-lg border border-[var(--line)] p-4">
      {!editable && (
        <h3 className="text-sm font-medium text-[var(--ink-light)] mb-3">
          Accords utilisés ({uniqueChords.length})
        </h3>
      )}
      <div className={`flex flex-wrap ${compact ? 'gap-2' : 'gap-4'}`}>
        {uniqueChords.map((chordName) => {
          // Pour le piano, le capo décale la hauteur → chercher l'accord transposé
          const lookupName = instrumentId === 'piano' && capo > 0
            ? transposeChord(chordName, capo)
            : chordName;

          // Chercher d'abord dans les accords personnalisés de la grille
          const customChordKey = `${lookupName.toLowerCase()}-${instrumentId}`;
          const customChord = customChords[customChordKey];

          // Overrides admin (Firestore) — fallback enharmonique (C# → Db)
          const key = libraryKey(lookupName, instrumentId);
          const enh = enharmonicEquivalent(lookupName);
          const enhKey = enh ? libraryKey(enh, instrumentId) : null;
          const adminOverride = overrides.get(key) ?? (enhKey ? overrides.get(enhKey) : undefined);
          const staticVariants = findChordVariants(lookupName, instrumentId);
          const nameLower = lookupName.trim().toLowerCase();
          const enhLower = enh?.trim().toLowerCase();
          const adminAdditions = additions
            .filter(a =>
              a.instrumentId === instrumentId &&
              (a.chord.name.trim().toLowerCase() === nameLower ||
               (enhLower && a.chord.name.trim().toLowerCase() === enhLower))
            )
            .map(a => a.chord);

          // Construire la liste de toutes les variantes disponibles (sans doublons par id)
          // Ne pas réordonner si customChord vient de la bibliothèque (juste une sélection)
          const allVariants: (StringChord | PianoChord)[] = [];
          const seenIds = new Set<string>();
          const addVariant = (c: StringChord | PianoChord) => {
            if (!seenIds.has(c.id)) { seenIds.add(c.id); allVariants.push(c); }
          };
          if (adminOverride) {
            addVariant(adminOverride.chord);
            adminAdditions.forEach(addVariant);
          } else {
            adminAdditions.forEach(addVariant);
            staticVariants.forEach(addVariant);
          }
          // Ajouter customChord seulement s'il n'est pas déjà dans la liste (accord vraiment custom)
          if (customChord && !seenIds.has(customChord.id)) {
            allVariants.unshift(customChord);
          }

          // Si pas encore navigué, initialiser sur la position du customChord sauvegardé
          const currentIndex = variantIndices[chordName] !== undefined
            ? variantIndices[chordName]
            : customChord
              ? Math.max(0, allVariants.findIndex(v => v.id === customChord.id))
              : 0;
          const currentChord = allVariants[currentIndex] || null;
          const hasMultipleVariants = allVariants.length > 1;

          if (!currentChord) {
            // Accord non trouvé - afficher bouton pour créer
            return (
              <div
                key={chordName}
                className="flex flex-col items-center"
              >
                <div className="flex flex-col items-center p-3 bg-[var(--cell-bg)] rounded-lg border border-dashed border-[var(--line)] min-w-[90px]">
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
              {/* Navigation variantes — toujours rendu pour uniformiser la hauteur */}
              <div className={`flex items-center gap-2 mb-1 ${hasMultipleVariants ? '' : 'invisible'}`}>
                <button
                  onClick={() => prevVariant(chordName, allVariants)}
                  className="w-5 h-5 flex items-center justify-center text-xs text-[var(--ink-light)] hover:text-[var(--ink)] hover:bg-[var(--line)] rounded"
                >
                  ‹
                </button>
                <span className="text-[10px] text-[var(--ink-faint)]">
                  {currentIndex + 1}/{allVariants.length}
                </span>
                <button
                  onClick={() => nextVariant(chordName, allVariants)}
                  className="w-5 h-5 flex items-center justify-center text-xs text-[var(--ink-light)] hover:text-[var(--ink)] hover:bg-[var(--line)] rounded"
                >
                  ›
                </button>
              </div>

              {/* Carte de l'accord */}
              <ChordCard
                chord={currentChord}
                instrumentId={instrumentId}
                size={compact && instrumentId !== 'piano' ? 'xs' : 'sm'}
                displayName={translate(lookupName)}
              />

              {/* Badge si c'est un accord personnalisé */}
              {customChord && currentChord?.id === customChord.id && (
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
