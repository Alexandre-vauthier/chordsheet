'use client';

import { useState, useEffect } from 'react';

// Cache mémoire (déduplique dans la session).
const MEM = new Map<string, { tempo: number | null; key: string | null }>();

// Récupère BPM + tonalité (GetSongBPM via /api/songbpm) pour un couple artiste/titre.
// N'interroge que si les DEUX sont fournis (l'éditeur passe des valeurs figées au blur).
export function useSongBpm(artist: string | undefined, title: string | undefined) {
  const [tempo, setTempo] = useState<number | null>(null);
  const [songKey, setSongKey] = useState<string | null>(null);

  useEffect(() => {
    if (!artist?.trim() || !title?.trim()) { setTempo(null); setSongKey(null); return; }
    const cacheKey = `${title}|${artist}`.toLowerCase();

    if (MEM.has(cacheKey)) {
      const c = MEM.get(cacheKey)!;
      setTempo(c.tempo); setSongKey(c.key);
      return;
    }

    let cancelled = false;
    // v=2 : buste les anciennes réponses vides mises en cache avant que le proxy marche.
    fetch(`/api/songbpm?v=2&title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`)
      .then((r) => (r.ok ? r.json() : { tempo: null, key: null }))
      .then((d: { tempo: number | null; key: string | null }) => {
        MEM.set(cacheKey, { tempo: d.tempo ?? null, key: d.key ?? null });
        if (!cancelled) { setTempo(d.tempo ?? null); setSongKey(d.key ?? null); }
      })
      .catch(() => { if (!cancelled) { setTempo(null); setSongKey(null); } });

    return () => { cancelled = true; };
  }, [artist, title]);

  return { tempo, songKey };
}
