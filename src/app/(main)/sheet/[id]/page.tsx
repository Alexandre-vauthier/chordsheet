'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/lib/auth-context';
import { getDb } from '@/lib/firebase';
import { fromFirestore } from '@/lib/firestore-helpers';
import { useBookmarks } from '@/lib/use-bookmarks';
import { SheetViewer } from '@/components/sheet/sheet-viewer';
import { Button } from '@/components/ui/button';
import type { Sheet } from '@/types';

interface ViewSheetPageProps {
  params: Promise<{ id: string }>;
}

export default function ViewSheetPage({ params }: ViewSheetPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const { isBookmarked, toggleBookmark } = useBookmarks(user?.id);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTogglingBookmark, setIsTogglingBookmark] = useState(false);

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

        // Vérifier les droits d'accès
        if (!data.isPublic && data.ownerId !== user?.id) {
          setError('Cette grille est privée');
          return;
        }

        setSheet(fromFirestore(docSnap.id, data));
      } catch (err) {
        console.error('Error loading sheet:', err);
        setError('Erreur lors du chargement');
      } finally {
        setLoading(false);
      }
    }

    loadSheet();
  }, [id, user]);

  const handlePrint = () => {
    window.print();
  };

  const handleToggleBookmark = async () => {
    if (!user || !sheet?.id) return;
    setIsTogglingBookmark(true);
    try {
      await toggleBookmark(sheet.id);
    } finally {
      setIsTogglingBookmark(false);
    }
  };

  const sheetIsBookmarked = sheet?.id ? isBookmarked(sheet.id) : false;

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

  if (!sheet) return null;

  const isOwner = user?.id === sheet.ownerId;

  return (
    <>
      {/* Barre d'actions (masquée à l'impression) */}
      <div className="bg-white border-b border-[var(--line)] py-3 px-6 print:hidden">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => router.back()}>
              ← Retour
            </Button>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <Button
                variant="ghost"
                onClick={handleToggleBookmark}
                disabled={isTogglingBookmark}
                className={sheetIsBookmarked ? 'text-amber-500' : ''}
              >
                {sheetIsBookmarked ? '★ Dans mon book' : '☆ Ajouter à mon book'}
              </Button>
            )}
            {isOwner && (
              <Link href={`/sheet/${id}/edit`}>
                <Button variant="ghost">Modifier</Button>
              </Link>
            )}
            <Button onClick={handlePrint}>
              Imprimer / PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Contenu */}
      <SheetViewer sheet={sheet} />
    </>
  );
}
