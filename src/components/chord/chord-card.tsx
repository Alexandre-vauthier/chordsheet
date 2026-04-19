'use client';

import type { StringChord, PianoChord, InstrumentId } from '@/types';
import { isPianoChord } from '@/types';
import { ChordDiagram } from './chord-diagram';
import { PianoKeyboard } from './piano-keyboard';
import { INSTRUMENT_CONFIG } from '@/lib/chord-data';
import { playChord } from '@/lib/chord-audio';

interface ChordCardProps {
  chord: StringChord | PianoChord;
  instrumentId: InstrumentId;
  showName?: boolean;
  size?: 'xs' | 'sm' | 'md';
  onClick?: () => void;
  selected?: boolean;
  displayName?: string; // override chord.name (pour les alias enharmoniques)
}

export function ChordCard({
  chord,
  instrumentId,
  showName = true,
  size = 'sm',
  onClick,
  selected = false,
  displayName,
}: ChordCardProps) {
  const instrument = INSTRUMENT_CONFIG[instrumentId];

  const handleDiagramClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    playChord(chord, instrumentId);
  };

  return (
    <div
      className={`flex flex-col items-center gap-1 ${size === 'xs' ? 'p-1.5' : 'p-3 gap-2'} rounded-xl border transition-all ${
        selected
          ? 'border-[var(--accent)] bg-[var(--accent)]/5'
          : 'border-[var(--line)] bg-[var(--cell-bg)] hover:border-[var(--ink-faint)]'
      } ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      {/* Diagramme — cliquable pour jouer */}
      <div
        className="group/play relative flex justify-center cursor-pointer"
        onClick={handleDiagramClick}
        title="Cliquer pour écouter"
      >
        {isPianoChord(chord) ? (
          <PianoKeyboard chord={chord} />
        ) : (
          <ChordDiagram
            chord={chord}
            size={size}
            numStrings={instrument.strings}
          />
        )}
        {/* Overlay ▶ au survol du diagramme */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/play:opacity-100 transition-opacity rounded-lg bg-[var(--ink)]/10">
          <span className="text-[var(--ink)] text-sm opacity-70">▶</span>
        </div>
      </div>

      {/* Nom de l'accord */}
      {showName && (
        <div className="text-center">
          <div className="font-medium text-sm text-[var(--ink)]">{displayName ?? chord.name}</div>
        </div>
      )}
    </div>
  );
}
