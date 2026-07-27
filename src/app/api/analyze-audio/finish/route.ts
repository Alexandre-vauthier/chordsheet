import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getAdminDb, getAdminAuth } from '@/lib/firebase-admin';
import {
  Timeline,
  toMeasures,
  respellChord,
  keyPrefersSharps,
  buildSectionPrompt,
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

    // 1) DÉCOUPAGE DÉTERMINISTE en mesures régulières (le code, pas l'IA, fixe le métrique)
    const sharps = keyPrefersSharps(timeline.key);
    const measures = toMeasures(timeline, beatsPerBar).map((mez) =>
      mez.map((c) => ({ chord: respellChord(c.chord, sharps), beats: c.beats })),
    );
    if (!measures.some((mez) => mez.some((c) => c.chord))) {
      await jobRef.set({ status: 'error', error: 'Aucun accord exploitable.' }, { merge: true });
      return NextResponse.json({ error: 'Aucun accord exploitable détecté sur ce morceau.' }, { status: 422 });
    }

    // 2) L'IA ne décide QUE du découpage en sections + répétitions (best-effort)
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const labels = measures.map((mez) => mez.map((c) => c.chord || '-').join(' '));
    let boundaries: { label: string; count: number; repeat: number }[] = [];
    try {
      const secResp = await askModel(client, buildSectionPrompt(labels, beatsPerBar, meta));
      const secs = secResp?.sections;
      if (Array.isArray(secs)) {
        boundaries = secs
          .map((s) => {
            const o = s as { label?: string; count?: number; repeat?: number };
            return { label: String(o.label ?? ''), count: Math.max(1, Math.round(Number(o.count) || 0)), repeat: Math.max(1, Math.round(Number(o.repeat) || 1)) };
          })
          .filter((s) => s.count > 0);
      }
    } catch (e) {
      console.error('[analyze-audio/finish] découpage sections ignoré:', e);
    }

    // 3) ASSEMBLAGE : on découpe NOS mesures selon les frontières de l'IA (validées).
    //    Les mesures répétées (repeat) sont supposées identiques → on n'en garde qu'une.
    type Section = { label: string; repeat: number; chords: { chord: string; beats: number }[] };
    const sig = (s: number, e: number) =>
      measures.slice(s, e).map((mez) => mez.map((c) => `${c.chord}:${c.beats}`).join(',')).join('|');
    const sections: Section[] = [];
    let idx = 0;
    for (const b of boundaries) {
      if (idx >= measures.length) break;
      const count = Math.min(b.count, measures.length - idx);
      // N'honore le repeat que si les blocs suivants sont réellement identiques
      const base = sig(idx, idx + count);
      let rep = 1;
      while (rep < b.repeat && idx + (rep + 1) * count <= measures.length && sig(idx + rep * count, idx + (rep + 1) * count) === base) {
        rep++;
      }
      const block = measures.slice(idx, idx + count).flat();
      sections.push({ label: b.label || `Partie ${sections.length + 1}`, repeat: rep, chords: block });
      idx += count * rep;
    }
    if (idx < measures.length) {
      // Mesures restantes (IA incomplète ou absente) → section de repli
      sections.push({ label: sections.length ? 'Suite' : 'Grille', repeat: 1, chords: measures.slice(idx).flat() });
    }
    if (!sections.length) {
      sections.push({ label: 'Grille', repeat: 1, chords: measures.flat() });
    }

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
