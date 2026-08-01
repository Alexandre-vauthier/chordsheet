import { SITE_URL, SITE_NAME, localeUrl } from '@/lib/seo';

/**
 * Générateurs de données structurées (schema.org).
 *
 * Règle qui prime sur toutes les autres : **le balisage ne décrit que ce qui est
 * visible dans le HTML de la page**. Décrire une liste de vingt éléments quand la
 * page n'en rend que six est une non-conformité, pas une optimisation.
 */

type Json = Record<string, unknown>;

/** Le nœud racine du site. À poser une seule fois, sur l'accueil. */
export function webSiteSchema(locale: string): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: localeUrl(locale),
    inLanguage: locale,
    // Seul moyen d'obtenir une barre de recherche directement dans les résultats.
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${localeUrl(locale, '/explore')}?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function organizationSchema(locale: string): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: localeUrl(locale),
    logo: `${SITE_URL}/icon-512.png`,
  };
}

/** Outil utilisable dans le navigateur : accordeur, reconnaissance d'accords. */
export function webApplicationSchema(
  locale: string,
  { name, description, path }: { name: string; description: string; path: string },
): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name,
    description,
    url: localeUrl(locale, path),
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Web',
    inLanguage: locale,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
  };
}

/** Questions fréquentes. Les réponses doivent être celles affichées sur la page. */
export function faqSchema(items: { question: string; answer: string }[]): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  };
}

/**
 * Une grille d'accords. `MusicComposition` décrit l'œuvre, ce qui est plus juste
 * qu'un `CreativeWork` générique. On ne déguise pas une grille en `Product` pour
 * forcer l'affichage d'étoiles : c'est une violation des règles et un motif
 * d'action manuelle.
 */
export function musicCompositionSchema(
  locale: string,
  { title, artist, musicalKey, path }: { title: string; artist: string; musicalKey?: string | null; path: string },
): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'MusicComposition',
    name: title,
    url: localeUrl(locale, path),
    inLanguage: locale,
    ...(artist ? { composer: { '@type': 'Person', name: artist } } : {}),
    ...(musicalKey ? { musicalKey } : {}),
  };
}

/** Un artiste et son répertoire disponible. `items` doit refléter ce qui est rendu. */
export function musicGroupSchema(
  locale: string,
  { name, path, items }: { name: string; path: string; items: { title: string; url: string }[] },
): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'MusicGroup',
    name,
    url: localeUrl(locale, path),
    ...(items.length
      ? {
          subjectOf: {
            '@type': 'ItemList',
            numberOfItems: items.length,
            itemListElement: items.map((item, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name: item.title,
              url: item.url,
            })),
          },
        }
      : {}),
  };
}

/** Fil d'Ariane. Rend la profondeur du site explicite dans les résultats. */
export function breadcrumbSchema(items: { name: string; path: string }[], locale: string): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: localeUrl(locale, item.path),
    })),
  };
}
