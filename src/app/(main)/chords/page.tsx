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

  // Liste unifiée : statiques + ajouts admin, groupés par nom, triés alphabétiquement
  const unifiedGroups = useMemo(() => {
    // Map nom normalisé → { variants: chord[], overrideDocId?, isOverride }
    type Group = {
      name: string; // nom d'affichage (premier trouvé)
      variants: (StringChord | PianoChord)[];
      overrideDocId?: string;
      hasOverride: boolean;
      additionDocIds: string[]; // pour suppression variantes admin
    };
    const groups = new Map<string, Group>();

    const ENH: Record<string,string> = {'Db':'C#','Eb':'D#','F':'E#','Ab':'G#','Bb':'A#','C':'B#','B':'Cb','E':'Fb','F#':'Gb'};

    // 1. Partir des accords statiques
    staticChords.forEach((chord) => {
      const key = libraryKey(chord.name, instrumentId);
      const allKeys = [key];
      const enh = chord.name.match(/^([A-G][b#]?)(.*)$/);
      if (enh && ENH[enh[1]]) allKeys.push(libraryKey(ENH[enh[1]] + enh[2], instrumentId));
      const override = allKeys.map(k => overrides.get(k)).find(Boolean);

      const nameLower = chord.name.trim().toLowerCase();
      if (!groups.has(nameLower)) {
        groups.set(nameLower, { name: chord.name, variants: [], hasOverride: false, additionDocIds: [] });
      }
      const g = groups.get(nameLower)!;
      if (override) {
        g.variants.unshift(override.chord); // override en premier
        g.hasOverride = true;
        g.overrideDocId = override.docId;
      } else {
        g.variants.push(chord);
      }
    });

    // 2. Ajouter les additions admin de la catégorie courante
    additions
      .filter(a => a.instrumentId === instrumentId && getCategoryGroup(a.chord.category) === categoryGroup)
      .forEach(a => {
        const nameLower = a.chord.name.trim().toLowerCase();
        if (!groups.has(nameLower)) {
          groups.set(nameLower, { name: a.chord.name, variants: [], hasOverride: false, additionDocIds: [] });
        }
        const g = groups.get(nameLower)!;
        // Les additions viennent après l'override mais avant les statiques si override
        // Si pas d'override, après les statiques existants (ou en début si groupe nouveau)
        if (g.hasOverride) {
          g.variants.splice(1, 0, a.chord); // après l'override
        } else {
          g.variants.push(a.chord);
        }
        g.additionDocIds.push(a.docId);
      });

    // 3. Trier alphabétiquement et retourner
    return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [staticChords, instrumentId, overrides, additions, categoryGroup]);

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

      {/* Liste unifiée : statiques + ajouts, triée alphabétiquement */}
      {unifiedGroups.length === 0 ? (
        <div className="text-center py-16 text-[var(--ink-faint)]">
          Aucun accord trouvé pour cette sélection.
        </div>
      ) : (
        <div className="flex flex-wrap gap-4">
          {unifiedGroups.map((group) => (
            <UnifiedChordGroup
              key={group.name}
              group={group}
              instrumentId={instrumentId}
              isAdmin={isAdmin}
              onEditOverride={(chord) => openEditModal(chord, true)}
              onEditAddition={(chord) => openEditModal(chord, false)}
              onDeleteOverride={handleDeleteOverride}
              onDeleteAddition={handleDeleteAddition}
            />
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

// ─── Groupe unifié : statiques + ajouts, navigables ─────────────────────────

type UnifiedGroup = {
  name: string;
  variants: (StringChord | PianoChord)[];
  hasOverride: boolean;
  overrideDocId?: string;
  additionDocIds: string[];
};

function UnifiedChordGroup({
  group,
  instrumentId,
  isAdmin,
  onEditOverride,
  onEditAddition,
  onDeleteOverride,
  onDeleteAddition,
}: {
  group: UnifiedGroup;
  instrumentId: InstrumentId;
  isAdmin: boolean;
  onEditOverride: (chord: StringChord | PianoChord) => void;
  onEditAddition: (chord: StringChord | PianoChord) => void;
  onDeleteOverride: (docId: string) => void;
  onDeleteAddition: (docId: string) => void;
}) {
  const [idx, setIdx] = useState(0);
  const safeIdx = Math.min(idx, group.variants.length - 1);
  const current = group.variants[safeIdx];
  const hasMany = group.variants.length > 1;

  // Déterminer si la variante courante est un ajout admin
  const additionOffset = group.hasOverride ? 1 : 0;
  const isCurrentAddition = safeIdx >= additionOffset && (safeIdx - additionOffset) < group.additionDocIds.length;
  const currentAdditionDocId = isCurrentAddition ? group.additionDocIds[safeIdx - additionOffset] : undefined;

  return (
    <div className="relative group flex flex-col items-center">
      {hasMany && (
        <div className="flex items-center gap-2 mb-1">
          <button onClick={() => setIdx(i => (i === 0 ? group.variants.length - 1 : i - 1))}
            className="w-5 h-5 flex items-center justify-center text-xs text-[var(--ink-light)] hover:text-[var(--ink)] hover:bg-gray-100 rounded">‹</button>
          <span className="text-[10px] text-[var(--ink-faint)]">{safeIdx + 1}/{group.variants.length}</span>
          <button onClick={() => setIdx(i => (i + 1) % group.variants.length)}
            className="w-5 h-5 flex items-center justify-center text-xs text-[var(--ink-light)] hover:text-[var(--ink)] hover:bg-gray-100 rounded">›</button>
        </div>
      )}
      <ChordCard chord={current} instrumentId={instrumentId} size="sm" />
      {group.hasOverride && safeIdx === 0 && (
        <span className="text-[9px] bg-[var(--accent)] text-white px-1 rounded mt-1">modifié</span>
      )}
      {isCurrentAddition && (
        <span className="text-[9px] bg-blue-500 text-white px-1 rounded mt-1">ajouté</span>
      )}
      {isAdmin && (
        <div
          className="absolute right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ top: hasMany ? '28px' : '4px' }}
        >
          {isCurrentAddition && currentAdditionDocId ? (
            <>
              <button onClick={() => onEditAddition(current)}
                className="w-6 h-6 bg-blue-500 text-white rounded text-xs flex items-center justify-center" title="Modifier cet ajout">✎</button>
              <button onClick={() => onDeleteAddition(currentAdditionDocId)}
                className="w-6 h-6 bg-red-500 text-white rounded text-xs flex items-center justify-center" title="Supprimer">✕</button>
            </>
          ) : (
            <>
              <button onClick={() => onEditOverride(current)}
                className="w-6 h-6 bg-blue-500 text-white rounded text-xs flex items-center justify-center" title="Modifier">✎</button>
              {group.hasOverride && group.overrideDocId && safeIdx === 0 && (
                <button onClick={() => onDeleteOverride(group.overrideDocId!)}
                  className="w-6 h-6 bg-gray-500 text-white rounded text-xs flex items-center justify-center" title="Restaurer l'original">↩</button>
              )}
            </>
          )}
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
