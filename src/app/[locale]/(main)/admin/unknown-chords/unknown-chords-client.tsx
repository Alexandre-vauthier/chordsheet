'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { getAuth } from 'firebase/auth';
import { useAuth } from '@/lib/auth-context';
import { useInstrumentLabel } from '@/lib/use-genre-labels';
import { Link } from '@/i18n/navigation';

interface Usage {
  sheetId: string;
  title: string;
  artist: string;
  ownerId: string;
  ownerName: string;
  isPublic: boolean;
  instrument: string;
}

interface Manquant {
  chord: string;
  missingOn: string[];
  usages: Usage[];
}

interface Reponse {
  rows: Manquant[];
  scanned: number;
  withoutIndex: number;
  distinctChords: number;
  occurrences: number;
  /** Nombre d'instruments contrôlés, rendu par le serveur plutôt que recopié ici. */
  instrumentsChecked: number;
}

/**
 * Les accords écrits dans les grilles que la bibliothèque ne sait pas dessiner.
 *
 * Le tableau nomme la grille **et son auteur** : un accord seul ne dit pas s'il faut
 * l'ajouter à la bibliothèque ou s'il s'agit d'une faute de frappe. Voir dans quelle
 * grille il apparaît le dit, et pouvoir écrire à son auteur permet de trancher les
 * cas douteux.
 *
 * Les accords les plus employés remontent en tête : c'est celui qui revient dans dix
 * grilles qui vaut d'être ajouté, pas la coquille isolée.
 */
export function UnknownChordsClient() {
  const t = useTranslations('AdminUnknownChords');
  const { isAdmin, loading } = useAuth();
  const instrumentLabel = useInstrumentLabel();
  const [data, setData] = useState<Reponse | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState('');

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur('');
    try {
      const token = await getAuth().currentUser?.getIdToken();
      const res = await fetch('/api/admin/unknown-chords', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(String(res.status));
      setData(await res.json());
    } catch {
      setErreur(t('loadError'));
    } finally {
      setChargement(false);
    }
  }, [t]);

  useEffect(() => { if (isAdmin) charger(); }, [isAdmin, charger]);

  if (loading) return null;
  if (!isAdmin) {
    return <div className="max-w-4xl mx-auto px-4 py-16 text-center text-[var(--ink-faint)]">{t('forbidden')}</div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <Link href="/admin" className="text-xs text-[var(--ink-faint)] hover:text-[var(--accent)] transition-colors">
        ← {t('backToAdmin')}
      </Link>

      <h1 className="font-playfair text-2xl font-bold text-[var(--ink)] mt-3">{t('title')}</h1>
      <p className="text-sm text-[var(--ink-light)] mt-1 leading-relaxed max-w-2xl">{t('intro')}</p>

      <div className="flex items-center gap-4 mt-5">
        <button
          onClick={charger}
          disabled={chargement}
          className="px-4 py-2 rounded-lg bg-[var(--accent)] hover:bg-[#a83d25] text-white text-sm
            transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default"
        >
          {chargement ? t('scanning') : t('rescan')}
        </button>
        {data && (
          <p className="text-xs text-[var(--ink-faint)]">
            {t('summary', {
              scanned: data.scanned,
              distinct: data.distinctChords,
              rows: data.occurrences,
            })}
            {/* Une grille sans champ `chords` date d'avant l'index : elle n'a pas pu
                être contrôlée. Le dire, plutôt que laisser croire à une couverture
                complète. */}
            {data.withoutIndex > 0 && ` · ${t('withoutIndex', { count: data.withoutIndex })}`}
          </p>
        )}
      </div>

      {erreur && <p className="mt-4 text-sm text-red-600">{erreur}</p>}

      {data && data.rows.length === 0 && !chargement && (
        <p className="mt-8 text-sm text-[var(--ink-light)]">{t('empty')}</p>
      )}

      {data && data.rows.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-xl border border-[var(--line)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--cell-bg)] text-left text-xs uppercase tracking-wider text-[var(--ink-faint)]">
                <th className="px-4 py-3 font-medium">{t('colChord')}</th>
                <th className="px-4 py-3 font-medium">{t('colMissingOn')}</th>
                <th className="px-4 py-3 font-medium">{t('colSheets')}</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((m) => (
                <tr key={m.chord} className="border-t border-[var(--line)] align-top">
                  <td className="px-4 py-3 font-mono font-medium text-[var(--ink)] whitespace-nowrap">{m.chord}</td>

                  {/* Tous les instruments qui ne savent pas le dessiner, pas seulement
                      celui de la grille : c'est ce qui dit le travail que represente
                      l'ajout. Vide signifie que la bibliotheque le connait partout. */}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {m.missingOn.length === 0 ? (
                        <span className="text-xs text-[var(--ink-faint)]">{t('missingNowhere')}</span>
                      ) : m.missingOn.map((i) => (
                        <span key={i} className="px-2 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] text-[11px]">
                          {instrumentLabel(i)}
                        </span>
                      ))}
                    </div>
                    <p className="mt-1 text-[11px] text-[var(--ink-faint)]">
                      {t('missingCount', { count: m.missingOn.length, total: data.instrumentsChecked })}
                    </p>
                  </td>

                  <td className="px-4 py-3">
                    <ul className="space-y-1.5">
                      {m.usages.map((u) => (
                        <li key={u.sheetId} className="leading-snug">
                          <Link href={`/sheet/${u.sheetId}`} className="text-[var(--accent)] hover:underline">
                            {u.title || t('untitled')}
                          </Link>
                          {u.artist && <span className="text-[var(--ink-faint)]"> · {u.artist}</span>}
                          <span className="text-[var(--ink-faint)] text-xs">
                            {' — '}
                            {u.ownerId ? (
                              <Link href={`/user/${u.ownerId}`} className="hover:text-[var(--accent)] transition-colors">
                                {u.ownerName || t('unknownAuthor')}
                              </Link>
                            ) : (u.ownerName || t('unknownAuthor'))}
                            {` · ${instrumentLabel(u.instrument)} · ${u.isPublic ? t('public') : t('private')}`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
