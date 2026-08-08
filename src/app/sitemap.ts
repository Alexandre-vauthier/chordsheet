import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';
import { alternateLanguages, localeUrl } from '@/lib/seo';
import { sheetPath } from '@/lib/sheet-url';
import { getPublicBands, getPublicSheetIndex, songKey } from '@/lib/public-sheet-index';
import { CHORD_PAGE_INSTRUMENTS, chordNamesFor, chordSlug, isCommonChord } from '@/lib/chord-page';
import { artistPath } from '@/lib/artist-url';

export const revalidate = 86400;

/**
 * Chemins publics, sans préfixe de locale : chacun produit une entrée PAR langue.
 *
 * Le sitemap précédent listait ces chemins bruts (`/explore`…), or `localePrefix`
 * vaut « always » : les dix URL déclarées étaient donc dix redirections 307, et la
 * version anglaise n'était pas soumise du tout.
 *
 * `/login` et `/register` en sont volontairement retirés : ils n'ont aucune valeur
 * pour un moteur, et ils passent en noindex.
 */
const PUBLIC_PATHS: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
  { path: '',                          priority: 1.0, changeFrequency: 'daily' },
  { path: '/explore',                  priority: 0.9, changeFrequency: 'daily' },
  { path: '/chords',                   priority: 0.9, changeFrequency: 'weekly' },
  { path: '/artists',                  priority: 0.8, changeFrequency: 'weekly' },
  { path: '/tuner',                    priority: 0.7, changeFrequency: 'monthly' },
  { path: '/chord-detect',             priority: 0.7, changeFrequency: 'monthly' },
  { path: '/chord-finder',             priority: 0.7, changeFrequency: 'monthly' },
  { path: '/what-to-play',             priority: 0.7, changeFrequency: 'weekly' },
  { path: '/what-can-i-play',          priority: 0.7, changeFrequency: 'weekly' },
  { path: '/three-chord-songs',        priority: 0.7, changeFrequency: 'weekly' },
  { path: '/no-barre-songs',           priority: 0.7, changeFrequency: 'weekly' },
  { path: '/pricing',                  priority: 0.6, changeFrequency: 'monthly' },
  { path: '/about',                    priority: 0.5, changeFrequency: 'yearly' },
  { path: '/faq',                      priority: 0.6, changeFrequency: 'monthly' },
  { path: '/import-chords',            priority: 0.7, changeFrequency: 'monthly' },
  { path: '/transpose',                priority: 0.7, changeFrequency: 'monthly' },
  { path: '/sheet-photo',              priority: 0.7, changeFrequency: 'monthly' },
  { path: '/audio-to-chords',          priority: 0.7, changeFrequency: 'monthly' },
  { path: '/bands',                    priority: 0.6, changeFrequency: 'monthly' },
  { path: '/stage-mode',               priority: 0.6, changeFrequency: 'monthly' },
  { path: '/editor',                   priority: 0.7, changeFrequency: 'monthly' },
  { path: '/print',                    priority: 0.5, changeFrequency: 'monthly' },
  { path: '/contact',                  priority: 0.4, changeFrequency: 'yearly' },
  { path: '/credits',                  priority: 0.3, changeFrequency: 'yearly' },
  { path: '/legal/cgu',                priority: 0.2, changeFrequency: 'yearly' },
  { path: '/legal/cgv',                priority: 0.2, changeFrequency: 'yearly' },
  { path: '/legal/confidentialite',    priority: 0.2, changeFrequency: 'yearly' },
  { path: '/legal/mentions-legales',   priority: 0.2, changeFrequency: 'yearly' },
];

