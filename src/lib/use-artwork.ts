'use client';

import { useState, useEffect, useRef } from 'react';

type ArtworkData = { artworkUrl: string | null; previewUrl: string | null; trackUrl: string | null; year: number | null; genre: string | null };

// Cache mémoire (déduplique les requêtes dans la même session)
const MEM_CACHE = new Map<string, ArtworkData>();

// Cache localStorage (persiste entre sessions, TTL 7 jours)
// v10 : table de correspondance des genres élargie (Alternative, Indie…). Bump pour
// re-fetch et re-mapper les entrées en cache (sinon genre null conservé).
const LS_PREFIX = 'artwork10_';
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
  if (!data.artworkUrl && !data.previewUrl && !data.trackUrl && data.year == null && !data.genre) return;
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify({ data, expires: Date.now() + TTL_MS }));
  } catch { /* quota dépassé */ }
}

async function fetchArtwork(query: string): Promise<ArtworkData> {
  try {
    const res = await fetch(`/api/artwork?q=${encodeURIComponent(query)}`);
    if (!res.ok) return { artworkUrl: null, previewUrl: null, trackUrl: null, year: null, genre: null };
    return await res.json();
  } catch {
    return { artworkUrl: null, previewUrl: null, trackUrl: null, year: null, genre: null };
  }
}

/**
 * La clé d'une recherche, telle que le hook la construit.
 *
 * Exportée pour que l'appelant puisse comparer ce qu'il attend à ce que le hook
 * décrit, sans avoir à deviner la règle de composition.
 */
export function artworkKey(artist: string | undefined, title: string | undefined): string {
  return [title, artist].filter(Boolean).join(' ').trim();
}

export function useArtwork(artist: string | undefined, title: string | undefined) {
  const [artworkUrl, setArtworkUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [trackUrl, setTrackUrl] = useState<string | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [genre, setGenre] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  /**
   * Recherche à laquelle correspondent les valeurs rendues, `null` tant qu'elles ne
   * décrivent rien.
   *
   * Vider l'état au changement de morceau ne suffisait pas : l'appelant lit ses
   * valeurs dans le rendu **où le changement est demandé**, avant que le moindre
   * effet n'ait tourné. Il voyait donc encore l'extrait précédent, sans aucun moyen
   * de le savoir. En rendant la clé à côté des valeurs, il peut vérifier qu'elles
   * parlent bien du morceau qu'il affiche — les deux viennent du même rendu.
   */
  const [key, setKey] = useState<string | null>(null);
  /**
   * Morceau auquel se rapportent les valeurs affichées.
   *
   * Sans cette trace, changer de morceau laissait les anciennes valeurs en place
   * jusqu'à l'arrivée des nouvelles : le temps d'un rendu, la pochette et surtout
   * **l'extrait** appartenaient encore au morceau précédent. Un écran qui enchaîne
   * les morceaux relançait donc celui qu'il venait de quitter.
   */
  const requeteAppliquee = useRef<string | null>(null);

  useEffect(() => {
    const vider = () => {
      setArtworkUrl(null); setPreviewUrl(null); setTrackUrl(null); setYear(null); setGenre(null);
      setKey(null);
    };

    if (!artist && !title) { requeteAppliquee.current = null; vider(); setLoading(false); return; }

    const query = artworkKey(artist, title);
    if (!query) { requeteAppliquee.current = null; vider(); setLoading(false); return; }

    // Nouveau morceau : on efface avant de chercher, et on se déclare en attente.
    // L'appelant sait ainsi que « pas d'extrait » veut dire « pas encore » et non
    // « aucun », ce qui n'appelle pas la même conduite.
    if (requeteAppliquee.current !== query) {
      requeteAppliquee.current = query;
      vider();
      setLoading(true);
    }

    const apply = (d: ArtworkData) => {
      setArtworkUrl(d.artworkUrl); setPreviewUrl(d.previewUrl); setTrackUrl(d.trackUrl ?? null);
      setYear(d.year ?? null); setGenre(d.genre ?? null); setLoading(false); setKey(query);
    };

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

  return { artworkUrl, previewUrl, trackUrl, year, genre, loading, key };
}
