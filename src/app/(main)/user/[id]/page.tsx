'use client';

import { useState, useEffect, use } from 'react';
import { collection, query, where, getDocs, getDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import { fromFirestore } from '@/lib/firestore-helpers';
import { SheetCard } from '@/components/explore/sheet-card';
import { LevelBadge } from '@/components/reputation/level-badge';
import { BadgesDisplay } from '@/components/reputation/badges-display';
import { useBookmarks } from '@/lib/use-bookmarks';
import { useAuth } from '@/lib/auth-context';
import type { Sheet } from '@/types';
import { DIFFICULTY_LABELS } from '@/types';
import { computeScore, computeLevel, computeBadges, getLevelProgress } from '@/lib/creator-reputation';

interface PublicUser {
  displayName: string;
  createdAt: Date | null;
}

type SortOption = 'recent' | 'rated' | 'viewed';

interface UserPageProps {
  params: Promise<{ id: string }>;
}

export default function UserPage({ params }: UserPageProps) {
  const { id } = use(params);
  const { user } = useAuth();
  const { isBookmarked, toggleBookmark } = useBookmarks(user?.id);

  const [publicUser, setPublicUser] = useState<PublicUser | null>(null);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>('recent');

  useEffect(() => {
    async function load() {
      const db = getDb();

      // Charger le profil utilisateur
      try {
        const userDoc = await getDoc(doc(db, 'users', id));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setPublicUser({
            displayName: (data.displayName as string) || 'Anonyme',
            createdAt: (data.createdAt as { toDate: () => Date } | null)?.toDate() ?? null,
          });
        }
      } catch {
        // Profil non accessible — fallback sur les données des grilles
      }

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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--accent)] border-t-transparent" />
      </div>
    );
  }

  if (!publicUser) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-[var(--ink-faint)]">
        Auteur introuvable ou aucune grille publiée.
      </div>
    );
  }

  const initial = publicUser.displayName.charAt(0).toUpperCase();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Header auteur */}
      <div className="flex items-center gap-5 mb-8 pb-6 border-b-2 border-[var(--ink)]">
        <div className="w-16 h-16 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-2xl font-bold shrink-0 shadow-md">
          {initial}
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
              Membre depuis {publicUser.createdAt.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
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

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <div className="bg-[var(--cell-bg)] rounded-xl border border-[var(--line)] p-4 text-center">
          <div className="text-2xl font-bold text-[var(--ink)]">{sheets.length}</div>
          <div className="text-xs text-[var(--ink-light)] mt-0.5">grille{sheets.length > 1 ? 's' : ''}</div>
        </div>
        <div className="bg-[var(--cell-bg)] rounded-xl border border-[var(--line)] p-4 text-center">
          <div className="text-2xl font-bold text-[var(--ink)]">{reputation.totalBookmarks.toLocaleString('fr-FR')}</div>
          <div className="text-xs text-[var(--ink-light)] mt-0.5">favoris reçus</div>
        </div>
        <div className="bg-[var(--cell-bg)] rounded-xl border border-[var(--line)] p-4 text-center">
          <div className="text-2xl font-bold text-[var(--ink)]">
            {stats.weightedAvg !== null ? `★ ${stats.weightedAvg.toFixed(1)}` : '—'}
          </div>
          <div className="text-xs text-[var(--ink-light)] mt-0.5">note moyenne</div>
        </div>
        <div className="bg-[var(--cell-bg)] rounded-xl border border-[var(--line)] p-4 text-center">
          {stats.topGenres.length > 0 ? (
            <>
              <div className="text-sm font-semibold text-[var(--ink)] leading-tight">
                {stats.topGenres.join(' · ')}
              </div>
              <div className="text-xs text-[var(--ink-light)] mt-0.5">genres</div>
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
                  <span>{DIFFICULTY_LABELS[d]}</span>
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
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--ink-faint)]">
          Grilles publiées
        </h2>
        <div className="flex rounded-lg overflow-hidden border border-[var(--line)] text-xs">
          {([
            { value: 'recent' as SortOption, label: 'Récentes' },
            { value: 'rated' as SortOption, label: 'Mieux notées' },
            { value: 'viewed' as SortOption, label: 'Plus vues' },
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
      {sortedSheets.length === 0 ? (
        <div className="py-16 text-center text-[var(--ink-faint)]">
          Aucune grille publiée.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {sortedSheets.map(sheet => (
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
