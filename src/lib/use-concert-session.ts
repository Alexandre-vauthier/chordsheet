'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, onSnapshot, setDoc, updateDoc, serverTimestamp, deleteField, Timestamp } from 'firebase/firestore';
import { getDb } from './firebase';
import { useAuth } from './auth-context';

export interface AutoScrollState {
  startTimeMs: number;
  sheetIndex: number;
  bpm: number;
}

interface UseConcertSessionReturn {
  currentIndex: number;
  isSynced: boolean;
  goToSheet: (index: number) => Promise<void>;
  autoScroll: AutoScrollState | null;
  startAutoScroll: (sheetIndex: number, bpm: number) => Promise<void>;
  stopAutoScroll: () => Promise<void>;
}

export function useConcertSession(
  setId: string | undefined,
  groupId: string | undefined
): UseConcertSessionReturn {
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSynced, setIsSynced] = useState(false);
  const [autoScroll, setAutoScroll] = useState<AutoScrollState | null>(null);
  // Évite de réécrire dans Firestore la mise à jour qu'on vient de recevoir
  const pendingRef = useRef(false);

  useEffect(() => {
    if (!setId || !groupId || !user) return;
    const db = getDb();
    const sessionRef = doc(db, 'concertSessions', setId);

    const unsub = onSnapshot(sessionRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (!pendingRef.current) {
          setCurrentIndex(data.currentSheetIndex as number);
        }
        const as = data.autoScroll as { startTime: Timestamp; sheetIndex: number; bpm: number } | undefined;
        if (as?.startTime) {
          setAutoScroll({ startTimeMs: as.startTime.toMillis(), sheetIndex: as.sheetIndex, bpm: as.bpm });
        } else {
          setAutoScroll(null);
        }
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

  const startAutoScroll = useCallback(async (sheetIndex: number, bpm: number) => {
    if (!setId || !groupId || !user) return;
    const db = getDb();
    await setDoc(doc(db, 'concertSessions', setId), {
      groupId,
      setId,
      currentSheetIndex: sheetIndex,
      autoScroll: { startTime: serverTimestamp(), sheetIndex, bpm },
      updatedBy: user.id,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }, [setId, groupId, user]);

  const stopAutoScroll = useCallback(async () => {
    if (!setId || !user) return;
    const db = getDb();
    await updateDoc(doc(db, 'concertSessions', setId), {
      autoScroll: deleteField(),
      updatedBy: user.id,
      updatedAt: serverTimestamp(),
    });
  }, [setId, user]);

  return { currentIndex, isSynced, goToSheet, autoScroll, startAutoScroll, stopAutoScroll };
}
