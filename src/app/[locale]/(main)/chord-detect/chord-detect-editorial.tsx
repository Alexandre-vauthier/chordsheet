import { getTranslations } from 'next-intl/server';
import { Editorial, EditorialSection, EditorialList, EditorialLinks } from '@/components/seo/editorial';

/**
 * Bloc éditorial de la reconnaissance d'accords.
 *
 * La section « ce qu'il ne peut pas faire » est délibérément aussi développée que
 * les autres : sur un outil de détection, une promesse trop large se paie en
 * déception immédiate, alors qu'une limite expliquée passe pour de la rigueur.
 */
export async function ChordDetectEditorial({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'Editorial.chordDetect' });

  return (
    <Editorial>
      <EditorialSection title={t('how.h2')} id="fonctionnement">
        <EditorialList items={t.raw('how.items') as string[]} />
      </EditorialSection>

      <EditorialSection title={t('recognizes.h2')} id="reconnu">
        <p>{t('recognizes.body')}</p>
      </EditorialSection>

      <EditorialSection title={t('limits.h2')} id="limites">
        <p>{t('limits.body')}</p>
        <p>{t('limits.body2')}</p>
        <p>{t('limits.body3')}</p>
      </EditorialSection>

      <EditorialSection title={t('tips.h2')} id="conseils">
        <EditorialList items={t.raw('tips.items') as string[]} />
      </EditorialSection>

      <EditorialSection title={t('without.h2')} id="sans-micro">
        <p>{t('without.body')}</p>
      </EditorialSection>

      <EditorialLinks
        title={t('links.h2')}
        links={[
          { href: '/chords', label: t('links.chords') },
          { href: '/tuner', label: t('links.tuner') },
          { href: '/explore', label: t('links.explore') },
        ]}
      />
    </Editorial>
  );
}
