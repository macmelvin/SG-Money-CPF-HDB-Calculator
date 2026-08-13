import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { CALCULATORS, BTO_TOOL_URL } from "../lib/calculators";

export function CalcShell({
  title,
  subtitle,
  onClear,
  children,
}: {
  title: string;
  subtitle: string;
  onClear?: () => void;
  children: ReactNode;
}) {
  const { pathname } = useLocation();
  const otherCalculators = CALCULATORS.filter((c) => c.to !== pathname);

  return (
    <div className="calc-page">
      <Link to="/" className="back-link">
        ← Home
      </Link>
      <h1>{title}</h1>
      <p className="subtitle">{subtitle}</p>

      {onClear && (
        <div className="privacy-note">
          <span>
            🔒 We don't store or transmit what you enter here — it stays on your device for this session only,
            and nothing is saved anywhere unless a future version explicitly adds that.
          </span>
          <button type="button" className="clear-btn" onClick={onClear}>
            Clear my inputs
          </button>
        </div>
      )}

      {children}

      <nav className="other-calcs" aria-label="Other calculators">
        <h3>Other calculators</h3>
        <div className="other-calcs-list">
          {otherCalculators.map((c) => (
            <Link to={c.to} key={c.to} className="other-calc-link">
              <span className="other-calc-icon">{c.icon}</span>
              <span>{c.title}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  prefix,
  suffix,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <div className="field-input">
        {prefix && <span className="affix">{prefix}</span>}
        <input
          type="number"
          value={Number.isNaN(value) ? "" : value}
          step={step ?? 1}
          onChange={(e) => onChange(e.target.value === "" ? 0 : parseFloat(e.target.value))}
        />
        {suffix && <span className="affix">{suffix}</span>}
      </div>
    </label>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ResultRow({
  label,
  value,
  emphasis,
  positive,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  positive?: boolean;
}) {
  return (
    <div className={`result-row ${emphasis ? "emphasis" : ""}`}>
      <span>{label}</span>
      <span className={positive === undefined ? "" : positive ? "value-positive" : "value-negative"}>{value}</span>
    </div>
  );
}

export function ResultCard({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <div className="result-card">
      {title && <h3>{title}</h3>}
      {children}
    </div>
  );
}

export function Disclaimer({ children }: { children: ReactNode }) {
  return <p className="disclaimer">{children}</p>;
}

export function BtoPromo({
  title = "Planning a BTO?",
  desc = "Check out our BTO Planning Tool for eligibility, timelines and flat selection.",
}: {
  title?: string;
  desc?: string;
}) {
  return (
    <a href={BTO_TOOL_URL} target="_blank" rel="noopener noreferrer" className="bto-promo">
      <span className="bto-promo-icon">🏗️</span>
      <span className="bto-promo-text">
        <span className="bto-promo-title">{title}</span>
        <span className="bto-promo-desc">{desc}</span>
      </span>
      <span className="bto-promo-arrow">↗</span>
    </a>
  );
}
