'use client';

import { useState } from 'react';
import { SITE_NAME } from '@/lib/seo';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';

import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RedirectIfAuthenticated } from '@/components/auth/redirect-if-authenticated';
import { Link, useRouter } from '@/i18n/navigation';

export default function LoginPage() {
  return (
    <RedirectIfAuthenticated>
      <LoginForm />
    </RedirectIfAuthenticated>
  );
}

function LoginForm() {
  const t = useTranslations('Auth');
  const locale = useLocale();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      // Retour là où la personne voulait aller. Seuls les chemins internes sont
      // acceptés : un `next` absolu ferait de cette page un tremplin de redirection
      // vers n'importe quel site, au nom du nôtre.
      const next = searchParams.get('next');
      router.push(next && next.startsWith('/') && !next.startsWith('//') ? next : '/explore');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t('errorGenericLogin');
      if (errorMessage.includes('user-not-found') || errorMessage.includes('wrong-password') || errorMessage.includes('invalid-credential')) {
        setError(t('errorWrongCredentials'));
      } else if (errorMessage.includes('invalid-email')) {
        setError(t('errorInvalidEmail'));
      } else {
        setError(t('errorLoginRetry'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email.trim()) {
      setError(t('errorEmailRequiredForReset'));
      return;
    }
    setResetLoading(true);
    setError('');
    try {
      // Route serveur plutôt que le SDK : le mail part de notre domaine, avec notre
      // gabarit. Elle répond toujours 200, y compris pour une adresse inconnue —
      // c'est voulu, une réponse différenciée dirait qui a un compte ici.
      await fetch('/api/auth/send-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), locale }),
      });
      setResetSent(true);
    } catch {
      setError(t('errorResetFailed'));
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <h1 className="font-playfair text-3xl font-bold">{SITE_NAME}</h1>
          </Link>
          <p className="text-[var(--ink-light)] mt-2">{t('loginTitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[var(--cell-bg)] rounded-xl p-8 shadow-sm border border-[var(--line)]">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
          {resetSent && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              {t('resetSentPrefix')} <strong>{email}</strong>. {t('resetSentSuffix')}
            </div>
          )}

          <div className="space-y-5">
            <Input
              type="email"
              label={t('email')}
              placeholder={t('emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />

            <div>
              <Input
                type="password"
                label={t('password')}
                placeholder={t('passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                minLength={6}
              />
              <div className="text-right mt-1">
                <button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={resetLoading}
                  className="text-xs text-[var(--ink-faint)] hover:text-[var(--accent)] transition-colors"
                >
                  {resetLoading ? t('sending') : t('forgotPassword')}
                </button>
              </div>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full mt-6"
            size="lg"
            isLoading={loading}
          >
            {t('signIn')}
          </Button>

          <p className="text-center text-sm text-[var(--ink-light)] mt-6">
            {t('noAccountYet')}{' '}
            <Link href="/register" className="text-[var(--accent)] hover:underline font-medium">
              {t('signUp')}
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
