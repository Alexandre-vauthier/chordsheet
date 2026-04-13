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
  showPlayButton?: boolean;
  showName?: boolean;
  size?: 'sm' | 'md';
  onClick?: () => void;
  selected?: boolean;
  displayName?: string; // override chord.name (pour les alias enharmoniques)
}

export function ChordCard({
  chord,
  instrumentId,
  showPlayButton = true,
  showName = true,
  size = 'sm',
  onClick,
  selected = false,
  displayName,
}: ChordCardProps) {
  const instrument = INSTRUMENT_CONFIG[instrumentId];

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    playChord(chord, instrumentId);
  };

  return (
    <div
      className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
        selected
          ? 'border-[var(--accent)] bg-[var(--accent)]/5'
          : 'border-[var(--line)] bg-[var(--cell-bg)] hover:border-[var(--ink-faint)]'
      } ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      {/* Diagramme */}
      <div className="flex justify-center">
        {isPianoChord(chord) ? (
          <PianoKeyboard chord={chord} />
        ) : (
          <ChordDiagram
            chord={chord}
            size={size}
            numStrings={instrument.strings}
          />
        )}
      </div>

      {/* Nom de l'accord */}
      {showName && (
        <div className="text-center">
          <div className="font-medium text-sm text-[var(--ink)]">{displayName ?? chord.name}</div>
          <div className="text-xs text-[var(--ink-faint)]">{chord.full}</div>
        </div>
      )}

      {/* Bouton play */}
      {showPlayButton && (
        <button
          onClick={handlePlay}
          className="w-full py-1.5 text-xs font-semibold rounded-lg bg-[var(--nav-bg)] text-white hover:bg-[var(--ink-light)] transition-colors"
        >
          ▶
        </button>
      )}
    </div>
  );
}
