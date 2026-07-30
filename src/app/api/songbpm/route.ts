import { NextRequest, NextResponse } from 'next/server';
import { normalizeKey } from '@/lib/songbpm-key';

export const dynamic = 'force-dynamic';

const API = 'https://api.getsongbpm.com';

// GetSongBPM est derrière Cloudflare : une requête serveur sans User-Agent réaliste
// est souvent bloquée (réponse HTML non-JSON). On en envoie un.
const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pick(obj: any, ...keys: string[]): unknown {
  if (!obj) return undefined;
  for (const k of keys) if (obj[k] != null) return obj[k];
  return undefined;
}

// Récupère BPM + tonalité d'un morceau via GetSongBPM (clé serveur GETSONGBPM_API_KEY).
// La recherche ne porte pas toujours le tempo/la clé : on complète par un appel détail
// (/song/?id=). ?debug=1 renvoie les réponses brutes pour diagnostiquer le format.
export async function GET(req: NextRequest) {
  const title = (req.nextUrl.searchParams.get('title') || '').trim();
  const artist = (req.nextUrl.searchParams.get('artist') || '').trim();
  const debug = req.nextUrl.searchParams.get('debug') === '1';
  const apiKey = process.env.GETSONGBPM_API_KEY;

  if (!apiKey) {
    return NextResponse.json(debug ? { error: 'GETSONGBPM_API_KEY absente' } : { tempo: null, key: null });
  }
  if (!title || !artist) {
    return NextResponse.json({ tempo: null, key: null });
  }

  try {
    const lookup = `song:${title} artist:${artist}`;
    const searchUrl = `${API}/search/?api_key=${encodeURIComponent(apiKey)}&type=both&lookup=${encodeURIComponent(lookup)}`;
    const res = await fetch(searchUrl, { headers: FETCH_HEADERS, next: { revalidate: 86400 } });
    const searchText = await res.text().catch(() => '');
    let searchRaw: unknown = null;
    try { searchRaw = JSON.parse(searchText); } catch { /* corps non-JSON */ }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const first = Array.isArray((searchRaw as any)?.search) ? (searchRaw as any).search[0] : null;
    const id = pick(first, 'id', 'song_id');
    let tempoRaw = pick(first, 'tempo', 'song_tempo');
    let keyRaw = pick(first, 'key_of', 'key', 'song_key');

    let detailRaw: unknown = null;
    if (id && (tempoRaw == null || keyRaw == null)) {
      const dRes = await fetch(`${API}/song/?api_key=${encodeURIComponent(apiKey)}&id=${encodeURIComponent(String(id))}`, { headers: FETCH_HEADERS, next: { revalidate: 86400 } });
      detailRaw = await dRes.json().catch(() => null);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const song = pick(detailRaw as any, 'song') ?? detailRaw;
      if (tempoRaw == null) tempoRaw = pick(song, 'tempo', 'song_tempo');
      if (keyRaw == null) keyRaw = pick(song, 'key_of', 'key', 'song_key');
    }

    const tempoNum = Number(tempoRaw);
    const tempo = Number.isFinite(tempoNum) && tempoNum >= 30 && tempoNum <= 320 ? Math.round(tempoNum) : null;
    const key = normalizeKey(keyRaw);

    if (debug) {
      return NextResponse.json({
        searchStatus: res.status,
        searchTextSnippet: searchText.slice(0, 400),
        id, tempoRaw, keyRaw, tempo, key,
        searchRaw, detailRaw,
      });
    }
    return NextResponse.json(
      { tempo, key },
      { headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=86400' } }
    );
  } catch (e) {
    if (debug) return NextResponse.json({ error: String(e) });
    return NextResponse.json({ tempo: null, key: null });
  }
}
