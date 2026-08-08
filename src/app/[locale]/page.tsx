import { setRequestLocale } from 'next-intl/server';
import { getDonneesAccueil } from '@/lib/landing-data';
import { LandingClient } from './landing-client';

/**
 * La page d'accueil.
 *
 * Elle était cliente de bout en bout, et lisait son catalogue depuis le navigateur
 * avec un `limit(40)` : le compteur affiché — « 40+ grilles » — n'était donc pas un
 * chiffre mais **le plafond de sa propre requête**, sur un catalogue qui en compte
 * 258. Et il n'apparaissait qu'après hydratation, une demi-seconde après le reste.
 *
 * Le comptage remonte donc au serveur, sur l'index qui sert déjà le sitemap et
 * Explorer. Le corps de la page reste client — il porte le mur animé, les extraits
 * audio et le bac à sable.
 */
export const revalidate = 3600;

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { chiffres, enAvant } = await getDonneesAccueil();

  return <LandingClient chiffres={chiffres} enAvant={enAvant} />;
}
