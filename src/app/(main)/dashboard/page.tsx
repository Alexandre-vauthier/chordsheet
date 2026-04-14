'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { collection, query, where, orderBy, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { useAuth } from '@/lib/auth-context';
import { getDb } from '@/lib/firebase';
import { fromFirestore } from '@/lib/firestore-helpers';
import { useBookmarks } from '@/lib/use-bookmarks';
import { Button } from '@/components/ui/button';
import { SheetCard } from '@/components/explore/sheet-card';
import type { Sheet } from '@/types';

type Tab = 'all' | 'mine' | 'book';

export default function DashboardPage() {
  const { user } = useAuth();
  const { bookmarkedSheets, isLoading: bookLoading, isBookmarked, toggleBookmark, removeBookmark } = useBookmarks(user?.id);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('all');

  useEffect(() => {
    async function loadSheets() {
      if (!user) return;

      try {
        const db = getDb();
        const q = query(
          collection(db, 'sheets'),
          where('ownerId', '==', user.id),
          orderBy('updatedAt', 'desc')
        );

        const snapshot = await getDocs(q);
        const loadedSheets: Sheet[] = snapshot.docs.map((docSnap) =>
          fromFirestore(docSnap.id, docSnap.data())
        );

        setSheets(loadedSheets);
      } catch (error) {
        console.error('Error loading sheets:', error);
      } finally {
        setLoading(false);
      }
    }

    loadSheets();
  }, [user]);

  const handleDelete = async (sheetId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette grille ?')) return;

    try {
      const db = getDb();
      await deleteDoc(doc(db, 'sheets', sheetId));
      setSheets((prev) => prev.filter((s) => s.id !== sheetId));
    } catch (error) {
      console.error('Error deleting sheet:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const handleRemoveBookmark = async (sheetId: string) => {
    if (!confirm('Retirer cette grille de votre book ?')) return;
    await removeBookmark(sheetId);
  };

  const isCurrentlyLoading = tab === 'mine' ? loading : tab === 'book' ? bookLoading : loading || bookLoading;

  // Onglet "Tout" : fusion dédupliquée (mes grilles + favoris)
  const ownedIds = new Set(sheets.map(s => s.id));
  const allSheets: Sheet[] = [
    ...sheets,
    ...bookmarkedSheets.filter(s => !ownedIds.has(s.id)),
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--ink)]">
            Mon book
          </h1>
          <p className="text-[var(--ink-light)] mt-1">
            {tab === 'all'
              ? allSheets.length > 0
                ? `${allSheets.length} grille${allSheets.length > 1 ? 's' : ''}`
                : 'Toutes vos grilles'
              : tab === 'mine'
                ? sheets.length > 0
                  ? `${sheets.length} grille${sheets.length > 1 ? 's' : ''} créée${sheets.length > 1 ? 's' : ''}`
                  : 'Gérez vos grilles d\'accords'
                : bookmarkedSheets.length > 0
                  ? `${bookmarkedSheets.length} grille${bookmarkedSheets.length > 1 ? 's' : ''} sauvegardée${bookmarkedSheets.length > 1 ? 's' : ''}`
                  : 'Vos grilles favorites'
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/explore" className="hidden sm:block">
            <Button variant="ghost">Explorer</Button>
          </Link>
          <Link href="/sheet/new" className="hidden sm:block">
            <Button>+ Nouvelle grille</Button>
          </Link>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 mb-6 bg-[var(--line)] rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('all')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'all'
              ? 'bg-[var(--cell-bg)] text-[var(--ink)] shadow-sm'
              : 'text-[var(--ink-light)] hover:text-[var(--ink)]'
          }`}
        >
          Tout
        </button>
        <button
          onClick={() => setTab('mine')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'mine'
              ? 'bg-[var(--cell-bg)] text-[var(--ink)] shadow-sm'
              : 'text-[var(--ink-light)] hover:text-[var(--ink)]'
          }`}
        >
          Mes grilles
        </button>
        <button
          onClick={() => setTab('book')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'book'
              ? 'bg-[var(--cell-bg)] text-[var(--ink)] shadow-sm'
              : 'text-[var(--ink-light)] hover:text-[var(--ink)]'
          }`}
        >
          Favoris
          {bookmarkedSheets.length > 0 && (
            <span className="ml-1.5 text-xs bg-[var(--accent)] text-white rounded-full px-1.5 py-0.5">
              {bookmarkedSheets.length}
            </span>
          )}
        </button>
      </div>

      {/* Contenu */}
      {isCurrentlyLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-[var(--cell-bg)] rounded-xl border border-[var(--line)] h-48 animate-pulse"
            />
          ))}
        </div>
      ) : tab === 'all' ? (
        /* Tout */
        allSheets.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {allSheets.map((sheet) => {
              const isOwned = ownedIds.has(sheet.id);
              return (
                <div key={sheet.id} className="relative group">
                  <SheetCard
                    sheet={sheet}
                    onDelete={isOwned ? () => handleDelete(sheet.id!) : undefined}
                    isBookmarked={sheet.id ? isBookmarked(sheet.id) : false}
                    onToggleBookmark={sheet.id ? () => toggleBookmark(sheet.id!) : undefined}
                    showOwner={!isOwned}
                    showPublicBadge={isOwned}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-[var(--cell-bg)] rounded-xl border border-[var(--line)] p-8 text-center">
            <div className="text-[var(--ink-faint)] mb-4">
              <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
              <p className="text-lg">Votre book est vide</p>
              <p className="text-sm mt-1">Créez une grille ou explorez-en depuis la communauté !</p>
            </div>
            <div className="flex gap-3 justify-center">
              <Link href="/sheet/new"><Button variant="primary">Créer une grille</Button></Link>
              <Link href="/explore"><Button variant="ghost">Explorer</Button></Link>
            </div>
          </div>
        )
      ) : tab === 'mine' ? (
        /* Mes grilles */
        sheets.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sheets.map((sheet) => (
              <SheetCard
                key={sheet.id}
                sheet={sheet}
                onDelete={() => handleDelete(sheet.id!)}
                isBookmarked={sheet.id ? isBookmarked(sheet.id) : false}
                onToggleBookmark={sheet.id ? () => toggleBookmark(sheet.id!) : undefined}
                showPublicBadge
              />
            ))}
          </div>
        ) : (
          <div className="bg-[var(--cell-bg)] rounded-xl border border-[var(--line)] p-8 text-center">
            <div className="text-[var(--ink-faint)] mb-4">
              <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
              <p className="text-lg">Aucune grille pour le moment</p>
              <p className="text-sm mt-1">Créez votre première grille d&apos;accords !</p>
            </div>
            <Link href="/sheet/new">
              <Button variant="primary">Créer ma première grille</Button>
            </Link>
          </div>
        )
      ) : (
        /* Favoris */
        bookmarkedSheets.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bookmarkedSheets.map((sheet) => (
              <div key={sheet.id} className="relative group">
                <SheetCard sheet={sheet} showOwner />
                <button
                  onClick={() => handleRemoveBookmark(sheet.id!)}
                  className="absolute top-2 right-2 p-2 bg-white/90 rounded-full shadow-sm
                    opacity-0 group-hover:opacity-100 transition-opacity
                    text-amber-500 hover:text-red-500"
                  title="Retirer du book"
                >
                  ★
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-[var(--cell-bg)] rounded-xl border border-[var(--line)] p-8 text-center">
            <div className="text-[var(--ink-faint)] mb-4">
              <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              <p className="text-lg">Aucun favori pour le moment</p>
              <p className="text-sm mt-1">Explorez les grilles et ajoutez vos favorites !</p>
            </div>
            <Link href="/explore">
              <Button variant="primary">Explorer les grilles</Button>
            </Link>
          </div>
        )
      )}
    </div>
  );
}
