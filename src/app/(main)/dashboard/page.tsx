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

export default function DashboardPage() {
  const { user } = useAuth();
  const { isBookmarked, toggleBookmark } = useBookmarks(user?.id);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--ink)]">
            Bonjour, {user?.displayName || 'Musicien'} !
          </h1>
          <p className="text-[var(--ink-light)] mt-1">
            {sheets.length > 0
              ? `Vous avez ${sheets.length} grille${sheets.length > 1 ? 's' : ''} d'accords`
              : 'Gérez vos grilles d\'accords'}
          </p>
        </div>
        <Link href="/sheet/new" className="hidden sm:block">
          <Button>+ Nouvelle grille</Button>
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-[var(--line)] h-48 animate-pulse"
            />
          ))}
        </div>
      ) : sheets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sheets.map((sheet) => (
            <SheetCard
              key={sheet.id}
              sheet={sheet}
              onDelete={() => handleDelete(sheet.id!)}
              isBookmarked={sheet.id ? isBookmarked(sheet.id) : false}
              onToggleBookmark={sheet.id ? () => toggleBookmark(sheet.id!) : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[var(--line)] p-8 text-center">
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
      )}
    </div>
  );
}
