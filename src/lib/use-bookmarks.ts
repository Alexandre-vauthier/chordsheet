'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { getDb } from './firebase';
import { fromFirestore } from './firestore-helpers';
import type { Sheet } from '@/types';

interface UseBookmarksReturn {
  bookmarkedSheetIds: string[];
  bookmarkedSheets: Sheet[];
  isLoading: boolean;
  isBookmarked: (sheetId: string) => boolean;
  addBookmark: (sheetId: string) => Promise<void>;
  removeBookmark: (sheetId: string) => Promise<void>;
  toggleBookmark: (sheetId: string) => Promise<void>;
}

export function useBookmarks(userId: string | undefined): UseBookmarksReturn {
  const [bookmarkedSheetIds, setBookmarkedSheetIds] = useState<string[]>([]);
  const [bookmarkedSheets, setBookmarkedSheets] = useState<Sheet[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Charger les bookmarks de l'utilisateur en temps réel
  useEffect(() => {
    if (!userId) {
      setBookmarkedSheetIds([]);
      setBookmarkedSheets([]);
      setIsLoading(false);
      return;
    }

    const db = getDb();
    const bookmarksQuery = query(
      collection(db, 'bookmarks'),
      where('userId', '==', userId)
    );

    const unsubscribe = onSnapshot(bookmarksQuery, async (snapshot) => {
      const sheetIds = snapshot.docs.map((doc) => doc.data().sheetId as string);
      setBookmarkedSheetIds(sheetIds);

      // Charger les détails des sheets bookmarkées
      if (sheetIds.length > 0) {
        const sheetsPromises = sheetIds.map(async (sheetId) => {
          try {
            const sheetDoc = await getDoc(doc(db, 'sheets', sheetId));
            if (sheetDoc.exists()) {
              return fromFirestore(sheetDoc.id, sheetDoc.data());
            }
          } catch (error) {
            console.error('Error loading sheet:', sheetId, error);
          }
          return null;
        });

        const sheets = (await Promise.all(sheetsPromises)).filter(
          (s): s is Sheet => s !== null
        );
        setBookmarkedSheets(sheets);
      } else {
        setBookmarkedSheets([]);
      }

      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  const isBookmarked = useCallback(
    (sheetId: string) => bookmarkedSheetIds.includes(sheetId),
    [bookmarkedSheetIds]
  );

  const addBookmark = useCallback(
    async (sheetId: string) => {
      if (!userId) return;

      const db = getDb();
      await addDoc(collection(db, 'bookmarks'), {
        userId,
        sheetId,
        addedAt: serverTimestamp(),
      });
    },
    [userId]
  );

  const removeBookmark = useCallback(
    async (sheetId: string) => {
      if (!userId) return;

      const db = getDb();
      const bookmarksQuery = query(
        collection(db, 'bookmarks'),
        where('userId', '==', userId),
        where('sheetId', '==', sheetId)
      );

      const snapshot = await getDocs(bookmarksQuery);
      const deletePromises = snapshot.docs.map((docSnapshot) =>
        deleteDoc(doc(db, 'bookmarks', docSnapshot.id))
      );
      await Promise.all(deletePromises);
    },
    [userId]
  );

  const toggleBookmark = useCallback(
    async (sheetId: string) => {
      if (isBookmarked(sheetId)) {
        await removeBookmark(sheetId);
      } else {
        await addBookmark(sheetId);
      }
    },
    [isBookmarked, addBookmark, removeBookmark]
  );

  return {
    bookmarkedSheetIds,
    bookmarkedSheets,
    isLoading,
    isBookmarked,
    addBookmark,
    removeBookmark,
    toggleBookmark,
  };
}
