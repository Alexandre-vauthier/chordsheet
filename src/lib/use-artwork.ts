'use client';

import { useState, useEffect } from 'react';

// Cache mémoire (déduplique les requêtes dans la même session)
const MEM_CACHE = new Map<string, { artworkUrl: string | null; previewUrl: string | null }>();

// Cache localStorage (persiste entre sessions, TTL 7 jours)
const LS_PREFIX = 'artwork6_';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Requêtes en vol — évite de tirer deux fois la même clé simultanément
const IN_FLIGHT = new Map<string, Array<(r: { artworkUrl: string | null; previewUrl: string | null }) => void>>();

function lsGet(key: string): { artworkUrl: string | null; previewUrl: string | null } | undefined {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (!raw) return undefined;
    const { data, expires } = JSON.parse(raw) as {
      data: { artworkUrl: string | null; previewUrl: string | null };
      expires: number;
    };
    if (Date.now() > expires) { localStorage.removeItem(LS_PREFIX + key); return undefined; }
    return data;
  } catch { return undefined; }
}

function lsSet(key: string, data: { artworkUrl: string | null; previewUrl: string | null }) {
  // Ne persiste que les vrais résultats
  if (!data.artworkUrl && !data.previewUrl) return;
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify({ data, expires: Date.now() + TTL_MS }));
  } catch { /* quota dépassé */ }
}

async function fetchArtwork(query: string): Promise<{ artworkUrl: string | null; previewUrl: string | null }> {
  try {
    const res = await fetch(`/api/artwork?q=${encodeURIComponent(query)}`);
    if (!res.ok) return { artworkUrl: null, previewUrl: null };
    return await res.json();
  } catch {
    return { artworkUrl: null, previewUrl: null };
  }
}

export function useArtwork(artist: string | undefined, title: string | undefined) {
  const [artworkUrl, setArtworkUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!artist && !title) { setArtworkUrl(null); setPreviewUrl(null); return; }

    const query = [title, artist].filter(Boolean).join(' ').trim();
    if (!query) { setArtworkUrl(null); setPreviewUrl(null); return; }

    // 1. Cache mémoire
    if (MEM_CACHE.has(query)) {
      const c = MEM_CACHE.get(query)!;
      setArtworkUrl(c.artworkUrl);
      setPreviewUrl(c.previewUrl);
      return;
    }

    // 2. Cache localStorage
    const cached = lsGet(query);
    if (cached !== undefined) {
      MEM_CACHE.set(query, cached);
      setArtworkUrl(cached.artworkUrl);
      setPreviewUrl(cached.previewUrl);
      return;
    }

    let cancelled = false;
    setLoading(true);

    // 3. Requête déjà en vol — s'y raccrocher
    if (IN_FLIGHT.has(query)) {
      IN_FLIGHT.get(query)!.push((result) => {
        if (!cancelled) { setArtworkUrl(result.artworkUrl); setPreviewUrl(result.previewUrl); setLoading(false); }
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
        setArtworkUrl(result.artworkUrl);
        setPreviewUrl(result.previewUrl);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [artist, title]);

  return { artworkUrl, previewUrl, loading };
}
