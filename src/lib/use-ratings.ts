'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore';
import { getDb } from './firebase';

interface UseRatingsReturn {
  userRating: number | null;
  isLoading: boolean;
  rateSheet: (rating: 1 | 2 | 3 | 4 | 5) => Promise<void>;
}

export function useRatings(sheetId: string | undefined, userId: string | undefined): UseRatingsReturn {
  const [userRating, setUserRating] = useState<number | null>(null);
  const [ratingDocId, setRatingDocId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Charger la note de l'utilisateur pour cette grille
  useEffect(() => {
    if (!sheetId || !userId) {
      setUserRating(null);
      setIsLoading(false);
      return;
    }

    const loadUserRating = async () => {
      try {
        const db = getDb();
        const ratingsQuery = query(
          collection(db, 'ratings'),
          where('userId', '==', userId),
          where('sheetId', '==', sheetId)
        );

        const snapshot = await getDocs(ratingsQuery);
        if (!snapshot.empty) {
          const ratingDoc = snapshot.docs[0];
          setUserRating(ratingDoc.data().rating as number);
          setRatingDocId(ratingDoc.id);
        } else {
          setUserRating(null);
          setRatingDocId(null);
        }
      } catch (error) {
        console.error('Error loading user rating:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserRating();
  }, [sheetId, userId]);

  // Noter une grille (crée ou met à jour la note)
  const rateSheet = useCallback(
    async (rating: 1 | 2 | 3 | 4 | 5) => {
      if (!sheetId || !userId) return;

      const db = getDb();

      try {
        await runTransaction(db, async (transaction) => {
          const sheetRef = doc(db, 'sheets', sheetId);
          const sheetDoc = await transaction.get(sheetRef);

          if (!sheetDoc.exists()) {
            throw new Error('Sheet not found');
          }

          const currentData = sheetDoc.data();
          const currentAverage = (currentData.averageRating as number) || 0;
          const currentCount = (currentData.ratingCount as number) || 0;

          let newAverage: number;
          let newCount: number;

          if (ratingDocId) {
            // Mise à jour d'une note existante
            const oldRating = userRating || 0;
            newCount = currentCount;
            newAverage = currentCount > 0
              ? (currentAverage * currentCount - oldRating + rating) / currentCount
              : rating;

            const ratingRef = doc(db, 'ratings', ratingDocId);
            transaction.update(ratingRef, {
              rating,
              updatedAt: serverTimestamp(),
            });
          } else {
            // Nouvelle note
            newCount = currentCount + 1;
            newAverage = (currentAverage * currentCount + rating) / newCount;

            const ratingsRef = collection(db, 'ratings');
            const newRatingRef = doc(ratingsRef);
            transaction.set(newRatingRef, {
              userId,
              sheetId,
              rating,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            setRatingDocId(newRatingRef.id);
          }

          // Mettre à jour la moyenne sur la grille
          transaction.update(sheetRef, {
            averageRating: Math.round(newAverage * 10) / 10,
            ratingCount: newCount,
          });
        });

        setUserRating(rating);
      } catch (error) {
        console.error('Error rating sheet:', error);
        throw error;
      }
    },
    [sheetId, userId, ratingDocId, userRating]
  );

  return {
    userRating,
    isLoading,
    rateSheet,
  };
}
