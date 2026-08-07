import type { NavIconName } from './nav-items';

/**
 * Les pictogrammes de la navigation, désignés par leur nom.
 *
 * Ils vivent ici et non dans la déclaration des entrées : `nav-items.ts` doit
 * rester du TypeScript pur, sans JSX, pour être lisible par les tests.
 *
 * Aucune bibliothèque d'icônes n'est ajoutée. Le dépôt dessine ses SVG à la main
 * partout ; en introduire une pour la seule barre poserait deux jeux d'icônes côte
 * à côte dans le même menu, pour un poids embarqué sur toutes les pages.
 *
 * La plupart de ces tracés existaient déjà — dans le menu profil, sur la page
 * d'accueil, dans les menus de lecture. Deux seulement sont neufs : la boussole
 * d'« Explorer » (la loupe est prise par la recherche, la réemployer confondrait
 * les deux) et la grille de manche du chercheur par notes.
 */
const TRACES: Record<NavIconName, React.ReactNode> = {
  // Signet — repris du menu profil, où il désignait déjà « Mon book ».
  book: <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />,
  // Boussole : on part chercher sans savoir ce qu'on trouvera.
  explore: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5 5-2z" />
    </>
  ),
  // Deux silhouettes.
  bands: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0 1 12 0M16.5 5.5a3 3 0 0 1 0 5.8M17 20a6 6 0 0 0-2.2-4.6" />
    </>
  ),
  chordLibrary: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 3v18M8 8h8M8 13h8" />
    </>
  ),
  // Une grille de manche : on désigne des cases pour trouver l'accord.
  chordByNotes: (
    <>
      <path d="M5 4v16M12 4v16M19 4v16M5 9h14M5 15h14" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
  // Micro.
  chordDetect: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </>
  ),
  // Diapason.
  tuner: <path d="M8 3v7a4 4 0 0 0 8 0V3M12 14v7" />,
  // Note de musique — reprise des menus de lecture.
  whatToPlay: (
    <>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </>
  ),
  // Grosse caisse — reprise des menus de lecture.
  grooveBox: (
    <>
      <ellipse cx="12" cy="8" rx="7" ry="2.5" />
      <path d="M5 8v7M19 8v7M5 15a7 2.5 0 0 0 14 0" />
    </>
  ),
  profile: <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />,
  sets: <path d="M4 6h16M4 12h16M4 18h10" />,
  // La session live n'a pas de tracé : c'est un point, coloré et animé quand une
  // session tourne réellement.
  live: <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />,
  pricing: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M14.5 9.5a2.5 2.5 0 0 0-2.5-1.5c-1.4 0-2.5.7-2.5 2s1.1 1.7 2.5 2 2.5.7 2.5 2-1.1 2-2.5 2a2.5 2.5 0 0 1-2.5-1.5M12 6.5v11" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 008 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9c.14.36.4.66.73.86" />
    </>
  ),
  // Bouclier : ce qui relève de la modération.
  admin: <path d="M12 3l8 3v6c0 4.4-3.2 8.2-8 9-4.8-.8-8-4.6-8-9V6l8-3z" />,
  signOut: <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />,
};

export function NavIcon({ name, className = 'w-4 h-4' }: { name: NavIconName; className?: string }) {
  return (
    <svg
      className={`${className} shrink-0`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {TRACES[name]}
    </svg>
  );
}
