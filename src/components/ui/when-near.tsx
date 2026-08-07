'use client';

import { useState, useCallback, type ReactNode } from 'react';

/**
 * Ne monte son contenu qu'à l'approche de la fenêtre.
 *
 * Extrait de la page d'accueil, où il servait déjà à ne pas payer les colonnes de
 * pochettes qu'on ne verra peut-être jamais. Recopié nulle part : c'est le même
 * besoin partout, et une seconde version aurait divergé.
 *
 * Attention à ce qu'on lui confie : ce qui est enveloppé **n'est pas dans le HTML
 * servi**. Réservé donc à ce qui coûte à l'affichage et non à ce qui doit être lu
 * par un moteur de recherche.
 */
export function WhenNear({ children, marge = '300px' }: { children: ReactNode; marge?: string }) {
  const [proche, setProche] = useState(false);

  const observer = useCallback((el: HTMLDivElement | null) => {
    if (!el || proche) return;
    // Sans IntersectionObserver (navigateur ancien), on charge tout de suite plutôt
    // que de ne jamais rien afficher.
    if (typeof IntersectionObserver === 'undefined') { setProche(true); return; }
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setProche(true); },
      { rootMargin: marge },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [proche, marge]);

  return <div ref={observer}>{proche ? children : null}</div>;
}
