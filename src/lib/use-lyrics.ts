'use client';

import { useEffect, useState } from 'react';

/**
 * Paroles d'une grille, à l'affichage.
 *
 * Deux origines, et la distinction compte : celles que l'auteur a **saisies** sont
 * dans la grille et font foi ; à défaut, on interroge le service externe au moment
 * de l'affichage, sans jamais écrire le résultat.
 *
 * Volontairement côté client : les paroles ne doivent pas partir dans le HTML servi,
 * sans quoi elles seraient indexées.
 */
export function useLyrics(artist: string | undefined, title: string | undefined, stored?: string) {
  const [lyrics, setLyrics] = useState<string | null>(stored?.trim() || null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saisies = stored?.trim();
    if (saisies) { setLyrics(saisies); return; }
    if (!artist?.trim() || !title?.trim()) { setLyrics(null); return; }

    let annule = false;
    setLoading(true);

    fetch(`/api/lyrics?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`)
      .then((r) => r.json())
      .then((d) => { if (!annule) setLyrics(typeof d?.lyrics === 'string' ? d.lyrics : null); })
      .catch(() => { if (!annule) setLyrics(null); })
      .finally(() => { if (!annule) setLoading(false); });

    return () => { annule = true; };
  }, [artist, title, stored]);

  return { lyrics, loading };
}
