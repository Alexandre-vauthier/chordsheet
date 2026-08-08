import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { cache } from 'react';
import { getAdminDb } from '@/lib/firebase-admin';
import { buildAlternates, buildOpenGraph, NO_INDEX, SITE_NAME } from '@/lib/seo';
import { breadcrumbSchema } from '@/lib/seo-schema';
import { JsonLd } from '@/components/seo/json-ld';
import { sanitizeBio, sanitizeLinks } from '@/lib/social-links';
import { UserProfileClient, type PublicUser } from './user-profile-client';

interface UserPageProps {
  params: Promise<{ locale: string; id: string }>;
}

interface ServerProfile {
  profile: PublicUser | null;
  /** Nombre de grilles publiques. Décide de l'indexation et de l'affichage des liens. */
  publicSheets: number;
  /** Vitrines publiques du créateur : c'est par là qu'arrive sa communauté. */
  bands: { id: string; name: string; description: string; photoURL: string | null }[];
}

/**
 * Profil public, lu côté serveur.
 *
 * Le composant lisait ce document depuis le navigateur, ce qui ne pouvait pas
 * marcher : la collection `users` contient les adresses e-mail, ses règles la
 * réservent donc aux utilisateurs connectés, et un visiteur non connecté recevait un
 * refus de permission. On ne peut pas ouvrir la collection ; on lit donc côté serveur
 * et **on n'expose que les champs publics**, jamais le document entier.
 *
 * `cache()` évite que `generateMetadata` et la page fassent chacun la même requête.
 */
const getServerProfile = cache(async (id: string): Promise<ServerProfile> => {
  try {
    const db = getAdminDb();

    // Deux filtres d'égalité sur des champs différents se servent des index
    // à champ unique : aucun index composite à créer.
    const [snap, sheetsSnap, bandsSnap] = await Promise.all([
      db.collection('users').doc(id).get(),
      db
        .collection('sheets')
        .where('ownerId', '==', id)
        .where('isPublic', '==', true)
        .select()
        .limit(50)
        .get(),
      db
        .collection('groups')
        .where('ownerId', '==', id)
        .where('isPublic', '==', true)
        .select('name', 'description', 'photoURL')
        .limit(20)
        .get(),
    ]);

    const bandDocs = bandsSnap.docs as { id: string; data: () => Record<string, unknown> }[];
    const bands = bandDocs
      .map((d) => {
        const b = d.data();
        return {
          id: d.id,
          name: typeof b.name === 'string' ? b.name : '',
          description: typeof b.description === 'string' ? b.description : '',
          photoURL: typeof b.photoURL === 'string' ? b.photoURL : null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const publicSheets: number = sheetsSnap.size;
    if (!snap.exists) return { profile: null, publicSheets, bands };

    const data = (snap.data() ?? {}) as Record<string, unknown>;
    const createdAt = data.createdAt as { toDate?: () => Date } | undefined;

    // Liste blanche explicite. Tout autre champ (e-mail, rôle, préférences, quotas)
    // reste côté serveur : ce qui n'est pas nommé ici ne peut pas fuiter.
    return {
      profile: {
        displayName: typeof data.displayName === 'string' && data.displayName ? data.displayName : 'Anonyme',
        photoURL: typeof data.photoURL === 'string' ? data.photoURL : null,
        createdAt: createdAt?.toDate ? createdAt.toDate() : null,
        // Renettoyés à la lecture, et pas seulement à l'écriture : une donnée
        // enregistrée avant une règle plus stricte ne doit pas ressortir telle quelle.
        bio: typeof data.bio === 'string' ? sanitizeBio(data.bio) : undefined,
        links: Array.isArray(data.links) ? sanitizeLinks(data.links as { url: string }[]) : undefined,
      },
      publicSheets,
      bands,
    };
  } catch {
    // Admin SDK indisponible : le composant client se rabat sur le nom porté par les
    // grilles. Mieux vaut une page dégradée qu'une page en erreur.
    return { profile: null, publicSheets: 0, bands: [] };
  }
});

/*
 * Pas de `revalidate` ici, et c'est délibéré.
 *
 * Il y en avait un, et il ne servait à rien : `next build` classe cette route
 * `ƒ Dynamic — server-rendered on demand`, elle est donc rendue à chaque requête
 * et aucune durée de cache ne s'y applique. Mesuré en production : la réponse
 * porte `cache-control: no-store` et deux requêtes de suite ne rendent pas le
 * même HTML. La déclaration laissait croire à une mise en cache inexistante, ce
 * qui est pire que son absence — on raisonne faux sur la fraîcheur des données.
 *
 * La cause n'est pas une API dynamique : avec `dynamic = 'error'`, la page se rend
 * statiquement sans broncher. C'est l'absence de `generateStaticParams` sur un
 * segment dynamique qui suffit à faire basculer Next en rendu par requête.
 * Le jour où l'on voudra cacher ces pages, c'est là qu'il faudra revenir.
 */

export async function generateMetadata({ params }: UserPageProps): Promise<Metadata> {
  const { locale, id } = await params;
  const { profile, publicSheets } = await getServerProfile(id);

  // Un profil sans grille publiée n'a rien à montrer à un moteur.
  if (!profile || publicSheets === 0) return { robots: NO_INDEX };

  const t = await getTranslations({ locale, namespace: 'Seo.user' });
  const title = t('title', { name: profile.displayName });
  const description = t('description', { name: profile.displayName });
  const path = `/user/${id}`;

  return {
    title,
    description,
    alternates: buildAlternates(locale, path),
    openGraph: { ...buildOpenGraph(locale, path), title, description, type: 'profile' },
    twitter: { card: 'summary', title, description },
  };
}

export default async function UserPage({ params }: UserPageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const { profile, publicSheets, bands } = await getServerProfile(id);

  return (
    <>
      <UserProfileClient id={id} initialProfile={profile} hasPublicSheets={publicSheets > 0} bands={bands} />
      {profile && publicSheets > 0 && (
        <JsonLd
          data={breadcrumbSchema(
            [{ name: SITE_NAME, path: '' }, { name: profile.displayName, path: `/user/${id}` }],
            locale,
          )}
        />
      )}
    </>
  );
}
