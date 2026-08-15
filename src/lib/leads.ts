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
// contact, note, createdAt) — keep those two in sync if either changes.
export async function submitLead(lead: LeadSubmission): Promise<boolean> {
  const dbPromise = getDb();
  if (!dbPromise) return false;
  try {
    const [db, { addDoc, collection, serverTimestamp }] = await Promise.all([dbPromise, import("firebase/firestore")]);
    await addDoc(collection(db, "leads"), {
      ...lead,
      createdAt: serverTimestamp(),
    });
    return true;
  } catch {
    return false;
  }
}
