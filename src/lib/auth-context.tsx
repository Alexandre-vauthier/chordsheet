'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  reload,
} from 'firebase/auth';
import { doc, setDoc, getDoc, getDocs, collection, query, where, writeBatch, serverTimestamp } from 'firebase/firestore';
import { getAuth, getDb } from './firebase';
import type { User, UserRole, UserPreferences, CreatorReputation } from '@/types';
import { readPreferences } from './user-preferences';

/**
 * Ce qu'on peut modifier sur un utilisateur.
 *
 * Une seule déclaration, employée par l'interface du contexte comme par
 * l'implémentation : les deux avaient divergé, l'une connaissant
 * `showChordSummaryByDefault` et l'autre non.
 */
type UserUpdate = Partial<UserPreferences> & {
  displayName?: string;
  photoURL?: string | null;
  bio?: string;
  links?: { url: string }[];
  reputation?: CreatorReputation;
};
import { isAdminEmail } from '@/types';
import * as Sentry from '@sentry/nextjs';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  isAdmin: boolean;
  emailVerified: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshEmailVerification: () => Promise<boolean>;
  updateUser: (updates: UserUpdate) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Demande l'envoi du mail de confirmation à notre route serveur.
 *
 * On ne passe plus par `sendEmailVerification` du SDK : Firebase expédiait depuis
 * `firebaseapp.com`, un domaine étranger à la marque, ce que les filtres sanctionnent.
 * La route serveur produit le même lien via l'Admin SDK et l'envoie depuis notre
 * domaine, avec notre gabarit.
 */
