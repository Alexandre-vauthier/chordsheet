/**
 * Combien de vignettes une liste montre, et combien un clic en dévoile.
 *
 * Trois listes portaient chacune sa constante, et elles avaient divergé sans
 * raison : 48 pour le catalogue d'Explorer, 24 pour les pages thématiques, 24
 * encore pour « Que puis-je jouer ». Le bouton « Voir les N grilles suivantes »
 * revenait donc d'autant plus souvent qu'on était sur la page la moins fournie.
 *
 * **Ce que coûte une vignette, mesuré.** Sur un processeur bridé quatre fois — un
 * téléphone modeste, pas un portable de développement — un lot de 48 ajoute environ
 * 870 nœuds au document et 190 ms de rendu, soit à peu près 18 nœuds et 4 ms
 * l'unité. Le catalogue entier tient aujourd'hui en 3 674 nœuds, ce qui est peu
 * pour une page.
 *
 * **Pourquoi un facteur et non un pas.** Un pas fixe se règle pour la taille du
 * jour et vieillit mal : réglé sur les 258 grilles d'aujourd'hui, il redeviendra
 * pénible à 1 000, et le plafond de lecture du serveur est à 5 000. En multipliant
 * le seuil à chaque clic, le nombre de clics croît comme un logarithme : jamais
 * plus de quatre, quelle que soit la taille du catalogue dans les limites qu'il
 * peut atteindre. Aujourd'hui, un seul suffit à tout montrer.
 *
 * Ce qui reste borné, c'est le **premier** affichage : lui seul se paie au
 * chargement de la page, les suivants sont des gestes délibérés. Les données sont
 * déjà en mémoire dans les deux cas — dévoiler ne demande rien au serveur.
 */

/**
 * Ce que la page montre d'emblée.
 *
 * Le double de l'ancien pas des pages thématiques, le double aussi de ce qu'un
 * écran de bureau affiche sans défiler : assez pour que la plupart des listes
 * tiennent d'un coup, sans charger le premier rendu de tout le catalogue.
 */
export const PREMIER_LOT = 96;

/**
 * Ce que chaque clic multiplie.
 *
 * Quatre, et non deux : doubler demanderait six clics pour atteindre le plafond du
 * serveur, là où quadrupler en demande quatre — et à la taille d'aujourd'hui, la
 * différence est entre « un clic » et « deux ».
 */
export const FACTEUR = 4;

/** Le seuil après un clic. */
export function prochainSeuil(actuel: number): number {
  return Math.max(PREMIER_LOT, actuel) * FACTEUR;
}

/**
 * Combien de fois le bouton apparaît pour une liste de cette taille.
 *
 * Sert au test, et à répondre à la question qui a motivé tout ceci : « est-ce que
 * je vais encore le voir trois fois ? »
 */
export function nombreDeClics(total: number): number {
  let vus = PREMIER_LOT;
  let clics = 0;
  while (total > vus) {
    vus = prochainSeuil(vus);
    clics++;
  }
  return clics;
}
