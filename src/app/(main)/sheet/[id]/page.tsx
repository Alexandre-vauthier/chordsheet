'use client';

import { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { doc, getDoc, updateDoc, increment, deleteDoc } from 'firebase/firestore';
import { useAuth } from '@/lib/auth-context';
import { getDb } from '@/lib/firebase';
import { fromFirestore } from '@/lib/firestore-helpers';
import { useBookmarks } from '@/lib/use-bookmarks';
import { useRatings } from '@/lib/use-ratings';
import { SheetViewer } from '@/components/sheet/sheet-viewer';
import { RatingStars } from '@/components/sheet/rating-stars';

import type { Sheet } from '@/types';

interface ViewSheetPageProps {
  params: Promise<{ id: string }>;
}

export default function ViewSheetPage({ params }: ViewSheetPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const { isBookmarked, toggleBookmark } = useBookmarks(user?.id);
  const { userRating, rateSheet, isLoading: ratingLoading } = useRatings(id, user?.id);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTogglingBookmark, setIsTogglingBookmark] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  useEffect(() => {
    async function loadSheet() {
      try {
        const db = getDb();
        const docRef = doc(db, 'sheets', id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          setError('Grille non trouvée');
          return;
        }

        const data = docSnap.data();

        // Vérifier les droits d'accès
        if (!data.isPublic && !data.isUnlisted && data.ownerId !== user?.id) {
          setError('Cette grille est privée');
          return;
        }

        setSheet(fromFirestore(docSnap.id, data));

        // Incrémenter le compteur de vues (seulement pour les grilles publiques)
        if (data.isPublic) {
          updateDoc(docRef, {
            viewCount: increment(1),
          }).catch((err) => console.error('Error incrementing view count:', err));
        }
      } catch (err) {
        console.error('Error loading sheet:', err);
        setError('Erreur lors du chargement');
      } finally {
        setLoading(false);
      }
    }

    loadSheet();
  }, [id, user]);

  const handlePrint = () => {
    window.print();
  };

  const handleAdminDelete = async () => {
    if (!confirm('Supprimer cette grille ? Cette action est irréversible.')) return;
    try {
      await deleteDoc(doc(getDb(), 'sheets', id));
      router.push('/explore');
    } catch (err) {
      console.error('Error deleting sheet:', err);
      alert('Erreur lors de la suppression');
    }
  };

  const handleFork = () => {
    if (!sheet) return;
    router.push(`/sheet/new?forkFrom=${sheet.id}`);
  };

  const handleToggleBookmark = async () => {
    if (!user || !sheet?.id) return;
    setIsTogglingBookmark(true);
    try {
      await toggleBookmark(sheet.id);
    } finally {
      setIsTogglingBookmark(false);
    }
  };

  const handleRate = async (rating: 1 | 2 | 3 | 4 | 5) => {
    try {
      await rateSheet(rating);
      // Mettre à jour l'état local du sheet
      if (sheet) {
        const newCount = userRating ? sheet.ratingCount : (sheet.ratingCount || 0) + 1;
        const oldAvg = sheet.averageRating || 0;
        const oldRating = userRating || 0;
        const newAvg = userRating
          ? (oldAvg * sheet.ratingCount - oldRating + rating) / sheet.ratingCount
          : (oldAvg * (sheet.ratingCount || 0) + rating) / newCount;

        setSheet({
          ...sheet,
          averageRating: Math.round(newAvg * 10) / 10,
          ratingCount: newCount,
        });
      }
    } catch (err) {
      console.error('Error rating sheet:', err);
    }
  };

  const sheetIsBookmarked = sheet?.id ? isBookmarked(sheet.id) : false;

  // Fermer le menu "..." au clic extérieur
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--accent)] border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={() => router.push('/dashboard')}
          className="text-[var(--accent)] hover:underline"
        >
          Retour au dashboard
        </button>
      </div>
    );
  }

  if (!sheet) return null;

  const isOwner = user?.id === sheet.ownerId || isAdmin;
  const isActualOwner = user?.id === sheet.ownerId;
  const canRate = user && !isActualOwner && sheet.isPublic;

  return (
    <>
      {/* Barre unique : avis + notation + menu "..." */}
      <div className="bg-[var(--cell-bg)] border-b border-[var(--line)] py-2.5 px-4 sm:px-6 print:hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex items-center gap-3">

          {/* Gauche : note moyenne + vues */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {sheet.isPublic && (
              <>
                <div className="flex items-center gap-1.5">
                  <RatingStars value={sheet.averageRating} readonly size="sm" showCount={sheet.ratingCount} />
                </div>
                {sheet.viewCount > 0 && (
                  <span className="text-xs text-[var(--ink-faint)] whitespace-nowrap">
                    {sheet.viewCount} vue{sheet.viewCount > 1 ? 's' : ''}
                  </span>
                )}
              </>
            )}
          </div>

          {/* Centre : noter cette grille */}
          {canRate && !ratingLoading && (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs text-[var(--ink-light)] hidden sm:inline">
                {userRating ? 'Ma note :' : 'Noter :'}
              </span>
              <RatingStars value={userRating} onChange={handleRate} size="sm" />
            </div>
          )}

          {/* Droite : menu "..." */}
          <div className="relative shrink-0" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="w-8 h-8 flex items-center justify-center rounded-full text-[var(--ink-light)] hover:bg-[var(--line)] hover:text-[var(--ink)] transition-colors text-lg leading-none"
              title="Actions"
            >
              •••
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-[var(--cell-bg)] border border-[var(--line)] rounded-xl shadow-lg py-1 min-w-[180px]">
                <button
                  onClick={() => { handlePrint(); setMenuOpen(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-[var(--ink)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] transition-colors"
                >
                  🖨 Imprimer / PDF
                </button>
                {user && (
                  <button
                    onClick={() => { handleToggleBookmark(); setMenuOpen(false); }}
                    disabled={isTogglingBookmark}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] transition-colors ${sheetIsBookmarked ? 'text-amber-500' : 'text-[var(--ink)]'}`}
                  >
                    {sheetIsBookmarked ? '★ Dans mon book' : '☆ Ajouter au book'}
                  </button>
                )}
                {user && !isActualOwner && (
                  <button
                    onClick={() => { handleFork(); setMenuOpen(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-[var(--ink)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] transition-colors"
                  >
                    ⎘ Dupliquer
                  </button>
                )}
                {isOwner && (
                  <Link
                    href={`/sheet/${id}/edit`}
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2.5 text-sm text-[var(--ink)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] transition-colors"
                  >
                    ✏ Modifier
                  </Link>
                )}
                {isAdmin && (
                  <>
                    <div className="my-1 border-t border-[var(--line)]" />
                    <button
                      onClick={() => { handleAdminDelete(); setMenuOpen(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                      🗑 Supprimer
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Contenu */}
      <SheetViewer sheet={sheet} />
    </>
  );
}
