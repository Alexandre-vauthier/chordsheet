'use client';

import { useState, useEffect, useRef } from 'react';

type ArtworkData = { artworkUrl: string | null; previewUrl: string | null; trackUrl: string | null; year: number | null; genre: string | null };

// Cache mémoire (déduplique les requêtes dans la même session)
const MEM_CACHE = new Map<string, ArtworkData>();

/**
 * Cache `localStorage`, sept jours, versionné par son préfixe.
 *
 * Changer de préfixe périme tout : c'est ce qu'il faut faire dès que la réponse
 * gagne un champ, sinon les entrées déjà en cache restent servies **sans lui** et le
 * manque paraît venir de la base.
 *
 * - v10 : table de correspondance des genres élargie (Alternative, Indie…).
 * - v11 : `trackUrl` (fiche Apple Music). Sans ce bump, une pochette déjà consultée
 *   revenait sans lien, et la page affichait « via iTunes » au lieu du lien —
 *   d'autant plus visible que ce sont les morceaux les plus vus qui étaient en
 *   cache. Rien à reprendre côté serveur : nous ne stockons pas ces données.
 * - v12 : la recherche interroge iTunes par artiste puis titre, et vérifie que le
 *   résultat retenu est du bon artiste. Les entrées d'avant portent donc parfois
 *   la pochette d'une reprise, pour une clé qui n'est plus composée pareil.
 */
const LS_PREFIX = 'artwork12_';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Les entrées des versions précédentes, effacées une fois par session.
 *
 * Changer de préfixe périme, mais n'efface pas : les anciennes entrées restaient
 * dans le stockage jusqu'à saturation du quota, et la clé change ici de
 * composition — aucune ne sera jamais relue.
 */
let purge = false;
function purgerAnciennesVersions() {
  if (purge) return;
  purge = true;
  try {
    const morts = Object.keys(localStorage).filter((k) => k.startsWith('artwork') && !k.startsWith(LS_PREFIX));
    for (const k of morts) localStorage.removeItem(k);
  } catch { /* stockage indisponible */ }
}

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

async function fetchArtwork(artist: string | undefined, title: string | undefined): Promise<ArtworkData> {
  const params = new URLSearchParams();
  if (artist) params.set('artist', artist);
  if (title) params.set('title', title);
  try {
    // Les deux champs séparément, et non la clé concaténée : c'est ce qui permet
    // au serveur de vérifier que le résultat retenu est bien du bon artiste.
    const res = await fetch(`/api/artwork?${params}`);
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
  // L'artiste d'abord. Mesuré sur 28 grilles du catalogue : cet ordre ne perd
  // jamais contre l'inverse, et redresse les morceaux qu'une reprise a rendus plus
  // célèbres que l'original — « La Vie En Rose » ramenait Louis Armstrong.
  return [artist, title].filter(Boolean).join(' ').trim();
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
    purgerAnciennesVersions();
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

    fetchArtwork(artist, title).then((result) => {
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
