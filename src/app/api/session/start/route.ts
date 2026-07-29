import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth, getAdminFieldValue } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isProSub(sub: any): boolean {
  return sub?.plan === 'pro' && (sub?.status === 'active' || sub?.status === 'trialing');
}

// Démarrage d'une session live côté serveur (admin) :
// - compte Pro : illimité.
// - compte non-Pro : une seule session offerte (amorce), marquée en base pour ne
//   pas être réutilisée. La règle Firestore garde `create: isProUser` ; l'admin la
//   contourne, donc un non-Pro ne peut PAS créer de session directement côté client.
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ') || !process.env.FIREBASE_ADMIN_PROJECT_ID) {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  }

  let userId: string;
  let displayName = '';
  try {
    const decoded = await getAdminAuth().verifyIdToken(authHeader.slice(7));
    userId = decoded.uid;
    displayName = (decoded.name as string) || '';
  } catch {
    return NextResponse.json({ error: 'Session invalide, reconnecte-toi.' }, { status: 401 });
  }

  const db = getAdminDb();
  const FieldValue = getAdminFieldValue();
  const userRef = db.collection('users').doc(userId);
  const subRef = userRef.collection('private').doc('subscription');

  // 1. Vérifier le droit et, si session offerte, la consommer dans une transaction
  //    (évite deux créations simultanées sur le même compte gratuit).
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.runTransaction(async (tx: any) => {
      const [userSnap, subSnap] = await Promise.all([tx.get(userRef), tx.get(subRef)]);
      const sub = subSnap.exists ? subSnap.data() : undefined;
      if (!displayName) displayName = (userSnap.exists ? userSnap.data()?.displayName : '') || '';
      if (isProSub(sub)) return; // Pro : rien à consommer
      if (sub?.freeLiveSessionUsedAt) throw new Error('FREE_USED');
      tx.set(subRef, { freeLiveSessionUsedAt: FieldValue.serverTimestamp() }, { merge: true });
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    if (e?.message === 'FREE_USED') {
      return NextResponse.json({ error: 'FREE_USED' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Erreur lors de la vérification.' }, { status: 500 });
  }

  // 2. Générer un code unique puis créer la session.
  try {
    let code = generateCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      const existing = await db.collection('liveSessions').doc(code).get();
      if (!existing.exists) break;
      code = generateCode();
    }
    await db.collection('liveSessions').doc(code).set({
      hostId: userId,
      hostName: displayName,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
      currentSheetId: null,
      currentSheetTitle: null,
      currentSheetArtist: null,
      pushedBy: null,
      pushedByName: null,
    });
    return NextResponse.json({ code });
  } catch {
    return NextResponse.json({ error: 'Erreur lors du démarrage de la session.' }, { status: 500 });
  }
}
