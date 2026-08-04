import type { Metadata } from 'next';
import { LiensHorsLigne } from './liens';

export const metadata: Metadata = { robots: { index: false, follow: false }, title: 'Hors ligne' };

/**
 * Ce qu'on voit quand le réseau manque et que la page demandée n'a jamais été
 * ouverte sur cet appareil.
 *
 * Elle dit ce qui reste accessible plutôt que de se contenter d'annoncer la
 * panne : les grilles déjà consultées sont dans le cache de l'appareil, et c'est
 * l'information utile quand on est en cave de répétition.
 */
export default function OfflinePage() {
  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: '2rem', background: 'var(--paper)' }}>
      <main style={{ maxWidth: '28rem', display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'center' }}>
        <LiensHorsLigne />
      </main>
    </div>
  );
}
