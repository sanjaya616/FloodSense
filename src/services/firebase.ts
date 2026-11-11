/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, Firestore, doc, getDocFromServer } from 'firebase/firestore';
import rawFirebaseConfig from '../../firebase-applet-config.json';

export interface FirebaseConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  firestoreDatabaseId?: string;
}

let firebaseConfig: FirebaseConfig | null = null;

const isValidString = (str?: string) =>
  typeof str === 'string' && str.trim().length > 0 && str !== 'remixed-project-id';

if (
  rawFirebaseConfig &&
  isValidString(rawFirebaseConfig.apiKey) &&
  isValidString(rawFirebaseConfig.projectId)
) {
  firebaseConfig = rawFirebaseConfig;
} else if (import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_PROJECT_ID) {
  firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (firebaseConfig && firebaseConfig.apiKey && firebaseConfig.projectId) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    auth = getAuth(app);
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');
  } catch (err) {
    console.warn('Firebase initialization deferred: using Demonstration Service Layer.', err);
  }
}

export { app, auth, db, firebaseConfig };

export const isFirebaseConfigured = (): boolean => {
  return !!(app && db && auth);
};

export const googleProvider = new GoogleAuthProvider();

export async function testFirestoreConnection(): Promise<boolean> {
  if (!db) return false;
  try {
    await getDocFromServer(doc(db, 'system', 'connection_probe'));
    return true;
  } catch (err: any) {
    if (err?.code === 'permission-denied' || err?.code === 'not-found') {
      return true;
    }
    return false;
  }
}
