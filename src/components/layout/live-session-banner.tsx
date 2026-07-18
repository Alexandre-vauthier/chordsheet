'use client';

import { useTranslations } from 'next-intl';
import { useLiveSession } from '@/lib/live-session-context';
import { useAuth } from '@/lib/auth-context';

export function LiveSessionBanner() {
  const t = useTranslations('LiveSession');
  const { session, isHost, endSession, leaveSession } = useLiveSession();
  const { firebaseUser } = useAuth();

  if (!session) return null;

  const pushedByMe = session.pushedBy === firebaseUser?.uid;

  return (
    <div className="bg-red-600 text-white print:hidden">
      <div className="max-w-4xl mx-auto px-4 py-2 flex items-center gap-3">
        <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse shrink-0" />
        <span className="text-sm font-medium flex-1 truncate">
          <span className="opacity-75">{t('bannerLabel')} · </span>
          {session.currentSheetTitle ? (
            <>
              {session.currentSheetTitle}
              {!pushedByMe && session.pushedByName && (
                <span className="opacity-60 ml-2 text-xs">{t('sentBy', { name: session.pushedByName })}</span>
              )}
            </>
          ) : (
            <span className="opacity-75">{t('waitingForSheet')}</span>
          )}
        </span>
        {isHost ? (
          <button
            onClick={() => { if (confirm(t('endSessionConfirm'))) endSession().catch(() => {}); }}
            className="shrink-0 px-3 py-1 bg-white text-red-600 rounded-lg text-xs font-semibold hover:bg-red-50 transition-colors"
          >
            {t('endSession')}
          </button>
        ) : (
          <button
            onClick={() => leaveSession()}
            className="shrink-0 text-white/60 hover:text-white text-lg leading-none transition-colors"
            title={t('leaveSession')}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
