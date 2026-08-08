import { cache } from 'react';

/**
 * L'instant du rendu, lu une seule fois.
 *
 * Lire l'horloge pendant un rendu n'est pas anodin : deux appels dans la même
 * passe peuvent rendre deux valeurs, et une frontière de sept jours tomberait
 * alors différemment d'un endroit à l'autre de la page. `cache()` fige la valeur
 * pour la durée du rendu.
 *
 * Il se passe ensuite en argument aux fonctions qui en ont besoin, plutôt que
 * d'être lu par elles : une fonction qui interroge l'horloge ne se teste pas deux
 * fois de la même façon.
 */
export const instantDuRendu = cache(() => Date.now());
