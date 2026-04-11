'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ChordCard } from '@/components/chord';
import { ChordEditorModal } from '@/components/chord/chord-editor-modal';
import type { StringChord, PianoChord, InstrumentId } from '@/types';
import { getChordsByInstrument } from '@/lib/chord-data';
import { useLibraryChords, libraryKey } from '@/lib/library-chords-context';
import { useAuth } from '@/lib/auth-context';

type CategoryGroup = 'major' | 'minor' | 'other';

const CAT_LABELS: Record<CategoryGroup, string> = {
  major: 'Majeurs',
  minor: 'Mineurs',
  other: 'Autres',
};

function getCategoryGroup(category: string): CategoryGroup {
  if (category === 'major') return 'major';
  if (category === 'minor') return 'minor';
  return 'other';
}

const INSTRUMENTS: { id: InstrumentId; label: string }[] = [
  { id: 'guitar', label: 'Guitare' },
  { id: 'ukulele', label: 'Ukulélé' },
  { id: 'piano', label: 'Piano' },
  { id: 'mandolin', label: 'Mandoline' },
  { id: 'banjo', label: 'Banjo' },
];

function ChordsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isAdmin, user } = useAuth();
  const { overrides, additions, saveLibraryChord, deleteLibraryChord } = useLibraryChords();

  const instrumentParam = (searchParams.get('instrument') || 'guitar') as InstrumentId;
  const categoryParam = (searchParams.get('category') || 'major') as CategoryGroup;

  const [instrumentId, setInstrumentId] = useState<InstrumentId>(instrumentParam);
  const [categoryGroup, setCategoryGroup] = useState<CategoryGroup>(categoryParam);

  // Modal d'édition admin
  const [modalOpen, setModalOpen] = useState(false);
  const [editingChordName, setEditingChordName] = useState('');
  const [editingInitialChord, setEditingInitialChord] = useState<StringChord | PianoChord | null>(null);
  const [editingIsOverride, setEditingIsOverride] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setInstrumentId(instrumentParam);
    setCategoryGroup(categoryParam);
  }, [instrumentParam, categoryParam]);

  const updateUrl = (instrument: InstrumentId, category: CategoryGroup) => {
    router.push(`/chords?instrument=${instrument}&category=${category}`, { scroll: false });
  };

  const handleInstrumentChange = (id: InstrumentId) => {
    setInstrumentId(id);
    updateUrl(id, categoryGroup);
  };

  const handleCategoryChange = (cat: CategoryGroup) => {
    setCategoryGroup(cat);
    updateUrl(instrumentId, cat);
  };

  // Accords statiques filtrés par catégorie
  const staticChords = useMemo(() => {
    const all = getChordsByInstrument(instrumentId);
    return all.filter((c) => getCategoryGroup(c.category) === categoryGroup);
  }, [instrumentId, categoryGroup]);

  // Fusions : chaque accord statique → override éventuel
  const displayChords = useMemo(() => {
    return staticChords.map((chord) => {
      const key = libraryKey(chord.name, instrumentId);
      const override = overrides.get(key);
      return { original: chord, display: override ? override.chord : chord, hasOverride: !!override, overrideDocId: override?.docId };
    });
  }, [staticChords, instrumentId, overrides]);

  // Ajouts admin correspondant à la catégorie courante
  const adminAdditions = useMemo(() => {
    return additions.filter(
      (a) => a.instrumentId === instrumentId && getCategoryGroup(a.chord.category) === categoryGroup
    );
  }, [additions, instrumentId, categoryGroup]);

  const openEditModal = (chord: StringChord | PianoChord, isOverride: boolean) => {
    setEditingChordName(chord.name);
    setEditingInitialChord(chord);
    setEditingIsOverride(isOverride);
    setModalOpen(true);
  };

  const openNewModal = () => {
    setEditingChordName('');
    setEditingInitialChord(null);
    setEditingIsOverride(false);
    setModalOpen(true);
  };

  const handleSave = async (chord: StringChord | PianoChord) => {
    if (!user) return;
    setSaving(true);
    try {
      await saveLibraryChord(chord, instrumentId, editingIsOverride, user.email);
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOverride = async (docId: string) => {
    if (!confirm('Supprimer la modification admin ? L\'accord de base sera restauré.')) return;
    await deleteLibraryChord(docId);
  };

  const handleDeleteAddition = async (docId: string) => {
    if (!confirm('Supprimer cet accord ajouté ?')) return;
    await deleteLibraryChord(docId);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-playfair text-3xl font-bold text-[var(--ink)]">
            Bibliothèque d&apos;accords
          </h1>
          <p className="text-[var(--ink-light)] mt-1 text-sm">
            Tous les accords de la bibliothèque, par instrument et catégorie.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={openNewModal}
            className="flex-shrink-0 px-4 py-2 rounded-lg border text-sm font-medium transition-colors bg-[var(--accent)] text-white border-[var(--accent)] hover:bg-[#a83d25]"
          >
            + Ajouter un accord
          </button>
        )}
      </div>

      {/* Sélecteur d'instrument */}
      <div className="flex flex-wrap gap-2 mb-4">
        {INSTRUMENTS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => handleInstrumentChange(id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              instrumentId === id
                ? 'bg-[var(--ink)] text-white border-[var(--ink)]'
                : 'bg-white text-[var(--ink-light)] border-[var(--line)] hover:border-[var(--ink-faint)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Sélecteur de catégorie */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {(['major', 'minor', 'other'] as CategoryGroup[]).map((cat) => (
          <button
            key={cat}
            onClick={() => handleCategoryChange(cat)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              categoryGroup === cat
                ? 'bg-white text-[var(--ink)] shadow-sm'
                : 'text-[var(--ink-light)] hover:text-[var(--ink)]'
            }`}
          >
            {CAT_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Accords ajoutés par admin */}
      {isAdmin && adminAdditions.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)] mb-3">
            Accords ajoutés par admin ({adminAdditions.length})
          </p>
          <div className="flex flex-wrap gap-4">
            {adminAdditions.map((a) => (
              <div key={a.docId} className="relative group">
                <ChordCard chord={a.chord} instrumentId={instrumentId} size="sm" />
                <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEditModal(a.chord, false)}
                    className="w-6 h-6 bg-blue-500 text-white rounded text-xs flex items-center justify-center"
                    title="Modifier"
                  >✎</button>
                  <button
                    onClick={() => handleDeleteAddition(a.docId)}
                    className="w-6 h-6 bg-red-500 text-white rounded text-xs flex items-center justify-center"
                    title="Supprimer"
                  >✕</button>
                </div>
              </div>
            ))}
          </div>
          <div className="h-px bg-[var(--line)] mt-6 mb-2" />
        </div>
      )}

      {/* Grille d'accords */}
      {displayChords.length === 0 ? (
        <div className="text-center py-16 text-[var(--ink-faint)]">
          Aucun accord trouvé pour cette sélection.
        </div>
      ) : (
        <div className="flex flex-wrap gap-4">
          {displayChords.map(({ original, display, hasOverride, overrideDocId }) => (
            <div key={original.id} className="relative group">
              <ChordCard chord={display} instrumentId={instrumentId} size="sm" />
              {hasOverride && (
                <span className="absolute top-1 left-1 text-[9px] bg-[var(--accent)] text-white px-1 rounded">
                  modifié
                </span>
              )}
              {isAdmin && (
                <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEditModal(display, true)}
                    className="w-6 h-6 bg-blue-500 text-white rounded text-xs flex items-center justify-center"
                    title="Modifier cet accord"
                  >✎</button>
                  {hasOverride && overrideDocId && (
                    <button
                      onClick={() => handleDeleteOverride(overrideDocId)}
                      className="w-6 h-6 bg-gray-500 text-white rounded text-xs flex items-center justify-center"
                      title="Restaurer l'accord de base"
                    >↩</button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal d'édition admin */}
      {isAdmin && (
        <ChordEditorModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
          chordName={editingChordName}
          instrumentId={instrumentId}
          initialChord={editingInitialChord}
        />
      )}

      {saving && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 text-sm text-[var(--ink)]">Sauvegarde en cours…</div>
        </div>
      )}
    </div>
  );
}

export default function ChordsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--accent)] border-t-transparent" />
      </div>
    }>
      <ChordsPageContent />
    </Suspense>
  );
}
