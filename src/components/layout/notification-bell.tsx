'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useNotifications, type AppNotification } from '@/lib/use-notifications';
import { useClickOutside } from '@/lib/use-click-outside';

export function NotificationBell() {
  const t = useTranslations('Notifications');
  const locale = useLocale();
  const { items, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false), open);

  const openItem = (n: AppNotification) => {
    markRead(n.id);
    setOpen(false);
    // Une destination explicite l'emporte : les notifications d'administration mènent
    // à un écran d'administration, pas à une grille.
    if (n.link) { router.push(n.link); return; }
    // Note → la grille ; commentaire → ancre commentaires.
    router.push(n.kind === 'rating' ? `/sheet/${n.sheetId}` : `/sheet/${n.sheetId}#sheet-comments`);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="relative p-1.5 rounded-lg text-[var(--nav-text)]/70 hover:text-[var(--nav-text)] hover:bg-white/10 transition-colors"
        title={t('title')}
        aria-label={t('title')}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4a2 2 0 01-.6-1.4V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-[var(--accent)] text-white text-[10px] font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-[var(--cell-bg)] border border-[var(--line)] rounded-xl shadow-lg overflow-hidden z-[60]">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--line)]">
            <span className="text-sm font-semibold text-[var(--ink)]">{t('title')}</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-[var(--accent)] hover:underline">{t('markAllRead')}</button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto py-1">
            {items.length === 0 ? (
              <p className="px-4 py-6 text-sm text-[var(--ink-faint)] text-center">{t('empty')}</p>
            ) : (
              items.map((n) => {
                /**
                 * Les notifications d'administration passent en bleu.
                 *
                 * Elles ne parlent pas de la même chose que les autres : un
                 * commentaire ou une note concernent la personne, un accord manquant
                 * concerne l'application. Mêlées dans la même couleur, on lit les
                 * secondes comme si quelqu'un s'était adressé à nous.
                 */
                const interne = n.kind === 'unknownChord';
                const teinte = interne ? 'bg-blue-500' : 'bg-[var(--accent)]';
                const fond = interne ? 'bg-blue-500/10' : 'bg-[var(--accent-soft)]';

                return (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  className={`w-full text-left px-4 py-2.5 transition-colors flex gap-2.5
                    ${interne ? 'hover:bg-blue-500/10' : 'hover:bg-[var(--accent-soft)]'} ${n.read ? '' : fond}`}
                >
                  <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.read ? 'bg-transparent' : teinte}`} />
                  <span className="min-w-0">
                    <span className="block text-sm text-[var(--ink)]">
                      {interne
                        // Une seule teinte, lisible sur les deux thèmes : le projet
                        // bascule par `[data-theme]`, pas par la variante `dark:` de
                        // Tailwind, qui suivrait le réglage du système et non celui
                        // choisi dans l'application.
                        ? <span className="text-blue-500 font-medium">
                            {t('unknownChord', { chords: (n.chords ?? []).join(', '), count: n.chords?.length ?? 1 })}
                          </span>
                        : n.kind === 'rating'
                          ? <><b>{n.fromName}</b> {t('ratedSheet')}{n.rating ? ` ${'★'.repeat(n.rating)}` : ''}</>
                          : <><b>{n.fromName}</b> {t('wroteComment')}</>}
                    </span>
                    {n.sheetTitle && (
                      <span className="block text-xs text-[var(--ink-light)] truncate">« {n.sheetTitle} »</span>
                    )}
                    <span className="block text-[10px] text-[var(--ink-faint)] mt-0.5">
                      {n.createdAt ? n.createdAt.toLocaleDateString(locale, { day: 'numeric', month: 'short' }) : ''}
                    </span>
                  </span>
                </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
