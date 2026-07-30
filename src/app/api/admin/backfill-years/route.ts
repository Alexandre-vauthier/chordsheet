import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/lib/firebase-admin';
import { earliestYearForTitle } from '@/lib/itunes-year';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// Nombre de grilles traitées par appel : borne la durée (< 60s) et respecte le
// débit de l'API iTunes. On relance jusqu'à ce que `remaining` atteigne 0.
const BATCH_LIMIT = 80;
const ITUNES_DELAY_MS = 250;

async function fetchYear(title: string, artist: string): Promise<number | null> {
  const term = [title, artist].filter(Boolean).join(' ').trim();
  if (!term) return null;
  try {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=25`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const results = Array.isArray(data.results) ? data.results : [];
    // Année la plus ancienne parmi les versions du même titre (évite remaster/compil).
    return earliestYearForTitle(results, results[0]?.trackName);
  } catch {
    return null;
  }
}

// Backfill de l'année de sortie (depuis iTunes) sur les grilles existantes qui n'en
// ont pas encore. Marque chaque grille traitée (`yearChecked`) pour ne pas retenter
// à chaque relance celles qu'iTunes ne trouve pas → converge. À relancer tant que
// `remaining > 0`.
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
    console.error('[admin/backfill-years] Firebase auth error:', authErr);
    return NextResponse.json({ error: 'Session invalide, reconnecte-toi.' }, { status: 401 });
  }

  const db = getAdminDb();
  const userSnap = await db.collection('users').doc(userId).get();
  if (userSnap.data()?.role !== 'admin') {
    return NextResponse.json({ error: 'Réservé aux administrateurs.' }, { status: 403 });
  }

  const snap = await db.collection('sheets').get();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const todo = snap.docs.filter((d: any) => {
    const data = d.data();
    return data.year == null && data.yearChecked !== true && (data.title || data.artist);
  });
  const slice = todo.slice(0, BATCH_LIMIT);

  let updated = 0;
  let notFound = 0;
  for (const doc of slice) {
    const data = doc.data();
    const year = await fetchYear((data.title as string) || '', (data.artist as string) || '');
    if (year != null) {
      await doc.ref.update({ year, yearChecked: true });
      updated++;
    } else {
      await doc.ref.update({ yearChecked: true });
      notFound++;
    }
    await new Promise((r) => setTimeout(r, ITUNES_DELAY_MS));
  }

  return NextResponse.json({
    scanned: slice.length,
    updated,
    notFound,
    remaining: Math.max(0, todo.length - slice.length),
  });
}
