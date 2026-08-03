import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { INSTRUMENTS_AVEC_BIBLIOTHEQUE, instrumentsMissingChord, isChordKnown } from '@/lib/unknown-chords';
import { loadAdminChordKeys } from '@/lib/library-chords-server';
import type { InstrumentId } from '@/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Les accords écrits dans les grilles que la bibliothèque ne sait pas dessiner.
 *
 * **Le contrôle ne dépend pas de l'instrument de la grille.** Chaque accord employé
 * quelque part est confronté aux six instruments, et il figure au tableau dès qu'il
 * en manque un seul. Le contrôler pour le seul instrument de la grille faisait
 * disparaître une ligne entière dès qu'on avait dessiné l'accord pour la guitare,
 * alors qu'il restait introuvable à l'ukulélé, à la mandoline, au banjo et au piano :
 * le travail n'était pas fini, mais le tableau ne le disait plus.
 *
 * C'est ce qui distingue cet écran de l'alerte par mail : celle-ci ne se déclenche
 * que si l'auteur voit réellement une case vide, donc pour l'instrument de sa grille.
 * Ici on inventorie la bibliothèque, pas les gênes du moment.
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
  /**
   * L'accord manque-t-il pour l'instrument de cette grille ?
   *
   * Distingue le manque qui gêne quelqu'un tout de suite du manque qui n'est qu'un
   * trou dans la bibliothèque. Faux quand l'auteur a dessiné le doigté lui-même, ou
   * quand un administrateur l'a fait pour cet instrument.
   */
  affecte: boolean;
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

/** Un accord écrit dans une grille, et ce que cette grille en sait. */
interface Emploi {
  chord: string;
  usage: Usage;
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

  const emplois: Emploi[] = [];
  let sansIndex = 0;

  for (const d of docs) {
    const s = d.data();
    const chords = Array.isArray(s.chords) ? (s.chords as string[]) : null;
    if (chords === null) { sansIndex++; continue; }

    const instrument = (typeof s.instrumentId === 'string' ? s.instrumentId : 'guitar') as InstrumentId;
    // Doigtés dessinés par l'auteur, propres à cette grille : ils épargnent la case
    // vide à son auteur, mais ne comblent rien dans la bibliothèque.
    const dessines = new Set(
      s.customChords && typeof s.customChords === 'object'
        ? Object.keys(s.customChords as Record<string, unknown>).map((n) => n.trim().toLowerCase())
        : [],
    );

    const vus = new Set<string>();
    for (const brut of chords) {
      const chord = brut.trim();
      if (!chord) continue;
      const cle = chord.toLowerCase();
      if (vus.has(cle)) continue;
      vus.add(cle);

      emplois.push({
        chord,
        usage: {
          sheetId: d.id,
          title: typeof s.title === 'string' ? s.title : '',
          artist: typeof s.artist === 'string' ? s.artist : '',
          ownerId: typeof s.ownerId === 'string' ? s.ownerId : '',
          ownerName: typeof s.ownerName === 'string' ? s.ownerName : '',
          isPublic: s.isPublic === true,
          instrument,
          affecte: !dessines.has(cle) && !isChordKnown(chord, instrument, ajoutsAdmin),
        },
      });
    }
  }

  // Un accord figure au tableau des qu'il manque a un instrument, quel que soit
  // celui de la grille ou il a ete repere.
  const parAccord = new Map<string, Manquant>();
  const memoire = new Map<string, InstrumentId[]>();

  for (const { chord, usage } of emplois) {
    const cle = chord.toLowerCase();

    let missingOn = memoire.get(cle);
    if (!missingOn) {
      missingOn = instrumentsMissingChord(chord, ajoutsAdmin);
      memoire.set(cle, missingOn);
    }
    if (missingOn.length === 0) continue;

    let entree = parAccord.get(cle);
    if (!entree) {
      entree = { chord, missingOn, usages: [] };
      parAccord.set(cle, entree);
    }
    entree.usages.push(usage);
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
    /** Occurrences où l'auteur voit réellement une case vide. */
    affecting: rows.reduce((n, r) => n + r.usages.filter((u) => u.affecte).length, 0),
  });
}
