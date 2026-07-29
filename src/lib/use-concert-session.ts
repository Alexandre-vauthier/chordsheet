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
  // Décalage (ms) entre l'horloge locale et l'horloge serveur Firestore.
  // serverNow = Date.now() + serverOffset. Sert de base de temps commune pour
  // que tous les appareils extrapolent la même position sans constante fixe.
  serverOffset: number;
}

// Mesure le décalage entre l'horloge locale et l'horloge serveur Firestore.
// Technique NTP simplifiée : on écrit un serverTimestamp() dans un doc privé,
// on le relit confirmé serveur, et offset = serverMs - milieu(t0, t1).
// On garde l'échantillon au plus petit aller-retour (asymétrie minimale).
async function measureServerOffset(db: ReturnType<typeof getDb>, uid: string): Promise<number | null> {
  const ref = doc(db, 'users', uid, 'private', 'clockProbe');
  const samples: { offset: number; rtt: number }[] = [];

  for (let i = 0; i < 3; i++) {
    const nonce = `${Date.now()}-${i}`;
    const t0 = Date.now();
    try {
      const serverMs = await new Promise<number>((resolve, reject) => {
        const timer = setTimeout(() => { unsub(); reject(new Error('timeout')); }, 4000);
        const unsub = onSnapshot(
          ref,
          { includeMetadataChanges: true },
          (snap) => {
            // On n'accepte que la version confirmée par le serveur de NOTRE écriture (nonce).
            if (snap.metadata.hasPendingWrites || snap.metadata.fromCache) return;
            if (snap.get('n') !== nonce) return;
            const t = snap.get('t') as Timestamp | null;
            if (!t) return;
            clearTimeout(timer);
            unsub();
            resolve(t.toMillis());
          },
          (err) => { clearTimeout(timer); reject(err); }
        );
        setDoc(ref, { t: serverTimestamp(), n: nonce }).catch((e) => { clearTimeout(timer); unsub(); reject(e); });
      });
      const t1 = Date.now();
      samples.push({ offset: serverMs - (t0 + t1) / 2, rtt: t1 - t0 });
    } catch {
      // échantillon ignoré (timeout / offline)
    }
  }

  if (samples.length === 0) return null;
  samples.sort((a, b) => a.rtt - b.rtt);
  return Math.round(samples[0].offset);
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
  // Stabilise la référence autoScroll : ne setState que si les valeurs changent vraiment
  const autoScrollValuesRef = useRef<AutoScrollState | null>(null);
  // Offset horloge locale ↔ serveur (state pour le rendu, ref pour lecture à jour dans les callbacks)
  const [serverOffset, setServerOffset] = useState(0);
  const serverOffsetRef = useRef(0);

  // Mesure l'offset une fois à l'entrée en session de concert (groupe uniquement)
  useEffect(() => {
    if (!user || !setId || !groupId) return;
    let cancelled = false;
    measureServerOffset(getDb(), user.id)
      .then((off) => {
        if (!cancelled && off != null) {
          serverOffsetRef.current = off;
          setServerOffset(off);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user, setId, groupId]);

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
        const as = data.autoScroll as { startTimeMs: number; sheetIndex: number; bpm: number } | undefined;
        if (as?.startTimeMs) {
          const prev = autoScrollValuesRef.current;
          // Ne recréer l'objet (et ne déclencher le useEffect RAF) que si les valeurs changent
          if (!prev || prev.startTimeMs !== as.startTimeMs || prev.sheetIndex !== as.sheetIndex || prev.bpm !== as.bpm) {
            const next: AutoScrollState = { startTimeMs: as.startTimeMs, sheetIndex: as.sheetIndex, bpm: as.bpm };
            autoScrollValuesRef.current = next;
            setAutoScroll(next);
          }
        } else if (autoScrollValuesRef.current !== null) {
          autoScrollValuesRef.current = null;
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
    // startTimeMs en temps serveur : tous les appareils le comparent à leur propre
    // serverNow (= Date.now() + serverOffset), donc l'écart d'horloge s'annule.
    const startTimeMs = Date.now() + serverOffsetRef.current;
    await setDoc(doc(db, 'concertSessions', setId), {
      groupId,
      setId,
      currentSheetIndex: sheetIndex,
      autoScroll: { startTimeMs, sheetIndex, bpm },
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

  return { currentIndex, isSynced, goToSheet, autoScroll, startAutoScroll, stopAutoScroll, serverOffset };
}
