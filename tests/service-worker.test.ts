import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

/**
 * Le service worker, éprouvé hors du navigateur.
 *
 * Il a fallu six corrections successives pour rendre le hors ligne utilisable, et
 * l'une d'elles a annulé les trois précédentes sans que rien ne le montre : le
 * service worker servait les pages depuis son cache même quand on cherchait à les
 * rafraîchir, si bien que les corrections suivantes ne pouvaient plus prendre
 * effet. Chaque essai demandait un déploiement, un rechargement, une coupure
 * réseau, et une personne pour dire ce qu'elle voyait.
 *
 * Ces règles n'ont pourtant rien qui exige un navigateur : ce sont des décisions
 * sur des requêtes. On les rejoue donc ici avec un cache et un réseau feints, et
 * l'on vérifie ce qui est servi.
 */

// ─── Un cache et un réseau pour de faux ──────────────────────────────────────

interface RepFeinte { corps: string; ok: boolean; }

const ORIGINE = 'https://exemple.test';

function creerCaches() {
  const magasins = new Map<string, Map<string, RepFeinte>>();

  /**
   * Un vrai cache range par adresse absolue : `/fr` et `https://…/fr` y désignent
   * la même entrée. Sans cette normalisation, le faux cache ne trouvait jamais ce
   * que l'installation venait d'y mettre, et le test passait quoi qu'il arrive.
   */
  const cle = (r: unknown) =>
    new URL(typeof r === 'string' ? r : (r as { url: string }).url, ORIGINE).href;

  const ouvrir = (nom: string) => {
    if (!magasins.has(nom)) magasins.set(nom, new Map());
    const m = magasins.get(nom)!;
    return Promise.resolve({
      put: (req: unknown, rep: RepFeinte) => { m.set(cle(req), rep); return Promise.resolve(); },
      add: (url: string) => {
        m.set(cle(url), { corps: `html:${url}`, ok: true });
        return Promise.resolve();
      },
    });
  };

  return {
    magasins,
    api: {
      open: ouvrir,
      keys: () => Promise.resolve([...magasins.keys()]),
      delete: (nom: string) => Promise.resolve(magasins.delete(nom)),
      match: (req: unknown) => {
        for (const m of magasins.values()) {
          const hit = m.get(cle(req));
          if (hit) return Promise.resolve(hit);
        }
        return Promise.resolve(undefined);
      },
    },
  };
}

interface Contexte {
  ecouteurs: Map<string, (e: unknown) => void>;
  caches: ReturnType<typeof creerCaches>;
  /** Adresses réellement demandées au réseau. */
  reseau: string[];
  /** Bascule pour simuler la coupure. */
  enLigne: { valeur: boolean };
}

function chargerServiceWorker(): Contexte {
  const source = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  const ecouteurs = new Map<string, (e: unknown) => void>();
  const caches = creerCaches();
  const reseau: string[] = [];
  const enLigne = { valeur: true };

  const sandbox = {
    self: {
      addEventListener: (nom: string, fn: (e: unknown) => void) => ecouteurs.set(nom, fn),
      skipWaiting: () => Promise.resolve(),
      clients: { claim: () => Promise.resolve() },
      location: { origin: ORIGINE },
    },
    caches: caches.api,
    fetch: (req: unknown) => {
      const url = typeof req === 'string' ? req : (req as { url: string }).url;
      reseau.push(url);
      if (!enLigne.valeur) return Promise.reject(new Error('hors ligne'));
      return Promise.resolve({ corps: `reseau:${url}`, ok: true, clone: () => ({ corps: `reseau:${url}`, ok: true }) });
    },
    URL, Request, Response, Promise, console,
  };
  runInContext(source, createContext(sandbox));
  return { ecouteurs, caches, reseau, enLigne };
}

/** Joue un `fetch` et rend ce que le service worker a décidé de servir. */
async function demander(ctx: Contexte, url: string, options: { mode?: string; entetes?: Record<string, string> } = {}) {
  const capture: { rep: Promise<RepFeinte> | null } = { rep: null };
  const requete = {
    url,
    method: 'GET',
    mode: options.mode ?? 'cors',
    headers: { get: (n: string) => options.entetes?.[n] ?? null },
  };
  ctx.ecouteurs.get('fetch')!({ request: requete, respondWith: (p: Promise<RepFeinte>) => { capture.rep = p; } });
  return capture.rep ? await capture.rep : null;
}

