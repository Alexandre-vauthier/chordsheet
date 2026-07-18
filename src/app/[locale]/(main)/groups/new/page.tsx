'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { useGroups } from '@/lib/use-groups';
import { useAuth } from '@/lib/auth-context';
import { canCreateGroup } from '@/lib/plan-limits';
import { Link, useRouter } from '@/i18n/navigation';

export default function NewGroupPage() {
  const t = useTranslations('Groups');
  const router = useRouter();
  const { user } = useAuth();
  const { createGroup } = useGroups();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isPro = canCreateGroup(user?.subscription);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !isPro) return;
    setLoading(true);
    setError('');
    try {
      const id = await createGroup(name, description);
      router.push(`/groups/${id}`);
    } catch {
      setError(t('errorCreate'));
      setLoading(false);
    }
  };

  if (!isPro) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/groups" className="text-sm text-[var(--ink-light)] hover:text-[var(--accent)] transition-colors">
            ← {t('backToGroups')}
          </Link>
          <h1 className="font-playfair text-2xl font-bold text-[var(--ink)] mt-2">{t('newGroupTitle')}</h1>
        </div>

        <div className="rounded-xl border border-[var(--line)] bg-[var(--cell-bg)] p-6 text-center space-y-4">
          <div className="text-3xl">🎸</div>
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
          <p className="text-xs text-[var(--ink-faint)]">
            {t('proPricing')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/groups" className="text-sm text-[var(--ink-light)] hover:text-[var(--accent)] transition-colors">
          ← {t('backToGroups')}
        </Link>
        <h1 className="font-playfair text-2xl font-bold text-[var(--ink)] mt-2">{t('newGroupTitle')}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-[var(--ink)] mb-1.5">
            {t('groupName')} <span className="text-[var(--accent)]">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('groupNamePlaceholder')}
            maxLength={60}
            required
            className="w-full px-3 py-2.5 border border-[var(--line)] rounded-lg bg-[var(--paper)] text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:outline-none focus:border-[var(--accent)] transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--ink)] mb-1.5">
            {t('description')} <span className="text-[var(--ink-faint)] font-normal">{t('optional')}</span>
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={t('descriptionPlaceholder')}
            maxLength={200}
            rows={3}
            className="w-full px-3 py-2.5 border border-[var(--line)] rounded-lg bg-[var(--paper)] text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:outline-none focus:border-[var(--accent)] transition-colors resize-none"
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-3 pt-1">
          <Link
            href="/groups"
            className="flex-1 px-4 py-2.5 border border-[var(--line)] text-[var(--ink-light)] text-sm font-medium rounded-lg text-center hover:border-[var(--ink-light)] transition-colors"
          >
            {t('cancel')}
          </Link>
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="flex-1 px-4 py-2.5 bg-[var(--accent)] hover:bg-[#a83d25] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? t('creating') : t('createGroup')}
          </button>
        </div>
      </form>
    </div>
  );
}
