'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { forkSheetToGroup } from '@/lib/fork-to-group';
import { useTranslations } from 'next-intl';
import { doc, updateDoc, deleteField, serverTimestamp, deleteDoc, getDoc } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import { fromFirestore } from '@/lib/firestore-helpers';
import { useAuth } from '@/lib/auth-context';
import { useSets } from '@/lib/use-sets';
import { useGroups } from '@/lib/use-groups';
import type { Sheet } from '@/types';

type Tab = 'set' | 'group';

interface Props {
  sheet: Sheet;
  initialTab?: Tab;
  onClose: () => void;
}

export function AddToCollectionModal({ sheet, initialTab = 'set', onClose }: Props) {
  const t = useTranslations('AddToCollection');
  const { user } = useAuth();
  const { sets, addSheetToSet, removeSheetFromSet, createSet } = useSets(user?.id);
  const { groups, unlinkSheet } = useGroups();
  // Copies de groupe créées dans cette session (groupId -> id de la copie), pour
  // pouvoir les supprimer si on détache juste après.
  const forkedCopiesRef = useRef<Record<string, string>>({});

  // Le provider n'ouvre la modale que pour une grille persistée.
  const sheetId = sheet.id!;

  const [tab, setTab] = useState<Tab>(initialTab);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newSetName, setNewSetName] = useState('');
  const [creating, setCreating] = useState(false);

  // Surcharges locales pour un retour visuel immédiat (l'appartenance d'une
  // grille possédée à un groupe repose sur son champ groupId, non re-lu ici).
  const [setOverrides, setSetOverrides] = useState<Record<string, boolean>>({});
  const [groupOverrides, setGroupOverrides] = useState<Record<string, boolean>>({});

  // Fermeture au clavier
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isInSet = (setId: string, sheetIds: string[]) =>
    setOverrides[setId] ?? sheetIds.includes(sheetId);

  const isInGroup = (groupId: string, linkedSheetIds: string[]) =>
    groupOverrides[groupId] ?? (linkedSheetIds.includes(sheetId) || sheet.groupId === groupId);

  const groupNameById = useMemo(
    () => Object.fromEntries(groups.map(g => [g.id, g.name])) as Record<string, string>,
    [groups],
  );

  // Les sets appartenant à un groupe remontent en haut de la liste.
  const filteredSets = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? sets.filter(s => s.name.toLowerCase().includes(q)) : sets;
    return [...list.filter(s => s.groupId), ...list.filter(s => !s.groupId)];
  }, [sets, search]);

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? groups.filter(g => g.name.toLowerCase().includes(q)) : groups;
  }, [groups, search]);

  // Sets regroupés par groupe (en-tête unique) + sets perso.
  const setsByGroup = useMemo(() => {
    const acc: Record<string, typeof filteredSets> = {};
    for (const s of filteredSets) if (s.groupId) (acc[s.groupId] ??= []).push(s);
    return acc;
  }, [filteredSets]);
  const personalSets = filteredSets.filter(s => !s.groupId);
  const hasGroupSets = Object.keys(setsByGroup).length > 0;

  // La grille est-elle déjà quelque part ? (indicateur sur les onglets)
  const inAnySet = sets.some(s => isInSet(s.id!, s.sheetIds));
  const inAnyGroup = groups.some(g => isInGroup(g.id!, g.linkedSheetIds));

  const renderSetItem = (s: (typeof sets)[number]) => {
    const member = isInSet(s.id!, s.sheetIds);
    return (
      <li key={s.id}>
        <button
          onClick={() => toggleSet(s.id!, member)}
          disabled={busy === s.id}
          className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm text-[var(--ink)] transition-colors disabled:opacity-50 ${member ? 'bg-[var(--accent-soft)]' : 'hover:bg-[var(--accent-soft)]'}`}
        >
          <span className="truncate">{s.name}</span>
          <span className={`shrink-0 text-sm font-semibold ${member ? 'text-[var(--accent)]' : 'text-[var(--ink-faint)]'}`}>
            {busy === s.id ? '…' : member ? '✓' : '+'}
          </span>
        </button>
      </li>
    );
  };

  const toggleSet = async (setId: string, member: boolean) => {
    setBusy(setId);
    setError(null);
    try {
      if (member) await removeSheetFromSet(setId, sheetId);
      else await addSheetToSet(setId, sheetId);
      setSetOverrides(prev => ({ ...prev, [setId]: !member }));
    } catch {
      setError(t('error'));
    } finally {
      setBusy(null);
    }
  };

  /**
   * Copie la grille dans le groupe, par la règle partagée.
   *
   * Cette fenêtre avait sa propre version : la copie y naissait au nom de la
   * personne et toujours privée, y compris dans un groupe public. Rattacher depuis
   * ici et depuis la page du groupe ne produisait donc pas la même chose.
   */
  const forkToGroup = async (group: { id?: string; name: string; isPublic?: boolean }): Promise<string> => {
    const db = getDb();
    // On repart du document source complet (le prop `sheet` peut être allégé).
    const snap = await getDoc(doc(db, 'sheets', sheetId));
    if (!snap.exists()) throw new Error('source introuvable');
    const full = fromFirestore(snap.id, snap.data());
    const { id } = await forkSheetToGroup(full, group as Parameters<typeof forkSheetToGroup>[1], user!.id);
    return id;
  };

  const toggleGroup = async (groupId: string, member: boolean) => {
    if (!user) return;
    setBusy(groupId);
    setError(null);
    try {
      if (member) {
        // Détacher : supprimer la copie créée ici, sinon nettoyer un ancien état.
        const copyId = forkedCopiesRef.current[groupId];
        if (copyId) {
          await deleteDoc(doc(getDb(), 'sheets', copyId));
          delete forkedCopiesRef.current[groupId];
        } else if (sheet.ownerId === user.id && sheet.groupId === groupId) {
          // Ancien état (groupId posé sur l'originale) : on le retire.
          await updateDoc(doc(getDb(), 'sheets', sheetId), { groupId: deleteField(), updatedAt: serverTimestamp() });
        } else {
          await unlinkSheet(groupId, sheetId); // ancien lien en lecture seule
        }
      } else {
        // Ajouter = créer une copie du groupe (indépendante).
        const groupe = groups.find(g => g.id === groupId);
        if (!groupe) throw new Error('groupe introuvable');
        const copyId = await forkToGroup(groupe);
        forkedCopiesRef.current[groupId] = copyId;
      }
      setGroupOverrides(prev => ({ ...prev, [groupId]: !member }));
    } catch {
      setError(t('error'));
    } finally {
      setBusy(null);
    }
  };

  const handleCreateSet = async () => {
    const name = newSetName.trim();
    if (!name || !user) return;
    setCreating(true);
    setError(null);
    try {
      await createSet({
        name,
        ownerId: user.id,
        ownerName: user.displayName,
        sheetIds: [sheetId],
        isPublic: false,
      });
      setNewSetName('');
    } catch {
      setError(t('error'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[var(--cream)] border border-[var(--line)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="px-4 pt-4 pb-3 border-b border-[var(--line)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-bold text-[var(--ink)] truncate">{t('title')}</h2>
              <p className="text-xs text-[var(--ink-light)] truncate mt-0.5">
                {sheet.title || t('untitled')}
              </p>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 w-7 h-7 rounded-full text-[var(--ink-light)] hover:bg-[var(--line)] hover:text-[var(--ink)] transition-colors flex items-center justify-center"
              title={t('close')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Onglets */}
          <div className="flex gap-1 mt-3 p-0.5 bg-[var(--cell-bg)] rounded-lg">
            {(['set', 'group'] as Tab[]).map(v => {
              const active = v === 'set' ? inAnySet : inAnyGroup;
              return (
                <button
                  key={v}
                  onClick={() => { setTab(v); setSearch(''); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-1.5 rounded-md transition-colors ${
                    tab === v
                      ? 'bg-[var(--accent-soft)] text-[var(--accent)] shadow-sm'
                      : 'text-[var(--ink-light)] hover:text-[var(--ink)]'
                  }`}
                >
                  {v === 'set' ? t('tabSet') : t('tabGroup')}
                  {active && <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" title={t('alreadyIn')} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Recherche */}
        <div className="px-4 pt-3">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={tab === 'set' ? t('searchSet') : t('searchGroup')}
            className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--cell-bg)] border border-[var(--line)] text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        {error && (
          <p className="px-4 pt-2 text-xs text-red-500">{error}</p>
        )}

        {/* Liste */}
        <div className="flex-1 overflow-y-auto px-4 py-3 min-h-[120px]">
          {tab === 'set' ? (
            filteredSets.length === 0 ? (
              <p className="text-sm text-[var(--ink-faint)] text-center py-6">{t('noSet')}</p>
            ) : (
              <div className="space-y-4">
                {/* Sets de groupe, regroupés sous le nom du groupe */}
                {Object.entries(setsByGroup).map(([gid, list]) => (
                  <div key={gid}>
                    <div className="flex items-center gap-1.5 px-1 mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--accent)]">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M13 8a3 3 0 10-2.83-2H9.83A3 3 0 107 8a3 3 0 00-3 3v3h12v-3a3 3 0 00-3-3z" /></svg>
                      {groupNameById[gid] ?? t('groupBadge')}
                    </div>
                    <ul className="space-y-1">{list.map(renderSetItem)}</ul>
                  </div>
                ))}
                {/* Sets perso */}
                {personalSets.length > 0 && (
                  <div>
                    {hasGroupSets && (
                      <div className="px-1 mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">{t('mySets')}</div>
                    )}
                    <ul className="space-y-1">{personalSets.map(renderSetItem)}</ul>
                  </div>
                )}
              </div>
            )
          ) : (
            filteredGroups.length === 0 ? (
              <p className="text-sm text-[var(--ink-faint)] text-center py-6">{t('noGroup')}</p>
            ) : (
              <ul className="space-y-1">
                {filteredGroups.map(g => {
                  const member = isInGroup(g.id!, g.linkedSheetIds);
                  return (
                    <li key={g.id}>
                      <button
                        onClick={() => toggleGroup(g.id!, member)}
                        disabled={busy === g.id}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm text-[var(--ink)] transition-colors disabled:opacity-50 ${member ? 'bg-[var(--accent-soft)]' : 'hover:bg-[var(--accent-soft)]'}`}
                      >
                        <span className="truncate">{g.name}</span>
                        <span className={`shrink-0 text-sm font-semibold ${member ? 'text-[var(--accent)]' : 'text-[var(--ink-faint)]'}`}>
                          {busy === g.id ? '…' : member ? '✓' : '+'}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )
          )}
        </div>

        {/* Créer un set (onglet set uniquement) */}
        {tab === 'set' && (
          <div className="px-4 py-3 border-t border-[var(--line)] flex gap-2">
            <input
              type="text"
              value={newSetName}
              onChange={e => setNewSetName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateSet(); }}
              placeholder={t('newSetPlaceholder')}
              className="flex-1 px-3 py-2 text-sm rounded-lg bg-[var(--cell-bg)] border border-[var(--line)] text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:outline-none focus:border-[var(--accent)]"
            />
            <button
              onClick={handleCreateSet}
              disabled={!newSetName.trim() || creating}
              className="shrink-0 px-3 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {creating ? '…' : t('create')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
