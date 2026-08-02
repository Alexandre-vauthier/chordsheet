import { NextRequest, NextResponse } from 'next/server';
import { normalizeKey } from '@/lib/songbpm-key';
import { readCachedBpm, writeCachedBpm } from '@/lib/songbpm-cache';
import { fetchDeezerTempo } from '@/lib/deezer-bpm';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const API = 'https://api.getsongbpm.com';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pick(obj: any, ...keys: string[]): unknown {
  if (!obj) return undefined;
  for (const k of keys) if (obj[k] != null) return obj[k];
  return undefined;
}

// GetSongBPM est derrière Cloudflare (bloque les IP datacenter/Vercel). On route donc
// l'appel via ScrapingBee (IP résidentielle) : premium_proxy + render_js=false renvoie
// le corps BRUT (le JSON de GetSongBPM), sans rendu navigateur à déballer.
async function fetchJson(targetUrl: string): Promise<{ status: number; text: string; json: unknown }> {
  const scraperKey = process.env.SCRAPER_API_KEY;
  const fetchUrl = scraperKey
    ? `https://app.scrapingbee.com/api/v1/?api_key=${encodeURIComponent(scraperKey)}&url=${encodeURIComponent(targetUrl)}&premium_proxy=true&render_js=false`
    : targetUrl;

  const res = await fetch(fetchUrl);
  const text = await res.text().catch(() => '');
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    // Corps non-JSON (page Cloudflare / HTML) : on tente d'extraire un objet JSON.
    const m = text.match(/\{[\s\S]*\}/);
    if (m) { try { json = JSON.parse(m[0]); } catch { /* pas de JSON exploitable */ } }
  }
  return { status: res.status, text, json };
}

// Récupère BPM + tonalité d'un morceau via GetSongBPM (proxifié par ScrapingBee).
export async function GET(req: NextRequest) {
  const title = (req.nextUrl.searchParams.get('title') || '').trim();
  const artist = (req.nextUrl.searchParams.get('artist') || '').trim();
  const apiKey = process.env.GETSONGBPM_API_KEY;

  if (!apiKey || !title || !artist) {
    return NextResponse.json({ tempo: null, key: null });
  }

  const now = Date.now();

  // Déjà cherché ? On ne redemande pas. Chaque appel au proxy est décompté d'un
  // quota mensuel, et c'est la répétition des recherches infructueuses qui l'épuisait.
  const connu = await readCachedBpm(title, artist, now);
  if (connu && req.nextUrl.searchParams.get('diag') !== '1') {
    return NextResponse.json(connu, {
      headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=86400' },
    });
  }

  // Deezer d'abord : gratuit, sans quota, joignable en direct. Il ne donne que le
  // tempo, mais c'est la moitié de la réponse — et sur l'échantillon testé il couvrait
  // les titres que GetSongBPM ignorait.
  const deezerTempo = await fetchDeezerTempo(title, artist);

  try {
    const lookup = `song:${title} artist:${artist}`;
    const searchUrl = `${API}/search/?api_key=${encodeURIComponent(apiKey)}&type=both&lookup=${encodeURIComponent(lookup)}`;
    // GetSongBPM n'est sollicité que s'il reste quelque chose à trouver : il coûte un
    // appel de proxy, décompté d'un quota mensuel. Quand Deezer a donné le tempo, on
    // ne le dérange que pour la tonalité — et pas du tout si le quota est épuisé.
    const search = await fetchJson(searchUrl);

    // Diagnostic : quand rien ne remonte, on ne sait pas si le blocage vient du
    // proxy (crédits épuisés), du service (clé refusée, débit dépassé) ou d'une
    // simple absence du morceau. `?diag=1` rend le code et un extrait de la réponse
    // amont — **clé retirée**, elle figure dans l'URL interrogée.
    if (req.nextUrl.searchParams.get('diag') === '1') {
      // Appel SANS proxy : si Cloudflare laisse passer les IP de Vercel, la
      // dépendance à ScrapingBee — et son quota — n'a plus lieu d'être.
      let direct: { status: number; bodyStart: string } | null = null;
      try {
        const d = await fetch(searchUrl);
        const dt = await d.text().catch(() => '');
        direct = { status: d.status, bodyStart: dt.slice(0, 200).replace(/api_key=[^&"\s]+/g, 'api_key=***') };
      } catch (err) {
        direct = { status: 0, bodyStart: String(err).slice(0, 120) };
      }

      return NextResponse.json({
        direct,
        upstreamStatus: search.status,
        bodyStart: search.text.slice(0, 300).replace(/api_key=[^&"\s]+/g, 'api_key=***'),
        parsed: search.json ? Object.keys(search.json as Record<string, unknown>) : null,
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const first = Array.isArray((search.json as any)?.search) ? (search.json as any).search[0] : null;
    const id = pick(first, 'id', 'song_id');
    let tempoRaw = pick(first, 'tempo', 'song_tempo');
    let keyRaw = pick(first, 'key_of', 'key', 'song_key');

    // La recherche porte déjà tempo/key_of en général ; détail par id sinon.
    if (id && (tempoRaw == null || keyRaw == null)) {
      const detail = await fetchJson(`${API}/song/?api_key=${encodeURIComponent(apiKey)}&id=${encodeURIComponent(String(id))}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const song = pick(detail.json as any, 'song') ?? detail.json;
      if (tempoRaw == null) tempoRaw = pick(song, 'tempo', 'song_tempo');
      if (keyRaw == null) keyRaw = pick(song, 'key_of', 'key', 'song_key');
    }

    const tempoNum = Number(tempoRaw);
    const tempoGetSong = Number.isFinite(tempoNum) && tempoNum >= 30 && tempoNum <= 320 ? Math.round(tempoNum) : null;
    // Deezer prime : il a été interrogé en premier et n'a rien coûté.
    const tempo = deezerTempo ?? tempoGetSong;
    const key = normalizeKey(keyRaw);

    // Les deux issues sont mémorisées : un succès définitivement, un échec pour un
    // temps. Ne garder que les succès revenait à réinterroger sans fin les morceaux
    // absents de leur base — la moitié de l'échantillon testé.
    await writeCachedBpm(title, artist, { tempo, key }, now);

    const found = tempo != null || key != null;
    return NextResponse.json(
      { tempo, key },
      { headers: { 'Cache-Control': found ? 'public, max-age=86400, s-maxage=86400' : 'no-store' } }
    );
  } catch {
    // GetSongBPM indisponible (quota du proxy épuisé, panne) : le tempo de Deezer
    // reste bon à prendre, et on le mémorise pour ne pas y revenir.
    if (deezerTempo != null) {
      await writeCachedBpm(title, artist, { tempo: deezerTempo, key: null }, now);
      return NextResponse.json(
        { tempo: deezerTempo, key: null },
        { headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=86400' } },
      );
    }
    return NextResponse.json({ tempo: null, key: null }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
