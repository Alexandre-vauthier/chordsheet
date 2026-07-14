'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';

export function EmailVerificationGate() {
  const { user, signOut, resendVerificationEmail, refreshEmailVerification } = useAuth();
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'checking' | 'not-verified'>('idle');

  const handleResend = async () => {
    setStatus('sending');
    try {
      await resendVerificationEmail();
      setStatus('sent');
    } catch {
      setStatus('idle');
    }
  };

  const handleCheck = async () => {
    setStatus('checking');
    const verified = await refreshEmailVerification();
    if (!verified) setStatus('not-verified');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center bg-[var(--cell-bg)] rounded-xl p-8 border border-[var(--line)]">
        <h1 className="font-playfair text-2xl font-bold text-[var(--ink)] mb-3">
          Vérifie ton adresse email
        </h1>
        <p className="text-sm text-[var(--ink-light)] mb-6">
          Un email de confirmation a été envoyé à <strong className="text-[var(--ink)]">{user?.email}</strong>.
          Clique sur le lien reçu, puis reviens ici.
        </p>

        {status === 'not-verified' && (
          <p className="text-sm text-red-500 mb-4">
            Toujours pas vérifié. Vérifie tes spams ou renvoie l&apos;email.
          </p>
        )}
        {status === 'sent' && (
          <p className="text-sm text-[var(--accent)] mb-4">Email renvoyé !</p>
        )}

        <div className="flex flex-col gap-3">
          <Button onClick={handleCheck} isLoading={status === 'checking'}>
            J&apos;ai vérifié, continuer
          </Button>
          <Button variant="ghost" onClick={handleResend} isLoading={status === 'sending'}>
            Renvoyer l&apos;email
          </Button>
          <button
            onClick={() => signOut()}
            className="cursor-pointer text-xs text-[var(--ink-faint)] hover:underline mt-2"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
}
