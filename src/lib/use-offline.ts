'use client';

import { useCallback, useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';

/**
 * Savoir qu'on est coupé, et rendre un répertoire disponible d'avance.
 *
 * Le cache de Firestore ne garde que ce qu'on a déjà ouvert. Or on prépare un
 * concert chez soi et on le joue ailleurs : sans préchargement, il faudrait
 * penser à ouvrir chacune de ses grilles une par une, la veille, en se souvenant
 * de ne pas en oublier. C'est précisément ce qu'on ne fait pas.
 */

/**
 * Sommes-nous hors ligne ?
 *
 * `navigator.onLine` ment volontiers : il dit vrai dès qu'une interface réseau
 * existe, même sans accès réel. Il ne se trompe presque jamais dans l'autre sens,
 * en revanche — quand il annonce hors ligne, on l'est. On ne s'en sert donc que
 * pour signaler la coupure, jamais pour décider d'un comportement.
 *
 * L'état part de « en ligne » et n'est lu qu'après le montage : le rendu serveur
 * n'a pas de `navigator`, et prétendre le contraire ferait diverger le HTML servi
 * de celui que le navigateur reconstruit.
 */
export function useHorsLigne(): boolean {
  const [horsLigne, setHorsLigne] = useState(false);

  useEffect(() => {
    const relire = () => setHorsLigne(!navigator.onLine);
    relire();
    window.addEventListener('online', relire);
    window.addEventListener('offline', relire);
    return () => {
      window.removeEventListener('online', relire);
      window.removeEventListener('offline', relire);
    };
  }, []);

  return horsLigne;
}

export type EtatPrechargement =
  | { phase: 'repos' }
  | { phase: 'en cours'; faits: number; total: number }
  | { phase: 'fini'; total: number; echecs: number }
  | { phase: 'echec' };

/**
 * Met en cache les grilles d'une setlist, pour qu'elles s'ouvrent sans réseau.
 *
 * Il suffit de lire chaque document : le cache persistant de Firestore garde ce
 * qui passe par lui, et une lecture ultérieure hors ligne y retombera. On lit
 * donc une par une, en série — un concert fait vingt morceaux, pas mille, et la
 * série laisse la connexion tranquille tout en donnant une progression honnête.
 */
export function usePrechargement() {
  const [etat, setEtat] = useState<EtatPrechargement>({ phase: 'repos' });

  const precharger = useCallback(async (sheetIds: string[]) => {
    if (!sheetIds.length) return;
    setEtat({ phase: 'en cours', faits: 0, total: sheetIds.length });
    let echecs = 0;
    try {
      const db = getDb();
      for (let i = 0; i < sheetIds.length; i++) {
        try {
          await getDoc(doc(db, 'sheets', sheetIds[i]));
        } catch {
          // Grille supprimée, droits insuffisants, coupure en cours de route :
          // on compte et on continue, une grille manquante n'empêche pas les autres.
          echecs++;
        }
        setEtat({ phase: 'en cours', faits: i + 1, total: sheetIds.length });
      }
      setEtat({ phase: 'fini', total: sheetIds.length, echecs });
    } catch {
      setEtat({ phase: 'echec' });
    }
  }, []);

  return { etat, precharger };
}
