'use client';

import Link from 'next/link';
import type { Sheet, Difficulty } from '@/types';
import { DIFFICULTY_LABELS } from '@/types';
import { useChordNotation } from '@/lib/use-chord-notation';
import { useArtwork } from '@/lib/use-artwork';

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
  const translate = useChordNotation();
  const { artworkUrl } = useArtwork(sheet.artist, sheet.title);

  // Premier aperçu des accords (accords uniques)
  const uniqueChords = [...new Set(
    sheet.sections
      .flatMap((s) => s.rows.flatMap((r) => r.map((c) => c.chord)))
      .filter(Boolean)
  )].slice(0, 8);

  // Formater la note moyenne
  const formatRating = (rating: number | null) => {
    if (rating === null) return null;
    return rating.toFixed(1);
  };

  return (
    <div className="bg-white rounded-xl border border-[var(--line)] overflow-hidden hover:shadow-md transition-shadow group relative flex">
      {/* Artwork à gauche */}
      {artworkUrl && (
        <Link href={`/sheet/${sheet.id}`} className="flex-shrink-0 w-24">
          <img
            src={artworkUrl}
            alt={`${sheet.artist} — ${sheet.title}`}
            className="w-full h-full object-cover"
          />
        </Link>
      )}

      {/* Contenu à droite */}
      <div className="flex-1 min-w-0 flex flex-col">
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
        <div className="p-3 bg-gradient-to-br from-[var(--cell-bg)] to-white border-b border-[var(--line)]">
          <div className="flex flex-wrap gap-1.5">
            {uniqueChords.length > 0 ? (
              uniqueChords.map((chord, i) => (
                <span
                  key={i}
                  className="px-1.5 py-0.5 bg-white rounded border border-[var(--line)] font-mono text-xs text-[var(--ink)]"
                >
                  {translate(chord)}
                </span>
              ))
            ) : (
              <span className="text-[var(--ink-faint)] text-xs italic">Aucun accord</span>
            )}
          </div>
        </div>

        {/* Infos */}
        <div className="p-3 flex-1">
          <Link href={`/sheet/${sheet.id}`} className="block group-hover:text-[var(--accent)] transition-colors">
            <h3 className="font-semibold text-[var(--ink)] truncate text-sm">
              {sheet.title || 'Sans titre'}
            </h3>
          </Link>

          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-[var(--ink-light)] truncate flex-1">
              {sheet.artist || 'Artiste inconnu'}
            </p>

            {/* Difficulté ou note communautaire */}
            {showRating && sheet.ratingCount > 0 ? (
              <div className="flex items-center gap-1 ml-2">
                <span className="text-amber-500 text-sm">★</span>
                <span className="text-xs font-medium text-[var(--ink)]">
                  {formatRating(sheet.averageRating)}
                </span>
              </div>
            ) : sheet.difficulty ? (
              <span className="text-xs text-[var(--ink-faint)] ml-2">
                {sheet.difficulty} · {DIFFICULTY_LABELS[sheet.difficulty as Difficulty]}
              </span>
            ) : null}
          </div>

          {showOwner && (
            <p className="text-[10px] text-[var(--ink-faint)] mt-1">
              par {sheet.ownerName}
            </p>
          )}
        </div>

        {/* Actions avec icônes */}
        <div className="flex items-center gap-1 px-3 pb-3 pt-2 border-t border-[var(--line)] mx-3">
          <Link
            href={`/sheet/${sheet.id}`}
            className="p-1.5 rounded hover:bg-[var(--accent-soft)] text-[var(--ink-light)] hover:text-[var(--accent)] transition-colors"
            title="Consulter"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </Link>
          {onDelete && (
            <>
              <Link
                href={`/sheet/${sheet.id}/edit`}
                className="p-1.5 rounded hover:bg-[var(--accent-soft)] text-[var(--ink-light)] hover:text-[var(--accent)] transition-colors"
                title="Modifier"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </Link>
              <button
                onClick={onDelete}
                className="p-1.5 rounded hover:bg-red-50 text-[var(--ink-light)] hover:text-red-600 transition-colors ml-auto"
                title="Supprimer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
