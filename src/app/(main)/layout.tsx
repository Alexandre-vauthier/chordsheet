'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Navbar } from '@/components/layout/navbar';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

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

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-[var(--line)] bg-white py-6 px-4 sm:px-6 print:hidden">
        <div className="max-w-6xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-faint)] mb-3">
            Bibliothèque d&apos;accords
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {[
              { id: 'guitar', label: 'Guitare' },
              { id: 'ukulele', label: 'Ukulélé' },
              { id: 'piano', label: 'Piano' },
              { id: 'mandolin', label: 'Mandoline' },
              { id: 'banjo', label: 'Banjo' },
            ].map(({ id, label }) => (
              <span key={id} className="flex items-center gap-2 text-sm">
                <span className="text-[var(--ink-light)] font-medium">{label} :</span>
                {['major', 'minor', 'other'].map((cat) => (
                  <a
                    key={cat}
                    href={`/chords?instrument=${id}&category=${cat}`}
                    className="text-[var(--ink-faint)] hover:text-[var(--accent)] transition-colors"
                  >
                    {cat === 'major' ? 'Majeurs' : cat === 'minor' ? 'Mineurs' : 'Autres'}
                  </a>
                ))}
              </span>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
