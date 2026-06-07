'use client';

import { useState, useEffect } from 'react';

// Cache mémoire (déduplique les requêtes dans la même session)
const MEM_CACHE = new Map<string, { artworkUrl: string | null; previewUrl: string | null }>();

// Cache localStorage (persiste entre sessions, TTL 30 jours)
const LS_PREFIX = 'itunes5_'; // préfixe v5 : toujours entity=song pour artwork
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

// File d'attente pour limiter les requêtes iTunes simultanées
const QUEUE: Array<() => Promise<void>> = [];
let activeCount = 0;
const MAX_CONCURRENT = 8;

function enqueue(task: () => Promise<void>) {
  QUEUE.push(task);
  drainQueue();
}

async function drainQueue() {
  if (activeCount >= MAX_CONCURRENT || QUEUE.length === 0) return;
  activeCount++;
  const task = QUEUE.shift()!;
  try {
    await task();
  } finally {
    activeCount--;
    drainQueue();
  }
}

function lsGetRaw(prefix: string, key: string): { artworkUrl: string | null; previewUrl: string | null } | undefined {
  try {
    const raw = localStorage.getItem(prefix + key);
    if (!raw) return undefined;
    const { data, expires } = JSON.parse(raw) as {
      data: { artworkUrl: string | null; previewUrl: string | null };
      expires: number;
    };
    if (Date.now() > expires) { localStorage.removeItem(prefix + key); return undefined; }
    return data;
  } catch { return undefined; }
}

function lsGet(key: string): { artworkUrl: string | null; previewUrl: string | null } | undefined {
  const current = lsGetRaw(LS_PREFIX, key);
  if (current !== undefined) return current;
  // Fallback v4 : entrées valides (non-null) conservées
  const prev = lsGetRaw('itunes4_', key);
  if (prev !== undefined && prev.artworkUrl !== null) return prev;
  return undefined;
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
  expectedTitle?: string,
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
      const previewOk = !expectedTitle || !result?.trackName || titleMatches(expectedTitle, result.trackName);
      resolve({
        artworkUrl: art ? art.replace('100x100', '600x600') : null,
        previewUrl: previewOk ? (result?.previewUrl ?? null) : null,
      });
    };

    script.src = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=1&callback=${cb}`;
    script.onerror = () => { cleanup(); resolve({ artworkUrl: null, previewUrl: null }); };

    // Timeout 8s (plus généreux pour les requêtes en file)
    setTimeout(() => { cleanup(); resolve({ artworkUrl: null, previewUrl: null }); }, 8000);

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

// Callbacks enregistrés pour éviter les doublons de requêtes en vol
const IN_FLIGHT = new Map<string, Array<(result: { artworkUrl: string | null; previewUrl: string | null }) => void>>();

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

    // 3. Si une requête est déjà en vol pour cette clé, on s'y accroche
    if (IN_FLIGHT.has(query)) {
      IN_FLIGHT.get(query)!.push((result) => {
        if (!cancelled) {
          setArtworkUrl(result.artworkUrl);
          setPreviewUrl(result.previewUrl);
          setLoading(false);
        }
      });
      return () => { cancelled = true; };
    }

    // 4. Nouvelle requête — passe par la file d'attente
    IN_FLIGHT.set(query, []);

    enqueue(async () => {
      const result = await fetchItunes(query, title || undefined);

      // Fallback MusicBrainz si iTunes échoue et qu'on a artiste + titre
      if (!result.artworkUrl && artist && title) {
        result.artworkUrl = await fetchMusicBrainz(artist, title);
      }

      MEM_CACHE.set(query, result);
      // Ne persiste que les résultats avec un vrai artwork — les null seront retentés à la prochaine session
      if (result.artworkUrl) lsSet(query, result);

      // Notifie tous les composants qui attendaient ce résultat
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
