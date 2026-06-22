'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import type { Sheet, Difficulty } from '@/types';
import { DIFFICULTY_LABELS } from '@/types';
import { useArtwork } from '@/lib/use-artwork';

// Singleton audio global
let _audio: HTMLAudioElement | null = null;
let _stopCb: (() => void) | null = null;

function playPreviewAudio(url: string, onStop: () => void) {
  if (_audio) { _audio.pause(); _audio = null; if (_stopCb) { _stopCb(); _stopCb = null; } }
  const audio = new Audio(url);
  _audio = audio; _stopCb = onStop;
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
  href?: string;
  variantCount?: number;
  hideArtwork?: boolean;
  hideDifficulty?: boolean;
  showPublicBadge?: boolean;
}

const GRADIENTS = [
  'from-rose-900 via-red-800 to-orange-900',
  'from-violet-900 via-purple-800 to-fuchsia-900',
  'from-cyan-900 via-teal-800 to-emerald-900',
  'from-amber-900 via-orange-800 to-red-900',
  'from-indigo-900 via-blue-800 to-sky-900',
  'from-emerald-900 via-green-800 to-teal-900',
  'from-pink-900 via-rose-800 to-red-900',
  'from-sky-900 via-blue-800 to-indigo-900',
];

function hashGradient(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return GRADIENTS[Math.abs(h) % GRADIENTS.length];
}

