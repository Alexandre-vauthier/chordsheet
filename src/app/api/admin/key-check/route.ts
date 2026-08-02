import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/lib/firebase-admin';
import { fromFirestore } from '@/lib/firestore-helpers';
import { collectSheetChords } from '@/lib/sheet-chords';
import { detectKey, parseChordName } from '@/lib/key-detection';
import type { Sheet } from '@/types';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * Mesure l'accord entre la tonalité déduite des accords et celle déjà renseignée.
 *
 * Lecture seule : rien n'est écrit. L'objectif est de décider si la déduction mérite
 * d'être proposée aux utilisateurs, sur des données réelles plutôt que sur mon
 * échantillon de morceaux connus.
 *
 * Le relatif est compté à part. Do majeur et La mineur partagent tous leurs accords :
 * les confondre est l'erreur attendue, et proposer le relatif reste plus utile qu'un
 * champ vide. Les mélanger aux vraies erreurs masquerait ce qui se passe.
 */

const SEMITONE: Record<string, number> = {
  C: 0, 'B#': 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, Fb: 4,
  F: 5, 'E#': 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9,
  'A#': 10, Bb: 10, B: 11, Cb: 11,
};

/** « Am » → tonique 9, mode mineur. Rend null si la saisie n'est pas exploitable. */
function parseKey(raw: string): { tonic: number; minor: boolean } | null {
  const m = raw.trim().match(/^([A-G][b#]?)\s*(m|min|minor)?\b/i);
  if (!m) return null;
  const tonic = SEMITONE[m[1].charAt(0).toUpperCase() + m[1].slice(1)];
  if (tonic === undefined) return null;
  return { tonic, minor: !!m[2] };
}

/** Deux tonalités relatives partagent leur armure : la mineure est neuf demi-tons plus haut. */
function sontRelatives(a: { tonic: number; minor: boolean }, b: { tonic: number; minor: boolean }): boolean {
  if (a.minor === b.minor) return false;
  const [maj, min] = a.minor ? [b, a] : [a, b];
  return (maj.tonic + 9) % 12 === min.tonic;
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ') || !process.env.FIREBASE_ADMIN_PROJECT_ID) {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  }

  let userId: string;
  try {
    const decoded = await getAdminAuth().verifyIdToken(authHeader.slice(7));
    userId = decoded.uid;
  } catch (authErr) {
    console.error('[admin/key-check] Firebase auth error:', authErr);
    return NextResponse.json({ error: 'Session invalide, reconnecte-toi.' }, { status: 401 });
  }

  const db = getAdminDb();
  const userSnap = await db.collection('users').doc(userId).get();
  if (userSnap.data()?.role !== 'admin') {
    return NextResponse.json({ error: 'Réservé aux administrateurs.' }, { status: 403 });
  }

  const snap = await db.collection('sheets').get();

  let compared = 0;
  let exact = 0;
  let relative = 0;
  const ecarts: { title: string; stored: string; detected: string; confidence: number }[] = [];
  let sansReponse = 0;

  for (const doc of snap.docs) {
    const sheet = fromFirestore(doc.id, doc.data()) as Sheet;

    const stored = parseKey(sheet.key ?? '');
    if (!stored) continue;

    // Les accords dans l'ordre de la grille : le premier et le dernier départagent une
    // tonalité de son relatif, un ensemble dédoublonné perdrait cette information.
    const suite: string[] = [];
    for (const section of sheet.sections ?? []) {
      for (const row of section.rows ?? []) {
        for (const cell of row) {
          if (cell.chord?.trim() && parseChordName(cell.chord)) suite.push(cell.chord.trim());
        }
      }
    }
    if (collectSheetChords(sheet).size < 2) continue;

    const guess = detectKey(suite);
    compared++;
    if (!guess) { sansReponse++; continue; }

    const detected = parseKey(guess.key);
    if (detected && detected.tonic === stored.tonic && detected.minor === stored.minor) exact++;
    else if (detected && sontRelatives(detected, stored)) relative++;
    else if (ecarts.length < 12) {
      ecarts.push({ title: sheet.title, stored: sheet.key, detected: guess.key, confidence: Number(guess.confidence.toFixed(2)) });
    }
  }

  return NextResponse.json({
    total: snap.size,
    compared,
    exact,
    relative,
    different: compared - exact - relative - sansReponse,
    sansReponse,
    ecarts,
  });
}
