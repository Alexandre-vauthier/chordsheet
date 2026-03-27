'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth, getDb } from './firebase';
import type { User } from '@/types';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (updates: { displayName?: string; photoURL?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Écouter les changements d'état d'authentification
  useEffect(() => {
    const auth = getAuth();
    const db = getDb();

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);

      if (fbUser) {
        // Récupérer les données utilisateur depuis Firestore
        const userDoc = await getDoc(doc(db, 'users', fbUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUser({
            id: fbUser.uid,
            displayName: userData.displayName || fbUser.displayName || '',
            email: userData.email || fbUser.email || '',
            photoURL: userData.photoURL || fbUser.photoURL,
            createdAt: userData.createdAt?.toDate() || new Date(),
            updatedAt: userData.updatedAt?.toDate() || new Date(),
          });
        } else {
          // Créer le document utilisateur s'il n'existe pas
          const newUser: Omit<User, 'id'> = {
            displayName: fbUser.displayName || '',
            email: fbUser.email || '',
            photoURL: fbUser.photoURL,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          await setDoc(doc(db, 'users', fbUser.uid), {
            ...newUser,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          setUser({ id: fbUser.uid, ...newUser });
        }
      } else {
        setUser(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Connexion
  const signIn = async (email: string, password: string) => {
    const auth = getAuth();
    await signInWithEmailAndPassword(auth, email, password);
  };

  // Inscription
  const signUp = async (email: string, password: string, displayName: string) => {
    const auth = getAuth();
    const db = getDb();
    const credential = await createUserWithEmailAndPassword(auth, email, password);

    // Mettre à jour le profil Firebase
    await updateProfile(credential.user, { displayName });

    // Créer le document utilisateur dans Firestore
    await setDoc(doc(db, 'users', credential.user.uid), {
      displayName,
      email,
      photoURL: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  // Déconnexion
  const signOut = async () => {
    const auth = getAuth();
    await firebaseSignOut(auth);
  };

  // Mettre à jour le profil utilisateur
  const updateUser = async (updates: { displayName?: string; photoURL?: string }) => {
    const auth = getAuth();
    const db = getDb();
    const currentUser = auth.currentUser;

    if (!currentUser || !user) {
      throw new Error('User not authenticated');
    }

    // Mettre à jour Firebase Auth
    await updateProfile(currentUser, updates);

    // Mettre à jour Firestore
    await setDoc(doc(db, 'users', currentUser.uid), {
      ...updates,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    // Mettre à jour l'état local
    setUser({
      ...user,
      ...updates,
      updatedAt: new Date(),
    });
  };

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading, signIn, signUp, signOut, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
