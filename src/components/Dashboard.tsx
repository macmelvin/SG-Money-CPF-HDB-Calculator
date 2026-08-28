import { useState } from "react";
import type { AllocationSlice, HealthDimension, LineItem } from "../lib/dashboard";
import {
  HEALTH_STATUS_LABEL,
  ageAtDate,
  isLineItemEnded,
  isLineItemNotYetStarted,
  newLineItemId,
  sumLineItems,
} from "../lib/dashboard";
import { formatSgd } from "../lib/cpf";
import { MAX_ATTACHMENT_BYTES, deleteAttachment, downloadAttachment, saveAttachment } from "../lib/attachments";

export function EditableLineItems({
  items,
  onChange,
  addLabel,
  amountLabel = "Amount",
  placeholder = "e.g. Salary",
  showDateRange = false,
  currentAge,
  highlightEndAges = [60, 62, 65],
  highlightEndYears = [2028],
  keepValueAfterEnd = false,
  allowAttachment = false,
}: {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  addLabel: string;
  amountLabel?: string;
  placeholder?: string;
  // Shows optional "starts on" / "ends on" dates per row. Outside that window
  // the item is struck through here and drops out of the Total below (and out
  // of every calculation that sums this list) — a loan that hasn't started
  // yet, or one that's been paid off, without needing to remember to add or
  // delete it exactly on the day.
  showDateRange?: boolean;
  // When provided (with showDateRange), a still-active row whose end date lands
  // on one of highlightEndAges gets a distinct "ends at age X" highlight — a
  // heads-up that this loan/policy finishes right around a retirement
  // milestone. Only an approximation: the app only ever collects a whole-year
  // "current age", not a birthdate.
  currentAge?: number;
  highlightEndAges?: number[];
  // Same idea, but keyed on the end date's calendar year instead of an age —
  // e.g. a cluster of loans all wrapping up in 2028 regardless of what age
  // that lands on. Doesn't need currentAge.
  highlightEndYears?: number[];
  // For investment/insurance holdings, an "end date" marks when a policy matures and pays
  // out — the money doesn't disappear, it becomes cash — so unlike an expense or liability
  // it should NOT be struck through and dropped from the Total once passed. Set true for
  // that kind of list; the end date still drives the milestone highlight above, it just
  // switches to a "matured" badge instead of "ended — excluded" once the date has passed.
  keepValueAfterEnd?: boolean;
  // Shows a "📎 Attach document" control per row (e.g. a scanned insurance policy). Only
  // meaningful alongside showDateRange's investment/insurance styling — see the Net Worth
  // Snapshot's holdings list in RetirementCalculator.tsx.
  allowAttachment?: boolean;
}) {
  // Per-item attach error (e.g. wrong file type, too large) — keyed by item id so one row's
  // error doesn't clobber another's, and cleared as soon as that row's next attach attempt
  // starts or succeeds.
  const [attachErrors, setAttachErrors] = useState<Record<string, string>>({});

  const updateItem = (id: string, patch: Partial<LineItem>) => {
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };
  const removeItem = (id: string) => {
    const target = items.find((item) => item.id === id);
    if (target?.attachmentId) {
      // Best-effort — an orphaned IndexedDB blob costs nothing functionally, so a failure
      // here shouldn't block removing the line item itself.
      deleteAttachment(target.attachmentId).catch(() => {});
    }
    onChange(items.filter((item) => item.id !== id));
  };
  const addItem = () => {
    onChange([...items, { id: newLineItemId(), label: "", amount: 0 }]);
  };

  const handleAttachFile = async (item: LineItem, file: File) => {
    setAttachErrors((prev) => ({ ...prev, [item.id]: "" }));
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setAttachErrors((prev) => ({ ...prev, [item.id]: "That file is too large (max 15MB)." }));
      return;
    }
    // Replacing an existing attachment — clear out the old blob first so it doesn't linger.
    if (item.attachmentId) {
      await deleteAttachment(item.attachmentId).catch(() => {});
    }
    try {
      const record = await saveAttachment(file);
      updateItem(item.id, { attachmentId: record.id, attachmentName: record.name });
    } catch {
      setAttachErrors((prev) => ({
        ...prev,
        [item.id]: "Couldn't save that file on this device — storage may be full or unavailable.",
      }));
    }
  };

  const handleRemoveAttachment = async (item: LineItem) => {
    if (item.attachmentId) {
      await deleteAttachment(item.attachmentId).catch(() => {});
    }
    updateItem(item.id, { attachmentId: undefined, attachmentName: undefined });
  };

  return (
    <div className="line-items">
      {items.map((item) => {
        const pastEnd = showDateRange && isLineItemEnded(item);
        // A matured investment/policy (pastEnd + keepValueAfterEnd) is NOT excluded — it
        // keeps counting toward the Total, so it doesn't get the dimmed "ended" treatment.
        const ended = pastEnd && !keepValueAfterEnd;
        const matured = pastEnd && keepValueAfterEnd;
        const notYetStarted = showDateRange && !ended && !matured && isLineItemNotYetStarted(item);
        const inactive = ended || notYetStarted;
        // "Going to end" — still counted, but its end date lands on one of the ages/years
        // the person asked to watch for (e.g. a policy that matures right when they turn 65).
        const endAge =
          showDateRange && !inactive && currentAge !== undefined && item.endDate
            ? ageAtDate(currentAge, item.endDate)
            : null;
        const endYear =
          showDateRange && !inactive && item.endDate ? parseInt(item.endDate.slice(0, 4), 10) : null;
        const isAgeMilestone = endAge !== null && highlightEndAges.includes(endAge);
        const isYearMilestone = endYear !== null && highlightEndYears.includes(endYear);
        const isMilestoneEnd = (isAgeMilestone || isYearMilestone) && !matured;
        return (
          <div className="line-item-group" key={item.id}>
            <div
              className={`line-item-row ${inactive ? "line-item-ended" : ""} ${isMilestoneEnd ? "line-item-milestone" : ""} ${matured ? "line-item-matured" : ""}`}
            >
              <input
                type="text"
                className="line-item-label"
                value={item.label}
                placeholder={placeholder}
                onChange={(e) => updateItem(item.id, { label: e.target.value })}
              />
              <div className="line-item-amount">
                <span className="affix">$</span>
                <input
                  type="number"
                  aria-label={amountLabel}
                  value={Number.isNaN(item.amount) ? "" : item.amount}
                  onChange={(e) =>
                    updateItem(item.id, { amount: e.target.value === "" ? 0 : parseFloat(e.target.value) })
                  }
                />
              </div>
              <button type="button" className="line-item-remove" aria-label="Remove" onClick={() => removeItem(item.id)}>
                ✕
              </button>
            </div>
            {showDateRange && (
              <div className="line-item-daterange-row">
                <label>
                  Start date (optional)
                  <input
                    type="date"
                    value={item.startDate ?? ""}
                    onChange={(e) => updateItem(item.id, { startDate: e.target.value || undefined })}
                  />
                </label>
                <label>
                  End date (optional)
                  <input
                    type="date"
                    value={item.endDate ?? ""}
                    onChange={(e) => updateItem(item.id, { endDate: e.target.value || undefined })}
                  />
                </label>
                {ended && <span className="line-item-ended-badge">Ended — excluded from totals</span>}
                {notYetStarted && <span className="line-item-ended-badge">Not started yet — excluded from totals</span>}
                {matured && <span className="line-item-matured-badge">✅ Matured — still counted in your totals</span>}
                {isMilestoneEnd && (
                  <span className="line-item-milestone-badge">
                    🎯 {isAgeMilestone ? `Ends at age ${endAge}` : `Ends in ${endYear}`}
                  </span>
                )}
              </div>
            )}
            {showDateRange && (
              <div className="line-item-note-row">
                <input
                  type="text"
                  className="line-item-note"
                  aria-label="Note"
                  placeholder="Add a note (optional) — e.g. policy number, which broker, why this loan exists"
                  value={item.note ?? ""}
                  onChange={(e) => updateItem(item.id, { note: e.target.value || undefined })}
                />
              </div>
            )}
            {allowAttachment && (
              <div className="line-item-attach-row">
                {item.attachmentName ? (
                  <span className="line-item-attachment-chip">
                    📄 {item.attachmentName}
                    <button type="button" onClick={() => downloadAttachment(item.attachmentId!)}>
                      Download
                    </button>
                    <label className="line-item-attach-replace">
                      Replace
                      <input
                        type="file"
                        accept="application/pdf,image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (file) handleAttachFile(item, file);
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="line-item-attachment-remove"
                      aria-label="Remove attached document"
                      onClick={() => handleRemoveAttachment(item)}
                    >
                      ✕
                    </button>
                  </span>
                ) : (
                  <label className="line-item-attach-btn">
                    📎 Attach policy document (optional)
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file) handleAttachFile(item, file);
                      }}
                    />
                  </label>
                )}
                {attachErrors[item.id] && <span className="line-item-attach-error">{attachErrors[item.id]}</span>}
              </div>
            )}
          </div>
        );
      })}
      <button type="button" className="line-item-add" onClick={addItem}>
        + {addLabel}
      </button>
      {items.length > 0 && (
        <div className="line-items-total">
          <span>Total</span>
          <span>{formatSgd(sumLineItems(items, undefined, { ignoreEndDate: keepValueAfterEnd }))}</span>
        </div>
      )}
    </div>
  );
}

