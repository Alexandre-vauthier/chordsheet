'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ChordEditor, ChordCard } from '@/components/chord';
import type { StringChord, PianoChord, InstrumentId } from '@/types';
import { getChordsByInstrument } from '@/lib/chord-data';

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

  const instrumentParam = (searchParams.get('instrument') || 'guitar') as InstrumentId;
  const categoryParam = (searchParams.get('category') || 'major') as CategoryGroup;

  const [instrumentId, setInstrumentId] = useState<InstrumentId>(instrumentParam);
  const [categoryGroup, setCategoryGroup] = useState<CategoryGroup>(categoryParam);
  const [showEditor, setShowEditor] = useState(false);

  // Sync URL params → state
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

  // Charger et filtrer les accords
  const chords = useMemo(() => {
    const all = getChordsByInstrument(instrumentId);
    return all.filter((c) => getCategoryGroup(c.category) === categoryGroup);
  }, [instrumentId, categoryGroup]);

  const handleSaveChord = (_chord: StringChord | PianoChord, _instId: InstrumentId) => {
    setShowEditor(false);
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
        <button
          onClick={() => setShowEditor((v) => !v)}
          className={`flex-shrink-0 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
            showEditor
              ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
              : 'bg-white text-[var(--ink-light)] border-[var(--line)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
          }`}
        >
          {showEditor ? 'Fermer l\'éditeur' : '+ Créer un accord'}
        </button>
      </div>

      {/* Éditeur d'accord */}
      {showEditor && (
        <div className="mb-8 p-4 bg-white rounded-xl border border-[var(--line)]">
          <h2 className="text-base font-medium text-[var(--ink)] mb-4">Créer un accord personnalisé</h2>
          <ChordEditor onSave={handleSaveChord} />
        </div>
      )}

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

      {/* Grille d'accords */}
      {chords.length === 0 ? (
        <div className="text-center py-16 text-[var(--ink-faint)]">
          Aucun accord trouvé pour cette sélection.
        </div>
      ) : (
        <div className="flex flex-wrap gap-4">
          {chords.map((chord) => (
            <ChordCard
              key={chord.id}
              chord={chord}
              instrumentId={instrumentId}
              size="sm"
            />
          ))}
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
