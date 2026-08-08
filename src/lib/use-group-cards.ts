'use client';

import { useEffect, useState } from 'react';
import { collection, documentId, getDocs, query, where } from 'firebase/firestore';
import { getDb } from './firebase';
import type { Group } from '@/types';

/**
 * Ce qu'il faut à la carte d'un groupe, et que le document du groupe ne dit pas.
 *
 * **Le nombre de grilles était faux.** La carte comptait `linkedSheetIds`, c'est-à-dire
 * les seules grilles qu'on a *rattachées* au groupe depuis son répertoire personnel.
 * Elle ignorait celles que le groupe **possède** — les copies créées dans le groupe,
 * qui portent son identifiant dans `groupId`. Mesuré sur la base : un groupe annoncé
 * à 5 grilles en montrait 15 sur sa page, un autre annoncé à 0 en montrait 2.
 *
 * On recompose donc ici exactement ce que la page du groupe affiche : l'**union
 * dédoublonnée** des deux ensembles. Une grille peut appartenir aux deux — on lie une
 * grille personnelle, quelqu'un la copie dans le groupe — et la compter deux fois
 * serait un second nombre faux.
 *
 * Les membres viennent avec : leur photo dit d'un coup d'œil qui est dans le groupe,
 * là où « 3 membres » ne dit rien de qui.
 */

export interface FicheGroupe {
  /** Grilles réellement visibles sur la page du groupe. */
  grilles: number;
  membres: { id: string; displayName: string; photoURL: string | null }[];
}

/**
 * Firestore n'accepte que trente valeurs par `in`. Au-delà, on découpe.
 *
 * Personne n'a trente groupes aujourd'hui, mais le découpage coûte quatre lignes et
 * évite qu'une requête échoue silencieusement le jour où quelqu'un en aura.
 */
const PAR_REQUETE = 30;

function tranches<T>(valeurs: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < valeurs.length; i += PAR_REQUETE) out.push(valeurs.slice(i, i + PAR_REQUETE));
  return out;
}

/** Combien de visages on montre avant de compter le reste. */
export const VISAGES_MONTRES = 4;

/**
 * Les grilles d'un groupe : l'union dédoublonnée de ce qu'il possède et de ce
 * qu'on lui a lié.
 *
 * Pure, et donc vérifiable : c'est le calcul qui était faux, autant le figer.
 * Une grille peut relever des deux ensembles — on lie une grille personnelle,
 * quelqu'un la copie dans le groupe — et la compter deux fois donnerait un second
 * nombre faux, plus grand que ce que la page montre.
 */
export function compterGrilles(possedees: Iterable<string>, liees: string[]): number {
  return new Set([...possedees, ...liees]).size;
}

export function useGroupCards(groups: Group[]): { fiches: Record<string, FicheGroupe>; loading: boolean } {
  const [fiches, setFiches] = useState<Record<string, FicheGroupe>>({});
  const [loading, setLoading] = useState(false);

  /*
   * Une clé de contenu plutôt que le tableau : `groups` est reconstruit à chaque
   * message du `onSnapshot` qui l'alimente, et dépendre de la référence relancerait
   * les requêtes en boucle.
   */
  const cle = groups
    .map((g) => `${g.id}:${g.linkedSheetIds.length}:${g.memberIds.join('.')}`)
    .join('|');

  useEffect(() => {
    if (groups.length === 0) { setFiches({}); return; }
    let annule = false;
    setLoading(true);

    (async () => {
      const db = getDb();
      const ids = groups.map((g) => g.id!).filter(Boolean);

      /*
       * Les grilles que les groupes possèdent, en une requête par tranche plutôt
       * qu'une par groupe. Elles arrivent entières — le SDK navigateur ne sait pas
       * ne demander que les identifiants — mais seuls ceux-ci nous servent. C'est
       * le poste à surveiller si un groupe finit par porter des centaines de
       * grilles ; à cette échelle-là il faudra un compteur tenu sur le document.
       */
      const possedees = new Map<string, Set<string>>();
      const membresParGroupe = new Map<string, string[]>();
      for (const g of groups) membresParGroupe.set(g.id!, g.memberIds.slice(0, VISAGES_MONTRES));

      try {
        for (const tranche of tranches(ids)) {
          const snap = await getDocs(query(collection(db, 'sheets'), where('groupId', 'in', tranche)));
          for (const d of snap.docs) {
            const gid = (d.data() as { groupId?: string }).groupId;
            if (!gid) continue;
            if (!possedees.has(gid)) possedees.set(gid, new Set());
            possedees.get(gid)!.add(d.id);
          }
        }
      } catch {
        // Droits refusés ou index manquant : on ne casse pas la page pour un
        // compte. Elle retombera sur les seules grilles liées, comme avant.
      }

      /* Les profils des membres montrés, tous groupes confondus et sans doublon. */
      const aChercher = [...new Set([...membresParGroupe.values()].flat())];
      const profils = new Map<string, { displayName: string; photoURL: string | null }>();
      try {
        for (const tranche of tranches(aChercher)) {
          const snap = await getDocs(query(collection(db, 'users'), where(documentId(), 'in', tranche)));
          for (const d of snap.docs) {
            const data = d.data() as { displayName?: string; photoURL?: string | null };
            profils.set(d.id, { displayName: data.displayName || '', photoURL: data.photoURL ?? null });
          }
        }
      } catch {
        // Idem : sans les profils, on montrera des initiales vides plutôt que rien.
      }

      if (annule) return;
      const resultat: Record<string, FicheGroupe> = {};
      for (const g of groups) {
        resultat[g.id!] = {
          grilles: compterGrilles(possedees.get(g.id!) ?? [], g.linkedSheetIds),
          membres: (membresParGroupe.get(g.id!) ?? []).map((id) => ({
            id,
            displayName: profils.get(id)?.displayName ?? '',
            photoURL: profils.get(id)?.photoURL ?? null,
          })),
        };
      }
      setFiches(resultat);
      setLoading(false);
    })();

    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);

  return { fiches, loading };
}
