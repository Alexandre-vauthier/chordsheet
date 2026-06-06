import { NextRequest, NextResponse } from 'next/server';

const SERVICE_URL = process.env.CHORD_DETECTOR_URL;
const API_KEY = process.env.CHORD_DETECTOR_API_KEY ?? '';

export async function POST(req: NextRequest) {
  if (!SERVICE_URL) {
    return NextResponse.json({ error: 'Service non configuré (CHORD_DETECTOR_URL manquant).' }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.youtube_url) {
    return NextResponse.json({ error: 'Champ youtube_url requis.' }, { status: 400 });
  }

  try {
    const res = await fetch(`${SERVICE_URL}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
      },
      body: JSON.stringify({ youtube_url: body.youtube_url }),
      // Cloud Run peut prendre jusqu'à 2-3 min sur une longue chanson
      signal: AbortSignal.timeout(180_000),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data.detail ?? 'Erreur du service.' }, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur inconnue';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
