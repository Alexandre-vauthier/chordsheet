import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { buildAlternates, buildOpenGraph } from '@/lib/seo';
import { getPublicSheetIndex } from '@/lib/public-sheet-index';
import { accordsLesPlusJoues, versGrilleDeCatalogue } from '@/lib/explore-shelves';
import { WhatCanIPlayClient } from './what-can-i-play-client';

const PATH = '/what-can-i-play';

/**
 * « Que puis-je jouer avec mes accords ? »
 *
 * Une adresse anglaise et unique pour les deux langues, comme `/what-to-play`,
 * `/chord-detect` ou `/tuner` : c'est la convention du dépôt. Traduire l'adresse
 * supposerait de déclarer les trente routes du site dans la configuration de
 * next-intl, pour une page.
 */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Seo.pages.whatCanIPlay' });
  const title = t('title');
  const description = t('description');

  return {
    title,
    description,
    alternates: buildAlternates(locale, PATH),
    openGraph: { ...buildOpenGraph(locale, PATH), title, description },
  };
}

/** Une grille publiée entre dans le calcul dans l'heure, comme sur `/what-to-play`. */
export const revalidate = 3600;

/**
 * Six accords cochés d'entrée, et non cinq.
 *
 * Le chiffre n'est pas rond par hasard : mesuré sur le catalogue, les cinq
 * accords les plus fréquents n'ouvrent que cinq grilles sur cent trente, le
 * sixième en ouvre dix-neuf. C'est le seuil où l'on cesse d'être devant une
 * vitrine pour se trouver devant un répertoire — et il tombe sur `G C Am F D Em`,
 * exactement les six premiers accords qu'on apprend.
 */
const SOCLE_DEPART = 6;

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const refs = await getPublicSheetIndex();
  const accordsProposes = accordsLesPlusJoues(refs, 12);

  return (
    <WhatCanIPlayClient
      accordsProposes={accordsProposes}
      accordsInitiaux={accordsProposes.slice(0, SOCLE_DEPART)}
      grilles={refs.map(versGrilleDeCatalogue)}
      couvertures={refs
        .slice()
        .sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0))
        .slice(0, 24)
        .map((r) => ({ id: r.id, title: r.title, artist: r.artist }))}
    />
  );
}