/** Une entrée par langue, avec les alternates réciproques qu'attend Google. */
function entriesFor(
  path: string,
  lastModified: Date,
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'],
  priority: number,
): MetadataRoute.Sitemap {
  // Le même jeu d'annonces que le `<head>` des pages, `x-default` compris : il
  // manquait ici, et Google lit les deux sources.
  const languages = alternateLanguages(path);

  return routing.locales.map(locale => ({
    url: localeUrl(locale, path),
    lastModified,
    changeFrequency,
    priority,
    alternates: { languages },
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const fixed = PUBLIC_PATHS.flatMap(({ path, priority, changeFrequency }) =>
    entriesFor(path, now, changeFrequency, priority),
  );

  // Les pages d'accord : leur contenu est dérivé de la bibliothèque, qui ne bouge
  // qu'au rythme des versions du site — d'où « yearly ». Les accords courants (majeurs,
  // mineurs, septièmes) passent devant : annoncer un Dbdim au même niveau qu'un Am
  // dilue le signal au lieu de le renforcer.
  const chordEntries = CHORD_PAGE_INSTRUMENTS.flatMap((instrument) => [
    ...entriesFor(`/chords/${instrument}`, now, 'monthly', 0.7),
    ...chordNamesFor(instrument).flatMap((name) =>
      entriesFor(
        `/chords/${instrument}/${chordSlug(name)}`,
        now,
        'yearly',
        isCommonChord(name) ? 0.6 : 0.3,
      ),
    ),
  ]);

  // Les grilles publiques : le vrai catalogue du site, et de loin le plus gros
  // volume. Sans elles, un moteur ne découvre une grille que s'il suit un lien
  // depuis /explore, dont la pagination est côté client.
  const [sheets, bands] = await Promise.all([getPublicSheetIndex(), getPublicBands()]);

  // Les vitrines de groupe : peu nombreuses, mais ce sont des pages de destination
  // que des gens cherchent par le nom du groupe ou du créateur.
  const bandEntries = bands.flatMap((b) =>
    entriesFor(`/band/${b.id}`, b.updatedAt ?? now, 'weekly', 0.6),
  );

  /*
   * La forme slug + identifiant, celle vers laquelle la page redirige. Déclarer
   * l'ancienne aurait fait explorer 986 redirections pour rien.
   *
   * `entriesFor` produit les `xhtml:link` par `alternateLanguages()`, la même
   * fonction que le `<head>` des pages : les deux langues de chaque grille
   * s'annoncent donc sous la même adresse, sans second calcul qui pourrait diverger.
   */
  const sheetEntries = sheets.flatMap(s =>
    entriesFor(sheetPath(s), s.updatedAt ?? now, 'weekly', 0.6),
  );

  // Les pages d'artiste et de morceau ne sont pas stockées : elles se déduisent du
  // catalogue. On ne déclare que celles qui ont réellement quelque chose à montrer.
  const artistDates = new Map<string, Date>();
  const songVersions = new Map<string, { title: string; artist: string; count: number; lastModified: Date }>();

  for (const s of sheets) {
    const date = s.updatedAt ?? now;

    if (s.artist) {
      const known = artistDates.get(s.artist);
      if (!known || date > known) artistDates.set(s.artist, date);
    }

    if (s.title && s.artist) {
      const key = songKey(s.title, s.artist);
      const known = songVersions.get(key);
      if (known) {
        known.count += 1;
        if (date > known.lastModified) known.lastModified = date;
      } else {
        songVersions.set(key, { title: s.title, artist: s.artist, count: 1, lastModified: date });
      }
    }
  }

  // Les profils de créateur : une page par auteur ayant au moins une grille
  // publique. Le garde-fou est le même que sur la page elle-même, qui passe en
  // noindex sans grille publiée — le sitemap ne doit pas annoncer ce que la page
  // refuse d'indexer.
  const creatorDates = new Map<string, Date>();
  for (const s of sheets) {
    // Une grille de groupe a pour auteur le groupe : son `ownerId` n'est pas un
    // compte, et déclarer /user/{groupId} produirait une page vide.
    if (!s.ownerId || s.ownerId === s.groupId) continue;
    const date = s.updatedAt ?? now;
    const known = creatorDates.get(s.ownerId);
    if (!known || date > known) creatorDates.set(s.ownerId, date);
  }

  const creatorEntries = [...creatorDates].flatMap(([ownerId, date]) =>
    entriesFor(`/user/${ownerId}`, date, 'weekly', 0.4),
  );

  /*
   * Une entrée par **slug**, et non par orthographe.
   *
   * « Francis Cabrel » et « Françis Cabrel » — une faute de frappe du catalogue — se
   * ramènent au même slug, et la page réunit leurs grilles. En déclarer deux ferait
   * explorer deux fois la même page. On garde la date la plus récente des deux.
   */
  const parSlug = new Map<string, { artist: string; date: Date }>();
  for (const [artist, date] of artistDates) {
    const slug = artistPath(artist);
    const vu = parSlug.get(slug);
    if (!vu || date > vu.date) parSlug.set(slug, { artist, date });
  }

  const artistEntries = [...parSlug.values()].flatMap(({ artist, date }) =>
    entriesFor(artistPath(artist), date, 'weekly', 0.5),
  );

  // Une seule version d'un morceau : la page /song ne ferait que rediriger le
  // lecteur vers l'unique grille. La déclarer créerait un quasi-doublon.
  const songEntries = [...songVersions.values()]
    .filter(v => v.count > 1)
    .flatMap(v =>
      entriesFor(
        `/song/${encodeURIComponent(v.title)}/${encodeURIComponent(v.artist)}`,
        v.lastModified,
        'weekly',
        0.5,
      ),
    );

  return [...fixed, ...chordEntries, ...sheetEntries, ...artistEntries, ...songEntries, ...creatorEntries, ...bandEntries];
}
