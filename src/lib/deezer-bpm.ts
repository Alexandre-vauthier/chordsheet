/**
 * Tempo depuis l'API publique de Deezer.
 *
 * Sans clé, sans quota, et joignable directement depuis un serveur — contrairement à
 * GetSongBPM, qui impose de passer par un proxy payant pour franchir Cloudflare.
 *
 * Les deux sources se complètent plutôt qu'elles ne se doublent : sur l'échantillon
 * testé, Deezer trouvait précisément les titres que GetSongBPM ne connaissait pas, et
 * l'inverse. D'où l'ordre retenu — Deezer d'abord, puisqu'il est gratuit, GetSongBPM
 * en renfort seulement quand il ne rend rien.
 *
 * Deezer ne donne **que** le tempo. La tonalité reste l'affaire de GetSongBPM.
 */

const API = 'https://api.deezer.com';

/** Deezer renvoie `bpm: 0` quand il ne sait pas — ce n'est pas une valeur. */
function usable(bpm: unknown): number | null {
  const n = Number(bpm);
  return Number.isFinite(n) && n >= 30 && n <= 320 ? Math.round(n) : null;
}

export async function fetchDeezerTempo(title: string, artist: string): Promise<number | null> {
  const q = `${title} ${artist}`.trim();
  if (!q) return null;

  try {
    const searchRes = await fetch(`${API}/search?q=${encodeURIComponent(q)}&limit=1`, {
      next: { revalidate: 86400 },
    });
    if (!searchRes.ok) return null;

    const search = await searchRes.json();
    const track = Array.isArray(search?.data) ? search.data[0] : null;
    if (!track?.id) return null;

    // Le tempo n'est pas dans les résultats de recherche, seulement sur la fiche.
    const trackRes = await fetch(`${API}/track/${encodeURIComponent(String(track.id))}`, {
      next: { revalidate: 86400 },
    });
    if (!trackRes.ok) return null;

    const detail = await trackRes.json();
    return usable(detail?.bpm);
  } catch {
    return null;
  }
}
