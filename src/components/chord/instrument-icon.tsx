import type { ReactNode } from 'react';
import type { InstrumentId } from '@/types';

/**
 * Les sept instruments, dessinés.
 *
 * Ils étaient représentés par des emoji, et deux paires étaient **identiques** :
 * le ukulélé et le banjo partageaient 🪕, la guitare et la basse 🎸 — deux entrées
 * du menu qu'on ne pouvait donc pas distinguer. La mandoline, elle, était un
 * violon. Ce n'était pas une négligence : Unicode n'a ni ukulélé, ni mandoline,
 * ni basse, et il n'existait pas de meilleur emoji à mettre.
 *
 * Ce que chaque dessin retient, et pourquoi c'est celui-là qui rend l'instrument
 * reconnaissable à vingt-quatre pixels :
 *
 * - **Guitare** : caisse en huit à la taille marquée, et sa rosace ronde.
 * - **Ukulélé** : la même famille de caisse, mais **trapue et à manche court** —
 *   chez lui la caisse domine le manche, chez la guitare c'est l'inverse. C'est
 *   la proportion qui les sépare, pas un détail qu'on ne verrait pas.
 * - **Mandoline** : une **goutte** sans taille, ses **ouïes en f** et son
 *   cordelier en éventail.
 * - **Banjo** : un **tambour** — un cercle, une peau claire tendue, et la
 *   **cheville de cinquième corde plantée à mi-manche**, qui n'existe sur aucun
 *   autre instrument.
 * - **Piano** : un clavier, et non un piano à queue. À cette taille, seul le
 *   motif des touches noires **par deux puis par trois** se lit.
 * - **Basse** : un corps **plein à deux cornes**, sans rosace. La silhouette
 *   suffit à la séparer de la guitare.
 * - **Voix** : un micro à main, grille sphérique sur corps cylindrique.
 *
 * Les formes portent l'information à elles seules : la couleur aide, elle ne
 * décide pas. Un daltonien distingue les sept, et la vérification en niveaux de
 * gris fait partie de la recette.
 *
 * Différence assumée avec `nav-icon.tsx`, dont c'est par ailleurs le patron : les
 * icônes du dépôt sont monochromes en `currentColor`, celles-ci sont remplies et
 * polychromes. Une guitare au trait ne se distingue pas d'un ukulélé au trait.
 */

/* ── Palette ──────────────────────────────────────────────────────────────
 * Des bois réels, et deux teintes franches là où le bois ne dit rien : le bleu
 * de la basse (les basses électriques sont peintes) et le gris du micro.
 * Nommées plutôt que répétées dans les tracés, pour qu'un ajustement se fasse
 * à un seul endroit. */
const EPICEA = '#E8BE84';        // table de guitare, épicéa verni
const KOA = '#D4783C';           // ukulélé, koa roux et chaud
const AMBRE = '#BE7434';         // mandoline, bois ambré plus foncé
const BOIS_SOMBRE = '#6B4526';   // manches, éclisses, fond de caisse
const PEAU = '#F5F0E4';          // peau de banjo, touches blanches
const METAL = '#B9C0C9';         // cercle du banjo, grille du micro, cordelier
const METAL_SOMBRE = '#4C525B';  // corps du micro, chevalets
const BLEU = '#35608F';          // corps de basse
const ERABLE = '#DFCBA2';        // manche de basse, érable clair
const NOIR = '#23262B';          // touches noires, ouïes, rosace

/** Un liseré sombre sous les surfaces claires, pour qu'elles tiennent aussi sur fond clair. */
const CONTOUR = 'rgba(0,0,0,0.28)';

