import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { instrumentsMissingChord, unknownChordsIn } from '@/lib/unknown-chords';
import { INSTRUMENT_CONFIG } from '@/lib/chord-data';
import { loadAdminChordKeys } from '@/lib/library-chords-server';
import type { InstrumentId } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * Prévient les administrateurs qu'un accord manque à la bibliothèque.
 *
 * Appelé après l'enregistrement d'une grille. Le corps de la requête ne porte que
 * l'identifiant : **les accords sont relus dans le document**, jamais pris dans la
 * requête. Un client peut mentir sur ce qu'il a écrit, pas sur ce que Firestore
 * contient.
 *
 * L'annonce passe par la cloche de l'application, pas par un mail. Un mail pour un
 * trou de bibliothèque encombre une boîte de réception avec une information qui n'a
 * rien d'urgent, et qu'on traite de toute façon depuis le tableau récapitulatif —
 * vers lequel la notification pointe directement.
 *
 * Le bruit est le vrai risque d'une alerte à la sauvegarde : on enregistre une grille
 * des dizaines de fois pendant qu'on l'écrit. Un accord n'est donc annoncé **qu'une
 * seule fois, à sa toute première apparition**, mémorisée dans `unknown_chords`. Les
 * fois suivantes, la trace est mise à jour sans qu'aucun message ne parte. Le tableau
 * d'administration, lui, recalcule tout à la demande : cette collection ne sert qu'à
 * la mémoire des envois, elle n'est pas la source de vérité.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ') || !process.env.FIREBASE_ADMIN_PROJECT_ID) {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  }

  let uid: string;
  try {
    uid = (await getAdminAuth().verifyIdToken(authHeader.slice(7))).uid;
  } catch {
    return NextResponse.json({ error: 'Session invalide.' }, { status: 401 });
  }

  const { sheetId } = await req.json().catch(() => ({ sheetId: null }));
  if (typeof sheetId !== 'string' || !sheetId) {
    return NextResponse.json({ error: 'Grille manquante.' }, { status: 400 });
  }

  const db = getAdminDb();
  const snap = await db.collection('sheets').doc(sheetId).get();
  if (!snap.exists) return NextResponse.json({ error: 'Grille introuvable.' }, { status: 404 });

  const s = snap.data() as Record<string, unknown>;
  // On ne signale que sur ses propres grilles : sans ce contrôle, n'importe quel
  // compte pourrait faire émettre une alerte à propos de la grille d'un autre.
  if (s.ownerId !== uid) return NextResponse.json({ error: 'Grille d\'un autre compte.' }, { status: 403 });

  const chords = Array.isArray(s.chords) ? (s.chords as string[]) : [];
  const instrument = (typeof s.instrumentId === 'string' ? s.instrumentId : 'guitar') as InstrumentId;
  const dessines = s.customChords && typeof s.customChords === 'object'
    ? Object.keys(s.customChords as Record<string, unknown>)
    : [];

  // Même bibliothèque que le tableau d'administration : un accord qu'un
  // administrateur a déjà dessiné ne doit pas déclencher d'alerte.
  const ajoutsAdmin = await loadAdminChordKeys();
  const inconnus = unknownChordsIn(chords, instrument, dessines, ajoutsAdmin);
  if (inconnus.length === 0) return NextResponse.json({ ok: true, unknown: 0 });

  // Revendication atomique, accord par accord : deux sauvegardes simultanées ne
  // peuvent pas aboutir toutes les deux à une annonce du même accord.
  const nouveaux: string[] = [];
  for (const chord of inconnus) {
    const ref = db.collection('unknown_chords').doc(`${instrument}:${chord.toLowerCase()}`);
    try {
      const premier = await db.runTransaction(async (tx: {
        get: (r: unknown) => Promise<{ exists: boolean }>;
        set: (r: unknown, d: Record<string, unknown>, o?: { merge: boolean }) => void;
      }) => {
        const known = await tx.get(ref);
        tx.set(ref, {
          chord, instrument, sheetId,
          lastSeenAt: new Date(),
          ...(known.exists ? {} : { firstSeenAt: new Date() }),
        }, { merge: true });
        return !known.exists;
      });
      if (premier) nouveaux.push(chord);
    } catch (err) {
      console.error('[report-unknown-chords]', err);
    }
  }

  if (nouveaux.length === 0) return NextResponse.json({ ok: true, unknown: inconnus.length, notified: 0 });

  // Destinataires lus dans la base plutôt que dans une liste d'adresses : c'est le
  // champ `role` qui fait foi côté règles Firestore, et un administrateur retiré de
  // la liste ne doit plus être prévenu.
  const admins = await db.collection('users').where('role', '==', 'admin').select().get();
  const adminIds = (admins.docs as { id: string }[]).map((d) => d.id);

  // Libellés français plutôt qu'identifiants : la notification est lue par des
  // humains, pas par un programme.
  const manquants = nouveaux.map((name) => ({
    name,
    missingOn: instrumentsMissingChord(name, ajoutsAdmin).map((i) => INSTRUMENT_CONFIG[i]?.label ?? i),
  }));

  const lot = db.batch();
  for (const adminId of adminIds) {
    lot.set(db.collection('notifications').doc(), {
      userId: adminId,
      kind: 'unknownChord',
      // `fromId` n'est pas lu ici — l'écriture passe par l'Admin SDK, hors des
      // règles — mais le garder évite un document au format différent des autres.
      fromId: uid,
      fromName: typeof s.ownerName === 'string' ? s.ownerName : '',
      chords: manquants.map((m) => m.name),
      missingOn: manquants.map((m) => m.missingOn.join(', ')),
      sheetId,
      sheetTitle: typeof s.title === 'string' ? s.title : '',
      link: '/admin/unknown-chords',
      read: false,
      createdAt: new Date(),
    });
  }
  await lot.commit().catch((err: unknown) => console.error('[report-unknown-chords] notifications', err));

  return NextResponse.json({ ok: true, unknown: inconnus.length, notified: nouveaux.length, admins: adminIds.length });
}
