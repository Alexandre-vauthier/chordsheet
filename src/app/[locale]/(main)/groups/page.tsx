'use client';

import { useTranslations } from 'next-intl';
import { useGroups } from '@/lib/use-groups';
import { useGroupCards, type FicheGroupe as Fiche } from '@/lib/use-group-cards';
import { useSets } from '@/lib/use-sets';
import { useAuth } from '@/lib/auth-context';
import { isPro } from '@/lib/plan-limits';
import type { Group } from '@/types';
import { Link } from '@/i18n/navigation';

const AVATAR_COLORS = [
  '#c84b2f', '#2563eb', '#16a34a', '#9333ea',
  '#ea580c', '#0891b2', '#be185d', '#ca8a04',
];

function groupColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function groupInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * Les visages des membres, empilés.
 *
 * « 3 membres » ne dit pas qui. Quelques visages, si.
 *
 * Décoratifs : les noms sont déjà portés par le `title` du groupe et par sa page,
 * et les lire à voix haute avant même le nom du groupe mettrait la charrue devant
 * les bœufs. D'où `aria-hidden` sur la pile, et le compte qui, lui, reste écrit.
 */
function Visages({ membres, total }: { membres: Fiche['membres']; total: number }) {
  if (membres.length === 0) return null;
  const restants = total - membres.length;

  return (
    <div className="flex items-center -space-x-2" aria-hidden="true">
      {membres.map((m) => (
        <span
          key={m.id}
          title={m.displayName}
          className="w-7 h-7 rounded-full overflow-hidden ring-2 ring-[var(--cell-bg)] shrink-0
            flex items-center justify-center text-[10px] font-semibold text-white select-none"
          style={{ backgroundColor: m.photoURL ? undefined : groupColor(m.id) }}
        >
          {m.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.photoURL} alt="" className="w-full h-full object-cover" />
          ) : (
            groupInitials(m.displayName || '?')
          )}
        </span>
      ))}
      {restants > 0 && (
        <span className="w-7 h-7 rounded-full ring-2 ring-[var(--cell-bg)] shrink-0 bg-[var(--line)]
          flex items-center justify-center text-[10px] font-semibold text-[var(--ink-light)] select-none">
          +{restants}
        </span>
      )}
    </div>
  );
}

