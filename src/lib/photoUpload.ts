import { getStorageInstance, isFirebaseConfigured } from "./firebase";

export { isFirebaseConfigured };

export const MAX_LISTING_PHOTOS = 8;
// A heads-up threshold shown to the person at selection time — NOT a hard
// reject. Compression below handles any input size fine either way; this
// is purely so someone selecting an unusually large file (e.g. a
// high-res/burst photo) knows upfront it'll take a moment longer to
// compress and upload, rather than wondering why one photo is slow.
export const LARGE_PHOTO_WARNING_MB = 10;
// Compressed target — raw phone photos are often 5-10MB; this keeps listing
// pages fast to load and Storage costs low without visibly hurting quality
// at the size photos actually display (property listing thumbnails/cards,
// not full-screen galleries).
const MAX_DIMENSION = 1600; // px, longest edge
const JPEG_QUALITY = 0.75;

// Resizes (longest edge capped at MAX_DIMENSION) and re-encodes as JPEG at
// JPEG_QUALITY via a canvas — no extra library needed, every browser this
// app targets supports canvas.toBlob natively.
function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > height && width > MAX_DIMENSION) {
        height = Math.round((height * MAX_DIMENSION) / width);
        width = MAX_DIMENSION;
      } else if (height > MAX_DIMENSION) {
        width = Math.round((width * MAX_DIMENSION) / height);
        height = MAX_DIMENSION;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not supported"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Compression failed"))),
        "image/jpeg",
        JPEG_QUALITY
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load image"));
    };
    img.src = url;
  });
}

function randomListingFolderId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Uploads all photos to Storage under a fresh random folder (generated
// BEFORE the Firestore listing document exists — the listing is created
// with these URLs already included, rather than uploading first then
// updating the doc after, since Firestore rules deny updates entirely).
// Returns the uploaded download URLs, in the same order as the input files.
// Throws if Firebase isn't configured or any single upload fails, so the
// caller can show one clear error rather than a partially-uploaded listing.
export async function uploadListingPhotos(files: File[]): Promise<string[]> {
  const storagePromise = getStorageInstance();
  if (!storagePromise) throw new Error("Firebase not configured");
  const storage = await storagePromise;
  const { ref, uploadBytes, getDownloadURL } = await import("firebase/storage");

  const folderId = randomListingFolderId();
  const urls: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const compressed = await compressImage(files[i]);
    const photoRef = ref(storage, `listings/${folderId}/photo-${i}.jpg`);
    await uploadBytes(photoRef, compressed, { contentType: "image/jpeg" });
    urls.push(await getDownloadURL(photoRef));
  }
  return urls;
}
