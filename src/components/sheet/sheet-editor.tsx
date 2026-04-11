'use client';

import { useState, useCallback } from 'react';
import type { Sheet, Section, NewSheet, Difficulty, StringChord, PianoChord, CustomChord } from '@/types';
import { createEmptySection, GENRES } from '@/types';
import { SectionBlock } from './section-block';
import { Button } from '@/components/ui/button';
import { InstrumentSelector, ChordSummary, ChordEditorModal } from '@/components/chord';
import type { CustomChordMap } from '@/components/chord';
import { usePlayback, parseTempo } from '@/lib/use-playback';

interface SheetEditorProps {
  initialSheet: NewSheet | Sheet;
  onSave: (sheet: NewSheet | Sheet) => Promise<void>;
  isSaving?: boolean;
}

const SECTION_LABELS = ['Intro', 'Couplet', 'Refrain', 'Bridge', 'Pré-refrain', 'Outro', 'Solo'];

export function SheetEditor({ initialSheet, onSave, isSaving = false }: SheetEditorProps) {
  const [sheet, setSheet] = useState<NewSheet | Sheet>(initialSheet);
  const [hasChanges, setHasChanges] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [metronomeEnabled, setMetronomeEnabled] = useState(false);

  // Playback
  const { isPlaying, activeStep, playSection, togglePlay, stop } = usePlayback({
    sections: sheet.sections,
    tempo: sheet.tempo,
    instrumentId: sheet.instrumentId || 'guitar',
    customChords: sheet.customChords as Record<string, unknown>,
    metronomeEnabled,
  });

  const bpm = parseTempo(sheet.tempo);

  // État pour la modal d'édition d'accord
  const [chordModalOpen, setChordModalOpen] = useState(false);
  const [editingChordName, setEditingChordName] = useState('');
  const [editingChord, setEditingChord] = useState<StringChord | PianoChord | null>(null);

  // Vérifier si la grille a au moins un accord
  const hasAtLeastOneChord = () => {
    return sheet.sections.some(section =>
      section.rows.some(row =>
        row.some(cell => cell.chord.trim() !== '')
      )
    );
  };

  // Valider la grille avant sauvegarde
  const validateSheet = (): string | null => {
    if (!sheet.title.trim()) {
      return 'Le titre est obligatoire';
    }
    if (!sheet.artist.trim()) {
      return 'L\'artiste est obligatoire';
    }
    if (!hasAtLeastOneChord()) {
      return 'La grille doit contenir au moins un accord';
    }
    return null;
  };

  const updateSheet = useCallback((updates: Partial<NewSheet | Sheet>) => {
    setSheet((prev) => ({ ...prev, ...updates }));
    setHasChanges(true);
  }, []);

  // Mettre à jour une section
  const updateSection = useCallback((sectionId: string, updates: Partial<Section>) => {
    setSheet((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId ? { ...s, ...updates } : s
      ),
    }));
    setHasChanges(true);
  }, []);

  // Supprimer une section
  const deleteSection = useCallback((sectionId: string) => {
    if (!confirm('Supprimer cette section ?')) return;
    setSheet((prev) => ({
      ...prev,
      sections: prev.sections.filter((s) => s.id !== sectionId),
    }));
    setHasChanges(true);
  }, []);

  // Ajouter une section
  const addSection = useCallback(() => {
    const usedLabels = sheet.sections.map((s) => s.label);
    const nextLabel = SECTION_LABELS.find((l) => !usedLabels.includes(l)) || 'Section';
    const newSection = createEmptySection(nextLabel);

    setSheet((prev) => ({
      ...prev,
      sections: [...prev.sections, newSection],
    }));
    setHasChanges(true);
  }, [sheet.sections]);

  // Dupliquer une section
  const duplicateSection = useCallback((sectionId: string) => {
    setSheet((prev) => {
      const idx = prev.sections.findIndex((s) => s.id === sectionId);
      if (idx === -1) return prev;
      const source = prev.sections[idx];
      const clone: Section = {
        ...source,
        id: crypto.randomUUID(),
        label: `${source.label} (copie)`,
        rows: source.rows.map((row) => row.map((cell) => ({ ...cell }))),
      };
      const newSections = [...prev.sections];
      newSections.splice(idx + 1, 0, clone);
      return { ...prev, sections: newSections };
    });
    setHasChanges(true);
  }, []);

  // Drag & drop sections
  const [dragSectionId, setDragSectionId] = useState<string | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(null);

  const handleDragStart = useCallback((sectionId: string) => {
    setDragSectionId(sectionId);
  }, []);

  const handleDragOver = useCallback((sectionId: string) => {
    setDragOverSectionId(sectionId);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragSectionId(null);
    setDragOverSectionId(null);
  }, []);

  const handleDrop = useCallback((targetSectionId: string) => {
    if (!dragSectionId || dragSectionId === targetSectionId) {
      setDragSectionId(null);
      setDragOverSectionId(null);
      return;
    }
    setSheet((prev) => {
      const sections = [...prev.sections];
      const fromIdx = sections.findIndex((s) => s.id === dragSectionId);
      if (fromIdx === -1) return prev;
      const [moved] = sections.splice(fromIdx, 1);
      if (targetSectionId === '__end__') {
        sections.push(moved);
      } else {
        const toIdx = sections.findIndex((s) => s.id === targetSectionId);
        if (toIdx === -1) return prev;
        sections.splice(toIdx, 0, moved);
      }
      return { ...prev, sections };
    });
    setHasChanges(true);
    setDragSectionId(null);
    setDragOverSectionId(null);
  }, [dragSectionId]);

  // Navigation entre cellules (placeholder pour future implémentation)
  const navigateToCell = useCallback(
    (sectionId: string, rowIndex: number, cellIndex: number) => {
      // TODO: implémenter la navigation focus
      console.log('Navigate to:', sectionId, rowIndex, cellIndex);
    },
    []
  );

  // Ouvrir la modal pour éditer un accord
  const handleEditChord = useCallback((chordName: string, currentChord: StringChord | PianoChord | null) => {
    setEditingChordName(chordName);
    setEditingChord(currentChord);
    setChordModalOpen(true);
  }, []);

  // Sauvegarder un accord personnalisé
  const handleSaveCustomChord = useCallback((chord: StringChord | PianoChord) => {
    const instrumentId = sheet.instrumentId || 'guitar';
    const key = `${editingChordName.toLowerCase()}-${instrumentId}`;

    // Créer l'accord personnalisé avec l'instrumentId
    const customChord: CustomChord = {
      ...chord,
      instrumentId,
    } as CustomChord;

    setSheet(prev => ({
      ...prev,
      customChords: {
        ...(prev.customChords || {}),
        [key]: customChord,
      },
    }));
    setHasChanges(true);
  }, [editingChordName, sheet.instrumentId]);

  // Supprimer un accord personnalisé
  const handleDeleteCustomChord = useCallback((chordName: string) => {
    const instrumentId = sheet.instrumentId || 'guitar';
    const key = `${chordName.toLowerCase()}-${instrumentId}`;

    setSheet(prev => {
      const newCustomChords = { ...(prev.customChords || {}) };
      delete newCustomChords[key];
      return {
        ...prev,
        customChords: Object.keys(newCustomChords).length > 0 ? newCustomChords : undefined,
      };
    });
    setHasChanges(true);
  }, [sheet.instrumentId]);

  // Sauvegarder
  const handleSave = async () => {
    const error = validateSheet();
    if (error) {
      setValidationError(error);
      return;
    }
    setValidationError(null);
    await onSave(sheet);
    setHasChanges(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 pb-24">
      {/* Header de la chanson */}
      <div className="mb-8 border-b-2 border-[var(--ink)] pb-4">
        <div className="flex items-start justify-between gap-4">
          <input
            type="text"
            value={sheet.title}
            onChange={(e) => {
              const val = e.target.value.replace(/\b\w/g, (c) => c.toUpperCase());
              updateSheet({ title: val });
            }}
            placeholder="Titre de la chanson…"
            className="font-playfair text-3xl font-bold bg-transparent border-none outline-none flex-1
              caret-[var(--accent)] placeholder:text-[var(--ink-faint)]"
          />
          <div className="flex-shrink-0 flex items-center gap-2">
            {/* Toggle métronome */}
            <button
              onClick={() => setMetronomeEnabled(v => !v)}
              title={metronomeEnabled ? 'Désactiver le métronome' : 'Activer le métronome'}
              className={`
                flex items-center justify-center w-9 h-9 rounded-lg border-[1.5px] transition-all duration-150
                ${metronomeEnabled
                  ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                  : 'bg-white border-[var(--line)] text-[var(--ink-light)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
                }
              `}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
                <path d="M12 3 8 21" strokeLinecap="round"/>
                <path d="M12 3l4 18" strokeLinecap="round"/>
                <path d="M8.5 14.5l7-4" strokeLinecap="round"/>
                <ellipse cx="12" cy="21" rx="3" ry="1.5"/>
                <line x1="9.5" y1="3" x2="14.5" y2="3" strokeLinecap="round"/>
              </svg>
            </button>

            {/* Play / Stop */}
            <button
              onClick={togglePlay}
              title={isPlaying ? 'Stop' : `Play — ${bpm} BPM`}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
                transition-all duration-150 border-[1.5px]
                ${isPlaying
                  ? 'bg-[var(--accent)] border-[var(--accent)] text-white hover:bg-[#a83d25]'
                  : 'bg-white border-[var(--line)] text-[var(--ink)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
                }
              `}
            >
              {isPlaying ? (
                <>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <rect x="4" y="3" width="4" height="14" rx="1" />
                    <rect x="12" y="3" width="4" height="14" rx="1" />
                  </svg>
                  Stop
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                  </svg>
                  Play
                </>
              )}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 mt-3">
          <input
            type="text"
            value={sheet.artist}
            onChange={(e) => {
              const val = e.target.value.replace(/\b\w/g, (c) => c.toUpperCase());
              updateSheet({ artist: val });
            }}
            placeholder="Artiste…"
            className="font-sans text-sm text-[var(--ink-light)] bg-transparent border-none outline-none
              placeholder:text-[var(--ink-faint)]"
          />
          <span className="flex items-center gap-1 text-[var(--ink-faint)]">
            <span className="text-sm">♯♭</span>
            <input
              type="text"
              value={sheet.key}
              onChange={(e) => updateSheet({ key: e.target.value })}
              placeholder="Tonalité…"
              className="font-sans text-sm text-[var(--ink-light)] bg-transparent border-none outline-none
                placeholder:text-[var(--ink-faint)] w-24"
            />
          </span>
          <span className="flex items-center gap-1 text-[var(--ink-faint)]">
            <span className="text-base leading-none">♩</span>
            <input
              type="text"
              value={sheet.tempo}
              onChange={(e) => updateSheet({ tempo: e.target.value })}
              placeholder="Tempo…"
              className="font-sans text-sm text-[var(--ink-light)] bg-transparent border-none outline-none
                placeholder:text-[var(--ink-faint)] w-24"
            />
          </span>
          <span className="flex items-center gap-1 text-[var(--ink-faint)]">
            <span className="text-sm">🔗</span>
            <input
              type="url"
              value={sheet.referenceUrl || ''}
              onChange={(e) => updateSheet({ referenceUrl: e.target.value })}
              placeholder="Lien de référence (YouTube, Spotify…)"
              className="font-sans text-sm text-[var(--ink-light)] bg-transparent border-none outline-none
                placeholder:text-[var(--ink-faint)] w-64"
            />
          </span>
        </div>
      </div>

      {/* Métadonnées */}
      <div className="mb-6 p-4 bg-white rounded-lg border border-[var(--line)] space-y-4">
        {/* Instrument pour les diagrammes */}
        <div>
          <span className="text-sm text-[var(--ink-light)] block mb-2">Instrument :</span>
          <InstrumentSelector
            value={sheet.instrumentId || 'guitar'}
            onChange={(instrumentId) => updateSheet({ instrumentId })}
          />
        </div>

        {/* Métrique, Capo & Difficulté */}
        <div className="flex flex-wrap items-center gap-6">
          {/* Binaire / Ternaire */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--ink-light)]">Métrique :</span>
            <div className="flex rounded overflow-hidden border border-[var(--line)]">
              <button
                onClick={() => updateSheet({
                  beatsPerMeasure: 4,
                  sections: sheet.sections.map(s => ({ ...s, beatsPerMeasure: 4 as const })),
                })}
                className={`px-3 py-1 text-xs transition-colors ${
                  (sheet.beatsPerMeasure ?? 4) === 4
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-white text-[var(--ink-light)] hover:bg-gray-50'
                }`}
              >
                Binaire
              </button>
              <button
                onClick={() => updateSheet({
                  beatsPerMeasure: 3,
                  sections: sheet.sections.map(s => ({ ...s, beatsPerMeasure: 3 as const })),
                })}
                className={`px-3 py-1 text-xs border-l border-[var(--line)] transition-colors ${
                  sheet.beatsPerMeasure === 3
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-white text-[var(--ink-light)] hover:bg-gray-50'
                }`}
              >
                Ternaire
              </button>
            </div>
          </div>
          {/* Capo */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--ink-light)]">Capo :</span>
            <select
              value={sheet.capo ?? ''}
              onChange={(e) => updateSheet({ capo: e.target.value ? Number(e.target.value) : null })}
              className="px-2 py-1 rounded border border-[var(--line)] text-sm bg-white
                focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              <option value="">Aucun</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                <option key={n} value={n}>Capo {n}</option>
              ))}
            </select>
          </div>

          {/* Difficulté */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--ink-light)]">Difficulté :</span>
            <select
              value={sheet.difficulty ?? ''}
              onChange={(e) => updateSheet({ difficulty: (e.target.value ? Number(e.target.value) : null) as Difficulty | null })}
              className="text-sm border border-[var(--line)] rounded-lg px-2 py-1 bg-white text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              <option value="">—</option>
              <option value="1">Facile</option>
              <option value="2">Intermédiaire</option>
              <option value="3">Avancé</option>
            </select>
          </div>
        </div>

        {/* Genres */}
        <div>
          <span className="text-sm text-[var(--ink-light)] block mb-2">Genres :</span>
          <div className="flex flex-wrap gap-2">
            {GENRES.map((genre) => {
              const isSelected = sheet.genres?.includes(genre);
              return (
                <button
                  key={genre}
                  type="button"
                  onClick={() => {
                    const newGenres = isSelected
                      ? (sheet.genres || []).filter((g) => g !== genre)
                      : [...(sheet.genres || []), genre];
                    updateSheet({ genres: newGenres });
                  }}
                  className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                    isSelected
                      ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                      : 'bg-white text-[var(--ink-light)] border-[var(--line)] hover:border-[var(--accent)]'
                  }`}
                >
                  {genre}
                </button>
              );
            })}
          </div>
        </div>

        {/* Visibilité */}
        <div className="flex items-center justify-between pt-2 border-t border-[var(--line)]">
          <span className="text-sm text-[var(--ink-light)]">Grille publique (visible par tous)</span>
          <button
            onClick={() => updateSheet({ isPublic: !sheet.isPublic })}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              sheet.isPublic ? 'bg-[var(--accent)]' : 'bg-[var(--line)]'
            }`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${sheet.isPublic ? 'translate-x-5' : ''}`} />
          </button>
        </div>
      </div>

      {/* Titre de la grille */}
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--ink-faint)]">Grille harmonique</h2>
        <div className="flex-1 h-px bg-[var(--line)]" />
      </div>

      {/* Sections */}
      <div>
        {sheet.sections.map((section) => {
          const isDragging = dragSectionId === section.id;
          return (
            <div
              key={section.id}
              className={isDragging ? 'h-10 overflow-hidden opacity-30 mb-10 border-2 border-dashed border-[var(--line)] rounded-lg' : ''}
            >
              <SectionBlock
                section={section}
                instrumentId={sheet.instrumentId || 'guitar'}
                onUpdate={(updates) => updateSection(section.id, updates)}
                onDelete={() => deleteSection(section.id)}
                onDuplicate={() => duplicateSection(section.id)}
                onPlaySection={() => {
                  if (isPlaying && activeStep?.sectionId === section.id) stop();
                  else playSection(section.id);
                }}
                isSectionPlaying={isPlaying && activeStep?.sectionId === section.id}
                activeRowIndex={isPlaying && activeStep?.sectionId === section.id ? activeStep.rowIndex : undefined}
                activeCellIndex={isPlaying && activeStep?.sectionId === section.id ? activeStep.cellIndex : undefined}
                activeDurationMs={isPlaying && activeStep?.sectionId === section.id ? activeStep.durationMs : undefined}
                onNavigateToCell={navigateToCell}
                onDragStart={() => handleDragStart(section.id)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => { e.preventDefault(); handleDragOver(section.id); }}
                onDrop={() => handleDrop(section.id)}
                isDragOver={dragOverSectionId === section.id && dragSectionId !== section.id}
              />
            </div>
          );
        })}

        {/* Zone de drop en fin de liste */}
        {dragSectionId && (
          <div
            className={`h-10 rounded-lg border-2 border-dashed transition-colors ${
              dragOverSectionId === '__end__'
                ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                : 'border-[var(--line)]'
            }`}
            onDragOver={(e) => { e.preventDefault(); handleDragOver('__end__'); }}
            onDrop={() => handleDrop('__end__')}
          />
        )}
      </div>

      {/* Bouton ajouter section */}
      <button
        onClick={addSection}
        className="w-full mt-2 py-4 border-2 border-dashed border-[var(--line)] rounded-xl
          text-[var(--ink-faint)] text-sm cursor-pointer transition-all bg-transparent
          hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--accent-soft)]
          flex items-center justify-center gap-2"
      >
        + Ajouter une section
      </button>

      {/* Rappel des accords utilisés */}
      <div className="mt-8">
        <ChordSummary
          sections={sheet.sections}
          instrumentId={sheet.instrumentId || 'guitar'}
          customChords={sheet.customChords as CustomChordMap}
          editable
          onEditChord={handleEditChord}
          onDeleteCustomChord={handleDeleteCustomChord}
        />
      </div>

      {/* Modal d'édition d'accord */}
      <ChordEditorModal
        isOpen={chordModalOpen}
        onClose={() => setChordModalOpen(false)}
        onSave={handleSaveCustomChord}
        chordName={editingChordName}
        instrumentId={sheet.instrumentId || 'guitar'}
        initialChord={editingChord}
      />

      {/* Barre de sauvegarde fixe */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[var(--line)] py-4 px-6 z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="text-sm text-[var(--ink-light)]">
            {validationError ? (
              <span className="text-red-600">⚠ {validationError}</span>
            ) : hasChanges ? (
              <span className="text-[var(--accent)]">● Modifications non sauvegardées</span>
            ) : (
              <span>Toutes les modifications sont sauvegardées</span>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => window.history.back()}>
              Annuler
            </Button>
            <Button onClick={handleSave} isLoading={isSaving} disabled={!hasChanges && 'id' in sheet}>
              {('id' in sheet) ? 'Sauvegarder' : 'Créer la grille'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
