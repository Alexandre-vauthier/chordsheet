'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChordCard } from '@/components/chord';
import { ChordEditorModal } from '@/components/chord/chord-editor-modal';
import { ChordFinder } from '@/components/chord/chord-finder';
import type { StringChord, PianoChord, InstrumentId } from '@/types';
import { getChordsByInstrument, getAllExtendedChords } from '@/lib/chord-data';
import { useLibraryChords, libraryKey } from '@/lib/library-chords-context';
import { useAuth } from '@/lib/auth-context';
import { useInstrumentLabel } from '@/lib/use-genre-labels';
import { useRouter } from '@/i18n/navigation';

// Catégories étendues (correspondent aux catégories de chord-data.ts)
type CategoryGroup = 'major' | 'minor' | 'dom7' | 'maj7' | 'min7' | 'dim' | 'aug' | 'sus' | 'other';

// Ordre d'affichage des onglets
const CAT_ORDER: CategoryGroup[] = ['major', 'minor', 'dom7', 'maj7', 'min7', 'dim', 'aug', 'sus', 'other'];

// Tri chromatique
const ROOT_SEMI: Record<string, number> = {
  C: 0, Db: 1, D: 2, Eb: 3, E: 4, F: 5, 'F#': 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11,
};
function chromaticRootSemi(name: string): number {
  const m = name.match(/^([A-G][b#]?)/);
  return m ? (ROOT_SEMI[m[1]] ?? 99) : 99;
}

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

const INSTRUMENT_IDS: InstrumentId[] = ['guitar', 'ukulele', 'piano', 'mandolin', 'banjo'];

function ChordsPageContent() {
  const t = useTranslations('Chords');
  const tCategory = useTranslations('ChordCategories');
  const instrumentLabel = useInstrumentLabel();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isAdmin, user } = useAuth();
  const { overrides, additions, saveLibraryChord, deleteLibraryChord } = useLibraryChords();

  const instrumentParam = (searchParams.get('instrument') || 'guitar') as InstrumentId;
  const categoryParam = (searchParams.get('category') || 'major') as CategoryGroup;

  const [instrumentId, setInstrumentId] = useState<InstrumentId>(instrumentParam);
  const [categoryGroup, setCategoryGroup] = useState<CategoryGroup>(categoryParam);

  const [searchQuery, setSearchQuery] = useState('');

  // Modal finder
  const [finderOpen, setFinderOpen] = useState(false);

  // Modal d'édition admin
  const [modalOpen, setModalOpen] = useState(false);
  const [editingChordName, setEditingChordName] = useState('');
  const [editingInitialChord, setEditingInitialChord] = useState<StringChord | PianoChord | null>(null);
  const [editingIsOverride, setEditingIsOverride] = useState(true);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
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

  // Tous les accords étendus algorithmiques pour l'instrument courant
  const extendedChords = useMemo(() => getAllExtendedChords(instrumentId), [instrumentId]);

  // Vérifier quelles catégories ont des accords (pour masquer les onglets vides)
  const nonEmptyCategories = useMemo(() => {
    const all = getChordsByInstrument(instrumentId);
    const cats = new Set<CategoryGroup>();
    all.forEach((c) => cats.add(getCategoryGroup(c.category)));
    extendedChords.forEach((c) => cats.add(getCategoryGroup(c.category)));
    additions
      .filter(a => a.instrumentId === instrumentId)
      .forEach(a => cats.add(getCategoryGroup(a.chord.category)));
    return cats;
  }, [instrumentId, additions, extendedChords]);

  // Liste unifiée : statiques + ajouts admin, groupés par nom, triés alphabétiquement
  const unifiedGroups = useMemo(() => {
    type Group = {
      name: string;
      variants: (StringChord | PianoChord)[];
      hasOverride: boolean;
      overrideDocId?: string;
      additionDocIds: string[];
      additionStartIdx: number;
    };
    const groups = new Map<string, Group>();

    // 0. Créer les groupes pour les overrides sans statique correspondant
    //    (ex: admin a overridé "Gb" mais "Gb" n'existe pas en statique)
    overrides.forEach((libChord) => {
      if (libChord.instrumentId !== instrumentId) return;
      if (getCategoryGroup(libChord.chord.category) !== categoryGroup) return;
      const nameLower = libChord.chord.name.trim().toLowerCase();
      if (!groups.has(nameLower)) {
        groups.set(nameLower, {
          name: libChord.chord.name,
          variants: [libChord.chord],
          hasOverride: true,
          overrideDocId: libChord.docId,
          additionDocIds: [],
          additionStartIdx: 1,
        });
      }
    });

    // 1a. Accords étendus algorithmiques (filtrés par catégorie)
    // Skip si un override admin existe déjà pour cet accord (évite doublon override + statique généré)
    extendedChords
      .filter(c => getCategoryGroup(c.category) === categoryGroup)
      .forEach((chord) => {
        const nameLower = chord.name.trim().toLowerCase();
        const overrideKey = libraryKey(chord.name, instrumentId);
        if (overrides.has(overrideKey)) return; // l'override le remplace entièrement
        if (!groups.has(nameLower)) {
          groups.set(nameLower, { name: chord.name, variants: [], hasOverride: false, additionDocIds: [], additionStartIdx: 0 });
        }
        groups.get(nameLower)!.variants.push(chord);
      });

    // 1b. Accords statiques — override par nom exact uniquement (pas d'alias enharmonique)
    //    La recherche enharmonique est réservée à useChordVariants (inline dans les grilles)
    staticChords.forEach((chord) => {
      const key = libraryKey(chord.name, instrumentId);
      const override = overrides.get(key);

      const nameLower = chord.name.trim().toLowerCase();
      if (!groups.has(nameLower)) {
        groups.set(nameLower, { name: chord.name, variants: [], hasOverride: false, additionDocIds: [], additionStartIdx: 0 });
      }
      const g = groups.get(nameLower)!;
      if (override) {
        if (!g.hasOverride) {
          g.variants.push(override.chord);
          g.hasOverride = true;
          g.overrideDocId = override.docId;
        }
        // Variantes statiques remplacées par l'override
      } else {
        g.variants.push(chord);
      }
    });

    // Marquer où commencent les additions (après statiques/override)
    groups.forEach(g => { g.additionStartIdx = g.variants.length; });

    // 2. Additions admin — toujours après les statiques
    additions
      .filter(a => a.instrumentId === instrumentId && getCategoryGroup(a.chord.category) === categoryGroup)
      .forEach(a => {
        const nameLower = a.chord.name.trim().toLowerCase();
        if (!groups.has(nameLower)) {
          groups.set(nameLower, { name: a.chord.name, variants: [], hasOverride: false, additionDocIds: [], additionStartIdx: 0 });
        }
        const g = groups.get(nameLower)!;
        g.variants.push(a.chord);
        g.additionDocIds.push(a.docId);
      });

    // 3. Tri chromatique (C → Db → D → … → B), puis alphabétique sur le suffixe
    return Array.from(groups.values())
      .filter(g => g.variants.length > 0)
      .sort((a, b) => {
        const sa = chromaticRootSemi(a.name);
        const sb = chromaticRootSemi(b.name);
        if (sa !== sb) return sa - sb;
        return a.name.localeCompare(b.name);
      });
  }, [staticChords, instrumentId, overrides, additions, categoryGroup, extendedChords]);

  // Tous les groupes de l'instrument (toutes catégories) pour la recherche
  const allGroups = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.trim().toLowerCase();
    type Group = { name: string; variants: (StringChord | PianoChord)[]; hasOverride: boolean; overrideDocId?: string; additionDocIds: string[]; additionStartIdx: number; };
    const groups = new Map<string, Group>();
    const allStatic = getChordsByInstrument(instrumentId);
    const allExtended = getAllExtendedChords(instrumentId);
    [...allExtended, ...allStatic].forEach((chord) => {
      const nameLower = chord.name.trim().toLowerCase();
      if (!nameLower.includes(q)) return;
      const key = libraryKey(chord.name, instrumentId);
      const ov = overrides.get(key);
      if (!groups.has(nameLower)) groups.set(nameLower, { name: chord.name, variants: [], hasOverride: false, additionDocIds: [], additionStartIdx: 0 });
      const g = groups.get(nameLower)!;
      if (ov && !g.hasOverride) { g.variants.push(ov.chord); g.hasOverride = true; g.overrideDocId = ov.docId; }
      else if (!ov) g.variants.push(chord);
    });
    additions.filter(a => a.instrumentId === instrumentId && a.chord.name.toLowerCase().includes(q)).forEach(a => {
      const nameLower = a.chord.name.trim().toLowerCase();
      if (!groups.has(nameLower)) groups.set(nameLower, { name: a.chord.name, variants: [], hasOverride: false, additionDocIds: [], additionStartIdx: 0 });
      const g = groups.get(nameLower)!;
      g.additionStartIdx = g.variants.length;
      g.variants.push(a.chord);
      g.additionDocIds.push(a.docId);
    });
    return Array.from(groups.values())
      .filter(g => g.variants.length > 0)
      .sort((a, b) => { const sa = chromaticRootSemi(a.name); const sb = chromaticRootSemi(b.name); return sa !== sb ? sa - sb : a.name.localeCompare(b.name); });
  }, [searchQuery, instrumentId, overrides, additions]);

  // Pool indexé par instrument pour le finder
  const finderChordPool = useMemo(() => {
    const INSTR = ['guitar', 'ukulele', 'mandolin', 'banjo', 'piano'] as InstrumentId[];
    const pool: Record<string, (StringChord | PianoChord)[]> = {};
    for (const inst of INSTR) {
      const statics = inst === 'piano'
        ? getChordsByInstrument(inst)
        : [...getChordsByInstrument(inst), ...getAllExtendedChords(inst)];
      const instChords: (StringChord | PianoChord)[] = [];
      for (const chord of statics) {
        const key = libraryKey(chord.name, inst);
        const ov = overrides.get(key);
        instChords.push(ov ? ov.chord : chord);
      }
      // Additions admin pour cet instrument
      additions.filter(a => a.instrumentId === inst).forEach(a => instChords.push(a.chord));
      pool[inst] = instChords;
    }
    return pool as Record<InstrumentId, (StringChord | PianoChord)[]>;
  }, [overrides, additions]);

  const openEditModal = (chord: StringChord | PianoChord, isOverride: boolean, docId?: string) => {
    setEditingChordName(chord.name);
    setEditingInitialChord(chord);
    setEditingIsOverride(isOverride);
    setEditingDocId(docId ?? null);
    setForcedCategory(chord.category);
    setModalOpen(true);
  };

  const openNewModal = () => {
    setEditingChordName('');
    setEditingInitialChord(null);
    setEditingIsOverride(false);
    setEditingDocId(null);
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
      await saveLibraryChord(finalChord, instrumentId, editingIsOverride, user.email, editingDocId ?? undefined);
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOverride = async (docId: string) => {
    if (!confirm(t('deleteOverrideConfirm'))) return;
    await deleteLibraryChord(docId);
  };

  const handleDeleteAddition = async (docId: string) => {
    if (!confirm(t('deleteAdditionConfirm'))) return;
    await deleteLibraryChord(docId);
  };

  return (
    <div className="max-w-[1270px] mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-playfair text-3xl font-bold text-[var(--ink)]">
            {t('pageTitle')}
          </h1>
          <p className="text-[var(--ink-light)] mt-1 text-sm">
            {t('pageSubtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Recherche par nom */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ink-faint)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="pl-9 pr-8 py-2 rounded-lg border border-[var(--line)] bg-[var(--cell-bg)] text-[var(--ink)] text-sm placeholder:text-[var(--ink-faint)] focus:outline-none focus:border-[var(--accent)] w-48"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-faint)] hover:text-[var(--ink)]">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            )}
          </div>
          <button
            onClick={() => setFinderOpen(true)}
            className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg border text-sm font-medium transition-colors bg-[var(--cell-bg)] border-[var(--line)] text-[var(--ink-light)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h2l1 3m0 0l1.5 4h9L18 7H6m0 0H4m14 0l1 3H5m0 0l-1 3h14"/>
            </svg>
            {t('identifyButton')}
          </button>
          {isAdmin && (
            <button
              onClick={openNewModal}
              className="flex-shrink-0 px-4 py-2 rounded-lg border text-sm font-medium transition-colors bg-[var(--accent)] text-white border-[var(--accent)] hover:bg-[#a83d25]"
            >
              {t('addChordButton')}
            </button>
          )}
        </div>
      </div>

      {/* Sélecteur d'instrument */}
      <div className="flex flex-wrap gap-2 mb-4">
        {INSTRUMENT_IDS.map((id) => (
          <button
            key={id}
            onClick={() => handleInstrumentChange(id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              instrumentId === id
                ? 'bg-[var(--nav-bg)] text-white border-[var(--ink)]'
                : 'bg-[var(--cell-bg)] text-[var(--ink-light)] border-[var(--line)] hover:border-[var(--ink-faint)]'
            }`}
          >
            {instrumentLabel(id)}
          </button>
        ))}
      </div>

      {/* Onglets de catégorie — masqués pendant la recherche */}
      {!searchQuery && (
        <div className="flex flex-wrap gap-1 mb-6 bg-[var(--line)] p-1 rounded-lg w-fit">
          {CAT_ORDER.filter((cat) => nonEmptyCategories.has(cat)).map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                categoryGroup === cat
                  ? 'bg-[var(--cell-bg)] text-[var(--ink)] shadow-sm'
                  : 'text-[var(--ink-light)] hover:text-[var(--ink)]'
              }`}
            >
              {tCategory(cat)}
            </button>
          ))}
        </div>
      )}

      {/* Résultats */}
      {(() => {
        const groups = searchQuery ? allGroups : unifiedGroups;
        if (groups.length === 0) return (
          <div className="text-center py-16 text-[var(--ink-faint)]">
            {searchQuery ? t('noResultsSearch', { query: searchQuery }) : t('noResultsSelection')}
          </div>
        );
        return (
          <>
            {searchQuery && <p className="text-[var(--ink-faint)] text-sm mb-4">{t('resultsCount', { count: groups.length })}</p>}
            <div className="flex flex-wrap gap-4">
              {groups.map((group) => (
                <UnifiedChordGroup
                  key={group.name}
                  group={group}
                  instrumentId={instrumentId}
                  isAdmin={isAdmin}
                  onEditOverride={(chord) => openEditModal(chord, true)}
                  onEditAddition={(chord, docId) => openEditModal(chord, false, docId)}
                  onDeleteOverride={handleDeleteOverride}
                  onDeleteAddition={handleDeleteAddition}
                />
              ))}
            </div>
          </>
        );
      })()}

      {/* Modal finder — tous instruments, statiques + additions admin */}
      {finderOpen && (
        <ChordFinder
          initialInstrument={instrumentId}
          allChords={finderChordPool}
          onClose={() => setFinderOpen(false)}
        />
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
          <div className="bg-[var(--cell-bg)] rounded-xl p-6 text-sm text-[var(--ink)]">{t('savingInProgress')}</div>
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
  additionStartIdx: number;
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
  onEditAddition: (chord: StringChord | PianoChord, docId: string) => void;
  onDeleteOverride: (docId: string) => void;
  onDeleteAddition: (docId: string) => void;
}) {
  const t = useTranslations('Chords');
  const [idx, setIdx] = useState(0);
  const safeIdx = Math.min(idx, group.variants.length - 1);
  const current = group.variants[safeIdx];
  const hasMany = group.variants.length > 1;

  // La variante courante est une addition si son index >= additionStartIdx
  const additionRelIdx = safeIdx - group.additionStartIdx;
  const isCurrentAddition = additionRelIdx >= 0 && additionRelIdx < group.additionDocIds.length;
  const currentAdditionDocId = isCurrentAddition ? group.additionDocIds[additionRelIdx] : undefined;
  const isCurrentOverride = group.hasOverride && safeIdx === 0;

  return (
    <div className="relative group flex flex-col items-center">
      <div className={`flex items-center gap-2 mb-1 ${hasMany ? '' : 'invisible'}`}>
        <button onClick={() => setIdx(i => (i === 0 ? group.variants.length - 1 : i - 1))}
          className="w-5 h-5 flex items-center justify-center text-xs text-[var(--ink-light)] hover:text-[var(--ink)] hover:bg-[var(--line)] rounded">‹</button>
        <span className="text-[10px] text-[var(--ink-faint)]">{safeIdx + 1}/{group.variants.length}</span>
        <button onClick={() => setIdx(i => (i + 1) % group.variants.length)}
          className="w-5 h-5 flex items-center justify-center text-xs text-[var(--ink-light)] hover:text-[var(--ink)] hover:bg-[var(--line)] rounded">›</button>
      </div>
      <ChordCard chord={current} instrumentId={instrumentId} size="sm" displayName={group.name} />
      {/* Badge "modifié" uniquement visible pour l'admin */}
      {isAdmin && isCurrentOverride && (
        <span className="text-[9px] bg-[var(--accent)] text-white px-1 rounded mt-1">{t('modifiedBadge')}</span>
      )}
      {isAdmin && (
        <div
          className="absolute right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ top: hasMany ? '28px' : '4px' }}
        >
          {isCurrentAddition && currentAdditionDocId ? (
            <>
              <button onClick={() => onEditAddition(current, currentAdditionDocId)}
                className="w-6 h-6 bg-blue-500 text-white rounded text-xs flex items-center justify-center" title={t('editAdditionTitle')}>✎</button>
              <button onClick={() => onDeleteAddition(currentAdditionDocId)}
                className="w-6 h-6 bg-red-500 text-white rounded text-xs flex items-center justify-center" title={t('deleteTitle')}>✕</button>
            </>
          ) : (
            <>
              <button onClick={() => onEditOverride(current)}
                className="w-6 h-6 bg-blue-500 text-white rounded text-xs flex items-center justify-center" title={t('editTitle')}>✎</button>
              {isCurrentOverride && group.overrideDocId && (
                <button onClick={() => onDeleteOverride(group.overrideDocId!)}
                  className="w-6 h-6 bg-gray-500 text-white rounded text-xs flex items-center justify-center" title={t('restoreOriginalTitle')}>↩</button>
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
