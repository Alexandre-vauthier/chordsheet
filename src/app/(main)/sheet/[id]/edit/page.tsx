'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/lib/auth-context';
import { getDb } from '@/lib/firebase';
import { fromFirestore, toFirestore } from '@/lib/firestore-helpers';
import { SheetEditor } from '@/components/sheet/sheet-editor';
import type { Sheet, NewSheet } from '@/types';

interface EditSheetPageProps {
  params: Promise<{ id: string }>;
}

export default function EditSheetPage({ params }: EditSheetPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSheet() {
      try {
        const db = getDb();
        const docRef = doc(db, 'sheets', id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          setError('Grille non trouvée');
          return;
        }

        const data = docSnap.data();

        // Vérifier que l'utilisateur est le propriétaire
        if (data.ownerId !== user?.id && !isAdmin) {
          setError('Vous n\'êtes pas autorisé à modifier cette grille');
          return;
        }

        setSheet(fromFirestore(docSnap.id, data));
      } catch (err) {
        console.error('Error loading sheet:', err);
        setError('Erreur lors du chargement de la grille');
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      loadSheet();
    }
  }, [id, user]);

  const handleSave = async (updatedSheet: Sheet | NewSheet) => {
    setIsSaving(true);

    try {
      const db = getDb();
      const docRef = doc(db, 'sheets', id);

      const firestoreData = toFirestore(updatedSheet);
      await updateDoc(docRef, {
        ...firestoreData,
        updatedAt: serverTimestamp(),
      });

      // Mettre à jour l'état local (on sait que c'est un Sheet car on est en mode edit)
      setSheet(updatedSheet as Sheet);
    } catch (error) {
      console.error('Error saving sheet:', error);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--accent)] border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={() => router.push('/dashboard')}
          className="text-[var(--accent)] hover:underline"
        >
          Retour au dashboard
        </button>
      </div>
    );
  }

  if (!sheet) {
    return null;
  }

  return <SheetEditor initialSheet={sheet} onSave={handleSave} isSaving={isSaving} />;
}
