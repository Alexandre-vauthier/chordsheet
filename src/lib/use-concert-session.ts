'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { getDb } from './firebase';
import { useAuth } from './auth-context';

interface UseConcertSessionReturn {
  currentIndex: number;
  isSynced: boolean;
  goToSheet: (index: number) => Promise<void>;
}

export function useConcertSession(
  setId: string | undefined,
  groupId: string | undefined
): UseConcertSessionReturn {
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSynced, setIsSynced] = useState(false);
  // Évite de réécrire dans Firestore la mise à jour qu'on vient de recevoir
  const pendingRef = useRef(false);

  useEffect(() => {
    if (!setId || !groupId || !user) return;
    const db = getDb();
    const sessionRef = doc(db, 'concertSessions', setId);

    const unsub = onSnapshot(sessionRef, (snap) => {
      if (snap.exists() && !pendingRef.current) {
        setCurrentIndex(snap.data().currentSheetIndex as number);
      }
      setIsSynced(true);
      pendingRef.current = false;
    }, () => {
      setIsSynced(false);
    });

    return unsub;
  }, [setId, groupId, user]);

  const goToSheet = useCallback(async (index: number) => {
    if (!setId || !groupId || !user) return;
    pendingRef.current = true;
    setCurrentIndex(index);
    const db = getDb();
    await setDoc(doc(db, 'concertSessions', setId), {
      groupId,
      setId,
      currentSheetIndex: index,
      updatedBy: user.id,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }, [setId, groupId, user]);

  return { currentIndex, isSynced, goToSheet };
}
