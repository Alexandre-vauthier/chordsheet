import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function getAdminDb() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }
  return getFirestore();
}

const FREE_OCR_LIMIT = 2;

const PROMPT = `Tu es un musicien expérimenté qui déchiffre une partition. Les images sont les pages successives d'un même morceau dans l'ordre.

══ ÉTAPE 1 — TRANSCRIPTION LIBRE (obligatoire) ══
Avant tout JSON, transcris chaque section mesure par mesure dans ce format :
  [Nom de section] (x fois si reprise)
  M1: Am(4) | M2: G(2) C(2) | M3: F(4) | M4: E7(4)

Règles de transcription :
- Chaque Mx = une mesure
- accord(N) = accord pendant N temps
- En 4/4 : total par mesure = 4 temps. En 3/4 : total = 3 temps.
- Accord sur toute la mesure : Am(4). Deux accords égaux : G(2) C(2). Quatre accords : G(1) Am(1) C(1) F(1).
- Accord tenu sur plusieurs mesures : répète-le (Am(4) | Am(4))
- Mesure vide : -(4)
- Reprises ||: :|| : note "x2" ou "x3" après le nom de section
- 1ère/2ème fois : transcris les deux variantes séparément

══ ÉTAPE 2 — JSON ══
Après la transcription, produis le JSON suivant (sans markdown autour) :
{
  "title": "",
  "artist": "",
  "key": "",
  "timeSignature": "4/4",
  "tempo": "",
  "sections": [
    {
      "label": "Intro",
      "repeat": 1,
      "chords": [
        {"chord": "Am", "beats": 4},
        {"chord": "G", "beats": 2},
        {"chord": "C", "beats": 2}
      ]
    }
  ]
}

Règles JSON :
- Base-toi UNIQUEMENT sur ta transcription de l'étape 1 pour remplir le JSON
- Tout accord DOIT commencer par A B C D E F ou G (majuscule) suivi optionnellement de # ou b
- Exemples valides : C, Am, G7, Fmaj7, Bb, F#m, Bm7b5. Invalides : m7, maj7, dim (sans racine)
- Mesure vide → {"chord": "", "beats": N}
- repeat = nombre de fois que la section est jouée (2 pour une reprise simple)`;

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'Clé API Anthropic non configurée.' }, { status: 503 });
  }

  // Vérification du quota OCR via le token Firebase
  let userId: string | null = null;
  const authHeader = req.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ') && process.env.FIREBASE_ADMIN_PROJECT_ID) {
    try {
      const idToken = authHeader.slice(7);
      const decoded = await getAdminAuth().verifyIdToken(idToken);
      userId = decoded.uid;

      const db = getAdminDb();
      const userDoc = await db.collection('users').doc(userId).get();
      if (userDoc.exists) {
        const sub = userDoc.data()?.subscription;
        const isPro = sub?.plan === 'pro' && (sub?.status === 'active' || sub?.status === 'trialing');

        if (!isPro) {
          // Vérifier si le reset mensuel est passé
          const resetAt = sub?.ocrResetAt?.toDate?.();
          const ocrUsed = resetAt && new Date() > resetAt ? 0 : (sub?.ocrUsedThisMonth ?? 0);
          const earnedCredits = sub?.earnedOcrCredits ?? 0;

          if (ocrUsed >= FREE_OCR_LIMIT && earnedCredits <= 0) {
            return NextResponse.json({
              error: 'Limite d\'analyses atteinte pour ce mois. Passe à ChordSheet Pro pour des analyses illimitées.',
              upgradeRequired: true,
            }, { status: 429 });
          }
        }
      }
    } catch {
      // Token invalide → on continue sans blocage (fail open pour ne pas bloquer les admins)
    }
  }

  try {
    const body = await req.json().catch(() => null);
    const files: { data: string; type: string }[] = body?.files ?? [];
    if (!files.length) {
      return NextResponse.json({ error: 'Aucun fichier fourni.' }, { status: 400 });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json({ error: `Format non supporté : ${file.type}. Utilise JPG, PNG ou WebP.` }, { status: 400 });
      }
    }

    const imageContents = files.map((file) => ({
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: file.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
        data: file.data,
      },
    }));

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      messages: [{
        role: 'user',
        content: [
          ...imageContents,
          { type: 'text', text: PROMPT },
        ],
      }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';

    if (message.stop_reason === 'max_tokens') {
      throw new SyntaxError('Réponse tronquée (partition trop longue). Essaie avec moins de pages à la fois.');
    }

    // Extraire le JSON depuis la réponse (après la transcription libre de l'étape 1)
    const jsonMatch = text.match(/\{[\s\S]*\}(?=[^}]*$)/);
    if (!jsonMatch) throw new SyntaxError('Aucun JSON trouvé dans la réponse du modèle.');
    const cleaned = jsonMatch[0].trim();
    const parsed = JSON.parse(cleaned);

    // Normaliser et filtrer les accords
    const validRoot = /^[A-G][#b]?/;
    if (Array.isArray(parsed.sections)) {
      for (const section of parsed.sections) {
        if (Array.isArray(section.chords)) {
          section.chords = section.chords.map((c: unknown) => {
            // Compatibilité si Claude renvoie encore des strings
            if (typeof c === 'string') return { chord: validRoot.test(c) ? c : '', beats: parsed.timeSignature?.startsWith('3') ? 3 : 4 };
            const obj = c as { chord?: string; beats?: number };
            const chord = typeof obj.chord === 'string' && (obj.chord === '' || validRoot.test(obj.chord)) ? obj.chord : '';
            const beats = typeof obj.beats === 'number' && obj.beats > 0 ? obj.beats : (parsed.timeSignature?.startsWith('3') ? 3 : 4);
            return { chord, beats };
          });
        }
      }
    }

    // Incrémenter le compteur OCR pour les utilisateurs free
    if (userId && process.env.FIREBASE_ADMIN_PROJECT_ID) {
      try {
        const db = getAdminDb();
        const userDoc = await db.collection('users').doc(userId).get();
        const sub = userDoc.data()?.subscription;
        const isPro = sub?.plan === 'pro' && (sub?.status === 'active' || sub?.status === 'trialing');
        if (!isPro) {
          const resetAt = sub?.ocrResetAt?.toDate?.();
          const nextReset = new Date();
          nextReset.setMonth(nextReset.getMonth() + 1);
          const ocrUsed = resetAt && new Date() > resetAt ? 0 : (sub?.ocrUsedThisMonth ?? 0);
          const earnedCredits = sub?.earnedOcrCredits ?? 0;

          if (ocrUsed >= FREE_OCR_LIMIT && earnedCredits > 0) {
            // Consommer un crédit gagné plutôt que le quota mensuel
            await db.collection('users').doc(userId).update({
              'subscription.earnedOcrCredits': FieldValue.increment(-1),
            });
          } else if (resetAt && new Date() > resetAt) {
            // Reset du compteur + incrément
            await db.collection('users').doc(userId).update({
              'subscription.ocrUsedThisMonth': 1,
              'subscription.ocrResetAt': nextReset,
            });
          } else {
            await db.collection('users').doc(userId).update({
              'subscription.ocrUsedThisMonth': FieldValue.increment(1),
              'subscription.ocrResetAt': resetAt ?? nextReset,
            });
          }
        }
      } catch { /* silencieux */ }
    }

    return NextResponse.json(parsed);
  } catch (e) {
    if (e instanceof SyntaxError) {
      return NextResponse.json({ error: 'Impossible de parser la réponse du modèle.' }, { status: 500 });
    }
    const msg = e instanceof Error ? e.message : 'Erreur inconnue';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
