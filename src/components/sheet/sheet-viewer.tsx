'use client';

import { useState } from 'react';
import type { Sheet, CellSpan, InstrumentId } from '@/types';
import { ChordSummary, InstrumentSelector } from '@/components/chord';
import type { CustomChordMap } from '@/components/chord';

interface SheetViewerProps {
  sheet: Sheet;
}

const spanToGridCols: Record<CellSpan, number> = {
  0.5: 1,
  1: 2,
  2: 4,
  3: 6,  // Ligne complète en 3/4
  4: 8,  // Ligne complète en 4/4
};

export function SheetViewer({ sheet }: SheetViewerProps) {
  const [instrumentId, setInstrumentId] = useState<InstrumentId>(sheet.instrumentId || 'guitar');

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 print:p-0 print:max-w-none">
      {/* Header */}
      <div className="mb-8 border-b-2 border-[var(--ink)] pb-4 print:mb-6 print:pb-3">
        <h1 className="font-playfair text-3xl font-bold text-[var(--ink)] print:text-2xl">
          {sheet.title || 'Sans titre'}
        </h1>

        {sheet.artist && (
          <p className="text-lg text-[var(--ink-light)] mt-1">{sheet.artist}</p>
        )}

        {/* Métadonnées */}
        <div className="flex flex-wrap items-center gap-3 mt-3">
          {sheet.key && (
            <span className="flex items-center gap-1.5 px-2 py-1 bg-purple-50 text-purple-700 rounded text-sm print:bg-transparent print:text-[var(--ink)]">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
              {sheet.key}
            </span>
          )}
          {sheet.tempo && (
            <span className="flex items-center gap-1.5 px-2 py-1 bg-orange-50 text-orange-700 rounded text-sm print:bg-transparent print:text-[var(--ink)]">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {sheet.tempo}
            </span>
          )}
          {sheet.capo && (
            <span className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-700 rounded text-sm print:bg-transparent print:text-[var(--ink)]">
              Capo {sheet.capo}
            </span>
          )}
          {sheet.difficulty && (
            <span className="text-amber-400 print:text-[var(--ink)]">
              {'★'.repeat(sheet.difficulty)}
              <span className="text-gray-300 print:text-[var(--ink-faint)]">{'★'.repeat(5 - sheet.difficulty)}</span>
            </span>
          )}
        </div>

        {/* Genres */}
        {sheet.genres && sheet.genres.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3 print:hidden">
            {sheet.genres.map((genre) => (
              <span
                key={genre}
                className="px-2.5 py-1 bg-gray-100 text-[var(--ink-light)] rounded-full text-xs font-medium"
              >
                {genre}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Sections */}
      <div className="space-y-8 print:space-y-6">
        {sheet.sections.map((section) => (
          <div key={section.id} className="print:break-inside-avoid">
            {/* Header de section */}
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--ink-light)]">
                {section.label}
              </span>
              {section.beatsPerMeasure === 3 && (
                <span className="text-[10px] px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded">
                  3/4
                </span>
              )}
              {section.repeat > 1 && (
                <span className="font-playfair text-sm italic text-[var(--ink-light)]">
                  ×{section.repeat}
                </span>
              )}
            </div>

            {/* Grille */}
            <div className="space-y-2">
              {section.rows.map((row, rowIndex) => (
                <div
                  key={rowIndex}
                  className={`grid gap-1 ${section.beatsPerMeasure === 3 ? 'grid-cols-6' : 'grid-cols-8'}`}
                >
                  {row.map((cell, cellIndex) => (
                    <div
                      key={cellIndex}
                      style={{ gridColumn: `span ${spanToGridCols[cell.span]}` }}
                      className={`
                        relative rounded-lg border-[1.5px] min-h-12 flex items-center justify-center
                        ${cell.chord
                          ? 'bg-[var(--cell-bg)] border-[#8a7a6a]'
                          : 'bg-[var(--cell-bg)] border-[var(--line)]'
                        }
                        ${cell.span === 0.5 ? 'bg-[#f7f3ec] border-[var(--ink-faint)]' : ''}
                        print:min-h-10 print:border
                      `}
                    >
                      <span
                        className={`
                          font-mono font-medium text-[var(--ink)]
                          ${cell.span === 0.5 ? 'text-sm' : 'text-base'}
                          print:text-sm
                        `}
                      >
                        {cell.chord || ''}
                      </span>

                      {cell.span === 0.5 && (
                        <span className="absolute bottom-0.5 left-1 text-[8px] text-[var(--ink-faint)] font-mono print:hidden">
                          ½
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Rappel des accords utilisés */}
      <div className="mt-8 print:hidden">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-[var(--ink-light)]">Diagrammes des accords</h2>
          <InstrumentSelector
            value={instrumentId}
            onChange={setInstrumentId}
          />
        </div>
        <ChordSummary
          sections={sheet.sections}
          instrumentId={instrumentId}
          customChords={sheet.customChords as CustomChordMap}
        />
      </div>

      {/* Footer (visible uniquement à l'impression) */}
      <div className="hidden print:block mt-8 pt-4 border-t border-[var(--line)] text-xs text-[var(--ink-faint)]">
        <p>Créé avec ChordSheet • chordsheet.app</p>
      </div>
    </div>
  );
}
