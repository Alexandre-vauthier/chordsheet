'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { PhotoPicker } from '@/components/ui/photo-picker';
import { avatarPath } from '@/lib/upload-image';
import { SettingBlock } from './settings-panel';
import { StatsCards, type UserStats } from './stats-cards';
import { DangerZone } from './danger-zone';

/**
 * Qui je suis sur ce site, et comment j'en sors.
 *
 * Les quatre compteurs décrivent *ma* bibliothèque, dont trois sur quatre sont
 * privés : ils appartiennent au compte, pas à la vitrine publique. « Se
 * déconnecter » les rejoint, alors qu'il était jusqu'ici coincé entre la
 * réputation et les statistiques.
 */
export function AccountSection({ stats }: { stats: UserStats | null }) {
  const t = useTranslations('Profile');
  const locale = useLocale();
  const { user, isAdmin, updateUser, signOut } = useAuth();
  const router = useRouter();
  const [nom, setNom] = useState<string | null>(null);
  const [etat, setEtat] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  if (!user) return null;

  // Tant que rien n'a été tapé, le champ suit le compte : pas de copie à
  // resynchroniser, donc pas d'effet ni de valeur périmée après un changement.
  const valeurNom = nom ?? user.displayName;

  const enregistrerNom = async () => {
    const propre = valeurNom.trim();
    if (!propre) { setEtat('error'); return; }
    setEtat('saving');
    try {
      await updateUser({ displayName: propre });
      setNom(null);
      setEtat('saved');
      setTimeout(() => setEtat('idle'), 2000);
    } catch {
      setEtat('error');
    }
  };

  return (
    <>
      <SettingBlock label={t('photo')}>
        <PhotoPicker
          url={user.photoURL}
          fallback={(user.displayName || user.email || '?').charAt(0).toUpperCase()}
          storagePath={avatarPath(user.id)}
          size="lg"
          onChange={(url) => updateUser({ photoURL: url })}
        />
      </SettingBlock>

      <SettingBlock label={t('displayName')}>
        <div className="flex gap-3">
          <input
            type="text"
            value={valeurNom}
            onChange={(e) => { setNom(e.target.value); setEtat('idle'); }}
            placeholder={t('displayNamePlaceholder')}
            className="flex-1 min-w-0 px-3 py-2 text-sm border border-[var(--line)] rounded-lg
              bg-[var(--cell-bg)] text-[var(--ink)] placeholder:text-[var(--ink-faint)]
              focus:outline-none focus:border-[var(--accent)] transition-colors"
          />
          <Button onClick={enregistrerNom} isLoading={etat === 'saving'} disabled={valeurNom === user.displayName}>
            {t('save')}
          </Button>
        </div>
        {/* Un champ n'a pas d'état visible : contrairement à un interrupteur, rien
            ne prouve qu'il a été enregistré. D'où cette confirmation, qui s'efface. */}
        {etat === 'saved' && <p className="mt-2 text-xs text-[var(--ink-faint)]">{t('nameUpdated')}</p>}
        {etat === 'error' && <p className="mt-2 text-xs text-red-600">{t('errorUpdate')}</p>}
      </SettingBlock>

      <SettingBlock label={t('email')} description={t('emailReadOnly')}>
        <p className="text-sm text-[var(--ink-light)]">{user.email}</p>
      </SettingBlock>

      <SettingBlock label={t('memberSince')}>
        <p className="text-sm text-[var(--ink)]">
          {user.createdAt.toLocaleDateString(locale === 'en' ? 'en-US' : 'fr-FR', {
            year: 'numeric', month: 'long', day: 'numeric',
          })}
        </p>
      </SettingBlock>

      <SettingBlock label={t('statistics')}>
        <StatsCards
          stats={stats}
          labels={[t('statSheets'), t('statPublic'), t('statSets'), t('statBookmarks')]}
        />
      </SettingBlock>

      <SettingBlock>
        <button
          type="button"
          onClick={async () => { await signOut(); router.push('/'); }}
          className="w-full py-2.5 px-4 rounded-xl border border-[var(--line)] text-sm text-[var(--ink-light)]
            hover:border-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors cursor-pointer"
        >
          {t('signOut')}
        </button>
      </SettingBlock>

      {!isAdmin && <DangerZone />}
    </>
  );
}
