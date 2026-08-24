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

export function EditableLineItems({
  items,
  onChange,
  addLabel,
  amountLabel = "Amount",
  placeholder = "e.g. Salary",
  showDateRange = false,
  currentAge,
  highlightEndAges = [60, 62, 65],
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
}) {
  const updateItem = (id: string, patch: Partial<LineItem>) => {
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };
  const removeItem = (id: string) => {
    onChange(items.filter((item) => item.id !== id));
  };
  const addItem = () => {
    onChange([...items, { id: newLineItemId(), label: "", amount: 0 }]);
  };

  return (
    <div className="line-items">
      {items.map((item) => {
        const ended = showDateRange && isLineItemEnded(item);
        const notYetStarted = showDateRange && !ended && isLineItemNotYetStarted(item);
        const inactive = ended || notYetStarted;
        // "Going to end" — still active today, but its end date lands on one of the
        // ages the person asked to watch for (e.g. a loan that finishes right when
        // they turn 60).
        const endAge =
          showDateRange && !inactive && currentAge !== undefined && item.endDate
            ? ageAtDate(currentAge, item.endDate)
            : null;
        const isMilestoneEnd = endAge !== null && highlightEndAges.includes(endAge);
        return (
          <div className="line-item-group" key={item.id}>
            <div
              className={`line-item-row ${inactive ? "line-item-ended" : ""} ${isMilestoneEnd ? "line-item-milestone" : ""}`}
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
                {isMilestoneEnd && <span className="line-item-milestone-badge">🎯 Ends at age {endAge}</span>}
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
          <span>{formatSgd(sumLineItems(items))}</span>
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
