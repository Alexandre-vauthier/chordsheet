'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { useAuth } from '@/lib/auth-context';
import { getDb } from '@/lib/firebase';
import { fromFirestore } from '@/lib/firestore-helpers';
import { useSet } from '@/lib/use-sets';
import { useSets } from '@/lib/use-sets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Sheet } from '@/types';

interface SetPageProps {
  params: Promise<{ id: string }>;
}

export default function SetPage({ params }: SetPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const { set, sheets, isLoading, error } = useSet(id);
  const { updateSet, reorderSheets, removeSheetFromSet, addSheetToSet } = useSets(user?.id);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Grilles disponibles pour ajout
  const [availableSheets, setAvailableSheets] = useState<Sheet[]>([]);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Drag and drop
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [localSheets, setLocalSheets] = useState<Sheet[]>([]);

  // Initialiser les valeurs du formulaire
  useEffect(() => {
    if (set) {
      setName(set.name);
      setDescription(set.description || '');
      setIsPublic(set.isPublic);
    }
  }, [set]);

  // Synchroniser localSheets avec sheets
  useEffect(() => {
    setLocalSheets(sheets);
  }, [sheets]);

  // Charger les grilles disponibles (du book ou propres grilles)
  useEffect(() => {
    async function loadAvailableSheets() {
      if (!user) return;

      try {
        const db = getDb();
        const q = query(
          collection(db, 'sheets'),
          where('ownerId', '==', user.id),
          orderBy('updatedAt', 'desc')
        );

        const snapshot = await getDocs(q);
        const loadedSheets: Sheet[] = snapshot.docs.map((docSnap) =>
          fromFirestore(docSnap.id, docSnap.data())
        );

        setAvailableSheets(loadedSheets);
      } catch (error) {
        console.error('Error loading sheets:', error);
      }
    }

    loadAvailableSheets();
  }, [user]);

  const handleSave = async () => {
    if (!set?.id) return;

    setIsSaving(true);
    try {
      await updateSet(set.id, {
        name,
        description,
        isPublic,
      });
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving set:', error);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddSheet = async (sheetId: string) => {
    if (!set?.id) return;
    await addSheetToSet(set.id, sheetId);
    setShowAddSheet(false);
    setSearchQuery('');
  };

  const handleRemoveSheet = async (sheetId: string) => {
    if (!set?.id) return;
    await removeSheetFromSet(set.id, sheetId);
  };

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newSheets = [...localSheets];
    const draggedSheet = newSheets[draggedIndex];
    newSheets.splice(draggedIndex, 1);
    newSheets.splice(index, 0, draggedSheet);
    setLocalSheets(newSheets);
    setDraggedIndex(index);
  };

  const handleDragEnd = async () => {
    if (!set?.id || draggedIndex === null) return;

    const newSheetIds = localSheets.map((s) => s.id!);
    await reorderSheets(set.id, newSheetIds);
    setDraggedIndex(null);
  };

  // Filtrer les grilles disponibles
  const filteredAvailableSheets = availableSheets.filter((sheet) => {
    // Exclure les grilles déjà dans le set
    if (set?.sheetIds.includes(sheet.id!)) return false;

    // Filtrer par recherche
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return (
        sheet.title.toLowerCase().includes(query) ||
        sheet.artist.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Vérifier si l'utilisateur est le propriétaire
  const isOwner = user?.id === set?.ownerId;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--accent)] border-t-transparent" />
      </div>
    );
  }

  if (error || !set) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <p className="text-red-600 mb-4">{error || 'Set non trouvé'}</p>
        <button
          onClick={() => router.push('/sets')}
          className="text-[var(--accent)] hover:underline"
        >
          Retour aux sets
        </button>
      </div>
    );
  }

  // Vue lecture seule pour les visiteurs
  if (!isOwner) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[var(--ink)]">{set.name}</h1>
          {set.description && (
            <p className="text-[var(--ink-light)] mt-1">{set.description}</p>
          )}
          <p className="text-sm text-[var(--ink-faint)] mt-2">
            par {set.ownerName} • {sheets.length} grille{sheets.length > 1 ? 's' : ''}
          </p>
        </div>

        {sheets.length > 0 && (
          <div className="flex gap-3 mb-6">
            <Link href={`/sets/${id}/play`}>
              <Button>▶ Lancer le set</Button>
            </Link>
          </div>
        )}

        <div className="space-y-2">
          {sheets.map((sheet, index) => (
            <Link
              key={sheet.id}
              href={`/sheet/${sheet.id}`}
              className="flex items-center gap-4 p-4 bg-white rounded-lg border border-[var(--line)] hover:border-[var(--accent)] transition-colors"
            >
              <span className="w-8 h-8 flex items-center justify-center bg-[var(--cell-bg)] rounded-full text-sm font-medium text-[var(--ink-light)]">
                {index + 1}
              </span>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-[var(--ink)] truncate">
                  {sheet.title || 'Sans titre'}
                </h3>
                {sheet.artist && (
                  <p className="text-sm text-[var(--ink-light)] truncate">{sheet.artist}</p>
                )}
              </div>
              {sheet.key && (
                <span className="text-xs text-[var(--ink-faint)]">{sheet.key}</span>
              )}
            </Link>
          ))}
        </div>
      </div>
    );
  }

  // Vue édition pour le propriétaire
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" onClick={() => router.push('/sets')}>
          ← Retour aux sets
        </Button>
        {sheets.length > 0 && (
          <Link href={`/sets/${id}/play`}>
            <Button>▶ Lancer le set</Button>
          </Link>
        )}
      </div>

      {/* Formulaire */}
      <div className="bg-white rounded-xl border border-[var(--line)] p-6 mb-6">
        <div className="space-y-4">
          <Input
            label="Nom du set"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setHasChanges(true);
            }}
            placeholder="Ex: Concert du 15 mars"
          />

          <div>
            <label className="block text-sm font-medium text-[var(--ink)] mb-1.5">
              Description (optionnel)
            </label>
            <textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setHasChanges(true);
              }}
              placeholder="Notes sur le concert, le lieu, etc."
              rows={2}
              className="w-full px-4 py-2.5 rounded-lg border border-[var(--line)] bg-white
                text-[var(--ink)] placeholder:text-[var(--ink-faint)]
                focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => {
                setIsPublic(e.target.checked);
                setHasChanges(true);
              }}
              className="w-4 h-4 rounded border-[var(--line)] text-[var(--accent)]
                focus:ring-[var(--accent)] cursor-pointer"
            />
            <span className="text-sm text-[var(--ink-light)]">
              Set public (partageable par lien)
            </span>
          </label>

          {hasChanges && (
            <Button onClick={handleSave} isLoading={isSaving}>
              Sauvegarder
            </Button>
          )}
        </div>

        {isPublic && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">
              Lien de partage :{' '}
              <code className="bg-blue-100 px-1 py-0.5 rounded">
                {typeof window !== 'undefined' ? `${window.location.origin}/sets/${id}` : ''}
              </code>
            </p>
          </div>
        )}
      </div>

      {/* Liste des grilles */}
      <div className="bg-white rounded-xl border border-[var(--line)] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-[var(--ink)]">
            Grilles ({sheets.length})
          </h2>
          <Button variant="ghost" onClick={() => setShowAddSheet(!showAddSheet)}>
            {showAddSheet ? 'Annuler' : '+ Ajouter une grille'}
          </Button>
        </div>

        {/* Panneau d'ajout */}
        {showAddSheet && (
          <div className="mb-4 p-4 bg-[var(--cell-bg)] rounded-lg">
            <Input
              type="search"
              placeholder="Rechercher une grille..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mb-3"
            />
            <div className="max-h-48 overflow-y-auto space-y-1">
              {filteredAvailableSheets.length > 0 ? (
                filteredAvailableSheets.map((sheet) => (
                  <button
                    key={sheet.id}
                    onClick={() => handleAddSheet(sheet.id!)}
                    className="w-full flex items-center gap-3 p-2 rounded hover:bg-white transition-colors text-left"
                  >
                    <span className="font-medium text-sm text-[var(--ink)]">
                      {sheet.title || 'Sans titre'}
                    </span>
                    {sheet.artist && (
                      <span className="text-xs text-[var(--ink-light)]">
                        {sheet.artist}
                      </span>
                    )}
                  </button>
                ))
              ) : (
                <p className="text-sm text-[var(--ink-faint)] text-center py-2">
                  {searchQuery ? 'Aucune grille trouvée' : 'Toutes vos grilles sont déjà dans le set'}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Liste réordonnables */}
        {localSheets.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-[var(--ink-faint)] mb-2">
              Glissez-déposez pour réorganiser l&apos;ordre
            </p>
            {localSheets.map((sheet, index) => (
              <div
                key={sheet.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-3 p-3 bg-[var(--cell-bg)] rounded-lg border-2 cursor-move transition-all
                  ${draggedIndex === index ? 'border-[var(--accent)] opacity-50' : 'border-transparent'}
                  hover:border-[var(--line)]`}
              >
                <span className="w-6 h-6 flex items-center justify-center bg-white rounded text-xs font-medium text-[var(--ink-light)]">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm text-[var(--ink)] truncate">
                    {sheet.title || 'Sans titre'}
                  </h3>
                  {sheet.artist && (
                    <p className="text-xs text-[var(--ink-light)] truncate">{sheet.artist}</p>
                  )}
                </div>
                {sheet.key && (
                  <span className="text-xs text-[var(--ink-faint)]">{sheet.key}</span>
                )}
                <button
                  onClick={() => handleRemoveSheet(sheet.id!)}
                  className="p-1 text-[var(--ink-faint)] hover:text-red-500 transition-colors"
                  title="Retirer du set"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-[var(--ink-faint)]">
            <p>Aucune grille dans ce set</p>
            <p className="text-sm mt-1">Ajoutez des grilles pour construire votre setlist</p>
          </div>
        )}
      </div>
    </div>
  );
}
