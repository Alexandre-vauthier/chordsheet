import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth, getAdminFieldValue } from '@/lib/firebase-admin';
import { canAnalyze, fetchOEmbed, isYoutubeUrl } from '@/lib/audio-analysis';
import { enqueueAnalysis } from '@/lib/cloud-tasks';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Anti-rafale (best-effort, par instance)
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

export async function POST(req: NextRequest) {
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

  // Quota (mutualisé avec l'analyse photo) — vérifié ici, décompté à la fin (route finish)
  if (!(await canAnalyze(userId))) {
    return NextResponse.json(
      {
        error: 'Limite d\'analyses atteinte pour ce mois. Passe à ChordSheet Pro pour des analyses illimitées.',
        upgradeRequired: true,
      },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => null);
  const youtubeUrl: string = body?.youtubeUrl ?? '';
  const audioUrl: string = body?.audioUrl ?? '';
  const providedTitle: string = body?.title ?? '';

  const isYoutube = isYoutubeUrl(youtubeUrl);
  if (!isYoutube && !audioUrl) {
    return NextResponse.json({ error: 'Fournir un lien YouTube ou un fichier.' }, { status: 400 });
  }

  // Métadonnées : oEmbed pour YouTube, sinon le titre fourni (nom du fichier)
  const meta = isYoutube ? await fetchOEmbed(youtubeUrl) : { title: providedTitle, author: '' };

  // Crée le doc du job (l'utilisateur l'écoutera via onSnapshot)
  const db = getAdminDb();
  const jobRef = await db.collection('analysisJobs').add({
    ownerId: userId,
    status: 'queued',
    progress: 0,
    step: 'En file d\'attente',
    isYoutube,
    referenceUrl: isYoutube ? youtubeUrl : null,
    meta,
    createdAt: getAdminFieldValue().serverTimestamp(),
  });

  // Enfile la tâche vers le worker Cloud Run
  try {
    await enqueueAnalysis({
      jobId: jobRef.id,
      audioUrl: isYoutube ? undefined : audioUrl,
      youtubeUrl: isYoutube ? youtubeUrl : undefined,
    });
  } catch (e) {
    console.error('[analyze-audio/start] enqueue failed:', e);
    await jobRef.set({ status: 'error', error: 'Impossible de lancer l\'analyse.' }, { merge: true });
    return NextResponse.json({ error: 'Impossible de lancer l\'analyse. Réessaie.' }, { status: 502 });
  }

  return NextResponse.json({ jobId: jobRef.id });
}
