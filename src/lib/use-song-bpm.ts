'use client';

import { useState, useEffect } from 'react';

// Cache mémoire (déduplique dans la session).
const MEM = new Map<string, { tempo: number | null; key: string | null }>();

// Récupère BPM + tonalité (GetSongBPM via /api/songbpm) pour un couple artiste/titre.
// N'interroge que si les DEUX sont fournis (l'éditeur passe des valeurs figées au blur).
export function useSongBpm(artist: string | undefined, title: string | undefined) {
  const [tempo, setTempo] = useState<number | null>(null);
  const [songKey, setSongKey] = useState<string | null>(null);
  /**
   * La requête passe par un proxy et met 5 à 8 secondes. Sans état visible, on croit
   * que rien ne se passe et on remplit les champs à la main — c'était le cas.
   */
  const [searching, setSearching] = useState(false);
  /** Recherche terminée sans résultat : le service ne couvre pas tout. */
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!artist?.trim() || !title?.trim()) {
      setTempo(null); setSongKey(null); setSearching(false); setNotFound(false);
      return;
    }
    const cacheKey = `${title}|${artist}`.toLowerCase();

    if (MEM.has(cacheKey)) {
      const c = MEM.get(cacheKey)!;
      setTempo(c.tempo); setSongKey(c.key);
      setSearching(false); setNotFound(c.tempo == null && c.key == null);
      return;
    }

    let cancelled = false;
    setSearching(true);
    setNotFound(false);
    // v=2 : buste les anciennes réponses vides mises en cache avant que le proxy marche.
    fetch(`/api/songbpm?v=2&title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`)
      .then((r) => (r.ok ? r.json() : { tempo: null, key: null }))
      .then((d: { tempo: number | null; key: string | null }) => {
        MEM.set(cacheKey, { tempo: d.tempo ?? null, key: d.key ?? null });
        if (cancelled) return;
        setTempo(d.tempo ?? null);
        setSongKey(d.key ?? null);
        setNotFound(d.tempo == null && !d.key);
      })
      .catch(() => { if (!cancelled) { setTempo(null); setSongKey(null); setNotFound(true); } })
      .finally(() => { if (!cancelled) setSearching(false); });

    return () => { cancelled = true; };
  }, [artist, title]);

  return { tempo, songKey, searching, notFound };
}
