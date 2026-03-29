'use client';

import { useState } from 'react';
import type { Section, Cell, BeatsPerMeasure, InstrumentId } from '@/types';
import { GridRow } from './grid-row';
import { createEmptyRow } from '@/types';

interface SectionBlockProps {
  section: Section;
  instrumentId: InstrumentId;
  onUpdate: (updates: Partial<Section>) => void;
  onDelete: () => void;
  onNavigateToCell: (sectionId: string, rowIndex: number, cellIndex: number) => void;
}

export function SectionBlock({
  section,
  instrumentId,
  onUpdate,
  onDelete,
  onNavigateToCell,
}: SectionBlockProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Modifier une cellule
  const updateCell = (rowIndex: number, cellIndex: number, updates: Partial<Cell>) => {
    const newRows = [...section.rows];
    newRows[rowIndex] = [...newRows[rowIndex]];
    newRows[rowIndex][cellIndex] = { ...newRows[rowIndex][cellIndex], ...updates };
    onUpdate({ rows: newRows });
  };

  // Diviser une cellule 1-beat en deux 0.5-beat
  const splitCell = (rowIndex: number, cellIndex: number) => {
    const newRows = [...section.rows];
    const row = [...newRows[rowIndex]];
    const cell = row[cellIndex];

    if (cell.span !== 1) return;

    row.splice(cellIndex, 1, { chord: cell.chord, span: 0.5 }, { chord: '', span: 0.5 });
    newRows[rowIndex] = row;
    onUpdate({ rows: newRows });
  };

  // Étendre une cellule 1-beat en 2-beat (absorbe la suivante)
  const extendCell = (rowIndex: number, cellIndex: number) => {
    const newRows = [...section.rows];
    const row = [...newRows[rowIndex]];

    if (row[cellIndex].span !== 1 || cellIndex + 1 >= row.length) return;

    row.splice(cellIndex, 2, { chord: row[cellIndex].chord, span: 2 });
    newRows[rowIndex] = row;
    onUpdate({ rows: newRows });
  };

  // Diviser une cellule 2-beat en deux 1-beat
  const unmergeCell = (rowIndex: number, cellIndex: number) => {
    const newRows = [...section.rows];
    const row = [...newRows[rowIndex]];
    const cell = row[cellIndex];

    if (cell.span !== 2) return;

    row.splice(cellIndex, 1, { chord: cell.chord, span: 1 }, { chord: '', span: 1 });
    newRows[rowIndex] = row;
    onUpdate({ rows: newRows });
  };

  // Fusionner deux cellules 0.5-beat en une 1-beat
  const joinCells = (rowIndex: number, cellIndex: number) => {
    const newRows = [...section.rows];
    const row = [...newRows[rowIndex]];

    if (
      row[cellIndex].span !== 0.5 ||
      cellIndex + 1 >= row.length ||
      row[cellIndex + 1].span !== 0.5
    ) return;

    row.splice(cellIndex, 2, { chord: row[cellIndex].chord, span: 1 });
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
      className="mb-10 animate-fadeIn"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header de section */}
      <div className="flex items-center gap-3 mb-3">
        <input
          type="text"
          value={section.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder="Section…"
          className="font-sans text-xs font-medium uppercase tracking-wider text-[var(--ink-light)]
            bg-transparent border-none outline-none w-36"
        />

        <span className="flex items-center gap-1 font-playfair text-sm italic text-[var(--ink-light)]">
          ×
          <input
            type="number"
            min={1}
            max={9}
            value={section.repeat}
            onChange={(e) => onUpdate({ repeat: parseInt(e.target.value) || 1 })}
            className="font-mono text-sm text-[var(--accent)] bg-[var(--accent-soft)]
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
              onSplitCell={(cellIndex) => splitCell(rowIndex, cellIndex)}
              onExtendCell={(cellIndex) => extendCell(rowIndex, cellIndex)}
              onUnmergeCell={(cellIndex) => unmergeCell(rowIndex, cellIndex)}
              onJoinCells={(cellIndex) => joinCells(rowIndex, cellIndex)}
              onNavigateToCell={(nextRowIndex, cellIndex) =>
                onNavigateToCell(section.id, nextRowIndex, cellIndex)
              }
              totalRows={section.rows.length}
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
