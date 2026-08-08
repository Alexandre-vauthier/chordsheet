import type { InstrumentId } from '@/types';

/**
 * Qui s'affiche dans les deux barres de réglages d'une grille consultée.
 *
 * Ces règles étaient éparpillées en conditions inline dans le JSX du lecteur, et
 * elles y étaient fausses de deux façons.
 *
 * **Le couplage.** « Diagrammes » et « Minimiser » étaient des enfants de
 * `showChordSummary` : replier le récapitulatif faisait disparaître le bouton qui
 * pilote les diagrammes *dans les cases*, deux réglages sans rapport de contenu.
 * D'où la signature ci-dessous, qui ne prend pas l'ouverture du récapitulatif en
 * paramètre : elle ne peut donc pas en dépendre.
 *
 * **Le mauvais rayon.** « Minimiser » masque des *sections* répétées, pas des
 * accords. Sa place est avec la bascule Déroulé / Grille, pas avec le
 * récapitulatif d'accords.
 *
 * Le tout est ici plutôt qu'en ligne parce que c'est un endroit où l'on peut se
 * tromper sans que rien ne casse — un contrôle qui disparaît ne lève aucune
 * erreur, il manque, simplement.
 */
export interface EtatBarreAccords {
  instrumentId: InstrumentId;
  /** Mode scène d'une setlist : la barre de lecture est déjà masquée. */
  concertMode: boolean;
  /** La structure dit autre chose que l'ordre naturel des sections. */
  aUneStructure: boolean;
  /** Au moins deux sections ont un contenu identique. */
  hasRepeatedSections: boolean;
}

export interface ControlesBarreAccords {
  /** La rangée de pictogrammes qui choisit l'instrument des diagrammes. */
  instrument: boolean;
  /** La bascule des diagrammes dans les cases. */
  diagrammes: boolean;
  /** Le dépliant « Accords utilisés » et son contenu. */
  recapitulatif: boolean;
  /** La bascule qui replie les sections répétées. */
  minimiser: boolean;
  /** La bascule Déroulé / Grille. */
  vue: boolean;
  /** La rangée qui porte `vue` et `minimiser` : au moins l'un des deux. */
  rangeeStructure: boolean;
}

export function controlesBarreAccords(etat: EtatBarreAccords): ControlesBarreAccords {
  const { instrumentId, concertMode, aUneStructure, hasRepeatedSections } = etat;

  /*
   * La Voix n'est pas un instrument comme les autres, c'est un mode d'affichage :
   * pas de diagramme, pas de grille, les paroles à la place.
   */
  const accords = instrumentId !== 'voice';

  /*
   * Et c'est précisément pourquoi la rangée d'instruments, elle, reste affichée en
   * mode Voix : elle est la seule sortie. Tout le reste du bandeau disparaît ;
   * si elle disparaissait aussi, on serait enfermé dans les paroles sans aucun
   * moyen de revenir à la guitare.
   *
   * Sur scène en revanche elle s'efface : on ne change pas d'instrument en jouant,
   * et c'est ce que faisait déjà l'ancien emplacement, dans la barre de lecture
   * masquée en mode concert.
   */
  const instrument = !concertMode;

  const vue = accords && aUneStructure;
  const minimiser = accords && hasRepeatedSections;

  return {
    instrument,
    diagrammes: accords,
    recapitulatif: accords,
    minimiser,
    vue,
    rangeeStructure: vue || minimiser,
  };
}
