'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';

/**
 * Bouton « Continuer avec Google ».
 *
 * Le logo est en SVG dans le composant plutôt qu'en image distante : les conditions
 * d'utilisation de Google imposent le logo officiel, et une image externe ajouterait
 * une requête bloquante sur la page la plus sensible du site.
 */
export function GoogleSignIn({ onSuccess, note }: { onSuccess: () => void; note?: React.ReactNode }) {
  const t = useTranslations('Auth');
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleClick = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
      onSuccess();
    } catch (err: unknown) {
      const code = typeof err === 'object' && err && 'code' in err ? String((err as { code: string }).code) : '';

      // Fermer la fenêtre est un renoncement délibéré, pas une erreur : afficher un
      // message rouge pour ça donnerait le sentiment que quelque chose a cassé.
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setLoading(false);
        return;
      }
      setError(
        code === 'auth/popup-blocked' ? t('errorGooglePopupBlocked')
        : code === 'auth/account-exists-with-different-credential' ? t('errorGoogleAccountExists')
        : t('errorGoogleGeneric'),
      );
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-lg border border-[var(--line)]
          bg-[var(--paper)] text-[var(--ink)] text-sm font-medium transition-colors
          hover:border-[var(--ink-faint)] disabled:opacity-60 cursor-pointer disabled:cursor-default"
      >
        <svg className="w-[18px] h-[18px] flex-shrink-0" viewBox="0 0 18 18" aria-hidden focusable="false">
          <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/>
          <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/>
          <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"/>
          <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
        </svg>
        {loading ? t('googleInProgress') : t('googleContinue')}
      </button>

      {note && <p className="text-xs text-[var(--ink-faint)] mt-3 text-center leading-relaxed">{note}</p>}

      {error && <p className="text-sm text-red-600 mt-3 text-center">{error}</p>}

      <div className="flex items-center gap-3 my-6">
        <span className="flex-1 h-px bg-[var(--line)]" />
        <span className="text-xs text-[var(--ink-faint)] uppercase tracking-wide">{t('or')}</span>
        <span className="flex-1 h-px bg-[var(--line)]" />
      </div>
    </div>
  );
}
