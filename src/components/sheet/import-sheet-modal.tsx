'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import { toFirestore } from '@/lib/firestore-helpers';
import { useAuth } from '@/lib/auth-context';
import { parseChordSheetText } from '@/lib/chord-sheet-parser';
import type { NewSheet } from '@/types';

interface ImportSheetModalProps {
  onClose: () => void;
}

export function ImportSheetModal({ onClose }: ImportSheetModalProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = text.trim() ? parseChordSheetText(text) : null;
  const totalChords =
    parsed?.sections.reduce(
      (acc, s) => acc + s.rows.reduce((a, r) => a + r.filter(c => c.chord).length, 0),
      0
    ) ?? 0;

  const handleImport = async () => {
    if (!user || !parsed || parsed.sections.length === 0) return;
    setIsImporting(true);
    setError(null);
    try {
      const db = getDb();
      const sheet: NewSheet = {
        title: title.trim() || 'Sans titre',
        artist: artist.trim() || '',
        key: parsed.key || '',
        tempo: '',
        ownerId: user.id,
        ownerName: user.displayName,
        isPublic: false,
        sections: parsed.sections,
        tags: [],
        genres: [],
        difficulty: null,
        capo: parsed.capo,
      };
      const docRef = await addDoc(collection(db, 'sheets'), {
        ...toFirestore(sheet),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        viewCount: 0,
      });
      router.push(`/sheet/${docRef.id}/edit`);
    } catch (err) {
      console.error(err);
      setError('Erreur lors de la création. Réessayez.');
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative bg-[var(--cream)] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl font-bold text-[var(--ink)]">Importer depuis texte</h2>
              <p className="text-xs text-[var(--ink-faint)] mt-0.5">
                Collez votre grille depuis n&apos;importe quelle source
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-[var(--ink-faint)] hover:text-[var(--ink)] text-2xl leading-none ml-4"
            >
              ×
            </button>
          </div>

          {/* Titre / Artiste */}
          <div className="flex gap-3 mb-3">
            <input
              type="text"
              placeholder="Titre de la chanson"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="flex-1 px-3 py-2 text-sm border border-[var(--line)] rounded-lg bg-[var(--cell-bg)]
                focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
            <input
              type="text"
              placeholder="Artiste"
              value={artist}
              onChange={e => setArtist(e.target.value)}
              className="flex-1 px-3 py-2 text-sm border border-[var(--line)] rounded-lg bg-[var(--cell-bg)]
                focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>

          {/* Zone de collage */}
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={`Coller ici la grille d'accords…\n\n[Intro]\nC  Am  F  G\n\n[Verse 1]\n   C              Am\nI heard there was a secret chord`}
            className="w-full h-56 px-3 py-2 text-xs font-mono border border-[var(--line)] rounded-lg
              bg-[var(--cell-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none"
          />

          {/* Aperçu */}
          {parsed && parsed.sections.length > 0 && (
            <div className="mt-3 p-3 bg-[var(--cell-bg)] rounded-lg border border-[var(--line)]">
              <p className="text-xs font-semibold text-[var(--ink-light)] mb-2">Aperçu détecté</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {parsed.capo !== null && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                    Capo {parsed.capo}
                  </span>
                )}
                {parsed.key && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                    Tonalité : {parsed.key}
                  </span>
                )}
                <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--line)] text-[var(--ink-light)]">
                  {parsed.sections.length} section{parsed.sections.length > 1 ? 's' : ''}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--line)] text-[var(--ink-light)]">
                  {totalChords} accord{totalChords > 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {parsed.sections.map(s => (
                  <span
                    key={s.id}
                    className="text-xs px-2 py-0.5 rounded bg-[var(--cream)] border border-[var(--line)] text-[var(--ink)]"
                  >
                    {s.label}
                    <span className="text-[var(--ink-faint)] ml-1">
                      {s.rows.length} ligne{s.rows.length > 1 ? 's' : ''}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {parsed && parsed.sections.length === 0 && text.trim() && (
            <p className="mt-3 text-xs text-[var(--ink-faint)]">
              Aucune section détectée. Assurez-vous que le texte contient des marqueurs comme{' '}
              <code className="font-mono">[Intro]</code>, <code className="font-mono">[Verse]</code>…
            </p>
          )}

          {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-5">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-[var(--ink-light)] hover:text-[var(--ink)] transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleImport}
              disabled={!parsed || parsed.sections.length === 0 || isImporting}
              className="px-5 py-2 text-sm font-medium bg-[var(--accent)] text-white rounded-xl
                disabled:opacity-40 hover:opacity-90 transition-opacity cursor-pointer disabled:cursor-not-allowed"
            >
              {isImporting ? 'Création…' : 'Créer le brouillon'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
