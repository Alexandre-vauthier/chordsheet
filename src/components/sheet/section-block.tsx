'use client';

import { useState } from 'react';
import type { Section, Cell, CellSpan, BeatsPerMeasure, InstrumentId } from '@/types';
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

  const VALID_SPANS: CellSpan[] = [0.25, 0.5, 1, 2, 3, 4];

  // Diviser une cellule en deux
  const splitCell = (rowIndex: number, cellIndex: number) => {
    const newRows = [...section.rows];
    const row = [...newRows[rowIndex]];
    const cell = row[cellIndex];

    if (cell.span <= 0.25) return;

    const halfSpan = cell.span / 2;
    if (!VALID_SPANS.includes(halfSpan as CellSpan)) return;

    row.splice(cellIndex, 1,
      { chord: cell.chord, span: halfSpan as CellSpan },
      { chord: '', span: halfSpan as CellSpan }
    );
    newRows[rowIndex] = row;
    onUpdate({ rows: newRows });
  };

  // Fusionner une cellule avec la précédente
  const mergeCells = (rowIndex: number, cellIndex: number) => {
    if (cellIndex === 0) return;

    const newRows = [...section.rows];
    const row = [...newRows[rowIndex]];
    const prevCell = row[cellIndex - 1];
    const currentCell = row[cellIndex];

    const newSpan = prevCell.span + currentCell.span;
    const maxSpan = section.beatsPerMeasure || 4;
    if (newSpan > maxSpan) return;
    if (!VALID_SPANS.includes(newSpan as CellSpan)) return;

    // Garder l'accord de la cellule de gauche si elle en a un, sinon celui de droite
    const chord = prevCell.chord || currentCell.chord;
    row.splice(cellIndex - 1, 2, { chord, span: newSpan as CellSpan });
    newRows[rowIndex] = row;
    onUpdate({ rows: newRows });
  };

  // Ajouter une mesure
  const addRow = () => {
    const newRows = [...section.rows, createEmptyRow(section.beatsPerMeasure || 4)];
    onUpdate({ rows: newRows });
  };

  // Changer le nombre de temps par mesure
  const changeBeatsPerMeasure = (newBeats: BeatsPerMeasure) => {
    if (newBeats === section.beatsPerMeasure) return;

    // Reconstruire toutes les mesures avec le nouveau nombre de temps
    const newRows = section.rows.map(() => createEmptyRow(newBeats));
    onUpdate({ beatsPerMeasure: newBeats, rows: newRows });
  };

  // Supprimer une mesure
  const deleteRow = (rowIndex: number) => {
    if (section.rows.length <= 1) return;
    const newRows = section.rows.filter((_, i) => i !== rowIndex);
    onUpdate({ rows: newRows });
  };

  return (
    <div
      className={`mb-10 animate-fadeIn transition-all ${isDragOver ? 'border-t-2 border-[var(--accent)] pt-2' : ''}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        onDragOver(e);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header de section */}
      <div className="flex items-center gap-3 mb-3">
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

        {/* Toggle binaire/ternaire */}
        <div className="flex rounded overflow-hidden border border-[var(--line)]">
          <button
            onClick={() => changeBeatsPerMeasure(4)}
            className={`px-2 py-0.5 text-[10px] transition-colors ${
              (section.beatsPerMeasure || 4) === 4
                ? 'bg-[var(--accent)] text-white'
                : 'bg-white text-[var(--ink-light)] hover:bg-gray-50'
            }`}
            title="4 temps (binaire)"
          >
            4/4
          </button>
          <button
            onClick={() => changeBeatsPerMeasure(3)}
            className={`px-2 py-0.5 text-[10px] transition-colors ${
              section.beatsPerMeasure === 3
                ? 'bg-[var(--accent)] text-white'
                : 'bg-white text-[var(--ink-light)] hover:bg-gray-50'
            }`}
            title="3 temps (ternaire - valse, 6/8)"
          >
            3/4
          </button>
        </div>

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
            {/* Bouton supprimer mesure */}
            {section.rows.length > 1 && (
              <button
                onClick={() => deleteRow(rowIndex)}
                className="absolute -right-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100
                  text-[var(--ink-faint)] hover:text-red-500 transition-all text-sm"
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
