import { Link } from "react-router-dom";

const TOOLS = [
  {
    to: "/salary-calculator",
    icon: "💰",
    title: "Salary & CPF",
    desc: "Calculate your take-home salary",
  },
  {
    to: "/hdb-sale-proceeds",
    icon: "🏠",
    title: "HDB Sale",
    desc: "How much will you receive after selling?",
  },
  {
    to: "/cpf-accrued-interest",
    icon: "📈",
    title: "CPF Accrued Interest",
    desc: "Estimate your CPF housing refund",
  },
  {
    to: "/retirement-calculator",
    icon: "👴",
    title: "Retirement",
    desc: "Are you on track for retirement?",
  },
  {
    to: "/car-cost-calculator",
    icon: "🚗",
    title: "Car Cost",
    desc: "What's your true monthly car cost?",
  },
];

export default function Home() {
  return (
    <div className="home">
      <header className="home-header">
        <h1>🇸🇬 SG Money</h1>
        <p>Your Singapore Money Calculator</p>
      </header>

      <div className="tool-list">
        {TOOLS.map((t) => (
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

      <footer className="home-footer">
        <p>Free • No registration • Local calculations • Privacy-first</p>
        <p className="lock">🔒 Your financial data stays on your device.</p>
      </footer>
    </div>
  );
}
