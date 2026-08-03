'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import { MAX_BIO, MAX_LINKS, parseSocialLink, sanitizeBio, sanitizeLinks } from '@/lib/social-links';
import { SocialLinkRow } from '@/components/profile/social-link-row';

/**
 * Présentation et liens affichés sur le profil public.
 *
 * Un seul champ pour ajouter une adresse, quelle qu'elle soit : la plateforme se
 * déduit du domaine. Un champ par réseau vieillirait — il faudrait toucher au modèle
 * à chaque nouvelle plateforme, et un musicien qui n'a que Bandcamp verrait surtout
 * des cases vides.
 */
export function PublicProfileForm() {
  const t = useTranslations('Profile.publicProfile');
  const { user, updateUser } = useAuth();

  const [bio, setBio] = useState(user?.bio ?? '');
  const [links, setLinks] = useState<{ url: string }[]>(user?.links ?? []);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');

  const persist = async (nextBio: string, nextLinks: { url: string }[]) => {
    setState('saving');
    try {
      await updateUser({ bio: sanitizeBio(nextBio), links: sanitizeLinks(nextLinks) });
      setState('saved');
      setTimeout(() => setState('idle'), 2000);
    } catch {
      setState('idle');
      setError(t('saveError'));
    }
  };

  const addLink = () => {
    const parsed = parseSocialLink(draft);
    if (!parsed) { setError(t('invalidUrl')); return; }
    if (links.length >= MAX_LINKS) { setError(t('tooMany', { max: MAX_LINKS })); return; }
    if (links.some((l) => parseSocialLink(l.url)?.key === parsed.key)) { setError(t('duplicate')); return; }

    const next = [...links, { url: parsed.url }];
    setLinks(next);
    setDraft('');
    setError('');
    persist(bio, next);
  };

  const removeLink = (url: string) => {
    const next = links.filter((l) => l.url !== url);
    setLinks(next);
    persist(bio, next);
  };

  return (
    <section className="mt-8 p-5 bg-[var(--cell-bg)] border border-[var(--line)] rounded-xl">
      <h2 className="text-base font-semibold text-[var(--ink)]">{t('title')}</h2>
      <p className="text-xs text-[var(--ink-faint)] mt-1 leading-relaxed">{t('desc')}</p>

      <label className="block mt-5 text-sm font-medium text-[var(--ink)]" htmlFor="bio">{t('bioLabel')}</label>
      <textarea
        id="bio"
        value={bio}
        onChange={(e) => setBio(e.target.value.slice(0, MAX_BIO))}
        onBlur={() => persist(bio, links)}
        rows={3}
        placeholder={t('bioPlaceholder')}
        className="mt-1.5 w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm
          text-[var(--ink)] placeholder:text-[var(--ink-faint)] outline-none focus:border-[var(--accent)] resize-y"
      />
      <p className="mt-1 text-[11px] text-[var(--ink-faint)]">{t('bioCount', { used: bio.length, max: MAX_BIO })}</p>

      <p className="mt-6 text-sm font-medium text-[var(--ink)]">{t('linksLabel')}</p>
      <p className="text-xs text-[var(--ink-faint)] mt-0.5">{t('linksHint', { max: MAX_LINKS })}</p>

      {links.length > 0 && (
        <ul className="mt-3 space-y-2">
          {links.map((l) => (
            <SocialLinkRow key={l.url} url={l.url} onRemove={() => removeLink(l.url)} removeLabel={t('remove')} />
          ))}
        </ul>
      )}

      {links.length < MAX_LINKS && (
        <div className="mt-3 flex gap-2">
          <input
            type="url"
            value={draft}
            onChange={(e) => { setDraft(e.target.value); setError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }}
            placeholder={t('urlPlaceholder')}
            className="flex-1 rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm
              text-[var(--ink)] placeholder:text-[var(--ink-faint)] outline-none focus:border-[var(--accent)]"
          />
          <button
            type="button"
            onClick={addLink}
            className="px-4 py-2 rounded-lg bg-[var(--accent)] hover:bg-[#a83d25] text-white text-sm transition-colors cursor-pointer"
          >
            {t('add')}
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {state === 'saved' && <p className="mt-2 text-xs text-[var(--accent)]">{t('saved')}</p>}
    </section>
  );
}
