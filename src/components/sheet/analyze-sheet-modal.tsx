'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';

import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from '@/lib/firebase';
import { getDb } from '@/lib/firebase';
import { toFirestore } from '@/lib/firestore-helpers';
import { useAuth } from '@/lib/auth-context';
import { getRemainingOcr, isPro } from '@/lib/plan-limits';
import type { Section, Cell, CellSpan, NewSheet } from '@/types';
import { Link, useRouter } from '@/i18n/navigation';

interface ChordEntry { chord: string; beats: number }

interface SheetResult {
  title: string;
  artist: string;
  key: string;
  timeSignature: string;
  tempo: string;
  sections: { label: string; repeat: number; chords: ChordEntry[] }[];
}

function snapSpan(measures: number): CellSpan {
  const snapped = Math.round(measures / 0.25) * 0.25;
  return Math.max(0.25, Math.min(4, snapped)) as CellSpan;
}

function resultToSections(data: SheetResult, defaultSectionLabel: (n: number) => string): Section[] {
  const beatsPerMeasure: 3 | 4 = data.timeSignature?.startsWith('3') ? 3 : 4;

  return data.sections.map((s, i) => {
    // Convertir beats → span (en mesures)
    const cells: Cell[] = s.chords.map(c => ({
      chord: c.chord ?? '',
      span: snapSpan(c.beats / beatsPerMeasure),
    }));

    // Regrouper en mesures (chaque mesure = span total de 1.0)
    const measures: Cell[][] = [];
    let measure: Cell[] = [];
    let measureTotal = 0;

    for (const cell of cells) {
      measure.push(cell);
      measureTotal += cell.span;
      if (measureTotal >= 0.99) {
        measures.push(measure);
        measure = [];
        measureTotal = 0;
      }
    }
    if (measure.length > 0) measures.push(measure);

    // Regrouper les mesures en lignes de 4
    const rows: Cell[][] = [];
    for (let j = 0; j < measures.length; j += 4) {
      rows.push(measures.slice(j, j + 4).flat());
    }
    if (rows.length === 0) rows.push([]);

    return {
      id: crypto.randomUUID(),
      label: s.label || defaultSectionLabel(i + 1),
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
  const t = useTranslations('AnalyzeModal');
  const { user } = useAuth();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const [pages, setPages] = useState<PageFile[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error' | 'upgrade'>('idle');
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
      // Compression canvas : max 1600px, JPEG 85% — évite le 413 Vercel (limite 4.5MB)
      const fileData = await Promise.all(pages.map(p => new Promise<{ data: string; type: string }>((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(p.file);
        img.onload = () => {
          URL.revokeObjectURL(url);
          const MAX = 1600;
          const scale = Math.min(1, MAX / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          resolve({ data: dataUrl.split(',')[1], type: 'image/jpeg' });
        };
        img.onerror = reject;
        img.src = url;
      })));

      // Envoyer le token Firebase pour la vérification du quota côté serveur
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const auth = getAuth();
      const idToken = await auth.currentUser?.getIdToken().catch(() => null);
      if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

      const res = await fetch('/api/analyze-sheet', {
        method: 'POST',
        headers,
        body: JSON.stringify({ files: fileData }),
      });

      // Protège contre les réponses non-JSON (ex: 413 Request Entity Too Large)
      const text = await res.text();
      let data: { error?: string; upgradeRequired?: boolean } = {};
      try { data = JSON.parse(text); } catch {
        if (res.status === 413) throw new Error(t('imageTooLarge'));
        // Affiche les premiers caractères de la réponse pour aider au diagnostic
        const preview = text.slice(0, 200).replace(/<[^>]+>/g, '').trim();
        throw new Error(`${t('serverError', { status: res.status })}${preview ? ` — ${preview}` : ''}`);
      }
      if (res.status === 429 && data.upgradeRequired) throw Object.assign(new Error(data.error ?? ''), { upgradeRequired: true });
      if (!res.ok) throw new Error(data.error ?? t('unknownError'));
      setResult(data as SheetResult);
      setStatus('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('unknownError'));
      setStatus((e as { upgradeRequired?: boolean }).upgradeRequired ? 'upgrade' : 'error');
    }
  };

  const handleCreate = async () => {
    if (!user || !result) return;
    setIsCreating(true);
    try {
      const sections = resultToSections(result, (n) => t('defaultSectionLabel', { n }));
      const sheet: NewSheet = {
        title: result.title || t('untitled'),
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
      setError(t('createSheetError'));
      setIsCreating(false);
    }
  };

  const totalChords = result?.sections.reduce((acc, s) => acc + s.chords.length, 0) ?? 0;
  const remainingOcr = getRemainingOcr(user?.subscription);
  const userIsPro = isPro(user?.subscription);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-[var(--cream)] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* En-tête */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[var(--line)]">
          <div>
            <h2 className="font-playfair text-lg font-bold text-[var(--ink)]">{t('title')}</h2>
            <p className="text-xs text-[var(--ink-faint)] mt-0.5">{t('subtitle')}</p>
          </div>
          <div className="flex items-center gap-3">
            {!userIsPro && remainingOcr !== Infinity && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${remainingOcr > 0 ? 'bg-[var(--cell-bg)] text-[var(--ink-light)]' : 'bg-red-50 text-red-500'}`}>
                {remainingOcr > 0 ? t('remainingAnalyses', { count: remainingOcr }) : t('limitReached')}
              </span>
            )}
            <button onClick={onClose} className="text-[var(--ink-faint)] hover:text-[var(--ink)] text-xl leading-none cursor-pointer">×</button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

          {/* Zone de dépôt */}
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            className="border-2 border-dashed border-[var(--line)] rounded-xl overflow-hidden"
          >
            <div
              onClick={() => inputRef.current?.click()}
              className="hover:bg-[var(--cell-bg)] cursor-pointer transition-colors py-5 text-center space-y-1"
            >
              <div className="text-2xl">🎼</div>
              <p className="text-sm text-[var(--ink-light)]">
                {pages.length > 0 ? t('dropZoneAddMore') : t('dropZonePrompt')}
              </p>
              <p className="text-xs text-[var(--ink-faint)]">{t('fileTypesHint')}</p>
            </div>
            <div className="md:hidden border-t border-[var(--line)] px-4 py-2 flex justify-center">
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                className="flex items-center gap-1.5 text-xs text-[var(--ink-light)] hover:text-[var(--accent)] transition-colors cursor-pointer"
              >
                <span>📷</span> {t('takePhoto')}
              </button>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={e => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ''; }}
            />
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={e => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ''; }}
            />
          </div>

          {/* Aperçu des pages */}
          {pages.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-[var(--ink-light)]">{t('pageCount', { count: pages.length })}</p>
              <div className="flex gap-2 flex-wrap">
                {pages.map((p, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={p.preview}
                      alt={t('pageAlt', { n: i + 1 })}
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
              <p className="text-sm text-[var(--ink-light)]">{pages.length > 1 ? t('analyzingWithPages', { count: pages.length }) : t('analyzing')}</p>
            </div>
          )}

          {/* Erreur */}
          {status === 'error' && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{error}</p>
          )}

          {/* Limite OCR atteinte */}
          {status === 'upgrade' && (
            <div className="rounded-xl border border-[var(--line)] bg-[var(--cell-bg)] p-5 text-center space-y-3">
              <p className="font-semibold text-[var(--ink)] text-sm">{t('monthlyLimitReached')}</p>
              <p className="text-xs text-[var(--ink-light)]">
                {t('limitBody')}
              </p>
              <Link
                href="/pricing"
                onClick={onClose}
                className="inline-block px-5 py-2 bg-[var(--accent)] hover:bg-[#a83d25] text-white text-sm font-medium rounded-lg transition-colors"
              >
                {t('upgradeCta')}
              </Link>
            </div>
          )}

          {/* Résultat */}
          {status === 'done' && result && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                {result.title && (
                  <div className="bg-[var(--cell-bg)] border border-[var(--line)] rounded-lg px-3 py-2">
                    <div className="text-xs text-[var(--ink-faint)] mb-0.5">{t('titleLabel')}</div>
                    <div className="font-medium text-[var(--ink)] truncate">{result.title}</div>
                  </div>
                )}
                {result.artist && (
                  <div className="bg-[var(--cell-bg)] border border-[var(--line)] rounded-lg px-3 py-2">
                    <div className="text-xs text-[var(--ink-faint)] mb-0.5">{t('artistLabel')}</div>
                    <div className="font-medium text-[var(--ink)] truncate">{result.artist}</div>
                  </div>
                )}
                {result.key && (
                  <div className="bg-[var(--cell-bg)] border border-[var(--line)] rounded-lg px-3 py-2">
                    <div className="text-xs text-[var(--ink-faint)] mb-0.5">{t('keyLabel')}</div>
                    <div className="font-mono font-bold text-[var(--ink)]">{result.key}</div>
                  </div>
                )}
                {result.tempo && (
                  <div className="bg-[var(--cell-bg)] border border-[var(--line)] rounded-lg px-3 py-2">
                    <div className="text-xs text-[var(--ink-faint)] mb-0.5">{t('tempoLabel')}</div>
                    <div className="font-mono font-bold text-[var(--ink)]">{result.tempo} BPM</div>
                  </div>
                )}
              </div>

              <p className="text-xs text-[var(--ink-faint)]">
                {t('sectionCountLabel', { count: result.sections.length })} · {t('measureCountLabel', { count: totalChords })}
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
                      <span className="text-[var(--ink-faint)]">· {t('measureCountLabel', { count: s.chords.length })}</span>
                    </div>
                    <div className="font-mono text-[var(--ink-light)] leading-relaxed">
                      {s.chords.map((c) => {
                        const full = result!.timeSignature?.startsWith('3') ? 3 : 4;
                        return c.beats !== full ? `${c.chord || '—'}(${c.beats})` : (c.chord || '—');
                      }).join(' · ')}
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
          <button onClick={onClose} className="px-4 py-2 text-sm text-[var(--ink-light)] hover:text-[var(--ink)] transition-colors cursor-pointer">
            {t('cancel')}
          </button>
          <div className="flex gap-3">
            <button
              onClick={handleAnalyze}
              disabled={!pages.length || status === 'loading'}
              className="px-5 py-2 text-sm bg-[var(--accent)] hover:bg-[#a83d25] text-white rounded-lg
                transition-colors disabled:opacity-40 cursor-pointer"
            >
              {status === 'loading' ? t('analyzeLoading') : status === 'done' ? t('analyzeDone') : t('analyzeIdle')}
            </button>
            {status === 'done' && (
              <button
                onClick={handleCreate}
                disabled={isCreating}
                className="px-5 py-2 text-sm bg-[var(--accent)] hover:bg-[#a83d25] text-white rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isCreating ? t('creating') : t('createSheet')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
