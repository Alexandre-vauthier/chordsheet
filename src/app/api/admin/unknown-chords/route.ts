import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { unknownChordsIn } from '@/lib/unknown-chords';
import type { InstrumentId } from '@/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Les accords écrits dans les grilles que la bibliothèque ne sait pas dessiner.
 *
 * Recalculé à chaque appel plutôt que lu dans une table tenue à jour : la
 * bibliothèque s'enrichit, un accord signalé hier peut être connu aujourd'hui, et une
 * liste figée continuerait de réclamer un travail déjà fait. Le balayage est
 * abordable, il ne lit que quatre champs par grille.
 *
 * Le champ `chords` sert de source : il est déposé à plat par `toFirestore` à chaque
 * sauvegarde. Une grille enregistrée avant son introduction n'a pas ce champ ; elle
 * est comptée à part plutôt qu'ignorée en silence, sans quoi le tableau donnerait
 * l'illusion d'une couverture complète.
 */
interface Ligne {
  chord: string;
  instrument: InstrumentId;
  sheetId: string;
  title: string;
  artist: string;
  ownerId: string;
  ownerName: string;
  isPublic: boolean;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ') || !process.env.FIREBASE_ADMIN_PROJECT_ID) {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  }

  let userId: string;
  try {
    userId = (await getAdminAuth().verifyIdToken(authHeader.slice(7))).uid;
  } catch {
    return NextResponse.json({ error: 'Session invalide, reconnecte-toi.' }, { status: 401 });
  }

  const db = getAdminDb();
  const userSnap = await db.collection('users').doc(userId).get();
  if (userSnap.data()?.role !== 'admin') {
    return NextResponse.json({ error: 'Réservé aux administrateurs.' }, { status: 403 });
  }

  const snap = await db.collection('sheets').get();
  const docs = snap.docs as { id: string; data: () => Record<string, unknown> }[];

  const lignes: Ligne[] = [];
  let sansIndex = 0;

  for (const d of docs) {
    const s = d.data();
    const chords = Array.isArray(s.chords) ? (s.chords as string[]) : null;
    if (chords === null) { sansIndex++; continue; }

    const instrument = (typeof s.instrumentId === 'string' ? s.instrumentId : 'guitar') as InstrumentId;
    // Les doigtés dessinés par l'auteur comblent déjà le manque : les signaler
    // reviendrait à réclamer un accord que la grille sait déjà afficher.
    const dessines = s.customChords && typeof s.customChords === 'object'
      ? Object.keys(s.customChords as Record<string, unknown>)
      : [];

    for (const chord of unknownChordsIn(chords, instrument, dessines)) {
      lignes.push({
        chord,
        instrument,
        sheetId: d.id,
        title: typeof s.title === 'string' ? s.title : '',
        artist: typeof s.artist === 'string' ? s.artist : '',
        ownerId: typeof s.ownerId === 'string' ? s.ownerId : '',
        ownerName: typeof s.ownerName === 'string' ? s.ownerName : '',
        isPublic: s.isPublic === true,
      });
    }
  }

  // Les plus fréquents d'abord : c'est l'accord qui revient dans dix grilles qui vaut
  // qu'on l'ajoute à la bibliothèque, pas la faute de frappe isolée.
  const parAccord = new Map<string, number>();
  for (const l of lignes) parAccord.set(l.chord.toLowerCase(), (parAccord.get(l.chord.toLowerCase()) ?? 0) + 1);
  lignes.sort((a, b) => {
    const ecart = (parAccord.get(b.chord.toLowerCase()) ?? 0) - (parAccord.get(a.chord.toLowerCase()) ?? 0);
    return ecart !== 0 ? ecart : a.chord.localeCompare(b.chord);
  });

  return NextResponse.json({
    rows: lignes,
    scanned: docs.length,
    withoutIndex: sansIndex,
    distinctChords: parAccord.size,
  });
}
