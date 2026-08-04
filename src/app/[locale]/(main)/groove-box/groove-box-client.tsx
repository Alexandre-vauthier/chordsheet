'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ensureAudioContext } from '@/lib/chord-audio';
import { PATTERN_DEFS, VOICE_INFO, VOICES, frapperVoix, kitCharge, type Voice } from '@/lib/use-groove-box';
import { KITS, chargerKit, choisirKit, restaurerKit, voixDisponibles } from '@/lib/drum-kits';

/**
 * Banc d'essai de la boîte à rythme.
 *
 * On ne voyait pas ce qu'elle contient : quinze voix, dont certaines ne servent
 * que dans un motif ou deux, et rien ne le disait. Cette page les met à plat et
 * les rend frappables, par le même chemin que la lecture d'une grille — mêmes
 * échantillons, même compresseur, même repli sur la synthèse tant que le kit
 * charge. Ce qu'on entend ici est ce qu'on entendra dans un morceau.
 */

const LIBELLE: Record<Voice, string> = {
  kick: 'Grosse caisse',
  snare: 'Caisse claire',
  snareGhost: 'Caisse claire (fantôme)',
  hihatClosed: 'Charleston fermé',
  hihatOpen: 'Charleston ouvert',
  ride: 'Ride',
  rimshot: 'Rimshot',
  clap: 'Clap',
  cowbell: 'Cloche',
  tomHigh: 'Tom aigu',
  tomLow: 'Tom grave',
  congaHigh: 'Conga aiguë',
  congaLow: 'Conga grave',
  crash: 'Crash',
  tambourine: 'Tambourin',
};

/** Touches du clavier, dans l'ordre des voix : trois rangées de cinq. */
const TOUCHES = ['a', 'z', 'e', 'r', 't', 'q', 's', 'd', 'f', 'g', 'w', 'x', 'c', 'v', 'b'];

/** Dans combien de motifs chaque voix intervient. */
const USAGES: Record<string, string[]> = {};
for (const voix of VOICES) {
  USAGES[voix] = PATTERN_DEFS.filter((p) => (p.pattern as Record<string, number[]>)[voix]?.length).map((p) => p.label);
}

