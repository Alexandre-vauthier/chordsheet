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

/**
 * Requêtes menées de front.
 *
 * En série, préparer un book de deux cents grilles demandait une minute et demie
 * pour quatre-vingts secondes d'attente réseau : la connexion passait son temps
 * à ne rien faire. Six de front la saturent sans la noyer, et ramènent le même
 * book sous les vingt secondes. Au-delà, on gagne peu et on prend le risque de
 * faire tousser un réseau de téléphone.
 */
const FRONT = 6;

/** Exécute des tâches par petits paquets, sans jamais dépasser `front` en cours. */
async function enParallele(taches: (() => Promise<void>)[], front: number): Promise<void> {
  let i = 0;
  const ouvriers = Array.from({ length: Math.min(front, taches.length) }, async () => {
    while (i < taches.length) await taches[i++]();
  });
  await Promise.all(ouvriers);
}

export type EtatPrechargement =
  | { phase: 'repos' }
  | { phase: 'en cours'; faits: number; total: number }
  | { phase: 'fini'; total: number; echecs: number }
  | { phase: 'echec' };

/**
 * Combien de ces pages sont réellement en cache ?
 *
 * On pourrait retenir qu'on les a préchargées, mais ce serait retenir une
 * affirmation plutôt que constater un fait : le cache est purgé à chaque montée
 * de version du service worker, et l'utilisateur peut vider ses données. On
 * interroge donc le cache lui-même, ce qui a le mérite de ne jamais mentir.
 *
 * On compte au lieu de répondre par oui ou par non. Le tout-ou-rien annonçait
 * « rien en cache » dès qu'une seule page sur quatre-vingt-douze manquait — une
 * grille supprimée ou devenue inaccessible dans un book suffisait à ce que
 * l'application repropose éternellement de tout télécharger.
 */
async function combienEnCache(pages: string[]): Promise<number> {
  if (!pages.length || typeof caches === 'undefined') return 0;
  try {
    const trouvees = await Promise.all(
      pages.map((p) => caches.match(p, { ignoreVary: true }).then((r) => !!r)),
    );
    return trouvees.filter(Boolean).length;
  } catch {
    return 0;
  }
}

/**
 * Une grille prête pour le hors ligne : ses données et sa page.
 */
export interface GrilleAPrecharger {
  id: string;
  page: string;
}

/**
 * Fichiers de build déjà demandés, pour ne pas les redemander quatre-vingt-douze
 * fois : les pages d'un même type partagent presque tout leur code.
 */
const dejaDemandes = new Set<string>();

/**
 * Demande une page, et le code dont elle a besoin pour vivre.
 *
 * Le HTML seul ne suffit pas, et c'est ce qui manquait : sans réseau la page
 * s'affichait un dixième de seconde puis laissait place à une erreur. Elle était
 * bien servie depuis le cache, mais le code qui la fait fonctionner n'y était
 * pas — sur un téléphone où l'on n'avait jamais ouvert de grille en ligne, ces
 * fichiers n'avaient jamais été téléchargés.
 *
 * On les tire donc du HTML lui-même, qui les nomme tous, plutôt que d'entretenir
 * une liste qui serait fausse au premier déploiement.
 *
 * La charge du routeur est demandée au passage. Elle ne suffit pas à naviguer
 * hors ligne (elle dépend de l'état de navigation du moment, voir
 * `NavigationHorsLigne`), mais elle ne coûte rien et sert aux préchargements que
 * le routeur fait de lui-même.
 */
