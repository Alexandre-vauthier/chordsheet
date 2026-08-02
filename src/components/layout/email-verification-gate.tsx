'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';

type Status = 'sending' | 'sent' | 'checking' | 'not-verified' | 'too-many' | 'failed';

/**
 * Écran d'attente de confirmation d'adresse.
 *
 * L'envoi est déclenché **ici**, à l'affichage. Auparavant il n'avait lieu qu'à
 * l'inscription : un compte créé avant l'existence de cette vérification arrivait
 * donc sur un écran affirmant qu'un mail avait été envoyé, alors que rien n'était
 * parti. Le message était faux, et l'attente sans issue.
 *
 * La limitation d'usage de la route (trois envois par quart d'heure) borne les
 * dégâts d'un éventuel remontage en boucle du composant.
 */
export function EmailVerificationGate() {
  const t = useTranslations('Auth.gate');
  const { user, signOut, resendVerificationEmail, refreshEmailVerification } = useAuth();
  const [status, setStatus] = useState<Status>('sending');

  const send = useCallback(async () => {
    setStatus('sending');
    try {
      await resendVerificationEmail();
      setStatus('sent');
    } catch (err) {
      setStatus(err instanceof Error && err.message === '429' ? 'too-many' : 'failed');
    }
  }, [resendVerificationEmail]);

  // Un seul envoi automatique par affichage. La ref survit au double appel des
  // effets en mode strict, qui produirait sinon deux mails.
  const sentOnce = useRef(false);
  useEffect(() => {
    if (sentOnce.current) return;
    sentOnce.current = true;
    send();
  }, [send]);

  const handleCheck = async () => {
    setStatus('checking');
    const verified = await refreshEmailVerification();
    if (!verified) setStatus('not-verified');
  };

  const message: Record<Status, { text: string; tone: 'info' | 'good' | 'bad' } | null> = {
    sending: { text: t('sending'), tone: 'info' },
    sent: { text: t('sent', { email: user?.email ?? '' }), tone: 'good' },
    checking: null,
    'not-verified': { text: t('notVerified'), tone: 'bad' },
    'too-many': { text: t('tooMany'), tone: 'bad' },
    failed: { text: t('failed'), tone: 'bad' },
  };
  const current = message[status];

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center bg-[var(--cell-bg)] rounded-xl p-8 border border-[var(--line)]">
        <h1 className="font-playfair text-2xl font-bold text-[var(--ink)] mb-3">{t('title')}</h1>
        <p className="text-sm text-[var(--ink-light)] mb-6">
          {t('intro')} <strong className="text-[var(--ink)]">{user?.email}</strong>.
        </p>

        {current && (
          <p
            className={`text-sm mb-4 ${
              current.tone === 'good' ? 'text-[var(--accent)]'
              : current.tone === 'bad' ? 'text-red-500'
              : 'text-[var(--ink-faint)]'
            }`}
          >
            {current.text}
          </p>
        )}

        <div className="flex flex-col gap-3">
          <Button onClick={handleCheck} isLoading={status === 'checking'}>{t('check')}</Button>
          <Button variant="ghost" onClick={send} isLoading={status === 'sending'}>{t('resend')}</Button>
          <button
            onClick={() => signOut()}
            className="cursor-pointer text-xs text-[var(--ink-faint)] hover:underline mt-2"
          >
            {t('signOut')}
          </button>
        </div>
      </div>
    </div>
  );
}
