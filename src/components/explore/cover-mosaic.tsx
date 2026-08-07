'use client';

import { useArtwork } from '@/lib/use-artwork';
import type { CouvertureMini } from './artwork-wall';

/**
 * Quatre pochettes en fond d'une tuile thématique.
 *
 * C'est ce qui remplace l'aplat de couleur des services de musique : la charte
 * du site tient en un accent, et lui inventer une palette de genres reviendrait à
 * choisir vingt teintes qu'il faudrait ensuite défendre. Les pochettes disent la
 * même chose — voici à quoi ressemble cette tranche — sans rien ajouter à la
 * charte, et elles changent d'elles-mêmes quand le catalogue change.
 *
 * Purement décoratives : le libellé et le compte sont rendus par le serveur, dans
 * le HTML. Ce composant n'ajoute que des images.
 */
function Case({ sheet }: { sheet: CouvertureMini }) {
  const { artworkUrl } = useArtwork(sheet.artist || undefined, sheet.title || undefined);
  if (!artworkUrl) return <div className="bg-white/[0.04]" />;
  return <img src={artworkUrl} alt="" className="w-full h-full object-cover" />;
}

export function CoverMosaic({ sheets }: { sheets: CouvertureMini[] }) {
  if (sheets.length === 0) return null;
  return (
    <div className="absolute inset-0 grid grid-cols-2 grid-rows-2" aria-hidden="true">
      {sheets.slice(0, 4).map((s) => <Case key={s.id} sheet={s} />)}
    </div>
  );
}
