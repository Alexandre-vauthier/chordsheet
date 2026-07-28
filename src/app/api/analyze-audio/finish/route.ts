import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getAdminDb, getAdminAuth } from '@/lib/firebase-admin';
import {
  Timeline,
  toSections,
  respellChord,
  chordsPreferSharps,
  seventhByChord,
  buildLabelPrompt,
  normalizeSections,
  consumeAnalysis,
} from '@/lib/audio-analysis';

export const runtime = 'nodejs';
export const maxDuration = 120;

// Extrait le premier objet JSON d'une réponse texte du modèle.
function extractJson(text: string): Record<string, unknown> | null {
  const m = text.match(/\{[\s\S]*\}(?=[^}]*$)/);
  if (!m) return null;
  try {
    return JSON.parse(m[0].trim());
  } catch {
    return null;
  }
}

async function askModel(client: Anthropic, prompt: string): Promise<Record<string, unknown> | null> {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
  });
  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  return extractJson(text);
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'Clé API Anthropic non configurée.' }, { status: 503 });
  }

  // Auth
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

  const body = await req.json().catch(() => null);
  const jobId: string = body?.jobId ?? '';
  if (!jobId) return NextResponse.json({ error: 'jobId manquant.' }, { status: 400 });

  const db = getAdminDb();
  const jobRef = db.collection('analysisJobs').doc(jobId);
  const snap = await jobRef.get();
  if (!snap.exists) return NextResponse.json({ error: 'Analyse introuvable.' }, { status: 404 });
  const data = snap.data() as {
    ownerId: string;
    status: string;
    timelineJson?: string;
    resultJson?: string;
    isYoutube?: boolean;
    referenceUrl?: string | null;
    meta?: { title: string; author: string };
  };
  if (data.ownerId !== userId) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  }
  // Idempotent : déjà structuré
  if (data.status === 'done' && data.resultJson) {
    return NextResponse.json({ result: JSON.parse(data.resultJson) });
  }
  if (data.status === 'error') {
    return NextResponse.json({ error: 'L\'analyse a échoué.' }, { status: 422 });
  }
  if (data.status !== 'analyzed' || !data.timelineJson) {
    return NextResponse.json({ error: 'Analyse pas encore prête.' }, { status: 409 });
  }

  try {
    const timeline = JSON.parse(data.timelineJson) as Timeline;
    const beatsPerBar: 3 | 4 = timeline.downbeats.reduce((m, d) => Math.max(m, d[1]), 4) === 3 ? 3 : 4;
    const meta = data.meta ?? { title: '', author: '' };

    // 1) DÉCOUPAGE DÉTERMINISTE en sections (le code fixe le métrique ET les frontières)
    const sharps = chordsPreferSharps(timeline.chords);
    // Suffixe de 7e par accord (enrichissement final ; la structure reste sur maj/min).
    const seventh = seventhByChord(timeline.chords, sharps);
    const enrich = (chord: string): string => (chord ? chord + (seventh.get(chord) ?? '') : chord);
    const debug: Record<string, unknown> = {};
    const detected = toSections(timeline, beatsPerBar, debug).map((s) => ({
      repeat: s.repeat,
      measures: s.measures.map((mez) => mez.map((c) => ({ chord: respellChord(c.chord, sharps), beats: c.beats }))),
    }));
    debug.q7count = `${timeline.chords.filter((c) => c.q7).length}/${timeline.chords.length}`;
    debug.sevenths = [...seventh.entries()].filter(([, q]) => q).map(([b, q]) => `${b}${q}`).join(' ') || 'aucune';
    await jobRef.set({ debug: JSON.stringify(debug).slice(0, 8000) }, { merge: true }).catch(() => {});
    if (!detected.some((s) => s.measures.some((mez) => mez.some((c) => c.chord)))) {
      await jobRef.set({ status: 'error', error: 'Aucun accord exploitable.' }, { merge: true });
      return NextResponse.json({ error: 'Aucun accord exploitable détecté sur ce morceau.' }, { status: 422 });
    }

    // 2) L'IA ne fait QUE NOMMER les sections déjà découpées (best-effort).
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const sectionLines = detected.map((s) => {
      const body = s.measures.map((mez) => mez.map((c) => c.chord || '-').join(' ')).join(' | ');
      return `${body}${s.repeat > 1 ? ` (x${s.repeat})` : ''}`;
    });
    let labels: string[] = [];
    try {
      const resp = await askModel(client, buildLabelPrompt(sectionLines, meta));
      if (resp && Array.isArray(resp.labels)) labels = (resp.labels as unknown[]).map((l) => String(l));
    } catch (e) {
      console.error('[analyze-audio/finish] étiquetage ignoré:', e);
    }

    // 3) ASSEMBLAGE : sections détectées + labels de l'IA (une occurrence + repeat).
    // Cohérence : deux sections de contenu identique portent le MÊME label (le
    // premier attribué), pour qu'une partie récurrente ne change pas de nom.
    const labelByContent = new Map<string, string>();
    detected.forEach((s, i) => {
      const sig = s.measures.map((mz) => mz.map((c) => `${c.chord}:${c.beats}`).join(',')).join('|');
      const lbl = labels[i] || `Partie ${i + 1}`;
      if (!labelByContent.has(sig)) labelByContent.set(sig, lbl);
    });
    const sections = detected.map((s, i) => {
      const sig = s.measures.map((mz) => mz.map((c) => `${c.chord}:${c.beats}`).join(',')).join('|');
      return {
        label: labelByContent.get(sig) || labels[i] || `Partie ${i + 1}`,
        repeat: s.repeat,
        chords: s.measures.flat().map((c) => ({ chord: enrich(c.chord), beats: c.beats })),
      };
    });

    const parsed: Record<string, unknown> = {
      title: meta.title || '',
      artist: meta.author || '',
      key: '',
      timeSignature: `${beatsPerBar}/4`,
      tempo: String(Math.round(timeline.bpm)),
      sections,
    };
    normalizeSections(parsed, beatsPerBar);
    if (data.isYoutube && data.referenceUrl) parsed.referenceUrl = data.referenceUrl;

    await consumeAnalysis(userId);
    await jobRef.set({ status: 'done', resultJson: JSON.stringify(parsed) }, { merge: true });

    return NextResponse.json({ result: parsed });
  } catch (e) {
    console.error('[analyze-audio/finish] error:', e);
    const msg = e instanceof Error ? e.message : 'Erreur inconnue';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
