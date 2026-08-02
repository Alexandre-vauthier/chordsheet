import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';
import { sendTransactionalEmail } from '@/lib/send-email';
import { verificationEmail, normalizeEmailLocale } from '@/lib/auth-email-copy';
import { consumeEmailQuota } from '@/lib/email-rate-limit';
import { SITE_URL } from '@/lib/seo';
import { toOwnDomainLink } from '@/lib/auth-action-link';

export const dynamic = 'force-dynamic';

/**
 * Envoie le mail de confirmation d'adresse, depuis notre domaine.
 *
 * Firebase sait produire le lien sans envoyer le message : on garde donc toute sa
 * mécanique de vérification, on ne reprend que la livraison et le gabarit. Le mail
 * part de `noreply@alviena.com` au lieu de `firebaseapp.com`, ce qui était la
 * première cause de mise en indésirable.
 *
 * Route authentifiée : on n'envoie qu'à l'adresse du compte qui appelle, jamais à
 * une adresse fournie dans la requête.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ') || !process.env.FIREBASE_ADMIN_PROJECT_ID) {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  }

  let email: string | undefined;
  try {
    const decoded = await getAdminAuth().verifyIdToken(authHeader.slice(7));
    email = decoded.email;
    if (decoded.email_verified) return NextResponse.json({ ok: true, alreadyVerified: true });
  } catch {
    return NextResponse.json({ error: 'Session invalide.' }, { status: 401 });
  }

  if (!email) return NextResponse.json({ error: 'Ce compte n\'a pas d\'adresse email.' }, { status: 400 });

  const now = Date.now();
  const allowed = await consumeEmailQuota(`verify:${email}`, now);
  if (!allowed) {
    return NextResponse.json({ error: 'Trop de demandes. Réessaie dans quelques minutes.' }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const locale = normalizeEmailLocale(searchParams.get('locale') ?? undefined);

  try {
    const firebaseLink = await getAdminAuth().generateEmailVerificationLink(email, {
      url: `${SITE_URL}/${locale}`,
      handleCodeInApp: false,
    });
    const link = toOwnDomainLink(firebaseLink, '/verify-email', locale);

    const sent = await sendTransactionalEmail(email, verificationEmail(locale, link));
    if (!sent) return NextResponse.json({ error: 'Envoi impossible pour le moment.' }, { status: 502 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[auth/send-verification]', err);
    return NextResponse.json({ error: 'Envoi impossible pour le moment.' }, { status: 502 });
  }
}
