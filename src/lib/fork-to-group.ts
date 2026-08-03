'use client';

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import { toFirestore } from '@/lib/firestore-helpers';
import type { Group, NewSheet, Sheet } from '@/types';

/**
 * Copie une grille dans un groupe.
 *
 * Rattacher, c'est toujours copier : la grille du groupe est indépendante de
 * l'originale, et la modifier ne doit jamais toucher celle de son auteur.
 *
 * Cette règle vivait en deux exemplaires, dans la page du groupe et dans la fenêtre
 * « ajouter à », et les deux ont divergé dès la première évolution. Elle vit ici
 * désormais, et les deux appellent.
 *
 * Trois décisions que la copie porte, et qui n'allaient pas de soi :
 *
 * - **elle appartient au groupe**, pas à qui l'y met. Sinon elle atterrit dans le
 *   book personnel à côté de l'original, et compte dans la réputation d'une personne
 *   alors qu'elle est collective ;
 * - **sa visibilité suit celle du groupe.** Privée dans un groupe privé, ce qui est
 *   le cas des compositions qu'on ne veut pas publier ; publique dans un groupe
 *   public, sans quoi rattacher une grille à sa vitrine ne produit rien de visible ;
 * - **on garde la trace de qui l'a déposée** (`forkedBy`) : on sait à qui s'adresser,
 *   et la copie peut redevenir personnelle si besoin.
 */
export async function forkSheetToGroup(
  source: Sheet,
  group: Pick<Group, 'id' | 'name' | 'isPublic'>,
  byUserId: string,
): Promise<{ id: string; sheet: Sheet }> {
  const db = getDb();

  // Les compteurs et les dates ne se recopient pas : la copie repart de zéro.
  const { id: _id, viewCount: _v, averageRating: _a, ratingCount: _r, createdAt: _c, updatedAt: _u, ...rest } = source;
  void _id; void _v; void _a; void _r; void _c; void _u;

  const copy: NewSheet = {
    ...rest,
    ownerId: group.id!,
    ownerName: group.name,
    isPublic: !!group.isPublic,
    groupId: group.id!,
    forkedFrom: source.id,
    forkedBy: byUserId,
  };

  const ref = await addDoc(collection(db, 'sheets'), {
    ...toFirestore(copy),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    viewCount: 0,
  });

  return { id: ref.id, sheet: { ...(copy as Sheet), id: ref.id, viewCount: 0 } };
}
