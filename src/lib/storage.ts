// Local-only persistence helpers.
//
// Nothing here ever leaves the device: we use the browser's localStorage,
// which is not sent to any server. It only exists so a calculator's numbers
// can survive switching to another calculator and back, or closing the tab
// and returning later — and only once the user explicitly taps "Save".

const PREFIX = "sgmoney:";

export interface SavedCalculatorData<T> {
  data: T;
  savedAt: number;
}

export function saveCalculatorData<T>(key: string, data: T): number {
  const savedAt = Date.now();
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ data, savedAt }));
  } catch {
    // localStorage unavailable (private browsing, storage full, etc.) — fail silently.
  }
  return savedAt;
}

export function loadCalculatorData<T>(key: string): SavedCalculatorData<T> | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !("data" in parsed)) return null;
    return parsed as SavedCalculatorData<T>;
  } catch {
    return null;
  }
}

export function clearCalculatorData(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}

// Writes back an already-saved {data, savedAt} pair verbatim — used by Backup & Restore
// (src/lib/backup.ts) so a restored calculator shows its original "last saved" date rather
// than looking like it was just edited a moment ago.
export function restoreCalculatorData<T>(key: string, saved: SavedCalculatorData<T>): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(saved));
  } catch {
    // localStorage unavailable — fail silently, same as saveCalculatorData.
  }
}

// Writes back an already-saved {data, savedAt} pair verbatim — used by Backup & Restore
// (src/lib/backup.ts) so a restored calculator shows its original "last saved" date rather
// than looking like it was just edited a moment ago.
export function restoreCalculatorData<T>(key: string, saved: SavedCalculatorData<T>): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(saved));
  } catch {
    // localStorage unavailable — fail silently, same as saveCalculatorData.
  }
}
