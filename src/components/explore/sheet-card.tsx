'use client';

import Link from 'next/link';
import type { Sheet } from '@/types';

interface SheetCardProps {
  sheet: Sheet;
  showOwner?: boolean;
  onDelete?: () => void;
}

export function SheetCard({ sheet, showOwner = false, onDelete }: SheetCardProps) {
  // Compter le nombre total d'accords
  const chordCount = sheet.sections.reduce(
    (total, section) =>
      total + section.rows.reduce(
        (rowTotal, row) => rowTotal + row.filter((cell) => cell.chord).length,
        0
      ),
    0
  );

  // Premier aperçu des accords
  const previewChords = sheet.sections
    .flatMap((s) => s.rows.flatMap((r) => r.map((c) => c.chord)))
    .filter(Boolean)
    .slice(0, 8);

  return (
    <div className="bg-white rounded-xl border border-[var(--line)] overflow-hidden hover:shadow-md transition-shadow group">
      {/* Aperçu des accords */}
      <div className="p-4 bg-gradient-to-br from-[var(--cell-bg)] to-white border-b border-[var(--line)]">
        <div className="flex flex-wrap gap-2">
          {previewChords.length > 0 ? (
            previewChords.map((chord, i) => (
              <span
                key={i}
                className="px-2 py-1 bg-white rounded border border-[var(--line)] font-mono text-sm text-[var(--ink)]"
              >
                {chord}
              </span>
            ))
          ) : (
            <span className="text-[var(--ink-faint)] text-sm italic">Aucun accord</span>
          )}
          {chordCount > 8 && (
            <span className="px-2 py-1 text-[var(--ink-faint)] text-sm">
              +{chordCount - 8}
            </span>
          )}
        </div>
      </div>

      {/* Infos */}
      <div className="p-4">
        <Link href={`/sheet/${sheet.id}`} className="block group-hover:text-[var(--accent)] transition-colors">
          <h3 className="font-semibold text-[var(--ink)] truncate">
            {sheet.title || 'Sans titre'}
          </h3>
        </Link>

        {sheet.artist && (
          <p className="text-sm text-[var(--ink-light)] truncate mt-0.5">{sheet.artist}</p>
        )}

        <div className="flex items-center gap-3 mt-3 text-xs text-[var(--ink-faint)]">
          {sheet.key && <span>{sheet.key}</span>}
          {sheet.tempo && <span>{sheet.tempo}</span>}
          <span>{sheet.sections.length} section{sheet.sections.length > 1 ? 's' : ''}</span>
          {sheet.isPublic && (
            <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-[10px] uppercase tracking-wider">
              Public
            </span>
          )}
        </div>

        {showOwner && (
          <p className="text-xs text-[var(--ink-faint)] mt-2">
            par {sheet.ownerName}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[var(--line)]">
          <Link
            href={`/sheet/${sheet.id}`}
            className="text-xs text-[var(--ink-light)] hover:text-[var(--accent)] transition-colors"
          >
            Consulter
          </Link>
          {onDelete && (
            <>
              <Link
                href={`/sheet/${sheet.id}/edit`}
                className="text-xs text-[var(--ink-light)] hover:text-[var(--accent)] transition-colors"
              >
                Modifier
              </Link>
              <button
                onClick={onDelete}
                className="text-xs text-[var(--ink-light)] hover:text-red-600 transition-colors ml-auto"
              >
                Supprimer
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
