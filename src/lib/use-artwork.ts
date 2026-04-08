import { useState, useEffect } from 'react';

const CACHE = new Map<string, string | null>();

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

    // Cache hit
    if (CACHE.has(query)) {
      setUrl(CACHE.get(query) ?? null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const encoded = encodeURIComponent(query);
    fetch(`https://itunes.apple.com/search?term=${encoded}&entity=song&limit=1`)
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        const result = data.results?.[0];
        if (result?.artworkUrl100) {
          // Upscale à 600×600
          const hd = result.artworkUrl100.replace('100x100', '600x600');
          CACHE.set(query, hd);
          setUrl(hd);
        } else {
          CACHE.set(query, null);
          setUrl(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          CACHE.set(query, null);
          setUrl(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [artist, title]);

  return { artworkUrl: url, loading };
}
