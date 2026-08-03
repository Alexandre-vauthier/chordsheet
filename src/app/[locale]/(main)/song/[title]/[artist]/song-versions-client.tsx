'use client';

import { useState, useEffect } from 'react';
import { estAuCatalogue } from '@/lib/sheet-catalogue';
import { useTranslations } from 'next-intl';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import { fromFirestore } from '@/lib/firestore-helpers';
import { useBookmarks } from '@/lib/use-bookmarks';
import { useAuth } from '@/lib/auth-context';
import { useArtwork } from '@/lib/use-artwork';
import { useChordNotation } from '@/lib/use-chord-notation';
import type { Sheet, Difficulty } from '@/types';
import { DIFFICULTY_LABELS } from '@/types';
import { Link } from '@/i18n/navigation';

interface SongVersionsClientProps {
  title: string;
  artist: string;
  /**
   * Versions déjà lues côté serveur. Fournies, la liste part dans le HTML servi au
   * lieu d'apparaître après hydratation. La relecture client reste active : elle
   * seule voit les grilles privées d'un administrateur.
   */
  initialSheets?: Sheet[];
}

function VersionRow({ sheet, isBookmarked, onToggleBookmark }: {
  sheet: Sheet;
  isBookmarked: boolean;
  onToggleBookmark?: () => void;
}) {
  const t = useTranslations('SongVersions');
  const translate = useChordNotation();

  const uniqueChords = [...new Set(
    sheet.sections
      .flatMap((s) => s.rows.flatMap((r) => r.map((c) => c.chord)))
      .filter(Boolean)
  )].slice(0, 10);

  return (
    <Link
      href={`/sheet/${sheet.id}`}
      className="flex items-center gap-4 px-4 py-3 rounded-xl border border-[var(--line)] bg-[var(--cell-bg)]
        hover:border-[var(--accent)] hover:shadow-sm transition-all group"
    >
      {/* Note */}
      <div className="flex-shrink-0 w-14 text-center">
        {sheet.ratingCount > 0 ? (
          <>
            <span className="text-amber-500 text-base">★</span>
            <span className="text-sm font-semibold text-[var(--ink)] ml-0.5">
              {sheet.averageRating?.toFixed(1)}
            </span>
            <div className="text-[10px] text-[var(--ink-faint)]">{t('reviews', { count: sheet.ratingCount })}</div>
          </>
        ) : (
          <span className="text-xs text-[var(--ink-faint)]">—</span>
        )}
      </div>

      {/* Séparateur */}
      <div className="w-px h-10 bg-[var(--line)] flex-shrink-0" />

      {/* Infos */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-[var(--ink)] group-hover:text-[var(--accent)] transition-colors">
            {t('by', { name: sheet.ownerName || t('anonymous') })}
          </span>
          {sheet.difficulty && (
            <span className="text-[10px] px-1.5 py-0.5 bg-[var(--line)] text-[var(--ink-faint)] rounded">
              {sheet.difficulty} · {DIFFICULTY_LABELS[sheet.difficulty as Difficulty]}
            </span>
          )}
          {sheet.key && (
            <span className="text-[10px] px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded">
              {sheet.key}
            </span>
          )}
          {sheet.capo != null && sheet.capo > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">
              {t('capo', { fret: sheet.capo })}
            </span>
          )}
        </div>
        {/* Accords */}
        {uniqueChords.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {uniqueChords.map((chord, i) => (
              <span
                key={i}
                className="px-1.5 py-0.5 bg-[var(--cell-bg)] rounded border border-[var(--line)] font-mono text-[10px] text-[var(--ink)]"
              >
                {translate(chord)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Bookmark + flèche */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {onToggleBookmark && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleBookmark(); }}
            className={`p-1.5 rounded-full transition-all
              ${isBookmarked ? 'text-amber-500' : 'text-gray-300 opacity-0 group-hover:opacity-100 hover:text-amber-400'}`}
            title={isBookmarked ? t('bookmarkRemove') : t('bookmarkAdd')}
          >
            {isBookmarked ? '★' : '☆'}
          </button>
        )}
        <svg className="w-4 h-4 text-[var(--ink-faint)] group-hover:text-[var(--accent)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}

export function SongVersionsClient({ title, artist, initialSheets }: SongVersionsClientProps) {
  const t = useTranslations('SongVersions');
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { isBookmarked, toggleBookmark } = useBookmarks(user?.id);
  const [sheets, setSheets] = useState<Sheet[]>(initialSheets ?? []);
  const [loading, setLoading] = useState(!initialSheets);
  const { artworkUrl } = useArtwork(artist, title);

  useEffect(() => {
    if (authLoading) return;
    // Liste déjà servie, lecteur sans compte : rien de plus à voir. Connecté, on
    // recharge malgré tout, pour y ajouter ses propres versions.
    if (initialSheets && !isAdmin && !user) return;

    async function load() {
      try {
        const db = getDb();

        // Le rendu serveur ne connaît que les grilles publiques. Or on arrive
        // souvent ici depuis son book, après avoir dupliqué une grille : cette copie
        // est privée par défaut. Sans cette seconde lecture, la page de choix
        // n'afficherait pas la version qu'on vient précisément chercher.
        const queries = isAdmin
          ? [query(collection(db, 'sheets'), where('artist', '==', artist))]
          : [
              query(collection(db, 'sheets'), where('isPublic', '==', true), where('artist', '==', artist)),
              ...(user ? [query(collection(db, 'sheets'), where('ownerId', '==', user.id), where('artist', '==', artist))] : []),
            ];

        const snapshots = await Promise.all(queries.map((q) => getDocs(q)));
        const titleNorm = title.trim().toLowerCase();

        // Une grille publique dont on est l'auteur ressort des deux requêtes.
        const byId = new Map<string, Sheet>();
        for (const snapshot of snapshots) {
          for (const d of snapshot.docs) {
            const sheet = fromFirestore(d.id, d.data());
            // Hors catalogue : une copie de groupe n'est pas une version de plus.
            // L'admin, lui, voit tout — c'est le sens de sa requête élargie.
            if (!isAdmin && !estAuCatalogue(sheet) && sheet.ownerId !== user?.id) continue;
            if (sheet.title.trim().toLowerCase() === titleNorm) byId.set(sheet.id!, sheet);
          }
        }

        const loaded: Sheet[] = [...byId.values()];
        loaded.sort((a, b) => {
          const ra = a.averageRating ?? 0;
          const rb = b.averageRating ?? 0;
          if (rb !== ra) return rb - ra;
          return b.updatedAt.getTime() - a.updatedAt.getTime();
        });
        setSheets(loaded);
      } catch (err) {
        console.error('Error loading song versions:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [title, artist, isAdmin, authLoading, initialSheets, user]);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      {/* Retour */}
      <Link
        href="/explore"
        className="text-sm text-[var(--ink-faint)] hover:text-[var(--accent)] transition-colors mb-6 inline-flex items-center gap-1"
      >
        ← {t('explore')}
      </Link>

      {/* Header */}
      <div className="flex items-center gap-4 mt-3 mb-8">
        {artworkUrl && (
          <img
            src={artworkUrl}
            alt={`${artist} — ${title}`}
            className="w-20 h-20 rounded-xl shadow object-cover flex-shrink-0"
          />
        )}
        <div>
          <h1 className="font-playfair text-2xl font-bold text-[var(--ink)]">{title}</h1>
          <Link
            href={`/artist/${encodeURIComponent(artist)}`}
            className="text-[var(--ink-light)] hover:text-[var(--accent)] transition-colors"
          >
            {artist}
          </Link>
          {!loading && (
            <p className="text-sm text-[var(--ink-faint)] mt-1">
              {t('available', { count: sheets.length })}
            </p>
          )}
        </div>
      </div>

      {/* Liste des versions */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl border border-[var(--line)] bg-[var(--cell-bg)] animate-pulse" />
          ))}
        </div>
      ) : sheets.length > 0 ? (
        <div className="space-y-3">
          {sheets.map((sheet) => (
            <VersionRow
              key={sheet.id}
              sheet={sheet}
              isBookmarked={sheet.id ? isBookmarked(sheet.id) : false}
              onToggleBookmark={user && sheet.id ? () => toggleBookmark(sheet.id!) : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="bg-[var(--cell-bg)] rounded-xl border border-[var(--line)] p-8 text-center text-[var(--ink-faint)]">
          <p>{t('empty')}</p>
          <Link href="/explore" className="mt-4 inline-block text-sm text-[var(--accent)] hover:underline">
            {t('backToExplore')}
          </Link>
        </div>
      )}
    </div>
  );
}
