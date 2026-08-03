import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { sendTransactionalEmail } from '@/lib/send-email';
import { unknownChordEmail } from '@/lib/auth-email-copy';
import { instrumentsMissingChord, unknownChordsIn } from '@/lib/unknown-chords';
import { INSTRUMENT_CONFIG } from '@/lib/chord-data';
import { loadAdminChordKeys } from '@/lib/library-chords-server';
import { SITE_URL } from '@/lib/seo';
import { ADMIN_EMAILS } from '@/types';
import type { InstrumentId } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * Signale aux administrateurs un accord que la bibliothèque ne sait pas dessiner.
 *
 * Appelé après l'enregistrement d'une grille. Le corps de la requête ne porte que
 * l'identifiant : **les accords sont relus dans le document**, jamais pris dans la
 * requête. Un client peut mentir sur ce qu'il a écrit, pas sur ce que Firestore
 * contient.
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

  const destinataires = (process.env.SIGNUP_NOTIFY_TO || ADMIN_EMAILS.join(','))
    .split(',').map((a) => a.trim()).filter(Boolean);

  const contenu = unknownChordEmail({
    // Libellés français plutôt qu'identifiants : le message va à des humains, pas
    // à un programme.
    chords: nouveaux.map((name) => ({
      name,
      missingOn: instrumentsMissingChord(name, ajoutsAdmin).map((i) => INSTRUMENT_CONFIG[i]?.label ?? i),
    })),
    title: typeof s.title === 'string' ? s.title : '',
    artist: typeof s.artist === 'string' ? s.artist : '',
    author: typeof s.ownerName === 'string' ? s.ownerName : '',
    url: `${SITE_URL}/fr/admin/unknown-chords`,
  });

  await Promise.all(destinataires.map((to) => sendTransactionalEmail(to, contenu)));

  return NextResponse.json({ ok: true, unknown: inconnus.length, notified: nouveaux.length });
}
