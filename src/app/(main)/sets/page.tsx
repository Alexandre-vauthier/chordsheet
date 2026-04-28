'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useSets } from '@/lib/use-sets';
import { useSetBookmarks } from '@/lib/use-set-bookmarks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createEmptySet } from '@/types';

export default function SetsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { sets, isLoading, createSet, deleteSet } = useSets(user?.id);
  const { bookmarkedSets, removeBookmark: removeSetBookmark } = useSetBookmarks(user?.id);
  const [isCreating, setIsCreating] = useState(false);
  const [newSetName, setNewSetName] = useState('');

  const handleCreateSet = async () => {
    if (!user || !newSetName.trim()) return;

    setIsCreating(true);
    try {
      const newSet = createEmptySet(user.id, user.displayName);
      newSet.name = newSetName.trim();
      const setId = await createSet(newSet);
      router.push(`/sets/${setId}`);
    } catch (error) {
      console.error('Error creating set:', error);
      alert('Erreur lors de la création du set');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteSet = async (setId: string, setName: string) => {
    if (!confirm(`Supprimer le set "${setName}" ?`)) return;

    try {
      await deleteSet(setId);
    } catch (error) {
      console.error('Error deleting set:', error);
      alert('Erreur lors de la suppression');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--ink)]">Mes Sets</h1>
          <p className="text-[var(--ink-light)] mt-1">
            Organisez vos grilles en setlists pour vos concerts
          </p>
        </div>
      </div>

      {/* Formulaire de création */}
      <div className="bg-[var(--cell-bg)] rounded-xl border border-[var(--line)] p-4 mb-8">
        <div className="flex gap-3">
          <Input
            type="text"
            placeholder="Nom du nouveau set (ex: Concert du 15 mars)"
            value={newSetName}
            onChange={(e) => setNewSetName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateSet()}
            className="flex-1"
          />
          <Button
            onClick={handleCreateSet}
            disabled={!newSetName.trim() || isCreating}
            isLoading={isCreating}
            className="whitespace-nowrap"
          >
            + Créer un set
          </Button>
        </div>
      </div>

      {/* Liste des sets */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-[var(--cell-bg)] rounded-xl border border-[var(--line)] h-40 animate-pulse"
            />
          ))}
        </div>
      ) : sets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sets.map((set) => (
            <div
              key={set.id}
              className="bg-[var(--cell-bg)] rounded-xl border border-[var(--line)] overflow-hidden hover:shadow-md transition-shadow group"
            >
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <Link href={`/sets/${set.id}`} className="flex-1">
                    <h3 className="font-semibold text-[var(--ink)] group-hover:text-[var(--accent)] transition-colors">
                      {set.name || 'Sans nom'}
                    </h3>
                  </Link>
                  {set.isPublic && (
                    <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-[10px] uppercase tracking-wider ml-2">
                      Public
                    </span>
                  )}
                </div>

                {set.description && (
                  <p className="text-sm text-[var(--ink-light)] mt-1 line-clamp-2">
                    {set.description}
                  </p>
                )}

                <div className="flex items-center gap-2 mt-3 text-xs text-[var(--ink-faint)]">
                  <span>{set.sheetIds.length} grille{set.sheetIds.length > 1 ? 's' : ''}</span>
                  <span>•</span>
                  <span>
                    Modifié le {set.updatedAt.toLocaleDateString('fr-FR')}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 mt-4 pt-3 border-t border-[var(--line)]">
                  <Link
                    href={`/sets/${set.id}`}
                    className="text-xs text-[var(--ink-light)] hover:text-[var(--accent)] transition-colors"
                  >
                    Modifier
                  </Link>
                  {set.sheetIds.length > 0 && (
                    <Link
                      href={`/sets/${set.id}/play`}
                      className="text-xs text-[var(--ink-light)] hover:text-[var(--accent)] transition-colors"
                    >
                      Lancer
                    </Link>
                  )}
                  <button
                    onClick={() => handleDeleteSet(set.id!, set.name)}
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
        <div className="bg-[var(--cell-bg)] rounded-xl border border-[var(--line)] p-8 text-center">
          <div className="text-[var(--ink-faint)] mb-4">
            <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p className="text-lg">Aucun set pour le moment</p>
            <p className="text-sm mt-1">Créez votre première setlist pour vos concerts !</p>
          </div>
        </div>
      )}

      {/* Sets en favoris */}
      {bookmarkedSets.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold text-[var(--ink)] mb-4">Sets en favoris</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bookmarkedSets.map((set) => (
              <div
                key={set.id}
                className="bg-[var(--cell-bg)] rounded-xl border border-[var(--line)] overflow-hidden hover:shadow-md transition-shadow group"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <Link href={`/sets/${set.id}`} className="flex-1 min-w-0">
                      <h3 className="font-semibold text-[var(--ink)] group-hover:text-[var(--accent)] transition-colors truncate">
                        {set.name || 'Sans nom'}
                      </h3>
                    </Link>
                    <span className="text-amber-400 text-lg ml-2 shrink-0">★</span>
                  </div>

                  {set.description && (
                    <p className="text-sm text-[var(--ink-light)] mt-1 line-clamp-2">
                      {set.description}
                    </p>
                  )}

                  <p className="text-xs text-[var(--ink-faint)] mt-2">
                    par {set.ownerName} • {set.sheetIds.length} grille{set.sheetIds.length > 1 ? 's' : ''}
                  </p>

                  <div className="flex items-center gap-3 mt-4 pt-3 border-t border-[var(--line)]">
                    <Link
                      href={`/sets/${set.id}`}
                      className="text-xs text-[var(--ink-light)] hover:text-[var(--accent)] transition-colors"
                    >
                      Consulter
                    </Link>
                    {set.sheetIds.length > 0 && (
                      <Link
                        href={`/sets/${set.id}/play`}
                        className="text-xs text-[var(--ink-light)] hover:text-[var(--accent)] transition-colors"
                      >
                        Lancer
                      </Link>
                    )}
                    <button
                      onClick={() => removeSetBookmark(set.id!)}
                      className="text-xs text-[var(--ink-faint)] hover:text-red-600 transition-colors ml-auto"
                    >
                      Retirer des favoris
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
