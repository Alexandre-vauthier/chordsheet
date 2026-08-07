'use client';

import { useCallback, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { USER_PREFERENCE_DEFAULTS } from '@/lib/user-preferences';
import type { UserPreferences } from '@/types';

/**
 * Lire et écrire une préférence utilisateur.
 *
 * La page de profil tenait treize `useState` en miroir du document Firestore,
 * réhydratés par un effet : deux sources de vérité pour la même donnée, et un
 * `catch { /* silent *\/ }` sur chacune des écritures.
 *
 * Ce silence était le pire des comportements possibles. Réseau coupé, quota
 * dépassé, règle refusée : l'interrupteur restait basculé, rien n'était
 * enregistré, et la personne repartait persuadée du contraire. **Un interrupteur
 * qui ment est pire qu'un interrupteur qui ne marche pas.**
 *
 * Ici, la source de vérité redevient le contexte d'authentification. Un calque
 * local ne sert qu'à ne pas attendre le réseau pour bouger — sans lui,
 * l'interrupteur traînerait d'une demi-seconde et l'écran paraîtrait cassé. En cas
 * d'échec, le calque est levé : **l'interrupteur revient visiblement en arrière**,
 * et l'appelant peut proposer de réessayer.
 */
export function usePreference<K extends keyof UserPreferences>(key: K) {
  const { user, updateUser } = useAuth();
  const [calque, setCalque] = useState<UserPreferences[K] | undefined>(undefined);
  const [echec, setEchec] = useState(false);

  /**
   * Le rang de la dernière écriture lancée.
   *
   * Deux clics rapides sur le même interrupteur lancent deux écritures. Si la
   * première échoue après que la seconde a réussi, annuler ferait reculer une
   * valeur que la personne vient de corriger. On n'annule donc que si l'écriture
   * en échec est encore la dernière.
   */
  const rang = useRef(0);
  const dernierEcrit = useRef<UserPreferences[K] | null>(null);

  const enregistre = useCallback(
    async (valeur: UserPreferences[K]) => {
      const mien = ++rang.current;
      dernierEcrit.current = valeur;
      setCalque(valeur);
      setEchec(false);
      try {
        await updateUser({ [key]: valeur } as Partial<UserPreferences>);
        // Le contexte porte maintenant la valeur : le calque n'a plus lieu d'être.
        if (mien === rang.current) setCalque(undefined);
      } catch {
        if (mien === rang.current) {
          setCalque(undefined);
          setEchec(true);
        }
      }
    },
    [key, updateUser],
  );

  const depuisLeCompte = user?.[key];
  const valeur = (calque ?? depuisLeCompte ?? USER_PREFERENCE_DEFAULTS[key]) as UserPreferences[K];

  return {
    valeur,
    /** Enregistre, en affichant tout de suite. Revient en arrière si l'écriture échoue. */
    definir: enregistre,
    echec,
    /** Rejoue la dernière écriture tentée. Sans effet s'il n'y en a pas eu. */
    reessayer: useCallback(() => {
      if (dernierEcrit.current !== null) void enregistre(dernierEcrit.current);
    }, [enregistre]),
  };
}
