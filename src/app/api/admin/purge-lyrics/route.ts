import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth, getAdminFieldValue } from '@/lib/firebase-admin';

export const maxDuration = 60;

/**
 * Efface le champ `lyrics` de toutes les grilles.
 *
 * Ces paroles n'ont pas été saisies : l'éditeur allait les chercher tout seul et les
 * écrivait d'office. Elles proviennent donc d'un service sans licence des ayants
 * droit, déposées par l'application et non par ses utilisateurs. L'affichage passe
 * désormais par une récupération à la volée, sans stockage — rien ne se perd à
 * l'écran.
 *
 * **Irréversible.** D'où le mode `dryRun`, qui compte sans rien toucher : on regarde
 * l'ampleur avant de décider.
 *
 * Le champ est supprimé (`FieldValue.delete()`) plutôt que vidé : une chaîne vide
 * resterait une trace du passage, et `fromFirestore` traite déjà l'absence.
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
    console.error('[admin/purge-lyrics] Firebase auth error:', authErr);
    return NextResponse.json({ error: 'Session invalide, reconnecte-toi.' }, { status: 401 });
  }

  const db = getAdminDb();
  const userSnap = await db.collection('users').doc(userId).get();
  if (userSnap.data()?.role !== 'admin') {
    return NextResponse.json({ error: 'Réservé aux administrateurs.' }, { status: 403 });
  }

  let dryRun = true;
  try {
    const body = await req.json();
    dryRun = body?.dryRun !== false;
  } catch {
    // Corps absent : on reste en comptage, jamais en suppression par défaut.
  }

  const snap = await db.collection('sheets').get();
  const concernees = snap.docs.filter((d: { data: () => Record<string, unknown> }) => {
    const l = d.data().lyrics;
    return typeof l === 'string' && l.trim().length > 0;
  });

  if (dryRun) {
    return NextResponse.json({ total: snap.size, withLyrics: concernees.length, purged: 0, dryRun: true });
  }

  const remove = getAdminFieldValue().delete();
  let batch = db.batch();
  let pending = 0;

  for (const doc of concernees) {
    batch.update(doc.ref, { lyrics: remove });
    pending++;
    if (pending >= 400) {
      await batch.commit();
      batch = db.batch();
      pending = 0;
    }
  }
  if (pending > 0) await batch.commit();

  return NextResponse.json({ total: snap.size, withLyrics: concernees.length, purged: concernees.length, dryRun: false });
}
