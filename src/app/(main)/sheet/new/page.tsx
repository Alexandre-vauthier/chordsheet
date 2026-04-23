'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/lib/auth-context';
import { getDb } from '@/lib/firebase';
import { toFirestore, fromFirestore } from '@/lib/firestore-helpers';
import { SheetEditor } from '@/components/sheet/sheet-editor';
import { createEmptySheet } from '@/types';
import type { NewSheet, Sheet } from '@/types';

export default function NewSheetPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [initialSheet, setInitialSheet] = useState<NewSheet | null>(null);

  useEffect(() => {
    if (!user) return;

    const forkFrom = searchParams.get('forkFrom');
    if (forkFrom) {
      // Charger la grille source
      const db = getDb();
      getDoc(doc(db, 'sheets', forkFrom)).then((snap) => {
        if (snap.exists()) {
          const source = fromFirestore(snap.id, snap.data()) as Sheet;
          const { id: _id, viewCount: _v, averageRating: _a, ratingCount: _r, createdAt: _c, updatedAt: _u, ...rest } = source;
          setInitialSheet({
            ...rest,
            ownerId: user.id,
            ownerName: user.displayName,
            isPublic: false,
            forkedFrom: source.id,
          });
        } else {
          setInitialSheet(createEmptySheet(user.id, user.displayName));
        }
      }).catch(() => {
        setInitialSheet(createEmptySheet(user.id, user.displayName));
      });
    } else {
      setInitialSheet(createEmptySheet(user.id, user.displayName));
    }
  }, [user, searchParams]);

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

  return <SheetEditor initialSheet={initialSheet} onSave={handleSave} isSaving={isSaving} />;
}
