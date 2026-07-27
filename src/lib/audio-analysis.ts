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

Séquence détectée par l'algorithme, une entrée par mesure. Format : Mn:accord(durée_en_temps)…
"-" = temps sans accord clair.
${seq}

IMPORTANT — la détection ci-dessus est APPROXIMATIVE et bruitée : durées imprécises,
petits fragments parasites (1 temps isolé), accords qui vacillent. La musique, elle,
est RÉGULIÈRE. Ton rôle est d'en déduire la structure propre sous-jacente, pas de
recopier le bruit. Raisonne comme un musicien qui relève une grille à l'oreille.

Ta tâche :
1. Régularise le rythme harmonique. Dans la grande majorité des morceaux, un accord tient
   une mesure entière (beats=${beatsPerBar}) ou une demi-mesure (beats=${Math.round(beatsPerBar / 2)}).
   Les changements tombent sur les temps forts (1er temps, éventuellement mi-mesure).
   Quantifie les durées détectées vers ces valeurs. Élimine les fragments parasites
   (durée de 1 temps isolée, accord qui n'apparaît qu'une fois entre deux autres) en les
   absorbant dans l'accord voisin dominant. Vise 1 à 2 accords par mesure, rarement plus.
2. Exploite la RÉPÉTITION, clé de la structure musicale : repère les mesures et les blocs
   qui reviennent à l'identique. Regroupe en SECTIONS (Intro, Couplet, Refrain, Pont…) et
   utilise "repeat" au lieu de recopier (une section de 4 mesures jouée 2 fois → repeat=2).
   Une section fait typiquement 4, 8 ou 16 mesures. Cherche activement ces régularités.
3. Chaque mesure fait EXACTEMENT ${beatsPerBar} temps : la somme des "beats" des accords
   consécutifs doit se regrouper en mesures pleines de ${beatsPerBar} temps (ex. en 4/4 :
   un accord de 4, ou 2+2, ou 4×1 ; jamais 3+2 ou 1+2).
4. Reste fidèle aux ACCORDS eux-mêmes (n'invente pas d'accords hors de ceux détectés,
   respelle selon la tonalité : A#→Bb, D#→Eb, G#→Ab). La détection ne donne que majeurs
   et mineurs ; n'ajoute pas de 7e/sus. Tu régularises le RYTHME et la STRUCTURE, pas
   l'harmonie.

Réponds UNIQUEMENT avec ce JSON (sans texte autour) :
{
  "title": "${meta.title ? meta.title.replace(/"/g, '\\"') : ''}",
  "artist": "${meta.author ? meta.author.replace(/"/g, '\\"') : ''}",
  "key": "",
  "timeSignature": "${beatsPerBar}/4",
  "tempo": "${Math.round(tl.bpm)}",
  "sections": [
    { "label": "Couplet", "repeat": 2, "chords": [ { "chord": "Am", "beats": ${beatsPerBar} }, { "chord": "G", "beats": ${beatsPerBar} } ] }
  ]
}

Règles JSON : tout accord commence par A-G (majuscule) + éventuellement # ou b + suffixe (m).
Chaque "beats" est un entier de 1 à ${beatsPerBar}, et les accords d'une section se
regroupent en mesures pleines de ${beatsPerBar} temps.`;
}

// Deuxième passe : relecture/critique de la grille assemblée (générateur → critique).
export function buildReviewPrompt(
  gridJson: string,
  beatsPerBar: number,
  tl: Timeline,
  meta: { title: string; author: string },
): string {
  const half = Math.round(beatsPerBar / 2);
  return `Tu es un relecteur musical exigeant. Voici une grille d'accords BROUILLON, issue
d'une détection audio approximative puis d'une première structuration automatique. Elle
contient probablement des irrégularités. Corrige-la pour qu'elle soit MUSICALEMENT
COHÉRENTE et RÉGULIÈRE, comme la relèverait un musicien expérimenté.

Contexte : ${meta.title || 'morceau'}${meta.author ? ' — ' + meta.author : ''}, tonalité ${tl.key || 'inconnue'}, ${Math.round(tl.bpm)} BPM, mesure ${beatsPerBar}/4.

Grille à relire (JSON) :
${gridJson}

Vérifie et corrige, dans cet ordre :
1. MESURES RÉGULIÈRES : dans chaque section, les "beats" consécutifs doivent se regrouper
   en mesures pleines de EXACTEMENT ${beatsPerBar} temps (ex. en 4/4 : 4, ou 2+2, ou 4×1 ;
   jamais 3+2). Un accord tient le plus souvent une mesure (${beatsPerBar}) ou une demi-mesure (${half}).
   Supprime les durées bizarres et les fragments parasites (accord d'1 temps qui n'apparaît
   qu'une fois entre deux autres) en les absorbant dans l'accord voisin dominant.
2. RÉPÉTITION ET STRUCTURE : une vraie chanson a PEU de motifs distincts qui reviennent.
   Les sections font typiquement 4, 8 ou 16 mesures. Repère les progressions qui se répètent,
   factorise-les avec "repeat", et nomme les sections (Intro, Couplet, Refrain, Pont…).
   Si deux sections voisines sont identiques, fusionne-les avec un repeat.
3. COHÉRENCE HARMONIQUE : en tonalité ${tl.key || '?'}, un accord isolé qui casse une boucle
   par ailleurs répétée est très probablement une erreur de détection → aligne-le sur le motif.
   Ne touche pas aux accords clairement établis et récurrents.
4. Accords majeurs/mineurs uniquement, respellés selon la tonalité (A#→Bb, D#→Eb, G#→Ab).
   N'invente pas de 7e/sus. Tu régularises le RYTHME et la STRUCTURE, tu ne réharmonises pas.

Réponds UNIQUEMENT avec le même schéma JSON, sans texte autour :
{ "title": "${meta.title ? meta.title.replace(/"/g, '\\"') : ''}", "artist": "${meta.author ? meta.author.replace(/"/g, '\\"') : ''}", "key": "", "timeSignature": "${beatsPerBar}/4", "tempo": "${Math.round(tl.bpm)}", "sections": [ { "label": "Couplet", "repeat": 2, "chords": [ { "chord": "Am", "beats": ${beatsPerBar} } ] } ] }
Chaque "beats" est un entier de 1 à ${beatsPerBar} et les accords d'une section se regroupent en mesures pleines de ${beatsPerBar} temps.`;
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
