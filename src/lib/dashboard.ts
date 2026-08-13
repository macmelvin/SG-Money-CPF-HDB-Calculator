// Net-worth / retirement-dashboard helpers. Everything here is derived purely from
// numbers the user has typed into this device's browser — nothing is looked up,
// nothing is sent anywhere.

export interface LineItem {
  id: string;
  label: string;
  amount: number;
}

let nextId = 1;
export function newLineItemId(): string {
  // Not cryptographically unique — fine for a client-only list key, avoids pulling in uuid.
  nextId += 1;
  return `item-${Date.now()}-${nextId}`;
}

export function sumLineItems(items: LineItem[]): number {
  return items.reduce((total, item) => total + (Number.isFinite(item.amount) ? item.amount : 0), 0);
}

export interface AssetAllocationInput {
  hdbValue: number;
  totalCpf: number;
  totalInvestments: number;
}

export interface AllocationSlice {
  key: "hdb" | "cpf" | "investments";
  label: string;
  value: number;
  pct: number;
}

export function computeNetWorth({ hdbValue, totalCpf, totalInvestments }: AssetAllocationInput): {
  netWorth: number;
  slices: AllocationSlice[];
} {
  const netWorth = hdbValue + totalCpf + totalInvestments;
  const pct = (v: number) => (netWorth > 0 ? (v / netWorth) * 100 : 0);
  const slices: AllocationSlice[] = [
    { key: "hdb", label: "HDB Property", value: hdbValue, pct: pct(hdbValue) },
    { key: "cpf", label: "CPF", value: totalCpf, pct: pct(totalCpf) },
    { key: "investments", label: "Investments & Insurance", value: totalInvestments, pct: pct(totalInvestments) },
  ];
  return { netWorth, slices };
}

export interface RightsizingInput {
  saleProceeds: number; // e.g. current HDB value / estimated sale price
  cpfRefund: number; // from the HDB Sale Proceeds calculator, if saved
  replacementFlatPrice: number;
  legalMovingCosts: number;
}

export interface RightsizingResult {
  balanceAfterCpfRefund: number;
  cashReleased: number;
}

export function computeRightsizing(input: RightsizingInput): RightsizingResult {
  const balanceAfterCpfRefund = input.saleProceeds - input.cpfRefund;
  const cashReleased = balanceAfterCpfRefund - input.replacementFlatPrice - input.legalMovingCosts;
  return { balanceAfterCpfRefund, cashReleased };
}

export type HealthStatus = "strong" | "good" | "moderate" | "attention";

export interface HealthDimension {
  key: string;
  label: string;
  status: HealthStatus;
  note: string;
}

export const HEALTH_STATUS_LABEL: Record<HealthStatus, string> = {
  strong: "Strong",
  good: "Good",
  moderate: "Moderate",
  attention: "Needs attention",
};

// Maps a qualitative band to a 0-10 score purely for the illustrative composite number —
// these thresholds are simple rules of thumb, not a professional assessment.
const STATUS_SCORE: Record<HealthStatus, number> = {
  strong: 9,
  good: 7.5,
  moderate: 5.5,
  attention: 2.5,
};

export interface HealthCheckInput {
  cpfOaSaRa: number; // counted-toward-retirement CPF (OA + SA/RA)
  cpfFrs: number; // Full Retirement Sum reference point
  cpfBrs: number; // Basic Retirement Sum reference point
  hdbLoanOutstanding: number | null; // null = unknown / no HDB data saved
  totalInvestments: number;
  investmentItemCount: number;
  cashAndInvestmentsForLiquidity: number; // "current savings" — liquid pot
  totalMonthlyExpenses: number;
  hasLoanLikeExpense: boolean;
  monthlySurplus: number;
  totalMonthlyIncome: number;
  onTrackForRetirement: boolean;
}

