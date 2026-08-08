'use client';

import { getAuth } from './firebase';

/**
 * Demander au serveur de régénérer la page d'une grille.
 *
 * La page est en `revalidate = 3600`, et l'écriture se fait depuis le navigateur :
 * sans cet appel, une grille qui passe de privée à publique gardait pendant une
 * heure sa page en cache — donc **sans la redirection** vers la forme à jour — et
 * un morceau renommé continuait aussi longtemps à servir son ancien slug comme
 * adresse canonique.
 *
 * Sans attente et sans conséquence en cas d'échec : la grille est déjà enregistrée
 * quand on arrive ici. Au pire on retombe sur le délai d'une heure, qui était le
 * comportement d'avant.
 *
 * `previous*` porte le titre et l'artiste **d'avant la sauvegarde**. C'est ce qui
 * permet d'invalider l'ancien slug, seul cas qui ne se déduit pas de l'état
 * nouveau — et le seul qu'on oublierait.
 */
export function revalidateSheet(sheet: {
  id: string;
  title?: string | null;
  artist?: string | null;
  previousTitle?: string | null;
  previousArtist?: string | null;
}): void {
  void (async () => {
    try {
      const jeton = await getAuth().currentUser?.getIdToken();
      if (!jeton) return;
      await fetch('/api/sheets/revalidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton}` },
        body: JSON.stringify(sheet),
      });
    } catch {
      // Le cache se rafraîchira de lui-même dans l'heure.
    }
  })();
}
