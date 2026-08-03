/**
 * Défilement automatique pendant la lecture et le suivi.
 *
 * Le défilement suivait la mesure : à chaque changement de mesure, la page se
 * repositionnait. Dans une section répétée, revenir de la deuxième mesure à la
 * première faisait donc remonter la grille en plein milieu du morceau, alors que rien
 * n'avait bougé à l'écran — on relisait deux lignes qu'on avait sous les yeux.
 *
 * Le défilement suit désormais la **section**, ce qui est l'unité qu'on lit : on cadre
 * une section en entier quand on y entre, et on ne bouge plus tant qu'on y est. Avec
 * une réserve nécessaire : une section plus haute que l'écran déborde, et il faut bien
 * ramener la mesure jouée quand elle sort du champ.
 *
 * Le calcul est isolé de tout accès au DOM pour être vérifiable.
 */

/** Hauteur du bandeau fixe, plus une marge de confort. */
export const NAVBAR_OFFSET = 104;

/** Marge sous la mesure jouée : collée au bas de l'écran, elle se lit mal. */
const MARGE_BAS = 40;

export interface EtatDefilement {
  scrollY: number;
  viewportHeight: number;
  /** Position du haut de la section dans la fenêtre. */
  sectionTop: number;
  /** Position de la mesure jouée dans la fenêtre. */
  rowTop: number;
  rowBottom: number;
  /** La lecture vient-elle d'entrer dans cette section ? */
  nouvelleSection: boolean;
}

/**
 * Position verticale à atteindre, ou `null` s'il n'y a rien à faire.
 *
 * Trois cas, dans cet ordre :
 *
 * 1. **On entre dans une section** : on la cadre par le haut, c'est l'unité qu'on lit.
 *    Sauf si elle est si haute que la mesure jouée tomberait sous l'écran — on cadre
 *    alors la mesure, un cadrage esthétique qui cache ce qu'on joue ne sert à rien.
 * 2. **On est déjà dans la section et la mesure est visible** : on ne bouge pas. C'est
 *    tout l'objet du changement : une répétition ne doit pas faire sauter la page.
 * 3. **La mesure est sortie de l'écran** : on la ramène.
 */
export function cibleDefilement(e: EtatDefilement): number | null {
  const basUtile = e.viewportHeight - MARGE_BAS;

  if (e.nouvelleSection) {
    // Où tomberait la mesure jouée si on cadrait la section par le haut.
    const rowApresCadrage = NAVBAR_OFFSET + (e.rowBottom - e.sectionTop);
    if (rowApresCadrage <= basUtile) return e.scrollY + e.sectionTop - NAVBAR_OFFSET;
    return e.scrollY + e.rowTop - NAVBAR_OFFSET;
  }

  const visible = e.rowTop >= NAVBAR_OFFSET && e.rowBottom <= basUtile;
  if (visible) return null;

  return e.scrollY + e.rowTop - NAVBAR_OFFSET;
}

/**
 * Suit la mesure jouée, en gardant la section pour repère.
 *
 * `dernièreSection` est une référence tenue par l'appelant : c'est elle qui distingue
 * « on vient d'entrer ici » de « on y est déjà », et donc le cadrage du non-cadrage.
 * La section se déduit du DOM plutôt que du nom de la mesure — un identifiant de
 * section est un UUID, il contient des tirets, le découper serait fragile.
 */
export function suivreMesure(rowId: string, derniereSection: { current: string | null }): void {
  if (typeof window === 'undefined') return;

  const row = document.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(rowId)}"]`);
  if (!row) return;

  const section = row.closest<HTMLElement>('[data-section-id]');
  const sectionId = section?.dataset.sectionId ?? null;
  const nouvelleSection = sectionId !== null && sectionId !== derniereSection.current;
  if (sectionId !== null) derniereSection.current = sectionId;

  const rRow = row.getBoundingClientRect();
  const rSection = section?.getBoundingClientRect();

  const cible = cibleDefilement({
    scrollY: window.scrollY,
    viewportHeight: window.innerHeight,
    sectionTop: rSection?.top ?? rRow.top,
    rowTop: rRow.top,
    rowBottom: rRow.bottom,
    nouvelleSection,
  });

  if (cible !== null) window.scrollTo({ top: cible, behavior: 'smooth' });
}
