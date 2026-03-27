'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';

export function Navbar() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  return (
    <nav className="bg-[var(--ink)] text-[var(--cream)] sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href={user ? '/dashboard' : '/'} className="flex items-center">
            <span className="font-playfair text-xl font-bold">
              Chord<span className="text-[var(--accent)]">Sheet</span>
            </span>
          </Link>

          {/* Navigation */}
          <div className="flex items-center gap-2 sm:gap-4">
            {loading ? (
              <div className="h-8 w-24 bg-white/10 rounded animate-pulse" />
            ) : user ? (
              <>
                <Link
                  href="/dashboard"
                  className="text-sm text-[var(--cream)]/80 hover:text-[var(--cream)] transition-colors hidden sm:block"
                >
                  Mes grilles
                </Link>
                <Link
                  href="/book"
                  className="text-sm text-[var(--cream)]/80 hover:text-[var(--cream)] transition-colors hidden sm:block"
                >
                  Mon book
                </Link>
                <Link
                  href="/sets"
                  className="text-sm text-[var(--cream)]/80 hover:text-[var(--cream)] transition-colors hidden sm:block"
                >
                  Mes sets
                </Link>
                <Link
                  href="/explore"
                  className="text-sm text-[var(--cream)]/80 hover:text-[var(--cream)] transition-colors hidden sm:block"
                >
                  Explorer
                </Link>
                <Link
                  href="/sheet/new"
                  className="text-sm px-3 py-1.5 bg-[var(--accent)] rounded-md hover:opacity-90 transition-opacity"
                >
                  + Nouvelle
                </Link>
                <div className="flex items-center gap-3 ml-2 pl-4 border-l border-white/20">
                  <Link
                    href="/profile"
                    className="flex items-center gap-2 text-sm text-[var(--cream)]/70 hover:text-[var(--cream)] transition-colors hidden sm:flex"
                  >
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName}
                        className="w-6 h-6 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-xs font-bold">
                        {user.displayName?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span>{user.displayName || user.email}</span>
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="text-sm text-[var(--cream)]/60 hover:text-[var(--cream)] transition-colors"
                  >
                    Déconnexion
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="border-white/25 text-[var(--cream)]">
                    Connexion
                  </Button>
                </Link>
                <Link href="/register">
                  <Button variant="primary" size="sm">
                    Inscription
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
