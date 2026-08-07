'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Le défilement horizontal d'un rayon.
 *
 * Composant client, mais qui **ne rend pas ses tuiles** : elles lui arrivent en
 * `children` depuis un composant serveur et le restent. C'est ce qui réconcilie
 * les deux exigences du rayon — être manipulable à la souris et au clavier, et
 * figurer en entier dans le HTML servi aux moteurs. Les rendre ici les aurait
 * fait basculer côté navigateur, et la page serait redevenue vide pour Google.
 *
 * Le clavier n'a rien à apprendre : les tuiles sont des liens, la tabulation les
 * traverse et le navigateur fait défiler jusqu'à celle qui reçoit le focus. Poser
 * un `tabIndex` sur le conteneur ajouterait un arrêt de plus sans rien apporter.
 */
export function ShelfScroller({ etiquette, children }: { etiquette: string; children: ReactNode }) {
  const piste = useRef<HTMLUListElement>(null);
  const [aGauche, setAGauche] = useState(false);
  const [aDroite, setADroite] = useState(false);

  const mesurer = useCallback(() => {
    const el = piste.current;
    if (!el) return;
    setAGauche(el.scrollLeft > 4);
    // Une tolérance de quatre pixels : les largeurs fractionnaires empêchent
    // `scrollLeft + clientWidth` d'atteindre exactement `scrollWidth`, et la
    // flèche de droite resterait allumée au bout de la course.
    setADroite(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = piste.current;
    if (!el) return;
    mesurer();
    el.addEventListener('scroll', mesurer, { passive: true });
    // La largeur disponible change sans qu'on défile : rotation de l'appareil,
    // ouverture d'un panneau. Sans observateur, les flèches mentiraient.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(mesurer) : null;
    ro?.observe(el);
    return () => { el.removeEventListener('scroll', mesurer); ro?.disconnect(); };
  }, [mesurer]);

  const glisser = (sens: -1 | 1) => {
    const el = piste.current;
    if (!el) return;
    el.scrollBy({ left: sens * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  const fleche = (sens: -1 | 1, visible: boolean) => (
    <button
      type="button"
      onClick={() => glisser(sens)}
      aria-label={etiquette}
      tabIndex={-1}
      aria-hidden="true"
      className={`hidden md:flex absolute top-1/2 -translate-y-1/2 z-10 h-10 w-10 items-center justify-center
        rounded-full bg-[var(--cell-bg)] border border-[var(--line)] shadow-lg
        text-[var(--ink)] transition-opacity cursor-pointer hover:bg-[var(--cell-hover)]
        ${sens === -1 ? 'left-0 -translate-x-1/2' : 'right-0 translate-x-1/2'}
        ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d={sens === -1 ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'} />
      </svg>
    </button>
  );

  return (
    <div className="relative">
      {fleche(-1, aGauche)}
      <ul
        ref={piste}
        className="flex gap-4 overflow-x-auto snap-x scroll-smooth overscroll-x-contain
          pb-2 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollPaddingInline: '0.25rem' }}
      >
        {children}
      </ul>
      {fleche(1, aDroite)}
    </div>
  );
}
