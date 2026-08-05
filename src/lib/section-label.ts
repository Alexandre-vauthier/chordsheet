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
 *
 * Elle doit être **convergente** : `refrain`, `Refrain` et `REFRAIN` doivent
 * tomber sur la même forme, sans quoi elle ne sert à rien. Les champs
 * l'appliquent à la sortie du champ, et pas seulement à l'enregistrement :
 * l'écran affiche les libellés en capitales par CSS, donc personne ne voit ce
 * qu'il a réellement tapé. C'est précisément ce qui a produit les quatre
 * orthographes de « refrain » qu'on a dû rattraper.
 */

/** Au-delà de cette longueur, un libellé tout en capitales est un cri, pas un sigle. */
const LONGUEUR_SIGLE = 3;

export function normaliserLibelle(libelle: string): string {
  const propre = libelle.trim().replace(/\s+/g, ' ');
  if (!propre) return propre;

  // Une barre oblique enchaîne des titres : « Intro / Couplet / Refrain » nomme un
  // passage dont les accords servent à trois endroits. Chaque titre se normalise
  // pour lui-même, sinon « COUPLET/refrain » garderait son cri sur le premier.
  // L'espace, lui, ne coupe rien : « Toute la musique » est une phrase.
  return propre.split('/').map(normaliserTitre).join('/');
}

function normaliserTitre(titre: string): string {
  const noyau = titre.trim();
  if (!noyau) return titre;

  const avant = titre.slice(0, titre.indexOf(noyau));
  const apres = titre.slice(titre.indexOf(noyau) + noyau.length);

  const sansMinuscule = noyau === noyau.toUpperCase() && /\p{Lu}/u.test(noyau);
  const base = sansMinuscule && noyau.length > LONGUEUR_SIGLE ? noyau.toLowerCase() : noyau;

  return avant + base.charAt(0).toUpperCase() + base.slice(1) + apres;
}
