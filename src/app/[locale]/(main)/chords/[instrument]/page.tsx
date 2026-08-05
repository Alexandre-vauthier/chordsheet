import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { buildAlternates, buildOpenGraph, SITE_NAME } from '@/lib/seo';
import { JsonLd } from '@/components/seo/json-ld';
import { breadcrumbSchema } from '@/lib/seo-schema';
import {
  CHORD_PAGE_INSTRUMENTS,
  chordNamesFor,
  chordSlug,
  isChordPageInstrument,
} from '@/lib/chord-page';
import { CHORD_CATEGORIES, getChordsByInstrument } from '@/lib/chord-data';
import type { InstrumentId } from '@/types';
import { getInstrumentNames } from '@/lib/instrument-names';
import { InstrumentEditorial } from './instrument-editorial';

interface PageProps {
  params: Promise<{ locale: string; instrument: string }>;
}

/**
 * Index des accords d'un instrument.
 *
 * Sa fonction première est le maillage : c'est la page qui rend les 443 pages
 * d'accord atteignables en deux clics depuis l'accueil, et le parent du fil d'Ariane
 * de chacune. Elle porte aussi sa propre intention de recherche (« accords guitare »),
 * plus large et plus concurrentielle que celle des pages d'accord.
 */
export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    CHORD_PAGE_INSTRUMENTS.map((instrument) => ({ locale, instrument })),
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, instrument } = await params;
  if (!isChordPageInstrument(instrument)) return {};

  const t = await getTranslations({ locale, namespace: 'Seo.pages.chordInstrument' });
  const names = await getInstrumentNames(locale, instrument);
  const count = chordNamesFor(instrument).length;
  const path = `/chords/${instrument}`;

  const title = t('title', names);
  const description = t('description', { ...names, count });

  return {
    title,
    description,
    alternates: buildAlternates(locale, path),
    openGraph: { ...buildOpenGraph(locale, path), title, description },
  };
}

export default async function ChordInstrumentPage({ params }: PageProps) {
  const { locale, instrument } = await params;
  if (!isChordPageInstrument(instrument)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'Editorial.instrumentPage' });
  const forms = await getInstrumentNames(locale, instrument);
  const otherForms = await Promise.all(
    CHORD_PAGE_INSTRUMENTS.filter((id) => id !== instrument).map(async (id) => ({
      id,
      forms: await getInstrumentNames(locale, id),
    })),
  );
  const names = chordNamesFor(instrument);

  // Regroupement par famille, dans l'ordre des catégories de l'application : c'est
  // celui que le lecteur a déjà en tête s'il vient de la bibliothèque.
  const groups = groupByCategory(instrument, names);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">

      <nav aria-label={t('breadcrumb')} className="text-xs text-[var(--ink-faint)] mb-4">
        <Link href="/chords" className="hover:text-[var(--accent)]">{t('libraryLink')}</Link>
        <span className="mx-2">/</span>
        <span>{forms.instrument}</span>
      </nav>

      <h1 className="font-playfair text-3xl sm:text-4xl font-bold text-[var(--ink)] mb-3">
        {t('h1', forms)}
      </h1>
      <p className="text-[var(--ink-light)] leading-relaxed mb-10 max-w-2xl">
        {t('lead', { ...forms, count: names.length })}
      </p>

      {groups.map((group) => (
        <section key={group.id} className="mb-9">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--ink-light)] mb-3">
            {t(`families.${group.id}`)}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {group.names.map((name) => (
              <li key={name}>
                <Link
                  href={`/chords/${instrument}/${chordSlug(name)}`}
                  className="inline-block px-3 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--cell-bg)]
                    text-sm font-medium text-[var(--ink)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                >
                  {name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="mt-12 pt-8 border-t border-[var(--line)]">
        <h2 className="text-sm font-semibold text-[var(--ink)] mb-3">{t('otherInstruments')}</h2>
        <ul className="flex flex-wrap gap-2">
          {otherForms.map(({ id, forms: other }) => (
            <li key={id}>
              <Link
                href={`/chords/${id}`}
                className="text-sm text-[var(--accent)] hover:underline"
              >
                {t('otherInstrumentLink', other)}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Le fond éditorial de la page : par où commencer, comment lire un
          diagramme, ce que l'instrument a de particulier. Sous les listes, parce
          qu'on vient d'abord chercher un accord — mais il fallait qu'il existe :
          une liste de liens ne pèse rien sur « accords guitare ». */}
      <InstrumentEditorial locale={locale} instrument={instrument} forms={forms} />

      <JsonLd
        data={breadcrumbSchema(
          [
            { name: SITE_NAME, path: '' },
            { name: t('libraryLink'), path: '/chords' },
            { name: forms.instrument, path: `/chords/${instrument}` },
          ],
          locale,
        )}
      />
    </div>
  );
}

/**
 * Les noms d'accord rangés par famille.
 *
 * L'ordre des familles vient de `CHORD_CATEGORIES`, la même source que les filtres de
 * la bibliothèque : deux listes à tenir à jour, ce serait une de trop. Seuls les
 * identifiants sont repris — les libellés de la table sont en français, la page se
 * traduit donc par ses propres clés.
 */
function groupByCategory(instrument: InstrumentId, names: string[]): { id: string; names: string[] }[] {
  const categoryByName = new Map<string, string>();
  for (const chord of getChordsByInstrument(instrument)) {
    if (!categoryByName.has(chord.name)) categoryByName.set(chord.name, chord.category);
  }

  const categories = CHORD_CATEGORIES[instrument as keyof typeof CHORD_CATEGORIES] ?? [];

  const groups = categories
    .filter((c) => c.id !== 'all')
    .map((c) => ({ id: c.id, names: names.filter((n) => categoryByName.get(n) === c.id) }))
    .filter((g) => g.names.length > 0);

  // Filet : une famille présente dans les données mais absente de la table ne doit pas
  // faire disparaître ses accords de la page.
  const placed = new Set(groups.flatMap((g) => g.names));
  const rest = names.filter((n) => !placed.has(n));
  if (rest.length > 0) groups.push({ id: 'other', names: rest });

  return groups;
}
