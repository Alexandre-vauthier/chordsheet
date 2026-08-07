'use client';

import { useArtwork } from '@/lib/use-artwork';
import { Link } from '@/i18n/navigation';

/**
 * Un mur de pochettes en mouvement lent.
 *
 * Extrait de la page d'accueil, où il ouvrait déjà le site, et partagé plutôt que
 * recopié : deux versions du même mur auraient divergé au premier ajustement.
 *
 * C'est ce qui donne sa couleur à la page. Le site est en fond sombre et sa
 * palette tient en un accent : les pochettes sont la seule couleur du catalogue,
 * et un mur en montre cent d'un coup là où une grille de vignettes en montre dix.
 *
 * Les colonnes défilent à des vitesses différentes et volontairement sans rapport
 * simple entre elles : à durées égales, l'œil verrait une seule image glisser.
 */

export interface CouvertureMini {
  id: string;
  title: string;
  artist: string;
}

/**
 * Une pochette du mur.
 *
 * Deux emplois, une seule écriture. Sur l'accueil elle porte son titre et son
 * artiste, et c'est du contenu qu'on lit ; en fond du hero de la découverte elle
 * n'est que décor, donc sans libellé, hors du parcours de tabulation et masquée
 * aux lecteurs d'écran — la même liste de morceaux est juste en dessous, elle,
 * accessible.
 */
export function CouvertureDefilante({
  sheet,
  libelle = false,
  href,
}: {
  sheet: CouvertureMini;
  libelle?: boolean;
  href?: string;
}) {
  const { artworkUrl } = useArtwork(sheet.artist || undefined, sheet.title || undefined);
  const decor = !libelle;

  return (
    <Link
      href={href ?? `/sheet/${sheet.id}`}
      tabIndex={decor ? -1 : undefined}
      aria-hidden={decor || undefined}
      className="relative block aspect-square rounded-2xl overflow-hidden mb-3 shrink-0"
    >
      {artworkUrl ? (
        <img src={artworkUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-white/[0.04] flex items-center justify-center">
          <span className="text-white/10 text-5xl font-serif select-none">♪</span>
        </div>
      )}
      {libelle && (
        <>
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 px-2.5 pt-2 pb-2.5 overflow-hidden rounded-b-2xl">
            {artworkUrl && (
              <>
                {/* Même URL que la pochette : le navigateur la sert de son cache,
                    cela ne coûte pas une requête de plus. */}
                <img src={artworkUrl} aria-hidden="true" className="absolute inset-0 w-full h-full object-cover scale-150 blur-[15px] opacity-90 pointer-events-none select-none" />
                <div className="absolute inset-0 bg-black/45 pointer-events-none" />
              </>
            )}
            <div className="relative z-10">
              <p className="text-white font-bold text-xs leading-tight line-clamp-2">{sheet.title || '—'}</p>
              {sheet.artist && <p className="text-white/65 text-[10px] truncate mt-0.5">{sheet.artist}</p>}
            </div>
          </div>
        </>
      )}
    </Link>
  );
}

/** Une colonne qui remonte sans fin : la liste est doublée pour boucler sans saut. */
export function ColonneDefilante({
  sheets,
  duree,
  decalage = 0,
  libelle = false,
  hrefDe,
}: {
  sheets: CouvertureMini[];
  duree: number;
  decalage?: number;
  libelle?: boolean;
  hrefDe?: (sheet: CouvertureMini) => string;
}) {
  const doublee = [...sheets, ...sheets];
  return (
    <div className="flex-1 overflow-hidden" style={{ paddingTop: `${decalage}px` }}>
      <div style={{ animation: `scrollUp ${duree}s linear infinite` }}>
        {doublee.map((s, i) => (
          <CouvertureDefilante key={`${s.id}-${i}`} sheet={s} libelle={libelle} href={hrefDe?.(s)} />
        ))}
      </div>
    </div>
  );
}

/**
 * Le mur complet.
 *
 * Décor et rien d'autre : les pochettes sont hors du parcours de tabulation et
 * masquées aux lecteurs d'écran, puisqu'elles ne portent aucun texte et que les
 * mêmes morceaux sont accessibles juste en dessous, dans les rayons.
 */
export function ArtworkWall({ sheets, colonnes = 4 }: { sheets: CouvertureMini[]; colonnes?: 3 | 4 }) {
  if (sheets.length === 0) return null;

  // Une colonne par tranche, pour que deux colonnes voisines ne montrent pas les
  // mêmes pochettes au même moment.
  const parColonne = Math.max(1, Math.ceil(sheets.length / colonnes));
  const durees = [60, 78, 95, 68];
  const decalages = [0, -70, -30, -100];

  return (
    <div className="absolute inset-0 flex gap-3 overflow-hidden pointer-events-none" aria-hidden="true">
      {Array.from({ length: colonnes }, (_, i) => (
        <ColonneDefilante
          key={i}
          sheets={sheets.slice(i * parColonne, (i + 1) * parColonne)}
          duree={durees[i % durees.length]}
          decalage={decalages[i % decalages.length]}
        />
      ))}
    </div>
  );
}
