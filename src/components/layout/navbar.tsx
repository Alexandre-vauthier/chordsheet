'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { LevelBadge } from '@/components/reputation/level-badge';
import { BrandLogo } from './brand-logo';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { LanguageSwitcher } from './language-switcher';
import { NotificationBell } from './notification-bell';
import { NavSearch } from './nav-search';
import { useClickOutside } from '@/lib/use-click-outside';

export function Navbar() {
  const t = useTranslations('Navbar');
  const { user, loading, isAdmin, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useClickOutside<HTMLDivElement>(() => setProfileMenuOpen(false), profileMenuOpen);

  const handleSignOut = async () => {
    setProfileMenuOpen(false);
    await signOut();
    router.push('/login');
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  /**
   * Les mêmes rubriques pour tout le monde.
   *
   * Un visiteur sans compte ne voyait que « Connexion » : rien ne lui disait ce que
   * le site contient. Les rubriques publiques mènent directement au contenu ; les
   * deux qui exigent un compte passent par la connexion, en retenant la destination
   * pour y revenir une fois identifié — sinon on demande de se connecter puis on
   * dépose ailleurs, ce qui est doublement décourageant.
   */
  const navLinks = [
    { href: '/dashboard', label: t('book'), private: true },
    { href: '/groups', label: t('bands'), private: true },
    { href: '/explore', label: t('explore'), private: false },
    { href: '/artists', label: t('artists'), private: false },
    { href: '/chords', label: t('chords'), private: false },
    { href: '/tuner', label: t('tuner'), private: false },
  ].map((link) => ({
    ...link,
    href: !user && link.private ? `/login?next=${encodeURIComponent(link.href)}` : link.href,
  }));

  return (
    <nav className="bg-[var(--nav-bg)] text-[var(--nav-text)] sticky top-0 z-[60]">
      <div className="w-full px-5 sm:px-8">
        {/* `overflow-hidden` sur la rangée : un libellé trop long tronque le groupe
            le moins critique au lieu de faire défiler la page entière de côté. */}
        <div className="flex items-center justify-between h-14 overflow-hidden">

          {/* GAUCHE : Logo + liens de navigation */}
          <div className="flex items-center gap-6 min-w-0">
            <Link href={user ? '/explore' : '/'} className="flex items-center shrink-0" onClick={closeMobileMenu}>
              <BrandLogo />
            </Link>
            {!loading && (
              <div className="hidden sm:flex items-center gap-4">
                {navLinks.map(({ href, label }) => (
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
          <div className="hidden sm:flex items-center gap-3 shrink-0">
            {!loading && user ? (
              <>
                <NavSearch variante="barre" />
                <NotificationBell />
                <Link
                  href="/sheet/new"
                  className="flex items-center gap-1 px-3 py-1.5 bg-[var(--accent)] hover:bg-[#a83d25] text-white text-sm rounded-lg font-medium transition-colors"
                >
                  {t('newSheet')}
                </Link>
                <div className="flex items-center gap-3 pl-3 border-l border-white/20">
                  {isAdmin && (
                    <>
                      <Link
                        href="/pending"
                        className="text-sm px-2 py-1 bg-amber-500/20 text-amber-300 rounded hover:bg-amber-500/30 transition-colors"
                      >
                        {t('pendingValidation')}
                      </Link>
                      <Link
                        href="/admin"
                        className="text-sm px-2 py-1 bg-red-500/20 text-red-300 rounded hover:bg-red-500/30 transition-colors"
                      >
                        {t('admin')}
                      </Link>
                    </>
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
                      <span className="hidden lg:inline max-w-[10rem] truncate">{user.displayName || user.email}</span>
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
                            {t('publicProfile')}
                          </Link>
                          <Link
                            href="/dashboard"
                            onClick={() => setProfileMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--ink)] hover:bg-[var(--cell-hover)] transition-colors"
                          >
                            <svg className="w-4 h-4 text-[var(--ink-faint)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
                            </svg>
                            {t('book')}
                          </Link>
                          <Link
                            href="/sets"
                            onClick={() => setProfileMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--ink)] hover:bg-[var(--cell-hover)] transition-colors"
                          >
                            <svg className="w-4 h-4 text-[var(--ink-faint)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"/>
                            </svg>
                            {t('mySets')}
                          </Link>
                          <Link
                            href="/session"
                            onClick={() => setProfileMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--ink)] hover:bg-[var(--cell-hover)] transition-colors"
                          >
                            <span className="w-4 h-4 flex items-center justify-center shrink-0">
                              <span className="w-2 h-2 rounded-full bg-red-500" />
                            </span>
                            {t('liveSession')}
                          </Link>
                          <div className="mx-3 my-1 border-t border-[var(--line)]" />
                          <Link
                            href="/profile"
                            onClick={() => setProfileMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--ink)] hover:bg-[var(--cell-hover)] transition-colors"
                          >
                            <svg className="w-4 h-4 text-[var(--ink-faint)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3"/>
                            </svg>
                            {t('settings')}
                          </Link>
                          <div className="mx-3 my-1 border-t border-[var(--line)]" />
                          <div className="px-4 py-2 flex items-center justify-between">
                            <span className="text-sm text-[var(--ink-faint)]">{t('language')}</span>
                            <LanguageSwitcher />
                          </div>
                          <div className="mx-3 my-1 border-t border-[var(--line)]" />
                          <button
                            onClick={handleSignOut}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                            </svg>
                            {t('signOut')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : !loading ? (
              <>
                <LanguageSwitcher />
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="border-white/25 text-[var(--nav-text)]">
                    {t('login')}
                  </Button>
                </Link>
                <Link href="/register">
                  <Button variant="primary" size="sm">
                    {t('register')}
                  </Button>
                </Link>
              </>
            ) : null}
          </div>

          {/* Mobile: Burger + Actions */}
          <div className="flex sm:hidden items-center gap-2">
            {!loading && user && <NotificationBell />}
            {!loading && (
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="cursor-pointer p-2 text-[var(--nav-text)] hover:bg-white/10 rounded-lg transition-colors"
                aria-label={t('menu')}
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
              <>
                <LanguageSwitcher />
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="border-white/25 text-[var(--nav-text)]">
                    {t('login')}
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="sm:hidden bg-[var(--nav-bg)] border-t border-white/10">
          <div className="px-4 py-3 space-y-1">
            <NavSearch variante="panneau" onNavigate={closeMobileMenu} />
            {navLinks.filter((l) => l.href !== '/chords').map(({ href, label }) => (
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
            {/* Le reste du menu n'a de sens qu'avec un compte : créer une grille,
                son profil, ses réglages. Sans compte, on propose d'en ouvrir un. */}
            {user ? (
              <>
              <Link
                href="/sheet/new"
                onClick={closeMobileMenu}
                className="flex items-center gap-1 px-3 py-2 bg-[var(--accent)] text-white rounded-lg font-medium text-sm transition-colors hover:bg-[#a83d25]"
              >
                {t('newSheetMobile')}
              </Link>
              <div className="border-t border-white/10 my-2" />
              {/* Profil : un seul lien (le profil donne accès aux grilles et sets) */}
              <Link
                href={`/user/${user.id}`}
                onClick={closeMobileMenu}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full object-cover" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-xs font-bold">
                    {user.displayName?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-sm font-medium text-[var(--nav-text)]">{user.displayName || user.email}</span>
                <svg className="w-4 h-4 ml-auto text-[var(--nav-text)]/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
              <Link
                href="/session"
                onClick={closeMobileMenu}
                className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--nav-text)]/70 hover:text-[var(--nav-text)] hover:bg-white/10 rounded-lg transition-colors"
              >
                <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                {t('liveSession')}
              </Link>
              <Link
                href="/profile"
                onClick={closeMobileMenu}
                className="block px-3 py-2 text-sm text-[var(--nav-text)]/70 hover:text-[var(--nav-text)] hover:bg-white/10 rounded-lg transition-colors"
              >
                {t('settings')}
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={closeMobileMenu}
                  className="block px-3 py-2 text-sm text-red-300 hover:bg-red-500/20 rounded-lg transition-colors"
                >
                  {t('administration')}
                </Link>
              )}
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-sm text-[var(--nav-text)]/50">{t('language')}</span>
                <LanguageSwitcher />
              </div>
              <button
                onClick={handleSignOut}
                className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
              >
                {t('signOut')}
              </button>
              </>
            ) : (
              <>
                <div className="border-t border-white/10 my-2" />
                <Link
                  href="/login"
                  onClick={closeMobileMenu}
                  className="block px-3 py-2 rounded-lg text-sm text-[var(--nav-text)]/70 hover:text-[var(--nav-text)] hover:bg-white/10 transition-colors"
                >
                  {t('login')}
                </Link>
                <Link
                  href="/register"
                  onClick={closeMobileMenu}
                  className="block px-3 py-2 bg-[var(--accent)] text-white rounded-lg font-medium text-sm text-center transition-colors hover:bg-[#a83d25]"
                >
                  {t('register')}
                </Link>
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm text-[var(--nav-text)]/50">{t('language')}</span>
                  <LanguageSwitcher />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