export function computeHealthCheck(input: HealthCheckInput): {
  dimensions: HealthDimension[];
  overallScore: number;
} {
  const dimensions: HealthDimension[] = [];

  // CPF position
  if (input.cpfOaSaRa >= input.cpfFrs) {
    dimensions.push({ key: "cpf", label: "CPF Position", status: "strong", note: "At or above the Full Retirement Sum." });
  } else if (input.cpfOaSaRa >= input.cpfBrs) {
    dimensions.push({ key: "cpf", label: "CPF Position", status: "good", note: "At or above the Basic Retirement Sum." });
  } else if (input.cpfOaSaRa > 0) {
    dimensions.push({ key: "cpf", label: "CPF Position", status: "moderate", note: "Below the Basic Retirement Sum." });
  } else {
    dimensions.push({ key: "cpf", label: "CPF Position", status: "attention", note: "No CPF OA/SA-RA entered yet." });
  }

  // Property position
  if (input.hdbLoanOutstanding === null) {
    dimensions.push({ key: "property", label: "Property Position", status: "moderate", note: "Save your HDB numbers to check this." });
  } else if (input.hdbLoanOutstanding <= 0) {
    dimensions.push({ key: "property", label: "Property Position", status: "strong", note: "HDB loan fully paid off." });
  } else {
    dimensions.push({ key: "property", label: "Property Position", status: "moderate", note: "Still carrying an HDB loan." });
  }

  // Investment portfolio
  if (input.totalInvestments <= 0) {
    dimensions.push({ key: "investments", label: "Investment Portfolio", status: "attention", note: "No investments/insurance listed yet." });
  } else if (input.investmentItemCount >= 3) {
    dimensions.push({ key: "investments", label: "Investment Portfolio", status: "good", note: "Spread across several holdings." });
  } else {
    dimensions.push({ key: "investments", label: "Investment Portfolio", status: "moderate", note: "Concentrated in a small number of holdings." });
  }

  // Liquidity — months of expenses covered by cash/investments
  if (input.totalMonthlyExpenses > 0) {
    const monthsCovered = input.cashAndInvestmentsForLiquidity / input.totalMonthlyExpenses;
    if (monthsCovered >= 12) {
      dimensions.push({ key: "liquidity", label: "Liquidity", status: "strong", note: `Covers ~${Math.round(monthsCovered)} months of expenses.` });
    } else if (monthsCovered >= 6) {
      dimensions.push({ key: "liquidity", label: "Liquidity", status: "good", note: `Covers ~${Math.round(monthsCovered)} months of expenses.` });
    } else if (monthsCovered >= 3) {
      dimensions.push({ key: "liquidity", label: "Liquidity", status: "moderate", note: `Covers ~${Math.round(monthsCovered)} months of expenses.` });
    } else {
      dimensions.push({ key: "liquidity", label: "Liquidity", status: "attention", note: `Covers under 3 months of expenses.` });
    }
  } else {
    dimensions.push({ key: "liquidity", label: "Liquidity", status: "moderate", note: "Add your monthly expenses to check this." });
  }

  // Debt
  const hdbDebt = input.hdbLoanOutstanding ?? 0;
  if (hdbDebt <= 0 && !input.hasLoanLikeExpense) {
    dimensions.push({ key: "debt", label: "Debt", status: "strong", note: "No outstanding HDB loan or loan repayments listed." });
  } else if (hdbDebt <= 0 && input.hasLoanLikeExpense) {
    dimensions.push({ key: "debt", label: "Debt", status: "moderate", note: "HDB loan clear, but other loan repayments listed." });
  } else {
    dimensions.push({ key: "debt", label: "Debt", status: "moderate", note: "Still carrying an outstanding HDB loan." });
  }

  // Cash flow
  if (input.totalMonthlyIncome > 0) {
    const surplusRatio = input.monthlySurplus / input.totalMonthlyIncome;
    if (surplusRatio >= 0.3) {
      dimensions.push({ key: "cashflow", label: "Monthly Cash Flow", status: "strong", note: "Healthy surplus each month." });
    } else if (surplusRatio >= 0.1) {
      dimensions.push({ key: "cashflow", label: "Monthly Cash Flow", status: "good", note: "Positive surplus each month." });
    } else if (surplusRatio >= 0) {
      dimensions.push({ key: "cashflow", label: "Monthly Cash Flow", status: "moderate", note: "Thin surplus each month." });
    } else {
      dimensions.push({ key: "cashflow", label: "Monthly Cash Flow", status: "attention", note: "Spending more than you bring in." });
    }
  } else {
    dimensions.push({ key: "cashflow", label: "Monthly Cash Flow", status: "moderate", note: "Add your income and expenses to check this." });
  }

  // Retirement planning — reuses the surplus/shortfall verdict from the main projection
  dimensions.push({
    key: "planning",
    label: "Retirement Planning",
    status: input.onTrackForRetirement ? "strong" : "attention",
    note: input.onTrackForRetirement ? "Projected to meet your target." : "Projected shortfall against your target.",
  });

  const overallScore = Math.round(
    (dimensions.reduce((sum, d) => sum + STATUS_SCORE[d.status], 0) / dimensions.length) * 10
  );

  return { dimensions, overallScore: Math.max(0, Math.min(100, overallScore)) };
}
