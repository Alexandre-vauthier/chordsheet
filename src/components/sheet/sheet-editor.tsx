'use client';

import { useState, useCallback } from 'react';
import type { Sheet, Section, NewSheet } from '@/types';
import { createEmptySection } from '@/types';
import { SectionBlock } from './section-block';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface SheetEditorProps {
  initialSheet: NewSheet | Sheet;
  onSave: (sheet: NewSheet | Sheet) => Promise<void>;
  isSaving?: boolean;
}

const SECTION_LABELS = ['Intro', 'Couplet', 'Refrain', 'Bridge', 'Pré-refrain', 'Outro', 'Solo'];

export function SheetEditor({ initialSheet, onSave, isSaving = false }: SheetEditorProps) {
  const [sheet, setSheet] = useState<NewSheet | Sheet>(initialSheet);
  const [hasChanges, setHasChanges] = useState(false);

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

      {/* Options */}
      <div className="flex items-center gap-4 mb-6 p-3 bg-white rounded-lg border border-[var(--line)]">
        <label className="flex items-center gap-2 cursor-pointer">
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

      {/* Barre de sauvegarde fixe */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[var(--line)] py-4 px-6 z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="text-sm text-[var(--ink-light)]">
            {hasChanges ? (
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
