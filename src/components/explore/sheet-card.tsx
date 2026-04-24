'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Sheet, Difficulty } from '@/types';
import { DIFFICULTY_LABELS } from '@/types';
import { useArtwork } from '@/lib/use-artwork';

// Singleton audio global — stoppe le précédent quand on en lance un autre
let _audio: HTMLAudioElement | null = null;
let _stopCb: (() => void) | null = null;

function playPreviewAudio(url: string, onStop: () => void) {
  // Arrêter l'extrait en cours
  if (_audio) {
    _audio.pause();
    _audio = null;
    if (_stopCb) { _stopCb(); _stopCb = null; }
  }
  const audio = new Audio(url);
  _audio = audio;
  _stopCb = onStop;
  audio.play().catch(() => { _audio = null; _stopCb = null; onStop(); });
  audio.onended = () => { _audio = null; _stopCb = null; onStop(); };
}

export function stopPreviewAudio() {
  if (_audio) { _audio.pause(); _audio = null; }
  if (_stopCb) { _stopCb(); _stopCb = null; }
}

interface SheetCardProps {
  sheet: Sheet;
  showOwner?: boolean;
  showRating?: boolean;
  onDelete?: () => void;
  isBookmarked?: boolean;
  onToggleBookmark?: () => void;
  /** Surcharge le lien de destination (par défaut /sheet/[id]) */
  href?: string;
  /** Nombre de variantes disponibles (affiche un badge si > 1) */
  variantCount?: number;
  /** Masque la colonne artwork */
  hideArtwork?: boolean;
  /** Masque le niveau de difficulté */
  hideDifficulty?: boolean;
  /** Affiche un badge 'Public' si la grille est publique */
  showPublicBadge?: boolean;
}

export function SheetCard({
  sheet,
  showOwner = false,
  showRating = false,
  onDelete,
  isBookmarked,
  onToggleBookmark,
  href,
  variantCount,
  hideArtwork = false,
  hideDifficulty = false,
  showPublicBadge = false,
}: SheetCardProps) {
  const { artworkUrl, previewUrl } = useArtwork(hideArtwork ? undefined : sheet.artist, hideArtwork ? undefined : sheet.title);
  const [isPlaying, setIsPlaying] = useState(false);

  const formatRating = (rating: number | null) => {
    if (rating === null) return null;
    return rating.toFixed(1);
  };

  const destination = href ?? `/sheet/${sheet.id}`;

  const handlePreview = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!previewUrl) return;

    if (isPlaying) {
      stopPreviewAudio();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      playPreviewAudio(previewUrl, () => setIsPlaying(false));
    }
  };

  return (
    <div className="bg-[var(--cell-bg)] rounded-xl border border-[var(--line)] overflow-hidden hover:shadow-md transition-shadow group relative flex">
      {/* Artwork à gauche */}
      {!hideArtwork && (
        <Link href={destination} className="flex-shrink-0 w-24 bg-gradient-to-br from-[var(--cell-bg)] to-[var(--line)]">
          {artworkUrl ? (
            <img
              src={artworkUrl}
              alt={`${sheet.artist} — ${sheet.title}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[var(--ink-faint)] text-2xl">
              ♫
            </div>
          )}
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
            className={`cursor-pointer absolute top-2 right-2 z-10 p-1.5 rounded-full transition-all
              ${isBookmarked
                ? 'bg-amber-100 text-amber-500'
                : 'bg-white/80 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-amber-500 hover:bg-amber-50'
              }`}
            title={isBookmarked ? 'Retirer du book' : 'Ajouter au book'}
          >
            {isBookmarked ? '★' : '☆'}
          </button>
        )}

        {/* Infos */}
        <div className="p-3 flex-1">
          <Link href={destination} className="block group-hover:text-[var(--accent)] transition-colors">
            <h3 className="font-semibold text-[var(--ink)] truncate text-sm flex items-center gap-1.5">
              {sheet.title || 'Sans titre'}
              {variantCount && variantCount > 1 && (
                <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 bg-[var(--accent-soft)] text-[var(--accent)] rounded-full font-medium">
                  {variantCount} versions
                </span>
              )}
            </h3>
          </Link>

          <div className="flex items-center justify-between mt-1">
            {sheet.artist ? (
              <Link
                href={`/artist/${encodeURIComponent(sheet.artist)}`}
                onClick={(e) => e.stopPropagation()}
                className="text-xs text-[var(--ink-light)] truncate flex-1 hover:text-[var(--accent)] transition-colors"
              >
                {sheet.artist}
              </Link>
            ) : (
              <span className="text-xs text-[var(--ink-light)] truncate flex-1">Artiste inconnu</span>
            )}

            {/* Difficulté ou note communautaire */}
            {showRating && sheet.ratingCount > 0 ? (
              <div className="flex items-center gap-1 ml-2">
                <span className="text-amber-500 text-sm">★</span>
                <span className="text-xs font-medium text-[var(--ink)]">
                  {formatRating(sheet.averageRating)}
                </span>
              </div>
            ) : !hideDifficulty && sheet.difficulty ? (
              <span className="text-xs text-[var(--ink-faint)] ml-2">
                {sheet.difficulty} · {DIFFICULTY_LABELS[sheet.difficulty as Difficulty]}
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2 mt-1">
            {showOwner && (
              <p className="text-[10px] text-[var(--ink-faint)]">
                par {sheet.ownerName}
              </p>
            )}
            {showPublicBadge && sheet.isPublic && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-700 font-medium">
                Public
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 pb-3 pt-2 border-t border-[var(--line)] mx-3">
          {/* Bouton preview iTunes */}
          {previewUrl && (
            <button
              onClick={handlePreview}
              className={`cursor-pointer p-1.5 rounded transition-colors ${
                isPlaying
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--ink-light)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]'
              }`}
              title={isPlaying ? 'Stop preview' : 'Écouter un extrait'}
            >
              {isPlaying ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <rect x="4" y="3" width="4" height="14" rx="1" />
                  <rect x="12" y="3" width="4" height="14" rx="1" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                </svg>
              )}
            </button>
          )}

          <Link
            href={destination}
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
                className="cursor-pointer p-1.5 rounded hover:bg-red-50 text-[var(--ink-light)] hover:text-red-600 transition-colors ml-auto"
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
