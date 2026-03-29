'use client';

import type { Row, Cell, BeatsPerMeasure, InstrumentId } from '@/types';
import { BeatCell } from './beat-cell';

interface GridRowProps {
  row: Row;
  rowIndex: number;
  beatsPerMeasure: BeatsPerMeasure;
  instrumentId: InstrumentId;
  onCellChange: (cellIndex: number, updates: Partial<Cell>) => void;
  onSplitCell: (cellIndex: number) => void;
  onExtendCell: (cellIndex: number) => void;
  onUnmergeCell: (cellIndex: number) => void;
  onJoinCells: (cellIndex: number) => void;
  onNavigateToCell: (rowIndex: number, cellIndex: number) => void;
  totalRows: number;
}

export function GridRow({
  row,
  rowIndex,
  beatsPerMeasure,
  instrumentId,
  onCellChange,
  onSplitCell,
  onExtendCell,
  onUnmergeCell,
  onJoinCells,
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
            onSplit={() => onSplitCell(cellIndex)}
            onExtend={() => onExtendCell(cellIndex)}
            onUnmerge={() => onUnmergeCell(cellIndex)}
            onJoin={() => onJoinCells(cellIndex)}
            onClear={() => onCellChange(cellIndex, { chord: '' })}
            canSplit={cell.span === 1}
            canExtend={cell.span === 1 && cellIndex + 1 < row.length}
            canUnmerge={cell.span === 2}
            canJoin={cell.span === 0.5 && cellIndex + 1 < row.length && row[cellIndex + 1].span === 0.5}
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
