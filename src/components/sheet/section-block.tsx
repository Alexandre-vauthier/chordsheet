'use client';

import { useState } from 'react';
import type { Section, Cell, CellSpan, InstrumentId } from '@/types';
import { GridRow } from './grid-row';
import { createEmptyRow } from '@/types';

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
  // Drag & drop
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  isDragOver: boolean;
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
}: SectionBlockProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Modifier une cellule
  const updateCell = (rowIndex: number, cellIndex: number, updates: Partial<Cell>) => {
    const newRows = [...section.rows];
    newRows[rowIndex] = [...newRows[rowIndex]];
    newRows[rowIndex][cellIndex] = { ...newRows[rowIndex][cellIndex], ...updates };
    onUpdate({ rows: newRows });
  };

  // Diviser une cellule : toujours en deux parties dont la plus grande est à gauche
  // On prend la moitié arrondie au 0.25 supérieur pour spanA, le reste pour spanB
  const splitCell = (rowIndex: number, cellIndex: number) => {
    const newRows = [...section.rows];
    const row = [...newRows[rowIndex]];
    const cell = row[cellIndex];

    if (cell.span <= 0.25) return;

    // Arrondir spanA au 0.25 supérieur, spanB = reste
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

  // Fusionner une cellule avec la précédente — tout span ≤ 4 est valide
  const mergeCells = (rowIndex: number, cellIndex: number) => {
    if (cellIndex === 0) return;

    const newRows = [...section.rows];
    const row = [...newRows[rowIndex]];
    const prevCell = row[cellIndex - 1];
    const currentCell = row[cellIndex];

    const newSpan = prevCell.span + currentCell.span;
    if (newSpan > 4) return;

    // Garder l'accord de la cellule de gauche si elle en a un, sinon celui de droite
    const chord = prevCell.chord || currentCell.chord;
    row.splice(cellIndex - 1, 2, { chord, span: newSpan as CellSpan });
    newRows[rowIndex] = row;
    onUpdate({ rows: newRows });
  };

  // Ajouter une mesure
  const addRow = () => {
    const newRows = [...section.rows, createEmptyRow(4)];
    onUpdate({ rows: newRows });
  };


  // Supprimer une mesure
  const deleteRow = (rowIndex: number) => {
    if (section.rows.length <= 1) return;
    const newRows = section.rows.filter((_, i) => i !== rowIndex);
    const newRepeats = (section.rowRepeats || []).filter((_, i) => i !== rowIndex);
    onUpdate({ rows: newRows, rowRepeats: newRepeats });
  };

  // Modifier la répétition d'une mesure
  const setRowRepeat = (rowIndex: number, value: number) => {
    const repeats = [...(section.rowRepeats || section.rows.map(() => 1))];
    repeats[rowIndex] = Math.max(1, Math.min(9, value));
    onUpdate({ rowRepeats: repeats });
  };

  return (
    <div
      className={`mb-10 animate-fadeIn transition-all ${isDragOver ? 'border-t-2 border-[var(--accent)] pt-2' : ''}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header de section — zone de détection du drag-over */}
      <div
        className="flex items-center gap-3 mb-3"
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          onDragOver(e);
        }}
      >
        {/* Drag handle */}
        <span
          className={`cursor-grab active:cursor-grabbing text-[var(--ink-faint)] transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}
          title="Glisser pour réordonner"
        >
          ⠿
        </span>

        <input
          type="text"
          value={section.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder="Section…"
          className="font-sans text-sm font-semibold uppercase tracking-wider text-[var(--ink)]
            bg-transparent border-none outline-none w-36"
        />

        <span className="flex items-center gap-1">
          <span className="text-xs text-[var(--ink-faint)]">×</span>
          <input
            type="number"
            min={1}
            max={9}
            value={section.repeat}
            onChange={(e) => onUpdate({ repeat: parseInt(e.target.value) || 1 })}
            className="font-mono text-xs font-semibold text-white bg-[var(--accent)]
              border-none rounded px-1.5 py-0.5 w-9 text-center outline-none"
          />
        </span>

        <div
          className={`flex gap-1.5 ml-auto transition-opacity duration-150 ${
            isHovered ? 'opacity-100' : 'opacity-0'
          }`}
        >
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
            />
            {/* Badge répétition — visible si > 1, au survol sinon */}
            <div className={`absolute -right-10 top-1/2 -translate-y-1/2 flex items-center gap-0.5 transition-opacity ${(section.rowRepeats?.[rowIndex] ?? 1) > 1 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
              <span className="text-[10px] text-[var(--ink-faint)]">×</span>
              <input
                type="number"
                min={1}
                value={section.rowRepeats?.[rowIndex] ?? 1}
                onChange={(e) => setRowRepeat(rowIndex, parseInt(e.target.value) || 1)}
                className="w-7 text-center text-[10px] font-semibold text-white bg-[var(--accent)]
                  border-none rounded px-0.5 py-0.5 outline-none cursor-pointer
                  [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                title="Répétitions de cette mesure"
              />
            </div>
            {/* Bouton supprimer — toujours au survol seulement */}
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

      {/* Bouton ajouter mesure */}
      <button
        onClick={addRow}
        className="w-full mt-2 py-2 border-[1.5px] border-dashed border-[var(--line)] rounded-lg
          text-[var(--ink-faint)] text-sm cursor-pointer transition-all bg-transparent
          hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--accent-soft)]"
      >
        + mesure
      </button>
    </div>
  );
}
