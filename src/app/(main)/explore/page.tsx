'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, limit, deleteDoc, doc } from 'firebase/firestore';
import { useAuth } from '@/lib/auth-context';
import { getDb } from '@/lib/firebase';
import { fromFirestore } from '@/lib/firestore-helpers';
import { Input } from '@/components/ui/input';
import { SheetCard } from '@/components/explore/sheet-card';
import { GENRES, DIFFICULTY_LABELS, type Difficulty } from '@/types';
import type { Sheet } from '@/types';

type SortOption = 'recent' | 'rated' | 'viewed';

export default function ExplorePage() {
  const { isAdmin } = useAuth();
  const router = useRouter();

  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Filtres
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty | null>(null);

  useEffect(() => {
    async function loadPublicSheets() {
      try {
        const db = getDb();
        const q = query(
          collection(db, 'sheets'),
          where('isPublic', '==', true),
          limit(200)
        );

        const snapshot = await getDocs(q);
        const loadedSheets: Sheet[] = snapshot.docs.map((docSnap) =>
          fromFirestore(docSnap.id, docSnap.data())
        );

        setSheets(loadedSheets);
      } catch (error) {
        console.error('Error loading public sheets:', error);
      } finally {
        setLoading(false);
      }
    }

    loadPublicSheets();
  }, []);

  const handleAdminDelete = async (sheetId: string) => {
    if (!confirm('Supprimer cette grille ? Cette action est irréversible.')) return;
    try {
      const db = getDb();
      await deleteDoc(doc(db, 'sheets', sheetId));
      setSheets(prev => prev.filter(s => s.id !== sheetId));
    } catch (error) {
      console.error('Error deleting sheet:', error);
      alert('Erreur lors de la suppression');
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
  };

  const hasActiveFilters = searchQuery || selectedGenre || selectedDifficulty || sortBy !== 'recent';

  const handleRandom = () => {
    if (sheets.length === 0) return;
    const random = sheets[Math.floor(Math.random() * sheets.length)];
    router.push(`/sheet/${random.id}`);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--ink)]">Explorer</h1>
        <p className="text-[var(--ink-light)] mt-1">
          Découvrez les grilles partagées par la communauté
          {sheets.length > 0 && ` (${sheets.length} grille${sheets.length > 1 ? 's' : ''})`}
          {groupedResults.length > 0 && groupedResults.length < sheets.length && ` · ${groupedResults.length} titre${groupedResults.length > 1 ? 's' : ''} uniques`}
        </p>
      </div>

      {/* Barre de recherche et filtres */}
      <div className="space-y-4 mb-8">
        {/* Recherche */}
        <div className="flex gap-3">
          <div className="flex-1">
            <Input
              type="search"
              placeholder="Rechercher par titre, artiste, tonalité..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>
          <button
            onClick={handleRandom}
            disabled={sheets.length === 0}
            className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[var(--line)] bg-white text-sm text-[var(--ink-light)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-40"
            title="Ouvrir une grille au hasard"
          >
            ⚄ Aléatoire
          </button>
        </div>

        {/* Filtres et tri */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Tri */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--ink-light)]">Trier par :</span>
            <div className="flex rounded-lg border border-[var(--line)] overflow-hidden">
              <button
                onClick={() => setSortBy('recent')}
                className={`px-3 py-1.5 text-sm transition-colors ${
                  sortBy === 'recent'
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-white text-[var(--ink-light)] hover:bg-gray-50'
                }`}
              >
                Récents
              </button>
              <button
                onClick={() => setSortBy('rated')}
                className={`px-3 py-1.5 text-sm border-l border-[var(--line)] transition-colors ${
                  sortBy === 'rated'
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-white text-[var(--ink-light)] hover:bg-gray-50'
                }`}
              >
                Mieux notés
              </button>
              <button
                onClick={() => setSortBy('viewed')}
                className={`px-3 py-1.5 text-sm border-l border-[var(--line)] transition-colors ${
                  sortBy === 'viewed'
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-white text-[var(--ink-light)] hover:bg-gray-50'
                }`}
              >
                Plus consultés
              </button>
            </div>
          </div>

          {/* Séparateur */}
          <div className="hidden sm:block h-6 w-px bg-[var(--line)]" />

          {/* Genre */}
          <select
            value={selectedGenre}
            onChange={(e) => setSelectedGenre(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-[var(--line)] text-sm bg-white
              text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            <option value="">Tous les genres</option>
            {GENRES.map((genre) => (
              <option key={genre} value={genre}>
                {genre}
              </option>
            ))}
          </select>

          {/* Difficulté */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--ink-light)]">Difficulté :</span>
            <select
              value={selectedDifficulty ?? ''}
              onChange={(e) => setSelectedDifficulty(e.target.value ? Number(e.target.value) as Difficulty : null)}
              className="text-sm border border-[var(--line)] rounded-lg px-2 py-1 bg-white text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              <option value="">Toutes</option>
              {(Object.entries(DIFFICULTY_LABELS) as [string, string][]).map(([val, label]) => (
                <option key={val} value={val}>{val} · {label}</option>
              ))}
            </select>
          </div>

          {/* Réinitialiser */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="ml-auto text-sm text-[var(--accent)] hover:underline"
            >
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* Résultats */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-[var(--line)] h-48 animate-pulse"
            />
          ))}
        </div>
      ) : groupedResults.length > 0 ? (
        <>
          {hasActiveFilters && (
            <p className="text-sm text-[var(--ink-light)] mb-4">
              {groupedResults.length} titre{groupedResults.length > 1 ? 's' : ''}
              {filteredSheets.length > groupedResults.length && ` (${filteredSheets.length} versions)`}
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groupedResults.map(({ sheet, count, href }) => (
              <SheetCard
                key={`${sheet.title}-${sheet.artist}`}
                sheet={sheet}
                showRating
                hideDifficulty
                href={href}
                variantCount={count}
                onDelete={isAdmin && sheet.id ? () => handleAdminDelete(sheet.id!) : undefined}
              />
            ))}
          </div>
        </>
      ) : sheets.length > 0 ? (
        <div className="bg-white rounded-xl border border-[var(--line)] p-8 text-center">
          <div className="text-[var(--ink-faint)]">
            <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-lg">Aucun résultat</p>
            <p className="text-sm mt-1">Essayez de modifier vos filtres</p>
            <button
              onClick={clearFilters}
              className="mt-4 px-4 py-2 text-sm text-[var(--accent)] border border-[var(--accent)] rounded-lg hover:bg-[var(--accent-soft)]"
            >
              Réinitialiser les filtres
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[var(--line)] p-8 text-center">
          <div className="text-[var(--ink-faint)]">
            <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            <p className="text-lg">Aucune grille publique pour le moment</p>
            <p className="text-sm mt-1">Soyez le premier à partager !</p>
          </div>
        </div>
      )}
    </div>
  );
}
