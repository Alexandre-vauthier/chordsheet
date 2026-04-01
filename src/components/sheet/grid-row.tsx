'use client';

import type { Row, Cell, BeatsPerMeasure, InstrumentId } from '@/types';
import { BeatCell } from './beat-cell';

interface GridRowProps {
  row: Row;
  rowIndex: number;
  beatsPerMeasure: BeatsPerMeasure;
  instrumentId: InstrumentId;
  onCellChange: (cellIndex: number, updates: Partial<Cell>) => void;
  onExtendLeft: (cellIndex: number) => void;
  onExtendRight: (cellIndex: number) => void;
  onShrink: (cellIndex: number) => void;
  onNavigateToCell: (rowIndex: number, cellIndex: number) => void;
  totalRows: number;
}

export function GridRow({
  row,
  rowIndex,
  beatsPerMeasure,
  instrumentId,
  onCellChange,
  onExtendLeft,
  onExtendRight,
  onShrink,
  onNavigateToCell,
  totalRows,
}: GridRowProps) {
  // 3 temps = 6 colonnes, 4 temps = 8 colonnes (chaque temps = 2 cols)
  const gridCols = beatsPerMeasure === 3 ? 'grid-cols-6' : 'grid-cols-8';

  return (
    <div className="mb-2">
      {/* Grille de cellules : 6 ou 8 colonnes selon le nombre de temps */}
      <div className={`grid ${gridCols} gap-1`}>
        {row.map((cell, cellIndex) => (
          <BeatCell
            key={cellIndex}
            cell={cell}
            instrumentId={instrumentId}
            onChordChange={(chord) => onCellChange(cellIndex, { chord })}
            onExtendLeft={() => onExtendLeft(cellIndex)}
            onExtendRight={() => onExtendRight(cellIndex)}
            onShrink={() => onShrink(cellIndex)}
            onClear={() => onCellChange(cellIndex, { chord: '' })}
            canExtendLeft={cellIndex > 0}
            canExtendRight={cellIndex < row.length - 1}
            canShrink={cell.span > 0.5}
            onNavigateNext={() => {
              // Naviguer vers la cellule suivante
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
        ))}
      </div>
    </div>
  );
}
