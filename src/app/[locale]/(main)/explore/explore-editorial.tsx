import { getTranslations } from 'next-intl/server';
import { GENRES } from '@/types';
import {
  Editorial, EditorialSection, EditorialList, EditorialLinks,
} from '@/components/seo/editorial';
import { Link } from '@/i18n/navigation';

/**
 * Bloc éditorial du catalogue.
 *
 * Sa valeur principale n'est pas le texte mais le **maillage** : dix-neuf liens de
 * genre rendus côté serveur, qui n'existaient nulle part ailleurs. Le canonical de
 * la page étant fixé sur /explore sans paramètre, ces variantes filtrées ne créent
 * aucun doublon aux yeux des moteurs.
 */
export async function ExploreEditorial({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'Editorial.explore' });
  const tGenre = await getTranslations({ locale, namespace: 'Genres' });

  return (
    <Editorial>
      <EditorialSection title={t('genres.h2')} id="genres">
        <p>{t('genres.body')}</p>
        <ul className="flex flex-wrap gap-x-4 gap-y-2">
          {GENRES.map((genre) => (
            <li key={genre}>
              <Link
                href={`/explore?genre=${encodeURIComponent(genre)}`}
                className="text-[var(--accent)] hover:underline"
              >
                {tGenre(genre)}
              </Link>
            </li>
          ))}
        </ul>
      </EditorialSection>

      <EditorialSection title={t('difficulty.h2')} id="difficulte">
        <p>{t('difficulty.body')}</p>
        <EditorialList items={t.raw('difficulty.items') as string[]} />
        <p>{t('difficulty.note')}</p>
      </EditorialSection>

      <EditorialSection title={t('filters.h2')} id="filtres">
        <p>{t('filters.body')}</p>
      </EditorialSection>

      <EditorialSection title={t('content.h2')} id="contenu-grille">
        <p>{t('content.body')}</p>
        <p>{t('content.body2')}</p>
      </EditorialSection>

      <EditorialSection title={t('publish.h2')} id="publier">
        <p>{t('publish.body')}</p>
      </EditorialSection>

      <EditorialLinks
        title={t('links.h2')}
        links={[
          { href: '/artists', label: t('links.artists') },
          { href: '/chords', label: t('links.chords') },
          { href: '/faq', label: t('links.faq') },
          { href: '/pricing', label: t('links.pricing') },
        ]}
      />
    </Editorial>
  );
}
