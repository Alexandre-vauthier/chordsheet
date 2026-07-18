'use client';

import { useEffect, useRef, useState } from 'react';
import { collection, query, where, orderBy, limit, getDocs, type QueryConstraint } from 'firebase/firestore';
import { getDb } from './firebase';
import { fromFirestore } from './firestore-helpers';
import { useAuth } from './auth-context';
import type { Sheet } from '@/types';

// Recherche par préfixe directement en base (remplace l'ancien cache borné à 200/500
// grilles filtré en mémoire) : reste correcte quel que soit le nombre de grilles dans
// le catalogue — pas de fenêtre arbitraire qui finit par exclure des résultats existants
// à mesure que le catalogue grossit. Limite connue : ne trouve que les titres/artistes
// qui COMMENCENT par la requête (portée d'une range query Firestore), pas une recherche
// "contient" — pour ça il faudrait un service tiers type Algolia.
const PREFIX_END = '';
const MAX_TITLE_RESULTS = 4;
const MAX_ARTIST_CANDIDATES = 20;
const MAX_ARTIST_RESULTS = 3;

async function searchByPrefix(
  field: 'titleLower' | 'artistLower',
  q: string,
  isAdmin: boolean,
  max: number
): Promise<Sheet[]> {
  const db = getDb();
  const constraints: QueryConstraint[] = isAdmin
    ? [where(field, '>=', q), where(field, '<=', q + PREFIX_END)]
    : [where('isPublic', '==', true), where(field, '>=', q), where(field, '<=', q + PREFIX_END)];
  const snap = await getDocs(query(collection(db, 'sheets'), ...constraints, orderBy(field), limit(max)));
  return snap.docs.map((d) => fromFirestore(d.id, d.data()));
}

function dedupeNames(sheets: Sheet[], excluding: string | null, max: number): string[] {
  return Array.from(new Set(sheets.map((s) => s.artist?.trim()).filter((a): a is string => !!a)))
    .filter((a) => a.toLowerCase() !== excluding)
    .sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }))
    .slice(0, max);
}

interface SearchSuggestions {
  sheets: Sheet[];
  artistNames: string[];
  // Grilles trouvées par préfixe d'artiste (pas seulement de titre) — utile pour
  // un usage qui a besoin de grilles cliquables directement (ex: banniere de session
  // live), contrairement à `artistNames` qui ne sert qu'à pointer vers /artist/[name].
  sheetsByArtist: Sheet[];
  loading: boolean;
}

// Navbar : suggestions de grilles (titre) + artistes pour une requête donnée.
export function useSearchSuggestions(searchQuery: string): SearchSuggestions {
  const { isAdmin } = useAuth();
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [artistNames, setArtistNames] = useState<string[]>([]);
  const [sheetsByArtist, setSheetsByArtist] = useState<Sheet[]>([]);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 2) {
      setSheets([]);
      setArtistNames([]);
      setSheetsByArtist([]);
      setLoading(false);
      return;
    }
    const id = ++requestId.current;
    setLoading(true);
    Promise.all([
      searchByPrefix('titleLower', q, isAdmin, MAX_TITLE_RESULTS),
      searchByPrefix('artistLower', q, isAdmin, MAX_ARTIST_CANDIDATES),
    ])
      .then(([titleMatches, artistMatches]) => {
        if (id !== requestId.current) return;
        setSheets(titleMatches);
        setArtistNames(dedupeNames(artistMatches, null, MAX_ARTIST_RESULTS));
        setSheetsByArtist(artistMatches);
      })
      .catch(() => {
        if (id === requestId.current) {
          setSheets([]);
          setArtistNames([]);
          setSheetsByArtist([]);
        }
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [searchQuery, isAdmin]);

  return { sheets, artistNames, sheetsByArtist, loading };
}

// Éditeur : suggestions d'orthographe d'artiste déjà utilisée dans le catalogue public,
// pour éviter de fragmenter les pages artiste (égalité stricte sensible à la casse).
export function usePublicArtistSuggestions(artistQuery: string, max = 6): string[] {
  const { isAdmin } = useAuth();
  const [names, setNames] = useState<string[]>([]);
  const requestId = useRef(0);

  useEffect(() => {
    const q = artistQuery.trim().toLowerCase();
    if (q.length < 2) {
      setNames([]);
      return;
    }
    const id = ++requestId.current;
    searchByPrefix('artistLower', q, isAdmin, MAX_ARTIST_CANDIDATES)
      .then((matches) => {
        if (id !== requestId.current) return;
        setNames(dedupeNames(matches, q, max));
      })
      .catch(() => {
        if (id === requestId.current) setNames([]);
      });
  }, [artistQuery, isAdmin, max]);

  return names;
}
