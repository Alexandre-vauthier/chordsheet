'use client';

import type { StringChord } from '@/types';

interface ChordDiagramProps {
  chord: StringChord;
  size?: 'xs' | 'sm' | 'md';
  numStrings?: number;
  onClick?: () => void;
  horizontal?: boolean;
}

export function ChordDiagram({
  chord,
  size = 'md',
  numStrings = 6,
  onClick,
  horizontal = false,
}: ChordDiagramProps) {
  const xs = size === 'xs';
  const sm = size === 'sm' || xs;

  const { startFret = 1 } = chord;
  const needsWideLabel = startFret >= 10;
  // En xs : PAD_L fixe pour que tous les diagrammes aient la même largeur
  // et que l'étiquette de case de départ soit toujours visible
  const PAD_L = xs ? 28 : sm ? (needsWideLabel ? 30 : 20) : (needsWideLabel ? 42 : 30);
  const PAD_R = PAD_L;
  const TOP = xs ? 13 : sm ? 22 : 37;
  const BOTTOM = xs ? 68 : sm ? 132 : 217;
  const CELL_W = xs ? 10 : sm ? 18 : 28;
  const CELL_H = (BOTTOM - TOP) / 5;
  const FRET_W = (numStrings - 1) * CELL_W;
  const W = FRET_W + PAD_L + PAD_R;
  const LEFT = PAD_L;
  const RIGHT = LEFT + FRET_W;
  const H = xs ? 82 : sm ? 158 : 240;
  const DOT_R = xs ? 4 : sm ? 7 : 13;
  const fs = xs ? 6 : sm ? 9 : 13;
  const fingerFs = xs ? 6 : sm ? 11 : 15;
  const NUT_H = xs ? 3 : sm ? 4 : 5;

  const { fingers = [], barre, open = [], muted = [] } = chord;

  const getSX = (s: number) => RIGHT - (s - 1) * CELL_W;
  const getFY = (f: number) => TOP + (f - startFret) * CELL_H + CELL_H / 2;

  // ── Rendu horizontal (paysage) : cordes = lignes horizontales, frettes = lignes verticales ─
  if (horizontal) {
    // Cas percussion (numStrings=0) : 5 barres verticales en paysage (|||||)
    if (numStrings === 0) {
      const W_P = xs ? 80 : sm ? 120 : 170;
      const H_P = xs ? 36 : sm ? 54  : 76;
      const X1  = xs ? 8  : sm ? 12  : 18;
      const X2  = W_P - X1;
      const Y1  = xs ? 6  : sm ? 9   : 13;
      const Y2  = H_P - (xs ? 6 : sm ? 9 : 13);
      const BAR_STEP = (X2 - X1) / 3;
      return (
        <svg
          width={W_P}
          height={H_P}
          viewBox={`0 0 ${W_P} ${H_P}`}
          className="max-w-full h-auto"
          style={{ display: 'block', cursor: onClick ? 'pointer' : 'inherit' }}
          onClick={onClick}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <line
              key={i}
              x1={X1 + i * BAR_STEP} y1={Y1}
              x2={X1 + i * BAR_STEP} y2={Y2}
              stroke="#aaa" strokeWidth={sm ? 1 : 1.2}
            />
          ))}
        </svg>
      );
    }

    const FRET_SP  = xs ? 12 : sm ? 18 : 26;
    const STR_SP   = xs ? 7  : sm ? 11 : 16;
    const PAD_T_H  = xs ? 10 : sm ? 14 : 22;
    const PAD_B_H  = xs ? 4  : sm ?  6 :  8;
    const PAD_L_H  = xs ? (needsWideLabel ? 26 : 20) : sm ? (needsWideLabel ? 34 : 26) : (needsWideLabel ? 48 : 36);
    const PAD_R_H  = xs ? 6  : sm ?  8 : 12;
    const NUT_W_H  = xs ? 3  : sm ?  4 :  5;
    const DOT_R_H  = xs ? 3.5 : sm ? 5.5 : 8;
    const FS_H     = xs ? 6  : sm ?  9 : 13;
    const FRET_FS_H = xs ? 7 : sm ? 10 : 14;

    const W_H = PAD_L_H + 5 * FRET_SP + PAD_R_H;
    const H_H = PAD_T_H + (numStrings - 1) * STR_SP + PAD_B_H;

    const getStrY  = (s: number) => PAD_T_H + (s - 1) * STR_SP;
    const getFretX = (f: number) => PAD_L_H + (f - startFret) * FRET_SP + FRET_SP / 2;

    return (
      <svg
        width={W_H}
        height={H_H}
        viewBox={`0 0 ${W_H} ${H_H}`}
        className="max-w-full h-auto"
        style={{ display: 'block', cursor: onClick ? 'pointer' : 'inherit' }}
        onClick={onClick}
      >
        {/* Sillet ou numéro de case */}
        {startFret === 1 ? (
          <rect
            x={PAD_L_H - NUT_W_H}
            y={getStrY(1)}
            width={NUT_W_H}
            height={getStrY(numStrings) - getStrY(1)}
            rx={1}
            fill="var(--ink, #111)"
          />
        ) : (
          <text
            x={PAD_L_H - NUT_W_H - 3}
            y={H_H / 2}
            textAnchor="end"
            dy="0.35em"
            fontSize={FRET_FS_H}
            fontWeight={600}
            fill="var(--ink, #111)"
          >
            {startFret}
          </text>
        )}

        {/* Lignes de frettes (verticales) */}
        {Array.from({ length: 5 }).map((_, i) => (
          <line
            key={`fh-${i}`}
            x1={PAD_L_H + (i + 1) * FRET_SP}
            y1={getStrY(1)}
            x2={PAD_L_H + (i + 1) * FRET_SP}
            y2={getStrY(numStrings)}
            stroke="#aaa"
            strokeWidth={sm ? 1 : 1.2}
          />
        ))}

        {/* Lignes de cordes (horizontales) */}
        {Array.from({ length: numStrings }).map((_, i) => (
          <line
            key={`sh-${i}`}
            x1={PAD_L_H}
            y1={getStrY(i + 1)}
            x2={PAD_L_H + 5 * FRET_SP}
            y2={getStrY(i + 1)}
            stroke="#aaa"
            strokeWidth={0.9}
          />
        ))}

        {/* Indicateurs ○ / ✕ à gauche du sillet */}
        {Array.from({ length: numStrings }).map((_, i) => {
          const s = i + 1;
          const cy = getStrY(s);
          const cx = PAD_L_H - NUT_W_H - (xs ? 4 : 6);
          if (open.includes(s)) return <text key={`oh-${s}`} x={cx} y={cy} textAnchor="middle" dy="0.35em" fontSize={FS_H} fill="var(--ink-light, #666)">○</text>;
          if (muted.includes(s)) return <text key={`mh-${s}`} x={cx} y={cy} textAnchor="middle" dy="0.35em" fontSize={FS_H} fill="var(--ink-light, #666)">✕</text>;
          return null;
        })}

        {/* Barré — rect vertical */}
        {barre && (() => {
          const cf = Math.min(barre.fromString, numStrings);
          const ct = Math.min(barre.toString, numStrings);
          const y1 = getStrY(Math.min(cf, ct));
          const y2 = getStrY(Math.max(cf, ct));
          const cx = getFretX(barre.fret);
          return (
            <rect
              x={cx - DOT_R_H}
              y={y1 - DOT_R_H}
              width={DOT_R_H * 2}
              height={y2 - y1 + DOT_R_H * 2}
              rx={DOT_R_H}
              fill="var(--ink, #111)"
            />
          );
        })()}

        {/* Points de doigts */}
        {fingers.filter(([s, f]) => f > 0 && s <= numStrings).map(([s, f], i) => {
          const cx = getFretX(f);
          const cy = getStrY(s);
          const inBarre = barre
            && f === barre.fret
            && s >= Math.min(barre.fromString, barre.toString)
            && s <= Math.max(barre.fromString, barre.toString);
          if (inBarre) return null;
          return <circle key={`dh-${i}`} cx={cx} cy={cy} r={DOT_R_H} fill="var(--ink, #111)" />;
        })}
      </svg>
    );
  }

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      className="max-w-full h-auto"
      style={{ display: 'block', cursor: onClick ? 'pointer' : 'inherit' }}
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
          fontSize={xs ? 9 : sm ? 12 : 17}
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
        // Clamp aux cordes affichées (ex: banjo 4 cordes)
        const clampedFrom = Math.min(barre.fromString, numStrings);
        const clampedTo = Math.min(barre.toString, numStrings);
        const x1 = getSX(clampedFrom);
        const x2 = getSX(clampedTo);
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
      {fingers.filter(([s, f]) => f > 0 && s <= numStrings).map(([s, f, finger], i) => {
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
