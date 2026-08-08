import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Les clés appelées par les pages existent-elles là où les pages les cherchent ?
 *
 * Ce test naît d'un défaut réel, parti en production : deux clés de la page
 * d'accord avaient été écrites dans `Seo.pages.chord` alors que le corps de la
 * page lit `Editorial.chordPage`. Les deux langues étaient pourtant complètes et
 * cohérentes entre elles — un test de parité fr/en n'aurait rien vu. Ce qui
 * manquait, c'est le lien entre **l'espace de noms déclaré** et **les clés
 * appelées**, et à l'écran cela donnait le nom de la clé en toutes lettres :
 *
 *     Editorial.chordPage.neighboursHeading
 *
 * next-intl ne lève pas d'erreur de compilation là-dessus : une clé absente est
 * une affaire d'exécution, et seule une visite de la page la révèle. D'où ce
 * contrôle statique.
 *
 * **Ce qu'il couvre, et ce qu'il ne couvre pas.** Il lit le code source, apparie
 * chaque `getTranslations`/`useTranslations` à son espace de noms, et vérifie que
 * les `t('…')` du fichier tombent sur une clé existante, dans les deux langues.
 * Il ignore les appels dont la clé est calculée (`t(variable)`) : on ne peut pas
 * les résoudre sans exécuter. C'est la limite assumée.
 */

const RACINE = join(import.meta.dirname, '..');
const LANGUES = ['fr', 'en'] as const;

/* ── Les messages, toutes sources confondues ─────────────────────────────── */

/**
 * Les messages sont éclatés en plusieurs fichiers par langue (`messages/fr.json`
 * et `messages/editorial/fr.json`), fusionnés au chargement. Le test doit voir la
 * même chose que l'application, donc fusionner pareil.
 */
function chargerMessages(langue: string): Record<string, unknown> {
  const fichiers = [join(RACINE, `messages/${langue}.json`), join(RACINE, `messages/editorial/${langue}.json`)];
  const fusion: Record<string, unknown> = {};
  for (const f of fichiers) {
    try {
      Object.assign(fusion, JSON.parse(readFileSync(f, 'utf8')));
    } catch {
      /* fichier absent : la source n'existe pas dans cette langue, le reste suffit */
    }
  }
  return fusion;
}

const MESSAGES = Object.fromEntries(LANGUES.map((l) => [l, chargerMessages(l)]));

function resoudre(messages: Record<string, unknown>, chemin: string): unknown {
  return chemin.split('.').reduce<unknown>(
    (n, part) => (n && typeof n === 'object' ? (n as Record<string, unknown>)[part] : undefined),
    messages,
  );
}

/* ── Ce que le code appelle ──────────────────────────────────────────────── */

function fichiersSource(dossier: string, trouves: string[] = []): string[] {
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) fichiersSource(chemin, trouves);
    else if (/\.tsx?$/.test(entree)) trouves.push(chemin);
  }
  return trouves;
}

interface Appel {
  fichier: string;
  espace: string;
  cle: string;
}

/**
 * Les appels de traduction d'un fichier, rattachés à leur espace de noms.
 *
 * L'appariement se fait par nom de variable — `const t = useTranslations('X')`
 * puis `t('cle')` donne `X.cle` — mais **par position**, pas par table à plat.
 *
 * C'est le point délicat. Un même fichier réutilise couramment le nom `t` dans
 * deux fonctions différentes : la page d'accueil déclare `Landing.nav` dans sa
 * barre de navigation puis `Landing` dans son corps, et la page d'accord déclare
 * `Seo.pages.chord` dans ses métadonnées puis `Editorial.chordPage` dans son
 * rendu. Une table `variable → espace` garde la dernière déclaration et attribue
 * donc les appels du haut du fichier au mauvais espace : sur ce dépôt, cela
 * produisait 146 fausses alertes, et surtout cela aurait rendu ce test aveugle au
 * défaut qu'il existe pour attraper — `neighboursHeading` aurait été trouvé sous
 * `Seo.pages.chord` et déclaré conforme.
 *
 * On rattache donc chaque appel à la déclaration **la plus proche avant lui**, ce
 * qui suit les portées réelles tant qu'un traducteur est déclaré avant son usage,
 * ce qu'impose `const`.
 */
