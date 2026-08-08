import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getArtistSheetRefs, songKey, type PublicSheetRef } from '@/lib/public-sheet-index';
import { sheetPath } from '@/lib/sheet-url';
import { artistPath } from '@/lib/artist-url';

/**
 * Bloc de maillage interne sous une grille : les autres versions du même morceau,
 * puis le reste du répertoire de l'artiste.
 *
 * Rendu **côté serveur** : ces liens sont donc présents dans le HTML servi, ce qui
 * est toute leur raison d'être. Un moteur qui arrive sur une grille depuis une
 * recherche repart vers d'autres pages du catalogue au lieu de s'arrêter là — et
 * c'est aussi ce qui rend les grilles découvrables sans passer par /explore, dont
 * la pagination est côté client.
 *
 * Masqué à l'impression : personne n'imprime une liste de liens.
 */
export async function RelatedSheets({
  locale,
  sheetId,
  title,
  artist,
}: {
  locale: string;
  sheetId: string;
  title: string;
  artist: string;
}) {
  if (!artist) return null;

  const refs = await getArtistSheetRefs(artist);
  const others = refs.filter((r) => r.id !== sheetId);
  if (others.length === 0) return null;

  const key = songKey(title, artist);
  const versions = others.filter((r) => songKey(r.title, r.artist) === key);
  const rest = others.filter((r) => songKey(r.title, r.artist) !== key).slice(0, 8);

  const t = await getTranslations({ locale, namespace: 'Related' });

  return (
    <nav
      aria-label={t('aria')}
      className="max-w-4xl mx-auto px-4 sm:px-6 pb-12 print:hidden"
    >
      <div className="border-t border-[var(--line)] pt-8 space-y-8">

        {versions.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-[var(--ink)] mb-3">
              {t('versionsHeading', { title })}
            </h2>
            <ul className="flex flex-wrap gap-2">
              {versions.map((v) => (
                <SheetChip key={v.id} sheet={v} label={t('versionLabel')} />
              ))}
            </ul>
            <p className="mt-3">
              <Link
                href={`/song/${encodeURIComponent(title)}/${encodeURIComponent(artist)}`}
                className="text-xs text-[var(--accent)] hover:underline"
              >
                {t('compareVersions', { title })}
              </Link>
            </p>
          </section>
        )}

        {rest.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-[var(--ink)] mb-3">
              {t('artistHeading', { artist })}
            </h2>
            <ul className="flex flex-wrap gap-2">
              {rest.map((s) => (
                <SheetChip key={s.id} sheet={s} label={s.title} />
              ))}
            </ul>
            <p className="mt-3">
              <Link
                href={artistPath(artist)}
                className="text-xs text-[var(--accent)] hover:underline"
              >
                {t('allByArtist', { artist })}
              </Link>
            </p>
          </section>
        )}

      </div>
    </nav>
  );
}

/** Une ancre descriptive : c'est le texte du lien que retient un moteur. */
function SheetChip({ sheet, label }: { sheet: PublicSheetRef; label: string }) {
  return (
    <li>
      <Link
        href={sheetPath(sheet)}
        className="inline-block px-3 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--cell-bg)]
          text-xs text-[var(--ink-light)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
      >
        {label}
      </Link>
    </li>
  );
}
