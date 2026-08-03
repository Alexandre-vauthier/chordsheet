import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { sendTransactionalEmail } from '@/lib/send-email';
import { newAccountEmail } from '@/lib/auth-email-copy';
import { SITE_URL } from '@/lib/seo';
import { ADMIN_EMAILS } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * Prévient les administrateurs qu'un compte vient d'être créé.
 *
 * Le déclenchement vient du navigateur, pas du serveur : la création du document
 * utilisateur se fait côté client, il n'y a pas d'endroit serveur par lequel toute
 * inscription passerait. Un appel depuis le navigateur est donc à la fois répétable
 * et falsifiable, d'où deux garde-fous :
 *
 * - **jeton obligatoire** : on ne notifie que sur le compte qui appelle, jamais sur
 *   une identité fournie dans la requête ;
 * - **drapeau pose une seule fois**, dans une transaction : le deuxième appel ne
 *   part pas, quel qu'en soit l'auteur. C'est ce qui rend la route inoffensive même
 *   si quelqu'un la rejoue en boucle.
 *
 * Destinataires : `ADMIN_EMAILS` par defaut, ou `SIGNUP_NOTIFY_TO` (adresses
 * separees par des virgules) pour n'en viser qu'une.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ') || !process.env.FIREBASE_ADMIN_PROJECT_ID) {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  }

  let uid: string;
  let email: string;
  let provider: string;
  try {
    const decoded = await getAdminAuth().verifyIdToken(authHeader.slice(7));
    uid = decoded.uid;
    email = decoded.email ?? '';
    // `firebase.sign_in_provider` vaut « password » ou « google.com ».
    provider = decoded.firebase?.sign_in_provider === 'google.com' ? 'Google' : 'email';
  } catch {
    return NextResponse.json({ error: 'Session invalide.' }, { status: 401 });
  }

  const db = getAdminDb();
  const ref = db.collection('users').doc(uid);

  // Revendication atomique du drapeau : deux appels simultanes ne peuvent pas
  // aboutir tous les deux a un envoi.
  let aRevendique = false;
  try {
    aRevendique = await db.runTransaction(async (tx: {
      get: (r: unknown) => Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }>;
      update: (r: unknown, d: Record<string, unknown>) => void;
    }) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return false;
      if (snap.data()?.signupNotifiedAt) return false;
      tx.update(ref, { signupNotifiedAt: new Date() });
      return true;
    });
  } catch (err) {
    console.error('[auth/notify-signup] transaction', err);
    return NextResponse.json({ error: 'Indisponible.' }, { status: 503 });
  }

  if (!aRevendique) return NextResponse.json({ ok: true, alreadyNotified: true });

  const destinataires = (process.env.SIGNUP_NOTIFY_TO || ADMIN_EMAILS.join(','))
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean);

  const snap = await ref.get().catch(() => null);
  const displayName = (snap?.data()?.displayName as string) || '';

  const contenu = newAccountEmail({
    displayName,
    email,
    provider,
    url: `${SITE_URL}/fr/admin`,
  });

  const envois = await Promise.all(
    destinataires.map((to) => sendTransactionalEmail(to, contenu)),
  );

  // Aucun envoi n'est passe : on rend le drapeau, sinon l'inscription serait
  // definitivement marquee « notifiee » sans que personne n'ait rien recu.
  if (!envois.some(Boolean)) {
    await ref.update({ signupNotifiedAt: null }).catch(() => {});
    return NextResponse.json({ error: 'Envoi impossible.' }, { status: 502 });
  }

  return NextResponse.json({ ok: true, sent: envois.filter(Boolean).length });
}
