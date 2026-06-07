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
            className="group flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-[var(--line)]
              hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] transition-all cursor-pointer text-left"
          >
            <div className="text-3xl">📝</div>
            <div>
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
            className="group flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-[var(--line)]
              hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] transition-all cursor-pointer text-left"
          >
            <div className="text-3xl">📋</div>
            <div>
              <div className="font-semibold text-[var(--ink)] text-sm group-hover:text-[var(--accent)] transition-colors">
                Importer du texte
              </div>
              <div className="text-xs text-[var(--ink-faint)] mt-1">
                Coller depuis Ultimate Guitar ou un autre format
              </div>
            </div>
          </button>

          {/* Partition */}
          <button
            onClick={() => setMode('analyze')}
            className="group flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-[var(--line)]
              hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] transition-all cursor-pointer text-left"
          >
            <div className="text-3xl">🎼</div>
            <div>
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
