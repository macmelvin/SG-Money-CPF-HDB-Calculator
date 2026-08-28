// Local-only file attachments — e.g. a scanned insurance policy PDF attached to a Net
// Worth Snapshot holding. Stored in IndexedDB rather than localStorage/JSON: a policy
// PDF or photo is easily several MB, far more than localStorage's shared ~5-10MB-per-origin
// quota that every other calculator on this device also draws from. Like everything else
// in this app, the file itself never leaves the browser — there is no server to send it to.
//
// IMPORTANT: attachments live in IndexedDB, not localStorage, so they are NOT included in
// Backup & Restore (src/lib/backup.ts), which only bundles the JSON calculator data. A
// restored backup on a new device/browser will bring back the holding's name and amount,
// but not its attached document — the UI should make that limitation clear.

const DB_NAME = "sgmoney-attachments";
const DB_VERSION = 1;
const STORE_NAME = "files";

export interface StoredAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  savedAt: number;
  blob: Blob;
}

// 15MB is generous for a scanned policy document (even a multi-page PDF) while keeping
// well clear of IndexedDB storage pressure on mobile browsers.
export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this browser"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

let nextId = 1;
function newAttachmentId(): string {
  nextId += 1;
  return `attach-${Date.now()}-${nextId}`;
}

export async function saveAttachment(file: File): Promise<StoredAttachment> {
  const db = await openDb();
  const record: StoredAttachment = {
    id: newAttachmentId(),
    name: file.name,
    type: file.type,
    size: file.size,
    savedAt: Date.now(),
    blob: file,
  };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return record;
}

export async function getAttachment(id: string): Promise<StoredAttachment | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve((req.result as StoredAttachment | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteAttachment(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Triggers a normal browser download of the attached file. Deliberately not
// window.open(blobUrl, "_blank") — opening a blob: URL in a *new* tab/window is
// unreliable across browsers (Chromium's per-renderer-process blob URL registry, and
// Safari's own restrictions, can both silently fail to resolve it there). A clicked
// <a download> works the same way everywhere and hands the person their file with its
// original name, ready to open in whatever PDF/image viewer they already use.
export async function downloadAttachment(id: string): Promise<void> {
  const record = await getAttachment(id);
  if (!record) return;
  const url = URL.createObjectURL(record.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = record.name || "policy-document";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
