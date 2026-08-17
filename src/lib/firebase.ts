// Firebase is ONLY used for one thing in this whole app: storing lead
// submissions from the "ad space available" form (src/components/LeadForm.tsx)
// when a Singapore-verified advertiser signs up for a slot. Every calculator
// itself remains fully local — no accounts, no backend, nothing sent to a
// server — that promise is unaffected.
//
// Config comes from Vite env vars (VITE_FIREBASE_*), set in .env.local for
// local dev and in Railway's service variables for production. These are
// public client keys (not secrets) — safe to expose in a built frontend
// bundle, same as any Firebase web app. Actual write access is restricted
// by Firestore security rules (create-only, no read/update/delete from the
// client), not by hiding this config.
//
// If the env vars aren't set (e.g. this hasn't been wired up on Railway
// yet), isFirebaseConfigured() returns false and LeadForm falls back to a
// plain mailto link instead of throwing or breaking the build.
//
// The Firebase SDK itself is loaded via dynamic import() inside getDb(),
// not a top-level import — most page loads never touch a lead form at all
// (nobody's clicked an ad-slot intent yet), so there's no reason to ship
// ~100KB+ gzipped of Firestore client code in every calculator's main
// bundle. It's fetched lazily, once, only when actually needed.

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
}

let dbPromise: Promise<import("firebase/firestore").Firestore> | null = null;

export function getDb(): Promise<import("firebase/firestore").Firestore> | null {
  if (!isFirebaseConfigured()) return null;
  if (!dbPromise) {
    dbPromise = Promise.all([import("firebase/app"), import("firebase/firestore")]).then(
      ([{ initializeApp, getApps, getApp }, { initializeFirestore }]) => {
        const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
        // ignoreUndefinedProperties: without this, Firestore throws at write time
        // if ANY field is `undefined` (e.g. an optional field like floorAreaSqft
        // or videoUrl that the person left blank) — easy to trip over since
        // that's valid, normal JS, not an error condition from the caller's side.
        return initializeFirestore(app, { ignoreUndefinedProperties: true });
      }
    );
  }
  return dbPromise;
}

let storagePromise: Promise<import("firebase/storage").FirebaseStorage> | null = null;

// Same lazy-load-once pattern as getDb() — only touched by the Property
// Listings photo upload flow, so most page loads never pull in the Storage
// SDK either.
export function getStorageInstance(): Promise<import("firebase/storage").FirebaseStorage> | null {
  if (!isFirebaseConfigured()) return null;
  if (!storagePromise) {
    storagePromise = Promise.all([import("firebase/app"), import("firebase/storage")]).then(
      ([{ initializeApp, getApps, getApp }, { getStorage }]) => {
        const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
        return getStorage(app);
      }
    );
  }
  return storagePromise;
}

