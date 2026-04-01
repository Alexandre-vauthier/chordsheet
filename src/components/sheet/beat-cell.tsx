'use client';

import { useState, useRef, useEffect } from 'react';
import type { Cell, CellSpan, InstrumentId } from '@/types';
import { ChordSuggestions } from '@/components/chord';

interface BeatCellProps {
  cell: Cell;
  instrumentId: InstrumentId;
  onChordChange: (chord: string) => void;
  onSplit: () => void;
  onExtend: () => void;
  onExtendToFullLine: () => void;
  onUnmerge: () => void;
  onJoin: () => void;
  onClear: () => void;
  canSplit: boolean;
  canExtend: boolean;
  canExtendToFullLine: boolean;
  canUnmerge: boolean;
  canJoin: boolean;
  onNavigateNext: () => void;
}

const spanToGridCols: Record<CellSpan, number> = {
  0.5: 1,
  1: 2,
  2: 4,
  3: 6,  // Ligne complète en 3/4
  4: 8,  // Ligne complète en 4/4
};

export function BeatCell({
  cell,
  instrumentId,
  onChordChange,
  onSplit,
  onExtend,
  onExtendToFullLine,
  onUnmerge,
  onJoin,
  onClear,
  canSplit,
  canExtend,
  canExtendToFullLine,
  canUnmerge,
  canJoin,
  onNavigateNext,
}: BeatCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(cell.chord);
  const [showDiagram, setShowDiagram] = useState(false);
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
    if (value !== cell.chord) {
      onChordChange(value);
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

  const cols = spanToGridCols[cell.span];
  const isHalf = cell.span === 0.5;

  return (
    <div ref={cellRef} className="flex flex-col relative" style={{ gridColumn: `span ${cols}` }}>
      {/* Cellule */}
      <div
        onClick={handleClick}
        className={`
          relative rounded-lg border-[1.5px] min-h-14 flex items-center justify-center cursor-pointer
          transition-all duration-150 select-none
          ${isEditing
            ? 'bg-[var(--cell-active)] border-[var(--accent)] shadow-[0_0_0_3px_rgba(200,75,47,0.12)]'
            : cell.chord
              ? 'bg-[var(--cell-bg)] border-[#8a7a6a] hover:bg-[var(--cell-hover)]'
              : 'bg-[var(--cell-bg)] border-[var(--line)] hover:bg-[var(--cell-hover)] hover:border-[var(--ink-faint)]'
          }
          ${isHalf ? 'bg-[#f7f3ec] border-[var(--ink-faint)]' : ''}
        `}
      >
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder="—"
            className={`
              font-mono font-medium text-[var(--ink)] bg-transparent border-none outline-none
              text-center w-full px-1 caret-[var(--accent)]
              ${isHalf ? 'text-[0.82rem]' : 'text-[1.05rem]'}
            `}
          />
        ) : (
          <span
            className={`
              font-mono font-medium text-[var(--ink)] pointer-events-none
              ${isHalf ? 'text-[0.82rem]' : 'text-[1.05rem]'}
            `}
          >
            {cell.chord || ''}
          </span>
        )}

        {isHalf && (
          <span className="absolute bottom-[3px] left-1 text-[8px] text-[var(--ink-faint)] font-mono pointer-events-none">
            ½
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

      {/* Diagramme d'accord */}
      {showDiagram && cell.chord && (
        <ChordSuggestions
          chordName={cell.chord}
          instrumentId={instrumentId}
          position="bottom"
        />
      )}

      {/* Actions */}
      <div className="flex gap-1 justify-center flex-wrap mt-1">
        {canSplit && (
          <ActionButton onClick={onSplit} title="Couper en 2 demi-temps">
            ÷½
          </ActionButton>
        )}
        {canExtend && (
          <ActionButton onClick={onExtend} title="Étendre à 2 temps">
            →2
          </ActionButton>
        )}
        {canExtendToFullLine && (
          <ActionButton onClick={onExtendToFullLine} title="Étendre sur toute la ligne">
            →∞
          </ActionButton>
        )}
        {canUnmerge && (
          <ActionButton onClick={onUnmerge} title="Diviser en temps simples">
            ÷1
          </ActionButton>
        )}
        {canJoin && (
          <ActionButton onClick={onJoin} title="Fusionner en 1 temps">
            →1
          </ActionButton>
        )}
        {cell.chord && (
          <ActionButton onClick={onClear} title="Effacer" isDanger>
            ✕
          </ActionButton>
        )}
      </div>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  title,
  isDanger = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  isDanger?: boolean;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={title}
      className={`
        bg-white border-[1.5px] border-[var(--line)] rounded-[5px] px-[7px] py-[3px]
        font-mono text-[0.7rem] font-medium text-[var(--ink-light)]
        cursor-pointer whitespace-nowrap transition-all duration-150 leading-[1.4]
        ${isDanger
          ? 'hover:bg-red-50 hover:text-red-600 hover:border-red-300'
          : 'hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] hover:border-[var(--accent)]'
        }
      `}
    >
      {children}
    </button>
  );
}
