'use client';

/**
 * La grille qu'un visiteur voulait garder avant d'avoir un compte.
 *
 * Cliquer sur l'étoile sans être connecté mène à l'inscription. Sans mémoire, la
 * grille serait perdue en route : on promettrait « gardez-la dans votre book »
 * pour livrer un book vide. On retient donc son identifiant le temps du détour,
 * et la première page ouverte une fois le compte créé l'ajoute.
 *
 * Un seul identifiant, volontairement : c'est une intention en cours, pas une
 * liste. La deuxième remplace la première, et la valeur ne survit pas à son
 * emploi.
 */

const CLE = 'alviena.grilleAGarder';

export function garderPourPlusTard(sheetId: string): void {
  try {
    localStorage.setItem(CLE, sheetId);
  } catch {
    // Navigation privée ou stockage refusé : on ne peut rien promettre, tant pis.
  }
}

/** L'identifiant retenu, s'il y en a un. Le lire l'efface : on n'ajoute qu'une fois. */
export function reprendrePourPlusTard(): string | null {
  try {
    const id = localStorage.getItem(CLE);
    if (id) localStorage.removeItem(CLE);
    return id;
  } catch {
    return null;
  }
}
