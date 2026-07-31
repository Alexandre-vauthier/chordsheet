'use client';

import { useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import type { UserWithStats } from '@/types';
import { Link } from '@/i18n/navigation';

type SortKey =
  | 'displayName' | 'email' | 'role'
  | 'sheetsCount' | 'setsCount' | 'bookmarksCount' | 'groupsCount'
  | 'createdAt' | 'lastVisitAt';

type SortDir = 'asc' | 'desc';

/**
 * Fenêtres de filtrage sur la dernière visite. Les valeurs numériques sont un
 * nombre de jours ("vu dans les N derniers jours") ; `inactive` prend le
 * complément (une visite connue, mais rien depuis 90 jours) et `never` les
 * comptes qui ne sont jamais revenus depuis leur inscription.
 */
const VISIT_FILTERS = ['all', '7', '30', '90', 'inactive', 'never'] as const;
type VisitFilter = (typeof VISIT_FILTERS)[number];

const INACTIVE_AFTER_DAYS = 90;
const DAY_MS = 86_400_000;

const COLUMNS: { key: SortKey; labelKey: string; align?: 'center' }[] = [
  { key: 'displayName',    labelKey: 'colUser' },
  { key: 'email',          labelKey: 'colEmail' },
  { key: 'role',           labelKey: 'colRole',      align: 'center' },
  { key: 'sheetsCount',    labelKey: 'colSheets',    align: 'center' },
  { key: 'setsCount',      labelKey: 'colSets',      align: 'center' },
  { key: 'bookmarksCount', labelKey: 'colBook',      align: 'center' },
  { key: 'groupsCount',    labelKey: 'colGroups',    align: 'center' },
  { key: 'createdAt',      labelKey: 'colJoined' },
  { key: 'lastVisitAt',    labelKey: 'colLastVisit' },
];

function matchesVisit(lastVisitAt: Date | null, filter: VisitFilter, now: number) {
  if (filter === 'all') return true;
  if (filter === 'never') return lastVisitAt === null;
  if (lastVisitAt === null) return false;

  const ageDays = (now - lastVisitAt.getTime()) / DAY_MS;
  return filter === 'inactive' ? ageDays > INACTIVE_AFTER_DAYS : ageDays <= Number(filter);
}

function compareUsers(a: UserWithStats, b: UserWithStats, key: SortKey, dir: SortDir) {
  // Les comptes sans visite connue restent en bas quel que soit le sens du tri :
  // une absence de date n'est pas une date très ancienne.
  if (key === 'lastVisitAt') {
    if (a.lastVisitAt === null && b.lastVisitAt === null) return 0;
    if (a.lastVisitAt === null) return 1;
    if (b.lastVisitAt === null) return -1;
  }

  const sign = dir === 'asc' ? 1 : -1;
  const av = a[key];
  const bv = b[key];

  if (av instanceof Date && bv instanceof Date) return sign * (av.getTime() - bv.getTime());
  if (typeof av === 'number' && typeof bv === 'number') return sign * (av - bv);
  return sign * String(av ?? '').localeCompare(String(bv ?? ''), undefined, { sensitivity: 'base' });
}

// Défini au niveau module : un composant créé pendant le rendu remonterait son
// état à chaque passe (règle react-hooks/static-components).
function SortableTh({
  label, ariaLabel, active, dir, align, onSort,
}: {
  label: string;
  ariaLabel: string;
  active: boolean;
  dir: SortDir;
  align?: 'center';
  onSort: () => void;
}) {
  // Classes littérales : Tailwind les extrait statiquement, un `text-${align}`
  // construit à la volée ne serait jamais généré dans la feuille de styles.
  return (
    <th className={`py-2 px-3 font-medium text-[var(--ink-light)] ${align === 'center' ? 'text-center' : 'text-left'}`}>
      <button
        type="button"
        onClick={onSort}
        aria-label={ariaLabel}
        className={`inline-flex items-center gap-1 hover:text-[var(--accent)] transition-colors ${active ? 'text-[var(--ink)]' : ''}`}
      >
        {label}
        <span aria-hidden className={`text-[10px] leading-none ${active ? 'opacity-100' : 'opacity-25'}`}>
          {active && dir === 'asc' ? '▲' : '▼'}
        </span>
      </button>
    </th>
  );
}

export function AdminUsersTable({ users }: { users: UserWithStats[] }) {
  const t = useTranslations('Admin');
  const locale = useLocale();

  const [search, setSearch] = useState('');
  const [visitFilter, setVisitFilter] = useState<VisitFilter>('all');
  // Tri par défaut sur la dernière visite : c'est la lecture la plus utile de ce
  // tableau (qui est revenu récemment, qui a décroché).
  const [sortKey, setSortKey] = useState<SortKey>('lastVisitAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // L'horodatage de référence est figé une fois pour toutes via l'initialiseur
  // paresseux, plutôt que relu à chaque rendu (qui doit rester pur, et dont le
  // résultat serait instable). Une granularité au jour rend l'écart sans effet.
  const [now] = useState(() => Date.now());

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return users
      .filter(u => matchesVisit(u.lastVisitAt, visitFilter, now))
      .filter(u =>
        !needle ||
        u.displayName?.toLowerCase().includes(needle) ||
        u.email?.toLowerCase().includes(needle)
      )
      .sort((a, b) => compareUsers(a, b, sortKey, sortDir));
  }, [users, search, visitFilter, sortKey, sortDir, now]);

  // Un clic sur la colonne déjà active inverse le sens ; sur une autre colonne on
  // repart en descendant, le plus parlant pour des dates et des compteurs.
  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const dateFormat = locale === 'en' ? 'en-US' : 'fr-FR';

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="flex-1 min-w-[200px] px-3 py-2 rounded-lg border border-[var(--line)] bg-[var(--paper)] text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:outline-none focus:border-[var(--accent)]"
        />

        <label className="flex items-center gap-2 text-sm text-[var(--ink-light)]">
          {t('colLastVisit')}
          <select
            value={visitFilter}
            onChange={e => setVisitFilter(e.target.value as VisitFilter)}
            className="px-3 py-2 rounded-lg border border-[var(--line)] bg-[var(--paper)] text-sm text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]"
          >
            {VISIT_FILTERS.map(f => (
              <option key={f} value={f}>{t(`visitFilter_${f}`)}</option>
            ))}
          </select>
        </label>

        <span className="text-sm text-[var(--ink-faint)] whitespace-nowrap">
          {t('resultCount', { filtered: rows.length, total: users.length })}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--line)]">
              {COLUMNS.map(c => {
                const label = t(c.labelKey);
                return (
                  <SortableTh
                    key={c.key}
                    label={label}
                    ariaLabel={t('sortBy', { column: label })}
                    active={sortKey === c.key}
                    dir={sortDir}
                    align={c.align}
                    onSort={() => toggleSort(c.key)}
                  />
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="py-8 text-center text-[var(--ink-faint)]">
                  {t('noUsersMatch')}
                </td>
              </tr>
            )}
            {rows.map(u => (
              <tr key={u.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--cell-hover)]">
                <td className="py-3 px-3">
                  <Link href={`/user/${u.id}`} className="flex items-center gap-2 group/user">
                    {u.photoURL ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={u.photoURL} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-xs font-bold">
                        {u.displayName?.charAt(0).toUpperCase() || u.email?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="font-medium text-[var(--ink)] group-hover/user:text-[var(--accent)] transition-colors">
                      {u.displayName || '-'}
                    </span>
                  </Link>
                </td>
                <td className="py-3 px-3 text-[var(--ink-light)]">{u.email}</td>
                <td className="py-3 px-3 text-center">
                  {u.role === 'admin' ? (
                    <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">{t('roleAdmin')}</span>
                  ) : (
                    <span className="px-2 py-0.5 bg-[var(--line)] text-gray-600 rounded text-xs">{t('roleUser')}</span>
                  )}
                </td>
                <td className="py-3 px-3 text-center font-mono">{u.sheetsCount}</td>
                <td className="py-3 px-3 text-center font-mono">{u.setsCount}</td>
                <td className="py-3 px-3 text-center font-mono">{u.bookmarksCount}</td>
                <td className="py-3 px-3 text-center font-mono">{u.groupsCount}</td>
                <td className="py-3 px-3 text-[var(--ink-light)]">
                  {u.createdAt.toLocaleDateString(dateFormat)}
                </td>
                <td className="py-3 px-3 text-[var(--ink-light)]">
                  {u.lastVisitAt
                    ? u.lastVisitAt.toLocaleDateString(dateFormat)
                    : <span className="text-[var(--ink-faint)]">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
