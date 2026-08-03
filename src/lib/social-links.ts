/**
 * Liens de profil : reconnaissance de la plateforme, et validation.
 *
 * On stocke l'adresse telle que le créateur l'a collée, et on déduit la plateforme
 * à l'affichage. Un champ par réseau vieillirait — il faudrait modifier le modèle à
 * chaque nouvelle plateforme, et un musicien qui n'a que Bandcamp verrait surtout des
 * cases vides.
 *
 * Fonctions pures : aucune dépendance à React ni au réseau.
 */

export interface SocialLink {
  url: string;
}

export type SocialPlatform =
  | 'youtube' | 'instagram' | 'tiktok' | 'spotify' | 'bandcamp'
  | 'soundcloud' | 'deezer' | 'appleMusic' | 'facebook' | 'x' | 'twitch' | 'website';

/** Domaines reconnus, du plus spécifique au plus général. */
const DOMAINS: { platform: SocialPlatform; match: RegExp }[] = [
  { platform: 'youtube',    match: /(^|\.)(youtube\.com|youtu\.be)$/ },
  { platform: 'instagram',  match: /(^|\.)instagram\.com$/ },
  { platform: 'tiktok',     match: /(^|\.)tiktok\.com$/ },
  { platform: 'spotify',    match: /(^|\.)spotify\.com$/ },
  { platform: 'bandcamp',   match: /(^|\.)bandcamp\.com$/ },
  { platform: 'soundcloud', match: /(^|\.)soundcloud\.com$/ },
  { platform: 'deezer',     match: /(^|\.)deezer\.com$/ },
  { platform: 'appleMusic', match: /(^|\.)music\.apple\.com$/ },
  { platform: 'facebook',   match: /(^|\.)(facebook\.com|fb\.me)$/ },
  { platform: 'x',          match: /(^|\.)(twitter\.com|x\.com)$/ },
  { platform: 'twitch',     match: /(^|\.)twitch\.tv$/ },
];

/** Nombre maximal de liens sur un profil. Au-delà ce n'est plus une présentation. */
export const MAX_LINKS = 6;

/** Longueur maximale de la présentation, en caractères. */
export const MAX_BIO = 400;

export interface RecognisedLink {
  url: string;
  platform: SocialPlatform;
  /** Ce qu'on affiche : « youtube.com/@chaine », sans le protocole ni le www. */
  display: string;
  /**
   * Clé de comparaison, insensible au `www.`, à la casse et au slash final.
   * Sans elle, `youtube.com/@moi/` et `www.YouTube.com/@moi` passeraient pour deux
   * liens distincts et se retrouveraient tous les deux sur le profil.
   */
  key: string;
}

/**
 * Valide et normalise une adresse.
 *
 * Rend `null` sur tout ce qui n'est pas une adresse http(s) : un `javascript:` ou un
 * `data:` collé dans ce champ deviendrait un lien exécutable sur une page publique.
 */
export function parseSocialLink(raw: string): RecognisedLink | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Sans protocole, on suppose https plutôt que de refuser : c'est ainsi qu'on colle
  // une adresse depuis la barre du navigateur.
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (!url.hostname.includes('.')) return null;

  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  const platform = DOMAINS.find((d) => d.match.test(host))?.platform ?? 'website';

  const chemin = (url.pathname + url.search).replace(/\/$/, '');
  return { url: url.toString(), platform, display: `${host}${chemin}`.slice(0, 60), key: `${host}${chemin}`.toLowerCase() };
}

/** Nettoie une liste saisie : adresses valides, sans doublon, plafonnée. */
export function sanitizeLinks(raw: { url: string }[]): SocialLink[] {
  const vus = new Set<string>();
  const out: SocialLink[] = [];

  for (const { url } of raw) {
    const lien = parseSocialLink(url);
    if (!lien) continue;
    const cle = lien.key;
    if (vus.has(cle)) continue;
    vus.add(cle);
    out.push({ url: lien.url });
    if (out.length >= MAX_LINKS) break;
  }
  return out;
}

/** Nettoie une présentation : espaces réduits, longueur bornée. */
export function sanitizeBio(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, MAX_BIO);
}
