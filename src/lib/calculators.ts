// Single source of truth for the calculator list — used by the Home screen
// and by the cross-calculator nav in CalcShell so both stay in sync.
export interface CalculatorMeta {
  to: string;
  icon: string;
  title: string;
  desc: string;
}

export const CALCULATORS: CalculatorMeta[] = [
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
