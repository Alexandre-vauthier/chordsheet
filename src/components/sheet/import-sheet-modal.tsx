'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import { toFirestore } from '@/lib/firestore-helpers';
import { useAuth } from '@/lib/auth-context';
import { parseChordSheetText } from '@/lib/chord-sheet-parser';
import type { NewSheet } from '@/types';
import { useRouter } from '@/i18n/navigation';

interface ImportSheetModalProps {
  onClose: () => void;
}

export function ImportSheetModal({ onClose }: ImportSheetModalProps) {
  const t = useTranslations('ImportModal');
  const { user } = useAuth();
  const router = useRouter();
  const [text, setText] = useState('');
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
        title: parsed.title || t('untitled'),
        artist: parsed.artist || '',
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
        referenceUrl: parsed.referenceUrl,
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
      setError(t('createError'));
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
              <h2 className="text-xl font-bold text-[var(--ink)]">{t('title')}</h2>
              <p className="text-xs text-[var(--ink-faint)] mt-0.5">
                {t('subtitle')}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-[var(--ink-faint)] hover:text-[var(--ink)] text-2xl leading-none ml-4"
            >
              ×
            </button>
          </div>

          {/* Zone de collage */}
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={t('placeholder')}
            className="w-full h-64 px-3 py-2 text-xs font-mono border border-[var(--line)] rounded-lg
              bg-[var(--cell-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none"
          />

          {/* Aperçu */}
          {parsed && parsed.sections.length > 0 && (
            <div className="mt-3 p-3 bg-[var(--cell-bg)] rounded-lg border border-[var(--line)]">
              <p className="text-xs font-semibold text-[var(--ink-light)] mb-2">{t('detectedPreview')}</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {(parsed.title || parsed.artist) && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--line)] text-[var(--ink)]">
                    {[parsed.title, parsed.artist].filter(Boolean).join(' · ')}
                  </span>
                )}
                {parsed.capo !== null && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                    {t('capoLabel')} {parsed.capo}
                  </span>
                )}
                {parsed.key && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                    {t('keyLabel')} {parsed.key}
                  </span>
                )}
                <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--line)] text-[var(--ink-light)]">
                  {t('sectionCount', { count: parsed.sections.length })}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--line)] text-[var(--ink-light)]">
                  {t('chordCount', { count: totalChords })}
                </span>
                {parsed.referenceUrl && (
                  <a
                    href={parsed.referenceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                  >
                    {t('youtubeDetected')}
                  </a>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {parsed.sections.map(s => (
                  <span
                    key={s.id}
                    className="text-xs px-2 py-0.5 rounded bg-[var(--cream)] border border-[var(--line)] text-[var(--ink)]"
                  >
                    {s.label}
                    <span className="text-[var(--ink-faint)] ml-1">
                      {t('lineCount', { count: s.rows.length })}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {parsed && parsed.sections.length === 0 && text.trim() && (
            <p className="mt-3 text-xs text-[var(--ink-faint)]">
              {t('noSectionDetected')}{' '}
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
              {t('cancel')}
            </button>
            <button
              onClick={handleImport}
              disabled={!parsed || parsed.sections.length === 0 || isImporting}
              className="px-5 py-2 text-sm font-medium bg-[var(--accent)] text-white rounded-xl
                disabled:opacity-40 hover:opacity-90 transition-opacity cursor-pointer disabled:cursor-not-allowed"
            >
              {isImporting ? t('creating') : t('createDraft')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
