import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';
import { localeUrl } from '@/lib/seo';

export const revalidate = 86400;

/**
 * Chemins publics, sans préfixe de locale : chacun produit une entrée PAR langue.
 *
 * Le sitemap précédent listait ces chemins bruts (`/explore`…), or `localePrefix`
 * vaut « always » : les dix URL déclarées étaient donc dix redirections 307, et la
 * version anglaise n'était pas soumise du tout.
 *
 * `/login` et `/register` en sont volontairement retirés : ils n'ont aucune valeur
 * pour un moteur, et ils passent en noindex.
 */
const PUBLIC_PATHS: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
  { path: '',                          priority: 1.0, changeFrequency: 'daily' },
  { path: '/explore',                  priority: 0.9, changeFrequency: 'daily' },
  { path: '/chords',                   priority: 0.9, changeFrequency: 'weekly' },
  { path: '/artists',                  priority: 0.8, changeFrequency: 'weekly' },
  { path: '/tuner',                    priority: 0.7, changeFrequency: 'monthly' },
  { path: '/chord-detect',             priority: 0.7, changeFrequency: 'monthly' },
  { path: '/pricing',                  priority: 0.6, changeFrequency: 'monthly' },
  { path: '/about',                    priority: 0.5, changeFrequency: 'yearly' },
  { path: '/faq',                      priority: 0.6, changeFrequency: 'monthly' },
  { path: '/contact',                  priority: 0.4, changeFrequency: 'yearly' },
  { path: '/credits',                  priority: 0.3, changeFrequency: 'yearly' },
  { path: '/legal/cgu',                priority: 0.2, changeFrequency: 'yearly' },
  { path: '/legal/cgv',                priority: 0.2, changeFrequency: 'yearly' },
  { path: '/legal/confidentialite',    priority: 0.2, changeFrequency: 'yearly' },
  { path: '/legal/mentions-legales',   priority: 0.2, changeFrequency: 'yearly' },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return PUBLIC_PATHS.flatMap(({ path, priority, changeFrequency }) => {
    // Les alternates sont identiques pour toutes les langues d'un même chemin :
    // c'est la réciprocité qu'attend Google.
    const languages = Object.fromEntries(routing.locales.map(l => [l, localeUrl(l, path)]));

    return routing.locales.map(locale => ({
      url: localeUrl(locale, path),
      lastModified,
      changeFrequency,
      priority,
      alternates: { languages },
    }));
  });
}
