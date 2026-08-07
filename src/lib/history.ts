'use client';

import { useCallback, useReducer } from 'react';

/**
 * Annuler et refaire, sur un état unique.
 *
 * L'éditeur tient toute la grille dans un seul état. Empiler ses valeurs
 * successives rend donc **toute** action annulable de la même façon — une saisie
 * d'accord, une duplication de section, un déplacement, une suppression — sans
 * avoir à décrire chaque action ni son inverse. C'est ce qui rend la chose
 * abordable ici : il n'y a pas de commandes à écrire, seulement des états.
 *
 * Le coût mémoire reste faible malgré les apparences : les mises à jour étant
 * immuables, deux états voisins partagent presque tout leur contenu. Seul ce qui
 * change est réellement dupliqué.
 *
 * L'implémentation passe par un réducteur, et non par des refs mises à jour dans
 * un `setState` : React peut appeler deux fois une fonction de mise à jour (mode
 * strict), ce qui empilerait deux fois le même état. Un réducteur est pur, donc
 * insensible à ce doublement — et se teste sans React.
 */

export interface EtatHistorique<T> {
  present: T;
  passe: T[];
  futur: T[];
}

export type ActionHistorique<T> =
  | { type: 'poser'; maj: T | ((present: T) => T); historique: boolean; limite: number }
  | { type: 'annuler' }
  | { type: 'refaire' }
  | { type: 'reinitialiser'; valeur: T };

export function reduireHistorique<T>(
  etat: EtatHistorique<T>,
  action: ActionHistorique<T>,
): EtatHistorique<T> {
  switch (action.type) {
    case 'poser': {
      const suivant =
        typeof action.maj === 'function' ? (action.maj as (p: T) => T)(etat.present) : action.maj;
      // Une mise à jour qui ne change rien ne s'empile pas : plusieurs écritures
      // de l'éditeur renvoient l'état reçu quand elles n'ont rien à faire, et
      // elles rempliraient la pile de doublons qu'annuler ne défairait pas.
      if (Object.is(suivant, etat.present)) return etat;
      // Hors historique : les recalculs automatiques (la difficulté, déduite des
      // sections) ne sont pas des gestes. Les empiler ferait qu'annuler une fois
      // ne rendrait la main sur rien de visible.
      if (!action.historique) return { ...etat, present: suivant };
      return {
        present: suivant,
        passe: [...etat.passe, etat.present].slice(-action.limite),
        // Toute action neuve coupe la branche : ce qu'on avait annulé n'est plus
        // rattachable à ce qu'on vient de faire.
        futur: [],
      };
    }

    case 'annuler': {
      if (etat.passe.length === 0) return etat;
      return {
        present: etat.passe[etat.passe.length - 1],
        passe: etat.passe.slice(0, -1),
        futur: [etat.present, ...etat.futur],
      };
    }

    case 'refaire': {
      if (etat.futur.length === 0) return etat;
      return {
        present: etat.futur[0],
        passe: [...etat.passe, etat.present],
        futur: etat.futur.slice(1),
      };
    }

    case 'reinitialiser':
      return { present: action.valeur, passe: [], futur: [] };
  }
}

export interface Historique {
  annuler: () => void;
  refaire: () => void;
  reinitialiser: (valeur: unknown) => void;
  peutAnnuler: boolean;
  peutRefaire: boolean;
}

/** Combien d'états on garde. Au-delà, les plus anciens tombent. */
const LIMITE = 60;

export function useHistorique<T>(
  initial: T,
  limite = LIMITE,
): [T, (maj: T | ((present: T) => T), options?: { historique?: boolean }) => void, Historique] {
  const [etat, envoyer] = useReducer(reduireHistorique<T>, {
    present: initial,
    passe: [],
    futur: [],
  });

  const poser = useCallback(
    (maj: T | ((present: T) => T), options?: { historique?: boolean }) => {
      envoyer({ type: 'poser', maj, historique: options?.historique !== false, limite });
    },
    [limite],
  );

  const annuler = useCallback(() => envoyer({ type: 'annuler' }), []);
  const refaire = useCallback(() => envoyer({ type: 'refaire' }), []);
  const reinitialiser = useCallback((valeur: unknown) => envoyer({ type: 'reinitialiser', valeur: valeur as T }), []);

  return [
    etat.present,
    poser,
    {
      annuler,
      refaire,
      reinitialiser,
      peutAnnuler: etat.passe.length > 0,
      peutRefaire: etat.futur.length > 0,
    },
  ];
}
