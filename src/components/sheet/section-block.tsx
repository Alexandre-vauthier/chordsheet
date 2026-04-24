'use client';

import { useState, useRef } from 'react';
import type { Section, Cell, CellSpan, InstrumentId, StringChord, PianoChord } from '@/types';
import { GridRow } from './grid-row';
import { createEmptyRow } from '@/types';
import { CoachMark } from './coach-mark';

const EXAMPLE_CHORDS = ['Am', 'C', 'F', 'G'];

// Composant de saisie de répétition avec boutons ‹/› custom
function RepeatInput({ value, onChange, size = 'md' }: {
  value: number;
  onChange: (v: number) => void;
  size?: 'sm' | 'md';
}) {
  const sm = size === 'sm';
  const btnCls = sm
    ? 'w-4 h-4 text-[9px]'
    : 'w-5 h-5 text-xs';
  const inputCls = sm
    ? 'w-6 text-[10px]'
    : 'w-8 text-xs';
  return (
    <div className="flex items-center gap-0.5">
      <button
        onClick={() => onChange(Math.max(1, value - 1))}
        className={`${btnCls} flex items-center justify-center rounded bg-[var(--accent)]/80 hover:bg-[var(--accent)] text-white transition-colors leading-none`}
      >‹</button>
      <input
        type="number"
        min={1}
        value={value}
        onChange={(e) => onChange(Math.max(1, parseInt(e.target.value) || 1))}
        className={`${inputCls} text-center font-semibold text-white bg-[var(--accent)] border-none rounded px-0.5 py-0.5 outline-none
          [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
      />
      <button
        onClick={() => onChange(value + 1)}
        className={`${btnCls} flex items-center justify-center rounded bg-[var(--accent)]/80 hover:bg-[var(--accent)] text-white transition-colors leading-none`}
      >›</button>
    </div>
  );
}

interface SectionBlockProps {
  section: Section;
  instrumentId: InstrumentId;
  onUpdate: (updates: Partial<Section>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onPlaySection?: () => void;
  isSectionPlaying?: boolean;
  activeRowIndex?: number;
  activeCellIndex?: number;
  activeDurationMs?: number;
  onNavigateToCell: (sectionId: string, rowIndex: number, cellIndex: number) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  isDragOver: boolean;
  isFirstSection?: boolean;
  onDismissOnboarding?: () => void;
  finderChordPool?: Record<InstrumentId, (StringChord | PianoChord)[]>;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  anyDragging?: boolean;
}

export function SectionBlock({
  section,
  instrumentId,
  onUpdate,
  onDelete,
  onDuplicate,
  onPlaySection,
  isSectionPlaying,
  activeRowIndex,
  activeCellIndex,
  activeDurationMs,
  onNavigateToCell,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  isDragOver,
  isFirstSection = false,
  onDismissOnboarding,
  finderChordPool,
  onMoveUp,
  onMoveDown,
  anyDragging = false,
}: SectionBlockProps) {
  const [isHovered, setIsHovered] = useState(false);

  const updateCell = (rowIndex: number, cellIndex: number, updates: Partial<Cell>) => {
    const newRows = [...section.rows];
    newRows[rowIndex] = [...newRows[rowIndex]];
    newRows[rowIndex][cellIndex] = { ...newRows[rowIndex][cellIndex], ...updates };
    onUpdate({ rows: newRows });
  };

  const splitCell = (rowIndex: number, cellIndex: number) => {
    const newRows = [...section.rows];
    const row = [...newRows[rowIndex]];
    const cell = row[cellIndex];
    if (cell.span <= 0.25) return;
    const half = cell.span / 2;
    const spanA = (Math.ceil(half / 0.25) * 0.25) as CellSpan;
    const spanB = (cell.span - spanA) as CellSpan;
    if (spanB <= 0) return;
    row.splice(cellIndex, 1,
      { chord: cell.chord, span: spanA },
      { chord: '', span: spanB }
    );
    newRows[rowIndex] = row;
    onUpdate({ rows: newRows });
  };

  const mergeCells = (rowIndex: number, cellIndex: number) => {
    if (cellIndex === 0) return;
    const newRows = [...section.rows];
    const row = [...newRows[rowIndex]];
    const prevCell = row[cellIndex - 1];
    const currentCell = row[cellIndex];
    const newSpan = prevCell.span + currentCell.span;
    if (newSpan > 4) return;
    const chord = prevCell.chord || currentCell.chord;
    row.splice(cellIndex - 1, 2, { chord, span: newSpan as CellSpan });
    newRows[rowIndex] = row;
    onUpdate({ rows: newRows });
  };

  const addRow = () => {
    onUpdate({ rows: [...section.rows, createEmptyRow(4)] });
  };

  const deleteRow = (rowIndex: number) => {
    if (section.rows.length <= 1) return;
    const newRows = section.rows.filter((_, i) => i !== rowIndex);
    const newRepeats = (section.rowRepeats || []).filter((_, i) => i !== rowIndex);
    onUpdate({ rows: newRows, rowRepeats: newRepeats });
  };

  const setRowRepeat = (rowIndex: number, value: number) => {
    const repeats = [...(section.rowRepeats || section.rows.map(() => 1))];
    repeats[rowIndex] = Math.max(1, value);
    onUpdate({ rowRepeats: repeats });
  };

  // Contrôles header visibles si hovered OU première section (onboarding)
  const headerControlsVisible = isHovered || isFirstSection;

  return (
    <>
    {isDragOver && (
      <div
        className="h-10 mb-1 rounded-lg border-2 border-dashed border-[var(--accent)] bg-[var(--accent-soft)] flex items-center justify-center"
        onDragOver={(e) => { e.preventDefault(); onDragOver(e); }}
        onDrop={(e) => { e.preventDefault(); onDrop(); }}
      >
        <span className="text-xs text-[var(--accent)] font-medium">Déposer ici</span>
      </div>
    )}
    <div
      className="mb-10 animate-fadeIn"
      draggable
      onDragStart={(e) => {
        const fromHandle = !!(e.target as HTMLElement).closest('[data-drag-handle]');
        if (!fromHandle) { e.preventDefault(); return; }
        e.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; onDragOver(e); }}
      onDrop={(e) => { e.preventDefault(); onDrop(); }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header de section */}
      <div className="flex items-center gap-3 mb-3">
        {/* Drag handle */}
        <span
          className={`cursor-grab active:cursor-grabbing text-[var(--ink-faint)] transition-opacity select-none ${headerControlsVisible ? 'opacity-100' : 'opacity-0'}`}
          title="Glisser pour réordonner"
          data-drag-handle="true"
        >
          ⠿
        </span>

        {/* Label de section avec coach mark */}
        <div className="relative">
          <input
            type="text"
            value={section.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            placeholder="Section…"
            className="font-sans text-sm font-semibold uppercase tracking-wider text-[var(--ink)]
              bg-transparent border-none outline-none w-36"
          />
          {isFirstSection && (
            <CoachMark text="Clique pour renommer (ex: Intro, Refrain…)" position="bottom" onDismiss={() => onDismissOnboarding?.()} />
          )}
        </div>

        <span className="flex items-center gap-1">
          <span className="text-xs text-[var(--ink-faint)]">×</span>
          <RepeatInput value={section.repeat} onChange={(v) => onUpdate({ repeat: v })} size="md" />
        </span>

        <div className={`flex gap-1.5 ml-auto transition-opacity duration-150 ${headerControlsVisible ? 'opacity-100' : 'opacity-0'}`}>
          {onMoveUp && (
            <button
              onClick={onMoveUp}
              className="bg-transparent border-none cursor-pointer text-[var(--ink-light)] px-2 py-1 rounded text-xs transition-all hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
              title="Monter la section"
            >↑</button>
          )}
          {onMoveDown && (
            <button
              onClick={onMoveDown}
              className="bg-transparent border-none cursor-pointer text-[var(--ink-light)] px-2 py-1 rounded text-xs transition-all hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
              title="Descendre la section"
            >↓</button>
          )}
          <button
            onClick={addRow}
            className="bg-transparent border-none cursor-pointer text-[var(--ink-light)] px-2 py-1
              rounded text-xs transition-all hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
          >
            + mesure
          </button>
          {onPlaySection && (
            <button
              onClick={onPlaySection}
              className={`bg-transparent border-none cursor-pointer px-2 py-1
                rounded text-xs transition-all ${
                  isSectionPlaying
                    ? 'text-[var(--accent)] bg-[var(--accent-soft)]'
                    : 'text-[var(--ink-light)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]'
                }`}
              title={isSectionPlaying ? 'Stop' : 'Jouer cette section'}
            >
              {isSectionPlaying ? '■ Stop' : '▶ Play'}
            </button>
          )}
          <button
            onClick={onDuplicate}
            className="bg-transparent border-none cursor-pointer text-[var(--ink-light)] px-2 py-1
              rounded text-xs transition-all hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
            title="Dupliquer cette section"
          >
            ⧉
          </button>
          <button
            onClick={onDelete}
            className="bg-transparent border-none cursor-pointer text-[var(--ink-light)] px-2 py-1
              rounded text-xs transition-all hover:bg-red-50 hover:text-red-600"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Grille */}
      <div className="flex flex-col gap-1">
        {section.rows.map((row, rowIndex) => (
          <div key={rowIndex} className="group relative">
            <GridRow
              row={row}
              rowIndex={rowIndex}
              sectionId={section.id}
              beatsPerMeasure={section.beatsPerMeasure || 4}
              instrumentId={instrumentId}
              onCellChange={(cellIndex, updates) => updateCell(rowIndex, cellIndex, updates)}
              onSplit={(cellIndex) => splitCell(rowIndex, cellIndex)}
              onMerge={(cellIndex) => mergeCells(rowIndex, cellIndex)}
              onNavigateToCell={(nextRowIndex, cellIndex) =>
                onNavigateToCell(section.id, nextRowIndex, cellIndex)
              }
              totalRows={section.rows.length}
              activeCellIndex={activeRowIndex === rowIndex ? activeCellIndex : undefined}
              activeDurationMs={activeRowIndex === rowIndex ? activeDurationMs : undefined}
              isFirstRow={isFirstSection && rowIndex === 0}
              exampleChords={isFirstSection && rowIndex === 0 ? EXAMPLE_CHORDS : undefined}
              onDismissOnboarding={onDismissOnboarding}
              finderChordPool={finderChordPool}
            />
            {/* Badge répétition */}
            <div className={`absolute -right-10 top-1/2 -translate-y-1/2 flex items-center gap-0.5 transition-opacity ${(section.rowRepeats?.[rowIndex] ?? 1) > 1 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
              <span className="text-[10px] text-[var(--ink-faint)]">×</span>
              <RepeatInput
                value={section.rowRepeats?.[rowIndex] ?? 1}
                onChange={(v) => setRowRepeat(rowIndex, v)}
                size="sm"
              />
            </div>
            {section.rows.length > 1 && (
              <button
                onClick={() => deleteRow(rowIndex)}
                className="absolute -right-16 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100
                  cursor-pointer text-[var(--ink-faint)] hover:text-red-500 transition-all text-sm"
                title="Supprimer cette mesure"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Bouton ajouter mesure — masqué pendant le drag */}
      {!anyDragging && (
        <button
          onClick={addRow}
          className="w-full mt-2 py-2 border-[1.5px] border-dashed border-[var(--line)] rounded-lg
            text-[var(--ink-faint)] text-sm cursor-pointer transition-all bg-transparent
            hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--accent-soft)]"
        >
          + mesure
        </button>
      )}
    </div>
    </>
  );
}
