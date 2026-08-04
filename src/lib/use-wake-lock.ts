'use client';

import { useEffect, useRef } from 'react';

/**
 * Empêcher l'écran de s'éteindre pendant qu'on joue.
 *
 * Une tablette posée sur un pied s'endort au bout d'une minute, en plein morceau.
 * C'est le geste qui coupe un concert, et il n'y a rien à régler côté système :
 * le navigateur sait le demander.
 *
 * Deux points font que ça ne marche pas si on l'écrit naïvement :
 *
 * - **le verrou est perdu dès que la page passe en arrière-plan**, et il ne
 *   revient pas tout seul. Sans reprise au retour, il suffit de basculer une fois
 *   sur l'accordeur ou de répondre à un message pour perdre le verrou jusqu'à la
 *   fin du morceau. On le reprend donc à chaque retour à l'écran ;
 * - **la demande échoue si la page n'est pas visible**, et rejette. On ne demande
 *   donc rien tant qu'elle est cachée, et on n'ébruite pas l'échec : un écran qui
 *   s'éteint n'est pas une panne à signaler.
 *
 * Cette perte volontaire en arrière-plan est aussi ce qui rend le verrou sûr à
 * laisser actif sur une simple consultation : un onglet oublié ne retient pas
 * l'écran, puisqu'il n'est plus visible.
 *
 * Support : Chrome, Edge, Safari 16.4+, Android. Firefox ne l'implémente pas et
 * l'appel est simplement ignoré.
 */

type Sentinelle = { released: boolean; release: () => Promise<void> };

export function useWakeLock(actif: boolean): void {
  const sentinelleRef = useRef<Sentinelle | null>(null);

  useEffect(() => {
    const api = (navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<Sentinelle> };
    }).wakeLock;
    if (!api || !actif) return;

    let annule = false;

    const demander = async () => {
      if (annule || document.visibilityState !== 'visible') return;
      if (sentinelleRef.current && !sentinelleRef.current.released) return;
      try {
        sentinelleRef.current = await api.request('screen');
      } catch {
        // Refus du système, page cachée entre-temps, batterie faible : sans effet.
      }
    };

    const auRetour = () => { if (document.visibilityState === 'visible') void demander(); };

    void demander();
    document.addEventListener('visibilitychange', auRetour);

    return () => {
      annule = true;
      document.removeEventListener('visibilitychange', auRetour);
      const s = sentinelleRef.current;
      sentinelleRef.current = null;
      if (s && !s.released) void s.release().catch(() => {});
    };
  }, [actif]);
}
