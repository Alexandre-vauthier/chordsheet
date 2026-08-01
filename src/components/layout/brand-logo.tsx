import { SITE_NAME } from '@/lib/seo';

/**
 * Le logo : un symbole SVG, et le nom en texte.
 *
 * L'ancien logo vectorisait le mot « ChordSheet » en courbes, ce qui le rendait
 * impossible à relettrer sans repasser par un outil de dessin. Le nom est désormais
 * du texte, donc il suit `SITE_NAME` : renommer la marque ne demande plus de
 * retoucher un fichier graphique.
 *
 * Le symbole hérite de `currentColor` pour ses contours, il s'adapte donc au fond
 * sombre de la barre de navigation comme au fond clair des pages.
 */
export function BrandLogo({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const mark = size === 'lg' ? 'w-11 h-11' : size === 'sm' ? 'w-6 h-6' : 'w-8 h-8';
  const text = size === 'lg' ? 'text-4xl sm:text-5xl' : size === 'sm' ? 'text-lg' : 'text-2xl';

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg viewBox="0 0 46 46" className={`${mark} flex-shrink-0`} aria-hidden focusable="false">
        <rect x="0" y="0" width="20.9" height="20.9" rx="3.3" fill="#E85D2A" />
        <rect x="26.6" y="1.1" width="18.8" height="18.8" rx="2.6" fill="none" stroke="currentColor" strokeOpacity="0.32" strokeWidth="2.2" />
        <rect x="1.1" y="26.6" width="18.8" height="18.8" rx="2.6" fill="none" stroke="currentColor" strokeOpacity="0.32" strokeWidth="2.2" />
        <rect x="26.6" y="26.6" width="18.8" height="18.8" rx="2.6" fill="none" stroke="currentColor" strokeOpacity="0.32" strokeWidth="2.2" />
      </svg>
      <span className={`font-playfair font-bold tracking-tight leading-none ${text}`}>{SITE_NAME}</span>
    </span>
  );
}
