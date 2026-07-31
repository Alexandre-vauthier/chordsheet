import type { MetadataRoute } from 'next';
import { SITE_URL, IS_PRODUCTION } from '@/lib/seo';

/**
 * Les chemins privés doivent porter un joker de locale : les URL réelles sont
 * /fr/dashboard et /en/dashboard, or le filtrage robots.txt se fait sur un préfixe
 * strict — « /dashboard » ne matchait donc aucune URL du site, et toutes les règles
 * privées étaient sans effet.
 *
 * /api/ et /export/ restent sans locale : ils sont exclus du proxy next-intl.
 */
const PRIVATE_PATHS = [
  'dashboard', 'book', 'sets', 'groups', 'profile', 'admin', 'pending',
  'session', 'join', 'login', 'register',
  'sheet/new', 'sheet/*/edit',
];

export default function robots(): MetadataRoute.Robots {
  // Un déploiement de prévisualisation sert le site entier sur une autre URL :
  // le laisser indexer dupliquerait tout le contenu.
  if (!IS_PRODUCTION) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/export/', ...PRIVATE_PATHS.map(p => `/*/${p}`)],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
