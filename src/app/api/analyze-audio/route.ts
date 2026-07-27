import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getAdminDb, getAdminAuth, getAdminFieldValue } from '@/lib/firebase-admin';

// L'analyse audio (Demucs) peut durer plusieurs minutes.
export const runtime = 'nodejs';
export const maxDuration = 300;

const FREE_LIMIT = 2;

// ── Anti-rafale (best-effort, par instance) ──────────────────────────────────
const BURST_LIMIT = 3;
const BURST_WINDOW_MS = 60_000;
const burstLog = new Map<string, number[]>();
function isBursting(userId: string): boolean {
  const now = Date.now();
  const ts = (burstLog.get(userId) ?? []).filter((t) => now - t < BURST_WINDOW_MS);
  ts.push(now);
  burstLog.set(userId, ts);
  return ts.length > BURST_LIMIT;
}

// ── Timeline (service Cloud Run) → séquence d'accords mesure par mesure ──────
interface Timeline {
  bpm: number;
  key: string;
  duration: number;
  downbeats: [number, number][];      // [temps, position dans la mesure]
  chords: { start: number; end: number; label: string }[];
}

function madmomToChord(label: string): string {
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
interface BarCell { chord: string; beats: number }
interface Bar { cells: BarCell[] }

// Découpe la timeline temps par temps : pour chaque temps on lit l'accord dominant
// (échantillon pris à 40% de l'intervalle, pour éviter les frontières), puis on
// regroupe les temps consécutifs de même accord dans chaque mesure.
function toBars(tl: Timeline): { bars: Bar[]; beatsPerBar: 3 | 4 } {
  const beats = [...tl.downbeats].sort((a, b) => a[0] - b[0]); // [temps, position 1..4]
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

async function fetchOEmbed(url: string): Promise<{ title: string; author: string }> {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
    if (!res.ok) return { title: '', author: '' };
    const d = await res.json();
    return { title: d.title ?? '', author: d.author_name ?? '' };
  } catch {
    return { title: '', author: '' };
  }
}

function buildPrompt(bars: Bar[], beatsPerBar: number, tl: Timeline, meta: { title: string; author: string }): string {
  // Chaque mesure liste ses accords avec leur durée en temps : "Am(2) G(2)".
  const seq = bars
    .map((bar, i) => `M${i + 1}:${bar.cells.map((c) => `${c.chord || '-'}(${c.beats})`).join(' ')}`)
    .join(' | ');
  return `Tu structures une grille d'accords à partir d'une détection automatique (audio → accords).

Contexte :
- Titre (YouTube) : ${meta.title || 'inconnu'}
- Chaîne/artiste : ${meta.author || 'inconnu'}
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
6. Une mesure fait ${beatsPerBar} temps. Chaque accord garde sa durée détectée (beats). Un seul accord sur toute la mesure → beats=${beatsPerBar}.

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

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'Clé API Anthropic non configurée.' }, { status: 503 });
  }
  if (!process.env.CHORD_DETECTOR_URL) {
    return NextResponse.json({ error: 'Service de détection audio non configuré.' }, { status: 503 });
  }

  // Auth Firebase obligatoire
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ') || !process.env.FIREBASE_ADMIN_PROJECT_ID) {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  }
  let userId: string;
  try {
    userId = (await getAdminAuth().verifyIdToken(authHeader.slice(7))).uid;
  } catch {
    return NextResponse.json({ error: 'Session invalide, reconnecte-toi.' }, { status: 401 });
  }
  if (isBursting(userId)) {
    return NextResponse.json({ error: 'Trop de requêtes, réessaie dans une minute.' }, { status: 429 });
  }

  // Quota (mutualisé avec l'analyse photo)
  try {
    const db = getAdminDb();
    const subDoc = await db.collection('users').doc(userId).collection('private').doc('subscription').get();
    const sub = subDoc.data();
    const isPro = sub?.plan === 'pro' && (sub?.status === 'active' || sub?.status === 'trialing');
    if (!isPro) {
      const resetAt = sub?.ocrResetAt?.toDate?.();
      const used = resetAt && new Date() > resetAt ? 0 : (sub?.ocrUsedThisMonth ?? 0);
      const credits = sub?.earnedOcrCredits ?? 0;
      if (used >= FREE_LIMIT && credits <= 0) {
        return NextResponse.json({
          error: 'Limite d\'analyses atteinte pour ce mois. Passe à ChordSheet Pro pour des analyses illimitées.',
          upgradeRequired: true,
        }, { status: 429 });
      }
    }
  } catch (e) {
    console.error('[analyze-audio] Quota check error (non-blocking):', e);
  }

  try {
    const body = await req.json().catch(() => null);
    const youtubeUrl: string = body?.youtubeUrl ?? '';
    const audioUrl: string = body?.audioUrl ?? '';           // URL d'un fichier uploadé (Storage)
    const providedTitle: string = body?.title ?? '';

    const isYoutube = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(youtubeUrl);
    if (!isYoutube && !audioUrl) {
      return NextResponse.json({ error: 'Fournir un lien YouTube ou un fichier.' }, { status: 400 });
    }

    // 1) Métadonnées : oEmbed pour YouTube, sinon le titre fourni (nom du fichier)
    const meta = isYoutube ? await fetchOEmbed(youtubeUrl) : { title: providedTitle, author: '' };

    // 2) Analyse audio (service Cloud Run)
    const fd = new FormData();
    if (isYoutube) fd.append('youtube_url', youtubeUrl);
    else fd.append('audio_url', audioUrl);
    const detRes = await fetch(`${process.env.CHORD_DETECTOR_URL}/analyze`, {
      method: 'POST',
      headers: { 'X-API-Key': process.env.CHORD_DETECTOR_API_KEY ?? '' },
      body: fd,
    });
    if (!detRes.ok) {
      const detail = await detRes.text().catch(() => '');
      console.error('[analyze-audio] détecteur:', detRes.status, detail.slice(0, 300));
      return NextResponse.json(
        { error: 'Échec de l\'analyse audio (téléchargement YouTube ou service). Réessaie ou utilise un autre lien.' },
        { status: 502 },
      );
    }
    const timeline: Timeline = await detRes.json();
    const { bars, beatsPerBar } = toBars(timeline);
    if (!bars.some((bar) => bar.cells.some((c) => c.chord))) {
      return NextResponse.json({ error: 'Aucun accord exploitable détecté sur ce morceau.' }, { status: 422 });
    }

    // 3) Structuration IA → même format que l'analyse photo
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      messages: [{ role: 'user', content: [{ type: 'text', text: buildPrompt(bars, beatsPerBar, timeline, meta) }] }],
    });
    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}(?=[^}]*$)/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Structuration impossible (réponse du modèle invalide).' }, { status: 500 });
    }
    const parsed = JSON.parse(jsonMatch[0].trim());

    // Normaliser/filtrer les accords (comme analyze-sheet)
    const validRoot = /^[A-G][#b]?/;
    if (Array.isArray(parsed.sections)) {
      for (const section of parsed.sections) {
        if (Array.isArray(section.chords)) {
          section.chords = section.chords.map((c: unknown) => {
            const obj = c as { chord?: string; beats?: number };
            const chord = typeof obj.chord === 'string' && (obj.chord === '' || validRoot.test(obj.chord)) ? obj.chord : '';
            const beats = typeof obj.beats === 'number' && obj.beats > 0 ? obj.beats : beatsPerBar;
            return { chord, beats };
          });
        }
      }
    }
    // Repli titre/artiste
    if (!parsed.title && meta.title) parsed.title = meta.title;
    if (!parsed.artist && meta.author) parsed.artist = meta.author;
    if (isYoutube) parsed.referenceUrl = youtubeUrl; // le lien YouTube reste la référence

    // Incrément quota (free)
    try {
      const db = getAdminDb();
      const FieldValue = getAdminFieldValue();
      const subRef = db.collection('users').doc(userId).collection('private').doc('subscription');
      const sub = (await subRef.get()).data();
      const isPro = sub?.plan === 'pro' && (sub?.status === 'active' || sub?.status === 'trialing');
      if (!isPro) {
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
      }
    } catch (e) {
      console.error('[analyze-audio] counter update failed:', e);
    }

    return NextResponse.json(parsed);
  } catch (e) {
    console.error('[analyze-audio] Unhandled error:', e);
    const msg = e instanceof Error ? e.message : 'Erreur inconnue';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
