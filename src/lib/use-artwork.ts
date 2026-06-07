'use client';

import { useState, useEffect } from 'react';

// Cache mémoire (déduplique les requêtes dans la même session)
const MEM_CACHE = new Map<string, { artworkUrl: string | null; previewUrl: string | null }>();

// Cache localStorage (persiste entre sessions, TTL 30 jours)
const LS_PREFIX = 'itunes4_'; // préfixe v4 : titre avant artiste dans la requête
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

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
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify({ data, expires: Date.now() + TTL_MS }));
  } catch { /* quota dépassé — ignoré silencieusement */ }
}

// Vérifie qu'un titre retourné par iTunes correspond au titre attendu
function titleMatches(expected: string, returned: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const a = norm(expected);
  const b = norm(returned);
  return a === b || a.includes(b) || b.includes(a);
}

// iTunes Search API (JSONP pour éviter CORS)
function fetchItunes(
  query: string,
  entity: 'song' | 'musicArtist' = 'song',
  expectedTitle?: string, // si fourni, le previewUrl n'est utilisé que si le titre correspond
): Promise<{ artworkUrl: string | null; previewUrl: string | null }> {
  return new Promise((resolve) => {
    const cb = `_itunes_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');

    const cleanup = () => {
      delete ((window as unknown) as Record<string, unknown>)[cb];
      script.remove();
    };

    ((window as unknown) as Record<string, unknown>)[cb] = (data: {
      results?: { artworkUrl100?: string; previewUrl?: string; trackName?: string }[];
    }) => {
      cleanup();
      const result = data.results?.[0];
      const art = result?.artworkUrl100;
      // Le preview n'est retourné que si le titre iTunes correspond au titre attendu
      const previewOk = !expectedTitle || !result?.trackName || titleMatches(expectedTitle, result.trackName);
      resolve({
        artworkUrl: art ? art.replace('100x100', '600x600') : null,
        previewUrl: previewOk ? (result?.previewUrl ?? null) : null,
      });
    };

    script.src = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=${entity}&limit=1&callback=${cb}`;
    script.onerror = () => { cleanup(); resolve({ artworkUrl: null, previewUrl: null }); };

    // Timeout 5s
    setTimeout(() => { cleanup(); resolve({ artworkUrl: null, previewUrl: null }); }, 5000);

    document.head.appendChild(script);
  });
}

// MusicBrainz + Cover Art Archive (fallback artwork uniquement, pas de preview)
async function fetchMusicBrainz(artist: string, title: string): Promise<string | null> {
  try {
    const q = encodeURIComponent(`recording:"${title}" AND artist:"${artist}"`);
    const res = await fetch(
      `https://musicbrainz.org/ws/2/recording?query=${q}&limit=1&fmt=json`,
      { headers: { 'User-Agent': 'ChordSheet/1.0 (chordsheet.app)' } }
    );
    if (!res.ok) return null;

    const data = await res.json();
    const release = data.recordings?.[0]?.releases?.[0];
    if (!release?.id) return null;

    const coverRes = await fetch(`https://coverartarchive.org/release/${release.id}`);
    if (!coverRes.ok) return null;

    const coverData = await coverRes.json();
    const front = coverData.images?.find((img: { front?: boolean }) => img.front);
    return front?.thumbnails?.large || front?.thumbnails?.small || front?.image || null;
  } catch {
    return null;
  }
}

export function useArtwork(artist: string | undefined, title: string | undefined) {
  const [artworkUrl, setArtworkUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!artist && !title) {
      setArtworkUrl(null);
      setPreviewUrl(null);
      return;
    }

    const query = [title, artist].filter(Boolean).join(' ').trim();
    if (!query) {
      setArtworkUrl(null);
      setPreviewUrl(null);
      return;
    }

    // 1. Cache mémoire
    if (MEM_CACHE.has(query)) {
      const cached = MEM_CACHE.get(query)!;
      setArtworkUrl(cached.artworkUrl);
      setPreviewUrl(cached.previewUrl);
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

    const artistOnly = !title && !!artist;

    (async () => {
      // 3. iTunes (JSONP) — passe le titre attendu pour valider le preview
      const result = await fetchItunes(query, artistOnly ? 'musicArtist' : 'song', title || undefined);

      // 4. Fallback MusicBrainz pour l'artwork si iTunes échoue
      if (!result.artworkUrl && artist && title) {
        result.artworkUrl = await fetchMusicBrainz(artist, title);
      }

      if (!cancelled) {
        MEM_CACHE.set(query, result);
        lsSet(query, result);
        setArtworkUrl(result.artworkUrl);
        setPreviewUrl(result.previewUrl);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [artist, title]);

  return { artworkUrl, previewUrl, loading };
}
