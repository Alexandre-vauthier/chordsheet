import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';
import { sendTransactionalEmail } from '@/lib/send-email';
import { passwordResetEmail, normalizeEmailLocale } from '@/lib/auth-email-copy';
import { consumeEmailQuota, clientIp } from '@/lib/email-rate-limit';
import { SITE_URL } from '@/lib/seo';
import { toOwnDomainLink } from '@/lib/auth-action-link';

export const dynamic = 'force-dynamic';

/**
 * Envoie le mail de réinitialisation de mot de passe, depuis notre domaine.
 *
 * **Répond toujours 200**, que l'adresse existe ou non. Une réponse différenciée
 * transformerait cette route en outil d'énumération : il suffirait de la boucler sur
 * une liste d'adresses pour savoir lesquelles ont un compte ici.
 *
 * Ouverte par nature, donc limitée par adresse *et* par IP : la première borne
 * protège la personne visée du harcèlement, la seconde protège la facture d'envoi.
 */
export async function POST(req: NextRequest) {
  let email = '';
  let localeParam: string | undefined;

  try {
    const body = await req.json();
    email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    localeParam = typeof body?.locale === 'string' ? body.locale : undefined;
  } catch {
    return NextResponse.json({ ok: true });
  }

  // Réponse volontairement identique à celle d'un envoi réussi.
  if (!email || !email.includes('@')) return NextResponse.json({ ok: true });

  const now = Date.now();
  const ip = clientIp(req.headers);
  const [emailAllowed, ipAllowed] = await Promise.all([
    consumeEmailQuota(`reset:${email}`, now),
    ip ? consumeEmailQuota(`reset-ip:${ip}`, now) : Promise.resolve(true),
  ]);
  if (!emailAllowed || !ipAllowed) return NextResponse.json({ ok: true });

  const locale = normalizeEmailLocale(localeParam);

  try {
    const firebaseLink = await getAdminAuth().generatePasswordResetLink(email, {
      url: `${SITE_URL}/${locale}/login`,
      handleCodeInApp: false,
    });
    const link = toOwnDomainLink(firebaseLink, '/reset-password', locale);
    await sendTransactionalEmail(email, passwordResetEmail(locale, link));
  } catch {
    // Adresse inconnue, quota Firebase, panne de l'envoi : rien ne filtre vers le
    // client, qui recevrait sinon l'information « ce compte existe ».
  }

  return NextResponse.json({ ok: true });
}
