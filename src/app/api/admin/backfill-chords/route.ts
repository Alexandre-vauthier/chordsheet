import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/lib/firebase-admin';
import { fromFirestore } from '@/lib/firestore-helpers';
import { indexedChords } from '@/lib/sheet-chords';

export const maxDuration = 60;

/**
 * Reprise ponctuelle : dépose le champ `chords` sur les grilles antérieures à son
 * introduction. Sans lui, une grille existante reste invisible des pages d'accord
 * jusqu'à sa prochaine sauvegarde.
 *
 * Idempotent : le tableau est trié, donc une grille déjà à jour produit exactement
 * le même tableau et n'est pas réécrite. Relançable sans risque, y compris après un
 * dépassement de délai — il reprend simplement là où il en est.
 */
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
    console.error('[admin/backfill-chords] Firebase auth error:', authErr);
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

    // Les sections sont au format Firestore (rows: [{ cells: [] }]) : on repasse par
    // fromFirestore plutôt que de redéfinir ici une seconde lecture de la structure,
    // qui divergerait au premier changement de modèle.
    const chords = indexedChords(fromFirestore(doc.id, data));

    const current = Array.isArray(data.chords) ? (data.chords as string[]) : null;
    if (current && current.length === chords.length && current.every((c, i) => c === chords[i])) continue;

    batch.update(doc.ref, { chords });
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
