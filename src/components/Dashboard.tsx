import type { AllocationSlice, HealthDimension, LineItem } from "../lib/dashboard";
import { HEALTH_STATUS_LABEL, newLineItemId, sumLineItems } from "../lib/dashboard";
import { formatSgd } from "../lib/cpf";

export function EditableLineItems({
  items,
  onChange,
  addLabel,
  amountLabel = "Amount",
  placeholder = "e.g. Salary",
}: {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  addLabel: string;
  amountLabel?: string;
  placeholder?: string;
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
      {items.map((item) => (
        <div className="line-item-row" key={item.id}>
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
              onChange={(e) => updateItem(item.id, { amount: e.target.value === "" ? 0 : parseFloat(e.target.value) })}
            />
          </div>
          <button type="button" className="line-item-remove" aria-label="Remove" onClick={() => removeItem(item.id)}>
            ✕
          </button>
        </div>
      ))}
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
