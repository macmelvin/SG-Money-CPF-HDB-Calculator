// Shows what the Premium Report's Dashboard appendix actually looks like, before the person
// pays — by rendering the app's real RetirementDashboardExportCard with illustrative example
// numbers (never the person's real data), scaled down to fit as a preview and watermarked
// "SAMPLE DATA". Reuses the exact same component the real report uses, so this preview never
// drifts out of sync with what someone actually gets after unlocking.

import { useLayoutEffect, useRef, useState } from "react";
import { RetirementDashboardExportCard } from "./RetirementDashboardExport";
import type { DashboardExportData } from "./RetirementDashboardExport";

const DASHBOARD_NATURAL_WIDTH = 1400; // matches .dex-root's fixed width in dashboard-export.css

const SAMPLE_DASHBOARD_DATA: DashboardExportData = {
  generatedOn: "1 January 2026",
  currentAge: 40,
  retirementAge: 62,
  yearsToRetirement: 22,
  monthlyIncome: 5000,
  monthlySurplus: 2600,
  onTrack: true,

  netWorth: 870000,
  hdbValue: 700000,
  totalCpf: 120000,
  totalInvestments: 50000,
  slices: [
    { key: "hdb", label: "HDB Property", value: 700000, pct: 80 },
    { key: "cpf", label: "CPF", value: 120000, pct: 14 },
    { key: "investments", label: "Investments & Insurance", value: 50000, pct: 6 },
  ],

  cpfOa: 60000,
  cpfMa: 20000,
  cpfSaRa: 40000,

  incomeItems: [{ id: "sample-income-1", label: "Salary", amount: 5000 }],
  totalIncome: 5000,
  totalExpenses: 2400,
  totalLiabilities: 0,

  investmentItems: [{ id: "sample-invest-1", label: "Unit trusts / stocks", amount: 50000 }],
  expenseItems: [{ id: "sample-expense-1", label: "Living expenses", amount: 2400 }],
  liabilityItems: [],

  hdbOverview: {
    saleValue: 700000,
    cpfPrincipalUsed: 190000,
    cpfAccruedInterest: 120000,
    cpfRefund: 310000,
    loanOutstanding: 90000,
  },
  rightsizing: null,
  financialPositionAfter: null,

  healthDimensions: [
    { key: "cpf", label: "CPF Position", status: "moderate", note: "Below the Basic Retirement Sum." },
    { key: "cpfLife", label: "CPF LIFE Tier Plan", status: "strong", note: "Projected CPF is on track to reach your selected FRS." },
    { key: "property", label: "Property Position", status: "moderate", note: "Still carrying an HDB loan." },
    { key: "portfolio", label: "Investment Portfolio", status: "moderate", note: "Concentrated in a small number of holdings." },
    { key: "liquidity", label: "Liquidity", status: "strong", note: "Healthy surplus each month." },
    { key: "debt", label: "Debt", status: "moderate", note: "Still carrying an outstanding loan." },
    { key: "cashFlow", label: "Monthly Cash Flow", status: "strong", note: "Covers ~63 months of expenses." },
    { key: "planning", label: "Retirement Planning", status: "strong", note: "Projected to meet your target." },
  ],
  overallScore: 73,

  timelineSteps: [
    { age: "40–62", icon: "🌱", label: "Grow investments & build cash reserves" },
    { age: "62", icon: "🏁", label: "Retire" },
    { age: "65", icon: "🏦", label: "CPF LIFE payouts begin (bridge the gap before this with cash/investments)" },
    { age: "80+", icon: "🩺", label: "Review portfolio & healthcare needs" },
    { age: "Legacy", icon: "🌳", label: "Preserve wealth & plan for beneficiaries" },
  ],
};

// The real dashboard is a fixed 1400px-wide capture target (see dashboard-export.css) — much
// wider than the card it's previewed in, so instead of a fixed shrink factor (which either
// leaves it too big to fit, cropping the sides, or too small to read), the scale is computed
// from the actual available width so the full image is always visible with nothing cut off.
export function PremiumReportPreview() {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [scaledHeight, setScaledHeight] = useState(0);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const recompute = () => {
      const availableWidth = outer.clientWidth;
      if (!availableWidth) return;
      const nextScale = availableWidth / DASHBOARD_NATURAL_WIDTH;
      setScale(nextScale);
      setScaledHeight(Math.round(inner.offsetHeight * nextScale));
    };

    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(outer);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="rp-dashboard-wrap" ref={outerRef}>
      <div className="rp-dashboard-frame" style={{ height: scaledHeight || 260 }}>
        <div
          className="rp-dashboard-scale"
          style={{ transform: `scale(${scale || 0.001})` }}
          ref={innerRef}
        >
          <RetirementDashboardExportCard data={SAMPLE_DASHBOARD_DATA} />
        </div>
        <div className="rp-watermark">SAMPLE DATA</div>
      </div>
      <p className="rp-caption">
        A preview of the Dashboard page included in your report — shown with example numbers. Your report uses your
        own inputs.
      </p>
    </div>
  );
}
