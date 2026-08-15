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
      ([{ initializeApp }, { getFirestore }]) => {
        const app = initializeApp(firebaseConfig);
        return getFirestore(app);
      }
    );
  }
  return dbPromise;
}

