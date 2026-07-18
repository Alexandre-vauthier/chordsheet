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
  const { sessionCode, startSession } = useLiveSession();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [joinCode, setJoinCode] = useState('');

  const userIsPro = isPro(user?.subscription);

  // Session déjà active (hôte OU invité) : direction la vue partagée plutôt que
  // le hub de création — sinon un invité qui clique "Session live" après s'être
  // connecté se retrouve sur l'écran "démarrer une session" au lieu de la sienne.
  useEffect(() => {
    if (sessionCode) {
      router.replace(`/session/${sessionCode}`);
    }
  }, [sessionCode, router]);

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

  if (sessionCode) {
    return null;
  }

  if (!userIsPro) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8">
        <h1 className="font-playfair text-2xl font-bold text-[var(--ink)] mb-6">{t('hubTitle')}</h1>

        <div className="rounded-xl border border-[var(--line)] bg-[var(--cell-bg)] p-6 text-center space-y-4">
          <div className="text-3xl">📡</div>
          <div>
            <p className="font-semibold text-[var(--ink)]">{t('proOnlyTitle')}</p>
            <p className="text-sm text-[var(--ink-light)] mt-1.5">
              {t('proOnlyDesc')}
            </p>
          </div>
          <Link
            href="/pricing"
            className="inline-block px-6 py-2.5 bg-[var(--accent)] hover:bg-[#a83d25] text-white text-sm font-medium rounded-lg transition-colors"
          >
            {t('discoverPro')}
          </Link>
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
