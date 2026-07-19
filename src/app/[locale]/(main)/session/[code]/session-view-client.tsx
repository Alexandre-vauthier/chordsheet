'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { QRCodeSVG } from 'qrcode.react';

import { useLiveSession } from '@/lib/live-session-context';
import { Link, useRouter } from '@/i18n/navigation';

export function SessionViewClient({ code }: { code: string }) {
  const t = useTranslations('LiveSession');
  const router = useRouter();
  const normalizedCode = code.toUpperCase();
  const { session, sessionStatus, isHost, nickname, setNickname, joinSession, endSession, leaveSession } = useLiveSession();
  const [joinError, setJoinError] = useState('');
  const [joining, setJoining] = useState(true);
  const [nicknameDraft, setNicknameDraft] = useState(nickname);
  // Mémorise le code déjà tenté pour CE montage — évite de retenter de rejoindre
  // à chaque fois que sessionCode dérive de normalizedCode (ex: l'hôte termine sa
  // propre session pendant qu'on est encore sur cette URL : sessionCode repasse à
  // null, mais il ne faut surtout pas ré-écrire le code mort dans le stockage local).
  const attemptedCodeRef = useRef<string | null>(null);

  useEffect(() => {
    if (attemptedCodeRef.current === normalizedCode) return;
    attemptedCodeRef.current = normalizedCode;
    setJoining(true);
    joinSession(normalizedCode)
      .catch(() => setJoinError(t('joinError')))
      .finally(() => setJoining(false));
  }, [normalizedCode, joinSession, t]);

  useEffect(() => {
    setNicknameDraft(nickname);
  }, [nickname]);

  // Session introuvable/expirée : nettoie le code du stockage local pour ne pas
  // rester bloqué dessus indéfiniment (ex: /session redirigerait sans fin vers
  // cette URL morte au lieu de proposer d'en démarrer une nouvelle).
  useEffect(() => {
    if (sessionStatus === 'not-found') leaveSession();
  }, [sessionStatus, leaveSession]);

  const joinUrl = typeof window !== 'undefined' ? `${window.location.origin}/session/${normalizedCode}` : '';

  const handleEnd = () => {
    if (!confirm(t('endSessionConfirm'))) return;
    endSession().then(() => router.push('/session')).catch(() => {});
  };

  const handleLeave = () => {
    leaveSession();
    router.push('/explore');
  };

  if (joinError) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <p className="text-[var(--ink-light)]">{joinError}</p>
        <Link href="/" className="text-sm text-[var(--accent)] hover:underline">{t('backHome')}</Link>
      </div>
    );
  }

  if (joining || sessionStatus === 'idle' || sessionStatus === 'loading') {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--accent)] border-t-transparent mx-auto" />
      </div>
    );
  }

  if (sessionStatus === 'not-found' || !session) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <div className="text-3xl">🕐</div>
        <p className="text-[var(--ink-light)]">{t('sessionNotFound')}</p>
        <Link href="/" className="text-sm text-[var(--accent)] hover:underline">{t('backHome')}</Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-10 space-y-6">
      <div className="text-center">
        <h1 className="font-playfair text-2xl font-bold text-[var(--ink)]">
          {t('sessionOf', { name: session.hostName })}
        </h1>
      </div>

      {isHost && (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--cell-bg)] p-6 text-center space-y-4">
          <p className="text-sm text-[var(--ink-light)]">{t('scanToJoin')}</p>
          <div className="flex justify-center bg-white p-4 rounded-lg w-fit mx-auto">
            <QRCodeSVG value={joinUrl} size={200} />
          </div>
          <p className="text-xs text-[var(--ink-faint)]">
            {t('codeLabel')} <span className="font-mono font-bold text-[var(--ink)] tracking-widest">{normalizedCode}</span>
          </p>
        </div>
      )}

      <div className="rounded-xl border border-[var(--line)] bg-[var(--cell-bg)] p-6 text-center space-y-2">
        {session.currentSheetTitle && session.currentSheetId ? (
          <>
            <p className="text-xs text-[var(--ink-faint)] uppercase tracking-wide">{t('nowPlaying')}</p>
            <Link href={`/sheet/${session.currentSheetId}`} className="font-semibold text-[var(--ink)] hover:text-[var(--accent)] transition-colors">
              {session.currentSheetTitle}
            </Link>
            {session.currentSheetArtist && (
              <p className="text-sm text-[var(--ink-light)]">{session.currentSheetArtist}</p>
            )}
          </>
        ) : (
          <p className="text-sm text-[var(--ink-light)]">{t('noSheetYet')}</p>
        )}
      </div>

      {!isHost && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={nicknameDraft}
            onChange={e => setNicknameDraft(e.target.value)}
            onBlur={() => setNickname(nicknameDraft)}
            placeholder={t('nicknamePlaceholder')}
            maxLength={30}
            className="flex-1 px-3 py-2 border border-[var(--line)] rounded-lg bg-[var(--paper)] text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:outline-none focus:border-[var(--accent)] transition-colors text-sm"
          />
        </div>
      )}

      <div className="text-center">
        {isHost ? (
          <button
            onClick={handleEnd}
            className="text-sm text-red-500 hover:text-red-600 transition-colors cursor-pointer"
          >
            {t('endSession')}
          </button>
        ) : (
          <button
            onClick={handleLeave}
            className="text-sm text-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors cursor-pointer"
          >
            {t('leaveSession')}
          </button>
        )}
      </div>
    </div>
  );
}
