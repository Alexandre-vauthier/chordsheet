'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

import { doc, getDoc, updateDoc, increment, deleteDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/lib/auth-context';
import { getDb } from '@/lib/firebase';
import { fromFirestore } from '@/lib/firestore-helpers';
import { useBookmarks } from '@/lib/use-bookmarks';
import { useRatings } from '@/lib/use-ratings';
import { useLiveSession } from '@/lib/live-session-context';
import { SheetViewer } from '@/components/sheet/sheet-viewer';
import { SheetComments } from '@/components/sheet/sheet-comments';
import { useAddToCollection } from '@/lib/add-to-collection-context';
import { useSheetComments } from '@/lib/use-sheet-comments';
import { RatingStars } from '@/components/sheet/rating-stars';

import type { Sheet } from '@/types';
import { Link, useRouter } from '@/i18n/navigation';

interface SheetViewClientProps {
  id: string;
}

export function SheetViewClient({ id }: SheetViewClientProps) {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const { isBookmarked, toggleBookmark } = useBookmarks(user?.id);
  const { userRating, rateSheet, isLoading: ratingLoading } = useRatings(id, user?.id);
  const { setViewedSheet } = useLiveSession();
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTogglingBookmark, setIsTogglingBookmark] = useState(false);
  const [commentInvite, setCommentInvite] = useState(false);
  const [pendingRating, setPendingRating] = useState<1 | 2 | 3 | 4 | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { openAddTo } = useAddToCollection();
  const comments = useSheetComments(sheet?.id, sheet?.ownerId, sheet?.title);

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
        if (!data.isPublic && !data.isUnlisted && data.ownerId !== user?.id && !isAdmin) {
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
  }, [id, user, isAdmin]);

  // Signale au contexte de session live quelle grille est consultée, pour que la
  // bannière puisse proposer un envoi direct en un clic (seules les grilles
  // publiques sont lisibles par des invités anonymes, donc les seules envoyables)
  useEffect(() => {
    if (sheet?.isPublic) {
      setViewedSheet({ id, title: sheet.title, artist: sheet.artist });
    } else {
      setViewedSheet(null);
    }
    return () => setViewedSheet(null);
  }, [id, sheet, setViewedSheet]);

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

  const applyRating = useCallback(async (rating: 1 | 2 | 3 | 4 | 5) => {
    try {
      const isNew = !userRating; // ne notifie que la 1re note, pas les changements
      await rateSheet(rating);
      setSheet((prev) => {
        if (!prev) return prev;
        const newCount = userRating ? prev.ratingCount : (prev.ratingCount || 0) + 1;
        const oldAvg = prev.averageRating || 0;
        const oldRating = userRating || 0;
        const newAvg = userRating
          ? (oldAvg * prev.ratingCount - oldRating + rating) / prev.ratingCount
          : (oldAvg * (prev.ratingCount || 0) + rating) / newCount;
        return { ...prev, averageRating: Math.round(newAvg * 10) / 10, ratingCount: newCount };
      });
      // Notifie l'auteur d'une nouvelle note reçue (jamais pour soi-même).
      if (isNew && user && sheet && sheet.ownerId && sheet.ownerId !== user.id) {
        await addDoc(collection(getDb(), 'notifications'), {
          userId: sheet.ownerId,
          fromId: user.id,
          fromName: user.displayName || 'Utilisateur',
          sheetId: sheet.id,
          sheetTitle: sheet.title || '',
          kind: 'rating',
          rating,
          createdAt: serverTimestamp(),
          read: false,
        }).catch(() => {});
      }
    } catch (err) {
      console.error('Error rating sheet:', err);
    }
  }, [rateSheet, userRating, user, sheet]);

  const handleRate = async (rating: 1 | 2 | 3 | 4 | 5) => {
    // Une note < 5 n'est acceptée que si l'utilisateur a laissé un commentaire :
    // sinon on met la note en attente et on invite à expliquer pourquoi (constructif).
    if (rating < 5 && !comments.hasCommented) {
      setPendingRating(rating as 1 | 2 | 3 | 4);
      setCommentInvite(true);
      setTimeout(() => document.getElementById('sheet-comments')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
      return;
    }
    await applyRating(rating);
  };

  // Note < 5 mise en attente : appliquée dès que le commentaire est envoyé.
  useEffect(() => {
    if (comments.hasCommented && pendingRating != null) {
      const r = pendingRating;
      setPendingRating(null);
      applyRating(r);
    }
  }, [comments.hasCommented, pendingRating, applyRating]);

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
                  <RatingStars value={sheet.averageRating} readonly variant="summary" size="sm" showCount={sheet.ratingCount} />
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
              <div className="absolute right-0 top-full mt-1 z-50 bg-[var(--cell-bg)] border border-[var(--line)] rounded-xl shadow-lg py-1 min-w-max whitespace-nowrap">
                {/* Pictos : SVG inline uniformes (w-4 h-4, stroke currentColor), comme
                    partout ailleurs — les emojis rendaient des tailles et des styles
                    différents d'une ligne à l'autre selon la police système. */}
                <button
                  onClick={() => { handlePrint(); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm text-[var(--ink)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] transition-colors"
                >
                  <svg className="w-4 h-4 shrink-0 text-[var(--ink-faint)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Imprimer / PDF
                </button>
                {user && (
                  <button
                    onClick={() => { handleToggleBookmark(); setMenuOpen(false); }}
                    disabled={isTogglingBookmark}
                    className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] transition-colors ${sheetIsBookmarked ? 'text-amber-500' : 'text-[var(--ink)]'}`}
                  >
                    <svg className="w-4 h-4 shrink-0" fill={sheetIsBookmarked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                    {sheetIsBookmarked ? 'Dans mes favoris' : 'Ajouter aux favoris'}
                  </button>
                )}
                {user && sheet && (
                  <>
                    {/* Même modale que les cartes d'Explore et la page groupe :
                        elle gère la création de set à la volée et le rattachement. */}
                    <button
                      onClick={() => { setMenuOpen(false); openAddTo(sheet, 'set'); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm text-[var(--ink)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] transition-colors"
                    >
                      <svg className="w-4 h-4 shrink-0 text-[var(--ink-faint)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h10M4 18h10M18 14v6m3-3h-6" />
                      </svg>
                      Ajouter à un set
                    </button>
                    <button
                      onClick={() => { setMenuOpen(false); openAddTo(sheet, 'group'); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm text-[var(--ink)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] transition-colors"
                    >
                      <svg className="w-4 h-4 shrink-0 text-[var(--ink-faint)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-1a4 4 0 00-3-3.87M9 20H4v-1a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6-4a3 3 0 11-3-3M7 11a3 3 0 11-3-3" />
                      </svg>
                      Ajouter à un groupe
                    </button>
                  </>
                )}
                {user && !isActualOwner && (
                  <button
                    onClick={() => { handleFork(); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm text-[var(--ink)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] transition-colors"
                  >
                    <svg className="w-4 h-4 shrink-0 text-[var(--ink-faint)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Dupliquer
                  </button>
                )}
                {isOwner && (
                  <Link
                    href={`/sheet/${id}/edit`}
                    onClick={() => setMenuOpen(false)}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm text-[var(--ink)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] transition-colors"
                  >
                    <svg className="w-4 h-4 shrink-0 text-[var(--ink-faint)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Modifier
                  </Link>
                )}
                {isAdmin && (
                  <>
                    <div className="my-1 border-t border-[var(--line)]" />
                    <button
                      onClick={() => { handleAdminDelete(); setMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Supprimer
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Contenu */}
      <SheetViewer
        sheet={sheet}
        isBookmarked={sheetIsBookmarked}
        onToggleBookmark={user ? handleToggleBookmark : undefined}
        isTogglingBookmark={isTogglingBookmark}
      />

      {sheet.id && <SheetComments sheetId={sheet.id} invite={commentInvite} state={comments} />}
    </>
  );
}
