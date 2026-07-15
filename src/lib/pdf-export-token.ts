import { getAdminDb } from './firebase-admin';

// Jeton court-lived, à usage unique, pour autoriser le navigateur headless (Puppeteer)
// à accéder à la page de rendu PDF sans authentification Firebase. Collection non exposée
// aux clients (aucune règle Firestore ne la couvre → refusée par défaut).
const TOKEN_TTL_MS = 2 * 60 * 1000;

interface ExportTokenData {
  setId: string;
  userId: string;
  createdAt: number;
}

export async function createExportToken(setId: string, userId: string): Promise<string> {
  const db = getAdminDb();
  const token = crypto.randomUUID().replace(/-/g, '');
  await db.collection('exportTokens').doc(token).set({
    setId,
    userId,
    createdAt: Date.now(),
  } satisfies ExportTokenData);
  return token;
}

export async function verifyAndConsumeExportToken(token: string, setId: string): Promise<{ userId: string } | null> {
  const db = getAdminDb();
  const ref = db.collection('exportTokens').doc(token);
  const snap = await ref.get();
  if (!snap.exists) return null;

  const data = snap.data() as ExportTokenData;
  await ref.delete().catch(() => {});

  if (data.setId !== setId) return null;
  if (Date.now() - data.createdAt > TOKEN_TTL_MS) return null;
  return { userId: data.userId };
}
