'use client';

import { useEffect } from 'react';

import { useAuth } from '@/lib/auth-context';
import { LiveSessionProvider } from '@/lib/live-session-context';
import { AddToCollectionProvider } from '@/lib/add-to-collection-context';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { ConcertBanner } from '@/components/layout/concert-banner';
import { LiveSessionBanner } from '@/components/layout/live-session-banner';
import { EmailVerificationGate } from '@/components/layout/email-verification-gate';
import { usePathname, useRouter } from '@/i18n/navigation';

// Routes accessibles sans authentification (contenu public en lecture seule).
// /about, /faq, /credits sont liées depuis le pied de page : les garder privées
// envoyait les visiteurs sur /login depuis nos propres liens.
const PUBLIC_EXACT = [
  '/explore', '/chords', '/chord-detect', '/tuner', '/pricing', '/contact',
  '/about', '/faq', '/credits', '/artists',
  // Guides éditoriaux : pages publiques sans aucune donnée utilisateur.
  '/import-chords', '/transpose', '/sheet-photo',
  '/bands', '/stage-mode', '/audio-to-chords', '/editor', '/print',
];
const PUBLIC_PREFIXES = ['/legal', '/chords/'];
// /sheet/:id (mais pas /sheet/new ni /sheet/:id/edit), /artist/:name, /user/:id,
// /song/:titre/:artiste, /session/:code (rejoindre une session éphémère sans compte
// — pas /session lui-même, qui reste réservé aux hôtes Pro connectés)
const PUBLIC_PATTERNS = [
  /^\/sheet\/[^/]+$/, /^\/artist\/[^/]+$/, /^\/user\/[^/]+$/,
  /^\/song\/[^/]+\/[^/]+$/, /^\/session\/[^/]+$/,
];

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_EXACT.includes(pathname)) return true;
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) return true;
  if (pathname === '/sheet/new') return false;
  return PUBLIC_PATTERNS.some(re => re.test(pathname));
}

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, isAdmin, emailVerified } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isPublic = isPublicRoute(pathname);

  useEffect(() => {
    if (!loading && !user && !isPublic) {
      router.replace('/login');
    }
  }, [user, loading, router, isPublic]);

  // Les gardes ne s'appliquent QU'AUX routes privées. Une page publique doit se
  // rendre immédiatement, sans attendre l'état d'authentification : côté serveur
  // `loading` vaut toujours true (onAuthStateChanged n'y existe pas), si bien que
  // ce retour anticipé émettait un écran d'attente au lieu du contenu — et privait
  // les moteurs de recherche de l'intégralité des pages publiques.
  if (!isPublic) {
    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--accent)] border-t-transparent" />
        </div>
      );
    }

    if (!user) {
      return null;
    }

    if (!isAdmin && !emailVerified) {
      return <EmailVerificationGate />;
    }
  }

  return (
    <LiveSessionProvider>
      <AddToCollectionProvider>
        <div className="min-h-screen flex flex-col">
          <Navbar />
          <ConcertBanner />
          <LiveSessionBanner />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
      </AddToCollectionProvider>
    </LiveSessionProvider>
  );
}
