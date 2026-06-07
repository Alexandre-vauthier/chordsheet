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
  sections: { label: string; repeat: number; chords: string[] }[];
}

function resultToSections(data: SheetResult): Section[] {
  const beatsPerMeasure: 3 | 4 = data.timeSignature?.startsWith('3') ? 3 : 4;

  return data.sections.map((s, i) => {
    const cells: Cell[] = s.chords.map(chord => ({ chord: chord ?? '', span: 1 as CellSpan }));
    const rows: Cell[][] = [];
    for (let j = 0; j < cells.length; j += 4) rows.push(cells.slice(j, j + 4));
    if (rows.length === 0) rows.push([]);
    return {
      id: crypto.randomUUID(),
      label: s.label || `Section ${i + 1}`,
      repeat: Math.max(1, s.repeat || 1),
      beatsPerMeasure,
      rows,
    };
  });
}

interface PageFile {
  file: File;
  preview: string;
}

interface Props {
  onClose: () => void;
}

export function AnalyzeSheetModal({ onClose }: Props) {
  const { user } = useAuth();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [pages, setPages] = useState<PageFile[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<SheetResult | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const addFiles = (files: FileList | File[]) => {
    const newPages: PageFile[] = Array.from(files).map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setPages(prev => [...prev, ...newPages]);
    setStatus('idle');
    setResult(null);
    setError('');
  };

  const removePage = (index: number) => {
    setPages(prev => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  const handleAnalyze = async () => {
    if (!pages.length) return;
    setStatus('loading');
    setError('');
    try {
      const fileData = await Promise.all(pages.map(p => new Promise<{ data: string; type: string }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve({ data: result.split(',')[1], type: p.file.type });
        };
        reader.onerror = reject;
        reader.readAsDataURL(p.file);
      })));
      const res = await fetch('/api/analyze-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: fileData }),
      });
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
      const sections = resultToSections(result);
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
            <p className="text-xs text-[var(--ink-faint)] mt-0.5">Dépose une ou plusieurs pages — la structure complète est analysée</p>
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
              cursor-pointer transition-colors py-6 text-center space-y-1"
          >
            <div className="text-2xl">🎼</div>
            <p className="text-sm text-[var(--ink-light)]">
              {pages.length > 0 ? 'Ajouter d\'autres pages' : 'Clique ou dépose les pages de ta partition'}
            </p>
            <p className="text-xs text-[var(--ink-faint)]">JPG, PNG, WebP — plusieurs fichiers acceptés</p>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={e => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ''; }}
            />
          </div>

          {/* Aperçu des pages */}
          {pages.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-[var(--ink-light)]">{pages.length} page{pages.length > 1 ? 's' : ''}</p>
              <div className="flex gap-2 flex-wrap">
                {pages.map((p, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={p.preview}
                      alt={`Page ${i + 1}`}
                      className="h-20 w-16 object-cover rounded-lg border border-[var(--line)] bg-[var(--cell-bg)]"
                    />
                    <div className="absolute top-0.5 left-0.5 bg-black/50 text-white text-[10px] rounded px-1 leading-4">
                      {i + 1}
                    </div>
                    <button
                      onClick={() => removePage(i)}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[var(--accent)] text-white rounded-full
                        text-[10px] leading-none hidden group-hover:flex items-center justify-center cursor-pointer"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chargement */}
          {status === 'loading' && (
            <div className="text-center py-6 space-y-3">
              <div className="animate-spin rounded-full h-7 w-7 border-2 border-[var(--accent)] border-t-transparent mx-auto" />
              <p className="text-sm text-[var(--ink-light)]">Analyse de la partition{pages.length > 1 ? ` (${pages.length} pages)` : ''}…</p>
            </div>
          )}

          {/* Erreur */}
          {status === 'error' && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{error}</p>
          )}

          {/* Résultat */}
          {status === 'done' && result && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
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
                {result.sections.length} section{result.sections.length > 1 ? 's' : ''} · {totalChords} mesures
              </p>

              <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                {result.sections.map((s, i) => (
                  <div key={i} className="text-xs bg-[var(--cell-bg)] rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-[var(--ink)]">{s.label}</span>
                      {s.repeat > 1 && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-[var(--accent-soft)] text-[var(--accent)] rounded font-medium">
                          ×{s.repeat}
                        </span>
                      )}
                      <span className="text-[var(--ink-faint)]">· {s.chords.length} mesures</span>
                    </div>
                    <div className="font-mono text-[var(--ink-light)] leading-relaxed">
                      {s.chords.map((c, j) => c || '—').join(' · ')}
                    </div>
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
            disabled={!pages.length || status === 'loading'}
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
