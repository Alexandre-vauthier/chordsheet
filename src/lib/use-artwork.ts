'use client';

import { useState, useEffect } from 'react';

type ArtworkData = { artworkUrl: string | null; previewUrl: string | null; year: number | null; genre: string | null };

// Cache mémoire (déduplique les requêtes dans la même session)
const MEM_CACHE = new Map<string, ArtworkData>();

// Cache localStorage (persiste entre sessions, TTL 7 jours)
// v9 : ajout du genre (mappé depuis primaryGenreName iTunes). Bump du préfixe pour
// re-fetch avec la nouvelle donnée.
const LS_PREFIX = 'artwork9_';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Requêtes en vol — évite de tirer deux fois la même clé simultanément
const IN_FLIGHT = new Map<string, Array<(r: ArtworkData) => void>>();

function lsGet(key: string): ArtworkData | undefined {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (!raw) return undefined;
    const { data, expires } = JSON.parse(raw) as { data: ArtworkData; expires: number };
    if (Date.now() > expires) { localStorage.removeItem(LS_PREFIX + key); return undefined; }
    return data;
  } catch { return undefined; }
}

function lsSet(key: string, data: ArtworkData) {
  // Ne persiste que les vrais résultats
  if (!data.artworkUrl && !data.previewUrl && data.year == null && !data.genre) return;
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify({ data, expires: Date.now() + TTL_MS }));
  } catch { /* quota dépassé */ }
}

async function fetchArtwork(query: string): Promise<ArtworkData> {
  try {
    const res = await fetch(`/api/artwork?q=${encodeURIComponent(query)}`);
    if (!res.ok) return { artworkUrl: null, previewUrl: null, year: null, genre: null };
    return await res.json();
  } catch {
    return { artworkUrl: null, previewUrl: null, year: null, genre: null };
  }
}

export function useArtwork(artist: string | undefined, title: string | undefined) {
  const [artworkUrl, setArtworkUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [genre, setGenre] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!artist && !title) { setArtworkUrl(null); setPreviewUrl(null); setYear(null); setGenre(null); return; }

    const query = [title, artist].filter(Boolean).join(' ').trim();
    if (!query) { setArtworkUrl(null); setPreviewUrl(null); setYear(null); setGenre(null); return; }

    const apply = (d: ArtworkData) => { setArtworkUrl(d.artworkUrl); setPreviewUrl(d.previewUrl); setYear(d.year ?? null); setGenre(d.genre ?? null); };

    // 1. Cache mémoire
    if (MEM_CACHE.has(query)) {
      apply(MEM_CACHE.get(query)!);
      return;
    }

    // 2. Cache localStorage
    const cached = lsGet(query);
    if (cached !== undefined) {
      MEM_CACHE.set(query, cached);
      apply(cached);
      return;
    }

    let cancelled = false;
    setLoading(true);

    // 3. Requête déjà en vol — s'y raccrocher
    if (IN_FLIGHT.has(query)) {
      IN_FLIGHT.get(query)!.push((result) => {
        if (!cancelled) { apply(result); setLoading(false); }
      });
      return () => { cancelled = true; };
    }

    // 4. Nouvelle requête via l'API route (pas de JSONP, pas de rate limit client)
    IN_FLIGHT.set(query, []);

    fetchArtwork(query).then((result) => {
      MEM_CACHE.set(query, result);
      lsSet(query, result);

      const waiters = IN_FLIGHT.get(query) ?? [];
      IN_FLIGHT.delete(query);
      for (const cb of waiters) cb(result);

      if (!cancelled) {
        apply(result);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [artist, title]);

  return { artworkUrl, previewUrl, year, genre, loading };
}
