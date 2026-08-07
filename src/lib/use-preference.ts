'use client';

import { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import { useAuth } from '@/lib/auth-context';
import { USER_PREFERENCE_DEFAULTS } from '@/lib/user-preferences';
import type { UserPreferences } from '@/types';

/**
 * Le calque des écritures en cours, partagé par toute l'application.
 *
 * Il vit hors des composants à dessein. L'aperçu de la page de réglages lit les
 * mêmes préférences que les interrupteurs situés en dessous : si chaque composant
 * gardait son propre calque, l'aperçu ne bougerait qu'après la réponse de
 * Firestore, une demi-seconde plus tard. Or ce qu'on montre, c'est précisément
 * l'effet immédiat du geste.
 *
 * Une valeur n'y reste que le temps de son écriture : la source de vérité reste le
 * document utilisateur.
 */
const calques = new Map<string, unknown>();
const abonnes = new Set<() => void>();

function prevenir() {
  for (const f of abonnes) f();
}

function souscrire(f: () => void) {
  abonnes.add(f);
  return () => { abonnes.delete(f); };
}

/**
 * Lire et écrire une préférence utilisateur.
 *
 * La page de réglages tenait treize `useState` en miroir du document Firestore,
 * réhydratés par un effet : deux sources de vérité pour la même donnée, et un
 * `catch { /* silent *\/ }` sur chacune des écritures.
 *
 * Ce silence était le pire des comportements possibles. Réseau coupé, quota
 * dépassé, règle refusée : l'interrupteur restait basculé, rien n'était
 * enregistré, et la personne repartait persuadée du contraire. **Un interrupteur
 * qui ment est pire qu'un interrupteur qui ne marche pas.**
 *
 * Ici, la source de vérité redevient le contexte d'authentification. Le calque ne
 * sert qu'à ne pas attendre le réseau pour bouger — sans lui, l'interrupteur
 * traînerait et l'écran paraîtrait cassé. En cas d'échec, le calque est levé :
 * **l'interrupteur revient visiblement en arrière**, et l'appelant peut proposer
 * de réessayer.
 */
export function usePreference<K extends keyof UserPreferences>(key: K) {
  const { user, updateUser } = useAuth();
  const [echec, setEchec] = useState(false);

  const calque = useSyncExternalStore(
    souscrire,
    () => calques.get(key) as UserPreferences[K] | undefined,
    () => undefined,
  );

  /**
   * Le rang de la dernière écriture lancée.
   *
   * Deux clics rapides lancent deux écritures. Si la première échoue après que la
   * seconde a réussi, annuler ferait reculer une valeur que la personne vient de
   * corriger. On n'annule donc que si l'écriture en échec est encore la dernière.
   */
  const rang = useRef(0);
  const dernierEcrit = useRef<UserPreferences[K] | null>(null);

  const enregistre = useCallback(
    async (valeur: UserPreferences[K]) => {
      const mien = ++rang.current;
      dernierEcrit.current = valeur;
      calques.set(key, valeur);
      prevenir();
      setEchec(false);
      try {
        await updateUser({ [key]: valeur } as Partial<UserPreferences>);
      } catch {
        if (mien === rang.current) setEchec(true);
      } finally {
        // Réussite : le contexte porte la valeur, le calque n'a plus lieu d'être.
        // Échec : on le lève aussi, pour que l'interrupteur revienne en arrière.
        if (mien === rang.current) {
          calques.delete(key);
          prevenir();
        }
      }
    },
    [key, updateUser],
  );

  const valeur = (calque ?? user?.[key] ?? USER_PREFERENCE_DEFAULTS[key]) as UserPreferences[K];

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
