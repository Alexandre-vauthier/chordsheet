'use client';

import { useState, useEffect, use } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import Link from 'next/link';
import { getDb } from '@/lib/firebase';
import { fromFirestore } from '@/lib/firestore-helpers';
import { useBookmarks } from '@/lib/use-bookmarks';
import { useAuth } from '@/lib/auth-context';
import { SheetCard } from '@/components/explore/sheet-card';
import { useArtwork } from '@/lib/use-artwork';
import type { Sheet } from '@/types';

interface PageParams {
  title: string;
  artist: string;
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
          where('title', '==', title),
          where('artist', '==', artist)
        );
        const snapshot = await getDocs(q);
        const loaded: Sheet[] = snapshot.docs.map((d) => fromFirestore(d.id, d.data()));
        // Tri par note décroissante, puis par date
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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/explore"
          className="text-sm text-[var(--ink-faint)] hover:text-[var(--accent)] transition-colors mb-4 inline-flex items-center gap-1"
        >
          ← Explorer
        </Link>

        <div className="flex items-center gap-4 mt-3">
          {artworkUrl && (
            <img
              src={artworkUrl}
              alt={`${artist} — ${title}`}
              className="w-16 h-16 rounded-lg shadow object-cover flex-shrink-0"
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
          </div>
        </div>

        {!loading && (
          <p className="text-sm text-[var(--ink-faint)] mt-3">
            {sheets.length} version{sheets.length > 1 ? 's' : ''} disponible{sheets.length > 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Versions */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-[var(--line)] h-48 animate-pulse" />
          ))}
        </div>
      ) : sheets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sheets.map((sheet) => (
            <SheetCard
              key={sheet.id}
              sheet={sheet}
              showOwner
              showRating
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
