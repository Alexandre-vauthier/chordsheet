import { getTranslations } from 'next-intl/server';
import { getChordsByInstrument, getAllExtendedChords } from '@/lib/chord-data';
import { INSTRUMENTS, type InstrumentId } from '@/types';
import { Editorial, EditorialSection, EditorialTable, EditorialLinks } from '@/components/seo/editorial';

/** La voix n'a pas de diagramme : elle n'a rien à faire dans un tableau d'accords. */
const SHOWN: InstrumentId[] = INSTRUMENTS.filter((i) => i !== 'voice');

/** Notes latines dans l'ordre chromatique naturel, pour le tableau de correspondance. */
const NOTE_PAIRS: [string, string][] = [
  ['C', 'Do'], ['D', 'Ré'], ['E', 'Mi'], ['F', 'Fa'],
  ['G', 'Sol'], ['A', 'La'], ['B', 'Si'],
];

/**
 * Bloc éditorial de la bibliothèque d'accords.
 *
 * Comme pour l'accordeur, **les chiffres sont comptés sur les données réelles**
 * plutôt que recopiés dans les traductions : un total publié qui diverge du produit
 * est pire qu'un total absent. Le décompte des accords enrichis varie d'ailleurs
 * d'un instrument à l'autre — certaines formules n'ont pas de doigté jouable sur
 * quatre cordes — et seul un comptage réel peut le dire.
 */
export async function ChordsEditorial({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'Editorial.chords' });
  const tInstrument = await getTranslations({ locale, namespace: 'Instruments' });

  const counts = SHOWN.map((id) => ({
    id,
    label: tInstrument(id),
    statiques: getChordsByInstrument(id).length,
    etendus: getAllExtendedChords(id).length,
  }));
  const total = counts.reduce((sum, c) => sum + c.statiques, 0);
  // Nombre de formules enrichies : déduit du meilleur cas observé, pour ne pas
  // coder en dur une valeur qui vivrait dans chord-data.ts.
  const formulas = Math.round(Math.max(...counts.map((c) => c.etendus)) / 12);

  const num = new Intl.NumberFormat(locale);

  return (
    <Editorial>
      <EditorialSection title={t('library.h2')} id="bibliotheque">
        <p>{t('library.intro', { total: num.format(total) })}</p>
        <EditorialTable
          caption={t('library.caption')}
          head={[t('library.colInstrument'), t('library.colStatic'), t('library.colGenerated')]}
          rows={counts.map((c) => [c.label, num.format(c.statiques), num.format(c.etendus)])}
        />
        <p>{t('library.families')}</p>
        <p>{t('library.note')}</p>
      </EditorialSection>

      <EditorialSection title={t('extended.h2')} id="enrichis">
        <p>{t('extended.body', { formulas: num.format(formulas) })}</p>
        <p>{t('extended.body2')}</p>
      </EditorialSection>

      <EditorialSection title={t('reading.h2')} id="lire-un-diagramme">
        <p>{t('reading.strings')}</p>
        <p>{t('reading.piano')}</p>
      </EditorialSection>

      <EditorialSection title={t('notation.h2')} id="notation">
        <p>{t('notation.body')}</p>
        <EditorialTable
          caption={t('notation.caption')}
          head={[t('notation.colUs'), t('notation.colFr')]}
          rows={NOTE_PAIRS.map(([us, fr]) => [us, fr])}
        />
        <p>{t('notation.minor')}</p>
        <p>{t('notation.body2')}</p>
      </EditorialSection>

      <EditorialSection title={t('enharmony.h2')} id="enharmonie">
        <p>{t('enharmony.body')}</p>
        <p>{t('enharmony.body2')}</p>
      </EditorialSection>

      <EditorialSection title={t('slash.h2')} id="accords-slash">
        <p>{t('slash.body')}</p>
        <p>{t('slash.body2')}</p>
      </EditorialSection>

      <EditorialSection title={t('find.h2')} id="trouver">
        <p>{t('find.body')}</p>
      </EditorialSection>

      <EditorialSection title={t('custom.h2')} id="doigte-personnalise">
        <p>{t('custom.body')}</p>
      </EditorialSection>

      <EditorialLinks
        title={t('links.h2')}
        links={[
          { href: '/chord-detect', label: t('links.detect') },
          { href: '/tuner', label: t('links.tuner') },
          { href: '/explore', label: t('links.explore') },
          { href: '/faq', label: t('links.faq') },
        ]}
      />
    </Editorial>
  );
}
