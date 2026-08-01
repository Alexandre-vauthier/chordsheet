import { getTranslations } from 'next-intl/server';
import { Editorial, EditorialSection, EditorialLinks } from '@/components/seo/editorial';

/**
 * Bloc éditorial de l'annuaire des artistes — volontairement court.
 *
 * Cette page ne gagnera pas de requête par elle-même : sa fonction est d'alimenter
 * les pages artiste, qui captent les vraies recherches. Du texte de remplissage n'y
 * ajouterait rien et diluerait le reste du site.
 */
export async function ArtistsEditorial({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'Editorial.artists' });

  return (
    <Editorial>
      <EditorialSection title={t('how.h2')} id="constitution"><p>{t('how.body')}</p></EditorialSection>
      <EditorialSection title={t('page.h2')} id="page-artiste"><p>{t('page.body')}</p></EditorialSection>
      <EditorialSection title={t('versions.h2')} id="versions"><p>{t('versions.body')}</p></EditorialSection>
      <EditorialSection title={t('missing.h2')} id="manquant"><p>{t('missing.body')}</p></EditorialSection>

      <EditorialLinks
        title={t('links.h2')}
        links={[
          { href: '/explore', label: t('links.explore') },
          { href: '/chords', label: t('links.chords') },
          { href: '/faq', label: t('links.faq') },
        ]}
      />
    </Editorial>
  );
}
