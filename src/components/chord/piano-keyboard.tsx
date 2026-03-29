'use client';

import type { PianoChord } from '@/types';

// Centres des touches (x) pour les dots
const PIANO_KEY_X: Record<string, number> = {
  'C4': 6, 'D4': 18, 'E4': 30, 'F4': 42, 'G4': 54, 'A4': 66, 'B4': 78,
  'C5': 90, 'D5': 102, 'E5': 114, 'F5': 126, 'G5': 138, 'A5': 150, 'B5': 162, 'C6': 174,
  'C#4': 12, 'Db4': 12, 'D#4': 24, 'Eb4': 24, 'F#4': 48, 'Gb4': 48, 'G#4': 60, 'Ab4': 60, 'A#4': 72, 'Bb4': 72,
  'C#5': 96, 'Db5': 96, 'D#5': 108, 'Eb5': 108, 'F#5': 132, 'Gb5': 132, 'G#5': 144, 'Ab5': 144, 'A#5': 156, 'Bb5': 156,
};

const PIANO_IS_BLACK: Record<string, boolean> = {
  'C#4': true, 'Db4': true, 'D#4': true, 'Eb4': true, 'F#4': true, 'Gb4': true, 'G#4': true, 'Ab4': true, 'A#4': true, 'Bb4': true,
  'C#5': true, 'Db5': true, 'D#5': true, 'Eb5': true, 'F#5': true, 'Gb5': true, 'G#5': true, 'Ab5': true, 'A#5': true, 'Bb5': true,
};

// Bords gauches des touches noires (pour les rect SVG)
const PIANO_BLACK_X = [8, 20, 44, 56, 68, 92, 104, 128, 140, 152];

interface PianoKeyboardProps {
  chord: PianoChord;
  onClick?: () => void;
}

export function PianoKeyboard({ chord, onClick }: PianoKeyboardProps) {
  const WK = 12;  // largeur touche blanche
  const WB = 8;   // largeur touche noire
  const HW = 50;  // hauteur touche blanche
  const HB = 31;  // hauteur touche noire
  const N = 15;   // nombre de touches blanches

  const W = N * WK;
  const H = HW + 4;

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      style={{ display: 'block', cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
    >
      {/* Fond blanc + bordure */}
      <rect
        x={0.5}
        y={0.5}
        width={W - 1}
        height={HW - 1}
        fill="white"
        stroke="#ccc"
        strokeWidth={0.8}
        rx={1}
      />

      {/* Séparateurs entre touches blanches */}
      {Array.from({ length: N - 1 }).map((_, i) => (
        <line
          key={`sep-${i}`}
          x1={(i + 1) * WK}
          y1={1}
          x2={(i + 1) * WK}
          y2={HW - 1}
          stroke="#ccc"
          strokeWidth={0.8}
        />
      ))}

      {/* Touches noires */}
      {PIANO_BLACK_X.map((x, i) => (
        <rect
          key={`black-${i}`}
          x={x}
          y={0}
          width={WB}
          height={HB}
          fill="#1a1a1a"
          rx={1}
        />
      ))}

      {/* Points des notes actives */}
      {(chord.notes || []).map((note, i) => {
        const x = PIANO_KEY_X[note];
        if (x === undefined) return null;
        const isBlack = PIANO_IS_BLACK[note];
        return (
          <circle
            key={`note-${i}`}
            cx={x}
            cy={isBlack ? HB - 7 : HW - 8}
            r={isBlack ? 3.5 : 4.5}
            fill={isBlack ? 'white' : '#111'}
          />
        );
      })}
    </svg>
  );
}

// Export des constantes pour utilisation dans le renderers
export { PIANO_KEY_X, PIANO_IS_BLACK, PIANO_BLACK_X };
