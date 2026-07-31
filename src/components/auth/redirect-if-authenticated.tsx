'use client';

import { useEffect, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from '@/i18n/navigation';

/**
 * Garde des pages login/register : un utilisateur déjà connecté n'a rien à y faire,
 * on le renvoie vers /explore — la même destination qu'après une connexion réussie.
 *
 * `replace` et non `push` : la page d'auth ne doit pas rester dans l'historique,
 * sinon le retour arrière du navigateur y ramène et déclenche une nouvelle
 * redirection. Tant que l'état d'auth n'est pas résolu on n'affiche pas le
 * formulaire, pour qu'il n'apparaisse pas une fraction de seconde avant de partir.
 */
export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const t = useTranslations('Auth');
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace('/explore');
  }, [loading, user, router]);

  if (loading || user) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div role="status" className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 rounded-full border-2 border-[var(--line)] border-t-[var(--accent)] animate-spin" />
          <span className="sr-only">{t('redirecting')}</span>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
