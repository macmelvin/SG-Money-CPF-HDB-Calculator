import { getDb, isFirebaseConfigured } from "./firebase";

export { isFirebaseConfigured };

export type PropertyType = "HDB" | "Condo" | "EC" | "Landed";

export interface ListingSubmission {
  agentName: string;
  /** CEA registration number, e.g. "R123456A" — legally required on every
   *  property advertisement in Singapore (Estate Agents Act / CEA rules).
   *  Loosely validated (format only) in the UI, not verified against the
   *  actual CEA register — that would need a separate lookup integration. */
  ceaRegNumber: string;
  agentPhone: string;
  agentEmail: string;
  postalCode: string;
  district: string; // "D01".."D28", derived from postalCode
  propertyType: PropertyType;
  unitDescription: string; // e.g. "4-Room", "3-Bedroom Condo" — free text, not a strict enum
  price: number;
  floorAreaSqft?: number;
  description: string;
  /** Already-uploaded Storage download URLs (see photoUpload.ts) — uploaded
   *  BEFORE this submission, not as part of it. Max 8, enforced in the UI. */
  photoUrls?: string[];
  /** A link (YouTube, Instagram Reel, etc.), not a raw uploaded file — real
   *  estate portals generally do this too rather than hosting video
   *  directly, since video files are large/slow to upload and expensive to
   *  store/serve at scale. Loosely validated as a URL, not checked against
   *  a specific platform. */
  videoUrl?: string;
}

export interface Listing extends ListingSubmission {
  id: string;
  createdAt: number; // epoch ms
  status: "active" | "sold" | "withdrawn";
}

// Writes to a top-level `listings` collection. Requires its own Firestore
// security rules (create-only from the client, same pattern as `leads`) —
// see the rules snippet in the accompanying patch notes, since these can't
// be applied from code and need to be pasted into the Firebase console
// manually.
export async function submitListing(listing: ListingSubmission): Promise<boolean> {
  const dbPromise = getDb();
  if (!dbPromise) return false;
  try {
    const [db, { addDoc, collection, serverTimestamp }] = await Promise.all([dbPromise, import("firebase/firestore")]);
    await addDoc(collection(db, "listings"), {
      ...listing,
      status: "active",
      createdAt: serverTimestamp(),
    });
    return true;
  } catch {
    return false;
  }
}

// Fetches active listings for a given district, most recent first. Returns
// an empty array (not an error) if Firebase isn't configured or the query
// fails — callers should treat that the same as "no listings yet" rather
// than surfacing a technical error to agents/buyers browsing listings.
export async function fetchListingsByDistrict(district: string, max: number = 50): Promise<Listing[]> {
  const dbPromise = getDb();
  if (!dbPromise) return [];
  try {
    const [db, { collection, query, where, orderBy, limit, getDocs, Timestamp }] = await Promise.all([
      dbPromise,
      import("firebase/firestore"),
    ]);
    const q = query(
      collection(db, "listings"),
      where("district", "==", district),
      where("status", "==", "active"),
      orderBy("createdAt", "desc"),
      limit(max)
    );
    const snap = await getDocs(q);
    return snap.docs.map((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : Date.now();
      return { id: doc.id, ...data, createdAt } as Listing;
    });
  } catch {
    return [];
  }
}
