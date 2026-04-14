'use client';

import { useState, useRef, useEffect } from 'react';
import type { StringChord, PianoChord, InstrumentId } from '@/types';
import { isPianoChord } from '@/types';
import { useChordVariants } from '@/lib/use-chord-variants';
import { ChordDiagram } from './chord-diagram';
import { PianoKeyboard } from './piano-keyboard';
import { INSTRUMENT_CONFIG } from '@/lib/chord-data';
import { playChord } from '@/lib/chord-audio';

interface ChordSuggestionsProps {
  chordName: string;
  instrumentId: InstrumentId;
  customChord?: StringChord | PianoChord | null;
  onSelectVariant?: (chord: StringChord | PianoChord) => void;
  position?: 'top' | 'bottom';
  capo?: number;
}

export function ChordSuggestions({
  chordName,
  instrumentId,
  customChord,
  onSelectVariant,
  position = 'bottom',
  capo = 0,
}: ChordSuggestionsProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Variantes depuis bibliothèque (statique + overrides Firestore)
  const libraryVariants = useChordVariants(chordName, instrumentId);

  // L'accord custom de la grille est prioritaire sur tout
  const variants = customChord
    ? [customChord, ...libraryVariants.filter(v => v.id !== customChord.id)]
    : libraryVariants;

  // Reset l'index quand le nom change
  useEffect(() => {
    setCurrentIndex(0);
  }, [chordName, instrumentId]);

  if (variants.length === 0) return null;

  const instrument = INSTRUMENT_CONFIG[instrumentId];
  const currentChord = variants[currentIndex];
  const hasMultipleVariants = variants.length > 1;

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? variants.length - 1 : prev - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === variants.length - 1 ? 0 : prev + 1));
  };

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    playChord(currentChord, instrumentId, capo);
  };

  const handleSelect = () => {
    onSelectVariant?.(currentChord);
  };

  return (
    <div
      ref={containerRef}
      className={`absolute ${position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'} left-1/2 -translate-x-1/2 z-50`}
    >
      <div className="bg-[var(--cell-bg)] rounded-xl shadow-lg border border-[var(--line)] p-3 min-w-[140px]">
        {/* Diagramme */}
        <div
          className="flex justify-center cursor-pointer"
          onClick={handleSelect}
          title="Cliquer pour sélectionner"
        >
          {isPianoChord(currentChord) ? (
            <PianoKeyboard chord={currentChord} />
          ) : (
            <ChordDiagram
              chord={currentChord}
              size="sm"
              numStrings={instrument.strings}
            />
          )}
        </div>

        {/* Nom de l'accord */}
        <div className="text-center mt-2">
          <span className="text-sm font-medium text-[var(--ink)]">
            {chordName}
          </span>
          {currentChord.full && (
            <span className="text-xs text-[var(--ink-faint)] block">
              {currentChord.full}
            </span>
          )}
        </div>

        {/* Navigation et actions */}
        <div className="flex items-center justify-center gap-2 mt-3">
          {/* Navigation entre variantes */}
          {hasMultipleVariants && (
            <>
              <button
                onClick={handlePrev}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-[var(--paper)] hover:bg-[var(--line)] transition-colors text-[var(--ink-light)]"
              >
                ‹
              </button>
              <span className="text-xs text-[var(--ink-faint)]">
                {currentIndex + 1}/{variants.length}
              </span>
              <button
                onClick={handleNext}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-[var(--paper)] hover:bg-[var(--line)] transition-colors text-[var(--ink-light)]"
              >
                ›
              </button>
            </>
          )}

          {/* Bouton play */}
          <button
            onClick={handlePlay}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-[var(--nav-bg)] text-white hover:bg-[var(--ink-light)] transition-colors text-sm"
            title="Écouter l'accord"
          >
            ▶
          </button>
        </div>
      </div>

      {/* Flèche pointant vers la cellule */}
      <div
        className={`absolute left-1/2 -translate-x-1/2 w-3 h-3 bg-[var(--cell-bg)] border-[var(--line)] transform rotate-45 ${
          position === 'top'
            ? '-bottom-1.5 border-r border-b'
            : '-top-1.5 border-l border-t'
        }`}
      />
    </div>
  );
}
