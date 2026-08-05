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
 * Pas de `generateStaticParams` : 443 accords × 2 langues feraient 886 pages
 * pré-rendues à chaque déploiement, pour un trafic qui se concentrera sur quelques
 * dizaines d'entre elles. Rendu à la demande puis mis en cache, c'est le même
 * résultat pour un temps de construction inchangé.
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

  const title = t('title', { ...forms, chord: name });
  const description = t('description', { ...forms, chord: name, notes: notes.join(', ') });

  return {
    title,
    description,
    alternates: buildAlternates(locale, path),
    openGraph: { ...buildOpenGraph(locale, path), title, description },
  };
}

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
  const sheets = await getSheetsWithChord(normalizeChord(name));

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
            {t('sheetsHeading', { chord: name })}
          </h2>
          <ul className="space-y-1.5">
            {sheets.map((sheet) => (
              <li key={sheet.id}>
                <Link href={`/sheet/${sheet.id}`} className="text-sm text-[var(--accent)] hover:underline">
                  {sheet.title}
                </Link>
                {sheet.artist && <span className="text-sm text-[var(--ink-faint)]"> — {sheet.artist}</span>}
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
