import { useRef, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { ResultCard, Disclaimer } from "../components/CalcShell";
import { usePageMeta } from "../lib/usePageMeta";
import {
  BACKUP_CALCULATORS,
  InvalidBackupFileError,
  buildBackup,
  downloadBackupFile,
  parseBackupFile,
  restoreBackup,
} from "../lib/backup";
import { loadCalculatorData } from "../lib/storage";

function useSavedCalculatorLabels(): string[] {
  // Re-checked on every render (cheap — just a few localStorage reads) so the list stays
  // accurate right after an export or restore, without needing separate state to track it.
  return BACKUP_CALCULATORS.filter((c) => loadCalculatorData(c.key) !== null).map((c) => c.label);
}

export default function BackupRestore() {
  usePageMeta(
    "Backup & Restore Your Data | SG-Money-CPF-HDB-Calculator",
    "Export everything you've saved across SG Money's calculators to one file, and restore it any time — useful if you use a private/incognito window, clear your browser data, or switch devices."
  );

  const savedLabels = useSavedCalculatorLabels();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [restoreStatus, setRestoreStatus] = useState
    { type: "success"; labels: string[] } | { type: "error"; message: string } | null
  >(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const handleExport = () => {
    downloadBackupFile(buildBackup());
  };

  const handleFileChosen = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-choosing the same file later without needing to change it first
    if (!file) return;

    setIsRestoring(true);
    setRestoreStatus(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const backup = parseBackupFile(String(reader.result ?? ""));
        const restored = restoreBackup(backup);
        if (restored.length === 0) {
          setRestoreStatus({ type: "error", message: "That backup file didn't contain any calculator data to restore." });
        } else {
          setRestoreStatus({ type: "success", labels: restored });
        }
      } catch (err) {
        const message = err instanceof InvalidBackupFileError ? err.message : "Couldn't read that file. Please try again.";
        setRestoreStatus({ type: "error", message });
      } finally {
        setIsRestoring(false);
      }
    };
    reader.onerror = () => {
      setRestoreStatus({ type: "error", message: "Couldn't read that file. Please try again." });
      setIsRestoring(false);
    };
    reader.readAsText(file);
  };

  return (
    <div className="calc-page">
      <Link to="/" className="back-link">
        ← Home
      </Link>
      <h1>💾 Backup & Restore</h1>
      <p className="subtitle">
        Save everything you've entered to one file, so it survives a private/incognito window, clearing your browser
        data, or moving to a new device.
      </p>

      <ResultCard title="⬇️ Export Your Data">
        {savedLabels.length === 0 ? (
          <p className="explainer" style={{ marginTop: -2 }}>
            You haven't saved anything yet — enter your numbers in any calculator and tap "💾 Save" first, then come
            back here to back it up.
          </p>
        ) : (
          <>
            <p className="explainer" style={{ marginTop: -2 }}>
              Currently saved: {savedLabels.join(", ")}.
            </p>
            <button type="button" className="dashboard-btn" onClick={handleExport}>
              ⬇️ Download Backup File
            </button>
          </>
        )}
      </ResultCard>

      <ResultCard title="⬆️ Restore From Backup">
        <p className="explainer" style={{ marginTop: -2 }}>
          Choose a backup file you exported earlier. It only replaces the calculators actually included in that
          file — anything else you've saved on this device is left untouched.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleFileChosen}
          style={{ display: "none" }}
        />
        <button
          type="button"
          className="dashboard-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={isRestoring}
        >
          {isRestoring ? "Restoring…" : "⬆️ Choose Backup File"}
        </button>

        {restoreStatus?.type === "success" && (
          <p className="explainer" style={{ color: "var(--positive)", marginBottom: -4 }}>
            ✓ Restored {restoreStatus.labels.join(", ")}. Visit any of those calculators to see your numbers again.
          </p>
        )}
        {restoreStatus?.type === "error" && (
          <p className="explainer" style={{ color: "var(--negative)", marginBottom: -4 }}>
            ⚠ {restoreStatus.message}
          </p>
        )}
      </ResultCard>

      <Disclaimer>
        This backup file is generated and read entirely on your device — nothing is uploaded anywhere. It's yours to
        keep wherever you like (cloud storage, email to yourself, a USB stick). Treat it like any personal financial
        file: it contains the numbers you've entered, in plain readable text.
      </Disclaimer>
    </div>
  );
}
