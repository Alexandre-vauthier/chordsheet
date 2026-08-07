import type { BeatsPerMeasure, Section } from '@/types';

/**
 * La métrique d'une grille, lue au même endroit par tout le monde.
 *
 * Elle est écrite à deux endroits : sur le document, et sur chacune de ses
 * sections. Six lecteurs s'en servaient, avec trois règles différentes — les uns
 * `sheet.beatsPerMeasure ?? 4`, les autres la première section, d'autres encore
 * l'égalité stricte à trois. Sur une grille en trois temps dont le document ne
 * porte pas le champ (il n'a longtemps été écrit que par la bascule de l'éditeur,
 * jamais à la création), la bascule s'affichait donc sur « binaire » alors que la
 * musique était en trois, et le badge « ternaire » ne s'affichait pas.
 *
 * Ce sont **les sections qui sonnent** : ce sont elles que la lecture suit, temps
 * par temps. Le champ du document ne vaut que comme réglage d'ensemble, et n'a le
 * dernier mot que parce que la bascule l'écrit en même temps que les sections.
 * D'où l'ordre ci-dessous, et le repli sur la première section quand il manque.
 *
 * Ne pas confondre avec la métrique d'une **section**, qui commande le décompte
 * pendant la lecture : une grille peut légitimement changer de mesure en route,
 * et `construireBattements` suit alors les sections, pas cette valeur-ci.
 */
export function metriqueDeGrille(
  sheet: { beatsPerMeasure?: BeatsPerMeasure; sections: Pick<Section, 'beatsPerMeasure'>[] },
): BeatsPerMeasure {
  return sheet.beatsPerMeasure ?? sheet.sections[0]?.beatsPerMeasure ?? 4;
}

/** La grille est-elle en trois temps ? */
export function estTernaire(
  sheet: { beatsPerMeasure?: BeatsPerMeasure; sections: Pick<Section, 'beatsPerMeasure'>[] },
): boolean {
  return metriqueDeGrille(sheet) === 3;
}
