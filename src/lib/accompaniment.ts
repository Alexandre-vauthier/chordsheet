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
