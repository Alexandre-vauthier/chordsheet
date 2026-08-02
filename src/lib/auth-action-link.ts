import { SITE_URL } from '@/lib/seo';

/**
 * Ramène un lien d'action Firebase vers une page de notre site.
 *
 * Firebase produit des liens du type
 * `https://<projet>.firebaseapp.com/__/auth/action?mode=…&oobCode=…`. Le domaine
 * affiché n'a alors rien à voir avec la marque, ce qui inquiète légitimement la
 * personne qui clique — et contredit tout le travail fait sur l'expéditeur.
 *
 * Or seul le `oobCode` porte la sécurité : c'est un jeton à usage unique, vérifié par
 * Firebase au moment où on le présente. La page qui le recueille peut être la nôtre.
 * On extrait donc le code et on reconstruit l'URL chez nous.
 *
 * En cas de forme inattendue, on rend le lien d'origine : un lien laid qui fonctionne
 * vaut mieux qu'un lien à notre marque qui ne mène nulle part.
 */
export function toOwnDomainLink(firebaseLink: string, path: string, locale: string): string {
  try {
    const code = new URL(firebaseLink).searchParams.get('oobCode');
    if (!code) return firebaseLink;
    return `${SITE_URL}/${locale}${path}?oobCode=${encodeURIComponent(code)}`;
  } catch {
    return firebaseLink;
  }
}
