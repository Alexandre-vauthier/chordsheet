import { getTranslations } from 'next-intl/server';
import { TUNINGS, type TunerInstrument } from '@/lib/tuner-data';
import {
  Editorial, EditorialSection, EditorialSubsection, EditorialList,
  EditorialTable, EditorialLinks,
} from '@/components/seo/editorial';

/** Ordre d'affichage : du plus courant au plus rare. */
const INSTRUMENTS: TunerInstrument[] = ['guitar', 'bass', 'ukulele', 'mandolin', 'banjo'];

/**
 * Bloc éditorial de l'accordeur — rendu côté serveur, sous l'outil.
 *
 * Le tableau des fréquences est **construit à partir de `TUNINGS`**, pas recopié
 * dans les traductions. C'est délibéré : ces valeurs sont publiées et doivent être
 * exactes. En les dérivant de la source qui pilote réellement l'accordeur, elles
 * ne peuvent pas diverger, et une évolution des accordages se répercute d'elle-même.
 */
export async function TunerEditorial({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'Editorial.tuner' });
  const tInstrument = await getTranslations({ locale, namespace: 'Instruments' });

  // Le séparateur décimal suit la langue : « 82,41 Hz » en français, « 82.41 Hz »
  // en anglais. Sans quoi le tableau contredirait la typographie du texte voisin.
  const hz = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <Editorial>
      <EditorialSection title={t('howto.h2')} id="accorder">
        <EditorialList items={t.raw('howto.items') as string[]} />
        <p>{t('howto.octave')}</p>
      </EditorialSection>

      <EditorialSection title={t('frequencies.h2')} id="frequences">
        <p>{t('frequencies.intro')}</p>

        {INSTRUMENTS.map((instrument) => (
          <EditorialSubsection key={instrument} title={tInstrument(instrument)}>
            <EditorialTable
              caption={`${tInstrument(instrument)} — ${t('frequencies.caption')}`}
              head={[t('frequencies.colString'), t('frequencies.colNote'), t('frequencies.colFreq')]}
              rows={TUNINGS[instrument].map((string, i) => [
                String(i + 1),
                string.label,
                // Deux décimales : la précision utile pour accorder.
                `${hz.format(string.freq)} Hz`,
              ])}
            />
          </EditorialSubsection>
        ))}

        <p>{t('frequencies.note')}</p>
      </EditorialSection>

      <EditorialSection title={t('chromatic.h2')} id="chromatique">
        <p>{t('chromatic.body')}</p>
      </EditorialSection>

      <EditorialSection title={t('cents.h2')} id="cents">
        <p>{t('cents.body')}</p>
        <p>{t('cents.tip')}</p>
      </EditorialSection>

      <EditorialSection title={t('faq.h2')} id="questions">
        <EditorialSubsection title={t('faq.q1')}><p>{t('faq.a1')}</p></EditorialSubsection>
        <EditorialSubsection title={t('faq.q2')}><p>{t('faq.a2')}</p></EditorialSubsection>
        <EditorialSubsection title={t('faq.q3')}><p>{t('faq.a3')}</p></EditorialSubsection>
      </EditorialSection>

      <EditorialLinks
        title={t('links.h2')}
        links={[
          { href: '/chords', label: t('links.chords') },
          { href: '/chord-detect', label: t('links.chordDetect') },
          { href: '/explore', label: t('links.explore') },
        ]}
      />
    </Editorial>
  );
}
