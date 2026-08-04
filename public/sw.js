/**
 * Service worker : faire que l'application s'ouvre sans réseau.
 *
 * Les données sont déjà gardées par Firestore (cache IndexedDB). Ce qui manquait,
 * c'est la coque : sans réseau, le navigateur n'obtient même pas le HTML et
 * affiche sa page d'erreur. Ici on garde de quoi démarrer, et Firestore fournit
 * les grilles.
 *
 * Trois règles, une par nature de requête :
 *
 * - **les fichiers de build** (`/_next/static/…`) portent un condensé dans leur
 *   nom : un contenu donné ne change jamais d'adresse. On les sert donc du cache
 *   sans rien demander au réseau, et on garde la version téléchargée ;
 * - **les navigations** passent par le réseau d'abord, cache ensuite. L'inverse
 *   servirait une version périmée de la page à chaque visite, ce qui se paie
 *   bien plus cher qu'une seconde d'attente ;
 * - **tout le reste** (Firestore, iTunes, échantillons audio, API) n'est pas
 *   touché. Firestore a son propre cache et gère la file d'attente hors ligne
 *   bien mieux qu'un cache HTTP ; intercepter ses requêtes ne ferait que casser
 *   ça.
 *
 * Le nom du cache porte une version. La changer suffit à repartir propre : le
 * `activate` supprime tout ce qui ne porte pas le nom courant.
 */

const VERSION = 'alviena-v1';
const COQUE = '/offline';

// À l'installation, on ne met en cache que la page de repli. Le reste se remplit
// à l'usage : lister les fichiers de build ici obligerait à régénérer ce fichier
// à chaque déploiement, et une liste fausse fait échouer toute l'installation.
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => c.add(COQUE)).catch(() => {}).then(() => self.skipWaiting()),
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

  // Fichiers de build : le nom vaut version, le cache fait foi.
  if (url.pathname.startsWith('/_next/static/')) {
    e.respondWith(
      caches.match(req).then((hit) =>
        hit ?? fetch(req).then((rep) => {
          if (rep.ok) { const copie = rep.clone(); caches.open(VERSION).then((c) => c.put(req, copie)); }
          return rep;
        }),
      ),
    );
    return;
  }

  // Navigation : réseau d'abord, dernière version connue ensuite, page de repli
  // en dernier recours.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((rep) => {
          if (rep.ok) { const copie = rep.clone(); caches.open(VERSION).then((c) => c.put(req, copie)); }
          return rep;
        })
        .catch(() => caches.match(req).then((hit) => hit ?? caches.match(COQUE))),
    );
    return;
  }

  // Le reste de nos fichiers (polices, images, échantillons de batterie) :
  // cache d'abord, il ne change qu'au déploiement.
  e.respondWith(
    caches.match(req).then((hit) =>
      hit ?? fetch(req).then((rep) => {
        if (rep.ok) { const copie = rep.clone(); caches.open(VERSION).then((c) => c.put(req, copie)); }
        return rep;
      }).catch(() => hit),
    ),
  );
});
