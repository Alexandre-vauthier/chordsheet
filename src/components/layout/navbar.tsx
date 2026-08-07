'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { useAuth } from '@/lib/auth-context';
import { isPro } from '@/lib/plan-limits';
import { Button } from '@/components/ui/button';
import { BrandLogo } from './brand-logo';
import { Link, usePathname } from '@/i18n/navigation';
import { LanguageSwitcher } from './language-switcher';
import { NotificationBell } from './notification-bell';
import { NavSearch } from './nav-search';
import { NavIcon } from './nav-icon';
import { NavDropdown, NavDropdownSection } from './nav-dropdown';
import { AccountMenu } from './account-menu';
import { MobileNavPanel } from './mobile-nav-panel';
import {
  buildPrimaryNav, resolveHref, isActive,
  type NavContext, type NavEntry, type NavGroup,
} from './nav-items';

/**
 * La barre de navigation.
 *
 * Elle assemble, elle ne décide plus : ce qui s'affiche et pour qui vient de
 * `nav-items.ts`, seul endroit où la navigation est déclarée. La barre et le
 * panneau mobile en découlent tous les deux, si bien qu'ils ne peuvent plus
 * diverger comme ils l'avaient fait.
 *
 * Le seuil de bascule est `md` et non `sm` : la barre complète demande environ
 * 726 px, elle ne tenait pas dans les 640 px où on l'affichait — d'où les
 * chevauchements sur les écrans intermédiaires.
 */
export function Navbar() {
  const t = useTranslations('Navbar');
  const { user, loading, isAdmin } = useAuth();
  const pathname = usePathname();
  const [menuMobileOuvert, setMenuMobileOuvert] = useState(false);

  const ctx: NavContext = {
    signedIn: !!user,
    isAdmin,
    isPro: isPro(user?.subscription),
    userId: user?.id,
  };

  const lienPrimaire = (entree: NavEntry) => (
    <Link
      key={entree.id}
      href={resolveHref(entree, ctx)}
      className={`flex items-center gap-1.5 text-sm transition-colors whitespace-nowrap ${
        isActive(entree, pathname)
          ? 'text-[var(--nav-text)] font-semibold border-b-2 border-[var(--accent)] pb-0.5'
          : 'text-[var(--nav-text)]/70 hover:text-[var(--nav-text)]'
      }`}
    >
      {entree.icon && <NavIcon name={entree.icon} className="w-4 h-4" />}
      {t(entree.labelKey)}
    </Link>
  );

  const menuOutils = (g: NavGroup) => (
    <NavDropdown
      key={g.id}
      label={t(g.labelKey)}
      actif={g.sections.some((s) => s.entries.some((e) => isActive(e, pathname)))}
    >
      {(fermer) => (
        <>
          {g.sections.map((section) => (
            <div key={section.id}>
              {section.labelKey && <NavDropdownSection label={t(section.labelKey)} />}
              {section.entries.map((entree) => (
                <Link
                  key={entree.id}
                  href={resolveHref(entree, ctx)}
                  onClick={fermer}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--ink)] hover:bg-[var(--cell-hover)] transition-colors"
                >
                  {entree.icon && <span className="text-[var(--ink-faint)]"><NavIcon name={entree.icon} /></span>}
                  {t(entree.labelKey)}
                </Link>
              ))}
            </div>
          ))}
        </>
      )}
    </NavDropdown>
  );

  return (
    <nav className="bg-[var(--nav-bg)] sticky top-0 z-[60] print:hidden">
      <div className="w-full px-5 sm:px-8">
        {/* Pas d'`overflow-hidden` ici, malgré la tentation de borner les
            débordements : la rangée ne fait que 56 px de haut, et les menus
            déroulants comme le panneau de notifications pendent en dessous — elle
            les découperait. Le débordement est borné autrement, par `min-w-0` à
            gauche, `shrink-0` à droite et la troncature du nom d'affichage. */}
        <div className="flex items-center justify-between h-14">

          <div className="flex items-center gap-6 min-w-0">
            <Link
              href={user ? '/explore' : '/'}
              className="flex items-center shrink-0"
              onClick={() => setMenuMobileOuvert(false)}
            >
              <BrandLogo />
            </Link>
            {!loading && (
              <div className="hidden md:flex items-center gap-4">
                {buildPrimaryNav(ctx).map((noeud) =>
                  'href' in noeud ? lienPrimaire(noeud) : menuOutils(noeud),
                )}
              </div>
            )}
          </div>

          {/* Bloc droit. Le séparateur sépare enfin ce qu'il annonce : à gauche ce
              que je fais, à droite qui je suis — la cloche relève du second. */}
          <div className="hidden md:flex items-center gap-3 shrink-0">
            {!loading && user ? (
              <>
                <NavSearch variante="barre" />
                {/* Sous 1024 px, le bouton se réduit à son signe : son libellé
                    coûte 47 px là où il en manque, et la loupe voisine est déjà
                    une icône seule. */}
                <Link
                  href="/sheet/new"
                  title={t('newSheet')}
                  className="flex items-center gap-1 px-2.5 lg:px-3 py-1.5 bg-[var(--accent)] hover:bg-[#a83d25] text-white text-sm rounded-lg font-medium transition-colors whitespace-nowrap"
                >
                  <span aria-hidden="true">+</span>
                  <span className="hidden lg:inline">{t('newSheetLabel')}</span>
                </Link>
                <div className="flex items-center gap-3 pl-3 border-l border-white/20">
                  <NotificationBell />
                  <AccountMenu />
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
                  <Button variant="primary" size="sm">{t('register')}</Button>
                </Link>
              </>
            ) : null}
          </div>

          {/* Petit écran : la cloche reste hors du panneau — une notification ne
              doit pas exiger d'ouvrir un menu pour être vue. */}
          <div className="flex md:hidden items-center gap-2">
            {!loading && user && <NotificationBell />}
            {!loading && (
              <button
                type="button"
                onClick={() => setMenuMobileOuvert((v) => !v)}
                aria-label={t('menu')}
                aria-expanded={menuMobileOuvert}
                className="cursor-pointer p-2 text-[var(--nav-text)] hover:bg-white/10 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={menuMobileOuvert ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'}
                  />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {menuMobileOuvert && <MobileNavPanel onClose={() => setMenuMobileOuvert(false)} />}
    </nav>
  );
}
