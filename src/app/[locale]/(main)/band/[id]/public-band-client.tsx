'use client';

import { useTranslations } from 'next-intl';
import { SheetCard } from '@/components/explore/sheet-card';
import { useAuth } from '@/lib/auth-context';
import { useBookmarks } from '@/lib/use-bookmarks';
import { Link } from '@/i18n/navigation';
import type { Sheet } from '@/types';

export interface PublicBand {
  id: string;
  name: string;
  description: string;
  photoURL: string | null;
  ownerId: string;
  createdAt: Date | null;
}

export interface PublicSet {
  id: string;
  name: string;
  sheets: Sheet[];
}

/** Initiales colorées, à défaut de photo — même repli que la carte de groupe. */
function initiales(nom: string): string {
  const mots = nom.trim().split(/\s+/).filter(Boolean);
  if (mots.length === 0) return '?';
  if (mots.length === 1) return mots[0].slice(0, 2).toUpperCase();
  return (mots[0][0] + mots[1][0]).toUpperCase();
}

/**
 * La vitrine telle que la voit quelqu'un qui arrive du lien d'un créateur.
 *
 * Tout arrive en props depuis le serveur : le composant n'interroge pas Firestore,
 * et n'a donc besoin d'aucune session. C'est la condition pour que la page s'ouvre
 * sans compte, ce qui est tout l'intérêt.
 *
 * Les favoris sont la seule chose qui dépende de la personne, et seulement si elle
 * est connectée. Pour un visiteur de passage, l'étoile ne s'affiche simplement pas.
 */
export function PublicBandClient({ band, sets, loose }: { band: PublicBand | null; sets: PublicSet[]; loose: Sheet[] }) {
  const t = useTranslations('PublicBand');
  const { user } = useAuth();
  const { isBookmarked, toggleBookmark } = useBookmarks(user?.id);

  if (!band) {
    return (
      <div className="max-w-[1270px] mx-auto px-4 sm:px-6 py-16 text-center text-[var(--ink-faint)]">
        {t('notFound')}
      </div>
    );
  }

  const total = sets.reduce((n, s) => n + s.sheets.length, 0) + loose.length;

  const carte = (sheet: Sheet) => (
    <SheetCard
      key={sheet.id}
      sheet={sheet}
      isBookmarked={user ? isBookmarked(sheet.id!) : false}
      onToggleBookmark={user ? () => toggleBookmark(sheet.id!) : undefined}
    />
  );

  return (
    <div className="max-w-[1270px] mx-auto px-4 sm:px-6 py-8">

      <div className="flex items-start gap-5 mb-8 pb-6 border-b-2 border-[var(--ink)]">
        <div className="w-20 h-20 rounded-2xl overflow-hidden bg-[var(--accent)] flex items-center justify-center text-white text-2xl font-bold shrink-0 shadow-md">
          {band.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={band.photoURL} alt="" className="w-full h-full object-cover" />
          ) : (
            initiales(band.name)
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-playfair text-2xl sm:text-3xl font-bold text-[var(--ink)]">{band.name}</h1>
          {band.description && (
            <p className="text-sm text-[var(--ink-light)] mt-1.5 leading-relaxed max-w-2xl whitespace-pre-line">
              {band.description}
            </p>
          )}
          <p className="text-xs text-[var(--ink-faint)] mt-2">
            {t('sheetCount', { count: total })}
            {band.ownerId && (
              <>
                {' · '}
                <Link href={`/user/${band.ownerId}`} className="hover:text-[var(--accent)] transition-colors">
                  {t('byAuthor')}
                </Link>
              </>
            )}
          </p>
        </div>
      </div>

      {total === 0 ? (
        <p className="py-16 text-center text-[var(--ink-faint)]">{t('empty')}</p>
      ) : (
        <>
          {sets.map((set) => (
            <section key={set.id} className="mb-10">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--ink-faint)] mb-4">
                {set.name || t('untitledSet')}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {set.sheets.map(carte)}
              </div>
            </section>
          ))}

          {loose.length > 0 && (
            <section className="mb-10">
              {/* Titre seulement s'il y a des sets au-dessus : sans eux, ces grilles
                  sont simplement « le répertoire », pas un reste. */}
              {sets.length > 0 && (
                <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--ink-faint)] mb-4">
                  {t('otherSheets')}
                </h2>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {loose.map(carte)}
              </div>
            </section>
          )}
        </>
      )}

      {/* Ce que le visiteur gagne à créer un compte, dit sans détour : garder ces
          grilles chez lui. Pas de mur, pas de promesse floue. */}
      <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--cell-bg)] p-6 text-center">
        <p className="text-sm text-[var(--ink)] font-medium">{t('ctaTitle')}</p>
        <p className="text-sm text-[var(--ink-light)] mt-1 max-w-lg mx-auto leading-relaxed">{t('ctaBody')}</p>
        <Link
          href={user ? '/dashboard' : '/register'}
          className="inline-block mt-4 px-6 py-2.5 bg-[var(--accent)] hover:bg-[#a83d25] text-white text-sm font-medium rounded-lg transition-colors"
        >
          {user ? t('ctaLoggedIn') : t('cta')}
        </Link>
      </div>
    </div>
  );
}
