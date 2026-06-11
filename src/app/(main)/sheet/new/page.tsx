'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/lib/auth-context';
import { getDb } from '@/lib/firebase';
import { toFirestore, fromFirestore } from '@/lib/firestore-helpers';
import { SheetEditor } from '@/components/sheet/sheet-editor';
import { ImportSheetModal } from '@/components/sheet/import-sheet-modal';
import { AnalyzeSheetModal } from '@/components/sheet/analyze-sheet-modal';
import { createEmptySheet } from '@/types';
import type { NewSheet, Sheet } from '@/types';

type Mode = 'choose' | 'blank' | 'import' | 'analyze';

export default function NewSheetPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [initialSheet, setInitialSheet] = useState<NewSheet | null>(null);
  const [mode, setMode] = useState<Mode>('choose');

  const forkFrom = searchParams.get('forkFrom');
  const groupId = searchParams.get('groupId') || undefined;

  // Si fork, aller directement en mode blank (éditeur)
  useEffect(() => {
    if (!user) return;
    if (forkFrom) {
      const db = getDb();
      getDoc(doc(db, 'sheets', forkFrom)).then((snap) => {
        if (snap.exists()) {
          const source = fromFirestore(snap.id, snap.data()) as Sheet;
          const { id: _id, viewCount: _v, averageRating: _a, ratingCount: _r, createdAt: _c, updatedAt: _u, ...rest } = source;
          setInitialSheet({ ...rest, ownerId: user.id, ownerName: user.displayName, isPublic: false, forkedFrom: source.id, groupId });
        } else {
          setInitialSheet({ ...createEmptySheet(user.id, user.displayName), groupId });
        }
        setMode('blank');
      }).catch(() => {
        setInitialSheet({ ...createEmptySheet(user.id, user.displayName), groupId });
        setMode('blank');
      });
    } else {
      setInitialSheet({ ...createEmptySheet(user.id, user.displayName), groupId });
    }
  }, [user, forkFrom, groupId]);

  if (!user || !initialSheet) return null;

  const handleSave = async (sheet: NewSheet) => {
    setIsSaving(true);
    try {
      const db = getDb();
      const docRef = await addDoc(collection(db, 'sheets'), {
        ...toFirestore(sheet),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        viewCount: 0,
      });
      router.push(`/sheet/${docRef.id}/edit`);
    } catch (error) {
      console.error('Error creating sheet:', error);
      alert('Erreur lors de la création de la grille');
    } finally {
      setIsSaving(false);
    }
  };

  if (mode === 'blank') {
    return <SheetEditor initialSheet={initialSheet} onSave={handleSave} isSaving={isSaving} />;
  }

  return (
    <>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16">
        <div className="mb-10 text-center">
          <h1 className="font-playfair text-3xl font-bold text-[var(--ink)] mb-2">Nouvelle grille</h1>
          <p className="text-[var(--ink-light)] text-sm">Comment veux-tu créer ta grille ?</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Grille vierge */}
          <button
            onClick={() => setMode('blank')}
            className="group flex flex-col items-center gap-4 p-7 rounded-2xl border-2 border-[var(--line)]
              hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] transition-all cursor-pointer"
          >
            <div className="w-14 h-14 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center group-hover:bg-[var(--accent)] group-hover:text-white transition-all duration-200 shrink-0">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="4" y1="13" x2="20" y2="13"/>
                <line x1="12" y1="8" x2="12" y2="22"/>
              </svg>
            </div>
            <div className="text-center">
              <div className="font-semibold text-[var(--ink)] text-sm group-hover:text-[var(--accent)] transition-colors">
                Grille vierge
              </div>
              <div className="text-xs text-[var(--ink-faint)] mt-1">
                Créer depuis zéro
              </div>
            </div>
          </button>

          {/* Importer */}
          <button
            onClick={() => setMode('import')}
            className="group flex flex-col items-center gap-4 p-7 rounded-2xl border-2 border-[var(--line)]
              hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] transition-all cursor-pointer"
          >
            <div className="w-14 h-14 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center group-hover:bg-[var(--accent)] group-hover:text-white transition-all duration-200 shrink-0">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/>
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                <line x1="9" y1="11" x2="15" y2="11"/>
                <line x1="9" y1="14" x2="15" y2="14"/>
                <line x1="9" y1="17" x2="13" y2="17"/>
              </svg>
            </div>
            <div className="text-center">
              <div className="font-semibold text-[var(--ink)] text-sm group-hover:text-[var(--accent)] transition-colors">
                Importer du texte
              </div>
              <div className="text-xs text-[var(--ink-faint)] mt-1">
                Coller depuis Ultimate Guitar ou autre
              </div>
            </div>
          </button>

          {/* Partition */}
          <button
            onClick={() => setMode('analyze')}
            className="group flex flex-col items-center gap-4 p-7 rounded-2xl border-2 border-[var(--line)]
              hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] transition-all cursor-pointer"
          >
            <div className="w-14 h-14 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center group-hover:bg-[var(--accent)] group-hover:text-white transition-all duration-200 shrink-0">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                <circle cx="12" cy="13" r="4"/>
                <path d="M19 4l.6 1.4L21 6l-1.4.6L19 8l-.6-1.4L17 6l1.4-.6z" fill="currentColor" strokeWidth="0"/>
              </svg>
            </div>
            <div className="text-center">
              <div className="font-semibold text-[var(--ink)] text-sm group-hover:text-[var(--accent)] transition-colors">
                Lire une partition
              </div>
              <div className="text-xs text-[var(--ink-faint)] mt-1">
                Photo ou image analysée par IA
              </div>
            </div>
          </button>
        </div>
      </div>

      {mode === 'import' && (
        <ImportSheetModal onClose={() => setMode('choose')} />
      )}
      {mode === 'analyze' && (
        <AnalyzeSheetModal onClose={() => setMode('choose')} />
      )}
    </>
  );
}
