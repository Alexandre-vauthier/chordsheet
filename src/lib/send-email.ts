import { SITE_NAME } from '@/lib/seo';

/**
 * Envoi de mails transactionnels via Resend.
 *
 * Appel direct à l'API HTTP plutôt qu'au paquet npm : c'est une requête POST, et une
 * dépendance de moins à suivre.
 *
 * Ces mails partent de notre propre domaine, ce qui est tout l'intérêt : Firebase les
 * envoyait depuis `firebaseapp.com`, un domaine sans rapport avec la marque, et les
 * filtres pénalisent lourdement cette incohérence entre expéditeur, contenu et liens.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

/** Expéditeur. Doit appartenir à un domaine vérifié chez Resend (SPF + DKIM posés). */
const FROM = process.env.EMAIL_FROM || `${SITE_NAME} <noreply@alviena.com>`;

export interface EmailContent {
  subject: string;
  /** Titre affiché en haut du message. */
  heading: string;
  /** Paragraphe d'explication, une à deux phrases. */
  body: string;
  /** Libellé du bouton. */
  action: string;
  url: string;
  /** Phrase de clôture, typiquement « si tu n'es pas à l'origine de… ». */
  footer: string;
}

/**
 * Envoie un mail. Rend `true` si Resend l'a accepté.
 *
 * N'émet jamais d'exception vers l'appelant : un mail qui ne part pas ne doit pas
 * faire échouer une inscription. L'échec est journalisé, pas propagé.
 */
export async function sendTransactionalEmail(to: string, content: EmailContent): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[send-email] RESEND_API_KEY absente : aucun mail envoyé.');
    return false;
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        subject: content.subject,
        html: renderHtml(content),
        // Une version texte double la délivrabilité d'un message : un mail en HTML
        // seul est un signal négatif pour la plupart des filtres.
        text: renderText(content),
      }),
    });

    if (!res.ok) {
      console.error('[send-email] Resend a refusé le message :', res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error('[send-email] envoi impossible :', err);
    return false;
  }
}

/**
 * Gabarit HTML, volontairement sobre.
 *
 * Pas d'image, pas de police distante, un seul lien : trois choix de délivrabilité.
 * Une image bloquée par le client de messagerie ne doit pas emporter le sens du
 * message, et un mail chargé de ressources externes ressemble à du publipostage.
 * Styles en ligne, seule forme que les clients de messagerie respectent.
 */
function renderHtml({ heading, body, action, url, footer }: EmailContent): string {
  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#fdfbf7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fdfbf7;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e0dcd4;border-radius:14px;">
        <tr><td style="height:6px;background:#c84b2f;border-radius:14px 14px 0 0;font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td style="padding:32px 32px 28px 32px;">

          <p style="margin:0 0 24px 0;font-size:18px;font-weight:700;color:#c84b2f;letter-spacing:-0.3px;">${escapeHtml(SITE_NAME)}</p>

          <h1 style="margin:0 0 14px 0;font-size:21px;line-height:1.3;color:#1a1a1a;font-weight:700;">${escapeHtml(heading)}</h1>
          <p style="margin:0 0 26px 0;font-size:15px;line-height:1.65;color:#555555;">${escapeHtml(body)}</p>

          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="background:#c84b2f;border-radius:9px;">
              <a href="${escapeHtml(url)}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${escapeHtml(action)}</a>
            </td>
          </tr></table>

          <p style="margin:26px 0 0 0;font-size:12px;line-height:1.6;color:#999999;">
            Si le bouton ne fonctionne pas, copie ce lien dans ton navigateur :<br>
            <span style="color:#666666;word-break:break-all;">${escapeHtml(url)}</span>
          </p>

          <p style="margin:24px 0 0 0;padding-top:20px;border-top:1px solid #e0dcd4;font-size:12px;line-height:1.6;color:#999999;">${escapeHtml(footer)}</p>

        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function renderText({ heading, body, action, url, footer }: EmailContent): string {
  return `${SITE_NAME}\n\n${heading}\n\n${body}\n\n${action} : ${url}\n\n${footer}\n`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
