import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import {
  Firestore, getFirestore, initializeFirestore,
  persistentLocalCache, persistentMultipleTabManager,
} from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

// Configuration Firebase - À remplacer par tes propres credentials
// Va sur https://console.firebase.google.com pour créer un projet
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Variables pour stocker les instances
let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;

// Fonction pour obtenir l'app Firebase (initialisation lazy)
function getFirebaseApp(): FirebaseApp {
  if (typeof window === 'undefined') {
    throw new Error('Firebase should only be initialized on the client side');
  }

  if (!app) {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  }
  return app;
}

// Fonction pour obtenir Auth
function getFirebaseAuth(): Auth {
  if (!auth) {
    auth = getAuth(getFirebaseApp());
  }
  return auth;
}

/**
 * Firestore, avec ses données gardées sur l'appareil.
 *
 * Une grille consultée une fois reste lisible sans réseau, et une modification
 * faite hors ligne part toute seule au retour de la connexion. C'est ce qui
 * permet de compter sur l'application en cave de répétition ou sur scène, là où
 * il n'y a ni wifi ni 4G — et c'est exactement le moment où on en a besoin.
 *
 * `persistentMultipleTabManager` parce qu'on ouvre volontiers une grille par
 * onglet : le gestionnaire simple laisse le cache au premier onglet venu et les
 * autres repassent en mémoire, donc sans rien hors ligne.
 *
 * Côté serveur, il n'y a pas d'IndexedDB : le rendu des pages publiques garde le
 * Firestore ordinaire. L'échec d'initialisation retombe dessus aussi, plutôt que
 * de priver l'application de sa base pour une histoire de cache (navigation
 * privée, stockage refusé, navigateur ancien).
 */
function getFirebaseDb(): Firestore {
  if (!db) {
    const app = getFirebaseApp();
    if (typeof window === 'undefined') return (db = getFirestore(app));
    try {
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      });
    } catch {
      db = getFirestore(app);
    }
  }
  return db;
}

// Fonction pour obtenir Storage
function getFirebaseStorage(): FirebaseStorage {
  if (!storage) {
    storage = getStorage(getFirebaseApp());
  }
  return storage;
}

export { getFirebaseApp as getApp, getFirebaseAuth as getAuth, getFirebaseDb as getDb, getFirebaseStorage as getStorage };
