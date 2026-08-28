// Net-worth / retirement-dashboard helpers. Everything here is derived purely from
// numbers the user has typed into this device's browser — nothing is looked up,
// nothing is sent anywhere.

import type { CpfLifeTargetTier } from "./cpf";

export interface LineItem {
  id: string;
  label: string;
  amount: number;
  // Both optional "YYYY-MM-DD" (native <input type="date"> values). Outside this
  // [startDate, endDate] window the item is excluded from sums — startDate for
  // something that hasn't kicked in yet (a new loan starting next quarter),
  // endDate for a loan or policy with a known finish date — so nobody has to
  // remember to add or delete it exactly on the day. Both undefined/empty means
  // "always active". Currently only exposed in the UI for expense items and
  // investment holdings (see EditableLineItems' showEndDate prop).
  startDate?: string;
  endDate?: string;
  // Free-text note, e.g. "policy number", "which broker", "why this loan exists". Purely
  // informational — never read by any calculation, just stored and shown back to the user.
  note?: string;
  // Optional attached document (e.g. a scanned insurance policy PDF). Only the id and
  // display metadata live here in the JSON-serialized calculator data — the actual file
  // is stored separately in IndexedDB (see src/lib/attachments.ts), since a PDF is far
  // too large for localStorage's shared quota. Currently only exposed in the UI for Net
  // Worth Snapshot holdings (see EditableLineItems' allowAttachment prop). Because it
  // lives in IndexedDB, it is NOT included in Backup & Restore.
  attachmentId?: string;
  attachmentName?: string;
}

let nextId = 1;
export function newLineItemId(): string {
  // Not cryptographically unique — fine for a client-only list key, avoids pulling in uuid.
  nextId += 1;
  return `item-${Date.now()}-${nextId}`;
}

// today defaults to the real current date; accepting it as a param keeps this
// testable without relying on the ambient clock. Dates are compared as plain
// "YYYY-MM-DD" strings (both the input value and this ISO-slice sort
// lexicographically the same as chronologically) — avoids timezone-shift bugs
// from constructing a Date from a date-only string.
export function isLineItemEnded(item: LineItem, today: Date = new Date()): boolean {
  if (!item.endDate) return false;
  const todayStr = today.toISOString().slice(0, 10);
  return item.endDate < todayStr;
}

export function isLineItemNotYetStarted(item: LineItem, today: Date = new Date()): boolean {
  if (!item.startDate) return false;
  const todayStr = today.toISOString().slice(0, 10);
  return item.startDate > todayStr;
}

export interface LineItemActiveOptions {
  // For an expense or liability, "ended" correctly means the cost stopped, so it should
  // drop out. For an investment or insurance holding, an end date instead marks when the
  // policy matures/pays out — the money doesn't vanish, it just becomes cash — so callers
  // summing that kind of list pass ignoreEndDate so a matured item keeps counting.
  ignoreEndDate?: boolean;
}

export function isLineItemActive(
  item: LineItem,
  today: Date = new Date(),
  opts: LineItemActiveOptions = {}
): boolean {
  const ended = opts.ignoreEndDate ? false : isLineItemEnded(item, today);
  return !ended && !isLineItemNotYetStarted(item, today);
}

export function sumLineItems(
  items: LineItem[],
  today: Date = new Date(),
  opts: LineItemActiveOptions = {}
): number {
  return items.reduce(
    (total, item) =>
      total + (Number.isFinite(item.amount) && isLineItemActive(item, today, opts) ? item.amount : 0),
    0
  );
}

// Approximate age at a future "YYYY-MM-DD" date, given today's whole-year age.
// The app only ever collects a whole-number "current age" (no birthdate), so
// this is a calendar-year approximation — good enough for flagging "this
// finishes around when I turn 60", not for anything that needs day-level
// precision.
export function ageAtDate(currentAge: number, dateStr: string, today: Date = new Date()): number {
  const targetYear = parseInt(dateStr.slice(0, 4), 10);
  return currentAge + (targetYear - today.getFullYear());
}

// Inverse of ageAtDate: the approximate calendar date at which someone turns
// targetAge, given their currentAge today. Same whole-year approximation as
// ageAtDate (no birthdate collected) — good enough for filtering "will this
// expense still be running when I retire", not day-level precision. Pass the
// result into isLineItemActive/sumLineItems as the `today` param to check a
// line item's status as of a future date instead of right now.
export function dateAtAge(currentAge: number, targetAge: number, today: Date = new Date()): Date {
  const result = new Date(today);
  result.setFullYear(result.getFullYear() + (targetAge - currentAge));
  return result;
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
  // If your CPF refund alone doesn't cover your selected BRS/FRS/ERS retirement sum, CPF Board
  // requires the shortfall to be topped up from your sale proceeds before releasing any cash to
  // you — UNLESS you pledge a replacement property, in which case only the lower Basic Retirement
  // Sum applies instead. Pass the (already refund-netted) shortfall here to have it deducted from
  // cashReleased; pass 0 or omit if you're pledging your replacement flat for BRS instead, since
  // then no further cash top-up is required. Defaults to 0.
  additionalRetirementSumTopUp?: number;
}

