import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { INSTRUMENTS_AVEC_BIBLIOTHEQUE, instrumentsMissingChord, unknownChordsIn } from '@/lib/unknown-chords';
import { loadAdminChordKeys } from '@/lib/library-chords-server';
import type { InstrumentId } from '@/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Les accords écrits dans les grilles que la bibliothèque ne sait pas dessiner.
 *
 * Recalculé à chaque appel plutôt que lu dans une table tenue à jour : la
 * bibliothèque s'enrichit, un accord signalé hier peut être connu aujourd'hui, et une
 * liste figée continuerait de réclamer un travail déjà fait.
 *
 * Le champ `chords` sert de source : il est déposé à plat par `toFirestore` à chaque
 * sauvegarde. Une grille enregistrée avant son introduction n'a pas ce champ ; elle
 * est comptée à part plutôt qu'ignorée en silence, sans quoi le tableau donnerait
 * l'illusion d'une couverture complète.
 */

/** Une grille qui emploie l'accord. */
interface Usage {
  sheetId: string;
  title: string;
  artist: string;
  ownerId: string;
  ownerName: string;
  isPublic: boolean;
  /** Instrument de la grille : c'est pour celui-là que son auteur voit une case vide. */
  instrument: InstrumentId;
}

/**
 * Un accord manquant, vu depuis la bibliothèque.
 *
 * Regroupé par accord et non par grille : c'est l'accord qu'on ajoute, pas la grille
 * qu'on corrige. Et `missingOn` liste **tous** les instruments qui ne savent pas le
 * dessiner, pas seulement celui de la grille où il a été repéré — une grille n'est
 * contrôlée que pour son propre instrument, ce qui suffit à savoir si son auteur voit
 * une case vide, mais ne dit rien du travail que représente l'ajout. Un accord absent
 * partout n'est pas un accord absent d'un seul instrument.
 */
interface Manquant {
  chord: string;
  missingOn: InstrumentId[];
  usages: Usage[];
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

  // Les accords dessinés à la main par un administrateur comptent comme connus :
  // l'application les résout avant la table statique, le contrôle doit suivre le
  // même chemin sous peine de décrire une bibliothèque qui n'existe pas.
  const [snap, ajoutsAdmin] = await Promise.all([
    db.collection('sheets').get(),
    loadAdminChordKeys(),
  ]);
  const docs = snap.docs as { id: string; data: () => Record<string, unknown> }[];

  const parAccord = new Map<string, Manquant>();
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

    for (const chord of unknownChordsIn(chords, instrument, dessines, ajoutsAdmin)) {
      const cle = chord.toLowerCase();
      let entree = parAccord.get(cle);
      if (!entree) {
        // Calculé une fois par accord : la liste ne dépend pas de la grille.
        entree = { chord, missingOn: instrumentsMissingChord(chord, ajoutsAdmin), usages: [] };
        parAccord.set(cle, entree);
      }
      entree.usages.push({
        sheetId: d.id,
        title: typeof s.title === 'string' ? s.title : '',
        artist: typeof s.artist === 'string' ? s.artist : '',
        ownerId: typeof s.ownerId === 'string' ? s.ownerId : '',
        ownerName: typeof s.ownerName === 'string' ? s.ownerName : '',
        isPublic: s.isPublic === true,
        instrument,
      });
    }
  }

  // Les plus employés d'abord : c'est l'accord qui revient dans dix grilles qui vaut
  // qu'on l'ajoute à la bibliothèque, pas la faute de frappe isolée.
  const rows = [...parAccord.values()].sort(
    (a, b) => b.usages.length - a.usages.length || a.chord.localeCompare(b.chord),
  );

  return NextResponse.json({
    rows,
    scanned: docs.length,
    withoutIndex: sansIndex,
    distinctChords: rows.length,
    occurrences: rows.reduce((n, r) => n + r.usages.length, 0),
    // Rendu plutôt que recopié dans l'écran : « manquant sur 4 instruments sur 6 »
    // deviendrait faux le jour où un instrument s'ajoute.
    instrumentsChecked: INSTRUMENTS_AVEC_BIBLIOTHEQUE.length,
    /** Accords dessinés à la main par un administrateur, pris en compte ci-dessus. */
    adminChords: ajoutsAdmin.size,
  });
}
