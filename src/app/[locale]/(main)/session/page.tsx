'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';

import { useAuth } from '@/lib/auth-context';
import { useLiveSession } from '@/lib/live-session-context';
import { isPro } from '@/lib/plan-limits';
import { Link, useRouter } from '@/i18n/navigation';

export default function SessionHubPage() {
  const t = useTranslations('LiveSession');
  const router = useRouter();
  const { user } = useAuth();
  const { sessionCode, sessionStatus, startSession, leaveSession } = useLiveSession();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [joinCode, setJoinCode] = useState('');

  const userIsPro = isPro(user?.subscription);

  // Session déjà active (hôte OU invité) : direction la vue partagée plutôt que
  // le hub de création — sinon un invité qui clique "Session live" après s'être
  // connecté se retrouve sur l'écran "démarrer une session" au lieu de la sienne.
  // On ne redirige qu'une fois la session CONFIRMÉE active : un code périmé encore
  // en stockage local (session terminée/expirée) ne doit pas renvoyer vers une
  // session morte.
  useEffect(() => {
    if (sessionCode && sessionStatus === 'found') {
      router.replace(`/session/${sessionCode}`);
    }
  }, [sessionCode, sessionStatus, router]);

  // Code périmé en stockage local : le purger pour retomber sur le hub (démarrer /
  // rejoindre) au lieu de rester bloqué sur l'ancienne session.
  useEffect(() => {
    if (sessionCode && sessionStatus === 'not-found') {
      leaveSession();
    }
  }, [sessionCode, sessionStatus, leaveSession]);

  const handleStart = async () => {
    setStarting(true);
    setError('');
    try {
      const code = await startSession();
      router.push(`/session/${code}`);
    } catch {
      setError(t('startError'));
      setStarting(false);
    }
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    router.push(`/session/${joinCode.trim().toUpperCase()}`);
  };

  // Un code est en stockage local et on n'a pas encore établi qu'il est mort :
  // soit on résout (loading), soit la session est active et on redirige. Dans les
  // deux cas on affiche un chargement plutôt que le hub, pour éviter un flash du
  // formulaire "démarrer une session".
  if (sessionCode && sessionStatus !== 'not-found') {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--accent)] border-t-transparent mx-auto" />
      </div>
    );
  }

  if (!userIsPro) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8">
        <h1 className="font-playfair text-2xl font-bold text-[var(--ink)] mb-6">{t('hubTitle')}</h1>

        <LiveSessionUpsell t={t} />

        <JoinWithCodeForm
          t={t}
          joinCode={joinCode}
          setJoinCode={setJoinCode}
          onSubmit={handleJoin}
        />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="font-playfair text-2xl font-bold text-[var(--ink)] mb-2">{t('hubTitle')}</h1>
      <p className="text-sm text-[var(--ink-light)] mb-6">{t('hubSubtitle')}</p>

      <div className="rounded-xl border border-[var(--line)] bg-[var(--cell-bg)] p-6 text-center space-y-4">
        <div className="text-3xl">🎉</div>
        <p className="text-sm text-[var(--ink-light)]">{t('hubDescription')}</p>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          onClick={handleStart}
          disabled={starting}
          className="px-6 py-2.5 bg-[var(--accent)] hover:bg-[#a83d25] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
        >
          {starting ? t('starting') : t('startSession')}
        </button>
      </div>

      <JoinWithCodeForm
        t={t}
        joinCode={joinCode}
        setJoinCode={setJoinCode}
        onSubmit={handleJoin}
      />
    </div>
  );
}

// Argumentaire Pro pour les sessions live (esprit feu de camp)
function LiveSessionUpsell({ t }: { t: ReturnType<typeof useTranslations> }) {
  const benefits = [
    { icon: '🔴', title: t('proBenefitSyncTitle'), desc: t('proBenefitSyncDesc') },
    { icon: '🎸', title: t('proBenefitInstrumentTitle'), desc: t('proBenefitInstrumentDesc') },
    { icon: '🔥', title: t('proBenefitCampfireTitle'), desc: t('proBenefitCampfireDesc') },
  ];
  return (
    <div className="rounded-2xl border border-[var(--accent)]/30 bg-gradient-to-b from-[var(--accent-soft)] to-transparent p-6 sm:p-8">
      <div className="text-center max-w-md mx-auto">
        <span className="inline-block text-xs font-semibold uppercase tracking-wider text-[var(--accent)] bg-[var(--accent-soft)] px-3 py-1 rounded-full">
          Pro
        </span>
        <h2 className="font-playfair text-xl sm:text-2xl font-bold text-[var(--ink)] mt-3">{t('proUpsellTitle')}</h2>
        <p className="text-sm text-[var(--ink-light)] mt-2">{t('proUpsellSubtitle')}</p>
      </div>

      <div className="mt-6 space-y-3 max-w-md mx-auto">
        {benefits.map((b, i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-[var(--paper)] border border-[var(--line)]">
            <div className="w-9 h-9 rounded-full bg-[var(--accent-soft)] flex items-center justify-center text-lg shrink-0">{b.icon}</div>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-[var(--ink)]">{b.title}</p>
              <p className="text-sm text-[var(--ink-light)] mt-0.5">{b.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="text-center mt-6">
        <Link
          href="/pricing"
          className="inline-block px-6 py-2.5 bg-[var(--accent)] hover:bg-[#a83d25] text-white text-sm font-medium rounded-lg transition-colors"
        >
          {t('discoverPro')}
        </Link>
        <p className="text-xs text-[var(--ink-faint)] mt-3">{t('proPricing')}</p>
      </div>
    </div>
  );
}

function JoinWithCodeForm({
  t,
  joinCode,
  setJoinCode,
  onSubmit,
}: {
  t: ReturnType<typeof useTranslations>;
  joinCode: string;
  setJoinCode: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="mt-6 flex items-center gap-2">
      <input
        type="text"
        value={joinCode}
        onChange={e => setJoinCode(e.target.value)}
        placeholder={t('joinWithCodePlaceholder')}
        maxLength={6}
        className="flex-1 px-3 py-2 border border-[var(--line)] rounded-lg bg-[var(--paper)] text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:outline-none focus:border-[var(--accent)] transition-colors uppercase"
      />
      <button
        type="submit"
        disabled={!joinCode.trim()}
        className="px-4 py-2 border border-[var(--line)] text-[var(--ink)] text-sm font-medium rounded-lg hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {t('joinButton')}
      </button>
    </form>
  );
}
