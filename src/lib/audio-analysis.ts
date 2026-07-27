/**
 * Logique partagée de l'analyse audio (routes start/finish).
 * Transformation timeline → mesures, prompt de structuration IA, quota OCR mutualisé.
 */
import { getAdminDb, getAdminFieldValue } from '@/lib/firebase-admin';

export const FREE_LIMIT = 2;

// ── Timeline renvoyée par le service Cloud Run ──────────────────────────────
export interface Timeline {
  bpm: number;
  key: string;
  duration: number;
  downbeats: [number, number][]; // [temps, position dans la mesure 1..4]
  chords: { start: number; end: number; label: string }[];
}

export function madmomToChord(label: string): string {
  if (!label || label === 'N') return '';
  const m = label.match(/^([A-G][#b]?):(maj|min)$/);
  if (!m) return '';
  return m[2] === 'min' ? `${m[1]}m` : m[1];
}

function chordAt(chords: Timeline['chords'], t: number): string {
  for (const c of chords) if (c.start <= t && t < c.end) return c.label;
  return 'N';
}

// Une cellule = un accord tenu sur `beats` temps consécutifs dans la mesure.
export interface BarCell { chord: string; beats: number }
export interface Bar { cells: BarCell[] }

// Découpe la timeline temps par temps (échantillon à 40% de l'intervalle pour
// éviter les frontières), puis regroupe les temps consécutifs de même accord
// dans chaque mesure. Résultat : au plus `beatsPerBar` cellules par mesure.
export function toBars(tl: Timeline): { bars: Bar[]; beatsPerBar: 3 | 4 } {
  const beats = [...tl.downbeats].sort((a, b) => a[0] - b[0]);
  const maxBeat = beats.reduce((m, d) => Math.max(m, d[1]), 4);
  const beatsPerBar: 3 | 4 = maxBeat === 3 ? 3 : 4;

  const perBeat = beats.map(([t, pos], i) => {
    const next = beats[i + 1]?.[0] ?? t + 0.5;
    const sample = t + (next - t) * 0.4;
    return { pos, chord: madmomToChord(chordAt(tl.chords, sample)) };
  });

  const makeBar = (bts: { chord: string }[]): Bar => {
    const cells: BarCell[] = [];
    for (const b of bts) {
      const last = cells[cells.length - 1];
      if (last && last.chord === b.chord) last.beats += 1;
      else cells.push({ chord: b.chord, beats: 1 });
    }
    return { cells };
  };

  const bars: Bar[] = [];
  let cur: { pos: number; chord: string }[] = [];
  for (const b of perBeat) {
    if (b.pos === 1 && cur.length) { bars.push(makeBar(cur)); cur = []; }
    cur.push(b);
  }
  if (cur.length) bars.push(makeBar(cur));
  return { bars, beatsPerBar };
}

export function buildPrompt(
  bars: Bar[],
  beatsPerBar: number,
  tl: Timeline,
  meta: { title: string; author: string },
): string {
  const seq = bars
    .map((bar, i) => `M${i + 1}:${bar.cells.map((c) => `${c.chord || '-'}(${c.beats})`).join(' ')}`)
    .join(' | ');
  return `Tu structures une grille d'accords à partir d'une détection automatique (audio → accords).

Contexte :
- Titre : ${meta.title || 'inconnu'}
- Artiste : ${meta.author || 'inconnu'}
- Tonalité estimée : ${tl.key || 'inconnue'}
- Tempo : ${Math.round(tl.bpm)} BPM
- Mesure : ${beatsPerBar}/4

Séquence détectée, une entrée par mesure. Format : Mn:accord(durée_en_temps) accord(durée)…
"-" = temps sans accord clair. La somme des durées d'une mesure vaut environ ${beatsPerBar}.
${seq}

Ta tâche :
1. Regroupe ces mesures en SECTIONS musicales (Intro, Couplet, Refrain, Pont…) en repérant les répétitions.
2. Utilise "repeat" quand une section se répète telle quelle à la suite (ne recopie pas 4 fois, mets repeat=4).
3. Respelle les accords selon la tonalité (ex. en tonalité bémol : A#→Bb, D#→Eb, G#→Ab).
4. Reste FIDÈLE à la détection : conserve les changements d'accords en cours de mesure et leurs durées (ex. Am(2) G(2) → deux accords dans la mesure). Ne rajoute pas d'accords, ne "corrige" pas la progression. La détection ne donne que majeurs/mineurs ; n'invente pas de 7e/sus.
5. Nettoie le bruit léger : une durée de 1 temps isolée entre deux fois le même accord est probablement du bruit, tu peux la fusionner ; mais garde les vrais changements (2 temps ou plus).
6. Une mesure fait ${beatsPerBar} temps et au plus ${beatsPerBar} accords. Chaque accord garde sa durée détectée (beats). Un seul accord sur toute la mesure → beats=${beatsPerBar}.

Réponds UNIQUEMENT avec ce JSON (sans texte autour) :
{
  "title": "${meta.title ? meta.title.replace(/"/g, '\\"') : ''}",
  "artist": "${meta.author ? meta.author.replace(/"/g, '\\"') : ''}",
  "key": "",
  "timeSignature": "${beatsPerBar}/4",
  "tempo": "${Math.round(tl.bpm)}",
  "sections": [
    { "label": "Couplet", "repeat": 1, "chords": [ { "chord": "Am", "beats": 2 }, { "chord": "G", "beats": 2 } ] }
  ]
}

Règles JSON : tout accord commence par A-G (majuscule) + éventuellement # ou b + suffixe (m). Temps sans accord → {"chord": "", "beats": N}.`;
}

// Normalise les accords produits par l'IA (comme analyze-sheet).
export function normalizeSections(parsed: { sections?: unknown[] }, beatsPerBar: number): void {
  const validRoot = /^[A-G][#b]?/;
  if (!Array.isArray(parsed.sections)) return;
  for (const section of parsed.sections as { chords?: unknown[] }[]) {
    if (!Array.isArray(section.chords)) continue;
    section.chords = section.chords.map((c: unknown) => {
      const obj = c as { chord?: string; beats?: number };
      const chord = typeof obj.chord === 'string' && (obj.chord === '' || validRoot.test(obj.chord)) ? obj.chord : '';
      const beats = typeof obj.beats === 'number' && obj.beats > 0 ? obj.beats : beatsPerBar;
      return { chord, beats };
    });
  }
}

export async function fetchOEmbed(url: string): Promise<{ title: string; author: string }> {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
    if (!res.ok) return { title: '', author: '' };
    const d = await res.json();
    return { title: d.title ?? '', author: d.author_name ?? '' };
  } catch {
    return { title: '', author: '' };
  }
}

export const isYoutubeUrl = (u: string): boolean =>
  /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(u);

// ── Quota OCR (mutualisé analyse photo + audio) ─────────────────────────────
/** true si l'utilisateur peut lancer une analyse (Pro ou quota restant). */
export async function canAnalyze(userId: string): Promise<boolean> {
  try {
    const db = getAdminDb();
    const sub = (await db.collection('users').doc(userId).collection('private').doc('subscription').get()).data();
    const isPro = sub?.plan === 'pro' && (sub?.status === 'active' || sub?.status === 'trialing');
    if (isPro) return true;
    const resetAt = sub?.ocrResetAt?.toDate?.();
    const used = resetAt && new Date() > resetAt ? 0 : (sub?.ocrUsedThisMonth ?? 0);
    const credits = sub?.earnedOcrCredits ?? 0;
    return used < FREE_LIMIT || credits > 0;
  } catch (e) {
    console.error('[audio] canAnalyze error (non-blocking, autorise):', e);
    return true; // ne pas bloquer sur une erreur de lecture quota
  }
}

/** Décompte une analyse réussie (gratuite). No-op pour les Pro. */
export async function consumeAnalysis(userId: string): Promise<void> {
  try {
    const db = getAdminDb();
    const FieldValue = getAdminFieldValue();
    const subRef = db.collection('users').doc(userId).collection('private').doc('subscription');
    const sub = (await subRef.get()).data();
    const isPro = sub?.plan === 'pro' && (sub?.status === 'active' || sub?.status === 'trialing');
    if (isPro) return;
    const resetAt = sub?.ocrResetAt?.toDate?.();
    const nextReset = new Date();
    nextReset.setMonth(nextReset.getMonth() + 1);
    const used = resetAt && new Date() > resetAt ? 0 : (sub?.ocrUsedThisMonth ?? 0);
    const credits = sub?.earnedOcrCredits ?? 0;
    if (used >= FREE_LIMIT && credits > 0) {
      await subRef.set({ earnedOcrCredits: FieldValue.increment(-1) }, { merge: true });
    } else if (resetAt && new Date() > resetAt) {
      await subRef.set({ ocrUsedThisMonth: 1, ocrResetAt: nextReset }, { merge: true });
    } else {
      await subRef.set({ ocrUsedThisMonth: FieldValue.increment(1), ocrResetAt: resetAt ?? nextReset }, { merge: true });
    }
  } catch (e) {
    console.error('[audio] consumeAnalysis failed:', e);
  }
}
