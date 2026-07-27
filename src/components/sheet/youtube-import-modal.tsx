'use client';

import { useState, useRef, useEffect } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject, type StorageReference } from 'firebase/storage';
import { getAuth, getDb, getStorage } from '@/lib/firebase';
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
  referenceUrl?: string;
}

function snapSpan(measures: number): CellSpan {
  const snapped = Math.round(measures / 0.25) * 0.25;
  return Math.max(0.25, Math.min(4, snapped)) as CellSpan;
}

// Même conversion que l'analyse photo (beats → mesures → lignes de 4).
function resultToSections(data: SheetResult): Section[] {
  const beatsPerMeasure: 3 | 4 = data.timeSignature?.startsWith('3') ? 3 : 4;
  return data.sections.map((s, i) => {
    const cells: Cell[] = s.chords.map((c) => ({ chord: c.chord ?? '', span: snapSpan(c.beats / beatsPerMeasure) }));
    const measures: Cell[][] = [];
    let measure: Cell[] = [];
    let total = 0;
    for (const cell of cells) {
      measure.push(cell);
      total += cell.span;
      if (total >= 0.99) { measures.push(measure); measure = []; total = 0; }
    }
    if (measure.length) measures.push(measure);
    const rows: Cell[][] = [];
    for (let j = 0; j < measures.length; j += 4) rows.push(measures.slice(j, j + 4).flat());
    if (!rows.length) rows.push([]);
    return {
      id: crypto.randomUUID(),
      label: s.label || `Partie ${i + 1}`,
      repeat: Math.max(1, s.repeat || 1),
      beatsPerMeasure,
      rows,
    };
  });
}

