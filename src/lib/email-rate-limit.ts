import { getAdminDb } from '@/lib/firebase-admin';

/**
 * Limitation d'usage des envois de mails.
 *
 * La route de mot de passe oublié est forcément accessible sans compte : sans garde,
 * n'importe qui peut la boucler pour inonder une adresse tierce, et faire grimper la
 * facture d'envoi au passage. On limite donc par adresse **et** par IP — l'une sans
 * l'autre laisse une porte ouverte.
 *
 * Compteur en Firestore plutôt qu'en mémoire : les fonctions serverless ne partagent
 * aucun état, un compteur local ne compterait qu'une instance sur N.
 */

const COLLECTION = 'emailRateLimits';

/** Trois envois par quart d'heure : large pour un usage normal, inutilisable pour nuire. */
const MAX_HITS = 3;
const WINDOW_MS = 15 * 60 * 1000;

/**
 * Consomme un jeton. Rend `false` si la limite est atteinte.
 *
 * En cas d'erreur Firestore, **laisse passer** : un compteur en panne ne doit pas
 * empêcher quelqu'un de récupérer son mot de passe.
 */
export async function consumeEmailQuota(key: string, now: number): Promise<boolean> {
  if (!key) return true;

  const id = key.replace(/[^a-zA-Z0-9@._:-]/g, '_').slice(0, 200);
  const ref = getAdminDb().collection(COLLECTION).doc(id);

  try {
    return await getAdminDb().runTransaction(async (tx: {
      get: (r: unknown) => Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }>;
      set: (r: unknown, d: unknown) => void;
    }) => {
      const snap = await tx.get(ref);
      const data = snap.exists ? snap.data() : undefined;

      const resetAt = typeof data?.resetAt === 'number' ? data.resetAt : 0;
      const count = typeof data?.count === 'number' ? data.count : 0;

      if (now > resetAt) {
        tx.set(ref, { count: 1, resetAt: now + WINDOW_MS });
        return true;
      }
      if (count >= MAX_HITS) return false;

      tx.set(ref, { count: count + 1, resetAt });
      return true;
    });
  } catch (err) {
    console.error('[email-rate-limit] compteur indisponible, envoi autorisé :', err);
    return true;
  }
}

/** IP de l'appelant derrière le proxy Vercel, ou chaîne vide si introuvable. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  return forwarded ? forwarded.split(',')[0].trim() : '';
}
