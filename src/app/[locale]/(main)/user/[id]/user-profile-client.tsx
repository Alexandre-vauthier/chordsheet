'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import { fromFirestore } from '@/lib/firestore-helpers';
import { SheetCard } from '@/components/explore/sheet-card';
import { LevelBadge } from '@/components/reputation/level-badge';
import { BadgesDisplay } from '@/components/reputation/badges-display';
import { ReputationExplainer } from '@/components/reputation/reputation-explainer';
import { useBookmarks } from '@/lib/use-bookmarks';
import { useGenreLabel, useDifficultyLabel } from '@/lib/use-genre-labels';
import { useAuth } from '@/lib/auth-context';
import type { Sheet } from '@/types';
import { DIFFICULTY_LABELS } from '@/types';
import { computeScore, computeLevel, computeBadges, getLevelProgress } from '@/lib/creator-reputation';
import { Link } from '@/i18n/navigation';
import { SocialLinks } from '@/components/profile/social-links';

export interface PublicUser {
  displayName: string;
  photoURL: string | null;
  createdAt: Date | null;
  bio?: string;
  links?: { url: string }[];
}

type SortOption = 'recent' | 'rated' | 'viewed';

interface UserProfileClientProps {
  id: string;
  /**
   * Profil lu côté serveur. Indispensable : la collection `users` contient des
   * adresses e-mail, ses règles interdisent donc la lecture aux visiteurs non
   * connectés. Le serveur n'expose ici que les champs publics.
   */
  initialProfile: PublicUser | null;
  /**
   * Le profil a-t-il au moins une grille publique ? Connu du serveur avant que le
   * navigateur n'ait chargé quoi que ce soit — c'est lui qui autorise l'affichage
   * de la présentation et des liens dès le HTML servi.
   */
  hasPublicSheets: boolean;
}