export function YoutubeImportModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error' | 'upgrade'>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<SheetResult | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const remainingOcr = getRemainingOcr(user?.subscription);
  const userIsPro = isPro(user?.subscription);

  // Chrono pendant l'analyse (progression estimée, le service ne renvoie rien avant la fin)
  useEffect(() => {
    if (status !== 'loading') { setElapsed(0); return; }
    const t0 = Date.now();
    const id = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 500);
    return () => clearInterval(id);
  }, [status]);

  const ESTIMATE = 240; // ~4 min pour un morceau moyen
  const progress = Math.min(95, Math.round((elapsed / ESTIMATE) * 100));
  const stage = elapsed < 6
    ? (file ? 'Envoi de l’audio…' : 'Récupération de l’audio…')
    : elapsed < 150
      ? 'Séparation des pistes (voix, batterie, harmonie)…'
      : 'Détection des accords et du tempo…';
  const mmss = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;

  const analyze = async () => {
    if (!url.trim() && !file) return;
    if (!user) return;
    setStatus('loading');
    setError('');
    // Fichier déposé temporairement pour l'analyse : on le supprime dès que le
    // service l'a traité (aucun stockage durable des audios côté serveur).
    let uploadedRef: StorageReference | null = null;
    try {
      let payload: Record<string, string>;
      if (file) {
        // Upload vers Firebase Storage → URL de téléchargement passée au service
        // (évite la limite de taille des fonctions Vercel).
        const clean = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `analyze-uploads/${user.id}/${Date.now()}-${clean}`;
        const snap = await uploadBytes(storageRef(getStorage(), path), file);
        uploadedRef = snap.ref;
        const audioUrl = await getDownloadURL(uploadedRef);
        payload = { audioUrl, title: file.name.replace(/\.[^.]+$/, '') };
      } else {
        payload = { youtubeUrl: url.trim() };
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const idToken = await getAuth().currentUser?.getIdToken().catch(() => null);
      if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

      const res = await fetch('/api/analyze-audio', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      let data: SheetResult & { error?: string; upgradeRequired?: boolean } = {} as never;
      try { data = JSON.parse(text); } catch {
        throw new Error(`Erreur serveur (${res.status}).`);
      }
      if (res.status === 429 && data.upgradeRequired) throw Object.assign(new Error(data.error ?? ''), { upgradeRequired: true });
      if (!res.ok) throw new Error(data.error ?? 'Erreur inconnue.');
      setResult(data);
      setStatus('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue.');
      setStatus((e as { upgradeRequired?: boolean }).upgradeRequired ? 'upgrade' : 'error');
    } finally {
      // Le service a téléchargé le fichier au tout début de son traitement : à ce
      // stade (réponse reçue ou erreur), on peut le supprimer sans risque.
      if (uploadedRef) deleteObject(uploadedRef).catch(() => {});
    }
  };

  const create = async () => {
    if (!user || !result) return;
    setIsCreating(true);
    try {
      const sheet: NewSheet = {
        title: result.title || 'Sans titre',
        artist: result.artist || '',
        key: result.key || '',
        tempo: result.tempo ? `${result.tempo} BPM` : '',
        ownerId: user.id,
        ownerName: user.displayName,
        isPublic: false,
        sections: resultToSections(result),
        tags: [],
        genres: [],
        difficulty: null,
        capo: null,
        referenceUrl: result.referenceUrl || url.trim(),
      };
      const ref = await addDoc(collection(getDb(), 'sheets'), {
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

  const totalMeasures = result?.sections.reduce((acc, s) => acc + s.chords.length, 0) ?? 0;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-[var(--cream)] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[var(--line)]">
          <div>
            <h2 className="font-playfair text-lg font-bold text-[var(--ink)]">Depuis un audio</h2>
            <p className="text-xs text-[var(--ink-faint)] mt-0.5">Lien YouTube ou fichier : les accords sont extraits de l&apos;audio.</p>
          </div>
          <div className="flex items-center gap-3">
            {!userIsPro && remainingOcr !== Infinity && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${remainingOcr > 0 ? 'bg-[var(--cell-bg)] text-[var(--ink-light)]' : 'bg-red-50 text-red-500'}`}>
                {remainingOcr > 0 ? `${remainingOcr} analyse(s) restante(s)` : 'Limite atteinte'}
              </span>
            )}
            <button onClick={onClose} className="text-[var(--ink-faint)] hover:text-[var(--ink)] text-xl leading-none cursor-pointer">×</button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          <input
            type="url"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setFile(null); setStatus('idle'); setResult(null); }}
            placeholder="https://www.youtube.com/watch?v=…"
            className="w-full px-3 py-2 rounded-lg border border-[var(--line)] bg-[var(--cell-bg)] text-[var(--ink)] text-sm placeholder:text-[var(--ink-faint)] focus:outline-none focus:border-[var(--accent)]"
          />

          <div className="flex items-center gap-3 text-xs text-[var(--ink-faint)]">
            <div className="flex-1 h-px bg-[var(--line)]" /> ou <div className="flex-1 h-px bg-[var(--line)]" />
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-[var(--line)] text-sm text-[var(--ink-light)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 18V5l12-2v13M9 13l12-2M6 21a3 3 0 100-6 3 3 0 000 6z" />
            </svg>
            {file ? file.name : 'Choisir un fichier audio (MP3, WAV…)'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); setUrl(''); setStatus('idle'); setResult(null); } e.target.value = ''; }}
          />

          <p className="text-xs text-[var(--ink-faint)] leading-relaxed">
            La détection est automatique (séparation des pistes puis reconnaissance) : elle donne un
            <strong> brouillon en accords majeurs/mineurs</strong>, à corriger dans l&apos;éditeur. L&apos;analyse peut prendre 1 à 3 minutes.
          </p>

          {status === 'loading' && (
            <div className="py-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--ink-light)]">{stage}</span>
                <span className="font-mono text-xs text-[var(--ink-faint)]">{mmss}</span>
              </div>
              <div className="h-2 rounded-full bg-[var(--line)] overflow-hidden">
                <div
                  className="h-full bg-[var(--accent)] transition-[width] duration-500 ease-linear"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-[var(--ink-faint)] text-center">
                L’analyse tourne sur le serveur (~3-4 min). Tu peux laisser cette fenêtre ouverte.
              </p>
            </div>
          )}

          {status === 'error' && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{error}</p>
          )}

          {status === 'upgrade' && (
            <div className="rounded-xl border border-[var(--line)] bg-[var(--cell-bg)] p-5 text-center space-y-3">
              <p className="font-semibold text-[var(--ink)] text-sm">Limite d&apos;analyses atteinte ce mois-ci</p>
              <Link href="/pricing" onClick={onClose} className="inline-block px-5 py-2 bg-[var(--accent)] hover:bg-[#a83d25] text-white text-sm font-medium rounded-lg transition-colors">
                Passer à Pro
              </Link>
            </div>
          )}

          {status === 'done' && result && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                {result.title && (
                  <div className="bg-[var(--cell-bg)] border border-[var(--line)] rounded-lg px-3 py-2">
                    <div className="text-xs text-[var(--ink-faint)] mb-0.5">Titre</div>
                    <div className="font-medium text-[var(--ink)] truncate">{result.title}</div>
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
                {result.sections.length} section(s) · {totalMeasures} mesure(s)
              </p>
              <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                {result.sections.map((s, i) => (
                  <div key={i} className="text-xs bg-[var(--cell-bg)] rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-[var(--ink)]">{s.label}</span>
                      {s.repeat > 1 && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-[var(--accent-soft)] text-[var(--accent)] rounded font-medium">×{s.repeat}</span>
                      )}
                    </div>
                    <div className="font-mono text-[var(--ink-light)] leading-relaxed">
                      {s.chords.map((c) => c.chord || '—').join(' · ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[var(--line)] flex justify-between items-center">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[var(--ink-light)] hover:text-[var(--ink)] transition-colors cursor-pointer">
            Annuler
          </button>
          <div className="flex gap-3">
            <button
              onClick={analyze}
              disabled={(!url.trim() && !file) || status === 'loading'}
              className="px-5 py-2 text-sm bg-[var(--accent)] hover:bg-[#a83d25] text-white rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
            >
              {status === 'loading' ? 'Analyse…' : status === 'done' ? 'Ré-analyser' : 'Analyser'}
            </button>
            {status === 'done' && (
              <button
                onClick={create}
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
