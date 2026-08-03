'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';

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
  /**
   * Grille déjà lue côté serveur, quand elle est publique ou non répertoriée, et
   * **privée de ses paroles**. Fournie, la page est complète dès le premier rendu,
   * donc présente dans le HTML servi, donc lisible par un moteur — au lieu
   * d'attendre l'hydratation.
   *
   * La lecture client continue malgré tout : c'est elle qui incrémente le compteur
   * de vues et qui ramène les paroles. Absente (grille privée, ou lecture serveur
   * indisponible), elle reste seule aux commandes, comme avant.
   */
  initialSheet?: Sheet | null;
}

/** Picto de menu : même gabarit partout, seul le tracé change. */
function Icon({ d }: { d: string }) {
  return (
    <svg className="w-4 h-4 shrink-0 text-[var(--ink-faint)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
    </svg>
  );
}

/**
 * Une entrée du menu d'actions.
 *
 * Sans compte, l'entrée reste **visible** mais mène à la connexion, et le cadenas le
 * dit avant le clic. C'est la différence entre montrer ce que le site sait faire et
 * piéger : découvrir l'obstacle après avoir cliqué agace, le voir avant donne une
 * raison de s'inscrire.
 */
function MenuEntry({
  icon,
  label,
  locked,
  lockedHref,
  onClick,
  tone = 'normal',
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  locked?: boolean;
  lockedHref?: string;
  onClick?: () => void;
  tone?: 'normal' | 'active';
  disabled?: boolean;
}) {
  const base =
    'w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]';
  const colour = tone === 'active' ? 'text-amber-500' : 'text-[var(--ink)]';

  const body = (
    <>
      {icon}
      <span className="flex-1">{label}</span>
      {locked && (
        <svg className="w-3.5 h-3.5 shrink-0 text-[var(--ink-faint)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      )}
    </>
  );

  if (locked && lockedHref) {
    return (
      <Link href={lockedHref} className={`${base} ${colour}`}>
        {body}
      </Link>
    );
  }

  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${colour}`}>
      {body}
    </button>
  );
}

export function SheetViewClient({ id, initialSheet }: SheetViewClientProps) {
  const t = useTranslations('SheetView');
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const { isBookmarked, toggleBookmark } = useBookmarks(user?.id);
  const { userRating, rateSheet, isLoading: ratingLoading } = useRatings(id, user?.id);
  const { setViewedSheet } = useLiveSession();
  const [sheet, setSheet] = useState<Sheet | null>(initialSheet ?? null);
  const [loading, setLoading] = useState(!initialSheet);
  const [error, setError] = useState<string | null>(null);
  const [isTogglingBookmark, setIsTogglingBookmark] = useState(false);
  const [commentInvite, setCommentInvite] = useState(false);
  const [pendingRating, setPendingRating] = useState<1 | 2 | 3 | 4 | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { openAddTo } = useAddToCollection();
  const comments = useSheetComments(sheet?.id, sheet?.ownerId, sheet?.title);

  /** Appartenance au groupe de la grille, quand elle en a un. */
  const [estMembreDuGroupe, setEstMembreDuGroupe] = useState(false);

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
          setError(t('notFound'));
          return;
        }


        const data = docSnap.data();

        /**
         * Droits d'accès : propriétaire, admin, ou **membre du groupe** quand la
         * grille appartient à un groupe.
         *
         * Ce dernier cas manquait, alors que les règles Firestore l'autorisent
         * depuis toujours et que l'écran d'édition le vérifiait déjà. La lecture
         * réussissait donc, et c'est l'application elle-même qui refusait ensuite
         * d'afficher la grille : un membre voyait « grille privée » sur une
         * composition de son propre groupe, qu'il pouvait pourtant modifier.
         */
        let autorise = !!data.isPublic || !!data.isUnlisted || data.ownerId === user?.id || isAdmin;
        if (data.groupId && user) {
          const groupSnap = await getDoc(doc(db, 'groups', data.groupId as string));
          const membre = ((groupSnap.data()?.memberIds as string[]) || []).includes(user.id);
          setEstMembreDuGroupe(membre);
          autorise = autorise || membre;
        }
        if (!autorise) {
          setError(t('private'));
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
        // Le serveur a déjà fourni la grille : un échec de relecture ne doit pas
        // effacer une page qui s'affiche correctement, il ne coûte que les paroles
        // et l'incrément de vue.
        if (!initialSheet) setError(t('loadFailed'));
      } finally {
        setLoading(false);
      }
    }

    loadSheet();
  }, [id, user, isAdmin, initialSheet]);

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
    if (!confirm(t('deleteConfirm'))) return;
    try {
      await deleteDoc(doc(getDb(), 'sheets', id));
      router.push('/explore');
    } catch (err) {
      console.error('Error deleting sheet:', err);
      alert(t('deleteFailed'));
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
          fromName: user.displayName || t('anonymous'),
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
          {t('backToDashboard')}
        </button>
      </div>
    );
  }

  if (!sheet) return null;

  /**
   * Qui a la main sur cette grille.
   *
   * Une grille de groupe n'appartient à personne en particulier : son `ownerId` est
   * l'identifiant du groupe. Sans la seconde branche, aucun membre ne verrait plus
   * le bouton de modification d'une grille qu'il a pourtant le droit de modifier.
   */
  const isOwner = user?.id === sheet.ownerId || isAdmin || (!!sheet.groupId && estMembreDuGroupe);
  const isActualOwner = user?.id === sheet.ownerId;
  const canRate = user && !isActualOwner && sheet.isPublic;

  // Destination des entrées verrouillées : la connexion, en retenant la grille pour
  // y revenir ensuite. Sans ça on renvoie la personne à l'accueil après l'effort de
  // s'inscrire, et elle doit retrouver seule la grille qui l'avait amenée.
  const loginHref = `/login?next=${encodeURIComponent(`/sheet/${id}`)}`;

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
                {userRating ? t('myRating') : t('rate')}
              </span>
              <RatingStars value={userRating} onChange={handleRate} size="sm" />
            </div>
          )}

          {/* Droite : menu "..." */}
          <div className="relative shrink-0" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="w-8 h-8 flex items-center justify-center rounded-full text-[var(--ink-light)] hover:bg-[var(--line)] hover:text-[var(--ink)] transition-colors text-lg leading-none"
              title={t("actions")}
            >
              •••
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-[var(--cell-bg)] border border-[var(--line)] rounded-xl shadow-lg py-1 min-w-max whitespace-nowrap">
                {/* Pictos : SVG inline uniformes (w-4 h-4, stroke currentColor), comme
                    partout ailleurs — les emojis rendaient des tailles et des styles
                    différents d'une ligne à l'autre selon la police système. */}
                <MenuEntry
                  icon={<Icon d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />}
                  label={t('print')}
                  locked={!user}
                  lockedHref={loginHref}
                  onClick={() => { handlePrint(); setMenuOpen(false); }}
                />
                <MenuEntry
                  icon={
                    <svg className="w-4 h-4 shrink-0" fill={sheetIsBookmarked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  }
                  label={sheetIsBookmarked ? t('bookmarked') : t('bookmarkAdd')}
                  tone={sheetIsBookmarked ? 'active' : 'normal'}
                  locked={!user}
                  lockedHref={loginHref}
                  disabled={isTogglingBookmark}
                  onClick={() => { handleToggleBookmark(); setMenuOpen(false); }}
                />
                {sheet && (
                  <>
                    {/* Même modale que les cartes d'Explore et la page groupe :
                        elle gère la création de set à la volée et le rattachement. */}
                    <MenuEntry
                      icon={<Icon d="M4 6h16M4 10h16M4 14h10M4 18h10M18 14v6m3-3h-6" />}
                      label={t('addToSet')}
                      locked={!user}
                      lockedHref={loginHref}
                      onClick={() => { setMenuOpen(false); openAddTo(sheet, 'set'); }}
                    />
                    <MenuEntry
                      icon={<Icon d="M17 20h5v-1a4 4 0 00-3-3.87M9 20H4v-1a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6-4a3 3 0 11-3-3M7 11a3 3 0 11-3-3" />}
                      label={t('addToGroup')}
                      locked={!user}
                      lockedHref={loginHref}
                      onClick={() => { setMenuOpen(false); openAddTo(sheet, 'group'); }}
                    />
                  </>
                )}
                {!isActualOwner && (
                  <MenuEntry
                    icon={<Icon d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />}
                    label={t('duplicate')}
                    locked={!user}
                    lockedHref={loginHref}
                    onClick={() => { handleFork(); setMenuOpen(false); }}
                  />
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
                    {t('edit')}
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
                      {t('delete')}
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
