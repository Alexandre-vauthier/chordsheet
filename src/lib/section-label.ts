/**
 * Casse des libellés de section, à l'enregistrement.
 *
 * L'écran affiche ces libellés en capitales, mais par CSS : ce qui est stocké
 * reste ce que la personne a tapé. Sur sept cent soixante-dix sections, cela
 * donnait cent cinquante-deux libellés distincts, dont le même mot écrit de
 * quatre façons — `refrain`, `Refrain`, `REFRAIN`, et `couplet ` avec une espace
 * finale. Invisible dans l'application, très visible ailleurs : Google lit le
 * texte du document et non son rendu, et ses extraits alternaient « Intro » et
 * « couplet » dans la même phrase.
 *
 * On normalise donc à l'enregistrement, et non à l'affichage : la casse
 * d'affichage est un choix typographique qui appartient au CSS, et stocker des
 * capitales abîmerait le texte partout où ce CSS ne s'applique pas — extraits de
 * moteurs, PDF, exports.
 *
 * La règle est délibérément timide. On rogne les espaces et on met une capitale
 * initiale ; le reste du libellé est laissé tel quel, pour ne pas transformer
 * « Solo GTR » en « Solo gtr ». Seule exception, un libellé entièrement en
 * capitales est ramené à une capitale initiale, sans quoi il continuerait de
 * crier — mais pas les sigles courts, où les capitales sont voulues.
 */

/** Au-delà de cette longueur, un libellé tout en capitales est un cri, pas un sigle. */
const LONGUEUR_SIGLE = 3;

export function normaliserLibelle(libelle: string): string {
  const propre = libelle.trim().replace(/\s+/g, ' ');
  if (!propre) return propre;

  const sansMinuscule = propre === propre.toUpperCase() && /[A-ZÀ-Þ]/.test(propre);
  const base = sansMinuscule && propre.length > LONGUEUR_SIGLE ? propre.toLowerCase() : propre;

  return base.charAt(0).toUpperCase() + base.slice(1);
}
