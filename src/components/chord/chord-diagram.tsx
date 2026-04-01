'use client';

import type { StringChord } from '@/types';

interface ChordDiagramProps {
  chord: StringChord;
  size?: 'sm' | 'md';
  numStrings?: number;
  onClick?: () => void;
}

export function ChordDiagram({
  chord,
  size = 'md',
  numStrings = 6,
  onClick
}: ChordDiagramProps) {
  const sm = size === 'sm';

  const PAD = sm ? 20 : 30; // Marge symétrique gauche/droite
  const TOP = sm ? 22 : 37;
  const BOTTOM = sm ? 132 : 217;
  const CELL_W = sm ? 18 : 28;
  const CELL_H = (BOTTOM - TOP) / 5;
  const FRET_W = (numStrings - 1) * CELL_W;
  const W = FRET_W + PAD * 2;
  const LEFT = PAD;
  const RIGHT = LEFT + FRET_W;
  const H = sm ? 158 : 240;
  const DOT_R = sm ? 7 : 13;
  const fs = sm ? 9 : 13;
  const fingerFs = sm ? 11 : 15;
  const NUT_H = sm ? 4 : 5;

  const { fingers = [], barre, open = [], muted = [], startFret = 1 } = chord;

  const getSX = (s: number) => RIGHT - (s - 1) * CELL_W;
  const getFY = (f: number) => TOP + (f - startFret) * CELL_H + CELL_H / 2;

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      style={{ display: 'block', cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
    >
      {/* Sillet ou numéro de case */}
      {startFret === 1 ? (
        <rect
          x={LEFT}
          y={TOP - NUT_H}
          width={RIGHT - LEFT}
          height={NUT_H}
          rx={1}
          fill="var(--ink, #111)"
        />
      ) : (
        <text
          x={LEFT - DOT_R - 5}
          y={TOP + CELL_H / 2}
          textAnchor="end"
          dy="0.35em"
          fontSize={sm ? 12 : 17}
          fontWeight={600}
          fill="var(--ink, #111)"
        >
          {startFret}
        </text>
      )}

      {/* Lignes de frettes */}
      {Array.from({ length: 5 }).map((_, i) => (
        <line
          key={`fret-${i}`}
          x1={LEFT}
          y1={TOP + (i + 1) * CELL_H}
          x2={RIGHT}
          y2={TOP + (i + 1) * CELL_H}
          stroke="#aaa"
          strokeWidth={sm ? 1 : 1.2}
        />
      ))}

      {/* Lignes de cordes */}
      {Array.from({ length: numStrings }).map((_, i) => (
        <line
          key={`string-${i}`}
          x1={LEFT + i * CELL_W}
          y1={TOP}
          x2={LEFT + i * CELL_W}
          y2={BOTTOM}
          stroke="#aaa"
          strokeWidth={0.9}
        />
      ))}

      {/* Indicateurs ○ / ✕ */}
      {Array.from({ length: numStrings }).map((_, i) => {
        const s = i + 1;
        const cx = getSX(s);
        const cy = TOP - NUT_H - (sm ? 7 : 10);

        if (open.includes(s)) {
          return (
            <text
              key={`open-${s}`}
              x={cx}
              y={cy}
              textAnchor="middle"
              dy="0.35em"
              fontSize={fs}
              fill="var(--ink-light, #666)"
            >
              ○
            </text>
          );
        }
        if (muted.includes(s)) {
          return (
            <text
              key={`muted-${s}`}
              x={cx}
              y={cy}
              textAnchor="middle"
              dy="0.35em"
              fontSize={fs}
              fill="var(--ink-light, #666)"
            >
              ✕
            </text>
          );
        }
        return null;
      })}

      {/* Barré */}
      {barre && (() => {
        const x1 = getSX(barre.fromString);
        const x2 = getSX(barre.toString);
        const cy = getFY(barre.fret);
        const pad = DOT_R;
        return (
          <rect
            x={Math.min(x1, x2) - pad}
            y={cy - DOT_R}
            width={Math.abs(x2 - x1) + pad * 2}
            height={DOT_R * 2}
            rx={DOT_R}
            fill="var(--ink, #111)"
          />
        );
      })()}

      {/* Points de doigts */}
      {fingers.filter(([, f]) => f > 0).map(([s, f, finger], i) => {
        const cx = getSX(s);
        const cy = getFY(f);
        const inBarre = barre
          && f === barre.fret
          && s >= Math.min(barre.fromString, barre.toString)
          && s <= Math.max(barre.fromString, barre.toString);
        if (inBarre) return null;
        return (
          <g key={`finger-${i}`}>
            <circle cx={cx} cy={cy} r={DOT_R} fill="var(--ink, #111)" />
            {!sm && finger && (
              <text
                x={cx}
                y={cy}
                textAnchor="middle"
                dy="0.35em"
                fontSize={fingerFs}
                fill="white"
                fontWeight="500"
              >
                {finger}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
