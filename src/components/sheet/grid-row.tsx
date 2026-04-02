'use client';

import type { Row, Cell, CellSpan, BeatsPerMeasure, InstrumentId } from '@/types';
import { BeatCell } from './beat-cell';

interface GridRowProps {
  row: Row;
  rowIndex: number;
  beatsPerMeasure: BeatsPerMeasure;
  instrumentId: InstrumentId;
  onCellChange: (cellIndex: number, updates: Partial<Cell>) => void;
  onSplit: (cellIndex: number) => void;
  onMerge: (cellIndex: number) => void;
  onNavigateToCell: (rowIndex: number, cellIndex: number) => void;
  totalRows: number;
}

const spanToGridCols: Record<CellSpan, number> = {
  0.5: 1,
  1: 2,
  2: 4,
  3: 6,
  4: 8,
};

export function GridRow({
  row,
  rowIndex,
  beatsPerMeasure,
  instrumentId,
  onCellChange,
  onSplit,
  onMerge,
  onNavigateToCell,
  totalRows,
}: GridRowProps) {
  const gridCols = beatsPerMeasure === 3 ? 'grid-cols-6' : 'grid-cols-8';

  // Construire les éléments : cellule, bouton fusion, cellule, bouton fusion, ...
  const elements: React.ReactNode[] = [];

  row.forEach((cell, cellIndex) => {
    // Bouton de fusion entre les cellules (pas avant la première)
    if (cellIndex > 0) {
      const prevCell = row[cellIndex - 1];
      const mergedSpan = prevCell.span + cell.span;
      const maxSpan = beatsPerMeasure;
      const canMerge = mergedSpan <= maxSpan;

      elements.push(
        <div
          key={`merge-${cellIndex}`}
          className="flex items-center justify-center"
          style={{ gridColumn: 'span 1' }}
        >
          {canMerge && (
            <button
              onClick={() => onMerge(cellIndex)}
              className="w-5 h-5 flex items-center justify-center rounded-full
                bg-white border border-[var(--line)] text-[var(--ink-faint)]
                hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] hover:border-[var(--accent)]
                transition-all text-[10px] leading-none opacity-0 group-hover/row:opacity-100"
              title="Fusionner"
            >
              ⟷
            </button>
          )}
        </div>
      );
    }

    // Cellule
    const cols = spanToGridCols[cell.span];
    // L'espace pour les boutons de fusion : une colonne entre chaque paire
    // On utilise un sous-grid pour le calcul, mais plus simple : on met tout à plat
    const canSplit = cell.span > 0.5;

    elements.push(
      <BeatCell
        key={`cell-${cellIndex}`}
        cell={cell}
        cols={cols}
        instrumentId={instrumentId}
        onChordChange={(chord) => onCellChange(cellIndex, { chord })}
        onClear={() => onCellChange(cellIndex, { chord: '' })}
        canSplit={canSplit}
        onSplit={() => onSplit(cellIndex)}
        onNavigateNext={() => {
          let nextCellIndex = cellIndex + 1;
          let nextRowIndex = rowIndex;
          if (nextCellIndex >= row.length) {
            nextCellIndex = 0;
            nextRowIndex = rowIndex + 1;
          }
          if (nextRowIndex < totalRows) {
            onNavigateToCell(nextRowIndex, nextCellIndex);
          }
        }}
      />
    );
  });

  // Calcul du total de colonnes : cellules + gaps fusion
  // Chaque cellule prend spanToGridCols[span] cols, chaque gap fusion prend 1 col
  const totalCellCols = row.reduce((sum, c) => sum + spanToGridCols[c.span], 0);
  const mergeGaps = row.length - 1;
  const totalGridCols = totalCellCols + mergeGaps;

  return (
    <div className="mb-2 group/row">
      <div
        className="grid gap-0.5 items-center"
        style={{ gridTemplateColumns: `repeat(${totalGridCols}, minmax(0, 1fr))` }}
      >
        {elements}
      </div>
    </div>
  );
}