export function UserProfileClient({ id, initialProfile, hasPublicSheets }: UserProfileClientProps) {
  const t = useTranslations('PublicProfile');
  const locale = useLocale();
  const genreLabel = useGenreLabel();
  const difficultyLabel = useDifficultyLabel();
  const { user } = useAuth();
  const { isBookmarked, toggleBookmark } = useBookmarks(user?.id);

  const [publicUser, setPublicUser] = useState<PublicUser | null>(initialProfile);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [filter, setFilter] = useState<'all' | 'bookmarked' | 'rated'>('all');

  useEffect(() => {
    async function load() {
      const db = getDb();

      // Charger les grilles publiques
      try {
        const q = query(
          collection(db, 'sheets'),
          where('ownerId', '==', id),
          where('isPublic', '==', true)
        );
        const snapshot = await getDocs(q);
        const loaded: Sheet[] = snapshot.docs.map(d => fromFirestore(d.id, d.data()));
        setSheets(loaded);

        setPublicUser(prev => prev ?? (loaded.length > 0 ? {
          displayName: loaded[0].ownerName || 'Anonyme',
          photoURL: null,
          createdAt: null,
        } : null));

        // Calculer et persister la réputation (cache pour navbar + explore)
        if (loaded.length > 0) {
          const score = computeScore(loaded);
          const level = computeLevel(score);
          const badges = computeBadges(loaded);
          setDoc(doc(db, 'users', id), {
            reputation: { score, level, badges, lastComputedAt: serverTimestamp() },
          }, { merge: true }).catch(() => {});
        }
      } catch {
        // ignore
      }

      setIsLoading(false);
    }

    load();
  }, [id]);

  // Réputation calculée côté client
  const reputation = (() => {
    const score = computeScore(sheets);
    const level = computeLevel(score);
    const badges = computeBadges(sheets);
    const progress = getLevelProgress(score);
    const totalBookmarks = sheets.reduce((acc, s) => acc + (s.bookmarkCount || 0), 0);
    return { score, level, badges, progress, totalBookmarks };
  })();

  // Stats calculées côté client
  const stats = (() => {
    const totalViews = sheets.reduce((acc, s) => acc + (s.viewCount || 0), 0);

    const ratedSheets = sheets.filter(s => s.averageRating !== null && s.ratingCount > 0);
    const totalWeight = ratedSheets.reduce((acc, s) => acc + s.ratingCount, 0);
    const weightedAvg = totalWeight > 0
      ? ratedSheets.reduce((acc, s) => acc + s.averageRating! * s.ratingCount, 0) / totalWeight
      : null;

    const genreCounts: Record<string, number> = {};
    sheets.forEach(s => s.genres?.forEach(g => { genreCounts[g] = (genreCounts[g] || 0) + 1; }));
    const topGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([g]) => g);

    const difficultyCounts = { 1: 0, 2: 0, 3: 0 };
    sheets.forEach(s => { if (s.difficulty && s.difficulty <= 3) difficultyCounts[s.difficulty as 1 | 2 | 3]++; });

    return { totalViews, weightedAvg, topGenres, difficultyCounts };
  })();

  // Tri
  const sortedSheets = [...sheets].sort((a, b) => {
    if (sortBy === 'rated') {
      if (a.averageRating === null) return 1;
      if (b.averageRating === null) return -1;
      return b.averageRating - a.averageRating;
    }
    if (sortBy === 'viewed') return (b.viewCount || 0) - (a.viewCount || 0);
    return (b.updatedAt?.getTime?.() || 0) - (a.updatedAt?.getTime?.() || 0);
  });

  // Filtre depuis les stats cliquables : favorisées (par d'autres) / notées.
  const visibleSheets = sortedSheets.filter(s =>
    filter === 'bookmarked' ? (s.bookmarkCount || 0) > 0 :
    filter === 'rated' ? (s.ratingCount || 0) > 0 :
    true
  );

  // On n'attend le chargement des grilles que si le serveur n'a rien pu donner :
  // quand il a le profil, l'en-tête part dans le HTML servi et seul le catalogue
  // arrive après coup.
  if (isLoading && !publicUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--accent)] border-t-transparent" />
      </div>
    );
  }

  if (!publicUser) {
    return (
      <div className="max-w-[1270px] mx-auto px-4 sm:px-6 py-16 text-center text-[var(--ink-faint)]">
        {t('notFound')}
      </div>
    );
  }

  const initial = publicUser.displayName.charAt(0).toUpperCase();

  return (
    <div className="max-w-[1270px] mx-auto px-4 sm:px-6 py-8">
      {/* Header auteur */}
      <div className="flex items-center gap-5 mb-8 pb-6 border-b-2 border-[var(--ink)]">
        <div className="w-16 h-16 rounded-full overflow-hidden bg-[var(--accent)] flex items-center justify-center text-white text-2xl font-bold shrink-0 shadow-md">
          {publicUser.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={publicUser.photoURL} alt="" className="w-full h-full object-cover" />
          ) : (
            initial
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-playfair text-2xl font-bold text-[var(--ink)]">
              {publicUser.displayName}
            </h1>
            {sheets.length > 0 && <LevelBadge level={reputation.level} size="md" />}
          </div>
          {publicUser.createdAt && (
            <p className="text-sm text-[var(--ink-faint)] mt-0.5">
              {t('memberSince', {
                date: publicUser.createdAt.toLocaleDateString(locale, { month: 'long', year: 'numeric' }),
              })}
            </p>
          )}

          {/* Badges */}
          {reputation.badges.length > 0 && (
            <div className="mt-2">
              <BadgesDisplay earned={reputation.badges} />
            </div>
          )}

          {/* Barre de progression vers le niveau suivant */}
          {sheets.length > 0 && reputation.progress.next && (
            <div className="mt-3 max-w-xs">
              <div className="flex justify-between text-[10px] text-[var(--ink-faint)] mb-1">
                <span>{reputation.level}</span>
                <span>{reputation.progress.next} ({reputation.progress.progressPct}%)</span>
              </div>
              <div className="h-1.5 bg-[var(--line)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--accent)] rounded-full transition-all"
                  style={{ width: `${reputation.progress.progressPct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Présentation et liens du créateur.

          Affichés seulement à partir d'une grille publiée : sans ce garde-fou, un
          compte vide se servirait d'une page publique comme d'un panneau de liens.
          Tous les liens partent en nofollow ugc, aucun bénéfice de référencement
          n'est donc transmissible. */}
      {hasPublicSheets && (publicUser.bio || (publicUser.links?.length ?? 0) > 0) && (
        <div className="mb-8 -mt-4">
          {publicUser.bio && (
            <p className="text-sm text-[var(--ink-light)] leading-relaxed max-w-2xl whitespace-pre-line">
              {publicUser.bio}
            </p>
          )}
          {publicUser.links && publicUser.links.length > 0 && (
            <SocialLinks links={publicUser.links} className="mt-3" />
          )}
        </div>
      )}

      {/* Le dispositif de reconnaissance n'était expliqué nulle part. On ne le
          montre qu'aux profils qui ont au moins une grille publique : avant ça,
          niveaux et badges ne veulent encore rien dire. */}
      {sheets.length > 0 && (
        <ReputationExplainer
          score={reputation.score}
          level={reputation.level}
          earned={reputation.badges}
        />
      )}

      {/* Accès rapides du propriétaire : le profil sert de hub vers grilles et sets */}
      {user?.id === id && (
        <div className="flex flex-wrap gap-2 mb-8">
          <Link
            href="/dashboard"
            className="px-4 py-2 rounded-lg border border-[var(--line)] bg-[var(--cell-bg)] text-sm text-[var(--ink)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
          >
            {t('mySheets')}
          </Link>
          <Link
            href="/sets"
            className="px-4 py-2 rounded-lg border border-[var(--line)] bg-[var(--cell-bg)] text-sm text-[var(--ink)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
          >
            {t('mySets')}
          </Link>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <div className="bg-[var(--cell-bg)] rounded-xl border border-[var(--line)] p-4 text-center">
          <div className="text-2xl font-bold text-[var(--ink)]">{sheets.length}</div>
          <div className="text-xs text-[var(--ink-light)] mt-0.5">{t('sheetsCount', { count: sheets.length })}</div>
        </div>
        <button
          onClick={() => setFilter(f => f === 'bookmarked' ? 'all' : 'bookmarked')}
          disabled={reputation.totalBookmarks === 0}
          className={`rounded-xl border p-4 text-center transition-colors disabled:cursor-default enabled:cursor-pointer enabled:hover:border-[var(--accent)] ${
            filter === 'bookmarked' ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--line)] bg-[var(--cell-bg)]'
          }`}
        >
          <div className="text-2xl font-bold text-[var(--ink)]">{reputation.totalBookmarks.toLocaleString(locale)}</div>
          <div className="text-xs text-[var(--ink-light)] mt-0.5">{t('favoritesReceived')}</div>
        </button>
        <button
          onClick={() => setFilter(f => f === 'rated' ? 'all' : 'rated')}
          disabled={stats.weightedAvg === null}
          className={`rounded-xl border p-4 text-center transition-colors disabled:cursor-default enabled:cursor-pointer enabled:hover:border-[var(--accent)] ${
            filter === 'rated' ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--line)] bg-[var(--cell-bg)]'
          }`}
        >
          <div className="text-2xl font-bold text-[var(--ink)]">
            {stats.weightedAvg !== null ? `★ ${stats.weightedAvg.toFixed(1)}` : '—'}
          </div>
          <div className="text-xs text-[var(--ink-light)] mt-0.5">{t('averageRating')}</div>
        </button>
        <div className="bg-[var(--cell-bg)] rounded-xl border border-[var(--line)] p-4 text-center">
          {stats.topGenres.length > 0 ? (
            <>
              <div className="text-sm font-semibold text-[var(--ink)] leading-tight">
                {stats.topGenres.map(genreLabel).join(' · ')}
              </div>
              <div className="text-xs text-[var(--ink-light)] mt-0.5">{t('genres')}</div>
            </>
          ) : (
            <div className="text-2xl font-bold text-[var(--ink)]">—</div>
          )}
        </div>
      </div>

      {/* Répartition niveaux */}
      {sheets.length > 0 && Object.values(stats.difficultyCounts).some(n => n > 0) && (
        <div className="mb-8 flex gap-4">
          {([1, 2, 3] as const).map(d => {
            const count = stats.difficultyCounts[d];
            if (!count) return null;
            const pct = Math.round((count / sheets.length) * 100);
            return (
              <div key={d} className="flex-1">
                <div className="flex justify-between text-xs text-[var(--ink-faint)] mb-1">
                  <span>{difficultyLabel(DIFFICULTY_LABELS[d])}</span>
                  <span>{count}</span>
                </div>
                <div className="h-1.5 bg-[var(--line)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--accent)] rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tri + titre section */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--ink-faint)] flex items-center gap-2">
          {filter === 'bookmarked' ? t('bookmarked') : filter === 'rated' ? t('rated') : t('published')}
          {filter !== 'all' && (
            <button onClick={() => setFilter('all')}
              className="normal-case tracking-normal text-[var(--accent)] hover:underline font-normal">
              {t('seeAllParen')}
            </button>
          )}
        </h2>
        <div className="flex rounded-lg overflow-hidden border border-[var(--line)] text-xs">
          {([
            { value: 'recent' as SortOption, label: t('recent') },
            { value: 'rated' as SortOption, label: t('bestRated') },
            { value: 'viewed' as SortOption, label: t('mostViewed') },
          ]).map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setSortBy(value)}
              className={`px-3 py-1.5 transition-colors cursor-pointer ${
                sortBy === value
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--cell-bg)] text-[var(--ink-light)] hover:bg-[var(--line)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Grilles */}
      {visibleSheets.length === 0 && filter !== 'all' ? (
        <div className="py-12 text-center text-[var(--ink-faint)]">
          {filter === 'bookmarked' ? t('noBookmarked') : t('noRated')}
          <button onClick={() => setFilter('all')} className="ml-2 text-[var(--accent)] hover:underline">{t('seeAll')}</button>
        </div>
      ) : sortedSheets.length === 0 ? (
        user?.id === id ? (
          <div className="py-12 text-center bg-[var(--cell-bg)] border border-[var(--line)] rounded-xl">
            <div className="w-14 h-14 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="4" y1="13" x2="20" y2="13"/>
                <line x1="12" y1="8" x2="12" y2="22"/>
              </svg>
            </div>
            <p className="font-medium text-[var(--ink)] mb-1">{t('noPublished')}</p>
            <p className="text-sm text-[var(--ink-faint)] mb-5 max-w-xs mx-auto">
              {t('noPublishedHint')}
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Link
                href="/sheet/new"
                className="px-4 py-2 bg-[var(--accent)] hover:bg-[#a83d25] text-white text-sm font-medium rounded-lg transition-colors"
              >
                {t('createSheet')}
              </Link>
              <Link
                href="/dashboard?tab=mine"
                className="px-4 py-2 border border-[var(--line)] text-[var(--ink-light)] hover:border-[var(--accent)] hover:text-[var(--accent)] text-sm font-medium rounded-lg transition-colors"
              >
                {t('myPrivate')}
              </Link>
            </div>
          </div>
        ) : (
          <div className="py-16 text-center text-[var(--ink-faint)]">
            {t('noPublishedShort')}
          </div>
        )
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {visibleSheets.map(sheet => (
            <SheetCard
              key={sheet.id}
              sheet={sheet}
              isBookmarked={isBookmarked(sheet.id!)}
              onToggleBookmark={() => toggleBookmark(sheet.id!)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
