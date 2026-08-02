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
  let sansReponse = 0;

  /**
   * Écart constant en demi-tons entre la tonalité déduite et celle enregistrée.
   *
   * GetSongBPM donne la tonalité de l'enregistrement ; la grille, elle, est souvent
   * écrite avec un capo ou transposée pour être jouable. Les deux peuvent alors être
   * justes tout en différant d'un intervalle fixe. Si les écarts se concentrent sur
   * un ou deux intervalles — et surtout s'ils correspondent au capo — ce ne sont pas
   * des erreurs de calcul.
   */
  const intervalles = new Map<number, number>();
  let capoExplique = 0;
  let avecCapo = 0;
  let exactSansCapo = 0;
  let compareSansCapo = 0;

  const ecarts: { title: string; stored: string; detected: string; capo: number; demiTons: number; confidence: number }[] = [];

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
    const capo = sheet.capo ?? 0;
    compared++;
    if (capo > 0) avecCapo++; else compareSansCapo++;
    if (!guess) { sansReponse++; continue; }

    const detected = parseKey(guess.key);
    if (!detected) { sansReponse++; continue; }

    const juste = detected.tonic === stored.tonic && detected.minor === stored.minor;
    if (juste) {
      exact++;
      if (capo === 0) exactSansCapo++;
      continue;
    }
    if (sontRelatives(detected, stored)) { relative++; continue; }

    // Même mode, fondamentale décalée : on note de combien.
    if (detected.minor === stored.minor) {
      const demiTons = ((stored.tonic - detected.tonic) % 12 + 12) % 12;
      intervalles.set(demiTons, (intervalles.get(demiTons) ?? 0) + 1);
      // Le capo monte la hauteur réelle d'autant de demi-tons que de cases.
      if (capo > 0 && demiTons === capo % 12) capoExplique++;
    }

    if (ecarts.length < 15) {
      ecarts.push({
        title: sheet.title, stored: sheet.key, detected: guess.key, capo,
        demiTons: detected.minor === stored.minor ? ((stored.tonic - detected.tonic) % 12 + 12) % 12 : -1,
        confidence: Number(guess.confidence.toFixed(2)),
      });
    }
  }

  return NextResponse.json({
    total: snap.size,
    compared,
    exact,
    relative,
    different: compared - exact - relative - sansReponse,
    sansReponse,
    avecCapo,
    capoExplique,
    sansCapo: { compare: compareSansCapo, exact: exactSansCapo },
    // Intervalles les plus fréquents, du plus courant au moins courant.
    intervalles: [...intervalles.entries()].sort((a, b) => b[1] - a[1]).map(([demiTons, n]) => ({ demiTons, n })),
    ecarts,
  });
}
