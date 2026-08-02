import { NextRequest, NextResponse } from 'next/server';
import { normalizeKey } from '@/lib/songbpm-key';

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

  try {
    const lookup = `song:${title} artist:${artist}`;
    const searchUrl = `${API}/search/?api_key=${encodeURIComponent(apiKey)}&type=both&lookup=${encodeURIComponent(lookup)}`;
    const search = await fetchJson(searchUrl);

    // Diagnostic : quand rien ne remonte, on ne sait pas si le blocage vient du
    // proxy (crédits épuisés), du service (clé refusée, débit dépassé) ou d'une
    // simple absence du morceau. `?diag=1` rend le code et un extrait de la réponse
    // amont — **clé retirée**, elle figure dans l'URL interrogée.
    if (req.nextUrl.searchParams.get('diag') === '1') {
      return NextResponse.json({
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
    const tempo = Number.isFinite(tempoNum) && tempoNum >= 30 && tempoNum <= 320 ? Math.round(tempoNum) : null;
    const key = normalizeKey(keyRaw);

    // On ne met en cache QUE les vrais résultats : cacher un échec (null) le figerait
    // 24h (résultat vide resservi même après correction).
    const found = tempo != null || key != null;
    return NextResponse.json(
      { tempo, key },
      { headers: { 'Cache-Control': found ? 'public, max-age=86400, s-maxage=86400' : 'no-store' } }
    );
  } catch {
    return NextResponse.json({ tempo: null, key: null }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
