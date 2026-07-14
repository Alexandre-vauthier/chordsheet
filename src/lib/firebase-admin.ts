// Initialisation lazy de Firebase Admin pour éviter les crashes d'import dans Next.js
function ensureAdminApp() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { initializeApp, getApps, cert } = require('firebase-admin/app');
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }
}

export function getAdminDb() {
  ensureAdminApp();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getFirestore } = require('firebase-admin/firestore');
  return getFirestore();
}

export function getAdminAuth() {
  ensureAdminApp();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getAuth } = require('firebase-admin/auth');
  return getAuth();
}

export function getAdminFieldValue() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { FieldValue } = require('firebase-admin/firestore');
  return FieldValue;
}
