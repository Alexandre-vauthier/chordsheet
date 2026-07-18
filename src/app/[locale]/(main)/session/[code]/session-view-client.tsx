'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { QRCodeSVG } from 'qrcode.react';

import { useLiveSession } from '@/lib/live-session-context';
import { Link } from '@/i18n/navigation';

export function SessionViewClient({ code }: { code: string }) {
  const t = useTranslations('LiveSession');
  const normalizedCode = code.toUpperCase();
  const { sessionCode, session, sessionStatus, isHost, nickname, setNickname, joinSession, endSession, leaveSession } = useLiveSession();
  const [joinError, setJoinError] = useState('');
  const [nicknameDraft, setNicknameDraft] = useState(nickname);

  const alreadyJoined = sessionCode === normalizedCode;

  useEffect(() => {
    if (alreadyJoined) return;
    joinSession(normalizedCode).catch(() => setJoinError(t('joinError')));
  }, [alreadyJoined, normalizedCode, joinSession, t]);

  useEffect(() => {
    setNicknameDraft(nickname);
  }, [nickname]);

  const joinUrl = typeof window !== 'undefined' ? `${window.location.origin}/session/${normalizedCode}` : '';

  if (joinError) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <p className="text-[var(--ink-light)]">{joinError}</p>
        <Link href="/" className="text-sm text-[var(--accent)] hover:underline">{t('backHome')}</Link>
      </div>
    );
  }

  if (!alreadyJoined || sessionStatus === 'idle' || sessionStatus === 'loading') {
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
            onClick={() => { if (confirm(t('endSessionConfirm'))) endSession(); }}
            className="text-sm text-red-500 hover:text-red-600 transition-colors cursor-pointer"
          >
            {t('endSession')}
          </button>
        ) : (
          <button
            onClick={() => leaveSession()}
            className="text-sm text-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors cursor-pointer"
          >
            {t('leaveSession')}
          </button>
        )}
      </div>
    </div>
  );
}
