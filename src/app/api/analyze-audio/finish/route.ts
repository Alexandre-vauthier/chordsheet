import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getAdminDb, getAdminAuth } from '@/lib/firebase-admin';
import {
  Timeline,
  toBars,
  buildPrompt,
  buildReviewPrompt,
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
    const { bars, beatsPerBar } = toBars(timeline);
    if (!bars.some((bar) => bar.cells.some((c) => c.chord))) {
      await jobRef.set({ status: 'error', error: 'Aucun accord exploitable.' }, { merge: true });
      return NextResponse.json({ error: 'Aucun accord exploitable détecté sur ce morceau.' }, { status: 422 });
    }
    const meta = data.meta ?? { title: '', author: '' };

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Passe 1 : structuration de la séquence détectée en grille.
    const pass1 = await askModel(client, buildPrompt(bars, beatsPerBar, timeline, meta));
    if (!pass1) {
      return NextResponse.json({ error: 'Structuration impossible (réponse du modèle invalide).' }, { status: 500 });
    }

    // Passe 2 : relecture/critique musicale de la grille assemblée (durcissement).
    // Best-effort : si elle échoue ou renvoie une grille vide, on garde la passe 1.
    let parsed = pass1;
    try {
      const gridJson = JSON.stringify({ sections: pass1.sections });
      const pass2 = await askModel(client, buildReviewPrompt(gridJson, beatsPerBar, timeline, meta));
      if (pass2 && Array.isArray(pass2.sections) && pass2.sections.length > 0) {
        parsed = pass2;
      }
    } catch (e) {
      console.error('[analyze-audio/finish] passe 2 (relecture) ignorée:', e);
    }

    normalizeSections(parsed, beatsPerBar);
    if (!parsed.title && meta.title) parsed.title = meta.title;
    if (!parsed.artist && meta.author) parsed.artist = meta.author;
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