export function SheetCard({
  sheet,
  showOwner = false,
  showRating = true,
  onDelete,
  isBookmarked,
  onToggleBookmark,
  href,
  variantCount,
  hideArtwork = false,
  hideDifficulty = true,
  showPublicBadge = false,
}: SheetCardProps) {
  const { artworkUrl, previewUrl } = useArtwork(
    hideArtwork ? undefined : sheet.artist,
    hideArtwork ? undefined : sheet.title,
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  const destination = href ?? `/sheet/${sheet.id}`;
  const gradient = hashGradient((sheet.title ?? '') + (sheet.artist ?? ''));

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const card = cardRef.current;
      if (!card) return;
      const r = card.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      card.style.setProperty('--rx', `${((y / r.height) - 0.5) * -18}deg`);
      card.style.setProperty('--ry', `${((x / r.width) - 0.5) * 18}deg`);
      card.style.setProperty('--sx', `${(x / r.width) * 100}%`);
      card.style.setProperty('--sy', `${(y / r.height) * 100}%`);
      card.style.setProperty('--active', '1');
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const card = cardRef.current;
    if (!card) return;
    card.style.removeProperty('--rx');
    card.style.removeProperty('--ry');
    card.style.setProperty('--active', '0');
    setMenuOpen(false);
  }, []);

  const handlePreview = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!previewUrl) return;
    if (isPlaying) { stopPreviewAudio(); setIsPlaying(false); }
    else { setIsPlaying(true); playPreviewAudio(previewUrl, () => setIsPlaying(false)); }
  };

  return (
    <div
      ref={cardRef}
      className="sheet-card-wrap group"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className="sheet-card-inner rounded-2xl overflow-hidden bg-[var(--cell-bg)] border border-[var(--line)]">

        {/* ── Artwork carré ─────────────────────────────────── */}
        <div className="aspect-square relative overflow-hidden">
          <Link href={destination} className="block w-full h-full">
            {artworkUrl ? (
              <img
                src={artworkUrl}
                alt={`${sheet.artist} — ${sheet.title}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                <span className="text-white/15 text-7xl font-serif select-none">♪</span>
              </div>
            )}

            {/* Dégradé bas pour lisibilité des badges */}
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 to-transparent" />

            {/* Tonalité */}
            {sheet.key && (
              <span className="absolute bottom-2.5 left-3 text-xs font-bold text-white/95 drop-shadow">
                {sheet.key}
              </span>
            )}

            {/* Variants badge */}
            {variantCount && variantCount > 1 && (
              <span className="absolute top-2.5 left-3 text-[10px] px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm text-white font-medium">
                {variantCount} versions
              </span>
            )}

            {/* Public badge */}
            {showPublicBadge && sheet.isPublic && (
              <span className="absolute top-2.5 left-3 text-[10px] px-2 py-0.5 rounded-full bg-green-500/80 text-white font-medium">
                Public
              </span>
            )}
          </Link>

          {/* Bouton play preview */}
          {previewUrl && (
            <button
              onClick={handlePreview}
              className={`absolute bottom-2.5 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
                isPlaying
                  ? 'bg-[var(--accent)] text-white scale-100 opacity-100'
                  : 'bg-black/50 backdrop-blur-sm text-white opacity-100 sm:opacity-0 group-hover:opacity-100 hover:bg-[var(--accent)] hover:scale-105'
              }`}
              title={isPlaying ? 'Stop preview' : 'Écouter un extrait'}
            >
              {isPlaying ? (
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <rect x="4" y="3" width="4" height="14" rx="1" />
                  <rect x="12" y="3" width="4" height="14" rx="1" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5 ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                </svg>
              )}
            </button>
          )}

          {/* Actions édition (dashboard) — menu 3 points */}
          {onDelete && (
            <div className="absolute top-2.5 right-2.5">
              <button
                onClick={e => { e.preventDefault(); e.stopPropagation(); setMenuOpen(v => !v); }}
                className="w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <circle cx="10" cy="4.5" r="1.5"/><circle cx="10" cy="10" r="1.5"/><circle cx="10" cy="15.5" r="1.5"/>
                </svg>
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-8 z-20 w-36 bg-[var(--cell-bg)] border border-[var(--line)] rounded-xl shadow-xl overflow-hidden">
                  <Link
                    href={`/sheet/${sheet.id}/edit`}
                    onClick={e => e.stopPropagation()}
                    className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--ink)] hover:bg-[var(--cell-hover)] transition-colors"
                  >
                    <svg className="w-3.5 h-3.5 text-[var(--ink-faint)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                    </svg>
                    Modifier
                  </Link>
                  <button
                    onClick={e => { e.preventDefault(); e.stopPropagation(); onDelete(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                    Supprimer
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Shine + foil holographique */}
          <div className="card-shine absolute inset-0 pointer-events-none" />
          <div className="card-foil absolute inset-0 pointer-events-none" />
        </div>

        {/* ── Contenu ───────────────────────────────────────── */}
        <div className="px-3 pt-2.5 pb-3 relative">

          {/* Bookmark */}
          {onToggleBookmark && (
            <button
              onClick={e => { e.preventDefault(); e.stopPropagation(); onToggleBookmark(); }}
              className={`absolute top-2 right-2.5 text-base transition-all ${
                isBookmarked
                  ? 'text-amber-400'
                  : 'text-[var(--ink-faint)] opacity-0 group-hover:opacity-100 hover:text-amber-400'
              }`}
              title={isBookmarked ? 'Retirer du book' : 'Ajouter au book'}
            >
              {isBookmarked ? '★' : '☆'}
            </button>
          )}

          <Link href={destination}>
            <h3 className="font-semibold text-[var(--ink)] text-sm leading-tight truncate group-hover:text-[var(--accent)] transition-colors pr-6">
              {sheet.title || 'Sans titre'}
            </h3>
          </Link>

          {sheet.artist ? (
            <Link
              href={`/artist/${encodeURIComponent(sheet.artist)}`}
              onClick={e => e.stopPropagation()}
              className="text-xs text-[var(--ink-light)] truncate block mt-0.5 hover:text-[var(--accent)] transition-colors"
            >
              {sheet.artist}
            </Link>
          ) : (
            <span className="text-xs text-[var(--ink-faint)] block mt-0.5">Artiste inconnu</span>
          )}

          {showOwner && sheet.ownerName && (
            <p className="text-[10px] text-[var(--ink-faint)] mt-0.5 truncate">
              par{' '}
              {sheet.ownerId && sheet.ownerId !== 'deleted' ? (
                <Link href={`/user/${sheet.ownerId}`} className="hover:text-[var(--accent)] transition-colors" onClick={e => e.stopPropagation()}>
                  {sheet.ownerName}
                </Link>
              ) : sheet.ownerName}
            </p>
          )}

          <div className="flex items-center justify-between mt-2 gap-1">
            <div className="flex items-center gap-1 flex-wrap">
              {sheet.tempo && (
                <span className="text-[10px] text-[var(--ink-faint)] bg-[var(--line)]/60 px-1.5 py-0.5 rounded">
                  {sheet.tempo}
                </span>
              )}
              {sheet.capo ? (
                <span className="text-[10px] text-[var(--ink-faint)] bg-[var(--line)]/60 px-1.5 py-0.5 rounded">
                  Capo {sheet.capo}
                </span>
              ) : null}
              {!hideDifficulty && sheet.difficulty && (
                <span className="text-[10px] text-[var(--ink-faint)] bg-[var(--line)]/60 px-1.5 py-0.5 rounded">
                  {DIFFICULTY_LABELS[sheet.difficulty as Difficulty]}
                </span>
              )}
            </div>
            {showRating && sheet.ratingCount > 0 && (
              <div className="flex items-center gap-0.5 shrink-0">
                <span className="text-amber-400 text-xs leading-none">★</span>
                <span className="text-[11px] font-semibold text-[var(--ink)]">
                  {sheet.averageRating?.toFixed(1)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
