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
