/**
 * La navigation, déclarée une seule fois.
 *
 * La barre entretenait **deux arborescences parallèles**, une pour le grand écran
 * et une pour le panneau mobile, chacune écrite à la main. Elles avaient divergé :
 * `/chords` était explicitement filtré du mobile, `/sets` n'existait que dans le
 * menu de bureau, « À valider » nulle part ailleurs que sur grand écran. Rien
 * n'empêchait la divergence de s'aggraver — au contraire, chaque ajout se faisait
 * d'un seul côté.
 *
 * Ici, les deux rendus reçoivent des listes **déjà filtrées** : ils n'ont plus de
 * raison de connaître un chemin, et le `filter(l => l.href !== '/chords')` d'hier
 * n'a plus de forme possible.
 *
 * Aucun import de React, volontairement : les icônes sont désignées par un nom, ce
 * qui rend ce fichier lisible par `npm test`, qui n'a ni jsdom ni bibliothèque de
 * rendu. C'est ce qui permet de figer l'invariant par un test plutôt que par une
 * convention.
 */

export type NavIconName =
  | 'book' | 'explore' | 'bands'
  | 'chordLibrary' | 'chordByNotes' | 'chordDetect' | 'tuner' | 'whatToPlay' | 'grooveBox'
  | 'profile' | 'sets' | 'live' | 'pricing' | 'settings' | 'admin' | 'signOut';

/** Qui voit l'entrée. Une entrée ne se filtre jamais ailleurs qu'ici. */
export type NavVisibility = 'always' | 'signedIn' | 'signedOut' | 'admin' | 'notPro';

export interface NavEntry {
  /** Identité stable : clé de rendu, clé de test. Jamais affichée. */
  id: string;
  /** Où l'on va. Peut porter une chaîne de requête (`/chords?finder=1`). */
  href: string;
  /**
   * Le ou les chemins qui allument l'entrée.
   *
   * Séparé de `href` pour deux raisons : `usePathname()` ne rend pas la chaîne de
   * requête, et un `href` réécrit en `/login?next=…` ne doit pas éteindre l'entrée.
   * Absent, c'est `href` amputé de sa requête.
   */
  matchPaths?: string[];
  /** Clé du namespace `Navbar`. Jamais de texte en dur. */
  labelKey: string;
  icon?: NavIconName;
  visibility: NavVisibility;
  /** Sans compte, l'entrée passe par la connexion au lieu de disparaître. */
  authWall?: boolean;
}

export interface NavSection {
  id: string;
  /** Absent : section sans titre, le premier bloc d'un menu. */
  labelKey?: string;
  entries: NavEntry[];
}

export interface NavGroup {
  id: string;
  labelKey: string;
  visibility: NavVisibility;
  sections: NavSection[];
}

export interface NavContext {
  signedIn: boolean;
  isAdmin: boolean;
  isPro: boolean;
  /** Nécessaire au seul lien qui dépend de la personne : sa page publique. */
  userId?: string;
}

function visible(v: NavVisibility, ctx: NavContext): boolean {
  switch (v) {
    case 'always': return true;
    case 'signedIn': return ctx.signedIn;
    case 'signedOut': return !ctx.signedIn;
    case 'admin': return ctx.isAdmin;
    case 'notPro': return ctx.signedIn && !ctx.isPro;
  }
}

/**
 * L'adresse réelle d'une entrée pour ce visiteur.
 *
 * Sans compte, une entrée à mur d'authentification mène à la connexion **en
 * retenant sa destination** : demander de s'identifier puis déposer ailleurs est
 * doublement décourageant.
 */
export function resolveHref(entry: NavEntry, ctx: NavContext): string {
  // Le seul lien dont l'adresse dépend de la personne. Le déclarer `/user` puis le
  // compléter ici évite de faire dépendre toute la structure d'un identifiant.
  if (entry.id === 'publicProfile') return ctx.userId ? `/user/${ctx.userId}` : '/user';
  if (entry.authWall && !ctx.signedIn) {
    return `/login?next=${encodeURIComponent(entry.href)}`;
  }
  return entry.href;
}

/** L'entrée correspond-elle au chemin courant ? */
export function isActive(entry: NavEntry, pathname: string): boolean {
  const cibles = entry.matchPaths ?? [entry.href.split('?')[0]];
  return cibles.some((c) => pathname === c || pathname.startsWith(`${c}/`));
}

/**
 * La barre primaire.
 *
 * Trois destinations et un menu. « Mon book » et « Explorer » sont les seules
 * qu'on ouvre à chaque session, l'une pour retrouver, l'autre pour trouver : ce
 * sont elles qui méritent un pictogramme, parce qu'elles seules seront vues assez
 * souvent pour qu'on cesse d'en lire le mot.
 *
 * Les accords et l'accordeur en sortent. Ce sont des outils qu'on ouvre *pendant*
 * qu'on fait autre chose ; leur donner le même rang que « Mon book » revenait à
 * dire qu'on vient sur le site pour accorder sa guitare.
 *
 * Sans compte, on ne montre que ce qui s'ouvre vraiment. La barre affichait « Mon
 * book » et « Groupes », qui menaient à un formulaire de connexion : une entrée
 * qui ne tient pas sa promesse coûte plus qu'une entrée absente.
 */
