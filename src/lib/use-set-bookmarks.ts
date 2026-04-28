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
import type { Set } from '@/types';

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

interface UseSetBookmarksReturn {
  bookmarkedSetIds: string[];
  bookmarkedSets: Set[];
  isLoading: boolean;
  isBookmarked: (setId: string) => boolean;
  addBookmark: (setId: string) => Promise<void>;
  removeBookmark: (setId: string) => Promise<void>;
  toggleBookmark: (setId: string) => Promise<void>;
}

export function useSetBookmarks(userId: string | undefined): UseSetBookmarksReturn {
  const [bookmarkedSetIds, setBookmarkedSetIds] = useState<string[]>([]);
  const [bookmarkedSets, setBookmarkedSets] = useState<Set[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setBookmarkedSetIds([]);
      setBookmarkedSets([]);
      setIsLoading(false);
      return;
    }

    const db = getDb();
    const q = query(collection(db, 'setBookmarks'), where('userId', '==', userId));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const setIds = snapshot.docs.map(d => d.data().setId as string);
      setBookmarkedSetIds(setIds);

      if (setIds.length > 0) {
        const setPromises = setIds.map(async (setId) => {
          try {
            const setDoc = await getDoc(doc(db, 'sets', setId));
            if (setDoc.exists()) {
              return setFromFirestore(setDoc.id, setDoc.data() as Record<string, unknown>);
            }
          } catch {
            return null;
          }
          return null;
        });
        const sets = (await Promise.all(setPromises)).filter((s): s is Set => s !== null);
        setBookmarkedSets(sets);
      } else {
        setBookmarkedSets([]);
      }

      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  const isBookmarked = useCallback(
    (setId: string) => bookmarkedSetIds.includes(setId),
    [bookmarkedSetIds]
  );

  const addBookmark = useCallback(
    async (setId: string) => {
      if (!userId) return;
      const db = getDb();
      await addDoc(collection(db, 'setBookmarks'), {
        userId,
        setId,
        addedAt: serverTimestamp(),
      });
    },
    [userId]
  );

  const removeBookmark = useCallback(
    async (setId: string) => {
      if (!userId) return;
      const db = getDb();
      const q = query(
        collection(db, 'setBookmarks'),
        where('userId', '==', userId),
        where('setId', '==', setId)
      );
      const snapshot = await getDocs(q);
      await Promise.all(snapshot.docs.map(d => deleteDoc(doc(db, 'setBookmarks', d.id))));
    },
    [userId]
  );

  const toggleBookmark = useCallback(
    async (setId: string) => {
      if (isBookmarked(setId)) {
        await removeBookmark(setId);
      } else {
        await addBookmark(setId);
      }
    },
    [isBookmarked, addBookmark, removeBookmark]
  );

  return {
    bookmarkedSetIds,
    bookmarkedSets,
    isLoading,
    isBookmarked,
    addBookmark,
    removeBookmark,
    toggleBookmark,
  };
}
