'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { collection, query, where, orderBy, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { useAuth } from '@/lib/auth-context';
import { getDb } from '@/lib/firebase';
import { fromFirestore } from '@/lib/firestore-helpers';
import { useBookmarks } from '@/lib/use-bookmarks';
import { useSets } from '@/lib/use-sets';
import { useGroups } from '@/lib/use-groups';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SheetCard } from '@/components/explore/sheet-card';
import type { Sheet } from '@/types';
import { createEmptySet, GENRES, DIFFICULTY_OPTIONS, type Difficulty } from '@/types';

type Tab = 'all' | 'mine' | 'book' | 'sets';
type SortOption = 'recent' | 'rated' | 'viewed';

export default function DashboardPage() {
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
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette grille ?')) return;
    try {
      await deleteDoc(doc(getDb(), 'sheets', sheetId));
      setSheets(prev => prev.filter(s => s.id !== sheetId));
    } catch {
      alert('Erreur lors de la suppression');
    }
  };

  const handleRemoveBookmark = async (sheetId: string) => {
    if (!confirm('Retirer cette grille de votre book ?')) return;
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
      alert('Erreur lors de la création du set');
    } finally {
      setIsCreatingSet(false);
    }
  };

  const handleDeleteSet = async (setId: string, setName: string) => {
    if (!confirm(`Supprimer le set "${setName}" ?`)) return;
    try {
      await deleteSet(setId);
    } catch {
      alert('Erreur lors de la suppression');
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
    { id: 'all', label: 'Tout' },
    { id: 'mine', label: 'Mes grilles', count: sheets.length || undefined },
    { id: 'book', label: 'Favoris', count: bookmarkedSheets.length || undefined },
    { id: 'sets', label: 'Playlists', count: sets.length || undefined },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--ink)]">Mon book</h1>
          <p className="text-[var(--ink-light)] mt-1">
            {tab === 'all' && (allSheets.length > 0 ? `${allSheets.length} grille${allSheets.length > 1 ? 's' : ''}` : 'Toutes vos grilles')}
            {tab === 'mine' && (sheets.length > 0 ? `${sheets.length} grille${sheets.length > 1 ? 's' : ''} créée${sheets.length > 1 ? 's' : ''}` : 'Gérez vos grilles d\'accords')}
            {tab === 'book' && (bookmarkedSheets.length > 0 ? `${bookmarkedSheets.length} grille${bookmarkedSheets.length > 1 ? 's' : ''} sauvegardée${bookmarkedSheets.length > 1 ? 's' : ''}` : 'Vos grilles favorites')}
            {tab === 'sets' && (sets.length > 0 ? `${sets.length} playlist${sets.length > 1 ? 's' : ''}` : 'Vos playlists')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/explore" className="hidden sm:block">
            <Button variant="ghost">Explorer</Button>
          </Link>
          {tab !== 'sets' && (
            <button
              onClick={handleRandom}
              title="Grille aléatoire"
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-[var(--ink-light)] hover:text-[var(--ink)] hover:bg-[var(--cell-bg)] border border-[var(--line)] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="2" y="2" width="20" height="20" rx="3" strokeWidth="2"/>
                <circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none"/>
                <circle cx="16" cy="8" r="1.2" fill="currentColor" stroke="none"/>
                <circle cx="8" cy="16" r="1.2" fill="currentColor" stroke="none"/>
                <circle cx="16" cy="16" r="1.2" fill="currentColor" stroke="none"/>
                <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/>
              </svg>
              Aléatoire
            </button>
          )}
          <Link href="/sheet/new" className="hidden sm:block">
            <Button>+ Nouvelle grille</Button>
          </Link>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 mb-6 bg-[var(--line)] rounded-lg p-1 w-fit">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t.id
                ? 'bg-[var(--cell-bg)] text-[var(--ink)] shadow-sm'
                : 'text-[var(--ink-light)] hover:text-[var(--ink)]'
            }`}
          >
            {t.label}
            {t.count ? (
              <span className={`ml-1.5 text-xs rounded-full px-1.5 py-0.5 ${
                tab === t.id ? 'bg-[var(--accent)] text-white' : 'bg-[var(--line)] text-[var(--ink-faint)]'
              }`}>
                {t.count}
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
              placeholder="Rechercher par titre, artiste…"
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
                  {opt === 'recent' ? 'Récents' : opt === 'rated' ? 'Mieux notés' : 'Plus consultés'}
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
              <option value="">Tous les genres</option>
              {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            {/* Difficulté */}
            <select
              value={selectedDifficulty ?? ''}
              onChange={e => setSelectedDifficulty(e.target.value ? Number(e.target.value) as Difficulty : null)}
              className="px-3 py-1.5 rounded-lg border border-[var(--line)] text-sm bg-[var(--cell-bg)] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              <option value="">Toutes difficultés</option>
              {DIFFICULTY_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="ml-auto text-sm text-[var(--accent)] hover:underline">
                Réinitialiser
              </button>
            )}
          </div>
        </div>
      )}

      {/* Contenu */}
      {isCurrentlyLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
            title="Votre book est vide"
            description="Créez une grille ou explorez-en depuis la communauté !"
            actions={[
              <Link key="new" href="/sheet/new"><Button variant="primary">Créer une grille</Button></Link>,
              <Link key="explore" href="/explore"><Button variant="ghost">Explorer</Button></Link>,
            ]}
          />
        ) : displayedAll.length === 0 ? (
          <EmptyState icon="music" title="Aucun résultat" description="Essayez de modifier vos filtres." actions={[<button key="r" onClick={clearFilters} className="text-sm text-[var(--accent)] hover:underline">Réinitialiser</button>]} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedAll.map(sheet => {
              const isOwned = ownedIds.has(sheet.id);
              return (
                <SheetCard
                  key={sheet.id}
                  sheet={sheet}
                  showOwner={!isOwned}
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
            title="Aucune grille pour le moment"
            description="Créez votre première grille d'accords !"
            actions={[<Link key="new" href="/sheet/new"><Button variant="primary">Créer ma première grille</Button></Link>]}
          />
        ) : displayedSheets.length === 0 ? (
          <EmptyState icon="music" title="Aucun résultat" description="Essayez de modifier vos filtres." actions={[<button key="r" onClick={clearFilters} className="text-sm text-[var(--accent)] hover:underline">Réinitialiser</button>]} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedSheets.map(sheet => (
              <SheetCard
                key={sheet.id}
                sheet={sheet}
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
            title="Aucun favori pour le moment"
            description="Explorez les grilles et ajoutez vos favorites !"
            actions={[<Link key="explore" href="/explore"><Button variant="primary">Explorer les grilles</Button></Link>]}
          />
        ) : displayedBookmarks.length === 0 ? (
          <EmptyState icon="bookmark" title="Aucun résultat" description="Essayez de modifier vos filtres." actions={[<button key="r" onClick={clearFilters} className="text-sm text-[var(--accent)] hover:underline">Réinitialiser</button>]} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
  return (
    <div>
      {/* Création */}
      <div className="bg-[var(--cell-bg)] rounded-xl border border-[var(--line)] p-4 mb-6">
        <div className="flex gap-3">
          <Input
            type="text"
            placeholder="Nom du set (ex : Concert du 15 mars)"
            value={newSetName}
            onChange={e => setNewSetName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onCreateSet()}
            className="flex-1"
          />
          <Button onClick={onCreateSet} disabled={!newSetName.trim() || isCreating} isLoading={isCreating} className="whitespace-nowrap">
            + Créer un set
          </Button>
        </div>
      </div>

      {sets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sets.map(set => (
            <div key={set.id} className="bg-[var(--cell-bg)] rounded-xl border border-[var(--line)] overflow-hidden hover:shadow-md transition-shadow group">
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <Link href={`/sets/${set.id}`} className="flex-1">
                    <h3 className="font-semibold text-[var(--ink)] group-hover:text-[var(--accent)] transition-colors">
                      {set.name || 'Sans nom'}
                    </h3>
                  </Link>
                  {set.groupId && (
                    <Link
                      href={`/groups/${set.groupId}`}
                      className="ml-2 shrink-0 px-1.5 py-0.5 bg-[var(--accent-soft)] text-[var(--accent)] rounded text-[10px] tracking-wider hover:bg-[var(--accent)] hover:text-white transition-colors"
                    >
                      {groupNameById[set.groupId] ?? 'Groupe'}
                    </Link>
                  )}
                </div>
                {set.description && (
                  <p className="text-sm text-[var(--ink-light)] mt-1 line-clamp-2">{set.description}</p>
                )}
                <div className="flex items-center gap-2 mt-3 text-xs text-[var(--ink-faint)]">
                  <span>{set.sheetIds.length} grille{set.sheetIds.length > 1 ? 's' : ''}</span>
                  <span>•</span>
                  <span>Modifié le {set.updatedAt.toLocaleDateString('fr-FR')}</span>
                </div>
                <div className="flex items-center gap-3 mt-4 pt-3 border-t border-[var(--line)]">
                  <Link href={`/sets/${set.id}`} className="text-xs text-[var(--ink-light)] hover:text-[var(--accent)] transition-colors">
                    Modifier
                  </Link>
                  {set.sheetIds.length > 0 && (
                    <Link href={`/sets/${set.id}/play`} className="text-xs text-[var(--ink-light)] hover:text-[var(--accent)] transition-colors">
                      Lancer
                    </Link>
                  )}
                  <button
                    onClick={() => onDeleteSet(set.id!, set.name)}
                    className="text-xs text-[var(--ink-light)] hover:text-red-600 transition-colors ml-auto"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="list"
          title="Aucun set pour le moment"
          description="Créez votre première setlist pour vos concerts !"
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
