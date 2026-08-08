'use client';

import { ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth-context';
import { LibraryChordsProvider } from '@/lib/library-chords-context';
import { LiveSessionProvider } from '@/lib/live-session-context';

/**
 * Les contextes disponibles partout, page d'accueil comprise.
 *
 * `LiveSessionProvider` était monté un cran plus bas, dans `(main)/layout.tsx`, et
 * l'accueil vit **hors de `(main)`**. Or `AccountMenu` et `MobileNavPanel`
 * appellent `useLiveSession()`, qui **lève une erreur** hors de son fournisseur :
 * poser la barre de navigation globale sur l'accueil faisait planter l'ouverture
 * du menu mobile. C'est ce qui condamnait l'accueil à sa propre barre.
 *
 * Le remonter ici ne coûte rien : sans code de session en mémoire locale, le
 * fournisseur ne souscrit à rien — chacun de ses effets commence par
 * `if (!sessionCode) return`. Et cela répare un manque au passage : quelqu'un qui
 * participe à une session live et revient sur l'accueil y voit enfin le bandeau.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <LibraryChordsProvider>
        <LiveSessionProvider>
          {children}
        </LiveSessionProvider>
      </LibraryChordsProvider>
    </AuthProvider>
  );
}
