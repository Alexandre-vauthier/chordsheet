import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { buildAlternates, buildOpenGraph, SITE_NAME } from '@/lib/seo';
import { JsonLd } from '@/components/seo/json-ld';
import { breadcrumbSchema } from '@/lib/seo-schema';
import { ChordDiagram } from '@/components/chord/chord-diagram';
import { PianoKeyboard } from '@/components/chord/piano-keyboard';
import { ChordDiagramCard } from '@/components/chord/chord-diagram-card';
import {
  chordEntries,
  chordFromSlug,
  chordSlug,
  isChordPageInstrument,
  neighbourChords,
  sameChordElsewhere,
  splitChordName,
} from '@/lib/chord-page';
import {
  INSTRUMENT_CONFIG,
  chordPitchClasses,
  chordPlayedNotes,
  translateChordName,
} from '@/lib/chord-data';
import { normalizeChord } from '@/lib/sheet-chords';
import { getSheetsWithChord } from '@/lib/public-sheet-index';
import { isPianoChord } from '@/types';
import type { InstrumentId, StringChord } from '@/types';
import { getInstrumentNames } from '@/lib/instrument-names';
import { sheetPath } from '@/lib/sheet-url';
import { accordsVoisins } from '@/lib/chord-neighbours';

interface PageProps {
  params: Promise<{ locale: string; instrument: string; chord: string }>;
}

/**
 * Une page par accord et par instrument.
 *
 * Tout le contenu est **dérivé de la bibliothèque** : le diagramme, les notes jouées
 * corde par corde, la description du doigté, les accords voisins, le même accord sur
 * les autres instruments. Rien n'est rédigé accord par accord, donc rien ne peut
 * contredire ce que l'application affiche.
 *
 * **Rendue à la demande, puis mise en cache.** C'était l'intention d'origine, et
 * elle n'était pas tenue : sans `generateStaticParams`, `next build` classait la
 * route `ƒ Dynamic — server-rendered on demand`, chaque requête était rendue, rien
 * n'était gardé, et le `revalidate` déclaré ici n'avait aucun effet — la réponse
 * portait `cache-control: no-store` et deux requêtes de suite ne rendaient pas le
 * même HTML.
 *
 * Ce n'était pas une API dynamique : avec `dynamic = 'error'`, la page se rend
 * statiquement sans broncher. C'était la seule absence de `generateStaticParams`
 * sur un segment dynamique, qui suffit à faire basculer Next en rendu par requête.
 *
 * D'où la fonction ci-dessous, et son tableau vide. Elle ne pré-rend rien — les
 * 443 accords × 2 langues feraient 886 pages à chaque déploiement, pour un trafic
 * concentré sur quelques dizaines — mais elle suffit à faire entrer la route dans
 * le régime statique : les pages demandées y sont rendues une fois, puis servies
 * depuis le cache jusqu'à la revalidation. Vérifié à l'en-tête `x-nextjs-cache` :
 * `MISS` sur la première requête, `HIT` sur la suivante.
 */

/**
 * Aucune page pré-rendue, mais un cache à l'exécution.
 *
 * Le tableau vide n'est pas un oubli : c'est lui qui distingue « je ne connais pas
 * les chemins d'avance » de « ne cache rien ». Avec `dynamicParams` à sa valeur par
 * défaut, tout accord demandé est rendu à sa première visite, puis conservé.
 *
 * Y mettre la liste des accords les plus visités reste possible plus tard : cela
 * ne changerait que ce qui est prêt avant la première visite, pas le mécanisme.
 */
export function generateStaticParams(): { locale: string; instrument: string; chord: string }[] {
  return [];
}

/**
 * Un jour, et non l'éternité.
 *
 * Sans cette ligne, une route statique est gardée jusqu'au prochain déploiement —
 * mesuré : `Cache-Control: s-maxage=31536000`, un an. Or ces pages sont dérivées de
 * la bibliothèque d'accords, que l'administration peut corriger à tout moment : un
 * doigté rectifié ne serait jamais servi. Un jour est le compromis d'origine, et il
 * a maintenant l'effet qu'il annonce.
 */
