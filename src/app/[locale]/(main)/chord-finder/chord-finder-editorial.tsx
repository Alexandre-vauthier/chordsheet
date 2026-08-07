import { getTranslations } from 'next-intl/server';
import { Editorial, EditorialSection, EditorialList, EditorialLinks } from '@/components/seo/editorial';

/**
 * Bloc éditorial du chercheur d'accords.
 *
 * Comme pour l'identification au micro, la section des limites est aussi
 * développée que les autres : un outil de reconnaissance qui promet trop se paie
 * en déception immédiate, alors qu'une limite expliquée passe pour de la rigueur.
 */
export async function ChordFinderEditorial({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'Editorial.chordFinder' });

  return (
    <Editorial>
      <EditorialSection title={t('how.h2')} id="fonctionnement">
        <EditorialList items={t.raw('how.items') as string[]} />
      </EditorialSection>

      <EditorialSection title={t('naming.h2')} id="nommage">
        <p>{t('naming.body')}</p>
        <p>{t('naming.body2')}</p>
      </EditorialSection>

      <EditorialSection title={t('limits.h2')} id="limites">
        <p>{t('limits.body')}</p>
        <p>{t('limits.body2')}</p>
      </EditorialSection>

      <EditorialLinks
        title={t('linksTitle')}
        links={[
          { href: '/chords', label: t('linkLibrary') },
          { href: '/chord-detect', label: t('linkDetect') },
          { href: '/tuner', label: t('linkTuner') },
        ]}
      />
    </Editorial>
  );
}
