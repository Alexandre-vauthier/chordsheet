import { NextRequest, NextResponse } from 'next/server';
import { normalizeKey } from '@/lib/songbpm-key';

export const dynamic = 'force-dynamic';

const API = 'https://api.getsongbpm.com';

// Récupère BPM + tonalité d'un morceau via GetSongBPM (clé serveur GETSONGBPM_API_KEY).
// Renvoie { tempo, key } (null si clé absente / pas de résultat). Utilisé pour
// pré-remplir l'éditeur (comme l'année/genre), éditable ensuite.
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
    const res = await fetch(searchUrl, { next: { revalidate: 86400 } });
    if (!res.ok) throw new Error(`getsongbpm ${res.status}`);

    const data = await res.json();
    const first = Array.isArray(data?.search) ? data.search[0] : null;
    if (!first) return NextResponse.json({ tempo: null, key: null });

    let tempoRaw: unknown = first.tempo;
    let keyRaw: unknown = first.key_of ?? first.key;

    // La recherche ne renvoie pas toujours tempo/tonalité : détail par id si besoin.
    if (first.id && (tempoRaw == null || keyRaw == null)) {
      try {
        const dRes = await fetch(`${API}/song/?api_key=${encodeURIComponent(apiKey)}&id=${encodeURIComponent(first.id)}`, { next: { revalidate: 86400 } });
        if (dRes.ok) {
          const d = await dRes.json();
          const song = d?.song ?? d;
          if (tempoRaw == null) tempoRaw = song?.tempo;
          if (keyRaw == null) keyRaw = song?.key_of ?? song?.key;
        }
      } catch { /* détail indisponible */ }
    }

    const tempoNum = Number(tempoRaw);
    const tempo = Number.isFinite(tempoNum) && tempoNum >= 30 && tempoNum <= 320 ? Math.round(tempoNum) : null;
    const key = normalizeKey(keyRaw);

    return NextResponse.json(
      { tempo, key },
      { headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=86400' } }
    );
  } catch {
    return NextResponse.json({ tempo: null, key: null });
  }
}
