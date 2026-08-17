// Single source of truth for the calculator list — used by the Home screen
// and by the cross-calculator nav in CalcShell so both stay in sync.
export interface CalculatorMeta {
  to: string;
  icon: string;
  title: string;
  desc: string;
}

// Sister project — a separate app, cross-linked because HDB/BTO planning and
// SG Money's calculators serve the same audience at different decision points.
export const BTO_TOOL_URL = "https://bto-planning-tool.web.app/";

// Another sister project — an AI document analysis tool (Plain-English
// Translator, ToS/Privacy Risk Scanner, Contract Risk Highlighter). Unlike
// SG Money, it processes uploads on a server (not stored, per its own
// privacy notice) rather than entirely on-device, so it's cross-linked as a
// separate tool rather than merged in, to keep SG Money's own
// "nothing sent to a server" promise intact for its calculators.
export const DOC_TOOLS_URL = "https://document-tools.up.railway.app/";

export const PREMIUM_REPORT_PAYMENT_LINK = "https://buy.stripe.com/aFa14nfOKeDg0R8azz1ZS00";
export const PREMIUM_REPORT_PRICE_LABEL = "S$12.90";

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
  {
    to: "/property-listings",
    icon: "🏘️",
    title: "Property Listings",
    desc: "Browse or list properties by district",
  },
];
