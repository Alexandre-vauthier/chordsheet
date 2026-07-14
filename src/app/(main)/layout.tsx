'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { ConcertBanner } from '@/components/layout/concert-banner';
import { EmailVerificationGate } from '@/components/layout/email-verification-gate';

// Routes accessibles sans authentification (contenu public en lecture seule)
const PUBLIC_EXACT = ['/explore', '/chords', '/pricing'];
const PUBLIC_PREFIXES = ['/legal'];
// /sheet/:id (mais pas /sheet/new ni /sheet/:id/edit), /artist/:name, /user/:id
const PUBLIC_PATTERNS = [/^\/sheet\/[^/]+$/, /^\/artist\/[^/]+$/, /^\/user\/[^/]+$/];

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--accent)] border-t-transparent" />
      </div>
    );
  }

  if (!user && !isPublic) {
    return null;
  }

  if (user && !isPublic && !isAdmin && !emailVerified) {
    return <EmailVerificationGate />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <ConcertBanner />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
