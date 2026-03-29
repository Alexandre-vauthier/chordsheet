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
};

export function InstrumentSelector({ value, onChange, compact = false }: InstrumentSelectorProps) {
  const instruments = Object.values(INSTRUMENT_CONFIG);

  if (compact) {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as InstrumentId)}
        className="px-2 py-1 rounded border border-[var(--line)] text-sm bg-white
          focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
      >
        {instruments.map((inst) => (
          <option key={inst.id} value={inst.id}>
            {INSTRUMENT_ICONS[inst.id]} {inst.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {instruments.map((inst) => {
        const isSelected = inst.id === value;
        return (
          <button
            key={inst.id}
            type="button"
            onClick={() => onChange(inst.id)}
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors flex items-center gap-1.5 ${
              isSelected
                ? 'bg-[var(--ink)] text-white border-[var(--ink)]'
                : 'bg-white text-[var(--ink-light)] border-[var(--line)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
            }`}
          >
            <span>{INSTRUMENT_ICONS[inst.id]}</span>
            <span>{inst.label}</span>
          </button>
        );
      })}
    </div>
  );
}
