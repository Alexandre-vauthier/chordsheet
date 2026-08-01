import type { Row, Cell, BeatsPerMeasure } from '@/types';

/**
 * Machine à états de la dictée d'accords au micro.
 *
 * Le détecteur produit un flux continu (une analyse toutes les 100 ms). La dictée,
 * elle, a besoin d'événements **discrets** : un accord joué = une cellule remplie.
 * Ce fichier fait cette conversion, et rien d'autre — d'où sa forme de fonction pure,
 * qui se teste sans micro ni navigateur.
 *
 * Le silence sert de touche Entrée. C'est ce qui permet d'écrire deux fois le même
 * accord d'affilée : sans lui, « Am Am » serait indiscernable d'un Am tenu.
 */

export interface DictationState {
  /** Accord entendu et retenu, en attente du silence qui le validera. */
  pending: string;
  /** Analyses consécutives sans son. */
  silentTicks: number;
  /** Analyses pendant lesquelles `pending` s'est confirmé. */
  heardTicks: number;
}

export interface DictationInput {
  /** Accord lissé du détecteur, chaîne vide si rien de fiable. */
  chord: string;
  /** Y a-t-il du son ? Indépendant de la reconnaissance. */
  audible: boolean;
}

export const INITIAL_DICTATION: DictationState = { pending: '', silentTicks: 0, heardTicks: 0 };

/**
 * Silence à tenir avant validation, en analyses (100 ms chacune).
 *
 * Trois analyses, soit ~300 ms : assez pour ne pas se déclencher entre deux coups de
 * médiator d'un même accord plaqué, assez court pour que la dictée reste fluide.
 */
export const SILENCE_TICKS = 3;

/**
 * Analyses pendant lesquelles l'accord doit se confirmer avant d'être retenu.
 *
 * Le détecteur vote déjà sur ses cinq dernières analyses ; ce seuil n'ajoute qu'une
 * sécurité contre l'accord fugace entendu au moment où la main change de position.
 */
export const MIN_HEARD_TICKS = 2;

export interface DictationStep {
  state: DictationState;
  /** Accord à écrire dans la cellule, ou null si rien à valider à cette analyse. */
  commit: string | null;
}

/**
 * Une analyse du détecteur → l'état suivant, et éventuellement un accord à écrire.
 *
 * Le silence ne valide que s'il y a quelque chose à valider : un blanc dans une pièce
 * vide ne remplit pas de cellule, et un accord joué mais jamais reconnu n'en remplit
 * pas non plus. Dans le doute, la dictée n'écrit rien — une cellule vide se corrige
 * d'un clic, une cellule fausse se repère beaucoup plus tard.
 */
export function stepDictation(state: DictationState, input: DictationInput): DictationStep {
  if (input.audible) {
    // Du son : on écoute. Un accord reconnu remplace le précédent tant que rien n'a
    // été validé — c'est la dernière position tenue qui compte, pas la première
    // entendue au passage des doigts.
    if (!input.chord) {
      return { state: { ...state, silentTicks: 0 }, commit: null };
    }

    const sameAsPending = input.chord === state.pending;
    return {
      state: {
        pending: input.chord,
        silentTicks: 0,
        heardTicks: sameAsPending ? state.heardTicks + 1 : 1,
      },
      commit: null,
    };
  }

  // Pas de son.
  const silentTicks = state.silentTicks + 1;

  const ready =
    state.pending !== '' &&
    state.heardTicks >= MIN_HEARD_TICKS &&
    silentTicks >= SILENCE_TICKS;

  if (!ready) {
    return { state: { ...state, silentTicks }, commit: null };
  }

  // Validé : on repart d'un état vierge, prêt pour l'accord suivant.
  return { state: { ...INITIAL_DICTATION, silentTicks }, commit: state.pending };
}

/* ── Écriture dans la grille ────────────────────────────────────────────────── */

export interface CellPosition {
  rowIndex: number;
  cellIndex: number;
}

export interface DictationWrite {
  rows: Row[];
  /** Cellule à viser ensuite. */
  next: CellPosition;
}

/**
 * Écrit un accord dans une cellule et désigne la suivante.
 *
 * Reproduit exactement le parcours de Tab : cellule suivante, puis mesure suivante,
 * et création d'une mesure quand on arrive au bout — sans quoi il faudrait
 * s'interrompre pour cliquer « ajouter une mesure » au milieu d'une dictée.
 *
 * Fonction pure : elle ne connaît ni React ni le micro, et se teste donc seule.
 * Rend `null` si la position n'existe pas, plutôt que d'inventer une cellule.
 */
export function applyDictatedChord(
  rows: Row[],
  at: CellPosition,
  chord: string,
  beatsPerMeasure: BeatsPerMeasure,
  makeRow: (beats: BeatsPerMeasure) => Row,
): DictationWrite | null {
  const row = rows[at.rowIndex];
  if (!row || !row[at.cellIndex]) return null;

  const next = rows.map((r) => [...r]);
  next[at.rowIndex][at.cellIndex] = { ...row[at.cellIndex], chord } as Cell;

  let cellIndex = at.cellIndex + 1;
  let rowIndex = at.rowIndex;
  if (cellIndex >= row.length) {
    cellIndex = 0;
    rowIndex += 1;
  }
  if (rowIndex >= next.length) {
    next.push(makeRow(beatsPerMeasure));
  }

  return { rows: next, next: { rowIndex, cellIndex } };
}

/**
 * Recule d'une cellule et l'efface : le rattrapage d'une détection fausse.
 *
 * Ne remonte pas au-delà de la première cellule de la section, et ne supprime jamais
 * la mesure qu'une correction viderait — effacer une mesure entière parce qu'on
 * corrige un accord serait une surprise désagréable.
 */
export function undoDictatedChord(rows: Row[], at: CellPosition): DictationWrite | null {
  let rowIndex = at.rowIndex;
  let cellIndex = at.cellIndex - 1;

  if (cellIndex < 0) {
    rowIndex -= 1;
    if (rowIndex < 0) return null;
    cellIndex = (rows[rowIndex]?.length ?? 0) - 1;
  }
  if (!rows[rowIndex]?.[cellIndex]) return null;

  const next = rows.map((r) => [...r]);
  next[rowIndex][cellIndex] = { ...next[rowIndex][cellIndex], chord: '' } as Cell;

  return { rows: next, next: { rowIndex, cellIndex } };
}
