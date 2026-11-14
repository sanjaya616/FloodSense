/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, Firestore, doc, getDocFromServer } from 'firebase/firestore';
import {
  getStorage,
  FirebaseStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
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

const sanitizeEnvValue = (str?: string): string => {
  if (typeof str !== 'string') return '';
  let s = str.trim();
  if (s.endsWith(',')) s = s.slice(0, -1).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s;
};

const isValidString = (str?: string) => {
  const s = sanitizeEnvValue(str);
  return s.length > 0 && s !== 'remixed-project-id' && !s.startsWith('MY_FIREBASE_');
};

// Prioritize provisioned firebase-applet-config.json, then fallback to sanitized VITE_FIREBASE_* env vars
const viteEnv = typeof import.meta !== 'undefined' && (import.meta as any).env ? (import.meta as any).env : {};
if (
  rawFirebaseConfig &&
  isValidString(rawFirebaseConfig.apiKey) &&
  isValidString(rawFirebaseConfig.projectId)
) {
  firebaseConfig = {
    apiKey: rawFirebaseConfig.apiKey.trim(),
    authDomain: rawFirebaseConfig.authDomain?.trim() || `${rawFirebaseConfig.projectId.trim()}.firebaseapp.com`,
    projectId: rawFirebaseConfig.projectId.trim(),
    storageBucket: rawFirebaseConfig.storageBucket?.trim() || `${rawFirebaseConfig.projectId.trim()}.firebasestorage.app`,
    messagingSenderId: rawFirebaseConfig.messagingSenderId?.trim(),
    appId: rawFirebaseConfig.appId?.trim(),
    firestoreDatabaseId: rawFirebaseConfig.firestoreDatabaseId?.trim(),
  };
} else if (isValidString(viteEnv.VITE_FIREBASE_API_KEY) && isValidString(viteEnv.VITE_FIREBASE_PROJECT_ID)) {
  const cleanProjectId = sanitizeEnvValue(viteEnv.VITE_FIREBASE_PROJECT_ID);
  firebaseConfig = {
    apiKey: sanitizeEnvValue(viteEnv.VITE_FIREBASE_API_KEY),
    authDomain: sanitizeEnvValue(viteEnv.VITE_FIREBASE_AUTH_DOMAIN) || `${cleanProjectId}.firebaseapp.com`,
    projectId: cleanProjectId,
    storageBucket: sanitizeEnvValue(viteEnv.VITE_FIREBASE_STORAGE_BUCKET) || `${cleanProjectId}.appspot.com`,
    messagingSenderId: sanitizeEnvValue(viteEnv.VITE_FIREBASE_MESSAGING_SENDER_ID),
    appId: sanitizeEnvValue(viteEnv.VITE_FIREBASE_APP_ID),
    firestoreDatabaseId: sanitizeEnvValue(viteEnv.VITE_FIREBASE_DATABASE_ID) || rawFirebaseConfig?.firestoreDatabaseId,
  };
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

if (firebaseConfig && firebaseConfig.apiKey && firebaseConfig.projectId) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    auth = getAuth(app);
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');
    storage = getStorage(app);
  } catch (err) {
    console.warn('Firebase initialization deferred: Demonstration Service Layer will be used.', err);
  }
}

export { app, auth, db, storage, firebaseConfig };

export enum FirestoreOperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(
  error: unknown,
  operationType: FirestoreOperationType,
  path: string | null
): never {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      providerInfo:
        auth?.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

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

export interface StorageUploadResult {
  downloadUrl: string;
  storagePath: string | null;
}

/**
 * Uploads a validated photograph to Firebase Storage and returns both URL and path for cleanup.
 */
export async function uploadPhotographToStorage(
  file: File,
  userId: string,
  onProgress?: (progressPercent: number) => void
): Promise<StorageUploadResult> {
  const validMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!validMimes.includes(file.type.toLowerCase())) {
    throw new Error('Unsupported image format. Allowed formats: JPG, JPEG, PNG, WEBP.');
  }

  const maxBytes = 5 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error('Image file exceeds the 5MB maximum upload limit.');
  }

  if (storage && auth?.currentUser) {
    const safeFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const storagePath = `reports/${userId}/${safeFileName}`;
    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: file.type,
    });

    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (onProgress) onProgress(Math.round(progress));
        },
        (error) => {
          console.error('Firebase Storage upload failed:', error);
          reject(new Error(`Storage upload error: ${error.message}`));
        },
        async () => {
          try {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            resolve({ downloadUrl, storagePath });
          } catch (err: any) {
            reject(new Error(`Failed to retrieve download URL: ${err.message}`));
          }
        }
      );
    });
  }

  return {
    downloadUrl: URL.createObjectURL(file),
    storagePath: null,
  };
}

/**
 * Cleans up an orphaned Firebase Storage file when a paired Firestore write fails.
 */
export async function deleteStoragePath(storagePath: string | null | undefined): Promise<void> {
  if (!storage || !storagePath) return;
  try {
    await deleteObject(ref(storage, storagePath));
  } catch (err) {
    console.warn('Orphaned Storage cleanup skipped/failed:', err);
  }
}
