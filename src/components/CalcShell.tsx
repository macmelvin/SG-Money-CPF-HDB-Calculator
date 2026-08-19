import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { CALCULATORS, BTO_TOOL_URL, DOC_TOOLS_URL } from "../lib/calculators";
import { WhatsAppButton } from "./WhatsAppButton";
import { SponsorBanner } from "./SponsorBanner";
import { AppSuiteFooter } from "./AppSuiteFooter";

function formatSavedAt(savedAt: number): string {
  const diffMs = Date.now() - savedAt;
  if (diffMs < 60_000) return "just now";
  return new Date(savedAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function CalcShell({
  title,
  subtitle,
  onClear,
  onSave,
  onDownloadPdf,
  savedAt,
  extraActions,
  whatsappTopic,
  showAppSuiteFooter,
  children,
}: {
  title: string;
  subtitle: string;
  onClear?: () => void;
  onSave?: () => void;
  onDownloadPdf?: () => void;
  savedAt?: number | null;
  // Slot for calculator-specific action buttons (e.g. Retirement Calculator's "Download
  // Dashboard") that don't belong in CalcShell's generic save/PDF/clear API.
  extraActions?: ReactNode;
  // Opt-in per page: when set, shows a floating WhatsApp button pre-filled with a
  // message naming this topic (e.g. "Salary & CPF Calculator"). Left unset on pages
  // that shouldn't have it (e.g. Property Listings) rather than defaulting it on
  // everywhere CalcShell is used.
  whatsappTopic?: string;
  // Opt-in per page: shows the "Share this app" + signature + sister-apps
  // footer block (AppSuiteFooter). Currently only set on the 5 core
  // calculators, not Property Listings — same opt-in reasoning as
  // whatsappTopic above.
  showAppSuiteFooter?: boolean;
  children: ReactNode;
}) {
  const { pathname } = useLocation();
  const otherCalculators = CALCULATORS.filter((c) => c.to !== pathname);
  // Matches the calculatorId convention used everywhere else (STORAGE_KEY,
  // trackEvent's `calculator` field, NEXT_STEP_OFFERS' keys) — the route
  // path with its leading slash stripped, e.g. "/car-cost-calculator" ->
  // "car-cost-calculator". Derived here rather than passed in as a prop so
  // every page automatically gets the right sponsor banner (or none) for
  // free, without needing its own wiring.
  const calculatorId = pathname.replace(/^\//, "");
  const [justSaved, setJustSaved] = useState(false);

  const handleSave = () => {
    onSave?.();
    setJustSaved(true);
    window.setTimeout(() => setJustSaved(false), 2000);
  };

  return (
    <div className="calc-page">
      <Link to="/" className="back-link">
        ← Home
      </Link>
      <h1>{title}</h1>
      <p className="subtitle">{subtitle}</p>

      <SponsorBanner calculatorId={calculatorId} />

      {(onClear || onSave || onDownloadPdf || extraActions) && (
        <div className="privacy-note">
          <span>
            🔒 Nothing is sent to a server. Tap Save and these numbers stay only in this browser, on this
            device, until you clear them.
            {savedAt ? ` Last saved ${formatSavedAt(savedAt)}.` : ""}{" "}
            <Link to="/backup" className="backup-link">
              💾 Backup all your data
            </Link>
          </span>
          <div className="calc-actions">
            {onSave && (
              <button type="button" className="save-btn" onClick={handleSave}>
                {justSaved ? "✓ Saved" : "💾 Save"}
              </button>
            )}
            {onDownloadPdf && (
              <button type="button" className="pdf-btn" onClick={onDownloadPdf}>
                ⬇ PDF
              </button>
            )}
            {onClear && (
              <button type="button" className="clear-btn" onClick={onClear}>
                Clear
              </button>
            )}
            {extraActions}
          </div>
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

      {showAppSuiteFooter && <AppSuiteFooter />}

      {whatsappTopic && <WhatsAppButton topic={whatsappTopic} />}
    </div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  prefix,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  /** No longer used — kept so existing call sites (step={1000} etc.) don't need
   *  updating. type="number"'s native spinner (which this drove) is gone now;
   *  see the note below on why. */
  step?: number;
}) {
  // Deliberately type="text" + inputMode="decimal", not type="number". The native
  // number input has real, well-documented cross-browser/mobile quirks — most
  // relevantly here, inconsistent text-selection-on-focus behaviour on mobile
  // keyboards, which caused digits to get prepended onto an existing value (e.g.
  // typing into a field showing "178937.76" could produce "0178937.76") instead of
  // replacing it. A plain text input with a numeric keyboard sidesteps that
  // entirely, at the cost of losing the native up/down spinner arrows.
  //
  // Keeps its own text state so the person can type freely (including an
  // in-progress decimal like "178937." or a temporarily empty field) without the
  // display snapping back to a reformatted number after every keystroke. Only
  // re-syncs from the external `value` prop when it changes from OUTSIDE this
  // input (e.g. a "Pull from..." button elsewhere setting the value) — not while
  // the person is actively typing in this exact field.
  const [text, setText] = useState(() => (Number.isNaN(value) ? "" : String(value)));
  const isFocused = useRef(false);

  useEffect(() => {
    if (!isFocused.current) {
      setText(Number.isNaN(value) ? "" : String(value));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    const normalized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : cleaned;
    setText(normalized);
    const parsed = parseFloat(normalized);
    onChange(Number.isNaN(parsed) ? 0 : parsed);
  };

  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <div className="field-input">
        {prefix && <span className="affix">{prefix}</span>}
        <input
          type="text"
          inputMode="decimal"
          value={text}
          onFocus={(e) => {
            isFocused.current = true;
            e.target.select();
          }}
          onBlur={() => {
            isFocused.current = false;
            setText(Number.isNaN(value) ? "" : String(value));
          }}
          onChange={handleChange}
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

export function ResultCard({ children, title, id }: { children: ReactNode; title?: string; id?: string }) {
  return (
    <div className="result-card" id={id}>
      {title && <h3>{title}</h3>}
      {children}
    </div>
  );
}

export function Disclaimer({ children }: { children: ReactNode }) {
  return <div className="disclaimer">{children}</div>;
}

function PromoLink({
  href,
  icon,
  title,
  desc,
}: {
  href: string;
  icon: string;
  title: string;
  desc: string;
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="bto-promo">
      <span className="bto-promo-icon">{icon}</span>
      <span className="bto-promo-text">
        <span className="bto-promo-title">{title}</span>
        <span className="bto-promo-desc">{desc}</span>
      </span>
      <span className="bto-promo-arrow">↗</span>
    </a>
  );
}

export function BtoPromo({
  title = "Planning a BTO?",
  desc = "Check out our BTO Planning Tool for eligibility, timelines and flat selection.",
}: {
  title?: string;
  desc?: string;
}) {
  return <PromoLink href={BTO_TOOL_URL} icon="🏗️" title={title} desc={desc} />;
}

// A separate tool (not part of SG Money's no-backend calculators) that lets
// users upload a policy/document and get a plain-English explanation of it.
// Uploads are processed on that tool's own server — its privacy notice says
// they're never stored — which is different from SG Money's calculators,
// where nothing ever leaves the device. The copy below says so plainly.
export function DocToolsPromo({
  title = "Not sure what your insurance policy actually says?",
  desc = "Upload it to our Document Explainer for a plain-English breakdown. It's a separate tool — your file is processed on its server (not stored), unlike SG Money's calculators which never leave your device.",
}: {
  title?: string;
  desc?: string;
}) {
  return <PromoLink href={DOC_TOOLS_URL} icon="📄" title={title} desc={desc} />;
}
