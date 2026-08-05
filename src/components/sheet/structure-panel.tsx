'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { structureParDefaut } from '@/lib/sheet-structure';
import type { Section, StructureEntry } from '@/types';

/**
 * Établir l'ordre dans lequel le morceau s'enchaîne.
 *
 * Un morceau s'articule autour de quelques sections qui reviennent : couplet,
 * refrain, couplet, refrain, pont, refrain. Jusqu'ici il fallait recopier le
 * couplet trois fois, et corriger un accord signifiait le corriger trois fois —
 * un tiers des sections existantes sont ainsi des copies faites à la main.
 *
 * Ici on ne recopie rien : on dit l'ordre. Les sections restent uniques, et la
 * lecture comme l'affichage déroulent ce qu'on a dit.
 *
 * Le panneau s'ouvre pré-rempli avec les sections dans leur ordre actuel : on
 * corrige un ordre existant plutôt que de repartir d'une page blanche.
 */
export function StructurePanel({
  sections,
  structure,
  onChange,
  onClose,
}: {
  sections: Section[];
  structure?: StructureEntry[];
  onChange: (structure: StructureEntry[] | undefined) => void;
  onClose: () => void;
}) {
  const t = useTranslations('Structure');
  const [entrees, setEntrees] = useState<StructureEntry[]>(
    structure?.length ? structure : structureParDefaut(sections),
  );

  const parId = new Map(sections.map((s) => [s.id, s]));
  const modifier = (i: number, maj: Partial<StructureEntry>) =>
    setEntrees((e) => e.map((x, j) => (j === i ? { ...x, ...maj } : x)));
  const deplacer = (i: number, delta: number) =>
    setEntrees((e) => {
      const j = i + delta;
      if (j < 0 || j >= e.length) return e;
      const copie = [...e];
      [copie[i], copie[j]] = [copie[j], copie[i]];
      return copie;
    });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 print:hidden" onClick={onClose}>
      <div
        className="w-full sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border p-5 flex flex-col gap-4"
        style={{ background: 'var(--paper)', borderColor: 'var(--line)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex flex-col gap-1">
          <h2 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>{t('title')}</h2>
          <p className="text-sm" style={{ color: 'var(--ink-light)' }}>{t('intro')}</p>
        </header>

        <ol className="flex flex-col gap-2">
          {entrees.map((entree, i) => {
            const section = parId.get(entree.sectionId);
            return (
              <li
                key={`${entree.sectionId}-${i}`}
                className="flex items-center gap-2 p-2 rounded-lg border"
                style={{ background: 'var(--cell-bg)', borderColor: 'var(--line)' }}
              >
                <span className="w-5 text-xs tabular-nums" style={{ color: 'var(--ink-faint)' }}>{i + 1}</span>

                <select
                  value={entree.sectionId}
                  onChange={(e) => modifier(i, { sectionId: e.target.value })}
                  className="flex-1 min-w-0 bg-transparent text-sm font-medium outline-none"
                  style={{ color: 'var(--ink)' }}
                  aria-label={t('whichSection')}
                >
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>{s.label || t('untitled')}</option>
                  ))}
                </select>

                {!section && (
                  <span className="text-xs" style={{ color: 'var(--accent)' }}>{t('missing')}</span>
                )}

                <label className="flex items-center gap-1 text-xs" style={{ color: 'var(--ink-light)' }}>
                  ×
                  <input
                    type="number" min={1} max={16} value={entree.repeat}
                    onChange={(e) => modifier(i, { repeat: Math.max(1, Number(e.target.value) || 1) })}
                    className="w-12 px-1 py-0.5 rounded border bg-transparent text-center tabular-nums"
                    style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}
                    aria-label={t('howManyTimes')}
                  />
                </label>

                <div className="flex">
                  <button type="button" onClick={() => deplacer(i, -1)} disabled={i === 0}
                    className="px-1.5 py-1 text-sm disabled:opacity-30" style={{ color: 'var(--ink-light)' }}
                    aria-label={t('moveUp')}>↑</button>
                  <button type="button" onClick={() => deplacer(i, 1)} disabled={i === entrees.length - 1}
                    className="px-1.5 py-1 text-sm disabled:opacity-30" style={{ color: 'var(--ink-light)' }}
                    aria-label={t('moveDown')}>↓</button>
                  <button type="button" onClick={() => setEntrees((e) => e.filter((_, j) => j !== i))}
                    className="px-1.5 py-1 text-sm" style={{ color: 'var(--ink-light)' }}
                    aria-label={t('remove')}>×</button>
                </div>
              </li>
            );
          })}
        </ol>

        {sections.length > 0 && (
          <button
            type="button"
            onClick={() => setEntrees((e) => [...e, { sectionId: sections[0].id, repeat: 1 }])}
            className="py-2 rounded-lg border border-dashed text-sm"
            style={{ borderColor: 'var(--line)', color: 'var(--ink-light)' }}
          >
            {t('addPassage')}
          </button>
        )}

        <footer className="flex flex-wrap items-center gap-2 pt-1">
          <Button onClick={() => { onChange(entrees); onClose(); }}>{t('apply')}</Button>
          <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
          {/* Revenir à l'ordre simple des sections, sans structure : la grille
              retrouve exactement le comportement qu'elle avait avant. */}
          <Button variant="ghost" onClick={() => { onChange(undefined); onClose(); }}>{t('clear')}</Button>
        </footer>
      </div>
    </div>
  );
}
