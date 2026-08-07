/**
 * Les rubriques de la page de réglages.
 *
 * L'identifiant sert d'adresse (`/profile?r=affichage`) : il est en français comme
 * le reste du produit, et **stable**. Le renommer casserait les liens que
 * quelqu'un aurait mis en signet, et les deux retours de paiement Stripe qui
 * visent `?r=abonnement`.
 */
export const SECTION_IDS = [
  'compte',
  'public',
  'instrument',
  'affichage',
  'lecture',
  'impression',
  'abonnement',
] as const;

export type SectionId = (typeof SECTION_IDS)[number];

/** La rubrique ouverte quand l'adresse n'en désigne aucune, sur grand écran. */
export const SECTION_DEFAUT: SectionId = 'compte';

export function isSectionId(value: string | null): value is SectionId {
  return !!value && (SECTION_IDS as readonly string[]).includes(value);
}
