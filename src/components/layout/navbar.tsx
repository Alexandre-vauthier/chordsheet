'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';

export function Navbar() {
  const { user, loading, isAdmin } = useAuth();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <nav className="bg-[var(--nav-bg)] text-[var(--nav-text)] sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href={user ? '/explore' : '/'} className="flex items-center" onClick={closeMobileMenu}>
            <span className="font-playfair text-xl font-bold">
              Chord<span className="text-[var(--accent)]">Sheet</span>
            </span>
          </Link>

          {/* Navigation Desktop */}
          <div className="hidden sm:flex items-center gap-4">
            {loading ? (
              <div className="h-8 w-24 bg-white/10 rounded animate-pulse" />
            ) : user ? (
              <>
                {[
                  { href: '/dashboard', label: 'Mon book' },
                  { href: '/sets', label: 'Mes sets' },
                  { href: '/explore', label: 'Explorer' },
                  { href: '/chords', label: 'Accords' },
                ].map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className={`text-sm transition-colors ${
                      pathname.startsWith(href)
                        ? 'text-[var(--nav-text)] font-semibold border-b-2 border-[var(--accent)] pb-0.5'
                        : 'text-[var(--nav-text)]/70 hover:text-[var(--nav-text)]'
                    }`}
                  >
                    {label}
                  </Link>
                ))}
                <Link
                  href="/sheet/new"
                  className="flex items-center gap-1 px-3 py-1.5 bg-[var(--accent)] hover:bg-[#a83d25] text-white text-sm rounded-lg font-medium transition-colors"
                >
                  + Grille
                </Link>
                <div className="flex items-center gap-3 ml-2 pl-4 border-l border-white/20">
                  {isAdmin && (
                    <Link
                      href="/admin"
                      className="text-sm px-2 py-1 bg-red-500/20 text-red-300 rounded hover:bg-red-500/30 transition-colors"
                    >
                      Admin
                    </Link>
                  )}
                  <Link
                    href="/profile"
                    className="flex items-center gap-2 text-sm text-[var(--nav-text)]/70 hover:text-[var(--nav-text)] transition-colors"
                  >
                    <div className="w-6 h-6 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-xs font-bold">
                      {user.displayName?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()}
                    </div>
                    <span>{user.displayName || user.email}</span>
                  </Link>
                </div>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="border-white/25 text-[var(--nav-text)]">
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

          {/* Mobile: Burger + Actions */}
          <div className="flex sm:hidden items-center gap-2">
            {!loading && user && (
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-[var(--nav-text)] hover:bg-white/10 rounded-lg transition-colors"
                aria-label="Menu"
              >
                {mobileMenuOpen ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            )}
            {!loading && !user && (
              <Link href="/login">
                <Button variant="ghost" size="sm" className="border-white/25 text-[var(--nav-text)]">
                  Connexion
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && user && (
        <div className="sm:hidden bg-[var(--nav-bg)] border-t border-white/10">
          <div className="px-4 py-3 space-y-1">
            {[
              { href: '/dashboard', label: 'Mon book' },
              { href: '/sets', label: 'Mes sets' },
              { href: '/explore', label: 'Explorer' },
              // { href: '/chords', label: 'Accords' },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={closeMobileMenu}
                className={`block px-3 py-2 rounded-lg transition-colors ${
                  pathname.startsWith(href)
                    ? 'text-[var(--nav-text)] bg-white/10 font-semibold'
                    : 'text-[var(--nav-text)]/70 hover:text-[var(--nav-text)] hover:bg-white/10'
                }`}
              >
                {label}
              </Link>
            ))}
            <Link
              href="/sheet/new"
              onClick={closeMobileMenu}
              className="flex items-center gap-1 px-3 py-2 bg-[var(--accent)] text-white rounded-lg font-medium text-sm transition-colors hover:bg-[#a83d25]"
            >
              + Nouvelle grille
            </Link>
            <div className="border-t border-white/10 my-2" />
            <Link
              href="/profile"
              onClick={closeMobileMenu}
              className="flex items-center gap-2 px-3 py-2 text-[var(--nav-text)]/70 hover:text-[var(--nav-text)] hover:bg-white/10 rounded-lg transition-colors"
            >
              <div className="w-6 h-6 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-xs font-bold">
                {user.displayName?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()}
              </div>
              <span>Profil</span>
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                onClick={closeMobileMenu}
                className="block px-3 py-2 text-red-300 hover:bg-red-500/20 rounded-lg transition-colors"
              >
                Administration
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
