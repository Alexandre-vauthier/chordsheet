/**
 * Service worker : faire que l'application s'ouvre sans réseau.
 *
 * Les données sont déjà gardées par Firestore (cache IndexedDB). Ce qui manque
 * sans service worker, c'est la coque : le navigateur n'obtient même pas le HTML
 * et affiche sa page d'erreur.
 *
 * Trois pièges propres à cette application, tous rencontrés :
 *
 * - **`/` répond par une redirection** vers la langue. Une redirection n'est pas
 *   une réponse « ok », donc elle ne se met pas en cache, et hors ligne le
 *   navigateur ne peut pas la suivre. On sert donc `/fr` quand `/` est demandé
 *   sans réseau, ce qui est le raccourci que les gens gardent sur leur écran ;
 * - **la navigation se fait côté client.** Passer du book à une grille ne produit
 *   aucune requête de navigation : le service worker ne verrait jamais que la
 *   toute première page chargée en dur. Attendre qu'une page soit « visitée »
 *   pour l'avoir en cache ne marche donc pas. Les pages qui comptent sont mises
 *   en cache à l'installation ;
 * - **les pages portent un en-tête `Vary`** (`rsc`, `next-router-state-tree`…).
 *   `caches.match` l'honore, si bien qu'une page bel et bien en cache ne
 *   correspondait pas à la requête suivante. D'où `ignoreVary`.
 *
 * Ce qui n'est jamais intercepté : Firestore, l'authentification et nos routes
 * API. Firestore gère sa file d'attente hors ligne bien mieux qu'un cache HTTP ;
 * s'interposer ne ferait que la casser.
 *
 * Le nom du cache porte une version : la changer suffit à repartir propre.
 */

const VERSION = 'alviena-v2';
const REPLI = '/offline';
const ACCUEIL = '/fr';

/**
 * Pages mises en cache à l'installation.
 *
 * Volontairement peu nombreuses : ce sont les portes d'entrée, celles depuis
 * lesquelles on rejoint le reste. Une liste plus longue allongerait
 * l'installation et échouerait entièrement à la première adresse fautive.
 */
const PAGES = [REPLI, ACCUEIL, '/fr/book', '/fr/sets', '/fr/dashboard'];

const match = (req) => caches.match(req, { ignoreVary: true });

async function garder(req, rep) {
  if (!rep || !rep.ok || rep.type === 'opaqueredirect') return;
  const copie = rep.clone();
  const c = await caches.open(VERSION);
  await c.put(req, copie).catch(() => {});
}

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      // Une par une : `addAll` abandonne tout dès qu'une adresse échoue, et on
      // préfère une installation partielle à pas d'installation du tout.
      .then((c) => Promise.all(PAGES.map((p) => c.add(p).catch(() => {}))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((noms) => Promise.all(noms.filter((n) => n !== VERSION).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

/** Ce qui n'est jamais intercepté : Firestore, l'authentification, nos API. */
function aLaisserPasser(url) {
  return (
    url.pathname.startsWith('/api/') ||
    url.hostname.endsWith('googleapis.com') ||
    url.hostname.endsWith('firebaseio.com') ||
    url.hostname.endsWith('firebaseapp.com') ||
    url.hostname.endsWith('gstatic.com')
  );
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin || aLaisserPasser(url)) return;

  // Fichiers de build : leur nom porte un condensé, l'adresse vaut version.
  if (url.pathname.startsWith('/_next/static/')) {
    e.respondWith(
      match(req).then((hit) => hit ?? fetch(req).then((rep) => { void garder(req, rep); return rep; })),
    );
    return;
  }

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((rep) => { void garder(req, rep); return rep; })
        .catch(async () => {
          // La page demandée, telle quelle.
          const exact = await match(req);
          if (exact) return exact;
          // La racine ne peut pas rediriger sans réseau : on sert l'accueil.
          if (url.pathname === '/') {
            const accueil = await match(ACCUEIL);
            if (accueil) return accueil;
          }
          return (await match(REPLI)) ?? Response.error();
        }),
    );
    return;
  }

  // Charges du routeur (`?_rsc=…`) : réseau d'abord, dernière connue ensuite.
  // Sans elles, un lien cliqué hors ligne ne mène nulle part, même vers une page
  // qu'on a par ailleurs en cache.
  if (url.searchParams.has('_rsc') || req.headers.get('RSC') === '1') {
    e.respondWith(
      fetch(req)
        .then((rep) => { void garder(req, rep); return rep; })
        .catch(() => match(req).then((hit) => hit ?? Response.error())),
    );
    return;
  }

  // Le reste de nos fichiers (polices, images, échantillons de batterie) :
  // cache d'abord, ils ne changent qu'au déploiement.
  e.respondWith(
    match(req).then((hit) =>
      hit ?? fetch(req).then((rep) => { void garder(req, rep); return rep; }).catch(() => hit ?? Response.error()),
    ),
  );
});
