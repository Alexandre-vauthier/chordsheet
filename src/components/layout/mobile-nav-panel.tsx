'use client';

import { useTranslations } from 'next-intl';
import { Link, useRouter, usePathname } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth-context';
import { useLiveSession } from '@/lib/live-session-context';
import { isPro } from '@/lib/plan-limits';
import { LanguageSwitcher } from './language-switcher';
import { NavSearch } from './nav-search';
import { NavIcon } from './nav-icon';
import {
  buildPrimaryNav, buildAccountNav, resolveHref, isActive,
  type NavContext, type NavEntry, type NavGroup,
} from './nav-items';

/**
 * Le menu déplié du petit écran.
 *
 * Il est nourri par **les mêmes fonctions** que la barre et le menu de compte. La
 * version précédente était écrite à la main de son côté, et avait fini par perdre
 * en route la bibliothèque d'accords, les sets et la file de validation — chacun
 * ajouté d'un seul côté, un jour, sans que l'autre le sache.
 *
 * Un menu déroulant n'a pas de sens ici : on aplatit le groupe en section titrée,
 * ce qui évite un état d'ouverture, une animation, et le souvenir de cet état d'une
 * ouverture à l'autre.
 */
export function MobileNavPanel({ onClose }: { onClose: () => void }) {
  const t = useTranslations('Navbar');
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAdmin, signOut } = useAuth();
  const { session } = useLiveSession();

  const ctx: NavContext = {
    signedIn: !!user,
    isAdmin,
    isPro: isPro(user?.subscription),
    userId: user?.id,
  };

  const ligne = (entree: NavEntry) => (
    <Link
      key={entree.id}
      href={resolveHref(entree, ctx)}
      onClick={onClose}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
        isActive(entree, pathname)
          ? 'text-[var(--nav-text)] bg-white/10 font-semibold'
          : 'text-[var(--nav-text)]/70 hover:text-[var(--nav-text)] hover:bg-white/10'
      }`}
    >
      {entree.icon && (
        <span
          className={
            entree.id === 'live'
              ? session ? 'text-red-500 animate-pulse' : 'text-[var(--nav-text)]/50'
              : 'text-[var(--nav-text)]/50'
          }
        >
          <NavIcon name={entree.icon} />
        </span>
      )}
      {t(entree.labelKey)}
    </Link>
  );

  const groupe = (g: NavGroup) => (
    <div key={g.id} className="pt-2">
      {g.sections.map((section) => (
        <div key={section.id}>
          <p className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-wide text-[var(--nav-text)]/40">
            {t(section.labelKey ?? g.labelKey)}
          </p>
          {section.entries.map(ligne)}
        </div>
      ))}
    </div>
  );

  return (
    <div className="md:hidden bg-[var(--nav-bg)] border-t border-white/10">
      <div className="px-4 py-3 space-y-1">
        <NavSearch variante="panneau" onNavigate={onClose} />

        {buildPrimaryNav(ctx).map((noeud) =>
          'href' in noeud ? ligne(noeud) : groupe(noeud),
        )}

        {user ? (
          <>
            <div className="border-t border-white/10 my-2" />
            <Link
              href="/sheet/new"
              onClick={onClose}
              className="flex items-center gap-1 px-3 py-2 bg-[var(--accent)] text-white rounded-lg font-medium text-sm transition-colors hover:bg-[#a83d25]"
            >
              {t('newSheetMobile')}
            </Link>

            {buildAccountNav(ctx).map((section) => (
              <div key={section.id}>{section.entries.map(ligne)}</div>
            ))}

            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-sm text-[var(--nav-text)]/50">{t('language')}</span>
              <LanguageSwitcher />
            </div>
            <button
              type="button"
              onClick={async () => { onClose(); await signOut(); router.push('/login'); }}
              className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
            >
              {t('signOut')}
            </button>
          </>
        ) : (
          <>
            <div className="border-t border-white/10 my-2" />
            {/* Le pendant du bouton de la barre : sur petit écran il n'y a pas de
                bloc droit, tout se joue ici. Contour d'accent, l'aplat restant à
                l'inscription juste dessous. */}
            <Link
              href={`/register?next=${encodeURIComponent('/sheet/new')}`}
              onClick={onClose}
              className="block px-3 py-2 rounded-lg text-sm text-center font-medium border border-[var(--accent)]/70 text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors"
            >
              {t('newSheetFull')}
            </Link>
            <Link
              href="/login"
              onClick={onClose}
              className="block px-3 py-2 rounded-lg text-sm text-[var(--nav-text)]/70 hover:text-[var(--nav-text)] hover:bg-white/10 transition-colors"
            >
              {t('login')}
            </Link>
            <Link
              href="/register"
              onClick={onClose}
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
  );
}
