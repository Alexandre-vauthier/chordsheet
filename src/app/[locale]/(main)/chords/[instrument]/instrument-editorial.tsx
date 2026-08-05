import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Editorial, EditorialSection, EditorialLinks } from '@/components/seo/editorial';
import { chordNamesFor, chordSlug } from '@/lib/chord-page';
import { getTopChords } from '@/lib/public-sheet-index';
import type { InstrumentId } from '@/types';
import type { InstrumentNames } from '@/lib/instrument-names';

/**
 * Bloc éditorial d'une page d'instrument.
 *
 * La page ne disait qu'une phrase avant de dérouler trois cents liens. Elle vise
 * pourtant une intention large et disputée — « accords guitare » — sur laquelle une
 * liste nue ne pèse rien.
 *
 * Ce qui est ajouté n'est pas du remplissage : par où commencer, comment lire un
 * diagramme, et ce que l'instrument a de particulier. Les accords à apprendre en
 * premier sont **comptés sur le catalogue réel**, pas choisis à la main — une liste
 * publiée qui diverge du produit est pire qu'une liste absente, et c'est la seule
 * chose ici qu'aucun dictionnaire ne peut écrire à notre place.
 */
export async function InstrumentEditorial({
  locale,
  instrument,
  forms,
}: {
  locale: string;
  instrument: InstrumentId;
  forms: InstrumentNames;
}) {
  const t = await getTranslations({ locale, namespace: 'Editorial.instrumentPage' });

  // Les noms du champ `chords` sont normalisés en minuscules à l'écriture ; ceux de
  // la bibliothèque gardent leur casse d'affichage. On rapproche les deux ici.
  const parNomNormalise = new Map(chordNamesFor(instrument).map((n) => [n.toLowerCase(), n]));
  const populaires = (await getTopChords(24))
    .map(({ nom, grilles }) => ({ nom: parNomNormalise.get(nom), grilles }))
    .filter((c): c is { nom: string; grilles: number } => !!c.nom)
    .slice(0, 10);

  return (
    <Editorial>
      {populaires.length > 0 && (
        <EditorialSection title={t('startTitle')}>
          <p>{t('startLead', forms)}</p>
          <ul className="flex flex-wrap gap-2">
            {populaires.map(({ nom, grilles }) => (
              <li key={nom}>
                <Link
                  href={`/chords/${instrument}/${chordSlug(nom)}`}
                  className="inline-flex items-baseline gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--line)]
                    bg-[var(--cell-bg)] text-sm font-medium text-[var(--ink)]
                    hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                >
                  {nom}
                  <span className="text-[11px] text-[var(--ink-faint)] tabular-nums">{grilles}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p>{t('startCount', { count: populaires.length })}</p>
        </EditorialSection>
      )}

      <EditorialSection title={t('aboutTitle')}>
        <p>{t(`about.${instrument}`)}</p>
      </EditorialSection>

      {instrument !== 'piano' && (
        <EditorialSection title={t('readingTitle')}>
          <p>{t('reading')}</p>
        </EditorialSection>
      )}

      <EditorialLinks
        title={t('linksTitle')}
        links={[
          { href: '/tuner', label: t('linkTuner') },
          { href: '/chords?finder=1', label: t('linkFinder') },
          { href: '/transpose', label: t('linkTranspose') },
          { href: '/explore', label: t('linkExplore') },
        ]}
      />
    </Editorial>
  );
}
