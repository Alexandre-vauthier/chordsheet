import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth, getAdminFieldValue } from '@/lib/firebase-admin';
import { fromFirestore } from '@/lib/firestore-helpers';
import { detectKey, parseChordName } from '@/lib/key-detection';
import type { Sheet } from '@/types';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * Recalcule la tonalité de toutes les grilles depuis leurs accords.
 *
 * Le champ contenait jusqu'ici deux choses selon qui l'avait rempli : la tonalité de
 * l'enregistrement quand elle venait de GetSongBPM, celle des positions quand elle
 * était saisie en lisant la grille. Rien ne permettait de les distinguer après coup,
 * et une valeur dont on ignore le sens ne vaut pas mieux qu'une valeur absente.
 *
 * La règle devient : **la tonalité est celle des accords écrits**. Elle se recalcule
 * donc, ce qui la rend cohérente avec tout ce que la page affiche par ailleurs.
 *
 * Une grille sans accords exploitables voit son champ vidé plutôt que conservé : mieux
 * vaut un blanc qu'une valeur dont on ne sait plus ce qu'elle décrit.
 *
 * **Irréversible**, d'où le mode `dryRun` qui compte sans rien écrire.
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
    console.error('[admin/rebuild-keys] Firebase auth error:', authErr);
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
    // Corps absent : on reste en comptage.
  }

  const snap = await db.collection('sheets').get();

  let recalculees = 0;
  let videes = 0;
  let inchangees = 0;
  const apercu: { title: string; avant: string; apres: string }[] = [];

  let batch = db.batch();
  let pending = 0;
  const remove = getAdminFieldValue().delete();

  for (const doc of snap.docs) {
    const sheet = fromFirestore(doc.id, doc.data()) as Sheet;

    // Les accords dans l'ordre de la grille : le premier et le dernier départagent une
    // tonalité de son relatif, un ensemble dédoublonné perdrait cette information.
    const suite: string[] = [];
    for (const section of sheet.sections ?? []) {
      for (const row of section.rows ?? []) {
        for (const cell of row) {
          if (cell.chord?.trim() && parseChordName(cell.chord)) suite.push(cell.chord.trim());
        }
      }
    }

    const distinctes = new Set(suite.map((c) => c.toLowerCase())).size;
    const nouvelle = distinctes >= 2 ? detectKey(suite)?.key ?? null : null;
    const ancienne = (sheet.key ?? '').trim();

    if ((nouvelle ?? '') === ancienne) { inchangees++; continue; }

    if (nouvelle) recalculees++; else videes++;
    if (apercu.length < 20) apercu.push({ title: sheet.title, avant: ancienne || '—', apres: nouvelle ?? '—' });

    if (!dryRun) {
      batch.update(doc.ref, { key: nouvelle ?? remove });
      pending++;
      if (pending >= 400) { await batch.commit(); batch = db.batch(); pending = 0; }
    }
  }

  if (!dryRun && pending > 0) await batch.commit();

  return NextResponse.json({ total: snap.size, recalculees, videes, inchangees, apercu, dryRun });
}
