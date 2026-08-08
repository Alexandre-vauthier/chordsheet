import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import type { Query, DocumentData, WriteBatch } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { enLots, noteDe, sortDuGroupe } from '@/lib/account-deletion';
import { isAdminEmail, type GroupRole } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * La suppression d'un compte, et de tout ce qui s'y rattache.
 *
 * **Pourquoi côté serveur.** Elle se faisait dans le navigateur, avec les droits de
 * la personne, et c'était intenable pour trois raisons :
 *
 * 1. **Les règles interdisent une partie du ménage.** `ratings` n'a aucun
 *    `allow delete` : un lot client qui tenterait d'effacer une note se ferait
 *    refuser, et comme tout tenait dans un seul `writeBatch`, c'est la suppression
 *    **entière** qui échouait — grilles et setlists comprises.
 * 2. **`deleteUser` exige une connexion récente.** Le code effaçait les données,
 *    *puis* le compte Auth. Sur une session un peu ancienne, Firebase refusait cette
 *    dernière étape : les données étaient déjà parties, l'écran affichait une erreur
 *    générique, et la personne pouvait se reconnecter sur un compte vide.
 * 3. **Le plafond de 500 écritures par lot.** Aucun découpage : un utilisateur
 *    assidu dépassait la limite, et là encore tout échouait d'un bloc.
 *
 * Le SDK Admin lève les trois : il ignore les règles, supprime un compte Auth sans
 * réauthentification, et le travail est découpé en lots.
 *
 * **L'ordre compte.** Les données d'abord, le compte Auth en dernier. Une panne au
 * milieu laisse donc un compte qui existe encore, avec des données incomplètes — la
 * personne peut se reconnecter et relancer, ce qui reprendra le travail là où il en
 * est. L'ordre inverse laisserait des données orphelines que plus personne ne peut
 * demander à effacer.
 *
 * **Ce qui reste.** Les grilles publiques, anonymisées : elles font le catalogue, et
 * d'autres les ont mises dans leur book. C'est la seule chose qui survit, et la
 * politique de confidentialité l'annonce.
 */

interface Bilan {
  grillesAnonymisees: number;
  grillesSupprimees: number;
  sets: number;
  favoris: number;
  notes: number;
  grillesRenotees: number;
  notifications: number;
  commentaires: number;
  groupesQuittes: number;
  groupesSupprimes: number;
}

/** Exécute des écritures par paquets, sous le plafond de Firestore. */
async function ecrire(operations: ((lot: WriteBatch) => void)[]) {
  const db = getAdminDb();
  for (const paquet of enLots(operations)) {
    const lot = db.batch();
    for (const op of paquet) op(lot);
    await lot.commit();
  }
}

/** Les documents d'une requête, sans leur contenu quand seul l'identifiant sert. */
async function refs(requete: Query<DocumentData>) {
  return (await requete.get()).docs;
}

