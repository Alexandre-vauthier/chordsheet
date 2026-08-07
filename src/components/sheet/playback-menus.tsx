'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { InstrumentId } from '@/types';
import { INSTRUMENT_CONFIG } from '@/lib/chord-data';
import { ACCOMPANIMENT_INSTRUMENTS, type PlayStyle } from '@/lib/use-playback';
import { PATTERN_DEFS } from '@/lib/use-groove-box';
import { useClickOutside } from '@/lib/use-click-outside';

const musicIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
    <path d="M9 18V5l12-2v13" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);

const drumIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
    <ellipse cx="12" cy="9" rx="7" ry="2.5" />
    <line x1="5" y1="9" x2="5" y2="16" strokeLinecap="round" />
    <line x1="19" y1="9" x2="19" y2="16" strokeLinecap="round" />
    <path d="M5 16c0 1.38 3.13 2.5 7 2.5s7-1.12 7-2.5" strokeLinecap="round" />
  </svg>
);

// ─── Menu « Instruments joués » (comme la consultation) ──────────────────────
// value = null → « Réglage du lecteur » (l'auteur n'impose rien) ; {} → Aucun ;
// {inst: style,…} → instruments choisis.
export function PlaybackInstrumentsMenu({
  value,
  onSetListener,
  onSetNone,
  onToggle,
  onSetStyle,
}: {
  value: Record<string, PlayStyle> | null;
  onSetListener?: () => void;
  onSetNone: () => void;
  onToggle: (inst: InstrumentId) => void;
  onSetStyle: (inst: InstrumentId, style: PlayStyle) => void;
}) {
  const t = useTranslations('SheetViewer');
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));

  const count = value ? Object.keys(value).length : 0;
  const defined = value !== null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={t('chordAudioInstruments')}
        className={`relative flex items-center justify-center w-9 h-9 rounded-lg border-[1.5px] transition-all duration-150 ${
          defined && count > 0
            ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
            : 'bg-[var(--cell-bg)] border-[var(--line)] text-[var(--ink-light)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
        }`}
      >
        {musicIcon}
        {count > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-[var(--ink)] text-[var(--cream)] text-[10px] font-bold">
            {count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-1 z-50 w-60 max-w-[calc(100vw-2rem)] bg-[var(--cream)] border border-[var(--line)] rounded-xl shadow-xl overflow-hidden py-1">
          <p className="px-3 py-1.5 text-[11px] uppercase tracking-wide text-[var(--ink-faint)]">{t('chordAudioInstruments')}</p>

          {onSetListener && (
            <button
              type="button"
              onClick={onSetListener}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--ink)] hover:bg-[var(--accent-soft)] transition-colors"
            >
              <span className={`shrink-0 w-3.5 h-3.5 rounded-full border flex items-center justify-center ${value === null ? 'border-[var(--accent)] bg-[var(--accent)]' : 'border-[var(--line)]'}`}>
                {value === null && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
              </span>
              {t('playbackListenerDefault')}
            </button>
          )}

          <button
            type="button"
            onClick={onSetNone}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--ink)] hover:bg-[var(--accent-soft)] transition-colors"
          >
            <span className={`shrink-0 w-3.5 h-3.5 rounded-full border flex items-center justify-center ${defined && count === 0 ? 'border-[var(--accent)] bg-[var(--accent)]' : 'border-[var(--line)]'}`}>
              {defined && count === 0 && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
            </span>
            {t('accompNone')}
          </button>
          <div className="mx-3 my-1 h-px bg-[var(--line)]" />

          {ACCOMPANIMENT_INSTRUMENTS.map((inst) => {
            const style = value ? value[inst] : undefined;
            const checked = style !== undefined;
            return (
              <div key={inst} className="flex items-center gap-1 pr-2">
                <button
                  type="button"
                  onClick={() => onToggle(inst)}
                  className="flex-1 min-w-0 flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--ink)] hover:bg-[var(--accent-soft)] transition-colors"
                >
                  <span className={`shrink-0 flex items-center justify-center w-4 h-4 rounded border ${checked ? 'bg-[var(--accent)] border-[var(--accent)] text-white' : 'border-[var(--line)]'}`}>
                    {checked && (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <span className="truncate">{INSTRUMENT_CONFIG[inst]?.label ?? inst}</span>
                </button>
                {checked && (
                  <div className="shrink-0 flex rounded-md border border-[var(--line)] overflow-hidden text-[10px]">
                    {(['block', 'arpeggio'] as PlayStyle[]).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => onSetStyle(inst, s)}
                        className={`px-1.5 py-1 transition-colors ${style === s ? 'bg-[var(--accent)] text-white' : 'text-[var(--ink-light)] hover:bg-[var(--accent-soft)]'}`}
                      >
                        {s === 'block' ? t('styleBlock') : t('styleArpeggio')}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Menu « Boîte à rythmes » (comme la consultation) ────────────────────────
export function GrooveBoxMenu({
  enabled,
  pattern,
  previewingId,
  onNone,
  onAuto,
  onPattern,
  onTogglePreview,
}: {
  enabled: boolean;
  pattern: string | undefined;
  previewingId: string | null;
  onNone: () => void;
  onAuto: () => void;
  onPattern: (id: string) => void;
  onTogglePreview: (id: string) => void;
}) {
  const t = useTranslations('SheetViewer');
  const tGroove = useTranslations('GroovePatterns');
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={t('grooveBoxPattern')}
        className={`flex items-center justify-center w-9 h-9 rounded-lg border-[1.5px] transition-all duration-150 ${
          enabled
            ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
            : 'bg-[var(--cell-bg)] border-[var(--line)] text-[var(--ink-light)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
        }`}
      >
        {drumIcon}
      </button>
      {open && (
        <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-1 z-50 w-60 max-w-[calc(100vw-2rem)] max-h-[70vh] overflow-y-auto bg-[var(--cream)] border border-[var(--line)] rounded-xl shadow-xl py-1">
          <p className="px-3 py-1.5 text-[11px] uppercase tracking-wide text-[var(--ink-faint)]">{t('grooveBoxPattern')}</p>

          <button
            type="button"
            onClick={onNone}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--ink)] hover:bg-[var(--accent-soft)] transition-colors"
          >
            <span className={`w-3.5 h-3.5 rounded-full border ${!enabled ? 'border-[var(--accent)] bg-[var(--accent)]' : 'border-[var(--line)]'} flex items-center justify-center`}>
              {!enabled && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
            </span>
            {t('accompNone')}
          </button>
          <div className="mx-3 my-1 h-px bg-[var(--line)]" />

          <button
            type="button"
            onClick={onAuto}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--ink)] hover:bg-[var(--accent-soft)] transition-colors"
          >
            <span className={`w-3.5 h-3.5 rounded-full border ${enabled && !pattern ? 'border-[var(--accent)] bg-[var(--accent)]' : 'border-[var(--line)]'} flex items-center justify-center`}>
              {enabled && !pattern && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
            </span>
            {t('automaticByGenre')}
          </button>

          {Array.from(new Set(PATTERN_DEFS.map((p) => p.category))).map((category) => (
            <div key={category}>
              <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide text-[var(--ink-faint)]">{category}</p>
              {PATTERN_DEFS.filter((p) => p.category === category).map((p) => {
                const selected = enabled && pattern === p.id;
                const previewing = previewingId === p.id;
                return (
                  <div key={p.id} className="flex items-center">
                    <button
                      type="button"
                      onClick={() => onPattern(p.id)}
                      className="flex-1 flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--ink)] hover:bg-[var(--accent-soft)] transition-colors"
                    >
                      <span className={`w-3.5 h-3.5 rounded-full border ${selected ? 'border-[var(--accent)] bg-[var(--accent)]' : 'border-[var(--line)]'} flex items-center justify-center`}>
                        {selected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>
                      {tGroove(p.id)}
                    </button>
                    <button
                      type="button"
                      onClick={() => onTogglePreview(p.id)}
                      title={previewing ? t('stopPreviewPattern') : t('listenToPattern')}
                      className={`shrink-0 w-8 h-8 mr-1 flex items-center justify-center rounded-lg transition-colors ${previewing ? 'text-[var(--accent)]' : 'text-[var(--ink-faint)] hover:text-[var(--accent)]'}`}
                    >
                      {previewing ? (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><rect x="4" y="3" width="4" height="14" rx="1" /><rect x="12" y="3" width="4" height="14" rx="1" /></svg>
                      ) : (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" /></svg>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