export const revalidate = 86400;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, instrument, chord: slug } = await params;
  if (!isChordPageInstrument(instrument)) return {};

  const name = chordFromSlug(slug, instrument);
  if (!name) return {};

  const t = await getTranslations({ locale, namespace: 'Seo.pages.chord' });
  const forms = await getInstrumentNames(locale, instrument);
  const path = `/chords/${instrument}/${slug}`;
  const notes = notesOf(name, instrument);

  /*
   * Le nom français dans le titre et la correspondance dans la description.
   *
   * Mesuré sur une semaine de Search Console : les requêtes françaises se classent
   * en position 34 quand les anglaises sont à 51 — la concurrence francophone est
   * bien plus faible. Et sur ces requêtes-là, plusieurs pages sont déjà en première
   * page après une semaine : « fm accord » en 4, « db7 guitare » en 9, « bm accord
   * guitare » en 10. Pourtant **zéro clic sur 283 impressions** : ce n'est pas le
   * classement qui manquait, c'est une raison de cliquer.
   *
   * « dm correspondance accord francais » — treize impressions, position 8, aucun
   * clic — dit exactement ce qui manquait : la correspondance entre les deux
   * notations, que le site possède et qu'il n'annonçait nulle part.
   */
  const frenchChord = translateChordName(name, 'french');
  const title = t('title', { ...forms, chord: name, frenchChord });
  const description = t('description', {
    ...forms,
    chord: name,
    notes: notes.join(', '),
    frenchChord,
    frenchNotes: notes.map((n) => translateChordName(n, 'french')).join(', '),
  });

  return {
    title,
    description,
    alternates: buildAlternates(locale, path),
    openGraph: { ...buildOpenGraph(locale, path), title, description },
  };
}

/**
 * Le nom lisible d'un accord stocké en minuscules.
 *
 * `bb` s'écrit `Bb`, `f#m` s'écrit `F#m` : seule la fondamentale prend la majuscule,
 * le reste est déjà dans la bonne casse.
 */
function nomAffiche(accord: string): string {
  return accord.charAt(0).toUpperCase() + accord.slice(1);
}

/** Combien de grilles la page liste, sur l'échantillon qu'elle lit. */
const GRILLES_AFFICHEES = 12;