export interface RightsizingResult {
  balanceAfterCpfRefund: number;
  additionalRetirementSumTopUp: number;
  cashReleased: number;
}

export function computeRightsizing(input: RightsizingInput): RightsizingResult {
  const balanceAfterCpfRefund = input.saleProceeds - input.cpfRefund;
  const additionalRetirementSumTopUp = Math.max(0, input.additionalRetirementSumTopUp ?? 0);
  const cashReleased =
    balanceAfterCpfRefund - input.replacementFlatPrice - input.legalMovingCosts - additionalRetirementSumTopUp;
  return { balanceAfterCpfRefund, additionalRetirementSumTopUp, cashReleased };
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
export const STATUS_SCORE: Record<HealthStatus, number> = {
  strong: 9,
  good: 7.5,
  moderate: 5.5,
  attention: 2.5,
};

const CPF_LIFE_TIER_NAME: Record<CpfLifeTargetTier, string> = { brs: "BRS", frs: "FRS", ers: "ERS" };

export interface HealthCheckInput {
  cpfOaSaRa: number; // counted-toward-retirement CPF (OA + SA/RA)
  cpfFrs: number; // Full Retirement Sum reference point
  cpfBrs: number; // Basic Retirement Sum reference point
  cpfErs: number; // Enhanced Retirement Sum reference point
  hdbLoanOutstanding: number | null; // null = unknown / no HDB data saved
  totalInvestments: number;
  investmentItemCount: number;
  cashAndInvestmentsForLiquidity: number; // "current savings" — liquid pot
  totalMonthlyExpenses: number;
  totalMonthlyLiabilities: number; // monthly debt repayments (mortgage, car loan, education loan, etc.)
  hasLoanLikeExpense: boolean;
  monthlySurplus: number;
  totalMonthlyIncome: number;
  onTrackForRetirement: boolean;
  cpfLifeTargetTier: CpfLifeTargetTier; // which RA tier the user selected in the CPF LIFE section
  projectedCpfForRetirementAccount: number; // projected OA+SA/RA the CPF LIFE estimate is based on (uncapped)
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

  // CPF LIFE tier plan — is the tier picked in the CPF LIFE section actually realistic?
  // BRS only works if you pledge your property (see the CPF LIFE section's explainer), so it always
  // gets flagged for confirmation rather than a pass/fail — this calculator can't know if you've pledged.
  const tierName = CPF_LIFE_TIER_NAME[input.cpfLifeTargetTier];
  if (input.cpfLifeTargetTier === "brs") {
    dimensions.push({
      key: "cpfLifeTier",
      label: "CPF LIFE Tier Plan",
      status: "moderate",
      note: "BRS only applies if you pledge your property — confirm this with CPF Board, since it isn't the default.",
    });
  } else {
    const tierAmount = input.cpfLifeTargetTier === "ers" ? input.cpfErs : input.cpfFrs;
    if (input.projectedCpfForRetirementAccount >= tierAmount) {
      dimensions.push({
        key: "cpfLifeTier",
        label: "CPF LIFE Tier Plan",
        status: "strong",
        note: `Projected CPF is on track to reach your selected ${tierName}.`,
      });
    } else {
      dimensions.push({
        key: "cpfLifeTier",
        label: "CPF LIFE Tier Plan",
        status: "attention",
        note: `Projected CPF falls short of your selected ${tierName} — payout will be lower than shown unless you top up.`,
      });
    }
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

  // Liquidity — months of expenses + liability repayments covered by cash/investments
  const totalMonthlyOutflows = input.totalMonthlyExpenses + input.totalMonthlyLiabilities;
  if (totalMonthlyOutflows > 0) {
    const monthsCovered = input.cashAndInvestmentsForLiquidity / totalMonthlyOutflows;
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
  const hasOtherDebtRepayments = input.hasLoanLikeExpense || input.totalMonthlyLiabilities > 0;
  if (hdbDebt <= 0 && !hasOtherDebtRepayments) {
    dimensions.push({ key: "debt", label: "Debt", status: "strong", note: "No outstanding HDB loan or loan repayments listed." });
  } else if (hdbDebt <= 0 && hasOtherDebtRepayments) {
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