export function buildPrimaryNav(ctx: NavContext): (NavEntry | NavGroup)[] {
  const entrees: NavEntry[] = [
    { id: 'book', href: '/dashboard', labelKey: 'book', icon: 'book', visibility: 'signedIn' },
    { id: 'explore', href: '/explore', labelKey: 'explore', icon: 'explore', visibility: 'always' },
    { id: 'groups', href: '/groups', labelKey: 'bands', icon: 'bands', visibility: 'signedIn' },
  ];

  const sortie: (NavEntry | NavGroup)[] = entrees.filter((e) => visible(e.visibility, ctx));
  sortie.push(buildToolsGroup(ctx));

  if (!ctx.signedIn) {
    sortie.push({ id: 'pricing', href: '/pricing', labelKey: 'pricing', visibility: 'signedOut' });
  }
  return sortie;
}

/**
 * Le menu « Outils ».
 *
 * Le mot n'est pas inventé pour l'occasion : c'est déjà le titre d'une colonne du
 * pied de page, qui coiffe exactement ces liens. Qui apprend l'un apprend l'autre.
 *
 * N'y entrent pas les huit guides du pied de page : ce sont des pages éditoriales
 * sans composant interactif, dont le public arrive par un moteur de recherche et
 * non par un menu ouvert depuis l'application. Ni « Créer une grille », qui a déjà
 * son bouton en accent dans la barre — une action présente deux fois apprend qu'il
 * y a deux façons de faire.
 */
export function buildToolsGroup(ctx: NavContext): NavGroup {
  const sections: NavSection[] = [
    {
      id: 'chords',
      labelKey: 'chords',
      entries: [
        { id: 'chordLibrary', href: '/chords', labelKey: 'chordLibrary', icon: 'chordLibrary', visibility: 'always' },
        { id: 'chordByNotes', href: '/chord-finder', labelKey: 'chordByNotes', icon: 'chordByNotes', visibility: 'always' },
        { id: 'chordDetect', href: '/chord-detect', labelKey: 'chordDetect', icon: 'chordDetect', visibility: 'always' },
      ],
    },
    {
      id: 'play',
      labelKey: 'toolsPlay',
      entries: [
        { id: 'tuner', href: '/tuner', labelKey: 'tuner', icon: 'tuner', visibility: 'always' },
        { id: 'whatToPlay', href: '/what-to-play', labelKey: 'whatToPlay', icon: 'whatToPlay', visibility: 'always' },
      ],
    },
    {
      // La boîte à rythme est un banc d'essai : page non indexée, absente du pied
      // de page et du sitemap. La montrer à tous promettrait une fonctionnalité.
      id: 'internal',
      labelKey: 'toolsInternal',
      entries: [
        { id: 'grooveBox', href: '/groove-box', labelKey: 'grooveBox', icon: 'grooveBox', visibility: 'admin' },
      ],
    },
  ];

  return {
    id: 'tools',
    labelKey: 'tools',
    visibility: 'always',
    sections: sections
      .map((s) => ({ ...s, entries: s.entries.filter((e) => visible(e.visibility, ctx)) }))
      .filter((s) => s.entries.length > 0),
  };
}

/**
 * Le menu « moi ».
 *
 * Les deux pastilles d'administration y descendent : cent cinquante-neuf pixels
 * dans la zone la plus disputée de la barre, pour une poignée de personnes. « Mon
 * book » en sort, puisqu'il est désormais primaire — le répéter diluerait le menu.
 */
export function buildAccountNav(ctx: NavContext): NavSection[] {
  const sections: NavSection[] = [
    {
      id: 'mine',
      entries: [
        { id: 'publicProfile', href: '/user', labelKey: 'publicProfile', icon: 'profile', visibility: 'signedIn' },
        { id: 'sets', href: '/sets', labelKey: 'mySets', icon: 'sets', visibility: 'signedIn' },
        { id: 'live', href: '/session', labelKey: 'liveSession', icon: 'live', visibility: 'signedIn' },
      ],
    },
    {
      id: 'account',
      entries: [
        { id: 'pricing', href: '/pricing', labelKey: 'goPro', icon: 'pricing', visibility: 'notPro' },
        { id: 'settings', href: '/profile', labelKey: 'settings', icon: 'settings', visibility: 'signedIn' },
      ],
    },
    {
      id: 'admin',
      entries: [
        { id: 'pending', href: '/pending', labelKey: 'pendingValidation', icon: 'admin', visibility: 'admin' },
        { id: 'admin', href: '/admin', labelKey: 'administration', icon: 'admin', visibility: 'admin' },
      ],
    },
  ];

  return sections
    .map((s) => ({ ...s, entries: s.entries.filter((e) => visible(e.visibility, ctx)) }))
    .filter((s) => s.entries.length > 0);
}

/** Toutes les adresses d'un arbre, pour vérifier que les deux rendus voient la même chose. */
export function collectHrefs(nodes: (NavEntry | NavGroup)[] | NavSection[]): string[] {
  const out: string[] = [];
  for (const n of nodes as (NavEntry | NavGroup | NavSection)[]) {
    if ('href' in n) out.push(n.href);
    else if ('sections' in n) out.push(...collectHrefs(n.sections));
    else out.push(...n.entries.map((e) => e.href));
  }
  return out;
}
