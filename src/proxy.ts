import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';
import { SITE_URL } from './lib/seo';

const intl = createMiddleware(routing);

/**
 * Segments privés, sans préfixe de locale : les URL réelles sont /fr/dashboard et
 * /en/dashboard. Doit rester aligné sur `PUBLIC_EXACT` de (main)/layout.tsx et sur
 * `robots.ts`.
 */
const PRIVATE = [
  'dashboard', 'book', 'sets', 'groups', 'profile', 'admin', 'pending',
  'session', 'join', 'login', 'register',
  // Pages d'action des mails : leur URL porte un jeton, elles n'ont rien à faire
  // dans un index.
  'reset-password', 'verify-email',
];

function isPrivate(pathname: string): boolean {
  // /fr/dashboard, /fr/sets/abc, /fr/sheet/abc/edit, /fr/sheet/new
  const withoutLocale = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, '');
  if (withoutLocale === '/sheet/new' || /^\/sheet\/[^/]+\/edit$/.test(withoutLocale)) return true;
  return PRIVATE.some((seg) => withoutLocale === `/${seg}` || withoutLocale.startsWith(`/${seg}/`));
}

/**
 * Hôte canonique, déduit de `NEXT_PUBLIC_BASE_URL` — la même variable qui gouverne
 * déjà les canoniques, le sitemap et robots.txt. Il n'y a donc **qu'une** valeur à
 * changer le jour de la bascule de domaine.
 */
const CANONICAL_HOST = (() => {
  try {
    return new URL(SITE_URL).host;
  } catch {
    return '';
  }
})();

/**
 * Un site, une adresse.
 *
 * Quatre extensions réservées, c'est quatre sites identiques si on les laisse toutes
 * répondre : contenu dupliqué, autorité éparpillée, et un moteur qui choisit à notre
 * place laquelle indexer. Les trois autres, plus l'adresse Vercel, renvoient donc en
 * 301 vers l'hôte canonique — permanent, pour que le bénéfice des liens existants
 * suive.
 *
 * Ne s'applique qu'en production : les déploiements de préversion ont un hôte
 * aléatoire, et le développement local tourne sur localhost. Les rediriger vers la
 * production rendrait les deux inutilisables.
 */
function canonicalRedirect(request: NextRequest): NextResponse | null {
  if (process.env.VERCEL_ENV !== 'production') return null;
  if (!CANONICAL_HOST) return null;

  const host = request.headers.get('host');
  if (!host || host === CANONICAL_HOST) return null;

  // Le couple apex / www est arbitré par l'hébergeur, jamais ici.
  //
  // Vercel redirige déjà l'un vers l'autre selon le domaine désigné comme
  // principal. Si nous redirigions dans l'autre sens, les deux se renverraient la
  // balle sans fin et le site deviendrait inaccessible — c'est arrivé. Laisser
  // passer les variantes www est donc une protection, pas un oubli : au pire l'hôte
  // servi diffère de la canonique annoncée, ce que la balise `canonical` règle.
  if (isWwwVariant(host, CANONICAL_HOST)) return null;

  const target = new URL(request.nextUrl.toString());
  target.protocol = 'https:';
  target.host = CANONICAL_HOST;
  target.port = '';

  return NextResponse.redirect(target, 301);
}

/** Les deux hôtes ne diffèrent-ils que par le préfixe `www.` ? */
function isWwwVariant(a: string, b: string): boolean {
  const bare = (h: string) => h.replace(/^www\./, '');
  return a !== b && bare(a) === bare(b);
}

/**
 * `robots.txt` limite l'exploration mais n'empêche pas l'indexation : une URL
 * découverte par un lien externe peut être indexée sans jamais être lue — et une
 * page bloquée par robots.txt ne peut alors même plus être désindexée par une
 * balise `noindex`, puisque le robot ne la lit pas.
 *
 * L'en-tête HTTP, lui, est reçu quoi qu'il arrive. Il sert de filet centralisé,
 * insensible à l'oubli d'un `robots` dans un `generateMetadata`.
 */
export default function proxy(request: NextRequest) {
  // Avant tout le reste : inutile de calculer une locale ou un en-tête pour une
  // réponse qui ne sera qu'une redirection.
  const redirect = canonicalRedirect(request);
  if (redirect) return redirect;

  const response = intl(request);

  if (response && isPrivate(request.nextUrl.pathname)) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }

  return response;
}

export const config = {
  // Exclut les routes API, /export (cible de rendu Puppeteer pour le PDF, jamais
  // visitée par un humain), les fichiers statiques Next.js et les fichiers avec
  // extension (icônes, manifest, etc.) — la locale ne s'applique qu'aux pages.
  matcher: ['/((?!api|export|_next|_vercel|.*\\..*).*)'],
};
