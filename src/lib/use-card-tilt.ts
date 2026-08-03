'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * Inclinaison 3D et reflet qui suivent le curseur.
 *
 * Extrait des cartes d'Explore pour servir ailleurs sans recopier la mécanique. Le
 * hook ne rend rien : il pose des variables CSS sur l'élément survolé, et les classes
 * `.sheet-card-*` / `.card-shine` / `.card-foil` de `globals.css` s'en servent. Tout
 * le rendu reste donc au CSS, ce qui évite de faire retraverser React à chaque
 * mouvement de souris.
 *
 * L'écriture est repoussée à la frame suivante : `mousemove` se déclenche bien plus
 * souvent que l'écran ne se rafraîchit, et poser cinq propriétés à chaque événement
 * ferait recalculer le style pour rien.
 *
 * Le retour est fait pour être **étalé** sur l'élément (`<div {...tilt}>`) : lire
 * `tilt.ref` pendant le rendu revient à toucher une référence là où c'est interdit.
 *
 * @param intensite Amplitude de l'inclinaison, en degrés. 18 sur une carte carrée,
 *   moins sur une tuile large, où le même angle donne un basculement excessif.
 * @param onLeave Complément joué quand le curseur s'en va, pour ce que le hook ne
 *   connaît pas (refermer un menu, par exemple).
 */
export function useCardTilt<T extends HTMLElement = HTMLDivElement>(
  intensite = 18,
  onLeave?: () => void,
) {
  const ref = useRef<T>(null);
  const rafRef = useRef<number | null>(null);

  // Le complément est gardé dans une référence : passé en fonction fléchée, il change
  // d'identité à chaque rendu et referait un gestionnaire à chaque fois.
  const onLeaveRef = useRef(onLeave);
  useEffect(() => { onLeaveRef.current = onLeave; }, [onLeave]);

  const onMouseMove = useCallback((e: React.MouseEvent<T>) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const { clientX, clientY } = e;
    rafRef.current = requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = clientX - r.left;
      const y = clientY - r.top;
      el.style.setProperty('--rx', `${((y / r.height) - 0.5) * -intensite}deg`);
      el.style.setProperty('--ry', `${((x / r.width) - 0.5) * intensite}deg`);
      el.style.setProperty('--sx', `${(x / r.width) * 100}%`);
      el.style.setProperty('--sy', `${(y / r.height) * 100}%`);
      el.style.setProperty('--active', '1');
    });
  }, [intensite]);

  const onMouseLeave = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const el = ref.current;
    if (el) {
      el.style.removeProperty('--rx');
      el.style.removeProperty('--ry');
      el.style.setProperty('--active', '0');
    }
    onLeaveRef.current?.();
  }, []);

  // Une frame en attente au démontage écrirait sur un élément détaché.
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  return { ref, onMouseMove, onMouseLeave };
}
