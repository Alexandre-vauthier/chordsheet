'use client';

import { Suspense, useEffect, useState } from 'react';
import { BrandLogo } from '@/components/layout/brand-logo';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { applyActionCode } from 'firebase/auth';
import { getAuth } from '@/lib/firebase';
import { Link } from '@/i18n/navigation';

/**
 * Confirmation d'adresse, sur notre domaine plutôt que sur celui de Firebase.
 *
 * La personne peut arriver ici déconnectée, depuis un autre appareil que celui de
 * l'inscription : c'est le cas courant, on ouvre ses mails sur son téléphone. La page
 * ne suppose donc aucune session — elle applique le code, puis oriente.
 */
function VerifyEmail() {
  const t = useTranslations('Auth.verifyEmail');
  const code = useSearchParams().get('oobCode');
  const [state, setState] = useState<'checking' | 'done' | 'invalid'>('checking');

  useEffect(() => {
    if (!code) { setState('invalid'); return; }
    applyActionCode(getAuth(), code)
      .then(async () => {
        // Session ouverte sur cet appareil : on rafraîchit le jeton, sinon
        // l'application continuerait de croire l'adresse non vérifiée.
        await getAuth().currentUser?.reload().catch(() => {});
        setState('done');
      })
      .catch(() => setState('invalid'));
  }, [code]);

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <BrandLogo size="lg" className="mx-auto text-[var(--ink)]" />
          </Link>
        </div>

        <div className="bg-[var(--cell-bg)] rounded-xl p-8 shadow-sm border border-[var(--line)] text-center">
          {state === 'checking' && <p className="text-sm text-[var(--ink-light)]">{t('checking')}</p>}

          {state === 'done' && (
            <>
              <h2 className="font-playfair text-xl font-bold text-[var(--ink)] mb-2">{t('doneTitle')}</h2>
              <p className="text-sm text-[var(--ink-light)] mb-6">{t('doneBody')}</p>
              <Link href="/explore" className="text-sm text-[var(--accent)] hover:underline">{t('start')}</Link>
            </>
          )}

          {state === 'invalid' && (
            <>
              <h2 className="font-playfair text-xl font-bold text-[var(--ink)] mb-2">{t('invalidTitle')}</h2>
              <p className="text-sm text-[var(--ink-light)] mb-6">{t('invalidBody')}</p>
              <Link href="/login" className="text-sm text-[var(--accent)] hover:underline">{t('backToLogin')}</Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<main className="min-h-screen" />}>
      <VerifyEmail />
    </Suspense>
  );
}
