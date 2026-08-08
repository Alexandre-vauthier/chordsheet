import { ImageResponse } from 'next/og';
import { getAdminDb } from '@/lib/firebase-admin';
import { SITE_NAME } from '@/lib/seo';
import { sheetIdFromSegment } from '@/lib/sheet-url';

/**
 * Image de partage propre à chaque grille.
 *
 * Un lien partagé sur Discord, WhatsApp ou X n'affiche plus le même visuel générique
 * pour toutes les grilles mais le titre, l'artiste et les premiers accords. Ce n'est
 * pas un facteur de classement, mais c'est ce qui décide du clic — et les clics, eux,
 * comptent.
 *
 * Tourne sur le runtime Node : la lecture Firestore passe par l'Admin SDK, qui n'est
 * pas disponible sur l'edge.
 */
export const runtime = 'nodejs';
export const alt = 'Grille d’accords';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Reprend la palette de globals.css : l'image doit ressembler au site. */
const PAPER = '#fdfbf7';
const INK = '#1a1a1a';
const INK_LIGHT = '#666666';
const ACCENT = '#c84b2f';
const LINE = '#e0dcd4';
const CELL = '#f5f0e8';

interface OgSheet {
  title: string;
  artist: string;
  musicalKey: string;
  chords: string[];
}

async function loadSheet(id: string): Promise<OgSheet | null> {
  try {
    const snap = await getAdminDb().collection('sheets').doc(id).get();
    if (!snap.exists) return null;

    const data = snap.data() as Record<string, unknown> | undefined;
    if (!data || (!data.isPublic && !data.isUnlisted)) return null;

    // On ne parcourt la structure que pour en extraire les premiers accords
    // distincts : inutile de reconstruire une grille complète pour une image.
    const chords: string[] = [];
    const sections = Array.isArray(data.sections) ? data.sections : [];

    for (const section of sections as { rows?: unknown }[]) {
      const rows = Array.isArray(section?.rows) ? section.rows : [];
      for (const row of rows as { chord?: unknown }[][]) {
        for (const cell of Array.isArray(row) ? row : []) {
          const chord = typeof cell?.chord === 'string' ? cell.chord.trim() : '';
          if (chord && !chords.includes(chord)) chords.push(chord);
          if (chords.length >= 8) break;
        }
        if (chords.length >= 8) break;
      }
      if (chords.length >= 8) break;
    }

    return {
      title: typeof data.title === 'string' ? data.title : '',
      artist: typeof data.artist === 'string' ? data.artist : '',
      musicalKey: typeof data.key === 'string' ? data.key : '',
      chords,
    };
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id: segment } = await params;
  // Le segment porte désormais un slug devant l'identifiant : on lit l'identifiant
  // comme la page le fait, sinon l'image serait absente sur la nouvelle forme.
  const sheet = await loadSheet(sheetIdFromSegment(segment));

  // Grille privée ou lecture indisponible : on rend quand même une image, à la
  // marque. Un 404 sur l'image casserait l'aperçu du lien.
  const title = sheet?.title || SITE_NAME;
  const artist = sheet?.artist || '';
  const chords = sheet?.chords ?? [];

  // Le rendu descend la taille du titre au lieu de le tronquer : un titre long reste
  // lisible en entier, ce qui est tout l'intérêt de l'image.
  const titleSize = title.length > 44 ? 56 : title.length > 26 ? 72 : 88;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: PAPER,
          padding: 72,
          borderTop: `16px solid ${ACCENT}`,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: titleSize,
              fontWeight: 700,
              color: INK,
              lineHeight: 1.1,
              letterSpacing: -1,
            }}
          >
            {title}
          </div>
          {artist && (
            <div style={{ fontSize: 40, color: INK_LIGHT, marginTop: 20 }}>{artist}</div>
          )}
        </div>

        {chords.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            {chords.map((chord) => (
              <div
                key={chord}
                style={{
                  display: 'flex',
                  fontSize: 34,
                  fontWeight: 600,
                  color: INK,
                  background: CELL,
                  border: `2px solid ${LINE}`,
                  borderRadius: 14,
                  padding: '10px 24px',
                }}
              >
                {chord}
              </div>
            ))}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 28,
            color: INK_LIGHT,
            borderTop: `2px solid ${LINE}`,
            paddingTop: 24,
          }}
        >
          {/* Le nom en toutes lettres plutôt que le logo : `next/og` ne rend pas
              les tracés SVG complexes, et un nom lisible vaut mieux qu'un tracé
              approximatif. */}
          <div style={{ display: 'flex', color: ACCENT, fontWeight: 700 }}>{SITE_NAME}</div>
          {sheet?.musicalKey && <div style={{ display: 'flex' }}>Tonalité {sheet.musicalKey}</div>}
        </div>
      </div>
    ),
    size,
  );
}
