import type { Genre } from '@/types';

// Correspondance genre iTunes (primaryGenreName) -> un de NOS genres.
// iTunes ne donne qu'un seul genre « de style » ; on ne mappe que les cas clairs et
// on ignore le reste (Alternative, Electronic, World…). « Chanson française » n'est
// volontairement pas déduit (iTunes classe par style, pas par langue) : à mettre à la main.
const MAP: Record<string, Genre> = {
  'rock': 'Rock',
  'hard rock': 'Rock',
  'pop/rock': 'Rock',
  'alternative': 'Rock',
  'alternative rock': 'Rock',
  'indie': 'Rock',
  'indie rock': 'Rock',
  'grunge': 'Rock',
  'pop': 'Pop',
  'french pop': 'Pop',
  'adult contemporary': 'Pop',
  'k-pop': 'Pop',
  'j-pop': 'Pop',
  'singer/songwriter': 'Folk',
  'jazz': 'Jazz',
  'blues': 'Blues',
  'folk': 'Folk',
  'country': 'Country',
  'reggae': 'Reggae',
  'funk': 'Funk',
  'soul': 'Soul',
  'r&b/soul': 'R&B',
  'r&b': 'R&B',
  'hip-hop/rap': 'Hip Hop / Rap',
  'hip hop/rap': 'Hip Hop / Rap',
  'rap': 'Hip Hop / Rap',
  'metal': 'Metal',
  'heavy metal': 'Metal',
  'punk': 'Punk',
  'classical': 'Classique',
  'soundtrack': 'Films',
  'latin': 'Latino',
  'latino': 'Latino',
  'bossa nova': 'Bossa Nova',
};

export function mapItunesGenre(primaryGenreName: string | undefined): Genre | null {
  if (!primaryGenreName) return null;
  return MAP[primaryGenreName.trim().toLowerCase()] ?? null;
}
