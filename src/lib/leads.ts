import { getDb, isFirebaseConfigured } from "./firebase";

export interface LeadSubmission {
  calculator: string;
  category: string;
  name: string;
  phone: string;
  email: string;
  projectInterest: string;
  note: string;
}

export { isFirebaseConfigured };

// Writes one document to the top-level `leads` collection. Matches the field
// set required by the Firestore security rules (calculator, category, name,
// phone, email, note, createdAt) — keep those two in sync if either changes.
//
// notified: false lets the emailOnNewLead Cloud Function (see
// firebase-leads-functions/) know this lead hasn't been included in a
// notification email yet — it flips to true once it's actually been sent,
// so future emails only show what's new since the last one, not the
// entire history every time.
export async function submitLead(lead: LeadSubmission): Promise<boolean> {
  const dbPromise = getDb();
  if (!dbPromise) return false;
  try {
    const [db, { addDoc, collection, serverTimestamp }] = await Promise.all([dbPromise, import("firebase/firestore")]);
    await addDoc(collection(db, "leads"), {
      ...lead,
      notified: false,
      createdAt: serverTimestamp(),
    });
    return true;
  } catch {
    return false;
  }
}