async function installer(ctx: Contexte) {
  const capture: { promesse: Promise<unknown> | null } = { promesse: null };
  ctx.ecouteurs.get('install')!({ waitUntil: (p: Promise<unknown>) => { capture.promesse = p; } });
  await capture.promesse;
}

// ─── Ce qu'on attend de lui ──────────────────────────────────────────────────

test("l'installation met en cache les portes d'entrée, dans les deux langues", async () => {
  const ctx = chargerServiceWorker();
  await installer(ctx);
  const enCache = [...ctx.caches.magasins.values()].flatMap((m) => [...m.keys()]);
  for (const attendue of ['/offline', '/fr', '/fr/book', '/en', '/en/book']) {
    assert.ok(enCache.includes(`${ORIGINE}${attendue}`), `${attendue} devrait être en cache après installation`);
  }
});

test('une page est demandée au réseau même si une copie traîne en cache', async () => {
  const ctx = chargerServiceWorker();
  await installer(ctx);
  ctx.reseau.length = 0;

  // C'est la règle qui manquait : le préchargement redemandait `/fr/sheet/abc` et
  // recevait la copie enregistrée au premier essai, sans jamais interroger le
  // serveur. La page ne se rafraîchissait donc jamais et continuait de désigner
  // les fichiers de code d'un déploiement périmé.
  await demander(ctx, 'https://exemple.test/fr', { mode: 'cors' });
  assert.deepEqual(ctx.reseau, ['https://exemple.test/fr'],
    'une page déjà en cache doit tout de même être redemandée au réseau');
});

test('un fichier de build ne se redemande pas : son nom vaut version', async () => {
  const ctx = chargerServiceWorker();
  const fichier = 'https://exemple.test/_next/static/chunks/abc.js?dpl=1';
  await demander(ctx, fichier);
  ctx.reseau.length = 0;
  const servi = await demander(ctx, fichier);
  assert.deepEqual(ctx.reseau, [], 'un fichier de build en cache ne doit pas repasser par le réseau');
  assert.equal(servi?.corps, `reseau:${fichier}`);
});

test('hors ligne, une page déjà vue est servie depuis le cache', async () => {
  const ctx = chargerServiceWorker();
  await installer(ctx);
  await demander(ctx, 'https://exemple.test/fr/sheet/abc', { mode: 'cors' });

  ctx.enLigne.valeur = false;
  const servi = await demander(ctx, 'https://exemple.test/fr/sheet/abc', { mode: 'navigate' });
  assert.equal(servi?.corps, 'reseau:https://exemple.test/fr/sheet/abc',
    'la page enregistrée doit être servie quand le réseau manque');
});

test('hors ligne, une page jamais vue donne la page de repli', async () => {
  const ctx = chargerServiceWorker();
  await installer(ctx);
  ctx.enLigne.valeur = false;
  const servi = await demander(ctx, 'https://exemple.test/fr/sheet/jamais-vue', { mode: 'navigate' });
  assert.equal(servi?.corps, 'html:/offline');
});

test("hors ligne, la racine sert l'accueil de la langue du navigateur", async () => {
  const ctx = chargerServiceWorker();
  await installer(ctx);
  ctx.enLigne.valeur = false;

  // La racine répond par une redirection, qui ne se met pas en cache : sans cette
  // règle, le raccourci que les gens gardent sur leur écran tombe sur le repli.
  const fr = await demander(ctx, 'https://exemple.test/', { mode: 'navigate', entetes: { 'accept-language': 'fr-FR,fr;q=0.9' } });
  assert.equal(fr?.corps, 'html:/fr');
  const en = await demander(ctx, 'https://exemple.test/', { mode: 'navigate', entetes: { 'accept-language': 'en-GB,en;q=0.9' } });
  assert.equal(en?.corps, 'html:/en');
});

test('Firestore et les routes API ne sont jamais interceptés', async () => {
  const ctx = chargerServiceWorker();
  for (const url of [
    'https://firestore.googleapis.com/v1/projects/x/documents',
    'https://exemple.test/api/export/set-pdf',
  ]) {
    assert.equal(await demander(ctx, url), null, `${url} doit passer sans interception`);
  }
});
