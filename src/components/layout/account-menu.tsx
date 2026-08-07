'use client';

import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth-context';
import { isPro } from '@/lib/plan-limits';
import { LevelBadge } from '@/components/reputation/level-badge';
import { LanguageSwitcher } from './language-switcher';
import { NavDropdown, NavDropdownSeparator } from './nav-dropdown';
import { NavIcon } from './nav-icon';
import { buildAccountNav, resolveHref, type NavContext } from './nav-items';

/**
 * Le menu « moi » : ce qui m'appartient, mes réglages, et la sortie.
 *
 * Les deux pastilles d'administration y descendent depuis la barre, où elles
 * occupaient cent cinquante-neuf pixels dans la zone la plus disputée pour une
 * poignée de personnes. « Mon book » en sort au contraire : il est désormais
 * primaire dans la barre, et le répéter ici ne ferait que diluer le menu.
 *
 * Son contenu vient des mêmes fonctions que le panneau mobile : c'est ce qui
 * empêche les deux de diverger comme ils l'avaient fait.
 */
export function AccountMenu() {
  const t = useTranslations('Navbar');
  const router = useRouter();
  const { user, isAdmin, signOut } = useAuth();

  if (!user) return null;

  const ctx: NavContext = {
    signedIn: true,
    isAdmin,
    isPro: isPro(user.subscription),
    userId: user.id,
  };
  const sections = buildAccountNav(ctx);
  const niveau = user.reputation && user.reputation.level !== 'Découvreur' ? user.reputation.level : null;

  return (
    <NavDropdown
      align="right"
      label={
        <>
          <span className="hidden lg:inline max-w-[10rem] truncate">{user.displayName || user.email}</span>
          {niveau && <span className="hidden lg:inline"><LevelBadge level={niveau} /></span>}
        </>
      }
      icon={
        user.photoURL
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full object-cover" />
          : (
            <span className="w-7 h-7 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-xs font-bold">
              {(user.displayName || user.email || '?').charAt(0).toUpperCase()}
            </span>
          )
      }
    >
      {(fermer) => (
        <>
          <div className="px-4 py-3 border-b border-[var(--line)]">
            <p className="text-sm font-semibold text-[var(--ink)] truncate">{user.displayName || user.email}</p>
            {niveau && <div className="mt-1"><LevelBadge level={niveau} /></div>}
          </div>

          {sections.map((section, i) => (
            <div key={section.id}>
              {i > 0 && <NavDropdownSeparator />}
              {section.entries.map((entree) => (
                <Link
                  key={entree.id}
                  href={resolveHref(entree, ctx)}
                  onClick={fermer}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--ink)] hover:bg-[var(--cell-hover)] transition-colors"
                >
                  {entree.icon && (
                    <span className={entree.id === 'live' ? 'text-red-500' : 'text-[var(--ink-faint)]'}>
                      <NavIcon name={entree.icon} />
                    </span>
                  )}
                  {t(entree.labelKey)}
                </Link>
              ))}
            </div>
          ))}

          <NavDropdownSeparator />
          <div className="px-4 py-2 flex items-center justify-between">
            <span className="text-sm text-[var(--ink-faint)]">{t('language')}</span>
            <LanguageSwitcher />
          </div>

          <NavDropdownSeparator />
          <button
            type="button"
            onClick={async () => { fermer(); await signOut(); router.push('/login'); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
          >
            <NavIcon name="signOut" />
            {t('signOut')}
          </button>
        </>
      )}
    </NavDropdown>
  );
}
