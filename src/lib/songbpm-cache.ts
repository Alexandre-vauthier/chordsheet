import { getAdminDb } from '@/lib/firebase-admin';

/**
 * Mémoire durable des recherches de tempo et de tonalité.
 *
 * Le proxy qui contourne Cloudflare est facturé à l'appel, avec un quota mensuel. Or
 * les échecs n'étaient volontairement pas mis en cache, pour ne pas figer un résultat
 * vide : conséquence, **chaque session ré-interrogeait le service pour les mêmes
 * morceaux absents de sa base**, indéfiniment. Avec la moitié des titres introuvables,
 * c'est là que le quota partait.
 *
 * On garde donc les deux issues. Un succès est définitif — le tempo d'un morceau ne
 * change pas. Un échec expire, pour qu'un titre ajouté plus tard chez eux finisse par
 * être retrouvé, sans pour autant être retenté à chaque ouverture.
 */

const COLLECTION = 'bpmLookups';

/** Délai avant de retenter un morceau que le service n'a pas trouvé. */
const MISS_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface BpmResult {
  tempo: number | null;
  key: string | null;
}

/**
 * Marqueur de version des entrées vides.
 *
 * Un échec n'a pas toujours le même sens : « le morceau est absent de leur base » se
 * mémorise, « le proxy a rendu 401, quota atteint » ne se mémorise pas — c'est
 * passager. Les premières entrées vides ont été écrites pendant une panne de quota,
 * avant que Deezer soit consulté : elles bloquaient une source qui, elle, avait la
 * réponse.
 *
 * Plutôt qu'une purge, le marqueur les périme d'elles-mêmes : une entrée vide qui ne
 * le porte pas est reconsultée. Les nouvelles, écrites après un vrai échec de
 * recherche, le portent et tiennent.
 */
const MISS_SCHEMA = 2;

function docId(title: string, artist: string): string {
  return `${title.trim().toLowerCase()}|${artist.trim().toLowerCase()}`
    .replace(/[^a-z0-9|_-]/g, '_')
    .slice(0, 400);
}

/** Résultat connu, ou `null` s'il faut interroger le service. */
export async function readCachedBpm(title: string, artist: string, now: number): Promise<BpmResult | null> {
  try {
    const snap = await getAdminDb().collection(COLLECTION).doc(docId(title, artist)).get();
    if (!snap.exists) return null;

    const data = snap.data() as Record<string, unknown> | undefined;
    if (!data) return null;

    const tempo = typeof data.tempo === 'number' ? data.tempo : null;
    const key = typeof data.key === 'string' ? data.key : null;

    // Échec mémorisé : on ne le respecte que s'il vient d'une vraie recherche, et
    // tant qu'il n'a pas expiré.
    if (tempo == null && key == null) {
      if (data.missSchema !== MISS_SCHEMA) return null;
      const checkedAt = typeof data.checkedAt === 'number' ? data.checkedAt : 0;
      if (now - checkedAt > MISS_TTL_MS) return null;
    }

    return { tempo, key };
  } catch {
    // Cache indisponible : on interroge le service, comme avant.
    return null;
  }
}

/**
 * Mémorise un résultat.
 *
 * `searched` dit si les sources ont réellement répondu. À faux, un résultat vide
 * n'est pas écrit du tout : mémoriser une panne reviendrait à la rendre durable.
 */
export async function writeCachedBpm(
  title: string,
  artist: string,
  result: BpmResult,
  now: number,
  searched = true,
): Promise<void> {
  const vide = result.tempo == null && result.key == null;
  if (vide && !searched) return;

  try {
    await getAdminDb().collection(COLLECTION).doc(docId(title, artist)).set({
      title: title.trim(),
      artist: artist.trim(),
      tempo: result.tempo,
      key: result.key,
      checkedAt: now,
      ...(vide ? { missSchema: MISS_SCHEMA } : {}),
    });
  } catch {
    // Écriture ratée : sans conséquence, on réinterrogera.
  }
}