async function demanderPage(page: string): Promise<boolean> {
  let html: Response;
  try {
    html = await fetch(page);
    if (!html.ok) return false;
  } catch {
    return false;
  }

  void fetch(page, { headers: { RSC: '1' } }).catch(() => {});

  try {
    const texte = await html.clone().text();
    const fichiers = new Set(
      [...texte.matchAll(/\/_next\/static\/[^"'\\\s>)]+/g)]
        .map((m) => m[0])
        .filter((f) => !dejaDemandes.has(f)),
    );
    for (const f of fichiers) dejaDemandes.add(f);
    await Promise.allSettled([...fichiers].map((f) => fetch(f)));
  } catch {
    // Page servie mais illisible en texte : on garde ce qu'on a.
  }
  return true;
}

/**
 * Rend un répertoire jouable sans réseau : ses données **et** ses pages.
 *
 * Les deux sont nécessaires et ne se cachent pas au même endroit. Les données
 * tiennent dans le cache de Firestore : il suffit de lire chaque document, ce qui
 * y passe y reste. Les pages tiennent dans le service worker, et il faut les lui
 * donner explicitement — une adresse comme `/fr/sheet/abc` n'existe pas d'avance,
 * donc elle ne peut ni être mise en cache à l'installation ni l'être en la
 * visitant, puisque la navigation se fait côté client.
 *
 * Une grille compte pour **une** étape, quel que soit le nombre de requêtes
 * qu'elle demande. Compter les requêtes affichait « 182 » à qui n'a que
 * quatre-vingt-douze grilles.
 *
 * Six unités de front (voir `FRONT`) : en série, la connexion passe son temps à
 * attendre.
 */
export function usePrechargement() {
  const [etat, setEtat] = useState<EtatPrechargement>({ phase: 'repos' });

  const precharger = useCallback(async (grilles: GrilleAPrecharger[], pages: string[] = []) => {
    const total = grilles.length + pages.length;
    if (!total) return;
    setEtat({ phase: 'en cours', faits: 0, total });
    let echecs = 0;
    let faits = 0;
    const avance = () => setEtat({ phase: 'en cours', faits: ++faits, total });

    try {
      const db = getDb();
      const taches: (() => Promise<void>)[] = [
        ...grilles.map((g) => async () => {
          // Grille supprimée, droits insuffisants, coupure en cours de route : on
          // compte et on continue, une grille manquante n'empêche pas les autres.
          try {
            await getDoc(doc(db, 'sheets', g.id));
            if (!(await demanderPage(g.page))) echecs++;
          } catch { echecs++; }
          avance();
        }),
        ...pages.map((page) => async () => {
          try { if (!(await demanderPage(page))) echecs++; } catch { echecs++; }
          avance();
        }),
      ];
      await enParallele(taches, FRONT);
      setEtat({ phase: 'fini', total, echecs });
    } catch {
      setEtat({ phase: 'echec' });
    }
  }, []);

  /**
   * Rétablit l'état « disponible » si tout est déjà là.
   *
   * Sans cela, l'information ne survit pas au changement de page : on revient sur
   * son book et l'application propose de le mettre en cache une seconde fois,
   * sans jamais dire qu'il y est déjà.
   */
  const verifier = useCallback(async (pages: string[]) => {
    const presentes = await combienEnCache(pages);
    if (!presentes) return false;
    setEtat({ phase: 'fini', total: pages.length, echecs: pages.length - presentes });
    // Complet seulement si tout y est : un préchargement partiel doit pouvoir
    // être relancé, et le dire.
    return presentes === pages.length;
  }, []);

  return { etat, precharger, verifier };
}

/**
 * Le forfait de la personne est-il compté ?
 *
 * On ne précharge d'office que si la réponse est non. Trois méga-octets passent
 * inaperçus en wifi et se remarquent en itinérance ; le réglage « économiseur de
 * données » du navigateur dit exactement cela, quand il existe.
 *
 * Absent de Safari : dans le doute on considère que non, sans quoi le
 * préchargement automatique ne servirait jamais sur iPhone, là où il est le plus
 * utile.
 */
export function connexionMenagee(): boolean {
  const c = (navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
  }).connection;
  if (!c) return false;
  return !!c.saveData || c.effectiveType === 'slow-2g' || c.effectiveType === '2g';
}
