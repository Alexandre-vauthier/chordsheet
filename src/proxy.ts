import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Exclut les routes API, /export (cible de rendu Puppeteer pour le PDF, jamais
  // visitée par un humain), les fichiers statiques Next.js et les fichiers avec
  // extension (icônes, manifest, etc.) — la locale ne s'applique qu'aux pages.
  matcher: ['/((?!api|export|_next|_vercel|.*\\..*).*)'],
};
