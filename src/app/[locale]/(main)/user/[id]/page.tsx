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

    const [snap, sheetsSnap] = await Promise.all([
      db.collection('users').doc(id).get(),
      db
        .collection('sheets')
        .where('ownerId', '==', id)
        .where('isPublic', '==', true)
        .select()
        .limit(50)
        .get(),
    ]);

    const publicSheets: number = sheetsSnap.size;
    if (!snap.exists) return { profile: null, publicSheets };

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
    };
  } catch {
    // Admin SDK indisponible : le composant client se rabat sur le nom porté par les
    // grilles. Mieux vaut une page dégradée qu'une page en erreur.
    return { profile: null, publicSheets: 0 };
  }
});

/** Revalidation horaire, comme les pages d'artiste. */
export const revalidate = 3600;

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

  const { profile, publicSheets } = await getServerProfile(id);

  return (
    <>
      <UserProfileClient id={id} initialProfile={profile} hasPublicSheets={publicSheets > 0} />
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
