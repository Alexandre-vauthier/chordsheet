'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';

type Status = 'sending' | 'sent' | 'checking' | 'not-verified' | 'too-many' | 'failed';

/**
 * Écran d'attente de confirmation d'adresse.
 *
 * Deux pièges, tous deux rencontrés en conditions réelles :
 *
 * 1. L'envoi n'avait lieu qu'à l'inscription. Un compte antérieur à cette
 *    vérification arrivait donc sur un écran affirmant qu'un mail était parti, alors
 *    que rien n'avait été envoyé. L'envoi se fait maintenant à l'affichage.
 *
 * 2. Après un clic sur le lien reçu, cet onglet garde un jeton qui dit encore
 *    « non vérifiée » : la porte restait affichée, et l'envoi automatique produisait
 *    un nouveau mail à chaque retour. D'où deux garde-fous — on interroge Firebase
 *    régulièrement pour que la porte s'ouvre d'elle-même, et on ne renvoie pas de
 *    message si un précédent est parti il y a peu.
 */

/** Délai avant qu'un nouvel affichage de l'écran redéclenche un envoi. */
const RESEND_COOLDOWN_MS = 10 * 60 * 1000;

/** Cadence d'interrogation, et durée au-delà de laquelle on cesse d'interroger. */
const POLL_MS = 5000;
const POLL_LIMIT_MS = 10 * 60 * 1000;
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

  // Envoi automatique, mais pas à chaque passage : quelqu'un qui a déjà cliqué le
  // lien sur son téléphone et revient ici ne doit pas déclencher un second message.
  // L'horodatage est conservé par compte, et survit à un rechargement de page.
  const sentOnce = useRef(false);
  useEffect(() => {
    if (sentOnce.current || !user?.id) return;
    sentOnce.current = true;

    const key = `verify_sent_${user.id}`;
    const last = Number(window.localStorage.getItem(key) ?? 0);
    if (Date.now() - last < RESEND_COOLDOWN_MS) {
      setStatus('sent');
      return;
    }

    window.localStorage.setItem(key, String(Date.now()));
    send();
  }, [send, user?.id]);

  /**
   * Interrogation régulière : le lien est souvent ouvert sur un autre appareil, et
   * rien ne préviendrait cet onglet. Sans ça, il faut deviner qu'il faut rafraîchir
   * ou cliquer un bouton — c'est exactement là qu'on tourne en rond.
   */
  // La fonction change d'identité à chaque rendu du fournisseur : s'y fier
  // recréerait l'intervalle sans cesse et repousserait indéfiniment sa limite.
  const refreshRef = useRef(refreshEmailVerification);
  useEffect(() => { refreshRef.current = refreshEmailVerification; }, [refreshEmailVerification]);

  useEffect(() => {
    const startedAt = Date.now();
    const id = setInterval(() => {
      if (Date.now() - startedAt > POLL_LIMIT_MS) {
        clearInterval(id);
        return;
      }
      refreshRef.current().catch(() => {});
    }, POLL_MS);

    return () => clearInterval(id);
  }, []);

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
