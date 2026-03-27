'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  onSnapshot,
  orderBy,
} from 'firebase/firestore';
import { getDb } from './firebase';
import { fromFirestore } from './firestore-helpers';
import type { Set, NewSet, Sheet } from '@/types';

interface UseSetsReturn {
  sets: Set[];
  isLoading: boolean;
  createSet: (set: NewSet) => Promise<string>;
  updateSet: (setId: string, updates: Partial<Set>) => Promise<void>;
  deleteSet: (setId: string) => Promise<void>;
  addSheetToSet: (setId: string, sheetId: string) => Promise<void>;
  removeSheetFromSet: (setId: string, sheetId: string) => Promise<void>;
  reorderSheets: (setId: string, sheetIds: string[]) => Promise<void>;
}

// Convertir les données Firestore en Set
function setFromFirestore(id: string, data: Record<string, unknown>): Set {
  return {
    id,
    name: (data.name as string) || '',
    description: (data.description as string) || '',
    ownerId: (data.ownerId as string) || '',
    ownerName: (data.ownerName as string) || '',
    sheetIds: (data.sheetIds as string[]) || [],
    isPublic: (data.isPublic as boolean) || false,
    createdAt: (data.createdAt as { toDate: () => Date })?.toDate?.() || new Date(),
    updatedAt: (data.updatedAt as { toDate: () => Date })?.toDate?.() || new Date(),
  };
}

export function useSets(userId: string | undefined): UseSetsReturn {
  const [sets, setSets] = useState<Set[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Charger les sets de l'utilisateur en temps réel
  useEffect(() => {
    if (!userId) {
      setSets([]);
      setIsLoading(false);
      return;
    }

    const db = getDb();
    const setsQuery = query(
      collection(db, 'sets'),
      where('ownerId', '==', userId),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      setsQuery,
      (snapshot) => {
        const loadedSets = snapshot.docs.map((doc) =>
          setFromFirestore(doc.id, doc.data())
        );
        setSets(loadedSets);
        setIsLoading(false);
      },
      (error) => {
        console.error('Error loading sets:', error);
        // Fallback: charger sans orderBy si l'index n'existe pas
        getDocs(query(collection(db, 'sets'), where('ownerId', '==', userId)))
          .then((snapshot) => {
            const loadedSets = snapshot.docs
              .map((doc) => setFromFirestore(doc.id, doc.data()))
              .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
            setSets(loadedSets);
          })
          .catch((err) => console.error('Fallback error:', err))
          .finally(() => setIsLoading(false));
      }
    );

    return () => unsubscribe();
  }, [userId]);

  // Créer un nouveau set
  const createSet = useCallback(
    async (set: NewSet): Promise<string> => {
      const db = getDb();
      const docRef = await addDoc(collection(db, 'sets'), {
        ...set,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    },
    []
  );

  // Mettre à jour un set
  const updateSet = useCallback(
    async (setId: string, updates: Partial<Set>) => {
      const db = getDb();
      const { id, createdAt, ...updateData } = updates as Set;
      await updateDoc(doc(db, 'sets', setId), {
        ...updateData,
        updatedAt: serverTimestamp(),
      });
    },
    []
  );

  // Supprimer un set
  const deleteSet = useCallback(async (setId: string) => {
    const db = getDb();
    await deleteDoc(doc(db, 'sets', setId));
  }, []);

  // Ajouter une grille à un set
  const addSheetToSet = useCallback(
    async (setId: string, sheetId: string) => {
      const db = getDb();
      const setDoc = await getDoc(doc(db, 'sets', setId));
      if (!setDoc.exists()) return;

      const currentSheetIds = (setDoc.data().sheetIds as string[]) || [];
      if (!currentSheetIds.includes(sheetId)) {
        await updateDoc(doc(db, 'sets', setId), {
          sheetIds: [...currentSheetIds, sheetId],
          updatedAt: serverTimestamp(),
        });
      }
    },
    []
  );

  // Retirer une grille d'un set
  const removeSheetFromSet = useCallback(
    async (setId: string, sheetId: string) => {
      const db = getDb();
      const setDoc = await getDoc(doc(db, 'sets', setId));
      if (!setDoc.exists()) return;

      const currentSheetIds = (setDoc.data().sheetIds as string[]) || [];
      await updateDoc(doc(db, 'sets', setId), {
        sheetIds: currentSheetIds.filter((id) => id !== sheetId),
        updatedAt: serverTimestamp(),
      });
    },
    []
  );

  // Réordonner les grilles dans un set
  const reorderSheets = useCallback(
    async (setId: string, sheetIds: string[]) => {
      const db = getDb();
      await updateDoc(doc(db, 'sets', setId), {
        sheetIds,
        updatedAt: serverTimestamp(),
      });
    },
    []
  );

  return {
    sets,
    isLoading,
    createSet,
    updateSet,
    deleteSet,
    addSheetToSet,
    removeSheetFromSet,
    reorderSheets,
  };
}

// Hook pour charger un set spécifique avec ses grilles
interface UseSetReturn {
  set: Set | null;
  sheets: Sheet[];
  isLoading: boolean;
  error: string | null;
}

export function useSet(setId: string | undefined): UseSetReturn {
  const [set, setSet] = useState<Set | null>(null);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!setId) {
      setIsLoading(false);
      return;
    }

    const db = getDb();

    const unsubscribe = onSnapshot(
      doc(db, 'sets', setId),
      async (docSnap) => {
        if (!docSnap.exists()) {
          setError('Set non trouvé');
          setIsLoading(false);
          return;
        }

        const setData = setFromFirestore(docSnap.id, docSnap.data());
        setSet(setData);

        // Charger les grilles du set
        if (setData.sheetIds.length > 0) {
          const sheetsPromises = setData.sheetIds.map(async (sheetId) => {
            const sheetDoc = await getDoc(doc(db, 'sheets', sheetId));
            if (sheetDoc.exists()) {
              return fromFirestore(sheetDoc.id, sheetDoc.data());
            }
            return null;
          });

          const loadedSheets = (await Promise.all(sheetsPromises)).filter(
            (s): s is Sheet => s !== null
          );

          // Garder l'ordre du set
          const orderedSheets = setData.sheetIds
            .map((id) => loadedSheets.find((s) => s.id === id))
            .filter((s): s is Sheet => s !== undefined);

          setSheets(orderedSheets);
        } else {
          setSheets([]);
        }

        setIsLoading(false);
      },
      (err) => {
        console.error('Error loading set:', err);
        setError('Erreur lors du chargement');
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [setId]);

  return { set, sheets, isLoading, error };
}
