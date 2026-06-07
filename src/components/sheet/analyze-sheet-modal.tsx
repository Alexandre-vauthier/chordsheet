'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import { toFirestore } from '@/lib/firestore-helpers';
import { useAuth } from '@/lib/auth-context';
import type { Section, Cell, CellSpan, NewSheet } from '@/types';

interface SheetResult {
  title: string;
  artist: string;
  key: string;
  timeSignature: string;
  tempo: string;
  sections: { label: string; chords: string[] }[];
}

function resultToSections(data: SheetResult): { sections: Section[]; beatsPerMeasure: 3 | 4 } {
  const beatsPerMeasure: 3 | 4 = data.timeSignature?.startsWith('3') ? 3 : 4;

  const sections: Section[] = data.sections.map((s, i) => {
    const cells: Cell[] = s.chords.map(chord => ({ chord, span: 1 as CellSpan }));
    const rows: Cell[][] = [];
    for (let j = 0; j < cells.length; j += 4) rows.push(cells.slice(j, j + 4));
    return {
      id: crypto.randomUUID(),
      label: s.label || `Section ${i + 1}`,
      repeat: 1,
      beatsPerMeasure,
      rows,
    };
  });

  return { sections: sections.length > 0 ? sections : [{ id: crypto.randomUUID(), label: 'Section 1', repeat: 1, beatsPerMeasure, rows: [] }], beatsPerMeasure };
}

interface Props {
  onClose: () => void;
}

export function AnalyzeSheetModal({ onClose }: Props) {
  const { user } = useAuth();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<SheetResult | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const handleFile = (f: File) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setStatus('idle');
    setResult(null);
    setError('');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setStatus('loading');
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/analyze-sheet', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur inconnue');
      setResult(data as SheetResult);
      setStatus('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
      setStatus('error');
    }
  };

  const handleCreate = async () => {
    if (!user || !result) return;
    setIsCreating(true);
    try {
      const { sections } = resultToSections(result);
      const sheet: NewSheet = {
        title: result.title || 'Sans titre',
        artist: result.artist || '',
        key: result.key || '',
        tempo: result.tempo ? `${result.tempo} BPM` : '',
        ownerId: user.id,
        ownerName: user.displayName,
        isPublic: false,
        sections,
        tags: [],
        genres: [],
        difficulty: null,
        capo: null,
      };
      const db = getDb();
      const ref = await addDoc(collection(db, 'sheets'), {
        ...toFirestore(sheet),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        viewCount: 0,
      });
      router.push(`/sheet/${ref.id}/edit`);
    } catch {
      setError('Erreur lors de la création de la grille.');
      setIsCreating(false);
    }
  };

  const totalChords = result?.sections.reduce((acc, s) => acc + s.chords.length, 0) ?? 0;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-[var(--paper)] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* En-tête */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[var(--line)]">
          <div>
            <h2 className="font-playfair text-lg font-bold text-[var(--ink)]">Retranscrire une partition</h2>
            <p className="text-xs text-[var(--ink-faint)] mt-0.5">Dépose une image de partition — les accords sont extraits automatiquement</p>
          </div>
          <button onClick={onClose} className="text-[var(--ink-faint)] hover:text-[var(--ink)] text-xl leading-none cursor-pointer">×</button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

          {/* Zone de dépôt */}
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-[var(--line)] hover:border-[var(--accent)] rounded-xl
              cursor-pointer transition-colors overflow-hidden"
          >
            {preview ? (
              <img src={preview} alt="Aperçu partition" className="w-full max-h-48 object-contain bg-[var(--cell-bg)]" />
            ) : (
              <div className="py-10 text-center space-y-2">
                <div className="text-3xl">🎼</div>
                <p className="text-sm text-[var(--ink-light)]">Clique ou dépose une image de partition</p>
                <p className="text-xs text-[var(--ink-faint)]">JPG, PNG, WebP</p>
              </div>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </div>

          {file && status !== 'loading' && status !== 'done' && (
            <p className="text-xs text-[var(--ink-faint)]">{file.name}</p>
          )}

          {/* Chargement */}
          {status === 'loading' && (
            <div className="text-center py-6 space-y-3">
              <div className="animate-spin rounded-full h-7 w-7 border-2 border-[var(--accent)] border-t-transparent mx-auto" />
              <p className="text-sm text-[var(--ink-light)]">Analyse de la partition…</p>
            </div>
          )}

          {/* Erreur */}
          {(status === 'error') && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{error}</p>
          )}

          {/* Résultat */}
          {status === 'done' && result && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {result.title && (
                  <div className="bg-[var(--cell-bg)] border border-[var(--line)] rounded-lg px-3 py-2">
                    <div className="text-xs text-[var(--ink-faint)] mb-0.5">Titre</div>
                    <div className="font-medium text-[var(--ink)] truncate">{result.title}</div>
                  </div>
                )}
                {result.artist && (
                  <div className="bg-[var(--cell-bg)] border border-[var(--line)] rounded-lg px-3 py-2">
                    <div className="text-xs text-[var(--ink-faint)] mb-0.5">Artiste</div>
                    <div className="font-medium text-[var(--ink)] truncate">{result.artist}</div>
                  </div>
                )}
                {result.key && (
                  <div className="bg-[var(--cell-bg)] border border-[var(--line)] rounded-lg px-3 py-2">
                    <div className="text-xs text-[var(--ink-faint)] mb-0.5">Tonalité</div>
                    <div className="font-mono font-bold text-[var(--ink)]">{result.key}</div>
                  </div>
                )}
                {result.tempo && (
                  <div className="bg-[var(--cell-bg)] border border-[var(--line)] rounded-lg px-3 py-2">
                    <div className="text-xs text-[var(--ink-faint)] mb-0.5">Tempo</div>
                    <div className="font-mono font-bold text-[var(--ink)]">{result.tempo} BPM</div>
                  </div>
                )}
              </div>

              <p className="text-xs text-[var(--ink-faint)]">
                {result.sections.length} section{result.sections.length > 1 ? 's' : ''} · {totalChords} mesures détectées
              </p>

              <div className="space-y-2 max-h-40 overflow-y-auto">
                {result.sections.map((s, i) => (
                  <div key={i} className="text-xs">
                    <span className="font-medium text-[var(--ink-light)]">{s.label} </span>
                    <span className="text-[var(--ink-faint)]">— </span>
                    <span className="font-mono text-[var(--ink)]">{s.chords.join(' · ')}</span>
                  </div>
                ))}
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{error}</p>
              )}
            </div>
          )}
        </div>

        {/* Pied */}
        <div className="px-6 py-4 border-t border-[var(--line)] flex justify-between items-center">
          <button
            onClick={handleAnalyze}
            disabled={!file || status === 'loading'}
            className="px-4 py-2 text-sm border border-[var(--line)] rounded-lg text-[var(--ink-light)]
              hover:border-[var(--ink-faint)] hover:text-[var(--ink)] bg-[var(--cell-bg)]
              transition-colors disabled:opacity-40 cursor-pointer"
          >
            {status === 'loading' ? 'Analyse…' : status === 'done' ? 'Ré-analyser' : 'Analyser'}
          </button>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-[var(--ink-light)] hover:text-[var(--ink)] transition-colors cursor-pointer">
              Annuler
            </button>
            {status === 'done' && (
              <button
                onClick={handleCreate}
                disabled={isCreating}
                className="px-5 py-2 text-sm bg-[var(--accent)] hover:bg-[#a83d25] text-white rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isCreating ? 'Création…' : 'Créer la grille'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
