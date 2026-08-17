import { useState } from "react";
import { Link } from "react-router-dom";
import { usePageMeta } from "../lib/usePageMeta";
import { CALCULATORS } from "../lib/calculators";
import { BtoPromo, DocToolsPromo } from "../components/CalcShell";
import { LeadForm } from "../components/LeadForm";

export default function Home() {
  usePageMeta(
    "CPF, Salary & HDB Calculators for Singapore",
    "Free Singapore money calculators: CPF & salary take-home pay, HDB sale proceeds, CPF accrued interest, retirement and car ownership cost. No login, calculations stay on your device."
  );
  const [showCondoForm, setShowCondoForm] = useState(false);

  return (
    <div className="home">
      <header className="home-header">
        <h1>🇸🇬 SG-Money-CPF-HDB-Calculator</h1>
        <p>Your Singapore Money Calculator</p>
      </header>

      <div className="tool-list">
        {CALCULATORS.map((t) => (
          <Link to={t.to} key={t.to} className="tool-card">
            <span className="tool-icon">{t.icon}</span>
            <span className="tool-text">
              <span className="tool-title">{t.title}</span>
              <span className="tool-desc">{t.desc}</span>
            </span>
            <span className="tool-arrow">→</span>
          </Link>
        ))}

        <button
          type="button"
          className="tool-card tool-card-expandable"
          onClick={() => setShowCondoForm((s) => !s)}
          aria-expanded={showCondoForm}
        >
          <span className="tool-icon">🏢</span>
          <span className="tool-text">
            <span className="tool-title">Condo New Launches</span>
            <span className="tool-desc">Get notified about new condo launches near you</span>
          </span>
          <span className="tool-arrow">{showCondoForm ? "▴" : "▾"}</span>
        </button>
      </div>

      {showCondoForm && (
        <LeadForm
          calculatorId="condo-new-launches"
          category="mortgage"
          compact={false}
          showProjectPicker
          headline="Be the first to know about new condo launches near you."
          message="Leave your contact and we'll notify you as new projects launch — no spam, just genuinely relevant updates."
          intentLabel="Condo New Launches"
        />
      )}

      <BtoPromo />

      <DocToolsPromo />

      <footer className="home-footer">
        <p>Free • No registration • Local calculations • Privacy-first</p>
        <p className="lock">🔒 Your financial data stays on your device.</p>
        <p>
          <Link to="/backup" className="backup-link">
            💾 Backup or restore your data
          </Link>
        </p>
      </footer>
    </div>
  );
}
