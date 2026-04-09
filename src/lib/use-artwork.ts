import { useState, useEffect } from 'react';

// Cache mémoire (déduplique les requêtes dans la même session)
const MEM_CACHE = new Map<string, string | null>();

// Cache localStorage (persiste entre sessions, TTL 30 jours)
const LS_PREFIX = 'artwork_';
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

function lsGet(key: string): string | null | undefined {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (!raw) return undefined;
    const { url, expires } = JSON.parse(raw) as { url: string | null; expires: number };
    if (Date.now() > expires) { localStorage.removeItem(LS_PREFIX + key); return undefined; }
    return url;
  } catch { return undefined; }
}

function lsSet(key: string, url: string | null) {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify({ url, expires: Date.now() + TTL_MS }));
  } catch { /* quota dépassé — ignoré silencieusement */ }
}

// iTunes Search API (JSONP pour éviter CORS)
// entity: 'song' quand on cherche artiste+titre, 'musicArtist' quand artiste seul
function fetchItunes(query: string, entity: 'song' | 'musicArtist' = 'song'): Promise<string | null> {
  return new Promise((resolve) => {
    const cb = `_itunes_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');

    const cleanup = () => {
      delete ((window as unknown) as Record<string, unknown>)[cb];
      script.remove();
    };

    ((window as unknown) as Record<string, unknown>)[cb] = (data: { results?: { artworkUrl100?: string; artistLinkUrl?: string }[] }) => {
      cleanup();
      const art = data.results?.[0]?.artworkUrl100;
      resolve(art ? art.replace('100x100', '600x600') : null);
    };

    script.src = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=${entity}&limit=1&callback=${cb}`;
    script.onerror = () => { cleanup(); resolve(null); };

    // Timeout 5s
    setTimeout(() => { cleanup(); resolve(null); }, 5000);

    document.head.appendChild(script);
  });
}

// MusicBrainz + Cover Art Archive (fallback, supporte CORS)
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

    // Cover Art Archive
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
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!artist && !title) {
      setUrl(null);
      return;
    }

    const query = [artist, title].filter(Boolean).join(' ').trim();
    if (!query) {
      setUrl(null);
      return;
    }

    // 1. Cache mémoire
    if (MEM_CACHE.has(query)) {
      setUrl(MEM_CACHE.get(query) ?? null);
      return;
    }

    // 2. Cache localStorage
    const cached = lsGet(query);
    if (cached !== undefined) {
      MEM_CACHE.set(query, cached);
      setUrl(cached);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const artistOnly = !title && !!artist;

    (async () => {
      // 3. iTunes (JSONP) — musicArtist si artiste seul, song sinon
      let result = await fetchItunes(query, artistOnly ? 'musicArtist' : 'song');

      // 4. Fallback MusicBrainz si iTunes échoue et qu'on a artiste + titre
      if (!result && artist && title) {
        result = await fetchMusicBrainz(artist, title);
      }

      if (!cancelled) {
        MEM_CACHE.set(query, result);
        lsSet(query, result);
        setUrl(result);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [artist, title]);

  return { artworkUrl: url, loading };
}
