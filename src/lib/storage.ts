// Local-only persistence helpers.
//
// Nothing here ever leaves the device: we use the browser's localStorage,
// which is not sent to any server. It only exists so a calculator's numbers
// can survive switching to another calculator and back, or closing the tab
// and returning later — and only once the user explicitly taps "Save".
//
// useAutoSaveOnUnload (below) is the one exception to "only on an explicit Save": once a
// calculator has been saved at least once, leaving that page also silently refreshes the
// save with whatever's currently on screen — see its own comment for why.

import { useEffect, useRef } from "react";

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

// Like saveCalculatorData, but keeps whatever savedAt timestamp is already stored instead
// of minting a new one. Used by useAutoSaveOnUnload below so a silent, automatic save never
// shows up as a "last saved" time anywhere — including cross-calculator labels elsewhere in
// the app that read another calculator's savedAt (e.g. Retirement Calculator showing "Saved
// your HDB Sale Proceeds numbers on Aug 13"). Does nothing if there's no existing entry —
// callers that want "create if missing" should use saveCalculatorData instead.
function refreshCalculatorDataSilently<T>(key: string, data: T): void {
  try {
    const existing = loadCalculatorData<T>(key);
    if (!existing) return;
    localStorage.setItem(PREFIX + key, JSON.stringify({ data, savedAt: existing.savedAt }));
  } catch {
    // localStorage unavailable — fail silently, same as saveCalculatorData.
  }
}

// Silently keeps a calculator's save fresh with whatever is currently on screen, whenever
// the person leaves that page — either by navigating elsewhere in the app (component
// unmount) or by closing/refreshing the tab (beforeunload).
//
// Why: each calculator's inputs only live in that page's own component state. Backup &
// Restore (and switching devices) can only ever see what's already in localStorage, and
// that used to update *only* on an explicit "💾 Save" tap — so an edit made after the last
// Save, followed by going straight to Backup & Restore (or just closing the tab), could
// silently be left out of both the backup file and any future restore. This closes that
// gap at the source, for every calculator, rather than special-casing the Backup page.
//
// Deliberately conservative about when it activates: if this calculator has never been
// explicitly saved even once, leaving the page does nothing — "Save" stays the visible,
// intentional action that first opts a calculator into being persisted at all. Once that's
// happened once, this just keeps it current from then on. It never touches the "last
// saved" timestamp anywhere in the UI — see refreshCalculatorDataSilently above — so
// nothing looks freshly saved unless the person actually tapped "💾 Save".
export function useAutoSaveOnUnload<T>(key: string, data: T): void {
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    const flush = () => refreshCalculatorDataSilently(key, dataRef.current);
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      flush();
    };
    // Intentionally just `key` — dataRef.current is always current by the time flush()
    // runs, so re-running this effect on every keystroke would only churn the listener.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
