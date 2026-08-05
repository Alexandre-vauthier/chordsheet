'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { deroulerStructure, structureParDefaut } from '@/lib/sheet-structure';
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
  // Le glisser-déposer HTML5 ne part que de la poignée : sans cela, un cliqué-glissé
  // dans le champ du nombre de passages déplacerait la ligne au lieu de sélectionner.
  const [poignee, setPoignee] = useState(false);
  const [tire, setTire] = useState<number | null>(null);
  const [survole, setSurvole] = useState<number | null>(null);

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
  const reordonner = (depuis: number, vers: number) =>
    setEntrees((e) => {
      if (depuis === vers) return e;
      const copie = [...e];
      const [ligne] = copie.splice(depuis, 1);
      copie.splice(vers, 0, ligne);
      return copie;
    });

  // Une ligne qu'on vient d'ajouter n'a pas de section : c'est le menu déroulant
  // qui demande laquelle. Elle ne part pas dans la structure tant qu'on n'a pas
  // répondu, plutôt que d'y entrer comme un passage fantôme.
  const retenues = entrees.filter((e) => e.sectionId);
  const apercu = deroulerStructure(sections, retenues);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 print:hidden" onClick={onClose}>
      <div
        className="w-full sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border p-5 flex flex-col gap-4 shadow-2xl"
        style={{ background: 'var(--cream)', borderColor: 'var(--line)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex flex-col gap-1">
          <h2 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>{t('title')}</h2>
          <p className="text-sm" style={{ color: 'var(--ink-light)' }}>{t('intro')}</p>
        </header>

        <ol className="flex flex-col gap-2">
          {entrees.map((entree, i) => {
            const connue = !entree.sectionId || parId.has(entree.sectionId);
            return (
              <li
                key={`${entree.sectionId}-${i}`}
                draggable={poignee}
                onDragStart={() => setTire(i)}
                onDragEnd={() => { setTire(null); setSurvole(null); setPoignee(false); }}
                onDragOver={(e) => { e.preventDefault(); setSurvole(i); }}
                onDrop={(e) => { e.preventDefault(); if (tire !== null) reordonner(tire, i); }}
                className={`flex items-center gap-2 p-2 rounded-lg border transition-opacity ${tire === i ? 'opacity-40' : ''}`}
                style={{
                  background: 'var(--cell-bg)',
                  borderColor: survole === i && tire !== null && tire !== i ? 'var(--accent)' : 'var(--line)',
                }}
              >
                <span
                  onMouseDown={() => setPoignee(true)}
                  onMouseUp={() => setPoignee(false)}
                  onTouchStart={() => setPoignee(true)}
                  className="cursor-grab active:cursor-grabbing select-none px-0.5 text-sm leading-none"
                  style={{ color: 'var(--ink-faint)' }}
                  aria-label={t('reorder')}
                  title={t('reorder')}
                >
                  ⠿
                </span>
                <span className="w-4 text-xs tabular-nums" style={{ color: 'var(--ink-faint)' }}>{i + 1}</span>

                <div className="relative flex-1 min-w-0">
                  <select
                    value={entree.sectionId}
                    onChange={(e) => modifier(i, { sectionId: e.target.value })}
                    className="w-full appearance-none rounded-md border pl-2.5 pr-7 py-1.5 text-sm font-medium outline-none cursor-pointer focus:border-[var(--accent)] transition-colors"
                    style={{
                      background: 'var(--cream)',
                      borderColor: 'var(--line)',
                      color: entree.sectionId ? 'var(--ink)' : 'var(--accent)',
                    }}
                    aria-label={t('whichSection')}
                  >
                    {!entree.sectionId && <option value="">{t('chooseSection')}</option>}
                    {sections.map((s) => (
                      <option key={s.id} value={s.id}>{s.label || t('untitled')}</option>
                    ))}
                  </select>
                  <span
                    className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px]"
                    style={{ color: 'var(--ink-faint)' }}
                  >
                    ▼
                  </span>
                </div>

                {!connue && (
                  <span className="text-xs" style={{ color: 'var(--accent)' }}>{t('missing')}</span>
                )}

                <label className="flex items-center gap-1 text-xs" style={{ color: 'var(--ink-light)' }}>
                  ×
                  <input
                    type="number" min={1} max={16} value={entree.repeat}
                    onChange={(e) => modifier(i, { repeat: Math.max(1, Number(e.target.value) || 1) })}
                    className="w-12 px-1 py-1 rounded-md border text-center tabular-nums"
                    style={{ background: 'var(--cream)', borderColor: 'var(--line)', color: 'var(--ink)' }}
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
            onClick={() => setEntrees((e) => [...e, { sectionId: '', repeat: 1 }])}
            className="py-2 rounded-lg border border-dashed text-sm font-medium transition-colors hover:bg-[var(--accent-soft)]"
            style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
          >
            {t('addPassage')}
          </button>
        )}

        {/* Le morceau tel qu'il se lira, mis à jour à chaque changement. Sans lui,
            on déclare un ordre sans jamais voir ce qu'il donne : le panneau dit
            « Couplet, Refrain, Couplet », l'écran dira des mesures. */}
        {apercu.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--ink-faint)' }}>
              {t('preview')}
            </h3>
            <div className="flex flex-col gap-2 rounded-lg border p-3" style={{ background: 'var(--cell-bg)', borderColor: 'var(--line)' }}>
              {apercu.map((bloc, i) => (
                <div key={i} className="flex flex-col gap-0.5">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                      {bloc.section.label || t('untitled')}
                    </span>
                    {bloc.repeat > 1 && (
                      <span className="text-[10px] font-semibold" style={{ color: 'var(--accent)' }}>×{bloc.repeat}</span>
                    )}
                  </div>
                  {bloc.section.rows.map((row, r) => (
                    <div key={r} className="text-xs font-mono truncate" style={{ color: 'var(--ink-light)' }}>
                      {row.map((cell) => cell.chord || '·').join(' | ')}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>
        )}

        <footer className="flex flex-wrap items-center gap-2 pt-1">
          <Button onClick={() => { onChange(retenues); onClose(); }}>{t('apply')}</Button>
          <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
          {/* Revenir à l'ordre simple des sections, sans structure : la grille
              retrouve exactement le comportement qu'elle avait avant. */}
          <Button variant="ghost" onClick={() => { onChange(undefined); onClose(); }}>{t('clear')}</Button>
        </footer>
      </div>
    </div>
  );
}