function GroupCard({ group, setsCount, fiche }: { group: Group; setsCount: number; fiche?: Fiche }) {
  const t = useTranslations('Groups');
  const color = groupColor(group.id || group.name);
  const initials = groupInitials(group.name);
  /*
   * Le compte vient de la fiche, qui réunit les grilles possédées et les grilles
   * liées. `linkedSheetIds.length` seul ignorait tout ce que le groupe possède :
   * un groupe annoncé à 5 grilles en montrait 15 sur sa page.
   *
   * Tant que la fiche n'est pas revenue, on montre l'ancien nombre plutôt qu'un
   * vide : il est incomplet, il n'est pas absurde.
   */
  const sheetCount = fiche?.grilles ?? group.linkedSheetIds.length;

  return (
    <Link
      href={`/groups/${group.id}`}
      className="flex items-stretch gap-5 p-4 sm:p-5 bg-[var(--cell-bg)] border border-[var(--line)] rounded-2xl hover:border-[var(--accent)] hover:shadow-md transition-all group"
    >
      {/* Photo du groupe, ou initiales colorées à défaut. Carrée et large : la
          plupart des musiciens n'ont qu'un ou deux groupes, autant les montrer. */}
      <div
        className="w-20 h-20 sm:w-28 sm:h-28 rounded-xl overflow-hidden flex items-center justify-center shrink-0 text-white font-semibold text-2xl sm:text-3xl select-none"
        style={{ backgroundColor: group.photoURL ? undefined : color }}
      >
        {group.photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={group.photoURL} alt="" className="w-full h-full object-cover" />
        ) : (
          initials
        )}
      </div>

      {/* Infos */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5">
        <h2 className="font-playfair text-lg sm:text-xl font-bold text-[var(--ink)] truncate group-hover:text-[var(--accent)] transition-colors">
          {group.name}
        </h2>
        {group.description && (
          <p className="text-sm text-[var(--ink-light)] line-clamp-2">{group.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--ink-faint)] mt-0.5">
          {fiche && <Visages membres={fiche.membres} total={group.memberIds.length} />}
          <span>{t('membersCount', { count: group.memberIds.length })}</span>
          <span aria-hidden>·</span>
          <span>{t('sheetsCount', { count: sheetCount })}</span>
          <span aria-hidden>·</span>
          <span>{t('setsCountShort', { count: setsCount })}</span>
        </div>
      </div>

      {/* Chevron */}
      <svg className="w-5 h-5 text-[var(--ink-faint)] shrink-0 self-center group-hover:text-[var(--accent)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
      </svg>
    </Link>
  );
}

/**
 * Argumentaire Pro, pour les comptes sans abonnement.
 *
 * Deux situations qui n'appellent pas le même discours, ni la même place sur la page.
 *
 * Un compte qui n'a aucun groupe voit l'argumentaire **avant** le vide : il tient
 * lieu d'état vide, et « passe à Pro pour jouer en groupe » est exact.
 *
 * Un compte invité dans un groupe, lui, joue déjà en groupe — la phrase serait
 * fausse, et l'argumentaire placé avant repousserait ses propres groupes vers le bas
 * comme s'il n'y avait pas droit. Il passe donc **après** la liste, et l'argument
 * devient celui qui lui manque vraiment : créer et mener son propre groupe.
 */
function ProUpsell({ dejaInvite = false }: { dejaInvite?: boolean }) {
  const t = useTranslations('Groups');
  const benefits = [
    { icon: '🎸', title: t('proBenefitGroupsTitle'), desc: t('proBenefitGroupsDesc') },
    { icon: '🎓', title: t('proBenefitTeacherTitle'), desc: t('proBenefitTeacherDesc') },
    { icon: '🔴', title: t('proBenefitLiveTitle'), desc: t('proBenefitLiveDesc') },
  ];
  return (
    <div className={`rounded-2xl border border-[var(--accent)]/30 bg-gradient-to-b from-[var(--accent-soft)] to-transparent p-6 sm:p-8 ${dejaInvite ? 'mt-10' : 'mb-8'}`}>
      <div className="text-center max-w-md mx-auto">
        <span className="inline-block text-xs font-semibold uppercase tracking-wider text-[var(--accent)] bg-[var(--accent-soft)] px-3 py-1 rounded-full">
          Pro
        </span>
        <h2 className="font-playfair text-xl sm:text-2xl font-bold text-[var(--ink)] mt-3">
          {t(dejaInvite ? 'proInvitedTitle' : 'proUpsellTitle')}
        </h2>
        <p className="text-sm text-[var(--ink-light)] mt-2">
          {t(dejaInvite ? 'proInvitedSubtitle' : 'proUpsellSubtitle')}
        </p>
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

      <p className="mt-5 max-w-md mx-auto flex items-center justify-center gap-1.5 text-center text-sm font-medium text-[var(--accent)]">
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        {t('proOneAccount')}
      </p>

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

export default function GroupsPage() {
  const t = useTranslations('Groups');
  const tSession = useTranslations('LiveSession');
  const { user } = useAuth();
  const { groups, loading } = useGroups();
  const { fiches } = useGroupCards(groups);
  const { sets } = useSets(user?.id);
  const userIsPro = isPro(user?.subscription);

  // Compte les sets par groupId côté client (pas de requête supplémentaire)
  const setsCountByGroup = sets.reduce<Record<string, number>>((acc, s) => {
    if (s.groupId) acc[s.groupId] = (acc[s.groupId] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h1 className="font-playfair text-2xl font-bold text-[var(--ink)]">{t('title')}</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/session"
            className="flex items-center gap-2 px-4 py-2 border border-[var(--line)] text-[var(--ink)] text-sm font-medium rounded-lg hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
            {tSession('liveSessionCta')}
          </Link>
          <Link
            href="/groups/new"
            className="px-4 py-2 bg-[var(--accent)] hover:bg-[#a83d25] text-white text-sm font-medium rounded-lg transition-colors"
          >
            {t('newGroup')}
          </Link>
        </div>
      </div>

      {/* Sans groupe : l'argumentaire tient lieu d'état vide, il passe avant. */}
      {!loading && !userIsPro && groups.length === 0 && <ProUpsell />}

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-20 bg-[var(--cell-bg)] border border-[var(--line)] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        // Non-Pro : l'argumentaire ci-dessus tient lieu d'état vide
        !userIsPro ? null : (
        <div className="text-center py-16 text-[var(--ink-faint)]">
          <div className="w-16 h-16 rounded-full bg-[var(--accent-soft)] flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
          </div>
          <p className="font-medium text-[var(--ink-light)]">{t('emptyTitle')}</p>
          <p className="text-sm mt-1">{t('emptyDesc')}</p>
          <Link
            href="/groups/new"
            className="inline-block mt-4 px-4 py-2 bg-[var(--accent)] hover:bg-[#a83d25] text-white text-sm font-medium rounded-lg transition-colors"
          >
            {t('createFirst')}
          </Link>
          <p className="text-xs mt-4">
            {tSession.rich('groupsEmptyHint', {
              link: (chunks) => <Link href="/session" className="text-[var(--accent)] hover:underline">{chunks}</Link>,
            })}
          </p>
        </div>
        )
      ) : (
        <div className="space-y-3">
          {groups.map(group => (
            <GroupCard
              key={group.id}
              group={group}
              setsCount={setsCountByGroup[group.id!] || 0}
              fiche={fiches[group.id!]}
            />
          ))}
        </div>
      )}

      {/* Invité dans un groupe sans être Pro : l'argumentaire vient après ses
          groupes, pas avant. Il joue déjà en groupe, ce qui lui manque c'est de
          pouvoir créer et mener le sien. */}
      {!loading && !userIsPro && groups.length > 0 && <ProUpsell dejaInvite />}
    </div>
  );
}
