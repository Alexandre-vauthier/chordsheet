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
 * Ces pages sont-elles réellement en cache ?
 *
 * On pourrait retenir qu'on les a préchargées, mais ce serait retenir une
 * affirmation plutôt que constater un fait : le cache est purgé à chaque montée
 * de version du service worker, et l'utilisateur peut vider ses données. On
 * interroge donc le cache lui-même, ce qui a le mérite de ne jamais mentir.
 */
async function toutesEnCache(pages: string[]): Promise<boolean> {
  if (!pages.length || typeof caches === 'undefined') return false;
  try {
    const trouvees = await Promise.all(
      pages.map((p) => caches.match(p, { ignoreVary: true }).then((r) => !!r)),
    );
    return trouvees.every(Boolean);
  } catch {
    return false;
  }
}

/**
 * Rend une setlist jouable sans réseau : ses données **et** ses pages.
 *
 * Les deux sont nécessaires et ils ne se cachent pas au même endroit.
 *
 * Les **données** tiennent dans le cache de Firestore : il suffit de lire chaque
 * document, ce qui y passe y reste, et une lecture ultérieure hors ligne y
 * retombera.
 *
 * Les **pages** sont l'autre moitié, et c'est celle qui manquait. Une adresse
 * comme `/fr/sets/abc` n'existe pas d'avance : elle ne peut pas être mise en
 * cache à l'installation, et la navigation se faisant côté client, elle ne l'est
 * pas non plus en la visitant. Hors ligne on obtenait donc les grilles mais pas
 * de quoi les afficher, et le lancement du set échouait sur « This page couldn't
 * load ». On demande donc explicitement chaque page ici : la requête traverse le
 * service worker, qui la garde.
 *
 * Tout se fait en série. Un concert fait vingt morceaux, pas mille, et la série
 * laisse la connexion tranquille tout en donnant une progression honnête.
 */
export function usePrechargement() {
  const [etat, setEtat] = useState<EtatPrechargement>({ phase: 'repos' });

  const precharger = useCallback(async (sheetIds: string[], pages: string[] = []) => {
    const total = sheetIds.length + pages.length;
    if (!total) return;
    setEtat({ phase: 'en cours', faits: 0, total });
    let echecs = 0;
    let faits = 0;
    try {
      const db = getDb();
      for (const id of sheetIds) {
        try {
          await getDoc(doc(db, 'sheets', id));
        } catch {
          // Grille supprimée, droits insuffisants, coupure en cours de route :
          // on compte et on continue, une grille manquante n'empêche pas les autres.
          echecs++;
        }
        setEtat({ phase: 'en cours', faits: ++faits, total });
      }
      for (const page of pages) {
        try {
          const rep = await fetch(page);
          if (!rep.ok) echecs++;
        } catch {
          echecs++;
        }
        setEtat({ phase: 'en cours', faits: ++faits, total });
      }
      setEtat({ phase: 'fini', total, echecs });
    } catch {
      setEtat({ phase: 'echec' });
    }
  }, []);

  /**
   * Rétablit l'état « disponible » si les pages sont déjà là.
   *
   * Sans cela, l'information ne survivait pas au changement de page : on revenait
   * sur sa setlist et l'application proposait de la mettre en cache une seconde
   * fois, sans jamais dire qu'elle y était déjà.
   */
  const verifier = useCallback(async (pages: string[]) => {
    if (await toutesEnCache(pages)) {
      setEtat({ phase: 'fini', total: pages.length, echecs: 0 });
    }
  }, []);

  return { etat, precharger, verifier };
}
