'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

// Bascule FR/EN en conservant la page courante (usePathname est dépréfixé par
// next-intl, donc identique quelle que soit la locale active). Couleurs basées
// sur currentColor/opacité (pas de var --nav-text ni --ink) pour rester lisible
// aussi bien sur la navbar sombre que dans le menu profil clair.
export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="flex items-center text-xs font-medium">
      {routing.locales.map((l, i) => (
        <span key={l} className="flex items-center">
          {i > 0 && <span className="mx-1 opacity-25">/</span>}
          <button
            type="button"
            onClick={() => router.replace(pathname, { locale: l })}
            className={`cursor-pointer uppercase transition-opacity hover:opacity-100 ${
              l === locale ? 'opacity-100 font-semibold' : 'opacity-50'
            }`}
          >
            {l}
          </button>
        </span>
      ))}
    </div>
  );
}
