/**
 * Le vocabulaire des sections, d'une langue à l'autre.
 *
 * Les titres de section sont des données saisies par l'auteur, pas des textes de
 * l'interface : ils ne passent donc pas par les fichiers de traduction. Résultat,
 * une grille écrite en français affiche « Couplet » et « Refrain » à un lecteur
 * anglophone sur `/en`, et l'inverse sur `/fr`.
 *
 * Or ce vocabulaire est minuscule et se répète : intro, couplet, refrain, pont,
 * solo, outro, fin. Une petite table suffit à le traduire à l'affichage.
 *
 * **On ne traduit qu'à l'affichage.** Ce qui est stocké reste ce que l'auteur a
 * tapé, comme pour la casse : l'éditeur montre la donnée, la consultation montre
 * la langue du lecteur. Un titre inconnu (« Toute la musique », « Solo GTR »)
 * traverse sans être touché — mieux vaut ne rien traduire que traduire de travers.
 */

export type Locale = 'fr' | 'en';

interface Concept {
  /** Le mot employé dans chaque langue. */
  mots: Record<Locale, string>;
  /**
   * Formes reconnues, sous leur graphie normalisée (minuscules, sans accent ni
   * trait d'union). Les mots de `mots` sont ajoutés automatiquement.
   */
  alias?: string[];
  /**
   * Formes qu'une langue accepte sans les réécrire.
   *
   * « Bridge » est d'usage courant dans une grille française : le traduire en
   * « Pont » corrigerait l'auteur chez lui, ce qu'on ne cherche pas. « Refrain »
   * n'est en revanche pas toléré côté anglais, sans quoi le cas le plus fréquent
   * de tous ne serait jamais traduit.
   */
  tolere?: Partial<Record<Locale, string[]>>;
}

const CONCEPTS: Concept[] = [
  { mots: { fr: 'Intro', en: 'Intro' }, alias: ['introduction'] },
  { mots: { fr: 'Couplet', en: 'Verse' }, alias: ['vers', 'versus', 'strophe'] },
  { mots: { fr: 'Pré-refrain', en: 'Pre-chorus' }, alias: ['pre refrain', 'pre chorus', 'montee'] },
  { mots: { fr: 'Refrain', en: 'Chorus' } },
  { mots: { fr: 'Post-refrain', en: 'Post-chorus' }, alias: ['post refrain', 'post chorus'] },
  // « Brigde » est la faute de frappe habituelle : la reconnaître coûte un mot.
  { mots: { fr: 'Pont', en: 'Bridge' }, alias: ['brigde'], tolere: { fr: ['bridge'] } },
  { mots: { fr: 'Solo', en: 'Solo' } },
  { mots: { fr: 'Instrumental', en: 'Instrumental' }, alias: ['instru'] },
  { mots: { fr: 'Interlude', en: 'Interlude' } },
  { mots: { fr: 'Break', en: 'Break' } },
  { mots: { fr: 'Riff', en: 'Riff' } },
  { mots: { fr: 'Thème', en: 'Theme' } },
  { mots: { fr: 'Outro', en: 'Outro' } },
  { mots: { fr: 'Fin', en: 'Ending' }, alias: ['end', 'final', 'finale'] },
  { mots: { fr: 'Coda', en: 'Coda' } },
];

/** Graphie de comparaison : minuscules, sans accent, sans trait d'union. */
function normaliser(mot: string): string {
  return mot
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const PAR_FORME = new Map<string, Concept>();
for (const concept of CONCEPTS) {
  for (const forme of [...Object.values(concept.mots), ...(concept.alias ?? [])]) {
    PAR_FORME.set(normaliser(forme), concept);
  }
}

/**
 * Un titre traduit dans la langue du lecteur, ou tel quel s'il est déjà compris.
 *
 * Le numéro qui suit est conservé : « Couplet 2 » donne « Verse 2 ». Les titres
 * enchaînés par une barre oblique se traduisent chacun pour soi, parce que c'est
 * ainsi qu'on nomme un passage qui sert à plusieurs endroits :
 * « Intro / Couplet » donne « Intro / Verse ».
 */
export function traduireLibelle(libelle: string, locale: string): string {
  if (locale !== 'fr' && locale !== 'en') return libelle;
  return libelle.split('/').map((titre) => traduireTitre(titre, locale)).join('/');
}

function traduireTitre(titre: string, locale: Locale): string {
  const noyau = titre.trim();
  if (!noyau) return titre;

  const avant = titre.slice(0, titre.indexOf(noyau));
  const apres = titre.slice(titre.indexOf(noyau) + noyau.length);

  // Le suffixe numérique voyage avec le titre sans participer à sa reconnaissance.
  const decoupe = noyau.match(/^(.*?)[\s]*(\d+)$/);
  const mot = decoupe ? decoupe[1] : noyau;
  const numero = decoupe ? ` ${decoupe[2]}` : '';

  const forme = normaliser(mot);
  const concept = PAR_FORME.get(forme);
  if (!concept) return titre;

  // Déjà compris ici : on ne corrige pas l'auteur dans sa propre langue.
  if (forme === normaliser(concept.mots[locale])) return titre;
  if (concept.tolere?.[locale]?.some((f) => normaliser(f) === forme)) return titre;

  return avant + concept.mots[locale] + numero + apres;
}
