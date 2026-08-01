import createMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';
import { routing } from './i18n/routing';

const intl = createMiddleware(routing);

/**
 * Segments privés, sans préfixe de locale : les URL réelles sont /fr/dashboard et
 * /en/dashboard. Doit rester aligné sur `PUBLIC_EXACT` de (main)/layout.tsx et sur
 * `robots.ts`.
 */
const PRIVATE = [
  'dashboard', 'book', 'sets', 'groups', 'profile', 'admin', 'pending',
  'session', 'join', 'login', 'register',
];

function isPrivate(pathname: string): boolean {
  // /fr/dashboard, /fr/sets/abc, /fr/sheet/abc/edit, /fr/sheet/new
  const withoutLocale = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, '');
  if (withoutLocale === '/sheet/new' || /^\/sheet\/[^/]+\/edit$/.test(withoutLocale)) return true;
  return PRIVATE.some((seg) => withoutLocale === `/${seg}` || withoutLocale.startsWith(`/${seg}/`));
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
