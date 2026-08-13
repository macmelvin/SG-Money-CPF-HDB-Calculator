import { Link } from "react-router-dom";
import { usePageMeta } from "../lib/usePageMeta";
import { CALCULATORS } from "../lib/calculators";
import { BtoPromo, DocToolsPromo } from "../components/CalcShell";

export default function Home() {
  usePageMeta(
    "CPF, Salary & HDB Calculators for Singapore",
    "Free Singapore money calculators: CPF & salary take-home pay, HDB sale proceeds, CPF accrued interest, retirement and car ownership cost. No login, calculations stay on your device."
  );
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
      </div>

      <BtoPromo />

      <DocToolsPromo />

      <footer className="home-footer">
        <p>Free • No registration • Local calculations • Privacy-first</p>
        <p className="lock">🔒 Your financial data stays on your device.</p>
      </footer>
    </div>
  );
}
