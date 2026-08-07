'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from '@/i18n/navigation';

/**
 * La suppression de compte.
 *
 * Trois protections conservées telles quelles : repliée derrière un bouton
 * discret, masquée aux administrateurs par l'appelant, et un mot de confirmation
 * à recopier exactement. Le mot est traduit, c'est voulu — on tape dans sa langue.
 */
export function DangerZone() {
  const t = useTranslations('Profile');
  const { deleteAccount } = useAuth();
  const router = useRouter();
  const [ouverte, setOuverte] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [enCours, setEnCours] = useState(false);

  return (
    <div className="px-5 py-4 sm:px-6">
      <button
        type="button"
        onClick={() => { setOuverte((v) => !v); setConfirmation(''); }}
        className="text-xs text-[var(--ink-faint)] hover:text-red-600 transition-colors cursor-pointer"
      >
        {ouverte ? t('hideDeleteZone') : t('showDeleteZone')}
      </button>

      {ouverte && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm font-semibold text-red-700 mb-1">{t('deleteAccountTitle')}</p>
          <p className="text-xs text-red-600 mb-4">
            {t('deleteAccountWarning')}{' '}
            {t.rich('deleteConfirmInstruction', {
              word: t('deleteConfirmWord'),
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>
          <input
            type="text"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder={t('deleteConfirmWord')}
            className="w-full px-3 py-2 text-sm border border-red-300 rounded-lg outline-none
              focus:ring-2 focus:ring-red-300 mb-3 bg-[var(--cell-bg)]"
          />
          <button
            type="button"
            disabled={confirmation !== t('deleteConfirmWord') || enCours}
            onClick={async () => {
              setEnCours(true);
              try {
                await deleteAccount();
                router.push('/');
              } catch (err) {
                console.error('Error deleting account:', err);
                alert(t('errorDeleteAccount'));
                setEnCours(false);
              }
            }}
            className="px-4 py-2 text-sm rounded-lg transition-colors cursor-pointer
              disabled:opacity-40 disabled:cursor-not-allowed
              bg-red-600 text-white hover:bg-red-700 disabled:hover:bg-red-600"
          >
            {enCours ? t('deleting') : t('confirmDelete')}
          </button>
        </div>
      )}
    </div>
  );
}
