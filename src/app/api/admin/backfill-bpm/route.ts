import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/lib/firebase-admin';
import { readCachedBpm, writeCachedBpm } from '@/lib/songbpm-cache';
import { fetchDeezerTempo } from '@/lib/deezer-bpm';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * Reprise du tempo et de la tonalité (GetSongBPM) sur les grilles qui n'en ont pas.
 *
 * Lot volontairement petit : chaque appel au service prend 5 à 8 secondes, parce
 * qu'il transite par un proxy à IP résidentielle — GetSongBPM est derrière Cloudflare,
 * qui refuse les IP de datacenter. Six grilles tiennent dans la minute allouée à la
 * fonction ; au-delà elle serait interrompue en plein traitement.
 *
 * Chaque grille traitée est marquée (`bpmChecked`), y compris quand le service ne
 * trouve rien : sans ça, chaque relance retenterait indéfiniment les mêmes morceaux
 * absents de leur base, et le traitement ne convergerait jamais.
 */
const BATCH_LIMIT = 6;

const API = 'https://api.getsongbpm.com';

async function fetchTempoAndKey(title: string, artist: string): Promise<{ tempo: number | null; key: string | null }> {
  // Même mémoire que la route publique : une reprise ne redemande pas ce qu'une
  // consultation a déjà cherché, et inversement.
  const now = Date.now();
  const connu = await readCachedBpm(title, artist, now);
  if (connu) return connu;

  // Deezer d'abord : gratuit et sans quota. S'il répond, on s'arrête là — la
  // tonalité ne vient plus d'ici, elle se déduit des accords écrits.
  const deezerTempo = await fetchDeezerTempo(title, artist);
  if (deezerTempo != null) {
    const r = { tempo: deezerTempo, key: null };
    await writeCachedBpm(title, artist, r, now, true);
    return r;
  }

  const apiKey = process.env.GETSONGBPM_API_KEY;
  const scraperKey = process.env.SCRAPER_API_KEY;
  if (!apiKey) {
    const r = { tempo: deezerTempo, key: null };
    if (deezerTempo != null) await writeCachedBpm(title, artist, r, now);
    return r;
  }

  const target = `${API}/search/?api_key=${encodeURIComponent(apiKey)}&type=both&lookup=${encodeURIComponent(`song:${title} artist:${artist}`)}`;
  const url = scraperKey
    ? `https://app.scrapingbee.com/api/v1/?api_key=${encodeURIComponent(scraperKey)}&url=${encodeURIComponent(target)}&premium_proxy=true&render_js=false`
    : target;

  try {
    const res = await fetch(url);
    const text = await res.text();
    const match = text.match(/\{[\s\S]*\}/);
    const data = match ? JSON.parse(match[0]) : null;
    const first = Array.isArray(data?.search) ? data.search[0] : null;
    if (!first) {
      const r = { tempo: deezerTempo, key: null };
      await writeCachedBpm(title, artist, r, now, res.ok);
      return r;
    }

    const tempo = Number(first.tempo);
    const resultat = {
      tempo: Number.isFinite(tempo) && tempo > 0 ? Math.round(tempo) : null,
      key: null,
    };
    await writeCachedBpm(title, artist, resultat, now);
    return resultat;
  } catch {
    const r = { tempo: deezerTempo, key: null };
    if (deezerTempo != null) await writeCachedBpm(title, artist, r, now);
    return r;
  }
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ') || !process.env.FIREBASE_ADMIN_PROJECT_ID) {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  }

  let userId: string;
  try {
    const decoded = await getAdminAuth().verifyIdToken(authHeader.slice(7));
    userId = decoded.uid;
  } catch (authErr) {
    console.error('[admin/backfill-bpm] Firebase auth error:', authErr);
    return NextResponse.json({ error: 'Session invalide, reconnecte-toi.' }, { status: 401 });
  }

  const db = getAdminDb();
  const userSnap = await db.collection('users').doc(userId).get();
  if (userSnap.data()?.role !== 'admin') {
    return NextResponse.json({ error: 'Réservé aux administrateurs.' }, { status: 403 });
  }

  const snap = await db.collection('sheets').get();

  const aTraiter = snap.docs.filter((d: { data: () => Record<string, unknown> }) => {
    const s = d.data();
    if (s.bpmChecked) return false;
    const sansTempo = !String(s.tempo ?? '').trim();
    const sansKey = !String(s.key ?? '').trim();
    return (sansTempo || sansKey) && String(s.title ?? '').trim() && String(s.artist ?? '').trim();
  });

  const lot = aTraiter.slice(0, BATCH_LIMIT);
  let updated = 0;
  let notFound = 0;

  for (const doc of lot) {
    const s = doc.data();
    const { tempo } = await fetchTempoAndKey(String(s.title), String(s.artist));

    // Seul le tempo est repris : la tonalité se déduit des accords, une tuile dédiée
    // s'en charge.
    const patch: Record<string, unknown> = { bpmChecked: true };
    if (tempo != null && !String(s.tempo ?? '').trim()) patch.tempo = String(tempo);

    if (Object.keys(patch).length > 1) updated++;
    else notFound++;

    await doc.ref.update(patch);
  }

  return NextResponse.json({
    total: snap.size,
    updated,
    notFound,
    remaining: Math.max(0, aTraiter.length - lot.length),
  });
}
