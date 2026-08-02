'use client';

import { Suspense, useEffect, useState } from 'react';
import { BrandLogo } from '@/components/layout/brand-logo';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { getAuth } from '@/lib/firebase';
import { Link, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Choix d'un nouveau mot de passe, sur notre domaine.
 *
 * Le lien du mail menait auparavant à la page d'action de Firebase, hébergée sur
 * `…firebaseapp.com` : un domaine inconnu de la personne qui clique, juste après
 * qu'elle a demandé à changer son mot de passe. C'est exactement le moment où il ne
 * faut pas ressembler à un hameçonnage.
 *
 * Le jeton (`oobCode`) est vérifié par Firebase, ici comme là-bas. Seule la page qui
 * le recueille change.
 */
function ResetPasswordForm() {
  const t = useTranslations('Auth.resetPassword');
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = searchParams.get('oobCode');

  const [state, setState] = useState<'checking' | 'ready' | 'invalid' | 'done'>('checking');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // On valide le jeton avant d'afficher le formulaire : proposer de saisir un mot de
  // passe pour découvrir ensuite que le lien a expiré serait une perte de temps.
  useEffect(() => {
    if (!code) { setState('invalid'); return; }
    verifyPasswordResetCode(getAuth(), code)
      .then((address) => { setEmail(address); setState('ready'); })
      .catch(() => setState('invalid'));
  }, [code]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || password.length < 6) { setError(t('errorTooShort')); return; }

    setSaving(true);
    setError('');
    try {
      await confirmPasswordReset(getAuth(), code, password);
      setState('done');
      setTimeout(() => router.push('/login'), 2500);
    } catch {
      setError(t('errorFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <BrandLogo size="lg" className="mx-auto text-[var(--ink)]" />
          </Link>
        </div>

        <div className="bg-[var(--cell-bg)] rounded-xl p-8 shadow-sm border border-[var(--line)]">
          {state === 'checking' && <p className="text-sm text-[var(--ink-light)] text-center">{t('checking')}</p>}

          {state === 'invalid' && (
            <div className="text-center">
              <h2 className="font-playfair text-xl font-bold text-[var(--ink)] mb-2">{t('invalidTitle')}</h2>
              <p className="text-sm text-[var(--ink-light)] mb-6">{t('invalidBody')}</p>
              <Link href="/login" className="text-sm text-[var(--accent)] hover:underline">{t('backToLogin')}</Link>
            </div>
          )}

          {state === 'done' && (
            <div className="text-center">
              <h2 className="font-playfair text-xl font-bold text-[var(--ink)] mb-2">{t('doneTitle')}</h2>
              <p className="text-sm text-[var(--ink-light)] mb-6">{t('doneBody')}</p>
              <Link href="/login" className="text-sm text-[var(--accent)] hover:underline">{t('backToLogin')}</Link>
            </div>
          )}

          {state === 'ready' && (
            <form onSubmit={handleSubmit}>
              <h2 className="font-playfair text-xl font-bold text-[var(--ink)] mb-2">{t('title')}</h2>
              <p className="text-sm text-[var(--ink-light)] mb-6">{t('forAccount', { email })}</p>

              <Input
                type="password"
                label={t('newPassword')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
              <p className="text-xs text-[var(--ink-faint)] mt-1.5 mb-5">{t('hint')}</p>

              {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

              <Button type="submit" isLoading={saving} className="w-full">{t('submit')}</Button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  // useSearchParams impose une frontière Suspense au pré-rendu.
  return (
    <Suspense fallback={<main className="min-h-screen" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
