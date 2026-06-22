'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { LevelBadge } from '@/components/reputation/level-badge';

export function Navbar() {
  const { user, loading, isAdmin, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    setProfileMenuOpen(false);
    await signOut();
    router.push('/login');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchValue.trim();
    router.push(q ? `/explore?q=${encodeURIComponent(q)}` : '/explore');
    setSearchValue('');
    searchInputRef.current?.blur();
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <nav className="bg-[var(--nav-bg)] text-[var(--nav-text)] sticky top-0 z-[60]">
      <div className="w-full px-5 sm:px-8">
        <div className="flex items-center justify-between h-14">

          {/* GAUCHE : Logo + liens de navigation */}
          <div className="flex items-center gap-6">
            <Link href={user ? '/explore' : '/'} className="flex items-center shrink-0" onClick={closeMobileMenu}>
              <Image src="/logo-chordsheet.svg" alt="ChordSheet" height={32} width={140} priority />
            </Link>
            {!loading && user && (
              <div className="hidden sm:flex items-center gap-4">
                {[
                  { href: '/dashboard', label: 'Mon book' },
                  { href: '/groups', label: 'Groupes' },
                  { href: '/explore', label: 'Explorer' },
                  { href: '/artists', label: 'Artistes' },
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
              </div>
            )}
            {loading && <div className="hidden sm:block h-5 w-32 bg-white/10 rounded animate-pulse" />}
          </div>

          {/* DROITE : actions */}
          <div className="hidden sm:flex items-center gap-3">
            {!loading && user ? (
              <>
                {/* Recherche — icône uniquement, s'ouvre au clic */}
                {searchOpen ? (
                  <form onSubmit={e => { handleSearch(e); setSearchOpen(false); }} className="relative">
                    <input
                      ref={searchInputRef}
                      type="text"
                      autoFocus
                      value={searchValue}
                      onChange={e => setSearchValue(e.target.value)}
                      onBlur={() => { if (!searchValue.trim()) setSearchOpen(false); }}
                      onKeyDown={e => e.key === 'Escape' && setSearchOpen(false)}
                      placeholder="Rechercher…"
                      className="w-44 pl-8 pr-3 py-1.5 rounded-lg text-sm bg-white/10 text-[var(--nav-text)] placeholder:text-[var(--nav-text)]/50 border border-white/15 outline-none focus:bg-white/15 focus:border-white/30 transition-all"
                    />
                    <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--nav-text)]/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                    </svg>
                  </form>
                ) : (
                  <button
                    onClick={() => setSearchOpen(true)}
                    className="p-1.5 rounded-lg text-[var(--nav-text)]/70 hover:text-[var(--nav-text)] hover:bg-white/10 transition-colors"
                    title="Rechercher"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                    </svg>
                  </button>
                )}
                <Link
                  href="/sheet/new"
                  className="flex items-center gap-1 px-3 py-1.5 bg-[var(--accent)] hover:bg-[#a83d25] text-white text-sm rounded-lg font-medium transition-colors"
                >
                  + Grille
                </Link>
                <div className="flex items-center gap-3 pl-3 border-l border-white/20">
                  {isAdmin && (
                    <Link
                      href="/admin"
                      className="text-sm px-2 py-1 bg-red-500/20 text-red-300 rounded hover:bg-red-500/30 transition-colors"
                    >
                      Admin
                    </Link>
                  )}
                  {/* Menu profil */}
                  <div className="relative" ref={profileMenuRef}>
                    <button
                      onClick={() => setProfileMenuOpen(v => !v)}
                      className="flex items-center gap-2 text-sm text-[var(--nav-text)]/70 hover:text-[var(--nav-text)] transition-colors cursor-pointer"
                    >
                      {user.photoURL ? (
                        <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full object-cover" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-xs font-bold">
                          {user.displayName?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="hidden lg:inline">{user.displayName || user.email}</span>
                      {user.reputation && user.reputation.level !== 'Découvreur' && (
                        <span className="hidden lg:inline"><LevelBadge level={user.reputation.level} /></span>
                      )}
                      <svg className={`w-3.5 h-3.5 transition-transform ${profileMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                      </svg>
                    </button>
                    {profileMenuOpen && (
                      <div className="absolute right-0 top-full mt-2 w-56 bg-[var(--cell-bg)] border border-[var(--line)] rounded-xl shadow-lg overflow-hidden z-[60]">
                        <div className="px-4 py-3 border-b border-[var(--line)]">
                          <p className="text-sm font-semibold text-[var(--ink)] truncate">{user.displayName || user.email}</p>
                          {user.reputation && user.reputation.level !== 'Découvreur' && (
                            <div className="mt-1"><LevelBadge level={user.reputation.level} /></div>
                          )}
                        </div>
                        <div className="py-1">
                          <Link
                            href={`/user/${user.id}`}
                            onClick={() => setProfileMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--ink)] hover:bg-[var(--cell-hover)] transition-colors"
                          >
                            <svg className="w-4 h-4 text-[var(--ink-faint)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                            </svg>
                            Mon profil public
                          </Link>
                          <Link
                            href="/profile"
                            onClick={() => setProfileMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--ink)] hover:bg-[var(--cell-hover)] transition-colors"
                          >
                            <svg className="w-4 h-4 text-[var(--ink-faint)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3"/>
                            </svg>
                            Paramètres
                          </Link>
                          <div className="mx-3 my-1 border-t border-[var(--line)]" />
                          <button
                            onClick={handleSignOut}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                            </svg>
                            Se déconnecter
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : !loading ? (
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
            ) : null}
          </div>

          {/* Mobile: Burger + Actions */}
          <div className="flex sm:hidden items-center gap-2">
            {!loading && user && (
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="cursor-pointer p-2 text-[var(--nav-text)] hover:bg-white/10 rounded-lg transition-colors"
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
            {/* Recherche mobile */}
            <form onSubmit={handleSearch} className="relative mb-2">
              <input
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Rechercher…"
                className="w-full pl-8 pr-3 py-2 rounded-lg text-sm bg-white/10 text-[var(--nav-text)] placeholder:text-[var(--nav-text)]/50 border border-white/15 outline-none focus:bg-white/15 focus:border-white/30 transition-all"
              />
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--nav-text)]/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
            </form>
            {[
              { href: '/dashboard', label: 'Mon book' },
              { href: '/groups', label: 'Groupes' },
              { href: '/explore', label: 'Explorer' },
              { href: '/artists', label: 'Artistes' },
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
            {/* Identité */}
            <div className="flex items-center gap-2 px-3 py-2">
              {user.photoURL ? (
                <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full object-cover" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-xs font-bold">
                  {user.displayName?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-sm font-medium text-[var(--nav-text)]">{user.displayName || user.email}</span>
            </div>
            <Link
              href={`/user/${user.id}`}
              onClick={closeMobileMenu}
              className="block px-3 py-2 text-sm text-[var(--nav-text)]/70 hover:text-[var(--nav-text)] hover:bg-white/10 rounded-lg transition-colors"
            >
              Mon profil public
            </Link>
            <Link
              href="/profile"
              onClick={closeMobileMenu}
              className="block px-3 py-2 text-sm text-[var(--nav-text)]/70 hover:text-[var(--nav-text)] hover:bg-white/10 rounded-lg transition-colors"
            >
              Paramètres
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                onClick={closeMobileMenu}
                className="block px-3 py-2 text-sm text-red-300 hover:bg-red-500/20 rounded-lg transition-colors"
              >
                Administration
              </Link>
            )}
            <button
              onClick={handleSignOut}
              className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
            >
              Se déconnecter
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
