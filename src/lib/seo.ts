import type { Metadata } from 'next';
import { routing } from '@/i18n/routing';

/**
 * Source unique des URL absolues du site.
 *
 * Elle était auparavant redéclarée dans layout.tsx, sitemap.ts et robots.ts, avec
 * le même repli codé en dur — trois endroits à corriger le jour où le domaine change.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_BASE_URL || 'https://alviena.com').replace(/\/$/, '');

export const SITE_NAME = 'Alviena';

/** Codes Open Graph par locale (og:locale attend fr_FR, pas fr). */
export const OG_LOCALE: Record<string, string> = { fr: 'fr_FR', en: 'en_US' };

/** Le site n'est déployé pour de bon qu'en production ; les previews ne doivent pas être indexées. */
export const IS_PRODUCTION = process.env.VERCEL_ENV === 'production' || !process.env.VERCEL_ENV;

/** URL absolue d'un chemin dans une locale. `path` commence par « / », ou vaut « » pour l'accueil. */
export function localeUrl(locale: string, path = ''): string {
  return `${SITE_URL}/${locale}${path}`;
}

/**
 * Canonique + alternates de langue d'une page.
 *
 * Deux règles que Google applique strictement :
 * - la réciprocité (FR doit pointer vers EN *et* EN vers FR), sans quoi l'annotation
 *   entière est ignorée ;
 * - `x-default` désigne la version servie à défaut, ici le français (locale par défaut
 *   du routing).
 *
 * À n'appeler que sur des pages réellement bilingues : annoncer `hreflang="en"` sur du
 * texte français est un signal négatif.
 */
/**
 * Les adresses équivalentes d'une page, dans toutes les langues.
 *
 * Une seule fonction pour les deux endroits qui en ont besoin — le `<head>` d'une
 * page et le sitemap. Ils la calculaient chacun de leur côté, et avaient divergé :
 * le sitemap omettait `x-default` sur ses 1974 entrées, alors que le `<head>` le
 * portait. Google lit les deux et attend le même jeu d'annonces.
 *
 * `x-default` désigne la version servie à qui ne demande aucune de nos langues :
 * le français, puisque c'est la langue par défaut du routage.
 */
export function alternateLanguages(path = ''): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const l of routing.locales) languages[l] = localeUrl(l, path);
  languages['x-default'] = localeUrl(routing.defaultLocale, path);
  return languages;
}

export function buildAlternates(locale: string, path = ''): Metadata['alternates'] {
  return { canonical: localeUrl(locale, path), languages: alternateLanguages(path) };
}

/** Bloc Open Graph commun, avec la locale correcte et les autres langues déclarées. */
export function buildOpenGraph(locale: string, path = ''): Metadata['openGraph'] {
  return {
    url: localeUrl(locale, path),
    siteName: SITE_NAME,
    locale: OG_LOCALE[locale] ?? OG_LOCALE[routing.defaultLocale],
    alternateLocale: routing.locales.filter(l => l !== locale).map(l => OG_LOCALE[l]),
    type: 'website',
    // Visuel de partage commun à tout le site. Il **porte le nom de la marque** : le
    // jour où SITE_NAME change, il faut le régénérer, sans quoi les aperçus de liens
    // continueront d'annoncer l'ancien nom.
    //
    // Une image générée par `opengraph-image.tsx` a été essayée : Next ne la propage
    // pas aux pages qui déclarent elles-mêmes leur bloc `openGraph`, c'est-à-dire
    // presque toutes ici — /tuner et les pages d'accord se retrouvaient sans aucune
    // image. Un fichier statique couvre tout le site sans exception.
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  };
}

/** Pages sans intérêt pour les moteurs (privées, éphémères, personnelles). */
export const NO_INDEX: Metadata['robots'] = { index: false, follow: false };
