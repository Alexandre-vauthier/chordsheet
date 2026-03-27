'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import { useAuth } from '@/lib/auth-context';
import { getDb } from '@/lib/firebase';
import { fromFirestore } from '@/lib/firestore-helpers';
import { useBookmarks } from '@/lib/use-bookmarks';
import { Input } from '@/components/ui/input';
import { SheetCard } from '@/components/explore/sheet-card';
import type { Sheet } from '@/types';

export default function ExplorePage() {
  const { user } = useAuth();
  const { isBookmarked, toggleBookmark } = useBookmarks(user?.id);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function loadPublicSheets() {
      try {
        const db = getDb();
        const q = query(
          collection(db, 'sheets'),
          where('isPublic', '==', true),
          orderBy('updatedAt', 'desc'),
          limit(50)
        );

        const snapshot = await getDocs(q);
        const loadedSheets: Sheet[] = snapshot.docs.map((docSnap) =>
          fromFirestore(docSnap.id, docSnap.data())
        );

        setSheets(loadedSheets);
      } catch (error) {
        console.error('Error loading public sheets:', error);
      } finally {
        setLoading(false);
      }
    }

    loadPublicSheets();
  }, []);

  // Filtrer les grilles selon la recherche
  const filteredSheets = useMemo(() => {
    if (!searchQuery.trim()) return sheets;

    const query = searchQuery.toLowerCase();
    return sheets.filter(
      (sheet) =>
        sheet.title.toLowerCase().includes(query) ||
        sheet.artist.toLowerCase().includes(query) ||
        sheet.ownerName.toLowerCase().includes(query) ||
        sheet.key.toLowerCase().includes(query)
    );
  }, [sheets, searchQuery]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--ink)]">Explorer</h1>
        <p className="text-[var(--ink-light)] mt-1">
          Découvrez les grilles partagées par la communauté
          {sheets.length > 0 && ` (${sheets.length} grille${sheets.length > 1 ? 's' : ''})`}
        </p>
      </div>

      {/* Barre de recherche */}
      <div className="flex gap-4 mb-8">
        <div className="flex-1">
          <Input
            type="search"
            placeholder="Rechercher par titre, artiste, tonalité..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-[var(--line)] h-48 animate-pulse"
            />
          ))}
        </div>
      ) : filteredSheets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSheets.map((sheet) => (
            <SheetCard
              key={sheet.id}
              sheet={sheet}
              showOwner
              isBookmarked={sheet.id ? isBookmarked(sheet.id) : false}
              onToggleBookmark={user && sheet.id ? () => toggleBookmark(sheet.id!) : undefined}
            />
          ))}
        </div>
      ) : sheets.length > 0 ? (
        <div className="bg-white rounded-xl border border-[var(--line)] p-8 text-center">
          <div className="text-[var(--ink-faint)]">
            <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-lg">Aucun résultat pour &quot;{searchQuery}&quot;</p>
            <p className="text-sm mt-1">Essayez avec d&apos;autres mots-clés</p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[var(--line)] p-8 text-center">
          <div className="text-[var(--ink-faint)]">
            <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            <p className="text-lg">Aucune grille publique pour le moment</p>
            <p className="text-sm mt-1">Soyez le premier à partager !</p>
          </div>
        </div>
      )}
    </div>
  );
}
