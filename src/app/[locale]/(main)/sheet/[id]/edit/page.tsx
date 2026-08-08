'use client';

import { useState, useEffect, use } from 'react';
import { reportUnknownChords } from '@/lib/report-unknown-chords';
import { useTranslations } from 'next-intl';

import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/lib/auth-context';
import { getDb } from '@/lib/firebase';
import { fromFirestore, toFirestore } from '@/lib/firestore-helpers';
import { SheetEditor } from '@/components/sheet/sheet-editor';
import type { Sheet, NewSheet } from '@/types';
import { useRouter } from '@/i18n/navigation';
import { sheetIdFromSegment } from '@/lib/sheet-url';

interface EditSheetPageProps {
  params: Promise<{ id: string }>;
}

export default function EditSheetPage({ params }: EditSheetPageProps) {
  const t = useTranslations('EditSheet');
  // Même lecture que la page de consultation : on édite la grille dont l'adresse
  // porte l'identifiant, quel que soit le slug qui le précède.
  const { id: segment } = use(params);
  const id = sheetIdFromSegment(segment);
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
          setError(t('notFound'));
          return;
        }

        const data = docSnap.data();

        // Autorisé : propriétaire, admin, ou membre du groupe si la grille appartient
        // à un groupe (les grilles de groupe sont éditables par tous les membres).
        let authorized = data.ownerId === user?.id || isAdmin;
        if (!authorized && data.groupId && user) {
          const groupSnap = await getDoc(doc(db, 'groups', data.groupId));
          const memberIds = (groupSnap.data()?.memberIds as string[]) || [];
          authorized = memberIds.includes(user.id);
        }
        if (!authorized) {
          setError(t('forbidden'));
          return;
        }

        setSheet(fromFirestore(docSnap.id, data));
      } catch (err) {
        console.error('Error loading sheet:', err);
        setError(t('loadError'));
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

      // Le serveur relit la grille et prévient l'équipe si elle emploie un accord que
      // la bibliothèque ne sait pas dessiner. Sans attente : l'enregistrement est fait.
      reportUnknownChords(id);
    } catch (error) {
      console.error('Error saving sheet:', error);
      alert(t('saveError'));
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
          {t('backToDashboard')}
        </button>
      </div>
    );
  }

  if (!sheet) {
    return null;
  }

  return (
    <SheetEditor
      initialSheet={sheet}
      onSave={handleSave}
      isSaving={isSaving}
    />
  );
}