function appelsDe(fichier: string): Appel[] {
  const source = readFileSync(fichier, 'utf8');

  // Plusieurs pages éditoriales rangent leur espace de noms dans une constante
  // (`const NS = 'Editorial.audioToChords'`) parce qu'elles s'en servent deux
  // fois. Sans les résoudre, ces déclarations passent inaperçues et leurs appels
  // se rattachent à la déclaration précédente, celle des métadonnées.
  const constantes = new Map<string, string>();
  for (const m of source.matchAll(/(?:const|let)\s+(\w+)\s*=\s*['"]([\w.]+)['"]\s*;/g)) {
    constantes.set(m[1], m[2]);
  }

  const declaration = /(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?(?:getTranslations|useTranslations)\(\s*(?:\{[^}]*namespace:\s*)?(?:['"]([^'"]+)['"]|(\w+))/g;
  const declarations = [...source.matchAll(declaration)]
    .map((m) => ({
      position: m.index,
      variable: m[1],
      espace: m[2] ?? constantes.get(m[3]) ?? '',
    }))
    // Un espace de noms calculé autrement qu'en constante littérale ne se résout
    // pas sans exécuter : on l'ignore plutôt que de deviner.
    .filter((d) => d.espace !== '');
  if (declarations.length === 0) return [];

  const appels: Appel[] = [];
  for (const variable of new Set(declarations.map((d) => d.variable))) {
    // `t('cle')` et `t.rich('cle')`, mais pas `t.has('cle')` — dont le rôle est
    // précisément de tester une absence.
    const usage = new RegExp(`\\b${variable}(?:\\.rich)?\\(\\s*['"]([\\w.]+)['"]`, 'g');
    for (const m of source.matchAll(usage)) {
      const portee = declarations
        .filter((d) => d.variable === variable && d.position < m.index)
        .at(-1);
      if (portee) appels.push({ fichier, espace: portee.espace, cle: m[1] });
    }
  }
  return appels;
}

const APPELS = fichiersSource(join(RACINE, 'src')).flatMap(appelsDe);

/* ── Les contrôles ───────────────────────────────────────────────────────── */

/** Sans appels relevés, le test ne prouverait rien : c'est l'extraction qu'on garde ici. */
test('des appels de traduction sont bien relevés dans le code', () => {
  assert.ok(APPELS.length > 50, `seulement ${APPELS.length} appels relevés — l'extraction a cassé`);
});

/**
 * Le défaut de production, exactement : une clé appelée qui n'existe pas dans
 * l'espace de noms déclaré. Remettre `neighboursHeading` dans `Seo.pages.chord`
 * doit faire échouer ce test.
 */
test('chaque clé appelée existe dans son espace de noms, dans les deux langues', () => {
  const manquantes: string[] = [];
  for (const { fichier, espace, cle } of APPELS) {
    for (const langue of LANGUES) {
      const valeur = resoudre(MESSAGES[langue], `${espace}.${cle}`);
      if (typeof valeur !== 'string') {
        manquantes.push(`${langue} · ${espace}.${cle} — ${fichier.replace(`${RACINE}/`, '')}`);
      }
    }
  }
  assert.deepEqual(manquantes, [], `${manquantes.length} clé(s) absente(s) :\n  ${manquantes.join('\n  ')}`);
});

/**
 * Une clé traduite en français mais pas en anglais donne une page anglaise avec du
 * français dedans, sans erreur visible. Le contrôle porte sur l'ensemble des
 * messages, pas seulement sur les clés appelées.
 */
test('les deux langues portent exactement les mêmes clés', () => {
  const aplatir = (o: unknown, prefixe = '', sortie: string[] = []): string[] => {
    if (o && typeof o === 'object') {
      for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
        const chemin = prefixe ? `${prefixe}.${k}` : k;
        if (typeof v === 'string') sortie.push(chemin);
        else aplatir(v, chemin, sortie);
      }
    }
    return sortie;
  };

  const fr = new Set(aplatir(MESSAGES.fr));
  const en = new Set(aplatir(MESSAGES.en));
  assert.deepEqual([...fr].filter((k) => !en.has(k)), [], 'clés présentes en français seulement');
  assert.deepEqual([...en].filter((k) => !fr.has(k)), [], 'clés présentes en anglais seulement');
});