export function GrooveBoxClient() {
  const [actif, setActif] = useState<Voice | null>(null);
  const [pret, setPret] = useState(false);
  const [survole, setSurvole] = useState<Voice | null>(null);
  const [kit, setKit] = useState<string | null>(null);
  const [localesPretes, setLocalesPretes] = useState<Set<Voice>>(new Set());
  const [chargeEnCours, setChargeEnCours] = useState(false);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);

  const appliquerKit = useCallback(async (id: string | null) => {
    choisirKit(id);
    setKit(id);
    if (!id) { setLocalesPretes(new Set()); return; }
    setChargeEnCours(true);
    await chargerKit(id, VOICES);
    setLocalesPretes(voixDisponibles(id));
    setChargeEnCours(false);
  }, []);

  /**
   * Le kit choisi la dernière fois vaut aussi pour la lecture d'une grille : on le
   * restaure au montage plutôt que de repartir du LM-2 à chaque visite.
   *
   * Le choix est lu ici et non au premier rendu : `localStorage` n'existe pas au
   * rendu serveur, et l'y lire ferait diverger le HTML servi de celui que le
   * navigateur reconstruit.
   */
  useEffect(() => {
    const id = restaurerKit();
    if (id) void appliquerKit(id);
  }, [appliquerKit]);

  // Le kit se charge en tâche de fond au premier son : on interroge son état
  // plutôt que de deviner, et on s'arrête dès qu'il est là.
  useEffect(() => {
    if (pret) return;
    const id = setInterval(() => { if (kitCharge()) setPret(true); }, 400);
    return () => clearInterval(id);
  }, [pret]);

  const frapper = useCallback(async (voix: Voice) => {
    await ensureAudioContext();
    frapperVoix(voix);
    setActif(voix);
    if (minuteur.current) clearTimeout(minuteur.current);
    minuteur.current = setTimeout(() => setActif(null), 140);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const i = TOUCHES.indexOf(e.key.toLowerCase());
      if (i >= 0 && VOICES[i]) { e.preventDefault(); frapper(VOICES[i]); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [frapper]);

  const parCategorie = PATTERN_DEFS.reduce<Record<string, typeof PATTERN_DEFS>>((acc, p) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  }, {});

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--ink)' }}>Boîte à rythme</h1>
        <p className="text-sm" style={{ color: 'var(--ink-light)' }}>
          Les quinze sons du kit LinnDrum LM-2, tels que la lecture les joue.
          Clique un pad, ou tape la touche indiquée.
        </p>
        <p className="text-xs" style={{ color: pret ? 'var(--ink-faint)' : 'var(--accent)' }}>
          {pret
            ? 'Échantillons LM-2 chargés.'
            : 'Échantillons LM-2 pas encore chargés — la synthèse de secours joue en attendant. Frappe un pad pour lancer le chargement.'}
        </p>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs" style={{ color: 'var(--ink-light)' }}>Kit :</span>
          {[{ id: null, label: 'LM-2 (défaut)' }, ...KITS.map(k => ({ id: k.id as string | null, label: k.label }))].map((k) => {
            const choisi = kit === k.id;
            return (
              <button
                key={k.id ?? 'lm2'}
                type="button"
                onClick={() => void appliquerKit(k.id)}
                aria-pressed={choisi}
                className="text-xs px-2.5 py-1 rounded-full border transition-colors"
                style={{
                  background: choisi ? 'var(--accent)' : 'transparent',
                  borderColor: choisi ? 'var(--accent)' : 'var(--line)',
                  color: choisi ? '#fff' : 'var(--ink-light)',
                }}
              >
                {k.label}
              </button>
            );
          })}
          {chargeEnCours && (
            <span className="text-xs" style={{ color: 'var(--ink-faint)' }}>chargement…</span>
          )}
          {kit && !chargeEnCours && (
            <span className="text-xs" style={{ color: 'var(--ink-faint)' }}>
              {localesPretes.size} voix sur {VOICES.length} ; les autres restent au LM-2
            </span>
          )}
        </div>
      </header>

      <section aria-label="Pads" className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
        {VOICES.map((voix, i) => {
          const info = VOICE_INFO[voix];
          const enFrappe = actif === voix;
          const usages = USAGES[voix];
          return (
            <button
              key={voix}
              type="button"
              onClick={() => frapper(voix)}
              onMouseEnter={() => setSurvole(voix)}
              onMouseLeave={() => setSurvole(null)}
              aria-label={`${LIBELLE[voix]} — ${usages.length} rythme${usages.length > 1 ? 's' : ''}`}
              className="flex flex-col gap-1 items-start p-3 rounded-lg border text-left transition-transform"
              style={{
                background: enFrappe ? 'var(--accent)' : 'var(--cell-bg)',
                borderColor: enFrappe ? 'var(--accent)' : 'var(--line)',
                color: enFrappe ? '#fff' : 'var(--ink)',
                transform: enFrappe ? 'scale(0.97)' : 'none',
                boxShadow: enFrappe ? '0 0 0 3px var(--accent-soft)' : 'none',
              }}
            >
              <span className="flex items-center justify-between w-full gap-2">
                <span className="font-semibold text-sm leading-tight">{LIBELLE[voix]}</span>
                <kbd
                  className="text-[10px] px-1.5 py-0.5 rounded border font-mono uppercase shrink-0"
                  style={{
                    borderColor: enFrappe ? 'rgba(255,255,255,.5)' : 'var(--line)',
                    color: enFrappe ? '#fff' : 'var(--ink-faint)',
                  }}
                >
                  {TOUCHES[i] ?? '·'}
                </kbd>
              </span>
              <span className="text-[11px] font-mono" style={{ color: enFrappe ? 'rgba(255,255,255,.85)' : 'var(--ink-faint)' }}>
                {localesPretes.has(voix) ? `${voix}.wav` : info.group} · vél. {info.velocity}
              </span>
              <span className="text-[11px]" style={{ color: enFrappe ? 'rgba(255,255,255,.85)' : 'var(--ink-light)' }}>
                {usages.length === 0
                  ? 'aucun rythme'
                  : `${usages.length} rythme${usages.length > 1 ? 's' : ''}`}
              </span>
              {survole === voix && usages.length > 0 && (
                <span className="text-[10px] leading-snug" style={{ color: 'var(--ink-faint)' }}>
                  {usages.join(', ')}
                </span>
              )}
            </button>
          );
        })}
      </section>

      <section aria-label="Rythmes" className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--ink)' }}>
          Les {PATTERN_DEFS.length} rythmes, et ce qu&apos;ils emploient
        </h2>
        {Object.entries(parCategorie).map(([categorie, motifs]) => (
          <div key={categorie} className="flex flex-col gap-2">
            <h3 className="text-xs uppercase tracking-wider" style={{ color: 'var(--ink-faint)' }}>{categorie}</h3>
            <div className="flex flex-col gap-1.5">
              {motifs.map((m) => {
                const voix = VOICES.filter((v) => (m.pattern as Record<string, number[]>)[v]?.length);
                return (
                  <div key={m.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
                    <span className="font-medium min-w-[11rem]" style={{ color: 'var(--ink)' }}>{m.label}</span>
                    <span className="text-xs" style={{ color: 'var(--ink-light)' }}>
                      {voix.map((v) => LIBELLE[v]).join(' · ')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
