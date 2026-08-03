import { SITE_NAME } from '@/lib/seo';
import type { EmailContent } from '@/lib/send-email';

/**
 * Textes des mails d'authentification.
 *
 * Volontairement hors des dictionnaires next-intl : ces messages sont composés côté
 * serveur, dans une route API qui n'a pas de contexte de requête i18n. Deux langues,
 * deux gabarits, écrits en clair — c'est plus lisible qu'un détour par le système de
 * traduction pour six chaînes.
 */

export type EmailLocale = 'fr' | 'en';

export function normalizeEmailLocale(value: string | undefined): EmailLocale {
  return value === 'en' ? 'en' : 'fr';
}

export function verificationEmail(locale: EmailLocale, url: string): EmailContent {
  return locale === 'en'
    ? {
        subject: `Confirm your email address — ${SITE_NAME}`,
        heading: 'Confirm your email address',
        body: `One last step to finish creating your ${SITE_NAME} account. This link is valid for a limited time.`,
        action: 'Confirm my address',
        url,
        footer: `If you did not create an account on ${SITE_NAME}, you can ignore this message — nothing will happen.`,
      }
    : {
        subject: `Confirme ton adresse email — ${SITE_NAME}`,
        heading: 'Confirme ton adresse email',
        body: `Dernière étape pour terminer la création de ton compte ${SITE_NAME}. Ce lien est valable un temps limité.`,
        action: 'Confirmer mon adresse',
        url,
        footer: `Si tu n'as pas créé de compte sur ${SITE_NAME}, ignore ce message : il ne se passera rien.`,
      };
}

export function passwordResetEmail(locale: EmailLocale, url: string): EmailContent {
  return locale === 'en'
    ? {
        subject: `Reset your password — ${SITE_NAME}`,
        heading: 'Reset your password',
        body: 'Click below to choose a new password. The link is valid for a limited time and can be used only once.',
        action: 'Choose a new password',
        url,
        footer: 'If you did not ask for this, ignore this message: your password stays unchanged.',
      }
    : {
        subject: `Réinitialise ton mot de passe — ${SITE_NAME}`,
        heading: 'Réinitialise ton mot de passe',
        body: 'Clique ci-dessous pour choisir un nouveau mot de passe. Le lien est valable un temps limité et ne fonctionne qu\'une fois.',
        action: 'Choisir un nouveau mot de passe',
        url,
        footer: 'Si tu n\'es pas à l\'origine de cette demande, ignore ce message : ton mot de passe reste inchangé.',
      };
}

/**
 * Avertit les administrateurs qu'un compte vient d'être créé.
 *
 * Adressé à l'équipe, pas à l'inscrit : d'où le vouvoiement absent, le ton factuel,
 * et le lien vers la page d'administration plutôt que vers le site. Rédigé en
 * français seulement — c'est la langue de ceux qui le reçoivent, et une traduction
 * anglaise qui ne sera jamais lue est une clé de plus à maintenir.
 */
export function newAccountEmail(params: {
  displayName: string;
  email: string;
  provider: string;
  url: string;
}): EmailContent {
  const nom = params.displayName.trim() || 'sans nom';
  return {
    subject: `Nouveau compte : ${nom} — ${SITE_NAME}`,
    heading: 'Un compte vient d\'être créé',
    body: `${nom} (${params.email}) s'est inscrit via ${params.provider}.`,
    action: 'Voir les comptes',
    url: params.url,
    footer: 'Message automatique envoyé aux administrateurs à chaque inscription.',
  };
}
