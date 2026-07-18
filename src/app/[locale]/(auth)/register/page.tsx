'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link, useRouter } from '@/i18n/navigation';

export default function RegisterPage() {
  const t = useTranslations('Auth');
  const router = useRouter();
  const { signUp } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(t('errorPasswordMismatch'));
      return;
    }

    if (password.length < 6) {
      setError(t('errorPasswordTooShort'));
      return;
    }

    if (!acceptedTerms) {
      setError(t('errorMustAcceptTerms'));
      return;
    }

    setLoading(true);

    try {
      await signUp(email, password, displayName);
      localStorage.setItem('chordsheet_show_welcome', '1');
      router.push('/explore');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t('errorGenericRegister');
      if (errorMessage.includes('email-already-in-use')) {
        setError(t('errorEmailInUse'));
      } else if (errorMessage.includes('invalid-email')) {
        setError(t('errorInvalidEmail'));
      } else if (errorMessage.includes('weak-password')) {
        setError(t('errorWeakPassword'));
      } else {
        setError(t('errorRegisterRetry'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <h1 className="font-playfair text-3xl font-bold">
              Chord<span className="text-[var(--accent)]">Sheet</span>
            </h1>
          </Link>
          <p className="text-[var(--ink-light)] mt-2">{t('registerTitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[var(--cell-bg)] rounded-xl p-8 shadow-sm border border-[var(--line)]">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-5">
            <Input
              type="text"
              label={t('displayName')}
              placeholder={t('displayNamePlaceholder')}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              autoComplete="name"
            />

            <Input
              type="email"
              label={t('email')}
              placeholder={t('emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />

            <Input
              type="password"
              label={t('password')}
              placeholder={t('passwordMinPlaceholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              minLength={6}
            />

            <Input
              type="password"
              label={t('confirmPassword')}
              placeholder={t('passwordPlaceholder')}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              minLength={6}
            />
          </div>

          <label className="flex items-start gap-2 mt-5 text-sm text-[var(--ink-light)] cursor-pointer">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-0.5 cursor-pointer accent-[var(--accent)]"
              required
            />
            <span>
              {t('acceptTermsPrefix')}{' '}
              <Link href="/legal/cgu" target="_blank" className="text-[var(--accent)] hover:underline">
                CGU
              </Link>{' '}
              {t('and')}{' '}
              <Link href="/legal/cgv" target="_blank" className="text-[var(--accent)] hover:underline">
                CGV
              </Link>
            </span>
          </label>

          <Button
            type="submit"
            className="w-full mt-4"
            size="lg"
            isLoading={loading}
            disabled={!acceptedTerms}
          >
            {t('createMyAccount')}
          </Button>

          <p className="text-center text-sm text-[var(--ink-light)] mt-6">
            {t('alreadyHaveAccount')}{' '}
            <Link href="/login" className="text-[var(--accent)] hover:underline font-medium">
              {t('signIn')}
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
