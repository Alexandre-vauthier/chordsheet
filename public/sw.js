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
 *   navigateur ne peut pas la suivre. C'est pourtant le raccourci que les gens
 *   gardent sur leur écran : on sert donc l'accueil, dans la langue annoncée par
 *   le navigateur ;
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

const VERSION = 'alviena-v3';
const REPLI = '/offline';
const LANGUES = ['fr', 'en'];
const LANGUE_PAR_DEFAUT = 'fr';

/**
 * Pages mises en cache à l'installation, dans les deux langues.
 *
 * Volontairement peu nombreuses : ce sont les portes d'entrée, celles depuis
 * lesquelles on rejoint le reste. Une liste plus longue allongerait
 * l'installation et échouerait entièrement à la première adresse fautive.
 *
 * Les deux langues et non celle du visiteur : le service worker ne peut pas lire
 * les cookies, donc il ne connaît pas la langue choisie. Dix pages légères
 * coûtent moins qu'une devinette qui laisserait la moitié des gens sans coque.
 */
const PAGES = [
  REPLI,
  ...LANGUES.flatMap((l) => [`/${l}`, `/${l}/book`, `/${l}/sets`, `/${l}/dashboard`]),
];

/**
 * Langue à servir quand la racine est demandée sans réseau.
 *
 * On ne peut pas relire le cookie de préférence depuis un service worker, mais
 * l'en-tête de langue du navigateur accompagne la requête et suffit à ne pas
 * envoyer un anglophone sur l'accueil français.
 */
function accueilPour(req) {
  const entete = (req.headers.get('accept-language') || '').toLowerCase();
  const langue = LANGUES.find((l) => entete.startsWith(l)) || LANGUE_PAR_DEFAUT;
  return `/${langue}`;
}

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
          // La racine ne peut pas rediriger sans réseau : on sert l'accueil, dans
          // la langue du navigateur si on l'a, dans l'autre sinon.
          if (url.pathname === '/') {
            const prefere = await match(accueilPour(req));
            if (prefere) return prefere;
            for (const l of LANGUES) {
              const repli = await match(`/${l}`);
              if (repli) return repli;
            }
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
