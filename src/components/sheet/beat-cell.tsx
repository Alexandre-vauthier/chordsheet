'use client';

import { useState, useRef, useEffect } from 'react';
import type { Cell, InstrumentId } from '@/types';
import { ChordSuggestions } from '@/components/chord';
import { useChordNotation } from '@/lib/use-chord-notation';
import { useChordColor } from '@/lib/use-chord-color';

interface BeatCellProps {
  cell: Cell;
  cols: number;
  instrumentId: InstrumentId;
  onChordChange: (chord: string) => void;
  canSplit: boolean;
  onSplit: () => void;
  onNavigateNext: () => void;
  isActive?: boolean;
  activeDurationMs?: number;
}

export function BeatCell({
  cell,
  cols,
  instrumentId,
  onChordChange,
  canSplit,
  onSplit,
  onNavigateNext,
  isActive = false,
  activeDurationMs = 0,
}: BeatCellProps) {
  const translate = useChordNotation();
  const getColor = useChordColor();
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(cell.chord);
  const [chordError, setChordError] = useState(false);
  const [showDiagram, setShowDiagram] = useState(false);

  const FORBIDDEN_CHARS = /[-*]/;

  const handleChordInput = (raw: string) => {
    // Majuscule sur la première lettre
    const normalized = raw.length > 0 ? raw.charAt(0).toUpperCase() + raw.slice(1) : raw;
    if (FORBIDDEN_CHARS.test(normalized)) {
      setChordError(true);
      setValue(normalized);
    } else {
      setChordError(false);
      setValue(normalized);
    }
  };
  const inputRef = useRef<HTMLInputElement>(null);
  const cellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setValue(cell.chord);
  }, [cell.chord]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Fermer le diagramme quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (cellRef.current && !cellRef.current.contains(e.target as Node)) {
        setShowDiagram(false);
      }
    };
    if (showDiagram) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDiagram]);

  const handleClick = () => {
    setIsEditing(true);
    setShowDiagram(false);
  };

  const handleBlur = () => {
    setIsEditing(false);
    setChordError(false);
    if (!FORBIDDEN_CHARS.test(value) && value !== cell.chord) {
      onChordChange(value);
    } else if (FORBIDDEN_CHARS.test(value)) {
      setValue(cell.chord); // revenir à la valeur précédente
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      handleBlur();
      onNavigateNext();
    }
    if (e.key === 'Escape') {
      setValue(cell.chord);
      setIsEditing(false);
    }
  };

  const toggleDiagram = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDiagram(!showDiagram);
  };

  const isSmall = cell.span <= 0.5;
  const color = getColor(cell.chord);

  return (
    <div ref={cellRef} className="flex flex-col relative" style={{ gridColumn: `span ${cols}` }}>
      {/* Cellule */}
      <div
        onClick={handleClick}
        style={color && !isEditing ? { borderLeftColor: color.border, borderLeftWidth: '5px' } : undefined}
        className={`
          relative rounded-lg border-[1.5px] min-h-14 flex items-center justify-center cursor-pointer
          transition-all duration-150 select-none
          ${isEditing
            ? 'bg-[var(--cell-active)] border-[var(--accent)] shadow-[0_0_0_3px_rgba(200,75,47,0.12)]'
            : cell.chord
              ? 'bg-[var(--cell-bg)] border-[#8a7a6a] hover:bg-[var(--cell-hover)]'
              : 'bg-[var(--cell-bg)] border-[var(--line)] hover:bg-[var(--cell-hover)] hover:border-[var(--ink-faint)]'
          }
          ${isSmall ? 'bg-[#f7f3ec] border-[var(--ink-faint)]' : ''}
          ${isActive ? 'border-[var(--accent)]' : ''}
        `}
      >
        {/* Sweep animation pendant la lecture */}
        {isActive && activeDurationMs > 0 && (
          <div
            className="absolute inset-0 origin-left pointer-events-none rounded-[inherit]"
            style={{
              background: 'rgba(200,75,47,0.13)',
              animation: `beatSweep ${activeDurationMs}ms linear forwards`,
            }}
          />
        )}

        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => handleChordInput(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder="—"
            className={`
              font-mono font-medium text-[var(--ink)] bg-transparent border-none outline-none
              text-center w-full px-1 caret-[var(--accent)]
              ${isSmall ? 'text-[0.82rem]' : 'text-[1.05rem]'}
            `}
          />
        ) : (
          <span
            className={`
              font-mono font-medium text-[var(--ink)] pointer-events-none
              ${isSmall ? 'text-[0.82rem]' : 'text-[1.05rem]'}
            `}
          >
            {translate(cell.chord) || ''}
          </span>
        )}

        {isSmall && (
          <span className="absolute bottom-[3px] left-1 text-[8px] text-[var(--ink-faint)] font-mono pointer-events-none">
            {cell.span === 0.25 ? '¼' : '½'}
          </span>
        )}

        {/* Bouton pour afficher le diagramme */}
        {cell.chord && !isEditing && (
          <button
            onClick={toggleDiagram}
            className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded bg-[var(--paper)] hover:bg-[var(--line)] text-[var(--ink-faint)] hover:text-[var(--ink-light)] text-xs transition-colors"
            title="Voir le diagramme"
          >
            ♫
          </button>
        )}
      </div>

      {/* Message erreur accord invalide */}
      {chordError && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-20
          bg-[var(--ink)] text-white text-[11px] rounded-lg px-3 py-2 shadow-lg
          whitespace-nowrap text-center leading-snug">
          Utilise la notation Am, G7, Cmaj7…
          <br />
          <a href="/chords" className="underline opacity-80 hover:opacity-100" target="_blank">
            Voir la bibliothèque d&apos;accords
          </a>
        </div>
      )}

      {/* Diagramme d'accord */}
      {showDiagram && cell.chord && (
        <ChordSuggestions
          chordName={cell.chord}
          instrumentId={instrumentId}
          position="bottom"
        />
      )}

      {/* Bouton diviser — centré en bas de la cellule, en absolute */}
      {canSplit && (
        <button
          onClick={(e) => { e.stopPropagation(); onSplit(); }}
          title="Diviser"
          className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 z-10
            w-5 h-5 flex items-center justify-center rounded-full
            bg-[var(--cell-bg)] border border-[var(--line)] text-[var(--ink-faint)]
            cursor-pointer transition-all text-[10px] leading-none
            opacity-0 group-hover/row:opacity-100
            hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] hover:border-[var(--accent)]"
        >
          /
        </button>
      )}
    </div>
  );
}
