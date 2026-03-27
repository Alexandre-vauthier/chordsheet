'use client';

import Link from 'next/link';
import type { Sheet } from '@/types';

interface SheetCardProps {
  sheet: Sheet;
  showOwner?: boolean;
  showRating?: boolean;
  onDelete?: () => void;
  isBookmarked?: boolean;
  onToggleBookmark?: () => void;
}

export function SheetCard({
  sheet,
  showOwner = false,
  showRating = false,
  onDelete,
  isBookmarked,
  onToggleBookmark,
}: SheetCardProps) {
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

  // Formater la note moyenne
  const formatRating = (rating: number | null) => {
    if (rating === null) return null;
    return rating.toFixed(1);
  };

  return (
    <div className="bg-white rounded-xl border border-[var(--line)] overflow-hidden hover:shadow-md transition-shadow group relative">
      {/* Bouton bookmark */}
      {onToggleBookmark && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleBookmark();
          }}
          className={`absolute top-2 right-2 z-10 p-1.5 rounded-full transition-all
            ${isBookmarked
              ? 'bg-amber-100 text-amber-500'
              : 'bg-white/80 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-amber-500 hover:bg-amber-50'
            }`}
          title={isBookmarked ? 'Retirer du book' : 'Ajouter au book'}
        >
          {isBookmarked ? '★' : '☆'}
        </button>
      )}

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

        <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-[var(--ink-faint)]">
          {sheet.key && <span>{sheet.key}</span>}
          {sheet.tempo && <span>{sheet.tempo}</span>}
          {sheet.capo && (
            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">
              Capo {sheet.capo}
            </span>
          )}
          {sheet.difficulty && (
            <span className="text-amber-400">
              {'★'.repeat(sheet.difficulty)}
              <span className="text-gray-300">{'★'.repeat(5 - sheet.difficulty)}</span>
            </span>
          )}
          {sheet.isPublic && (
            <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-[10px] uppercase tracking-wider">
              Public
            </span>
          )}
        </div>

        {/* Note communautaire */}
        {showRating && sheet.ratingCount > 0 && (
          <div className="flex items-center gap-1.5 mt-2">
            <span className="text-amber-500">★</span>
            <span className="text-sm font-medium text-[var(--ink)]">
              {formatRating(sheet.averageRating)}
            </span>
            <span className="text-xs text-[var(--ink-faint)]">
              ({sheet.ratingCount} avis)
            </span>
          </div>
        )}

        {/* Genres */}
        {sheet.genres && sheet.genres.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {sheet.genres.slice(0, 3).map((genre) => (
              <span
                key={genre}
                className="px-1.5 py-0.5 bg-gray-100 text-[var(--ink-light)] rounded text-[10px]"
              >
                {genre}
              </span>
            ))}
            {sheet.genres.length > 3 && (
              <span className="text-[10px] text-[var(--ink-faint)]">+{sheet.genres.length - 3}</span>
            )}
          </div>
        )}

        {showOwner && (
          <p className="text-xs text-[var(--ink-faint)] mt-2">
            par {sheet.ownerName}
          </p>
        )}

        {/* Vues */}
        {showRating && sheet.viewCount > 0 && (
          <p className="text-xs text-[var(--ink-faint)] mt-1">
            {sheet.viewCount} vue{sheet.viewCount > 1 ? 's' : ''}
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