const ALLOCATION_COLORS: Record<AllocationSlice["key"], string> = {
  hdb: "var(--series-1)",
  cpf: "var(--series-2)",
  investments: "var(--series-3)",
};

export function AssetAllocationBar({ slices }: { slices: AllocationSlice[] }) {
  const visible = slices.filter((s) => s.value > 0);
  if (visible.length === 0) {
    return <p className="explainer">Add your HDB value, CPF and investments above to see your allocation.</p>;
  }
  return (
    <div className="allocation-chart">
      <div className="allocation-bar" role="img" aria-label="Asset allocation breakdown">
        {visible.map((slice, i) => (
          <div
            key={slice.key}
            className="allocation-segment"
            style={{
              width: `${slice.pct}%`,
              background: ALLOCATION_COLORS[slice.key],
              borderTopLeftRadius: i === 0 ? 4 : 0,
              borderBottomLeftRadius: i === 0 ? 4 : 0,
              borderTopRightRadius: i === visible.length - 1 ? 4 : 0,
              borderBottomRightRadius: i === visible.length - 1 ? 4 : 0,
            }}
          />
        ))}
      </div>
      <div className="allocation-legend">
        {visible.map((slice) => (
          <div className="allocation-legend-row" key={slice.key}>
            <span className="allocation-swatch" style={{ background: ALLOCATION_COLORS[slice.key] }} />
            <span className="allocation-legend-label">{slice.label}</span>
            <span className="allocation-legend-value">
              {formatSgd(slice.value)} <span className="allocation-legend-pct">({slice.pct.toFixed(0)}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HealthBadge({ dimension }: { dimension: HealthDimension }) {
  return (
    <div className={`health-badge health-${dimension.status}`}>
      <div className="health-badge-top">
        <span className="health-badge-label">{dimension.label}</span>
        <span className="health-badge-status">{HEALTH_STATUS_LABEL[dimension.status]}</span>
      </div>
      <p className="health-badge-note">{dimension.note}</p>
    </div>
  );
}