export async function POST(req: NextRequest) {
  const entete = req.headers.get('Authorization');
  if (!entete?.startsWith('Bearer ') || !process.env.FIREBASE_ADMIN_PROJECT_ID) {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  }

  let uid: string;
  let email: string;
  try {
    // `checkRevoked` : un jeton d'une session déjà fermée ne doit pas pouvoir
    // déclencher une suppression définitive.
    const jeton = await getAdminAuth().verifyIdToken(entete.slice(7), true);
    uid = jeton.uid;
    email = jeton.email ?? '';
  } catch {
    return NextResponse.json({ error: 'Session invalide.' }, { status: 401 });
  }

  // La protection qui existait côté client, conservée et désormais inviolable :
  // l'ancienne vivait dans le navigateur, où elle se contournait.
  if (isAdminEmail(email)) {
    return NextResponse.json(
      { error: 'Les comptes administrateurs ne peuvent pas être supprimés.' },
      { status: 403 },
    );
  }

  const db = getAdminDb();
  const bilan: Bilan = {
    grillesAnonymisees: 0, grillesSupprimees: 0, sets: 0, favoris: 0, notes: 0,
    grillesRenotees: 0, notifications: 0, commentaires: 0,
    groupesQuittes: 0, groupesSupprimes: 0,
  };

  /*
   * ── L'abonnement Stripe, avant toute chose ────────────────────────────────
   *
   * Rien n'annulait l'abonnement : un compte Pro supprimé continuait d'être
   * prélevé, sans compte pour s'en apercevoir et sans portail pour l'arrêter — le
   * portail Stripe se demande depuis l'application, qui n'existe plus.
   *
   * **En premier, et bloquant.** Si l'annulation échoue après la suppression des
   * données, on a perdu l'identifiant d'abonnement et le moyen de le retrouver :
   * le prélèvement continue sans que personne ne sache lequel arrêter. Échouer ici
   * ne coûte rien, en revanche — rien n'a encore été touché.
   *
   * Le **client** Stripe, lui, n'est pas supprimé : il porte les factures émises,
   * que la loi impose de conserver. Seul l'abonnement s'arrête.
   */
  try {
    const abonnement = await db.collection('users').doc(uid).collection('private').doc('subscription').get();
    const abonnementId = abonnement.get('stripeSubscriptionId');
    if (typeof abonnementId === 'string' && abonnementId && process.env.STRIPE_SECRET_KEY) {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      await stripe.subscriptions.cancel(abonnementId).catch((err: unknown) => {
        // Déjà résilié : Stripe répond 404, et il n'y a plus rien à faire.
        const code = (err as { code?: string })?.code;
        if (code !== 'resource_missing') throw err;
      });
    }
  } catch (err) {
    console.error('Annulation Stripe échouée, suppression interrompue', { uid, err });
    return NextResponse.json(
      { error: 'L’abonnement n’a pas pu être résilié. Rien n’a été supprimé : réessayez.' },
      { status: 502 },
    );
  }

  try {
    const operations: ((lot: WriteBatch) => void)[] = [];

    /* ── Les grilles : les publiques restent, anonymisées ─────────────────── */
    for (const doc of await refs(db.collection('sheets').where('ownerId', '==', uid))) {
      if (doc.get('isPublic')) {
        operations.push((lot) => lot.update(doc.ref, { ownerId: 'deleted', ownerName: 'Utilisateur supprimé' }));
        bilan.grillesAnonymisees++;
      } else {
        operations.push((lot) => lot.delete(doc.ref));
        bilan.grillesSupprimees++;
      }
    }

    /* ── Setlists et favoris ──────────────────────────────────────────────── */
    for (const doc of await refs(db.collection('sets').where('ownerId', '==', uid))) {
      operations.push((lot) => lot.delete(doc.ref));
      bilan.sets++;
    }
    for (const collection of ['bookmarks', 'setBookmarks']) {
      for (const doc of await refs(db.collection(collection).where('userId', '==', uid))) {
        operations.push((lot) => lot.delete(doc.ref));
        bilan.favoris++;
      }
    }

    /* ── Les notes, et les moyennes qu'elles laissent derrière ────────────── */
    const sesNotes = await refs(db.collection('ratings').where('userId', '==', uid));
    const grillesNotees = new Set<string>();
    for (const doc of sesNotes) {
      operations.push((lot) => lot.delete(doc.ref));
      bilan.notes++;
      const sheetId = doc.get('sheetId');
      if (typeof sheetId === 'string' && sheetId) grillesNotees.add(sheetId);
    }

    /*
     * Chaque grille concernée est renotée depuis les avis qui restent. On les relit
     * plutôt que de soustraire du cache : `averageRating` est arrondi au dixième à
     * l'écriture, une somme reconstituée depuis lui est donc déjà fausse.
     */
    for (const sheetId of grillesNotees) {
      const restantes = (await refs(db.collection('ratings').where('sheetId', '==', sheetId)))
        .filter((d) => d.get('userId') !== uid)
        .map((d) => d.get('rating') as number);
      const note = noteDe(restantes);
      operations.push((lot) => lot.update(db.collection('sheets').doc(sheetId), note));
      bilan.grillesRenotees++;
    }

    /* ── Notifications : celles qu'il a reçues et celles qu'il a émises ───── */
    for (const champ of ['userId', 'fromId']) {
      for (const doc of await refs(db.collection('notifications').where(champ, '==', uid))) {
        operations.push((lot) => lot.delete(doc.ref));
        bilan.notifications++;
      }
    }

    /*
     * ── Les conversations, en entier ──────────────────────────────────────
     *
     * Un fil de commentaires oppose deux personnes : celle qui écrit sous une
     * grille (`commenterId`) et l'auteur de cette grille (`ownerId`). N'effacer que
     * ses propres messages laisserait l'autre devant une question sans réponse et
     * sans destinataire. On efface donc tout message dont il est l'une des deux
     * parties, quel qu'en soit l'auteur.
     */
    const vus = new Set<string>();
    for (const champ of ['commenterId', 'ownerId']) {
      for (const doc of await refs(db.collection('sheetComments').where(champ, '==', uid))) {
        if (vus.has(doc.id)) continue; // il est les deux parties d'un même fil
        vus.add(doc.id);
        operations.push((lot) => lot.delete(doc.ref));
        bilan.commentaires++;
      }
    }

    /* ── Les groupes : ils survivent à celui qui les a créés ──────────────── */
    for (const doc of await refs(db.collection('groups').where('memberIds', 'array-contains', uid))) {
      const sort = sortDuGroupe(
        {
          memberIds: (doc.get('memberIds') as string[]) ?? [],
          roles: (doc.get('roles') as Record<string, GroupRole>) ?? {},
        },
        uid,
      );
      if (sort.action === 'supprimer') {
        operations.push((lot) => lot.delete(doc.ref));
        bilan.groupesSupprimes++;
      } else if (sort.action === 'mettre-a-jour') {
        const { memberIds, roles, ownerId } = sort;
        operations.push((lot) => lot.update(doc.ref, {
          memberIds, roles, updatedAt: new Date(), ...(ownerId ? { ownerId } : {}),
        }));
        bilan.groupesQuittes++;
      }
    }

    /*
     * ── Le document utilisateur, sous-collection comprise ─────────────────
     *
     * Firestore **ne supprime pas** les sous-collections d'un document supprimé :
     * elles deviennent invisibles dans la console mais restent en base, pour
     * toujours. `users/{uid}/private/subscription` porte les identifiants client et
     * abonnement Stripe — exactement le genre de donnée qu'une clôture de compte
     * doit emporter. On l'énumère donc explicitement.
     */
    for (const doc of await refs(db.collection('users').doc(uid).collection('private'))) {
      operations.push((lot) => lot.delete(doc.ref));
    }
    operations.push((lot) => lot.delete(db.collection('users').doc(uid)));

    await ecrire(operations);

    // En dernier, et sans exiger de connexion récente — ce que le navigateur ne
    // pouvait pas faire, et qui laissait des comptes vides derrière lui.
    await getAdminAuth().deleteUser(uid);

    return NextResponse.json({ ok: true, bilan });
  } catch (err) {
    console.error('Suppression de compte échouée', { uid, err });
    return NextResponse.json(
      { error: 'La suppression a échoué. Le compte existe toujours : réessayez.' },
      { status: 500 },
    );
  }
}
