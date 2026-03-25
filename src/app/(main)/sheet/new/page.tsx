'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/lib/auth-context';
import { getDb } from '@/lib/firebase';
import { toFirestore } from '@/lib/firestore-helpers';
import { SheetEditor } from '@/components/sheet/sheet-editor';
import { createEmptySheet } from '@/types';
import type { NewSheet } from '@/types';

export default function NewSheetPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);

  if (!user) return null;

  const initialSheet = createEmptySheet(user.id, user.displayName);

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
