import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { buildAlternates, buildOpenGraph } from '@/lib/seo';
import { getPublicSheetIndex } from '@/lib/public-sheet-index';
import { WhatToPlayClient, type Candidate } from './what-to-play-client';

const PATH = '/what-to-play';

/**
 * « Je ne sais pas quoi jouer. »
 *
 * Une grille de vignettes ne sert à rien quand on n'a rien en tête : on la parcourt
 * sans rien reconnaître. Trois secondes d'un morceau tranchent là où une pochette
 * laisse hésitant. La page fait donc défiler des extraits, un à la fois, avec de quoi
 * ouvrir la grille dès qu'un morceau accroche.
 *
 * Le catalogue est servi par le serveur ; l'ordre, lui, est tiré au sort par le
 * navigateur. Le tirer côté serveur le figerait pour tout le monde jusqu'à la
 * prochaine revalidation, et deux visiteurs verraient la même « découverte ».
 */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Seo.pages.whatToPlay' });
  const title = t('title');
  const description = t('description');

  return {
    title,
    description,
    alternates: buildAlternates(locale, PATH),
    openGraph: { ...buildOpenGraph(locale, PATH), title, description },
  };
}

/** Revalidation horaire : une grille publiée entre dans le tirage dans l'heure. */
export const revalidate = 3600;

/**
 * Plafond du tirage. Au-delà, on ne fait qu'alourdir la page : personne n'enchaîne
 * deux cents extraits, et le tirage reste largement varié d'une visite à l'autre.
 */
const MAX_CANDIDATS = 200;

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const sheets = await getPublicSheetIndex();

  // Un morceau sans titre ni artiste n'a aucune chance d'être retrouvé chez iTunes :
  // l'écarter d'emblée évite un passage à vide dans la file.
  const candidates: Candidate[] = sheets
    .filter((s) => s.title.trim() && s.artist.trim())
    .slice(0, MAX_CANDIDATS)
    .map((s) => ({
      id: s.id,
      title: s.title,
      artist: s.artist,
      genres: s.genres ?? [],
      difficulty: s.difficulty ?? null,
    }));

  return <WhatToPlayClient candidates={candidates} />;
}
