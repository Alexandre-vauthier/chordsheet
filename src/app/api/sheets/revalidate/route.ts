import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getAdminAuth } from '@/lib/firebase-admin';
import { routing } from '@/i18n/routing';
import { sheetRevalidationPaths } from '@/lib/sheet-url';

/**
 * Régénérer la page d'une grille tout de suite après sa sauvegarde.
 *
 * La page est en `revalidate = 3600` : sans cette route, une grille qui passe de
 * privée à publique gardait pendant une heure sa page en cache, donc **sans la
 * redirection** vers la forme à jour. Et un morceau renommé continuait aussi
 * longtemps à servir son ancien slug comme forme canonique.
 *
 * L'écriture, elle, reste côté client — c'est le navigateur qui écrit dans
 * Firestore. Cette route ne fait qu'invalider le cache ; elle ne touche à aucune
 * donnée, et un échec ne doit donc jamais faire échouer une sauvegarde.
 *
 * Garde : un jeton valide suffit. Rien n'est modifié ni lu, le seul coût d'un abus
 * serait de faire régénérer des pages — négligeable, et hors de portée d'un visiteur
 * anonyme.
 */

/** La forme d'un identifiant, pour ne pas invalider n'importe quel chemin. */
const IDENTIFIANT = /^[A-Za-z0-9]{20}$/;

export async function POST(request: NextRequest) {
  const entete = request.headers.get('authorization');
  if (!entete?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Jeton manquant.' }, { status: 401 });
  }
  try {
    await getAdminAuth().verifyIdToken(entete.slice(7));
  } catch {
    return NextResponse.json({ error: 'Session invalide.' }, { status: 401 });
  }

  let corps: {
    id?: string;
    title?: string | null;
    artist?: string | null;
    previousTitle?: string | null;
    previousArtist?: string | null;
  };
  try {
    corps = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps illisible.' }, { status: 400 });
  }

  const { id } = corps;
  if (!id || !IDENTIFIANT.test(id)) {
    return NextResponse.json({ error: 'Identifiant invalide.' }, { status: 400 });
  }

  /*
   * Ce qui est réellement en cache, et ce qui ne l'est pas.
   *
   * Mesuré sur la sortie de `next build` : la page d'une grille est
   * `ƒ Dynamic — server-rendered on demand`, son `revalidate = 3600` est donc
   * inerte et la redirection y est juste dès la sauvegarde, sans rien invalider.
   * Le **sitemap**, lui, est statique avec une revalidation d'un jour : c'est lui
   * qui, sans cet appel, garderait l'ancien slug d'un morceau renommé jusqu'à
   * vingt-quatre heures.
   *
   * Les chemins de la grille sont invalidés quand même. Ils ne coûtent rien
   * aujourd'hui, et le jour où la page redeviendra statique — il suffit qu'une
   * dépendance dynamique disparaisse de l'arbre — le délai ne réapparaîtra pas en
   * silence.
   */
  const chemins = ['/sitemap.xml', ...sheetRevalidationPaths([...routing.locales], corps)];
  for (const chemin of chemins) revalidatePath(chemin);

  return NextResponse.json({ revalidated: chemins });
}
