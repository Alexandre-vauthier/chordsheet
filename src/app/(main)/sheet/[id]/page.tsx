'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { useAuth } from '@/lib/auth-context';
import { getDb } from '@/lib/firebase';
import { fromFirestore } from '@/lib/firestore-helpers';
import { useBookmarks } from '@/lib/use-bookmarks';
import { useRatings } from '@/lib/use-ratings';
import { SheetViewer } from '@/components/sheet/sheet-viewer';
import { RatingStars } from '@/components/sheet/rating-stars';
import { Button } from '@/components/ui/button';
import type { Sheet } from '@/types';

interface ViewSheetPageProps {
  params: Promise<{ id: string }>;
}

export default function ViewSheetPage({ params }: ViewSheetPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const { isBookmarked, toggleBookmark } = useBookmarks(user?.id);
  const { userRating, rateSheet, isLoading: ratingLoading } = useRatings(id, user?.id);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTogglingBookmark, setIsTogglingBookmark] = useState(false);

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
        if (!data.isPublic && data.ownerId !== user?.id) {
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

  const isOwner = user?.id === sheet.ownerId;
  const canRate = user && !isOwner && sheet.isPublic;

  return (
    <>
      {/* Barre d'actions (masquée à l'impression) */}
      <div className="bg-white border-b border-[var(--line)] py-3 px-6 print:hidden">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => router.back()}>
              ← Retour
            </Button>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <Button
                variant="ghost"
                onClick={handleToggleBookmark}
                disabled={isTogglingBookmark}
                className={sheetIsBookmarked ? 'text-amber-500' : ''}
              >
                {sheetIsBookmarked ? '★ Dans mon book' : '☆ Ajouter à mon book'}
              </Button>
            )}
            {isOwner && (
              <Link href={`/sheet/${id}/edit`}>
                <Button variant="ghost">Modifier</Button>
              </Link>
            )}
            <Button onClick={handlePrint}>
              Imprimer / PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Section notation (masquée à l'impression) */}
      {sheet.isPublic && (
        <div className="bg-gray-50 border-b border-[var(--line)] py-3 px-6 print:hidden">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Note moyenne */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--ink-light)]">Note :</span>
                <RatingStars
                  value={sheet.averageRating}
                  readonly
                  size="md"
                  showCount={sheet.ratingCount}
                />
              </div>

              {/* Vues */}
              {sheet.viewCount > 0 && (
                <span className="text-sm text-[var(--ink-faint)]">
                  {sheet.viewCount} vue{sheet.viewCount > 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Noter cette grille */}
            {canRate && !ratingLoading && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--ink-light)]">
                  {userRating ? 'Votre note :' : 'Noter cette grille :'}
                </span>
                <RatingStars
                  value={userRating}
                  onChange={handleRate}
                  size="md"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Contenu */}
      <SheetViewer sheet={sheet} />
    </>
  );
}
