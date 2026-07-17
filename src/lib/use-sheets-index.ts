'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { getDb } from './firebase';
import { fromFirestore } from './firestore-helpers';
import type { Sheet } from '@/types';

// Index partagé (cache module-level) des grilles publiques, pour alimenter les
// suggestions de recherche (navbar) et d'artiste (éditeur) sans refaire la requête
// à chaque montage — la navbar est présente sur toutes les pages.
let cachedSheets: Sheet[] | null = null;
let inflight: Promise<Sheet[]> | null = null;

async function loadPublicSheets(): Promise<Sheet[]> {
  if (cachedSheets) return cachedSheets;
  if (!inflight) {
    const db = getDb();
    inflight = getDocs(query(collection(db, 'sheets'), where('isPublic', '==', true), limit(200)))
      .then((snap) => {
        cachedSheets = snap.docs.map((d) => fromFirestore(d.id, d.data()));
        return cachedSheets;
      })
      .catch((err) => {
        inflight = null;
        throw err;
      });
  }
  return inflight;
}

interface UseSheetsIndexReturn {
  sheets: Sheet[];
  artistNames: string[];
  loading: boolean;
}

export function useSheetsIndex(): UseSheetsIndexReturn {
  const [sheets, setSheets] = useState<Sheet[]>(cachedSheets ?? []);
  const [loading, setLoading] = useState(!cachedSheets);

  useEffect(() => {
    if (cachedSheets) return;
    let cancelled = false;
    loadPublicSheets()
      .then((data) => { if (!cancelled) setSheets(data); })
      .catch(() => { /* silencieux : pas de suggestions plutôt qu'une erreur visible */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const artistNames = Array.from(
    new Set(sheets.map((s) => s.artist?.trim()).filter((a): a is string => !!a))
  ).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));

  return { sheets, artistNames, loading };
}
