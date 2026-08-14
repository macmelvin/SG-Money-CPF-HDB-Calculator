// Export/import for everything a person has saved across the app's calculators, so their data
// can survive things localStorage doesn't: clearing browser data, an Incognito/Private window
// (which throws everything away when it closes), or moving to a new computer or browser. The
// backup file only ever touches this device — it's generated and read entirely client-side, and
// where it's saved (Drive, email, USB stick, etc.) is entirely up to the person exporting it.

import type { SavedCalculatorData } from "./storage";
import { loadCalculatorData, restoreCalculatorData } from "./storage";

export interface CalculatorBackupEntry {
  label: string;
  key: string;
}

// The premium-report unlock flag is deliberately excluded — it's a payment-gate flag, not
// something the person "entered," and backing it up/sharing it would be an odd (and unintended)
// way to move a paid unlock between devices or people.
export const BACKUP_CALCULATORS: CalculatorBackupEntry[] = [
  { key: "salary-calculator", label: "Salary & CPF" },
  { key: "hdb-sale-proceeds", label: "HDB Sale Proceeds" },
  { key: "cpf-accrued-interest", label: "CPF Accrued Interest" },
  { key: "retirement-calculator", label: "Retirement" },
  { key: "car-cost-calculator", label: "Car Cost" },
];

export interface BackupFile {
  app: "SG-Money-CPF-HDB-Calculator";
  version: 1;
  exportedAt: number;
  calculators: Record<string, SavedCalculatorData<unknown>>;
}

// Reads whatever's currently saved for each calculator and bundles it into one exportable
// object. Calculators the person never saved anything in are simply left out.
export function buildBackup(): BackupFile {
  const calculators: Record<string, SavedCalculatorData<unknown>> = {};
  for (const { key } of BACKUP_CALCULATORS) {
    const saved = loadCalculatorData<unknown>(key);
    if (saved) {
      calculators[key] = saved;
    }
  }
  return {
    app: "SG-Money-CPF-HDB-Calculator",
    version: 1,
    exportedAt: Date.now(),
    calculators,
  };
}

export function downloadBackupFile(backup: BackupFile): void {
  const dateLabel = new Date(backup.exportedAt).toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `sg-money-backup-${dateLabel}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export class InvalidBackupFileError extends Error {}

// Deliberately strict rather than "best effort" — a backup file is something people trust with
// numbers they care about, so a malformed or unrelated file should fail clearly rather than
// silently restoring nothing (or partially wrong data).
export function parseBackupFile(text: string): BackupFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new InvalidBackupFileError("That file isn't valid JSON — it doesn't look like an SG Money backup file.");
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    (parsed as Record<string, unknown>).app !== "SG-Money-CPF-HDB-Calculator" ||
    typeof (parsed as Record<string, unknown>).calculators !== "object"
  ) {
    throw new InvalidBackupFileError("That doesn't look like an SG Money backup file.");
  }
  return parsed as BackupFile;
}

// Returns the labels of calculators actually restored, so the caller can show a clear summary
// (and so calculators with nothing in the backup are left untouched, not blanked out).
export function restoreBackup(backup: BackupFile): string[] {
  const restored: string[] = [];
  for (const { key, label } of BACKUP_CALCULATORS) {
    const saved = backup.calculators[key];
    if (saved && typeof saved === "object" && "data" in saved) {
      restoreCalculatorData(key, saved as SavedCalculatorData<unknown>);
      restored.push(label);
    }
  }
  return restored;
}
