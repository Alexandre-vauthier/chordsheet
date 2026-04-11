'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ChordCard } from '@/components/chord';
import { ChordEditorModal } from '@/components/chord/chord-editor-modal';
import type { StringChord, PianoChord, InstrumentId } from '@/types';
import { getChordsByInstrument } from '@/lib/chord-data';
import { useLibraryChords, libraryKey } from '@/lib/library-chords-context';
import { useAuth } from '@/lib/auth-context';

// Catégories étendues (correspondent aux catégories de chord-data.ts)
type CategoryGroup = 'major' | 'minor' | 'dom7' | 'maj7' | 'min7' | 'dim' | 'aug' | 'sus' | 'other';

const CAT_LABELS: Record<CategoryGroup, string> = {
  major:  'Majeurs',
  minor:  'Mineurs',
  dom7:   '7',
  maj7:   'Maj 7',
  min7:   'Min 7',
  dim:    'Dim',
  aug:    'Aug',
  sus:    'Sus / Add',
  other:  'Autres',
};

// Ordre d'affichage des onglets
const CAT_ORDER: CategoryGroup[] = ['major', 'minor', 'dom7', 'maj7', 'min7', 'dim', 'aug', 'sus', 'other'];

function getCategoryGroup(category: string): CategoryGroup {
  if (category === 'major') return 'major';
  if (category === 'minor') return 'minor';
  if (category === 'dom7') return 'dom7';
  if (category === 'maj7') return 'maj7';
  if (category === 'min7') return 'min7';
  if (category === 'dim') return 'dim';
  if (category === 'aug') return 'aug';
  if (category === 'sus' || category === 'add9' || category === 'sus2' || category === 'sus4') return 'sus';
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
  // Catégorie forcée pour les nouveaux accords (additions)
  const [forcedCategory, setForcedCategory] = useState<string>('major');
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

  // Vérifier quelles catégories ont des accords (pour masquer les onglets vides)
  const nonEmptyCategories = useMemo(() => {
    const all = getChordsByInstrument(instrumentId);
    const cats = new Set<CategoryGroup>();
    all.forEach((c) => cats.add(getCategoryGroup(c.category)));
    // Ajouter les catégories des additions admin
    additions
      .filter(a => a.instrumentId === instrumentId)
      .forEach(a => cats.add(getCategoryGroup(a.chord.category)));
    return cats;
  }, [instrumentId, additions]);

  // Fusions : chaque accord statique → override éventuel (avec fallback enharmonique)
  const displayChords = useMemo(() => {
    return staticChords.map((chord) => {
      const key = libraryKey(chord.name, instrumentId);
      // Essayer aussi la clé enharmonique inverse pour trouver l'override
      const allKeys = [key];
      const enh = chord.name.match(/^([A-G][b#]?)(.*)$/);
      if (enh) {
        const ENH: Record<string,string> = {'Db':'C#','Eb':'D#','F':'E#','Ab':'G#','Bb':'A#','C':'B#','B':'Cb','E':'Fb','F#':'Gb'};
        const mapped = ENH[enh[1]];
        if (mapped) allKeys.push(libraryKey(mapped + enh[2], instrumentId));
      }
      const override = allKeys.map(k => overrides.get(k)).find(Boolean);
      return {
        original: chord,
        display: override ? override.chord : chord,
        hasOverride: !!override,
        overrideDocId: override?.docId,
      };
    });
  }, [staticChords, instrumentId, overrides]);

  // Ajouts admin groupés par nom (pour variantes navigables)
  const adminAdditionGroups = useMemo(() => {
    const filtered = additions.filter(
      (a) => a.instrumentId === instrumentId && getCategoryGroup(a.chord.category) === categoryGroup,
    );
    // Grouper par nom normalisé
    const groups = new Map<string, typeof filtered>();
    filtered.forEach(a => {
      const k = a.chord.name.trim().toLowerCase();
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(a);
    });
    return Array.from(groups.values());
  }, [additions, instrumentId, categoryGroup]);

  const openEditModal = (chord: StringChord | PianoChord, isOverride: boolean) => {
    setEditingChordName(chord.name);
    setEditingInitialChord(chord);
    setEditingIsOverride(isOverride);
    setForcedCategory(chord.category);
    setModalOpen(true);
  };

  const openNewModal = () => {
    setEditingChordName('');
    setEditingInitialChord(null);
    setEditingIsOverride(false);
    // Catégorie par défaut = onglet actuel
    setForcedCategory(categoryGroup);
    setModalOpen(true);
  };

  const handleSave = async (chord: StringChord | PianoChord) => {
    if (!user) return;
    setSaving(true);
    try {
      // Pour les ajouts, injecter la catégorie choisie
      const finalChord = editingIsOverride
        ? chord
        : { ...chord, category: forcedCategory };
      await saveLibraryChord(finalChord, instrumentId, editingIsOverride, user.email);
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

      {/* Onglets de catégorie — seulement les catégories non vides */}
      <div className="flex flex-wrap gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {CAT_ORDER.filter((cat) => nonEmptyCategories.has(cat)).map((cat) => (
          <button
            key={cat}
            onClick={() => handleCategoryChange(cat)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
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
      {isAdmin && adminAdditionGroups.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)] mb-3">
            Ajoutés ({adminAdditionGroups.reduce((s, g) => s + g.length, 0)})
          </p>
          <div className="flex flex-wrap gap-4">
            {adminAdditionGroups.map((group) => (
              <AdditionGroup
                key={group[0].docId}
                group={group}
                instrumentId={instrumentId}
                onEdit={(chord) => openEditModal(chord, false)}
                onDelete={handleDeleteAddition}
              />
            ))}
          </div>
          {displayChords.length > 0 && <div className="h-px bg-[var(--line)] mt-6 mb-4" />}
        </div>
      )}

      {/* Grille d'accords de la bibliothèque */}
      {displayChords.length === 0 && adminAdditionGroups.length === 0 ? (
        <div className="text-center py-16 text-[var(--ink-faint)]">
          Aucun accord trouvé pour cette sélection.
        </div>
      ) : displayChords.length > 0 ? (
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
      ) : null}

      {/* Modal d'édition admin */}
      {isAdmin && (
        <ChordEditorModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
          chordName={editingChordName}
          instrumentId={instrumentId}
          initialChord={editingInitialChord}
          isAddition={!editingIsOverride && !editingChordName}
          forcedCategory={forcedCategory}
          onCategoryChange={setForcedCategory}
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

// ─── Groupe de variantes admin navigables ────────────────────────────────────

import type { LibraryChord } from '@/lib/library-chords-context';

function AdditionGroup({
  group,
  instrumentId,
  onEdit,
  onDelete,
}: {
  group: LibraryChord[];
  instrumentId: InstrumentId;
  onEdit: (chord: StringChord | PianoChord) => void;
  onDelete: (docId: string) => void;
}) {
  const [idx, setIdx] = useState(0);
  const current = group[Math.min(idx, group.length - 1)];
  const hasMany = group.length > 1;

  return (
    <div className="relative group flex flex-col items-center">
      {hasMany && (
        <div className="flex items-center gap-2 mb-1">
          <button onClick={() => setIdx(i => (i === 0 ? group.length - 1 : i - 1))}
            className="w-5 h-5 flex items-center justify-center text-xs text-[var(--ink-light)] hover:text-[var(--ink)] hover:bg-gray-100 rounded">‹</button>
          <span className="text-[10px] text-[var(--ink-faint)]">{idx + 1}/{group.length}</span>
          <button onClick={() => setIdx(i => (i + 1) % group.length)}
            className="w-5 h-5 flex items-center justify-center text-xs text-[var(--ink-light)] hover:text-[var(--ink)] hover:bg-gray-100 rounded">›</button>
        </div>
      )}
      <ChordCard chord={current.chord} instrumentId={instrumentId} size="sm" />
      <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ top: hasMany ? '28px' : '4px' }}>
        <button onClick={() => onEdit(current.chord)}
          className="w-6 h-6 bg-blue-500 text-white rounded text-xs flex items-center justify-center" title="Modifier">✎</button>
        <button onClick={() => onDelete(current.docId)}
          className="w-6 h-6 bg-red-500 text-white rounded text-xs flex items-center justify-center" title="Supprimer cette variante">✕</button>
      </div>
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
