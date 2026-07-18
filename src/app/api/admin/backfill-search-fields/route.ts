import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/lib/firebase-admin';

export const maxDuration = 60;

// Backfill ponctuel : ajoute titleLower/artistLower aux grilles existantes qui ne les
// ont pas encore (nécessaires pour la recherche par préfixe — voir use-search-suggestions.ts).
// Idempotent : ne touche que les documents où les champs manquent, sans risque à relancer.
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
    console.error('[admin/backfill-search-fields] Firebase auth error:', authErr);
    return NextResponse.json({ error: 'Session invalide, reconnecte-toi.' }, { status: 401 });
  }

  const db = getAdminDb();
  const userSnap = await db.collection('users').doc(userId).get();
  if (userSnap.data()?.role !== 'admin') {
    return NextResponse.json({ error: 'Réservé aux administrateurs.' }, { status: 403 });
  }

  const snap = await db.collection('sheets').get();
  let batch = db.batch();
  let pending = 0;
  let updated = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    if (typeof data.titleLower === 'string' && typeof data.artistLower === 'string') continue;

    batch.update(doc.ref, {
      titleLower: ((data.title as string) || '').toLowerCase(),
      artistLower: ((data.artist as string) || '').toLowerCase(),
    });
    pending++;
    updated++;

    if (pending >= 400) {
      await batch.commit();
      batch = db.batch();
      pending = 0;
    }
  }
  if (pending > 0) await batch.commit();

  return NextResponse.json({ total: snap.size, updated });
}
