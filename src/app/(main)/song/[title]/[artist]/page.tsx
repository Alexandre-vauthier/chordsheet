'use client';

import { useState, useEffect, use } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import Link from 'next/link';
import { getDb } from '@/lib/firebase';
import { fromFirestore } from '@/lib/firestore-helpers';
import { useBookmarks } from '@/lib/use-bookmarks';
import { useAuth } from '@/lib/auth-context';
import { useArtwork } from '@/lib/use-artwork';
import { useChordNotation } from '@/lib/use-chord-notation';
import type { Sheet, Difficulty } from '@/types';
import { DIFFICULTY_LABELS } from '@/types';

interface PageParams {
  title: string;
  artist: string;
}

function VersionRow({ sheet, isBookmarked, onToggleBookmark }: {
  sheet: Sheet;
  isBookmarked: boolean;
  onToggleBookmark?: () => void;
}) {
  const translate = useChordNotation();

  const uniqueChords = [...new Set(
    sheet.sections
      .flatMap((s) => s.rows.flatMap((r) => r.map((c) => c.chord)))
      .filter(Boolean)
  )].slice(0, 10);

  return (
    <Link
      href={`/sheet/${sheet.id}`}
      className="flex items-center gap-4 px-4 py-3 rounded-xl border border-[var(--line)] bg-white
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
            <div className="text-[10px] text-[var(--ink-faint)]">{sheet.ratingCount} avis</div>
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
            par {sheet.ownerName || 'Anonyme'}
          </span>
          {sheet.difficulty && (
            <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-[var(--ink-faint)] rounded">
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
              Capo {sheet.capo}
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
            title={isBookmarked ? 'Retirer du book' : 'Ajouter au book'}
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

export default function SongPage({ params }: { params: Promise<PageParams> }) {
  const { title: encodedTitle, artist: encodedArtist } = use(params);
  const title = decodeURIComponent(encodedTitle);
  const artist = decodeURIComponent(encodedArtist);

  const { user } = useAuth();
  const { isBookmarked, toggleBookmark } = useBookmarks(user?.id);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [loading, setLoading] = useState(true);
  const { artworkUrl } = useArtwork(artist, title);

  useEffect(() => {
    async function load() {
      try {
        const db = getDb();
        const q = query(
          collection(db, 'sheets'),
          where('isPublic', '==', true),
          where('artist', '==', artist)
        );
        const snapshot = await getDocs(q);
        const titleNorm = title.trim().toLowerCase();
        const loaded: Sheet[] = snapshot.docs
          .map((d) => fromFirestore(d.id, d.data()))
          .filter((s) => s.title.trim().toLowerCase() === titleNorm);
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
  }, [title, artist]);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      {/* Retour */}
      <Link
        href="/explore"
        className="text-sm text-[var(--ink-faint)] hover:text-[var(--accent)] transition-colors mb-6 inline-flex items-center gap-1"
      >
        ← Explorer
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
              {sheets.length} version{sheets.length > 1 ? 's' : ''} disponible{sheets.length > 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>

      {/* Liste des versions */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl border border-[var(--line)] bg-white animate-pulse" />
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
        <div className="bg-white rounded-xl border border-[var(--line)] p-8 text-center text-[var(--ink-faint)]">
          <p>Aucune version trouvée.</p>
          <Link href="/explore" className="mt-4 inline-block text-sm text-[var(--accent)] hover:underline">
            Retour à Explorer
          </Link>
        </div>
      )}
    </div>
  );
}
