import type { InstrumentId } from '@/types';

/**
 * Données et règles de l'accompagnement, sans dépendance à React : ce module est
 * importable depuis le serveur comme depuis le client (`use-playback` les
 * réexporte pour les appelants historiques).
 */

export type PlayStyle = 'block' | 'arpeggio';

/** Instruments capables d'accompagner : la Voix en est exclue. */
export const ACCOMPANIMENT_INSTRUMENTS: InstrumentId[] = ['guitar', 'bass', 'piano', 'mandolin', 'banjo', 'ukulele'];

/** Instrument -> style de jeu (plaqué / arpège). Une entrée = instrument joué. */
export type AccompMap = Record<string, PlayStyle>;

/**
 * Les voix qu'entend un visiteur au premier Play.
 *
 * Toutes en plaqué : l'arpège se perd quand quatre instruments jouent ensemble.
 */
export const ENSEMBLE_VISITEUR: InstrumentId[] = ['guitar', 'piano', 'bass', 'mandolin'];

/**
 * Point de départ de l'accompagnement à chaque chargement de grille : l'instrument
 * du sélecteur, en plaqué. Rien n'est relu depuis la grille (l'auteur ne fixe plus
 * de config de lecture) ni depuis le stockage local (le choix de session n'est pas
 * mémorisé d'une grille à l'autre).
 */
export function initialAccompaniment(
  instrument: InstrumentId,
  chordsAudioDisabled: boolean,
  visiteur = false,
): AccompMap {
  if (chordsAudioDisabled) return {};
  // Un visiteur entend un ensemble, pas un instrument seul : c'est au premier Play
  // qu'il comprend ce que fait le site. Il peut retirer une voix d'un clic.
  if (visiteur) return Object.fromEntries(ENSEMBLE_VISITEUR.map((id) => [id, 'block'])) as AccompMap;
  return { [instrument]: 'block' };
}

/**
 * Le sélecteur d'instrument vient de changer : on répercute le changement sur
 * l'accompagnement pour que le Play suive, sans écraser le reste du choix.
 *
 * Règles, dans cet ordre :
 * - si l'ancienne voix n'est plus dans la map, le lecteur l'a retirée
 *   volontairement (boîte à rythmes seule par exemple) : on ne la réimpose pas ;
 * - sinon elle est remplacée par la nouvelle, qui hérite de son style ;
 * - la nouvelle voix n'est pas ajoutée si elle est déjà là (elle garde alors son
 *   propre style) ni si elle ne peut pas accompagner (la Voix) ;
 * - les instruments ajoutés à côté sont conservés tels quels.
 */
export function swapSelectorVoice(map: AccompMap, previous: InstrumentId, next: InstrumentId): AccompMap {
  if (previous === next || !(previous in map)) return map;

  const out = { ...map };
  const style = out[previous];
  delete out[previous];

  if (ACCOMPANIMENT_INSTRUMENTS.includes(next) && !(next in out)) {
    out[next] = style;
  }
  return out;
}