export default async function ChordPage({ params }: PageProps) {
  const { locale, instrument, chord: slug } = await params;
  if (!isChordPageInstrument(instrument)) notFound();
  setRequestLocale(locale);

  const name = chordFromSlug(slug, instrument);
  if (!name) notFound();

  const t = await getTranslations({ locale, namespace: 'Editorial.chordPage' });
  const forms = await getInstrumentNames(locale, instrument);
  const entries = chordEntries(name, instrument);
  const notes = notesOf(name, instrument);
  const neighbours = neighbourChords(name, instrument);
  const elsewhere = await Promise.all(
    sameChordElsewhere(name, instrument).map(async (other) => ({
      ...other,
      forms: await getInstrumentNames(locale, other.instrumentId),
    })),
  );
  /*
   * Un seul échantillon, deux usages : les quelques grilles qu'on affiche, et le
   * voisinage calculé sur l'ensemble. Le plafond de cent est ce qui rend la page
   * tenable quand le catalogue grossit — la lecture est bornée par une constante,
   * jamais par la taille du catalogue.
   */
  const echantillon = await getSheetsWithChord(normalizeChord(name));
  const sheets = echantillon.slice(0, GRILLES_AFFICHEES);
  const voisins = accordsVoisins(echantillon, normalizeChord(name));

  // Nom français : « Am » se dit « Lam », et ses notes « La, Do, Mi ». C'est du
  // contenu que les sites anglophones n'ont pas, sur des requêtes réellement tapées.
  const frenchName = locale === 'fr' ? translateChordName(name, 'french') : null;
  const frenchNotes = locale === 'fr' ? notes.map((n) => translateChordName(n, 'french')) : null;

  const strings = INSTRUMENT_CONFIG[instrument].strings;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">

      <nav aria-label={t('breadcrumb')} className="text-xs text-[var(--ink-faint)] mb-4">
        <Link href="/chords" className="hover:text-[var(--accent)]">{t('libraryLink')}</Link>
        <span className="mx-2">/</span>
        <Link href={`/chords/${instrument}`} className="hover:text-[var(--accent)]">{forms.instrument}</Link>
        <span className="mx-2">/</span>
        <span>{name}</span>
      </nav>

      <h1 className="font-playfair text-3xl sm:text-4xl font-bold text-[var(--ink)] mb-3">
        {t('h1', { ...forms, chord: name })}
      </h1>
      <p className="text-[var(--ink-light)] leading-relaxed mb-10">
        {frenchName
          ? t('leadFrench', { ...forms, chord: name, frenchChord: frenchName })
          : t('lead', { ...forms, chord: name })}
      </p>

      {/* Diagrammes */}
      <section className="mb-10">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--ink-light)] mb-4">
          {entries.length > 1 ? t('diagramsHeading', { count: entries.length }) : t('diagramHeading')}
        </h2>
        <div className="flex flex-wrap gap-6">
          {entries.map((entry) => (
            /* Le son est la seule chose qu'un dictionnaire imprimé ne sait pas
               faire : c'est lui qui dit si le diagramme a été bien lu. Le
               diagramme est rendu ici, côté serveur ; la carte n'ajoute que ce
               qui bouge. */
            <ChordDiagramCard key={entry.id} chord={entry} instrumentId={instrument}>
              {isPianoChord(entry)
                ? <PianoKeyboard chord={entry} />
                : <ChordDiagram chord={entry} numStrings={strings} />}
            </ChordDiagramCard>
          ))}
        </div>
      </section>

      {/* Grilles utilisant cet accord, tout de suite après les diagrammes : ce sont
          de vrais morceaux, la seule chose de cette page qu'un dictionnaire ne
          contient pas. Les reléguer après les explications revenait à les cacher. */}
      {sheets.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--ink-light)] mb-3">
            {t('sheetsHeading', { ...forms, chord: name })}
          </h2>
          <ul className="space-y-1.5">
            {sheets.map((sheet) => (
              <li key={sheet.id}>
                <Link href={sheetPath(sheet)} className="text-sm text-[var(--accent)] hover:underline">
                  {sheet.title}
                </Link>
                {sheet.artist && <span className="text-sm text-[var(--ink-faint)]"> — {sheet.artist}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/*
        Avec quoi cet accord se joue vraiment.
        La seule matière qui distingue une page d'accord d'une autre sans que
        personne l'écrive : elle se déduit des grilles, se met à jour toute seule,
        et aucun site d'accords ne l'a — il faut un catalogue derrière.

        Un ordre, pas des chiffres : le calcul travaille sur un échantillon borné,
        et annoncer « quarante-neuf fois » deviendrait faux le jour où le plafond
        mord. L'ordre, lui, reste juste.
      */}
      {voisins.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--ink-light)] mb-3">
            {t('neighboursHeading', { ...forms, chord: name })}
          </h2>
          <p className="text-sm text-[var(--ink-light)] leading-relaxed mb-3">
            {t('neighboursLead', { ...forms, chord: name })}
          </p>
          <ul className="flex flex-wrap gap-2">
            {voisins.map((voisin) => (
              <li key={voisin}>
                <Link
                  href={`/chords/${instrument}/${chordSlug(voisin)}`}
                  className="inline-block px-3 py-1.5 rounded-lg text-sm font-mono border
                    border-[var(--line)] bg-[var(--cell-bg)] text-[var(--ink)]
                    hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                >
                  {nomAffiche(voisin)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Notes */}
      {notes.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--ink-light)] mb-3">
            {t('notesHeading', { chord: name })}
          </h2>
          <p className="text-[var(--ink)] text-lg font-medium">
            {notes.join(' · ')}
            {frenchNotes && (
              <span className="text-[var(--ink-light)] text-base font-normal"> ({frenchNotes.join(', ')})</span>
            )}
          </p>
          <p className="text-sm text-[var(--ink-light)] mt-2 leading-relaxed">
            {t('notesExplainer', { chord: name, count: notes.length })}
          </p>
        </section>
      )}

      {/* Doigté, corde par corde */}
      {entries.map((entry, index) =>
        isPianoChord(entry) ? null : (
          <FingeringSection
            key={`f-${entry.id}`}
            chord={entry}
            instrument={instrument}
            position={entries.length > 1 ? index + 1 : null}
            t={t}
          />
        ),
      )}

      {/* Maillage */}
      <section className="pt-8 border-t border-[var(--line)] space-y-7">
        {neighbours.sameRoot.length > 0 && (
          <ChordLinkList
            heading={t('sameRootHeading', { root: splitChordName(name)?.root ?? name })}
            instrument={instrument}
            names={neighbours.sameRoot}
          />
        )}
        {neighbours.sameSuffix.length > 0 && (
          <ChordLinkList
            heading={t('sameFamilyHeading', { chord: name })}
            instrument={instrument}
            names={neighbours.sameSuffix}
          />
        )}
        {elsewhere.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-[var(--ink)] mb-3">
              {t('elsewhereHeading', { chord: name })}
            </h2>
            <ul className="flex flex-wrap gap-2">
              {elsewhere.map((other) => (
                <li key={other.instrumentId}>
                  <Link
                    href={`/chords/${other.instrumentId}/${chordSlug(other.name)}`}
                    className="inline-block px-3 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--cell-bg)]
                      text-sm text-[var(--ink-light)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                  >
                    {t('elsewhereLink', { ...other.forms, chord: other.name })}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <JsonLd
        data={breadcrumbSchema(
          [
            { name: SITE_NAME, path: '' },
            { name: t('libraryLink'), path: '/chords' },
            { name: forms.instrument, path: `/chords/${instrument}` },
            { name: name, path: `/chords/${instrument}/${slug}` },
          ],
          locale,
        )}
      />
    </div>
  );
}

/** Les hauteurs de l'accord, dans l'ordre où l'instrument les fait entendre. */
function notesOf(name: string, instrument: InstrumentId): string[] {
  const entries = chordEntries(name, instrument);
  return entries.length > 0 ? chordPitchClasses(entries[0], instrument) : [];
}

type Translator = Awaited<ReturnType<typeof getTranslations>>;

/**
 * Le doigté décrit en toutes lettres, et corde par corde.
 *
 * C'est la partie que ni un diagramme ni une image ne donnent à un moteur : les
 * cordes à vide, les cordes étouffées, le barré, la case de départ et la note
 * produite par chaque corde, en texte.
 */
function FingeringSection({
  chord,
  instrument,
  position,
  t,
}: {
  chord: StringChord;
  instrument: InstrumentId;
  /** Rang du doigté quand l'accord en a plusieurs, null s'il est seul. */
  position: number | null;
  t: Translator;
}) {
  const played = chordPlayedNotes(chord, instrument);
  if (played.length === 0) return null;

  const open = (chord.open ?? []).length;
  const muted = (chord.muted ?? []).length;

  const traits: string[] = [];
  if (chord.barre) traits.push(t('traitBarre', { fret: chord.barre.fret }));
  if (open > 0) traits.push(t('traitOpen', { count: open }));
  if (muted > 0) traits.push(t('traitMuted', { count: muted }));
  if ((chord.startFret ?? 1) > 1) traits.push(t('traitStartFret', { fret: chord.startFret }));

  return (
    <section className="mb-10">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--ink-light)] mb-3">
        {position ? t('fingeringHeadingVariant', { position }) : t('fingeringHeading')}
      </h2>

      {traits.length > 0 && (
        <p className="text-sm text-[var(--ink-light)] mb-4 leading-relaxed">{traits.join(' · ')}</p>
      )}

      <div className="overflow-x-auto">
        <table className="text-sm border-collapse">
          <thead>
            <tr className="text-left text-[var(--ink-faint)]">
              <th className="pr-6 pb-2 font-medium">{t('colString')}</th>
              <th className="pr-6 pb-2 font-medium">{t('colFret')}</th>
              <th className="pb-2 font-medium">{t('colNote')}</th>
            </tr>
          </thead>
          <tbody className="text-[var(--ink)]">
            {played.map((note) => (
              <tr key={note.string} className="border-t border-[var(--line)]">
                <td className="pr-6 py-1.5">{note.string}</td>
                <td className="pr-6 py-1.5">{note.fret === 0 ? t('fretOpen') : note.fret}</td>
                <td className="py-1.5 font-medium">{note.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ChordLinkList({
  heading,
  instrument,
  names,
}: {
  heading: string;
  instrument: InstrumentId;
  names: string[];
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-[var(--ink)] mb-3">{heading}</h2>
      <ul className="flex flex-wrap gap-2">
        {names.map((n) => (
          <li key={n}>
            <Link
              href={`/chords/${instrument}/${chordSlug(n)}`}
              className="inline-block px-3 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--cell-bg)]
                text-sm text-[var(--ink-light)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
            >
              {n}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
