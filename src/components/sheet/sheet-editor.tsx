'use client';

import { useState, useCallback } from 'react';
import type { Sheet, Section, NewSheet, Difficulty } from '@/types';
import { createEmptySection, GENRES } from '@/types';
import { SectionBlock } from './section-block';
import { Button } from '@/components/ui/button';
import { InstrumentSelector, ChordSummary } from '@/components/chord';

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

  // Navigation entre cellules (placeholder pour future implémentation)
  const navigateToCell = useCallback(
    (sectionId: string, rowIndex: number, cellIndex: number) => {
      // TODO: implémenter la navigation focus
      console.log('Navigate to:', sectionId, rowIndex, cellIndex);
    },
    []
  );

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
        <input
          type="text"
          value={sheet.title}
          onChange={(e) => updateSheet({ title: e.target.value })}
          placeholder="Titre de la chanson…"
          className="font-playfair text-3xl font-bold bg-transparent border-none outline-none w-full
            caret-[var(--accent)] placeholder:text-[var(--ink-faint)]"
        />
        <div className="flex flex-wrap gap-4 mt-3">
          <input
            type="text"
            value={sheet.artist}
            onChange={(e) => updateSheet({ artist: e.target.value })}
            placeholder="Artiste…"
            className="font-sans text-sm text-[var(--ink-light)] bg-transparent border-none outline-none
              placeholder:text-[var(--ink-faint)]"
          />
          <input
            type="text"
            value={sheet.key}
            onChange={(e) => updateSheet({ key: e.target.value })}
            placeholder="Tonalité…"
            className="font-sans text-sm text-[var(--ink-light)] bg-transparent border-none outline-none
              placeholder:text-[var(--ink-faint)] w-24"
          />
          <input
            type="text"
            value={sheet.tempo}
            onChange={(e) => updateSheet({ tempo: e.target.value })}
            placeholder="Tempo…"
            className="font-sans text-sm text-[var(--ink-light)] bg-transparent border-none outline-none
              placeholder:text-[var(--ink-faint)] w-24"
          />
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

        {/* Capo & Difficulté */}
        <div className="flex flex-wrap items-center gap-6">
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
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => updateSheet({ difficulty: (sheet.difficulty === level ? null : level) as Difficulty | null })}
                  className={`text-lg transition-colors ${
                    sheet.difficulty && sheet.difficulty >= level
                      ? 'text-amber-400'
                      : 'text-gray-300 hover:text-amber-200'
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
            {sheet.difficulty && (
              <span className="text-xs text-[var(--ink-faint)]">({sheet.difficulty}/5)</span>
            )}
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
        <label className="flex items-center gap-2 cursor-pointer pt-2 border-t border-[var(--line)]">
          <input
            type="checkbox"
            checked={sheet.isPublic}
            onChange={(e) => updateSheet({ isPublic: e.target.checked })}
            className="w-4 h-4 rounded border-[var(--line)] text-[var(--accent)]
              focus:ring-[var(--accent)] cursor-pointer"
          />
          <span className="text-sm text-[var(--ink-light)]">
            Grille publique (visible par tous)
          </span>
        </label>
      </div>

      {/* Sections */}
      <div>
        {sheet.sections.map((section) => (
          <SectionBlock
            key={section.id}
            section={section}
            instrumentId={sheet.instrumentId || 'guitar'}
            onUpdate={(updates) => updateSection(section.id, updates)}
            onDelete={() => deleteSection(section.id)}
            onNavigateToCell={navigateToCell}
          />
        ))}
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
        />
      </div>

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
