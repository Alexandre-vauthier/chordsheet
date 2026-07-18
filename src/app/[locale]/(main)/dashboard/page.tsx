'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { collection, query, where, orderBy, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { useAuth } from '@/lib/auth-context';
import { getDb } from '@/lib/firebase';
import { fromFirestore } from '@/lib/firestore-helpers';
import { useBookmarks } from '@/lib/use-bookmarks';
import { useSets } from '@/lib/use-sets';
import { useGroups } from '@/lib/use-groups';
import { useGenreLabel, useDifficultyLabel } from '@/lib/use-genre-labels';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SheetCard } from '@/components/explore/sheet-card';
import type { Sheet } from '@/types';
import { createEmptySet, GENRES, DIFFICULTY_OPTIONS, type Difficulty } from '@/types';
import { Link, useRouter } from '@/i18n/navigation';

type Tab = 'all' | 'mine' | 'book' | 'sets';
type SortOption = 'recent' | 'rated' | 'viewed';

export default function DashboardPage() {
  const t = useTranslations('Dashboard');
  const locale = useLocale();
  const genreLabel = useGenreLabel();
  const difficultyLabel = useDifficultyLabel();
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as Tab) || 'all';

  const { bookmarkedSheets, isLoading: bookLoading, isBookmarked, toggleBookmark, removeBookmark } = useBookmarks(user?.id);
  const { sets, isLoading: setsLoading, createSet, deleteSet } = useSets(user?.id);
  const { groups } = useGroups();
  const groupNameById = Object.fromEntries(groups.map(g => [g.id, g.name]));

  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [newSetName, setNewSetName] = useState('');
  const [isCreatingSet, setIsCreatingSet] = useState(false);

  // Filtres partagés entre onglets
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('recent');

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
        setSheets(snapshot.docs.map(d => fromFirestore(d.id, d.data())));
      } catch (error) {
        console.error('Error loading sheets:', error);
      } finally {
        setLoading(false);
      }
    }
    loadSheets();
  }, [user]);

  const handleDelete = async (sheetId: string) => {
    if (!confirm(t('confirmDeleteSheet'))) return;
    try {
      await deleteDoc(doc(getDb(), 'sheets', sheetId));
      setSheets(prev => prev.filter(s => s.id !== sheetId));
    } catch {
      alert(t('errorDelete'));
    }
  };

  const handleRemoveBookmark = async (sheetId: string) => {
    if (!confirm(t('confirmRemoveBookmark'))) return;
    await removeBookmark(sheetId);
  };

  const handleCreateSet = async () => {
    if (!user || !newSetName.trim()) return;
    setIsCreatingSet(true);
    try {
      const newSet = createEmptySet(user.id, user.displayName);
      newSet.name = newSetName.trim();
      const setId = await createSet(newSet);
      router.push(`/sets/${setId}`);
    } catch {
      alert(t('errorCreateSet'));
    } finally {
      setIsCreatingSet(false);
    }
  };

  const handleDeleteSet = async (setId: string, setName: string) => {
    if (!confirm(t('confirmDeleteSet', { name: setName }))) return;
    try {
      await deleteSet(setId);
    } catch {
      alert(t('errorDelete'));
    }
  };

  const ownedIds = new Set(sheets.map(s => s.id));
  const allSheets: Sheet[] = [
    ...sheets,
    ...bookmarkedSheets.filter(s => !ownedIds.has(s.id)),
  ];

  const filterAndSort = useCallback((list: Sheet[]) => {
    let result = [...list];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s =>
        s.title.toLowerCase().includes(q) ||
        s.artist.toLowerCase().includes(q)
      );
    }
    if (selectedGenre) result = result.filter(s => s.genres?.includes(selectedGenre));
    if (selectedDifficulty) result = result.filter(s => s.difficulty === selectedDifficulty);
    switch (sortBy) {
      case 'rated': result.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0)); break;
      case 'viewed': result.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0)); break;
      default: result.sort((a, b) => (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0));
    }
    return result;
  }, [searchQuery, selectedGenre, selectedDifficulty, sortBy]);

  const displayedSheets = useMemo(() => filterAndSort(sheets), [sheets, filterAndSort]);
  const displayedBookmarks = useMemo(() => filterAndSort(bookmarkedSheets), [bookmarkedSheets, filterAndSort]);
  const displayedAll = useMemo(() => filterAndSort(allSheets), [allSheets, filterAndSort]);

  const hasActiveFilters = !!(searchQuery || selectedGenre || selectedDifficulty || sortBy !== 'recent');
  const clearFilters = () => { setSearchQuery(''); setSelectedGenre(''); setSelectedDifficulty(null); setSortBy('recent'); };

  const handleRandom = useCallback(() => {
    const pool = tab === 'mine' ? displayedSheets : tab === 'book' ? displayedBookmarks : displayedAll;
    if (!pool.length) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    router.push(`/sheet/${pick.id}`);
  }, [tab, displayedSheets, displayedBookmarks, displayedAll, router]);

  const isCurrentlyLoading =
    tab === 'mine' ? loading :
    tab === 'book' ? bookLoading :
    tab === 'sets' ? setsLoading :
    loading || bookLoading;

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'all', label: t('tabAll') },
    { id: 'mine', label: t('tabMine'), count: sheets.length || undefined },
    { id: 'book', label: t('tabBook'), count: bookmarkedSheets.length || undefined },
    { id: 'sets', label: t('tabSets'), count: sets.length || undefined },
  ];

  return (
    <div className="max-w-[1270px] mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--ink)]">{t('title')}</h1>
          <p className="text-[var(--ink-light)] mt-1">
            {tab === 'all' && (allSheets.length > 0 ? t('subtitleAllCount', { count: allSheets.length }) : t('subtitleAllEmpty'))}
            {tab === 'mine' && (sheets.length > 0 ? t('subtitleMineCount', { count: sheets.length }) : t('subtitleMineEmpty'))}
            {tab === 'book' && (bookmarkedSheets.length > 0 ? t('subtitleBookCount', { count: bookmarkedSheets.length }) : t('subtitleBookEmpty'))}
            {tab === 'sets' && (sets.length > 0 ? t('subtitleSetsCount', { count: sets.length }) : t('subtitleSetsEmpty'))}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/explore" className="hidden sm:block">
            <Button variant="ghost">{t('explore')}</Button>
          </Link>
          {tab !== 'sets' && (
            <button
              onClick={handleRandom}
              title={t('randomTitle')}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-[var(--ink-light)] hover:text-[var(--ink)] hover:bg-[var(--cell-bg)] border border-[var(--line)] transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 3 21 3 21 8"/>
                <line x1="4" y1="20" x2="21" y2="3"/>
                <polyline points="21 16 21 21 16 21"/>
                <line x1="15" y1="15" x2="21" y2="21"/>
              </svg>
              {t('random')}
            </button>
          )}
          <Link href="/sheet/new" className="hidden sm:block">
            <Button>{t('newSheet')}</Button>
          </Link>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 mb-6 bg-[var(--line)] rounded-lg p-1 w-fit">
        {tabs.map(tabItem => (
          <button
            key={tabItem.id}
            onClick={() => setTab(tabItem.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === tabItem.id
                ? 'bg-[var(--cell-bg)] text-[var(--ink)] shadow-sm'
                : 'text-[var(--ink-light)] hover:text-[var(--ink)]'
            }`}
          >
            {tabItem.label}
            {tabItem.count ? (
              <span className={`ml-1.5 text-xs rounded-full px-1.5 py-0.5 ${
                tab === tabItem.id ? 'bg-[var(--accent)] text-white' : 'bg-[var(--line)] text-[var(--ink-faint)]'
              }`}>
                {tabItem.count}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Filtres — visibles pour tous les onglets sauf Sets */}
      {tab !== 'sets' && (
        <div className="space-y-3 mb-6">
          <div className="flex gap-3">
            <Input
              type="search"
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Tri */}
            <div className="flex rounded-lg border border-[var(--line)] overflow-hidden">
              {(['recent', 'rated', 'viewed'] as SortOption[]).map((opt, i) => (
                <button
                  key={opt}
                  onClick={() => setSortBy(opt)}
                  className={`px-3 py-1.5 text-sm transition-colors ${i > 0 ? 'border-l border-[var(--line)]' : ''} ${
                    sortBy === opt
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-[var(--cell-bg)] text-[var(--ink-light)] hover:bg-[var(--cell-hover)]'
                  }`}
                >
                  {opt === 'recent' ? t('sortRecent') : opt === 'rated' ? t('sortRated') : t('sortViewed')}
                </button>
              ))}
            </div>
            <div className="hidden sm:block h-6 w-px bg-[var(--line)]" />
            {/* Genre */}
            <select
              value={selectedGenre}
              onChange={e => setSelectedGenre(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-[var(--line)] text-sm bg-[var(--cell-bg)] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              <option value="">{t('allGenres')}</option>
              {GENRES.map(g => <option key={g} value={g}>{genreLabel(g)}</option>)}
            </select>
            {/* Difficulté */}
            <select
              value={selectedDifficulty ?? ''}
              onChange={e => setSelectedDifficulty(e.target.value ? Number(e.target.value) as Difficulty : null)}
              className="px-3 py-1.5 rounded-lg border border-[var(--line)] text-sm bg-[var(--cell-bg)] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              <option value="">{t('allDifficulties')}</option>
              {DIFFICULTY_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{difficultyLabel(label)}</option>)}
            </select>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="ml-auto text-sm text-[var(--accent)] hover:underline">
                {t('reset')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Contenu */}
      {isCurrentlyLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-[var(--cell-bg)] rounded-xl border border-[var(--line)] h-48 animate-pulse" />
          ))}
        </div>
      ) : tab === 'sets' ? (
        <SetsTab
          sets={sets}
          newSetName={newSetName}
          setNewSetName={setNewSetName}
          isCreating={isCreatingSet}
          onCreateSet={handleCreateSet}
          onDeleteSet={handleDeleteSet}
          groupNameById={groupNameById}
        />
      ) : tab === 'all' ? (
        allSheets.length === 0 ? (
          <EmptyState
            icon="music"
            title={t('emptyBookTitle')}
            description={t('emptyBookDesc')}
            actions={[
              <Link key="new" href="/sheet/new"><Button variant="primary">{t('createSheet')}</Button></Link>,
              <Link key="explore" href="/explore"><Button variant="ghost">{t('explore')}</Button></Link>,
            ]}
          />
        ) : displayedAll.length === 0 ? (
          <EmptyState icon="music" title={t('noResultsTitle')} description={t('noResultsDesc')} actions={[<button key="r" onClick={clearFilters} className="text-sm text-[var(--accent)] hover:underline">{t('reset')}</button>]} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {displayedAll.map(sheet => {
              const isOwned = ownedIds.has(sheet.id);
              return (
                <SheetCard
                  key={sheet.id}
                  sheet={sheet}
                  showOwner
                  onDelete={isOwned ? () => handleDelete(sheet.id!) : undefined}
                  isBookmarked={sheet.id ? isBookmarked(sheet.id) : false}
                  onToggleBookmark={sheet.id ? () => toggleBookmark(sheet.id!) : undefined}
                />
              );
            })}
          </div>
        )
      ) : tab === 'mine' ? (
        sheets.length === 0 ? (
          <EmptyState
            icon="music"
            title={t('emptyMineTitle')}
            description={t('emptyMineDesc')}
            actions={[<Link key="new" href="/sheet/new"><Button variant="primary">{t('createFirstSheet')}</Button></Link>]}
          />
        ) : displayedSheets.length === 0 ? (
          <EmptyState icon="music" title={t('noResultsTitle')} description={t('noResultsDesc')} actions={[<button key="r" onClick={clearFilters} className="text-sm text-[var(--accent)] hover:underline">{t('reset')}</button>]} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {displayedSheets.map(sheet => (
              <SheetCard
                key={sheet.id}
                sheet={sheet}
                showOwner
                showPublicBadge
                onDelete={() => handleDelete(sheet.id!)}
                isBookmarked={sheet.id ? isBookmarked(sheet.id) : false}
                onToggleBookmark={sheet.id ? () => toggleBookmark(sheet.id!) : undefined}
              />
            ))}
          </div>
        )
      ) : (
        /* Favoris */
        bookmarkedSheets.length === 0 ? (
          <EmptyState
            icon="bookmark"
            title={t('emptyBookmarksTitle')}
            description={t('emptyBookmarksDesc')}
            actions={[<Link key="explore" href="/explore"><Button variant="primary">{t('exploreSheets')}</Button></Link>]}
          />
        ) : displayedBookmarks.length === 0 ? (
          <EmptyState icon="bookmark" title={t('noResultsTitle')} description={t('noResultsDesc')} actions={[<button key="r" onClick={clearFilters} className="text-sm text-[var(--accent)] hover:underline">{t('reset')}</button>]} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {displayedBookmarks.map(sheet => (
              <SheetCard
                key={sheet.id}
                sheet={sheet}
                showOwner
                isBookmarked
                onToggleBookmark={() => handleRemoveBookmark(sheet.id!)}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
}

function SetsTab({
  sets, newSetName, setNewSetName, isCreating, onCreateSet, onDeleteSet, groupNameById,
}: {
  sets: import('@/types').Set[];
  newSetName: string;
  setNewSetName: (v: string) => void;
  isCreating: boolean;
  onCreateSet: () => void;
  onDeleteSet: (id: string, name: string) => void;
  groupNameById: Record<string, string>;
}) {
  const t = useTranslations('Dashboard');
  const locale = useLocale();
  return (
    <div>
      {/* Création */}
      <div className="bg-[var(--cell-bg)] rounded-xl border border-[var(--line)] p-4 mb-6">
        <div className="flex gap-3">
          <Input
            type="text"
            placeholder={t('setNamePlaceholder')}
            value={newSetName}
            onChange={e => setNewSetName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onCreateSet()}
            className="flex-1"
          />
          <Button onClick={onCreateSet} disabled={!newSetName.trim() || isCreating} isLoading={isCreating} className="whitespace-nowrap">
            {t('createSet')}
          </Button>
        </div>
      </div>

      {sets.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {sets.map(set => (
            <div key={set.id} className="bg-[var(--cell-bg)] rounded-xl border border-[var(--line)] overflow-hidden hover:shadow-md transition-shadow group">
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <Link href={`/sets/${set.id}`} className="flex-1">
                    <h3 className="font-semibold text-[var(--ink)] group-hover:text-[var(--accent)] transition-colors">
                      {set.name || t('unnamedSet')}
                    </h3>
                  </Link>
                  {set.groupId && (
                    <Link
                      href={`/groups/${set.groupId}`}
                      className="ml-2 shrink-0 px-1.5 py-0.5 bg-[var(--accent-soft)] text-[var(--accent)] rounded text-[10px] tracking-wider hover:bg-[var(--accent)] hover:text-white transition-colors"
                    >
                      {groupNameById[set.groupId] ?? t('unnamedGroup')}
                    </Link>
                  )}
                </div>
                {set.description && (
                  <p className="text-sm text-[var(--ink-light)] mt-1 line-clamp-2">{set.description}</p>
                )}
                <div className="flex items-center gap-2 mt-3 text-xs text-[var(--ink-faint)]">
                  <span>{t('setSheetsCount', { count: set.sheetIds.length })}</span>
                  <span>•</span>
                  <span>{t('setUpdatedAt', { date: set.updatedAt.toLocaleDateString(locale === 'en' ? 'en-US' : 'fr-FR') })}</span>
                </div>
                <div className="flex items-center gap-3 mt-4 pt-3 border-t border-[var(--line)]">
                  <Link href={`/sets/${set.id}`} className="text-xs text-[var(--ink-light)] hover:text-[var(--accent)] transition-colors">
                    {t('edit')}
                  </Link>
                  {set.sheetIds.length > 0 && (
                    <Link href={`/sets/${set.id}/play`} className="text-xs text-[var(--ink-light)] hover:text-[var(--accent)] transition-colors">
                      {t('play')}
                    </Link>
                  )}
                  <button
                    onClick={() => onDeleteSet(set.id!, set.name)}
                    className="text-xs text-[var(--ink-light)] hover:text-red-600 transition-colors ml-auto"
                  >
                    {t('delete')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="list"
          title={t('emptySetsTitle')}
          description={t('emptySetsDesc')}
        />
      )}
    </div>
  );
}

function EmptyState({
  icon, title, description, actions,
}: {
  icon: 'music' | 'bookmark' | 'list';
  title: string;
  description: string;
  actions?: React.ReactNode[];
}) {
  const paths: Record<string, string> = {
    music: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3',
    bookmark: 'M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z',
    list: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
  };
  return (
    <div className="bg-[var(--cell-bg)] rounded-xl border border-[var(--line)] p-8 text-center">
      <div className="text-[var(--ink-faint)] mb-4">
        <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={paths[icon]} />
        </svg>
        <p className="text-lg">{title}</p>
        <p className="text-sm mt-1">{description}</p>
      </div>
      {actions && <div className="flex gap-3 justify-center">{actions}</div>}
    </div>
  );
}