const TRACES: Record<InstrumentId, ReactNode> = {
  /* Guitare acoustique — manche long, caisse en huit, rosace ronde. */
  guitar: (
    <>
      <rect x="10.7" y="1.2" width="2.6" height="12.4" rx="0.4" fill={BOIS_SOMBRE} />
      <rect x="9.6" y="0.5" width="4.8" height="2.6" rx="0.7" fill={BOIS_SOMBRE} />
      {/* Six cordes : la guitare est le seul des sept à en porter autant, et à
          cette taille c'est une texture plus qu'un décompte — mais elle diffère
          de celle du ukulélé, qui n'en a que quatre. */}
      {[11.2, 11.6, 12, 12.4, 12.8].map((x) => (
        <line key={x} x1={x} y1="2.6" x2={x} y2="13.4" stroke={PEAU} strokeWidth="0.22" opacity="0.75" />
      ))}
      <path
        d="M12 12.8c3.1 0 4.7 1.7 4.7 3.2 0 1.4-1.6 1.9-1.6 2.7 0 1 2.3 1.5 2.3 3 0 1.6-2.5 2.6-5.4 2.6s-5.4-1-5.4-2.6c0-1.5 2.3-2 2.3-3 0-.8-1.6-1.3-1.6-2.7 0-1.5 1.6-3.2 4.7-3.2Z"
        fill={EPICEA}
        stroke={CONTOUR}
        strokeWidth="0.5"
      />
      <circle cx="12" cy="17.4" r="1.4" fill={NOIR} />
      <rect x="9.8" y="20.6" width="4.4" height="1" rx="0.35" fill={BOIS_SOMBRE} />
    </>
  ),

  /* Ukulélé — même famille de caisse, mais trapue, et manche court. */
  ukulele: (
    <>
      <rect x="11.2" y="3.4" width="1.6" height="6.4" rx="0.3" fill={BOIS_SOMBRE} />
      <rect x="10.4" y="2.8" width="3.2" height="1.8" rx="0.6" fill={BOIS_SOMBRE} />
      {[11.6, 12, 12.4].map((x) => (
        <line key={x} x1={x} y1="4.4" x2={x} y2="9.6" stroke={PEAU} strokeWidth="0.22" opacity="0.75" />
      ))}
      {/* Caisse large et haute, taille à peine marquée : chez le ukulélé la caisse
          domine le manche, chez la guitare c'est l'inverse. C'est ce rapport-là
          qu'on lit d'un coup d'œil, et il tient même sans la couleur. */}
      <path
        d="M12 9c3.9 0 6.2 2.2 6.2 4.3 0 1.4-1.5 2-1.5 2.9 0 1.2 2.2 1.9 2.2 3.6 0 2-3 3.4-6.9 3.4s-6.9-1.4-6.9-3.4c0-1.7 2.2-2.4 2.2-3.6 0-.9-1.5-1.5-1.5-2.9C5.8 11.2 8.1 9 12 9Z"
        fill={KOA}
        stroke={CONTOUR}
        strokeWidth="0.5"
      />
      <circle cx="12" cy="15.4" r="1.5" fill={NOIR} />
      <rect x="9.6" y="19.6" width="4.8" height="1.1" rx="0.35" fill={BOIS_SOMBRE} />
    </>
  ),

  /* Mandoline — goutte sans taille, ouïes en f, cordelier en éventail. */
  mandolin: (
    <>
      <rect x="11" y="2.2" width="2" height="8.6" rx="0.4" fill={BOIS_SOMBRE} />
      <rect x="9.9" y="1.4" width="4.2" height="2.3" rx="0.7" fill={BOIS_SOMBRE} />
      <path
        d="M12 9.9c3.8 0 5.7 3 5.7 6.3 0 3.4-2.4 6.2-5.7 6.2s-5.7-2.8-5.7-6.2c0-3.3 1.9-6.3 5.7-6.3Z"
        fill={AMBRE}
        stroke={CONTOUR}
        strokeWidth="0.5"
      />
      {/* Les deux ouïes, réduites à leur galbe : à cette taille un « f » complet
          se remplit et devient une tache. */}
      <path d="M9.1 14.4c-.7.7-.7 3.3 0 4.1" stroke={NOIR} strokeWidth="0.9" strokeLinecap="round" fill="none" />
      <path d="M14.9 14.4c.7.7.7 3.3 0 4.1" stroke={NOIR} strokeWidth="0.9" strokeLinecap="round" fill="none" />
      <path d="M10.2 20.6h3.6l-.6 1.5h-2.4Z" fill={METAL} />
    </>
  ),

  /* Banjo — un tambour : cercle, peau claire, et la cheville de 5e corde. */
  banjo: (
    <>
      <rect x="11" y="1.4" width="2" height="11.4" rx="0.4" fill={BOIS_SOMBRE} />
      <rect x="9.9" y="0.8" width="4.2" height="2.3" rx="0.7" fill={BOIS_SOMBRE} />
      {/* La cheville plantée à mi-manche : rien d'autre n'en porte. */}
      <circle cx="14.2" cy="7.6" r="0.85" fill={METAL} stroke={CONTOUR} strokeWidth="0.35" />
      <circle cx="12" cy="16.8" r="5.5" fill={METAL} stroke={CONTOUR} strokeWidth="0.5" />
      <circle cx="12" cy="16.8" r="4.2" fill={PEAU} stroke={CONTOUR} strokeWidth="0.4" />
      <rect x="9.9" y="17.4" width="4.2" height="1" rx="0.35" fill={BOIS_SOMBRE} />
    </>
  ),

  /* Piano — le clavier, et le motif deux puis trois qui le fait lire. */
  piano: (
    <>
      <rect x="2.6" y="6.4" width="18.8" height="11.2" rx="1.1" fill={PEAU} stroke={CONTOUR} strokeWidth="0.5" />
      {[5.3, 8, 10.7, 13.4, 16.1, 18.8].map((x) => (
        <line key={x} x1={x} y1="6.4" x2={x} y2="17.6" stroke={CONTOUR} strokeWidth="0.4" />
      ))}
      {/* Deux touches noires, un blanc, puis trois : c'est ce groupement qu'on
          reconnaît, bien avant de compter les touches. */}
      {[5.3, 8, 13.4, 16.1, 18.8].map((x) => (
        <rect key={x} x={x - 0.85} y="6.4" width="1.7" height="6.4" rx="0.3" fill={NOIR} />
      ))}
    </>
  ),

  /* Basse électrique — corps plein à deux cornes, sans rosace. */
  bass: (
    <>
      <rect x="11.2" y="1.2" width="1.6" height="15" rx="0.3" fill={ERABLE} />
      {/* Mécaniques : sur une basse elles sont grosses et à l'oblique, deux par
          côté. C'est visible avant même qu'on lise la forme du corps. */}
      <rect x="9.5" y="0.6" width="5" height="2.6" rx="0.7" fill={BOIS_SOMBRE} />
      {[11.5, 11.9, 12.3, 12.7].map((x) => (
        <line key={x} x1={x} y1="2.8" x2={x} y2="16" stroke={METAL} strokeWidth="0.3" opacity="0.85" />
      ))}
      {/* Deux cornes et l'échancrure entre elles : c'est la signature d'un corps
          plein à double pan coupé, et cela ne ressemble à aucune caisse en huit. */}
      <path
        d="M12 17.4 9.5 11.3c-.9-.4-2.4-.1-3.3 1-1 1.2-1.4 2.8-1.4 4.4 0 3.6 3.1 6.5 7.2 6.5s7.2-2.9 7.2-6.5c0-1.6-.4-3.2-1.4-4.4-.9-1.1-2.4-1.4-3.3-1L12 17.4Z"
        fill={BLEU}
        stroke={CONTOUR}
        strokeWidth="0.5"
      />
      <rect x="8.8" y="18.4" width="6.4" height="1.5" rx="0.35" fill={METAL_SOMBRE} />
    </>
  ),

  /* Voix — un micro à main. */
  voice: (
    <>
      <circle cx="12" cy="7.6" r="4.1" fill={METAL} stroke={CONTOUR} strokeWidth="0.5" />
      <line x1="8.6" y1="6.4" x2="15.4" y2="6.4" stroke={METAL_SOMBRE} strokeWidth="0.5" />
      <line x1="8.3" y1="8.4" x2="15.7" y2="8.4" stroke={METAL_SOMBRE} strokeWidth="0.5" />
      <path d="M9.6 11.2h4.8l-1 10.1a1.5 1.5 0 0 1-2.8 0Z" fill={METAL_SOMBRE} stroke={CONTOUR} strokeWidth="0.4" />
    </>
  ),
};

/**
 * Le pictogramme d'un instrument.
 *
 * `aria-hidden` : le nom de l'instrument est toujours écrit à côté, ou porté par
 * le `aria-label` du bouton. Le répéter ferait entendre « Guitare guitare ».
 */
export function InstrumentIcon({
  id,
  className = 'w-6 h-6',
}: {
  id: InstrumentId;
  className?: string;
}) {
  return (
    <svg className={`${className} shrink-0`} viewBox="0 0 24 24" aria-hidden="true">
      {TRACES[id]}
    </svg>
  );
}

/** Exporté pour le test qui vérifie qu'aucun instrument n'est sans dessin. */
export const INSTRUMENT_TRACES = TRACES;
