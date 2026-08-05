import type { Section, StructureEntry } from '@/types';

/**
 * Dérouler une grille : passer des sections distinctes au morceau tel qu'il se joue.
 *
 * Une grille garde chaque section **une fois**. La structure dit dans quel ordre
 * elles s'enchaînent, et combien de fois chacune. Rien n'est recopié : un couplet
 * joué trois fois reste une seule section, qu'on corrige à un seul endroit. C'est
 * tout l'intérêt du modèle — un tiers des sections existantes sont aujourd'hui
 * des copies faites à la main, qui divergent dès qu'on en corrige une.
 *
 * **Cette fonction est le seul endroit qui sait dérouler.** La vue, l'export PDF,
 * la lecture audio et le suivi micro doivent tous passer par elle. Qu'un seul
 * d'entre eux parcoure `sections` directement, et la page montrera trois couplets
 * là où le PDF n'en imprimera qu'un — une divergence silencieuse, du genre de
 * celles qui coûtent une soirée à retrouver.
 */

/** Un passage du morceau, prêt à être affiché ou joué. */
export interface Bloc {
  section: Section;
  /**
   * Nom affiché pour ce passage.
   *
   * Celui de la section, sauf quand la structure en impose un autre : les mêmes
   * accords s'appellent souvent « Intro » ici et « Refrain » plus loin. C'est ce
   * nom-là que la vue, l'éditeur et le PDF doivent afficher — lire directement
   * `section.label` afficherait « Intro » sur les six passages.
   */
  label: string;
  /** Passages consécutifs à cet endroit (le « ×2 » affiché à côté du titre). */
  repeat: number;
  /**
   * Rang de ce passage parmi ceux de la même section, à partir de zéro.
   *
   * Deux couplets sont deux blocs portant la même section : sans ce rang, les
   * clés de position seraient identiques et le suivi micro confondrait le premier
   * couplet avec le troisième.
   */
  occurrence: number;
}

/**
 * Les blocs d'une grille, dans l'ordre où on les joue.
 *
 * Sans structure, les sections dans leur ordre, une fois chacune, avec leur
 * propre `repeat` : c'est le comportement de toujours, et il reste exact pour
 * toutes les grilles écrites jusqu'ici.
 *
 * Avec structure, c'est elle qui commande, `repeat` compris. Une section citée
 * par la structure mais absente de la grille est ignorée plutôt que de faire
 * échouer l'affichage : une suppression de section ne doit pas rendre une grille
 * illisible.
 */
export function deroulerStructure(sections: Section[], structure?: StructureEntry[]): Bloc[] {
  if (!structure?.length) {
    return sections.map((section) => ({
      section,
      label: section.label,
      repeat: Math.max(1, section.repeat || 1),
      occurrence: 0,
    }));
  }

  const parId = new Map(sections.map((s) => [s.id, s]));
  const vues = new Map<string, number>();
  const blocs: Bloc[] = [];

  for (const entree of structure) {
    const section = parId.get(entree.sectionId);
    if (!section) continue;
    const occurrence = vues.get(section.id) ?? 0;
    vues.set(section.id, occurrence + 1);
    blocs.push({
      section,
      label: entree.label?.trim() || section.label,
      repeat: Math.max(1, entree.repeat || 1),
      occurrence,
    });
  }
  return blocs;
}

/**
 * Clé d'une cellule dans le morceau déroulé.
 *
 * Le rang du passage en fait partie : sans lui, la première mesure du premier
 * couplet et celle du troisième porteraient la même clé, et tout ce qui se repère
 * dans la page — surlignage, défilement, suivi micro — confondrait les deux.
 */
export function positionCellule(bloc: Bloc, rowIndex: number, cellIndex: number): string {
  return `${cleMesure(bloc.section.id, bloc.occurrence, rowIndex)}:${cellIndex}`;
}

/** Identifiant d'une mesure dans le morceau déroulé, pour le défilement. */
export function positionMesure(bloc: Bloc, rowIndex: number): string {
  return cleMesure(bloc.section.id, bloc.occurrence, rowIndex);
}

/**
 * La même clé, à partir des champs bruts.
 *
 * La lecture ne transporte pas le bloc, seulement de quoi le désigner. Elle doit
 * pourtant viser la mesure exacte à l'écran : le défilement s'était mis à ne plus
 * rien trouver le jour où la clé a gagné le rang du passage sans que le
 * défilement le sache.
 */
export function cleMesure(sectionId: string, occurrence: number, rowIndex: number): string {
  return `${sectionId}:${occurrence}:${rowIndex}`;
}

/**
 * Structure de départ, déduite de la grille telle qu'elle est.
 *
 * Ouvrir « Établir la structure » sur une page vide obligerait à tout reconstruire
 * à la main. On propose donc les sections dans leur ordre, avec le nombre de
 * passages qu'elles portent déjà.
 */
export function structureParDefaut(sections: Section[]): StructureEntry[] {
  return sections.map((s) => ({ sectionId: s.id, repeat: Math.max(1, s.repeat || 1) }));
}

/**
 * La structure dit-elle autre chose que l'ordre naturel des sections ?
 *
 * Renommer un passage compte : deux passages de la même section nommés
 * différemment ne se lisent pas comme l'ordre nu des sections.
 *
 * Sert à ne pas proposer une bascule « Grille harmonique / Déroulé » qui
 * montrerait deux fois la même chose.
 */
export function structureUtile(sections: Section[], structure?: StructureEntry[]): boolean {
  if (!structure?.length) return false;
  const naturel = structureParDefaut(sections);
  if (naturel.length !== structure.length) return true;
  return structure.some(
    (e, i) => e.sectionId !== naturel[i].sectionId || e.repeat !== naturel[i].repeat || !!e.label?.trim(),
  );
}
