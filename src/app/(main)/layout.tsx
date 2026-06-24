'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { ConcertBanner } from '@/components/layout/concert-banner';

// Routes accessibles sans authentification
const PUBLIC_PREFIXES = ['/legal'];

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isPublic = PUBLIC_PREFIXES.some(p => pathname.startsWith(p));

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

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <ConcertBanner />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
