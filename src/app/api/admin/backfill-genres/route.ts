import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/lib/firebase-admin';
import { mapItunesGenre } from '@/lib/itunes-genre';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const BATCH_LIMIT = 80;
const ITUNES_DELAY_MS = 250;

async function fetchGenre(title: string, artist: string): Promise<string | null> {
  const term = [title, artist].filter(Boolean).join(' ').trim();
  if (!term) return null;
  try {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=1`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return mapItunesGenre(data.results?.[0]?.primaryGenreName);
  } catch {
    return null;
  }
}

// Backfill du genre (depuis iTunes, mappé sur nos genres) pour les grilles SANS genre.
// Marque chaque grille traitée (`genreChecked`) pour converger. À relancer tant que
// `remaining > 0`. Ne touche pas aux grilles ayant déjà un genre.
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
    console.error('[admin/backfill-genres] Firebase auth error:', authErr);
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
    const hasGenres = Array.isArray(data.genres) && data.genres.length > 0;
    return !hasGenres && data.genreChecked !== true && (data.title || data.artist);
  });
  const slice = todo.slice(0, BATCH_LIMIT);

  let updated = 0;
  let notFound = 0;
  for (const doc of slice) {
    const data = doc.data();
    const genre = await fetchGenre((data.title as string) || '', (data.artist as string) || '');
    if (genre) {
      await doc.ref.update({ genres: [genre], genreChecked: true });
      updated++;
    } else {
      await doc.ref.update({ genreChecked: true });
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
