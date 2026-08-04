import { DM_Sans } from 'next/font/google';
import '../globals.css';

/**
 * Layout racine dédié à la page de repli hors ligne.
 *
 * Volontairement hors de `app/[locale]` : c'est le service worker qui met cette
 * page en cache, pas un visiteur, et il lui faut donc une adresse stable, sans
 * préfixe de langue à négocier. Elle est aussi la seule page susceptible de
 * s'afficher alors que rien d'autre n'a pu être chargé : on la garde autonome,
 * sans fournisseur de contexte ni appel réseau.
 */

const dmSans = DM_Sans({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-dm-sans',
  weight: ['300', '400', '500'],
});

export default function OfflineLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className={`${dmSans.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
