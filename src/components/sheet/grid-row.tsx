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
  activeCellIndex?: number;
  activeDurationMs?: number;
}

const spanToGridCols: Record<CellSpan, number> = {
  0.25: 1,
  0.5: 2,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
};

const VALID_SPANS = new Set<number>([0.25, 0.5, 1, 2, 3, 4]);

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
  activeCellIndex,
  activeDurationMs,
}: GridRowProps) {
  const totalGridCols = beatsPerMeasure === 3 ? 12 : 16;

  // Positions cumulées pour placer les boutons fusion
  const cumCols: number[] = [];
  let acc = 0;
  for (const cell of row) {
    acc += spanToGridCols[cell.span];
    cumCols.push(acc);
  }

  return (
    <div className="mb-1 group/row relative">
      {/* Grille des cellules */}
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${totalGridCols}, minmax(0, 1fr))` }}
      >
        {row.map((cell, cellIndex) => {
          const cols = spanToGridCols[cell.span];
          const canSplit = cell.span > 0.25;

          return (
            <BeatCell
              key={cellIndex}
              cell={cell}
              cols={cols}
              instrumentId={instrumentId}
              onChordChange={(chord) => onCellChange(cellIndex, { chord })}
              canSplit={canSplit}
              onSplit={() => onSplit(cellIndex)}
              isActive={activeCellIndex === cellIndex}
              activeDurationMs={activeCellIndex === cellIndex ? activeDurationMs : undefined}
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
        })}
      </div>

      {/* Boutons de fusion — centrés verticalement entre les cellules */}
      {row.map((cell, cellIndex) => {
        if (cellIndex === 0) return null;

        const prevCell = row[cellIndex - 1];
        const mergedSpan = prevCell.span + cell.span;
        if (mergedSpan > beatsPerMeasure) return null;
        if (!VALID_SPANS.has(mergedSpan)) return null;

        const leftPercent = (cumCols[cellIndex - 1] / totalGridCols) * 100;

        return (
          <button
            key={`merge-${cellIndex}`}
            onClick={() => onMerge(cellIndex)}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10
              w-5 h-5 flex items-center justify-center rounded-full
              bg-white border border-[var(--line)] text-[var(--ink-faint)]
              hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] hover:border-[var(--accent)]
              transition-all text-[10px] leading-none shadow-sm
              opacity-0 group-hover/row:opacity-100 pointer-events-auto"
            style={{ left: `${leftPercent}%` }}
            title="Fusionner"
          >
            ⟷
          </button>
        );
      })}
    </div>
  );
}
