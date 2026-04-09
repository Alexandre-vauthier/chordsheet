'use client';

import { useState, useEffect, useMemo, use } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '@/lib/auth-context';
import { getDb } from '@/lib/firebase';
import { fromFirestore } from '@/lib/firestore-helpers';
import { useBookmarks } from '@/lib/use-bookmarks';
import { useArtwork } from '@/lib/use-artwork';
import { SheetCard } from '@/components/explore/sheet-card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import type { Sheet } from '@/types';

interface ArtistPageProps {
  params: Promise<{ name: string }>;
}

export default function ArtistPage({ params }: ArtistPageProps) {
  const { name } = use(params);
  const artistName = decodeURIComponent(name);
  const { user } = useAuth();
  const { isBookmarked, toggleBookmark } = useBookmarks(user?.id);
  const { artworkUrl } = useArtwork(artistName, undefined);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [artistName]);

  useEffect(() => {
    async function loadSheets() {
      try {
        const db = getDb();
        const q = query(
          collection(db, 'sheets'),
          where('isPublic', '==', true),
          where('artist', '==', artistName)
        );
        const snapshot = await getDocs(q);
        const results = snapshot.docs.map(d => fromFirestore(d.id, d.data()));
        results.sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0));
        setSheets(results);
      } catch (error) {
        console.error('Error loading artist sheets:', error);
      } finally {
        setLoading(false);
      }
    }

    loadSheets();
  }, [artistName]);

  // Grouper par titre → une seule entrée par musique
  const grouped = useMemo(() => {
    const groups = new Map<string, Sheet[]>();
    for (const sheet of sheets) {
      const key = sheet.title.toLowerCase();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(sheet);
    }
    return Array.from(groups.values()).map((group) => ({
      sheet: group[0],
      count: group.length,
      href: group.length === 1
        ? `/sheet/${group[0].id}`
        : `/song/${encodeURIComponent(group[0].title)}/${encodeURIComponent(artistName)}`,
    }));
  }, [sheets, artistName]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Header artiste */}
      <div className="flex items-center gap-6 mb-8">
        <div className="flex-shrink-0 w-28 h-28 rounded-full overflow-hidden bg-gradient-to-br from-[var(--cell-bg)] to-[var(--line)] shadow-lg">
          {artworkUrl ? (
            <img
              src={artworkUrl}
              alt={artistName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[var(--ink-faint)] text-4xl">
              ♫
            </div>
          )}
        </div>
        <div>
          <h1 className="font-playfair text-3xl font-bold text-[var(--ink)]">
            {artistName}
          </h1>
          <p className="text-[var(--ink-light)] mt-1">
            {loading
              ? 'Chargement…'
              : `${grouped.length} titre${grouped.length > 1 ? 's' : ''}${sheets.length > grouped.length ? ` · ${sheets.length} versions` : ''}`
            }
          </p>
        </div>
      </div>

      {/* Grilles */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-xl border border-[var(--line)] h-48 animate-pulse" />
          ))}
        </div>
      ) : grouped.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {grouped.map(({ sheet, count, href }) => (
            <SheetCard
              key={`${sheet.title}`}
              sheet={sheet}
              showRating
              href={href}
              variantCount={count}
              hideArtwork
              isBookmarked={sheet.id ? isBookmarked(sheet.id) : false}
              onToggleBookmark={user && sheet.id ? () => toggleBookmark(sheet.id!) : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[var(--line)] p-8 text-center">
          <p className="text-[var(--ink-faint)]">Aucune grille publique pour cet artiste</p>
          <Link href="/explore" className="mt-4 inline-block">
            <Button variant="ghost">Retour à l&apos;exploration</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
