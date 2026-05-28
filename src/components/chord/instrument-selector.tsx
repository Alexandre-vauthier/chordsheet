'use client';

import type { InstrumentId } from '@/types';
import { INSTRUMENT_CONFIG } from '@/lib/chord-data';

interface InstrumentSelectorProps {
  value: InstrumentId;
  onChange: (instrument: InstrumentId) => void;
  compact?: boolean;
}

const INSTRUMENT_ICONS: Record<InstrumentId, string> = {
  guitar: '🎸',
  ukulele: '🪕',
  mandolin: '🎻',
  banjo: '🪕',
  piano: '🎹',
  bass: '🎸',
  voice: '🎤',
};

export function InstrumentSelector({ value, onChange }: InstrumentSelectorProps) {
  const instruments = Object.values(INSTRUMENT_CONFIG);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as InstrumentId)}
      className="cursor-pointer px-2 py-1.5 rounded border border-[var(--line)] text-sm bg-[var(--cell-bg)]
        text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
    >
      {instruments.map((inst) => (
        <option key={inst.id} value={inst.id}>
          {INSTRUMENT_ICONS[inst.id]} {inst.label}
        </option>
      ))}
    </select>
  );
}
