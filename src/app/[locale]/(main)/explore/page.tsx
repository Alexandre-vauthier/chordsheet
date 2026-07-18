'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { collection, query, where, getDocs, limit, deleteDoc, doc } from 'firebase/firestore';
import { useAuth } from '@/lib/auth-context';
import { getDb } from '@/lib/firebase';
import { fromFirestore } from '@/lib/firestore-helpers';
import { useBookmarks } from '@/lib/use-bookmarks';
import { useGenreLabel, useDifficultyLabel } from '@/lib/use-genre-labels';
import { Input } from '@/components/ui/input';
import { SheetCard, stopPreviewAudio } from '@/components/explore/sheet-card';
import { WelcomeBanner } from '@/components/explore/welcome-banner';
import { GENRES, DIFFICULTY_OPTIONS, type Difficulty } from '@/types';
import type { Sheet } from '@/types';
import { useRouter } from '@/i18n/navigation';

type SortOption = 'recent' | 'rated' | 'viewed';

export default function ExplorePage() {
  const t = useTranslations('Explore');
  const genreLabel = useGenreLabel();
  const difficultyLabel = useDifficultyLabel();
  const { isAdmin, user, loading: authLoading } = useAuth();
  const { isBookmarked, toggleBookmark } = useBookmarks(user?.id);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') ?? '');

  // Mettre à jour la recherche si le param URL change (nouvelle recherche depuis la navbar)
  useEffect(() => {
    setSearchQuery(searchParams.get('q') ?? '');
  }, [searchParams]);

  // Stopper la preview iTunes au démontage (navigation vers une grille)
  useEffect(() => {
    return () => { stopPreviewAudio(); };
  }, []);

  // Filtres — initialisés depuis l'URL pour survivre au retour arrière
  const [sortBy, setSortBy] = useState<SortOption>(() => (searchParams.get('sort') as SortOption) ?? 'recent');
  const [selectedGenre, setSelectedGenre] = useState<string>(() => searchParams.get('genre') ?? '');
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty | null>(() => { const d = searchParams.get('difficulty'); return d ? (Number(d) as Difficulty) : null; });

  // Synchroniser l'URL quand les filtres changent
  const updateUrl = (params: { sort?: SortOption; genre?: string; difficulty?: Difficulty | null; q?: string }) => {
    const p = new URLSearchParams(searchParams.toString());
    if (params.sort !== undefined) { params.sort === 'recent' ? p.delete('sort') : p.set('sort', params.sort); }
    if (params.genre !== undefined) { params.genre ? p.set('genre', params.genre) : p.delete('genre'); }
    if (params.difficulty !== undefined) { params.difficulty ? p.set('difficulty', String(params.difficulty)) : p.delete('difficulty'); }
    if (params.q !== undefined) { params.q ? p.set('q', params.q) : p.delete('q'); }
    router.replace(`/explore?${p.toString()}`, { scroll: false });
  };

  const handleSortBy = (v: SortOption) => { setSortBy(v); updateUrl({ sort: v }); };
  const handleGenre = (v: string) => { setSelectedGenre(v); updateUrl({ genre: v }); };
  const handleDifficulty = (v: Difficulty | null) => { setSelectedDifficulty(v); updateUrl({ difficulty: v }); };

  // Mettre à jour le genre si le param URL change (ex: depuis la navbar)
  useEffect(() => {
    setSelectedGenre(searchParams.get('genre') ?? '');
  }, [searchParams]);

  // Sauvegarder le scroll à chaque mouvement
  useEffect(() => {
    const saveScroll = () => sessionStorage.setItem('explore_scroll', String(window.scrollY));
    window.addEventListener('scroll', saveScroll, { passive: true });
    return () => window.removeEventListener('scroll', saveScroll);
  }, []);

  // Restaurer la position de scroll au retour
  useEffect(() => {
    if (loading) return;
    const saved = sessionStorage.getItem('explore_scroll');
    if (!saved) return;
    const y = parseInt(saved);
    sessionStorage.removeItem('explore_scroll');

    // Next.js App Router peut réinitialiser le scroll après le rendu.
    // On verrouille la position pendant 800ms en écoutant chaque scroll vers 0.
    let done = false;
    const lock = () => {
      if (!done && window.scrollY < y / 2) {
        window.scrollTo({ top: y, behavior: 'instant' });
      }
    };
    window.addEventListener('scroll', lock, { passive: true });

    // Premiers essais rapides pour le cas où tout est déjà en place
    const t1 = setTimeout(() => window.scrollTo({ top: y, behavior: 'instant' }), 50);
    const t2 = setTimeout(() => window.scrollTo({ top: y, behavior: 'instant' }), 150);
    const t3 = setTimeout(() => window.scrollTo({ top: y, behavior: 'instant' }), 400);
    const cleanup = setTimeout(() => {
      done = true;
      window.removeEventListener('scroll', lock);
    }, 800);

    return () => {
      done = true;
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(cleanup);
      window.removeEventListener('scroll', lock);
    };
  }, [loading]);

  useEffect(() => {
    if (authLoading) return;

    async function loadSheets() {
      try {
        const db = getDb();
        const q = isAdmin
          ? query(collection(db, 'sheets'), limit(500))
          : query(collection(db, 'sheets'), where('isPublic', '==', true), limit(200));

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
  }, [isAdmin, authLoading]);

  const handleAdminDelete = async (sheetId: string) => {
    if (!confirm(t('confirmDeleteSheet'))) return;
    try {
      const db = getDb();
      await deleteDoc(doc(db, 'sheets', sheetId));
      setSheets(prev => prev.filter(s => s.id !== sheetId));
    } catch (error) {
      console.error('Error deleting sheet:', error);
      alert(t('errorDelete'));
    }
  };

  // Filtrer, trier, puis grouper par titre+artiste (une entrée par musique)
  const filteredSheets = useMemo(() => {
    let result = [...sheets];

    // Filtre texte
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (sheet) =>
          sheet.title.toLowerCase().includes(q) ||
          sheet.artist.toLowerCase().includes(q) ||
          sheet.ownerName.toLowerCase().includes(q) ||
          sheet.key.toLowerCase().includes(q)
      );
    }

    // Filtre par genre
    if (selectedGenre) {
      result = result.filter((sheet) =>
        sheet.genres?.includes(selectedGenre)
      );
    }

    // Filtre par difficulté
    if (selectedDifficulty) {
      result = result.filter((sheet) => sheet.difficulty === selectedDifficulty);
    }

    // Tri
    switch (sortBy) {
      case 'rated':
        result.sort((a, b) => {
          const ratingA = a.averageRating || 0;
          const ratingB = b.averageRating || 0;
          if (ratingB !== ratingA) return ratingB - ratingA;
          return (b.ratingCount || 0) - (a.ratingCount || 0);
        });
        break;
      case 'viewed':
        result.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
        break;
      case 'recent':
      default:
        result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        break;
    }

    return result;
  }, [sheets, searchQuery, selectedGenre, selectedDifficulty, sortBy]);

  // Grouper par titre+artiste → une seule entrée par musique
  const groupedResults = useMemo(() => {
    const groups = new Map<string, Sheet[]>();
    for (const sheet of filteredSheets) {
      const key = `${sheet.title.trim().toLowerCase()}|||${(sheet.artist || '').trim().toLowerCase()}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(sheet);
    }
    return Array.from(groups.values()).map((group) => ({
      sheet: group[0], // représentant du groupe (déjà trié)
      count: group.length,
      href: group.length === 1
        ? `/sheet/${group[0].id}`
        : `/song/${encodeURIComponent(group[0].title)}/${encodeURIComponent(group[0].artist || '')}`,
    }));
  }, [filteredSheets]);

  // Réinitialiser les filtres
  const clearFilters = () => {
    setSearchQuery('');
    setSelectedGenre('');
    setSelectedDifficulty(null);
    setSortBy('recent');
    router.replace('/explore', { scroll: false });
  };

  const hasActiveFilters = searchQuery || selectedGenre || selectedDifficulty || sortBy !== 'recent';

  const handleRandom = () => {
    if (sheets.length === 0) return;
    const random = sheets[Math.floor(Math.random() * sheets.length)];
    router.push(`/sheet/${random.id}`);
  };

  return (
    <div className="max-w-[1270px] mx-auto px-4 sm:px-6 py-8">
      <WelcomeBanner />
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--ink)]">{t('title')}</h1>
        <p className="text-[var(--ink-light)] mt-1">
          {t('subtitle')}
          {sheets.length > 0 && ` ${t('subtitleCount', { count: sheets.length })}`}
          {groupedResults.length > 0 && groupedResults.length < sheets.length && ` · ${t('subtitleUniqueTitles', { count: groupedResults.length })}`}
        </p>
      </div>

      {/* Barre de recherche et filtres */}
      <div className="space-y-4 mb-8">
        {/* Recherche */}
        <div className="flex gap-3">
          <div className="flex-1">
            <Input
              type="search"
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>
          <button
            onClick={handleRandom}
            disabled={sheets.length === 0}
            className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[var(--line)] bg-[var(--cell-bg)] text-sm text-[var(--ink-light)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-40"
            title={t('randomTitle')}
          >
            {t('random')}
          </button>
        </div>

        {/* Filtres et tri */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Tri */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--ink-light)]">{t('sortBy')}</span>
            <div className="flex rounded-lg border border-[var(--line)] overflow-hidden">
              <button
                onClick={() => handleSortBy('recent')}
                className={`px-3 py-1.5 text-sm transition-colors ${
                  sortBy === 'recent'
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--cell-bg)] text-[var(--ink-light)] hover:bg-[var(--cell-hover)]'
                }`}
              >
                {t('sortRecent')}
              </button>
              <button
                onClick={() => handleSortBy('rated')}
                className={`px-3 py-1.5 text-sm border-l border-[var(--line)] transition-colors ${
                  sortBy === 'rated'
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--cell-bg)] text-[var(--ink-light)] hover:bg-[var(--cell-hover)]'
                }`}
              >
                {t('sortRated')}
              </button>
              <button
                onClick={() => handleSortBy('viewed')}
                className={`px-3 py-1.5 text-sm border-l border-[var(--line)] transition-colors ${
                  sortBy === 'viewed'
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--cell-bg)] text-[var(--ink-light)] hover:bg-[var(--cell-hover)]'
                }`}
              >
                {t('sortViewed')}
              </button>
            </div>
          </div>

          {/* Séparateur */}
          <div className="hidden sm:block h-6 w-px bg-[var(--line)]" />

          {/* Genre */}
          <select
            value={selectedGenre}
            onChange={(e) => handleGenre(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-[var(--line)] text-sm bg-[var(--cell-bg)]
              text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            <option value="">{t('allGenres')}</option>
            {GENRES.map((genre) => (
              <option key={genre} value={genre}>
                {genreLabel(genre)}
              </option>
            ))}
          </select>

          {/* Difficulté */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--ink-light)]">{t('difficultyLabel')}</span>
            <select
              value={selectedDifficulty ?? ''}
              onChange={(e) => handleDifficulty(e.target.value ? Number(e.target.value) as Difficulty : null)}
              className="text-sm border border-[var(--line)] rounded-lg px-2 py-1 bg-[var(--cell-bg)] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              <option value="">{t('allDifficulties')}</option>
              {DIFFICULTY_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{difficultyLabel(label)}</option>
              ))}
            </select>
          </div>

          {/* Réinitialiser */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="ml-auto text-sm text-[var(--accent)] hover:underline"
            >
              {t('reset')}
            </button>
          )}
        </div>
      </div>

      {/* Résultats */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
            <div key={i} className="rounded-2xl overflow-hidden border border-[var(--line)] animate-pulse bg-[var(--cell-bg)]">
              <div className="aspect-square bg-[var(--line)]/40" />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-[var(--line)]/40 rounded w-3/4" />
                <div className="h-2.5 bg-[var(--line)]/30 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : groupedResults.length > 0 ? (
        <>
          {hasActiveFilters && (
            <p className="text-sm text-[var(--ink-light)] mb-4">
              {t('resultsCount', { count: groupedResults.length })}
              {filteredSheets.length > groupedResults.length && ` ${t('resultsVersions', { count: filteredSheets.length })}`}
            </p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {groupedResults.map(({ sheet, count, href }) => (
              <SheetCard
                key={`${sheet.title}-${sheet.artist}`}
                sheet={sheet}
                showOwner
                showPublicBadge={isAdmin}
                href={href}
                variantCount={count}
                isBookmarked={sheet.id ? isBookmarked(sheet.id) : false}
                onToggleBookmark={user && sheet.id ? () => toggleBookmark(sheet.id!) : undefined}
                onDelete={isAdmin && sheet.id ? () => handleAdminDelete(sheet.id!) : undefined}
              />
            ))}
          </div>
        </>
      ) : sheets.length > 0 ? (
        <div className="bg-[var(--cell-bg)] rounded-xl border border-[var(--line)] p-8 text-center">
          <div className="text-[var(--ink-faint)]">
            <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-lg">{t('noResultsForQuery', { query: searchQuery })}</p>
            <p className="text-sm mt-1">{t('noResultsHint')}</p>
            <div className="flex gap-3 justify-center mt-4">
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-sm text-[var(--ink-light)] border border-[var(--line)] rounded-lg hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
              >
                {t('reset')}
              </button>
              <a
                href={`/sheet/new`}
                className="px-4 py-2 text-sm text-white bg-[var(--accent)] rounded-lg hover:bg-[#a83d25] transition-colors"
              >
                {t('createThisSheet')}
              </a>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[var(--cell-bg)] rounded-xl border border-[var(--line)] p-8 text-center">
          <div className="text-[var(--ink-faint)]">
            <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            <p className="text-lg">{t('noPublicSheetsYet')}</p>
            <p className="text-sm mt-1">{t('beFirstToShare')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