async function requestVerificationEmail(user: FirebaseUser): Promise<void> {
  const token = await user.getIdToken();
  const locale = typeof document !== 'undefined' && document.documentElement.lang === 'en' ? 'en' : 'fr';

  const res = await fetch(`/api/auth/send-verification?locale=${locale}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  // Le code HTTP est porté par le message : l'écran d'attente distingue « trop de
  // demandes » d'une panne d'envoi, qui n'appellent pas la même conduite.
  if (!res.ok) throw new Error(String(res.status));
}

/**
 * Signale aux administrateurs qu'un compte vient d'être créé.
 *
 * Appelé aux deux endroits où un document utilisateur naît : l'inscription par mot
 * de passe, et la première connexion Google. Le serveur pose un drapeau une seule
 * fois par compte, un doublon d'appel est donc sans effet — c'est ce qui permet de
 * couvrir les deux chemins sans se demander lequel a gagné la course.
 *
 * Silencieux par construction : personne, ni l'inscrit ni nous, ne doit voir une
 * inscription échouer parce qu'un mail interne n'est pas parti.
 */
async function notifyAdminsOfSignup(user: FirebaseUser): Promise<void> {
  try {
    const token = await user.getIdToken();
    await fetch('/api/auth/notify-signup', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    /* sans effet sur l'inscription */
  }
}

/**
 * La connexion Google en cours, s'il y en a une.
 *
 * Hors du composant à dessein : deux pages différentes montent chacune leur
 * bouton, et c'est justement entre les deux que naissait la fenêtre de trop.
 */
let connexionGoogleEnCours: Promise<void> | null = null;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailVerified, setEmailVerified] = useState(true);

  // Écouter les changements d'état d'authentification
  useEffect(() => {
    const auth = getAuth();
    const db = getDb();

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setLoading(true);
      setFirebaseUser(fbUser);
      setEmailVerified(fbUser?.emailVerified ?? true);

      if (fbUser?.isAnonymous) {
        // Invité de session éphémère : pas de doc Firestore `users` créé pour éviter
        // de polluer la collection avec des comptes fantômes — l'identité pour cette
        // feature est firebaseUser.uid, jamais `user` (voir live-session-context.tsx)
        setUser(null);
        setLoading(false);
        return;
      }

      if (fbUser) {
        // Récupérer les données utilisateur depuis Firestore
        // (les données d'abonnement vivent dans un sous-document privé, non lisible par les autres utilisateurs)
        const [userDoc, subDoc] = await Promise.all([
          getDoc(doc(db, 'users', fbUser.uid)),
          getDoc(doc(db, 'users', fbUser.uid, 'private', 'subscription')),
        ]);
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const email = userData.email || fbUser.email || '';
          const role: UserRole = isAdminEmail(email) ? 'admin' : (userData.role || 'user');

          /**
           * Aligner le rôle stocké sur la liste, dans les deux sens.
           *
           * La synchronisation ne montait que : retirer une adresse d'ADMIN_EMAILS ne
           * retirait donc rien du tout, puisque `role` retombait sur la valeur écrite
           * en base lors d'une connexion précédente — et les règles Firestore lisent
           * ce champ, pas la liste. Un ancien administrateur restait administrateur.
           *
           * La liste est la seule source du rôle (rien dans l'application ne promeut
           * à la main), l'écart peut donc être corrigé sans risque d'écraser une
           * décision prise ailleurs.
           */
          if (role !== userData.role) {
            setDoc(doc(db, 'users', fbUser.uid), { role }, { merge: true }).catch(() => {});
          }

          // Désérialiser la subscription si présente
          const rawSub = subDoc.exists() ? subDoc.data() : undefined;
          const subscription = rawSub ? {
            plan: rawSub.plan || 'free',
            status: rawSub.status || 'active',
            stripeCustomerId: userData.stripeCustomerId || rawSub.stripeCustomerId || undefined,
            stripeSubscriptionId: rawSub.stripeSubscriptionId || undefined,
            currentPeriodEnd: rawSub.currentPeriodEnd?.toDate?.() || undefined,
            ocrUsedThisMonth: rawSub.ocrUsedThisMonth ?? 0,
            ocrResetAt: rawSub.ocrResetAt?.toDate?.() || undefined,
            earnedOcrCredits: rawSub.earnedOcrCredits ?? 0,
            freeLiveSessionUsedAt: rawSub.freeLiveSessionUsedAt?.toDate?.() || undefined,
          } : undefined;

          const rawRep = userData.reputation;
          const reputation = rawRep ? {
            score: rawRep.score ?? 0,
            level: rawRep.level ?? 'Découvreur',
            badges: rawRep.badges ?? [],
            lastComputedAt: rawRep.lastComputedAt?.toDate?.() || new Date(),
          } : undefined;

          setUser({
            id: fbUser.uid,
            displayName: userData.displayName || fbUser.displayName || '',
            email,
            photoURL: userData.photoURL || fbUser.photoURL,
            role,
            subscription,
            reputation,
            // Toutes les préférences d'un coup, par une boucle : les énumérer ici
            // avait fini par en oublier une — `showChordSummaryByDefault` était
            // écrite en base mais jamais relue, si bien que le réglage ne
            // survivait pas à un rechargement.
            ...readPreferences(userData as Record<string, unknown>),
            bio: userData.bio,
            links: Array.isArray(userData.links) ? userData.links : undefined,
            createdAt: userData.createdAt?.toDate() || new Date(),
            updatedAt: userData.updatedAt?.toDate() || new Date(),
          });
          // Enregistrer la date de dernière visite (silencieux)
          setDoc(doc(db, 'users', fbUser.uid), { lastVisitAt: serverTimestamp() }, { merge: true }).catch(() => {});
          // Appliquer le thème dès le chargement
          document.documentElement.setAttribute('data-theme', (userData.darkMode ?? true) ? 'dark' : 'light');
        } else {
          // Créer le document utilisateur s'il n'existe pas
          const email = fbUser.email || '';
          const role: UserRole = isAdminEmail(email) ? 'admin' : 'user';
          const newUser: Omit<User, 'id'> = {
            displayName: fbUser.displayName || '',
            email,
            photoURL: fbUser.photoURL,
            role,
            // Nouveaux comptes : coloration des accords activée par défaut.
            chordColorCoding: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          await setDoc(doc(db, 'users', fbUser.uid), {
            ...newUser,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          setUser({ id: fbUser.uid, ...newUser });
          notifyAdminsOfSignup(fbUser);
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

  /**
   * Connexion par compte Google.
   *
   * Rien à créer côté données : l'écouteur d'état ci-dessus dépose déjà un document
   * utilisateur pour tout compte qui n'en a pas, en reprenant le nom et la photo du
   * fournisseur. Un compte Google arrive par ailleurs avec son adresse déjà vérifiée,
   * il ne rencontre donc pas la porte de confirmation.
   */
  const signInWithGoogle = async () => {
    // Une seule fenêtre à la fois, quel que soit le bouton cliqué.
    //
    // Chaque bouton « Continuer avec Google » se désactive pendant l'opération,
    // mais il y en a un par page (connexion, inscription) et chacun a son propre
    // état : passer de l'une à l'autre pendant qu'une fenêtre est ouverte en
    // demandait une seconde. Firebase rejette alors la première — et si elle
    // venait de se régler, il la rejette une fois de trop, ce qui déclenche son
    // assertion interne « Pending promise was never set ». Le second appel attend
    // donc le premier au lieu d'ouvrir une fenêtre concurrente.
    if (connexionGoogleEnCours) return connexionGoogleEnCours;

    const provider = new GoogleAuthProvider();
    // Force le choix du compte : sans ça, quelqu'un connecté à un compte Google sur
    // sa machine est enrôlé avec celui-là sans qu'on lui demande, ce qui surprend
    // ceux qui en ont plusieurs.
    provider.setCustomParameters({ prompt: 'select_account' });

    // Ces traces accompagnent le prochain rapport d'erreur : elles diront si la
    // connexion avait abouti avant que l'assertion ne survienne, ce qu'un rapport
    // seul ne permet pas de savoir.
    Sentry.addBreadcrumb({ category: 'auth', level: 'info', message: 'Google : ouverture de la fenêtre' });

    connexionGoogleEnCours = signInWithPopup(getAuth(), provider)
      .then(() => {
        Sentry.addBreadcrumb({ category: 'auth', level: 'info', message: 'Google : connexion réussie' });
      })
      .catch((e: unknown) => {
        const code = typeof e === 'object' && e && 'code' in e ? String((e as { code: string }).code) : 'inconnu';
        Sentry.addBreadcrumb({ category: 'auth', level: 'warning', message: `Google : échec (${code})` });
        throw e;
      })
      .finally(() => { connexionGoogleEnCours = null; });

    return connexionGoogleEnCours;
  };

  // Inscription
  const signUp = async (email: string, password: string, displayName: string) => {
    const auth = getAuth();
    const db = getDb();
    const credential = await createUserWithEmailAndPassword(auth, email, password);

    // Mettre à jour le profil Firebase
    await updateProfile(credential.user, { displayName });

    // Créer le document utilisateur dans Firestore
    const role: UserRole = isAdminEmail(email) ? 'admin' : 'user';
    await setDoc(doc(db, 'users', credential.user.uid), {
      displayName,
      email,
      photoURL: null,
      role,
      // Nouveaux comptes : coloration des accords activée par défaut.
      chordColorCoding: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Envoi par notre propre route, depuis notre domaine : le mail de Firebase
    // partait de firebaseapp.com et finissait en indésirable. Un échec ne doit pas
    // faire capoter l'inscription, le compte existe déjà à ce stade.
    await requestVerificationEmail(credential.user).catch(() => {});
    notifyAdminsOfSignup(credential.user);
  };

  // Renvoyer l'email de vérification
  const resendVerificationEmail = async () => {
    const auth = getAuth();
    if (auth.currentUser) {
      await requestVerificationEmail(auth.currentUser);
    }
  };

  // Rafraîchir le statut de vérification (après clic sur le lien reçu par email)
  const refreshEmailVerification = async () => {
    const auth = getAuth();
    if (!auth.currentUser) return false;
    await reload(auth.currentUser);
    setEmailVerified(auth.currentUser.emailVerified);
    setFirebaseUser(auth.currentUser);
    return auth.currentUser.emailVerified;
  };

  // Déconnexion
  const signOut = async () => {
    const auth = getAuth();
    await firebaseSignOut(auth);
  };

  /**
   * Suppression du compte, déléguée au serveur.
   *
   * Tout ce ménage se faisait ici, dans le navigateur, avec les droits de la
   * personne. Il ne le pouvait pas :
   *
   * - `ratings` n'a **aucune règle de suppression**, et le reste passait dans un
   *   seul `writeBatch` : ajouter les notes au lot aurait fait échouer la
   *   suppression entière, grilles et setlists comprises ;
   * - `deleteUser` exige une connexion récente, et il était appelé **après** la
   *   destruction des données : sur une session un peu ancienne, les données
   *   partaient, l'erreur tombait, et le compte survivait — vide ;
   * - un lot Firestore plafonne à 500 écritures, sans découpage nulle part.
   *
   * `/api/account/delete` fait le travail avec le SDK Admin, qui ignore les règles,
   * découpe en lots, et supprime le compte en dernier sans réauthentification. La
   * protection des comptes administrateurs y est reprise, et elle y est cette fois
   * hors de portée du navigateur.
   */
  const deleteAccount = async () => {
    const currentUser = getAuth().currentUser;
    if (!currentUser) throw new Error('User not authenticated');

    const reponse = await fetch('/api/account/delete', {
      method: 'POST',
      headers: { Authorization: `Bearer ${await currentUser.getIdToken()}` },
    });

    if (!reponse.ok) {
      const { error } = await reponse.json().catch(() => ({ error: null }));
      throw new Error(error ?? 'La suppression a échoué.');
    }

    // Le compte n'existe plus côté Firebase, mais la session du navigateur en garde
    // la trace : sans cela l'application continue de se croire connectée jusqu'au
    // prochain rafraîchissement du jeton.
    await firebaseSignOut(getAuth());
  };

  // Mettre à jour le profil utilisateur
  const updateUser = async (updates: UserUpdate) => {
    const auth = getAuth();
    const db = getDb();
    const currentUser = auth.currentUser;

    if (!currentUser || !user) {
      throw new Error('User not authenticated');
    }

    // Appliquer le thème immédiatement si changé
    if (updates.darkMode !== undefined) {
      document.documentElement.setAttribute('data-theme', updates.darkMode ? 'dark' : 'light');
    }

    /**
     * Firebase Auth n'accepte que le nom et la photo : on **choisit** ces deux
     * champs au lieu de retirer les autres un à un.
     *
     * Le tri par omission laissait passer cinq préférences — celles ajoutées après
     * l'écriture de la liste — vers une API qui n'en veut pas. Et l'appel partait à
     * chaque basculement d'interrupteur, pour un objet vide : un aller-retour
     * réseau par réglage, pour rien. On ne l'appelle plus que s'il y a quelque
     * chose à dire.
     */
    const authUpdates: { displayName?: string; photoURL?: string | null } = {};
    if (updates.displayName !== undefined) authUpdates.displayName = updates.displayName;
    if (updates.photoURL !== undefined) authUpdates.photoURL = updates.photoURL;
    if (Object.keys(authUpdates).length > 0) {
      await updateProfile(currentUser, authUpdates);
    }

    // Mettre à jour Firestore user doc
    await setDoc(doc(db, 'users', currentUser.uid), {
      ...updates,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    // Si le displayName change, mettre à jour ownerName sur toutes les grilles et sets
    if (updates.displayName) {
      const batch = writeBatch(db);

      // Mettre à jour les grilles
      const sheetsQuery = query(
        collection(db, 'sheets'),
        where('ownerId', '==', currentUser.uid)
      );
      const sheetsSnapshot = await getDocs(sheetsQuery);
      sheetsSnapshot.docs.forEach((docSnap) => {
        batch.update(doc(db, 'sheets', docSnap.id), {
          ownerName: updates.displayName,
        });
      });

      // Mettre à jour les sets
      const setsQuery = query(
        collection(db, 'sets'),
        where('ownerId', '==', currentUser.uid)
      );
      const setsSnapshot = await getDocs(setsQuery);
      setsSnapshot.docs.forEach((docSnap) => {
        batch.update(doc(db, 'sets', docSnap.id), {
          ownerName: updates.displayName,
        });
      });

      await batch.commit();
    }

    // Mettre à jour l'état local
    setUser({
      ...user,
      ...updates,
      updatedAt: new Date(),
    });
  };

  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading, isAdmin, emailVerified, signIn, signInWithGoogle, signUp, signOut, deleteAccount, updateUser, resendVerificationEmail, refreshEmailVerification }}>
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
