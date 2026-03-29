'use client';

import { useState, useEffect } from 'react';
import { ChordEditor, ChordCard } from '@/components/chord';
import type { StringChord, PianoChord, InstrumentId } from '@/types';

interface SavedChord {
  chord: StringChord | PianoChord;
  instrumentId: InstrumentId;
}

const STORAGE_KEY = 'chordsheet-custom-chords';

export default function ChordsPage() {
  const [savedChords, setSavedChords] = useState<SavedChord[]>([]);
  const [showEditor, setShowEditor] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  // Charger les accords depuis localStorage au montage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSavedChords(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Error loading chords from localStorage:', e);
    }
    setIsLoaded(true);
  }, []);

  // Sauvegarder dans localStorage quand les accords changent
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(savedChords));
      } catch (e) {
        console.error('Error saving chords to localStorage:', e);
      }
    }
  }, [savedChords, isLoaded]);

  const handleSaveChord = (chord: StringChord | PianoChord, instrumentId: InstrumentId) => {
    setSavedChords(prev => [...prev, { chord, instrumentId }]);
  };

  const handleDeleteChord = (index: number) => {
    setSavedChords(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="font-playfair text-3xl font-bold text-[var(--ink)]">
          Bibliothèque d&apos;accords
        </h1>
        <p className="text-[var(--ink-light)] mt-2">
          Créez et visualisez vos accords personnalisés pour tous les instruments.
        </p>
      </div>

      {/* Toggle éditeur */}
      <div className="mb-6">
        <button
          onClick={() => setShowEditor(!showEditor)}
          className={`px-4 py-2 rounded-lg border transition-colors ${
            showEditor
              ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
              : 'bg-white text-[var(--ink-light)] border-[var(--line)] hover:border-[var(--accent)]'
          }`}
        >
          {showEditor ? 'Masquer l\'éditeur' : 'Créer un accord'}
        </button>
      </div>

      {/* Éditeur d'accords */}
      {showEditor && (
        <div className="mb-8">
          <h2 className="text-lg font-medium text-[var(--ink)] mb-4">Créer un accord</h2>
          <ChordEditor onSave={handleSaveChord} />
        </div>
      )}

      {/* Accords sauvegardés */}
      {savedChords.length > 0 && (
        <div>
          <h2 className="text-lg font-medium text-[var(--ink)] mb-4">
            Accords créés ({savedChords.length})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {savedChords.map((saved, index) => (
              <div key={index} className="relative group">
                <ChordCard
                  chord={saved.chord}
                  instrumentId={saved.instrumentId}
                />
                <button
                  onClick={() => handleDeleteChord(index)}
                  className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full
                    opacity-0 group-hover:opacity-100 transition-opacity text-xs flex items-center justify-center"
                  title="Supprimer"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Message si aucun accord */}
      {savedChords.length === 0 && !showEditor && (
        <div className="text-center py-12 text-[var(--ink-faint)]">
          <p>Aucun accord créé pour le moment.</p>
          <p className="mt-2">Cliquez sur « Créer un accord » pour commencer.</p>
        </div>
      )}

      {/* Info */}
      <div className="mt-12 p-4 bg-gray-50 rounded-lg border border-[var(--line)]">
        <h3 className="font-medium text-[var(--ink)] mb-2">Comment utiliser l&apos;éditeur</h3>
        <ul className="text-sm text-[var(--ink-light)] space-y-1">
          <li>1. Sélectionnez l&apos;instrument (guitare, ukulélé, piano, etc.)</li>
          <li>2. Cliquez sur les cases du manche ou les touches du piano pour placer les notes</li>
          <li>3. Cliquez au-dessus des cordes pour marquer « ouverte » (O) ou « mutée » (X)</li>
          <li>4. Activez le barré si nécessaire et ajustez sa position</li>
          <li>5. Donnez un nom à votre accord</li>
          <li>6. Cliquez « Jouer » pour prévisualiser le son</li>
          <li>7. Cliquez « Sauvegarder » pour ajouter l&apos;accord à votre bibliothèque</li>
        </ul>
      </div>
    </div>
  );
}
