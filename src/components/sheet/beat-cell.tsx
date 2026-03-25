'use client';

import { useState, useRef, useEffect } from 'react';
import type { Cell, CellSpan } from '@/types';

interface BeatCellProps {
  cell: Cell;
  onChordChange: (chord: string) => void;
  onSplit: () => void;
  onExtend: () => void;
  onUnmerge: () => void;
  onJoin: () => void;
  onClear: () => void;
  canSplit: boolean;
  canExtend: boolean;
  canUnmerge: boolean;
  canJoin: boolean;
  onNavigateNext: () => void;
}

const spanToGridCols: Record<CellSpan, number> = {
  0.5: 1,
  1: 2,
  2: 4,
};

export function BeatCell({
  cell,
  onChordChange,
  onSplit,
  onExtend,
  onUnmerge,
  onJoin,
  onClear,
  canSplit,
  canExtend,
  canUnmerge,
  canJoin,
  onNavigateNext,
}: BeatCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(cell.chord);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(cell.chord);
  }, [cell.chord]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleClick = () => {
    setIsEditing(true);
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

  const cols = spanToGridCols[cell.span];
  const isHalf = cell.span === 0.5;

  return (
    <div className="flex flex-col" style={{ gridColumn: `span ${cols}` }}>
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
      </div>

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
        {canUnmerge && (
          <ActionButton onClick={onUnmerge} title="Réduire à 1 temps">
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
