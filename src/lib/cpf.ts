// SG-Money-CPF-HDB-Calculator — Shared CPF calculation engine
// Rates sourced from CPF Board, applicable for 2026.
// Ordinary Wage (OW) ceiling: S$8,000/month. Annual salary ceiling: S$102,000.
// These are ESTIMATES for planning purposes only — not official CPF Board figures.

export type CitizenshipStatus = "citizen" | "pr1" | "pr2" | "pr3plus";

export interface CpfRateBand {
  minAge: number; // inclusive
  maxAge: number; // exclusive (use 200 for "and above")
  employer: number; // employer contribution rate, e.g. 0.17
  employee: number; // employee contribution rate, e.g. 0.20
}

// Full (Citizen / PR 3rd-year-and-above) contribution rates by age band, 2026.
export const CPF_RATE_BANDS: CpfRateBand[] = [
  { minAge: 0, maxAge: 55, employer: 0.17, employee: 0.20 },
  { minAge: 55, maxAge: 60, employer: 0.16, employee: 0.18 },
  { minAge: 60, maxAge: 65, employer: 0.125, employee: 0.125 },
  { minAge: 65, maxAge: 70, employer: 0.09, employee: 0.075 },
  { minAge: 70, maxAge: 200, employer: 0.075, employee: 0.05 },
];

export const OW_CEILING_MONTHLY = 8000; // S$/month, 2026
export const CPF_ANNUAL_SALARY_CEILING = 102000; // S$/year, 2026

export function getCpfRatesForAge(age: number): CpfRateBand {
  return (
    CPF_RATE_BANDS.find((b) => age >= b.minAge && age < b.maxAge) ??
    CPF_RATE_BANDS[CPF_RATE_BANDS.length - 1]
  );
}

// Official CPF allocation ratios (how total contribution splits across OA /
// SA-RA / MA), from 1 January 2026. Source: CPF Board's published allocation
// table (cpf.gov.sg/content/dam/web/employer/employer-obligations/documents/
// CPFAllocationRatesfromJanuary2026.pdf). MA is computed first, then SA/RA,
// with OA receiving the remainder — matching CPF Board's own worked examples.
export interface CpfAllocationBand {
  minAge: number; // inclusive
  maxAge: number; // exclusive (use 200 for "and above")
  oa: number;
  saRa: number; // Special Account below 55, Retirement Account from 55
  ma: number;
}

export const CPF_ALLOCATION_BANDS: CpfAllocationBand[] = [
  { minAge: 0, maxAge: 35, oa: 0.6217, saRa: 0.1621, ma: 0.2162 },
  { minAge: 35, maxAge: 45, oa: 0.5677, saRa: 0.1891, ma: 0.2432 },
  { minAge: 45, maxAge: 50, oa: 0.5136, saRa: 0.2162, ma: 0.2702 },
  { minAge: 50, maxAge: 55, oa: 0.4055, saRa: 0.3108, ma: 0.2837 },
  { minAge: 55, maxAge: 60, oa: 0.353, saRa: 0.3382, ma: 0.3088 },
  { minAge: 60, maxAge: 65, oa: 0.14, saRa: 0.44, ma: 0.42 },
  { minAge: 65, maxAge: 70, oa: 0.0607, saRa: 0.303, ma: 0.6363 },
  { minAge: 70, maxAge: 200, oa: 0.08, saRa: 0.08, ma: 0.84 },
];

export function getCpfAllocationForAge(age: number): CpfAllocationBand {
  return (
    CPF_ALLOCATION_BANDS.find((b) => age >= b.minAge && age < b.maxAge) ??
    CPF_ALLOCATION_BANDS[CPF_ALLOCATION_BANDS.length - 1]
  );
}

// IRAS resident individual income tax brackets, YA2024 onwards (current for
// YA2026 — IRAS's own page confirms these are unchanged). Each entry is the
// marginal rate applied to income WITHIN that band, not cumulative income.
export interface TaxBracket {
  upTo: number; // exclusive upper bound of this band; Infinity for the top band
  rate: number; // marginal rate applied to the portion of income in this band
}

export const INCOME_TAX_BRACKETS: TaxBracket[] = [
  { upTo: 20000, rate: 0 },
  { upTo: 30000, rate: 0.02 },
  { upTo: 40000, rate: 0.035 },
  { upTo: 80000, rate: 0.07 },
  { upTo: 120000, rate: 0.115 },
  { upTo: 160000, rate: 0.15 },
  { upTo: 200000, rate: 0.18 },
  { upTo: 240000, rate: 0.19 },
  { upTo: 280000, rate: 0.195 },
  { upTo: 320000, rate: 0.2 },
  { upTo: 500000, rate: 0.22 },
  { upTo: 1000000, rate: 0.23 },
  { upTo: Infinity, rate: 0.24 },
];

// Earned Income Relief — a standard relief virtually every employed resident
// gets automatically (unlike optional reliefs for spouse/parent/child/NSman
// etc., which depend on personal circumstances this calculator has no way
// to know). Including this gets the estimate meaningfully closer without
// needing extra inputs.
export function getEarnedIncomeRelief(age: number): number {
  if (age >= 60) return 8000;
  if (age >= 55) return 6000;
  return 1000;
}

// Computes tax on chargeable income using IRAS's progressive brackets.
// Does NOT include any one-off Budget rebate (e.g. YA2025's 60%-up-to-$200
// rebate) since those are announced year to year and aren't guaranteed to
// recur — the estimate is deliberately a touch conservative (slightly
// overstates tax) rather than assume a rebate that may not apply.
export function calculateIncomeTax(chargeableIncome: number): number {
  if (chargeableIncome <= 0) return 0;
  let tax = 0;
  let lowerBound = 0;
  for (const bracket of INCOME_TAX_BRACKETS) {
    if (chargeableIncome <= lowerBound) break;
    const amountInBand = Math.min(chargeableIncome, bracket.upTo) - lowerBound;
    tax += amountInBand * bracket.rate;
    lowerBound = bracket.upTo;
  }
  return Math.round(tax);
}

export interface SalaryCpfInput {
  age: number;
  monthlyGross: number;
  /**
   * Regular monthly sales commission — treated as Ordinary Wages (merged
   * with monthlyGross for the OW ceiling), which is the standard CPF
   * treatment for commission paid monthly as part of normal wages. If your
   * commission is instead an irregular lump-sum payment, treat it as
   * bonus/AW below instead.
   */
  monthlySalesCommission?: number;
  monthlyBonus?: number; // additional wages, simplified as flat monthly addition
  status: CitizenshipStatus;
  /** Set true to also compute an income tax estimate (opt-in since it needs
   *  simplifying assumptions the base CPF/take-home numbers don't). */
  estimateIncomeTax?: boolean;
}

export interface SalaryCpfResult {
  grossSalary: number;
  employeeCpf: number;
  takeHome: number;
  employerCpf: number;
  totalCpf: number;
  ratesUsed: { employer: number; employee: number };
  /** How this month's total CPF contribution splits across accounts. */
  allocation: { oa: number; saRa: number; ma: number };
  annual: {
    grossSalary: number;
    employeeCpf: number;
    employerCpf: number;
    takeHome: number;
  };
  /** Only set when estimateIncomeTax is true. */
  incomeTaxEstimate?: {
    chargeableIncome: number;
    estimatedTax: number;
    effectiveRate: number; // estimatedTax / annual gross, as a fraction
  };
}

// Simplified PR graduated rates (illustrative — PR1/PR2 use graduated contribution
// rates lower than full rates; production version should use CPF Board's full table).
const PR_MULTIPLIER: Record<CitizenshipStatus, { employer: number; employee: number }> = {
  citizen: { employer: 1, employee: 1 },
  pr3plus: { employer: 1, employee: 1 },
  pr1: { employer: 0.5, employee: 0.2 }, // rough approximation
  pr2: { employer: 0.85, employee: 0.6 }, // rough approximation
};

export function calculateSalaryCpf(input: SalaryCpfInput): SalaryCpfResult {
  const { age, monthlyGross, monthlySalesCommission = 0, monthlyBonus = 0, status, estimateIncomeTax } = input;
  const base = getCpfRatesForAge(age);
  const mult = PR_MULTIPLIER[status];

  const employerRate = base.employer * mult.employer;
  const employeeRate = base.employee * mult.employee;

  // Regular commission is Ordinary Wages — merged with base salary before
  // applying the OW ceiling, same as if it were just a higher salary.
  const totalOrdinaryWage = monthlyGross + monthlySalesCommission;
  const cpfableOw = Math.min(totalOrdinaryWage, OW_CEILING_MONTHLY);

  // Additional Wage (bonus) ceiling: $102,000/year minus the OW actually
  // subject to CPF for the year. Assumes this month's OW is representative
  // of every month (a simplification — real AW ceilings use actual annual
  // OW, which varies if pay changes mid-year).
  const annualCpfableOw = cpfableOw * 12;
  const awCeilingRemaining = Math.max(0, CPF_ANNUAL_SALARY_CEILING - annualCpfableOw);
  const cpfableAw = Math.min(monthlyBonus, awCeilingRemaining); // simplified: treats bonus as if spread evenly

  const cpfableWage = cpfableOw + cpfableAw;

  const employeeCpf = Math.round(cpfableWage * employeeRate);
  const employerCpf = Math.round(cpfableWage * employerRate);
  const grossSalary = monthlyGross + monthlySalesCommission + monthlyBonus;
  const takeHome = grossSalary - employeeCpf;
  const totalCpf = employeeCpf + employerCpf;

  const allocationRates = getCpfAllocationForAge(age);
  const maAmount = Math.round(totalCpf * allocationRates.ma);
  const saRaAmount = Math.round(totalCpf * allocationRates.saRa);
  const oaAmount = totalCpf - maAmount - saRaAmount; // remainder, matching CPF Board's own method

  const annualGrossSalary = grossSalary * 12;
  const annualEmployeeCpf = employeeCpf * 12;
  const annualEmployerCpf = employerCpf * 12;
  const annualTakeHome = takeHome * 12;

  let incomeTaxEstimate;
  if (estimateIncomeTax) {
    const earnedIncomeRelief = getEarnedIncomeRelief(age);
    const chargeableIncome = Math.max(0, annualGrossSalary - annualEmployeeCpf - earnedIncomeRelief);
    const estimatedTax = calculateIncomeTax(chargeableIncome);
    incomeTaxEstimate = {
      chargeableIncome,
      estimatedTax,
      effectiveRate: annualGrossSalary > 0 ? estimatedTax / annualGrossSalary : 0,
    };
  }

  return {
    grossSalary,
    employeeCpf,
    takeHome,
    employerCpf,
    totalCpf,
    ratesUsed: { employer: employerRate, employee: employeeRate },
    allocation: { oa: oaAmount, saRa: saRaAmount, ma: maAmount },
    annual: {
      grossSalary: annualGrossSalary,
      employeeCpf: annualEmployeeCpf,
      employerCpf: annualEmployerCpf,
      takeHome: annualTakeHome,
    },
    incomeTaxEstimate,
  };
}

export interface HdbSaleInput {
  sellingPrice: number;
  outstandingLoan: number;
  cpfPrincipalUsed: number;
  cpfAccruedInterest: number;
  agentCommissionPct: number; // e.g. 2 for 2%
  otherCosts: number;
}

export interface HdbSaleResult {
  sellingPrice: number;
  outstandingLoan: number;
  cpfRefund: number;
  agentFee: number;
  otherCosts: number;
  cashProceeds: number;
  breakdown: { label: string; amount: number; pct: number }[];
}

export function calculateHdbSaleProceeds(input: HdbSaleInput): HdbSaleResult {
  const { sellingPrice, outstandingLoan, cpfPrincipalUsed, cpfAccruedInterest, agentCommissionPct, otherCosts } = input;
  const cpfRefund = cpfPrincipalUsed + cpfAccruedInterest;
  const agentFee = Math.round(sellingPrice * (agentCommissionPct / 100));
  const cashProceeds = sellingPrice - outstandingLoan - cpfRefund - agentFee - otherCosts;

  const total = sellingPrice || 1;
  const breakdown = [
    { label: "Cash", amount: cashProceeds, pct: (cashProceeds / total) * 100 },
    { label: "CPF Refund", amount: cpfRefund, pct: (cpfRefund / total) * 100 },
    { label: "Loan Repayment", amount: outstandingLoan, pct: (outstandingLoan / total) * 100 },
    { label: "Fees & Costs", amount: agentFee + otherCosts, pct: ((agentFee + otherCosts) / total) * 100 },
  ];

  return { sellingPrice, outstandingLoan, cpfRefund, agentFee, otherCosts, cashProceeds, breakdown };
}

// HDB resale levy — a fixed-quantum charge for SECOND-time subsidised flat
// buyers, i.e. only applies if you're buying ANOTHER new BTO/SBF/EC unit
// after this sale. It does NOT apply if you're buying a resale flat or
// private property instead — that covers most sellers, which is why this
// is opt-in rather than baked into the main cash-proceeds figure.
//
// It's also NOT deducted from THIS sale's proceeds — it's owed separately
// at the point of your NEXT subsidised purchase (payable from CPF OA or
// cash then). Shown here purely so you can budget for it ahead of time.
//
// Fixed since 3 March 2006, confirmed unchanged across multiple current
// 2026 sources. Singles under the SSC scheme pay half the household rate.
export type FlatTypeForLevy = "2-room" | "3-room" | "4-room" | "5-room" | "executive";

export const RESALE_LEVY_TABLE: Record<FlatTypeForLevy, number> = {
  "2-room": 15000,
  "3-room": 30000,
  "4-room": 40000,
  "5-room": 45000,
  executive: 50000,
};

export function calculateResaleLevy(flatType: FlatTypeForLevy, isSingleScheme: boolean): number {
  const base = RESALE_LEVY_TABLE[flatType];
  return isSingleScheme ? Math.round(base / 2) : base;
}

// Minimum Occupation Period check — 5 years from key collection for the
// vast majority of flat types/schemes (a few edge cases like short-lease
// 2-room Flexi for seniors differ, which this doesn't attempt to model).
export const MOP_YEARS = 5;

export function checkMop(keyCollectionDate: Date, asOf: Date = new Date()): { metMop: boolean; monthsRemaining: number; mopDate: Date } {
  const mopDate = new Date(keyCollectionDate);
  mopDate.setFullYear(mopDate.getFullYear() + MOP_YEARS);
  const metMop = asOf >= mopDate;
  const monthsRemaining = metMop
    ? 0
    : Math.max(
        0,
        (mopDate.getFullYear() - asOf.getFullYear()) * 12 +
          (mopDate.getMonth() - asOf.getMonth()) -
          (asOf.getDate() > mopDate.getDate() ? 1 : 0)
      );
  return { metMop, monthsRemaining, mopDate };
}

export interface AccruedInterestWithdrawal {
  principal: number;
  yearUsed: number;
}

export interface AccruedInterestWithdrawalDetail extends AccruedInterestWithdrawal {
  years: number;
  accruedInterest: number;
  refund: number;
}

export interface AccruedInterestResult {
  totalPrincipal: number;
  totalAccruedInterest: number;
  totalRefund: number;
  perWithdrawal: AccruedInterestWithdrawalDetail[];
}

// SIMPLE ESTIMATE ONLY: each withdrawal is compounded annually at a flat rate from its
// own year of use — a real improvement over treating multiple CPF draws (e.g. initial
// purchase, then a later top-up) as a single lump sum, since each actually accrues
// interest separately from its own date. Real CPF accrued interest is still computed
// with more precision (exact dates, rate changes over time) than this monthly/annual
// approximation — treat this as a rough estimate either way.
export function calculateAccruedInterest(
  withdrawals: AccruedInterestWithdrawal[],
  currentYear: number,
  interestRate: number = 0.025
): AccruedInterestResult {
  const perWithdrawal: AccruedInterestWithdrawalDetail[] = withdrawals.map((w) => {
    const years = Math.max(0, currentYear - w.yearUsed);
    const refund = w.principal * Math.pow(1 + interestRate, years);
    const accruedInterest = refund - w.principal;
    return { ...w, years, accruedInterest: Math.round(accruedInterest), refund: Math.round(refund) };
  });

  const totalPrincipal = withdrawals.reduce((sum, w) => sum + w.principal, 0);
  const totalAccruedInterest = perWithdrawal.reduce((sum, p) => sum + p.accruedInterest, 0);

  return {
    totalPrincipal,
    totalAccruedInterest,
    totalRefund: totalPrincipal + totalAccruedInterest,
    perWithdrawal,
  };
}

// CPF Ordinary Account floor interest rate. Special/MediSave/Retirement Accounts
// (SMRA) earn a higher floor rate. Actual accounts can earn more via extra interest
// on the first tranches of savings — ignored here for simplicity, same approach as
// the accrued-interest calculator.
export const CPF_OA_RATE = 0.025;
export const CPF_SMRA_RATE = 0.04;

// Basic / Full / Enhanced Retirement Sum figures for members turning 55 in 2026,
// and the indicative CPF LIFE Standard Plan monthly payout (from age 65) CPF Board
// publishes for each tier. Sourced from CPF Board planning guidance for the 2026
// cohort — these change most years, so treat as illustrative, not exact.
export const CPF_RETIREMENT_SUMS_2026 = {
  brs: 110200,
  frs: 220400,
  ers: 440800,
};

export const CPF_LIFE_STANDARD_PAYOUT_2026 = {
  brs: 950,
  frs: 1780,
  ers: 3440,
};

export type CpfLifeTargetTier = "brs" | "frs" | "ers";

export interface CpfLifeEstimate {
  retirementAccountBalance: number; // capped at the chosen target tier (BRS/FRS/ERS)
  estimatedMonthlyPayout: number;
  nearestTier: "Below BRS" | "BRS" | "Between BRS and FRS" | "FRS" | "Between FRS and ERS" | "ERS or above";
}

// Piecewise-linear interpolation between the published BRS/FRS/ERS payout anchor
// points. CPF Board doesn't publish a continuous formula, but payouts scale close
// to linearly with the Retirement Account balance within each band.
//
// `capAmount` defaults to ERS (the most anyone can set aside in their RA), but callers
// can pass a lower tier (e.g. BRS, for someone planning to pledge their property) to see
// the payout — and leftover cash — for actually setting aside only that much.
export function estimateCpfLifePayout(
  raBalance: number,
  capAmount: number = CPF_RETIREMENT_SUMS_2026.ers
): CpfLifeEstimate {
  const { brs, frs, ers } = CPF_RETIREMENT_SUMS_2026;
  const { brs: brsP, frs: frsP, ers: ersP } = CPF_LIFE_STANDARD_PAYOUT_2026;
  const capped = Math.max(0, Math.min(raBalance, capAmount));

  let payout: number;
  let nearestTier: CpfLifeEstimate["nearestTier"];
  if (capped <= brs) {
    payout = brs === 0 ? 0 : (capped / brs) * brsP;
    nearestTier = capped === brs ? "BRS" : "Below BRS";
  } else if (capped <= frs) {
    const t = (capped - brs) / (frs - brs);
    payout = brsP + t * (frsP - brsP);
    nearestTier = capped === frs ? "FRS" : "Between BRS and FRS";
  } else {
    const t = (capped - frs) / (ers - frs);
    payout = frsP + t * (ersP - frsP);
    nearestTier = capped === ers ? "ERS or above" : "Between FRS and ERS";
  }

  return {
    retirementAccountBalance: Math.round(capped),
    estimatedMonthlyPayout: Math.round(payout),
    nearestTier,
  };
}

export interface CpfLifeAllPlansEstimate {
  standard: CpfLifeEstimate;
  /** Approximation: Basic pays ~10-15% less than Standard (using the ~12.5%
   *  midpoint), with a larger bequest — CPF Board doesn't publish an exact
   *  formula, only the reduction range, so treat this as illustrative. */
  basic: CpfLifeEstimate;
  /** Approximation: Escalating starts ~20% lower than Standard at 65, then
   *  rises 2%/year for life. escalatingAtRetirement is the starting payout;
   *  escalatingCrossoverYear estimates when it overtakes Standard (commonly
   *  cited as around year 15, consistent with 20% lower growing at 2%/year
   *  against a flat baseline). */
  escalating: CpfLifeEstimate & { crossoverYear: number };
}

const BASIC_PLAN_FACTOR = 0.875; // ~12.5% lower than Standard (midpoint of the commonly-cited 10-15% range)
const ESCALATING_PLAN_START_FACTOR = 0.8; // ~20% lower than Standard at the start
const ESCALATING_ANNUAL_GROWTH = 0.02; // 2%/year for life

export function estimateCpfLifeAllPlans(
  raBalance: number,
  capAmount: number = CPF_RETIREMENT_SUMS_2026.ers
): CpfLifeAllPlansEstimate {
  const standard = estimateCpfLifePayout(raBalance, capAmount);
  const basic: CpfLifeEstimate = {
    ...standard,
    estimatedMonthlyPayout: Math.round(standard.estimatedMonthlyPayout * BASIC_PLAN_FACTOR),
  };
  const escalatingStart = Math.round(standard.estimatedMonthlyPayout * ESCALATING_PLAN_START_FACTOR);
  // Years until (start * 1.02^y) >= standardPayout, i.e. the crossover point.
  const crossoverYear =
    standard.estimatedMonthlyPayout > 0 && escalatingStart > 0
      ? Math.ceil(Math.log(standard.estimatedMonthlyPayout / escalatingStart) / Math.log(1 + ESCALATING_ANNUAL_GROWTH))
      : 0;
  const escalating = {
    ...standard,
    estimatedMonthlyPayout: escalatingStart,
    crossoverYear,
  };

  return { standard, basic, escalating };
}

// Retirement Sum Topping-Up Scheme (RSTU) — voluntary cash top-ups to SA
// (below 55) / RA (55+), earning the same 4% floor rate as other SA/RA
// savings. Tax relief is capped at $8,000/year for self top-ups (up to
// $16,000/year combined with top-ups to a loved one's account) — this
// function models the RETIREMENT BALANCE impact only, not the tax saving
// itself (that depends on the person's marginal tax rate, which this
// calculator doesn't collect).
export const RSTU_SELF_RELIEF_CAP = 8000;
export const RSTU_COMBINED_RELIEF_CAP = 16000;

export function projectRstuTopUpGrowth(annualTopUp: number, years: number): number {
  if (annualTopUp <= 0 || years <= 0) return 0;
  // Future value of an ordinary annuity, one contribution per year at CPF_SMRA_RATE.
  return Math.round((annualTopUp * (Math.pow(1 + CPF_SMRA_RATE, years) - 1)) / CPF_SMRA_RATE);
}

export interface RetirementInput {
  currentAge: number;
  retirementAge: number;
  currentSavings: number;
  currentOA: number;
  currentSaRa: number; // Special Account (pre-55) / Retirement Account (55+)
  currentMA: number; // MediSave — reserved for healthcare, not counted toward retirement income
  monthlyInvestment: number;
  expectedReturnPct: number; // annual, e.g. 4 for 4% — applies to cash/investments only
  desiredMonthlySpend: number;
  yearsInRetirement?: number; // default 25
  cpfLifeTargetTier?: CpfLifeTargetTier; // default "ers" — which tier to set aside in the RA
  investmentHoldingsValue?: number; // default 0 — today's value of investment/insurance holdings (e.g. from the
  // Net Worth Snapshot's line items), grown as a lump sum at the same expected return as cash/investments
  inflationRatePct?: number; // default 2.5 — annual, applied to desiredMonthlySpend between now and retirement,
  // and again across every year of retirement, so targetRequired stays in the same nominal-dollars-at-retirement
  // terms as projectedSavings. 2.5% sits within MAS's implicit ~2-3% long-run core inflation range and matches
  // the default other SG retirement calculators use.
  /** Optional voluntary RSTU top-up to SA/RA, per year, from now until retirement.
   *  Defaults to 0 — fully backward compatible, doesn't change any existing
   *  behaviour when omitted. */
  annualRstuTopUp?: number;
}

export interface RetirementResult {
  yearsToRetirement: number;
  projectedCash: number;
  projectedOA: number;
  projectedSaRa: number;
  projectedMA: number;
  projectedInvestmentHoldings: number; // grown value of investment/insurance holdings, if included
  projectedSavings: number; // cash + OA + SA/RA + investment holdings — the pot counted toward retirement income
  desiredMonthlySpendAtRetirement: number; // desiredMonthlySpend inflated to the year you actually retire
  targetRequired: number;
  shortfall: number; // positive = shortfall, negative = surplus
  onTrack: boolean;
  suggestedMonthlySavings: number;
  cpfLife: CpfLifeEstimate;
  cpfLifeExcessCash: number; // projected OA+SA/RA beyond the chosen tier — withdrawable as cash at 55
  /** How much of projectedSaRa came from voluntary RSTU top-ups (0 if none entered). */
  rstuTopUpGrowth: number;
}

export function calculateRetirement(input: RetirementInput): RetirementResult {
  const {
    currentAge,
    retirementAge,
    currentSavings,
    currentOA,
    currentSaRa,
    currentMA,
    monthlyInvestment,
    expectedReturnPct,
    desiredMonthlySpend,
    yearsInRetirement = 25,
    cpfLifeTargetTier = "ers",
    investmentHoldingsValue = 0,
    inflationRatePct = 2.5,
    annualRstuTopUp = 0,
  } = input;

  const yearsToRetirement = Math.max(0, retirementAge - currentAge);
  const n = yearsToRetirement * 12;

  const rInvest = expectedReturnPct / 100 / 12;
  const rOA = CPF_OA_RATE / 12;
  const rSmra = CPF_SMRA_RATE / 12;

  // Future value of cash/investments: current lump sum + monthly contributions (ordinary annuity),
  // growing at the user's own expected return.
  const fvLumpSumCash = currentSavings * Math.pow(1 + rInvest, n);
  const fvContributions =
    rInvest === 0 ? monthlyInvestment * n : monthlyInvestment * ((Math.pow(1 + rInvest, n) - 1) / rInvest);
  const projectedCash = Math.round(fvLumpSumCash + fvContributions);

  // CPF balances grow at their own fixed floor rates, not the user's investment assumption.
  // This does not model further mandatory CPF contributions between now and retirement.
  const projectedOA = Math.round(currentOA * Math.pow(1 + rOA, n));
  const projectedSaRaBeforeTopUp = Math.round(currentSaRa * Math.pow(1 + rSmra, n));
  // Voluntary RSTU top-ups, if any — future value of a yearly annuity at the SA/RA rate,
  // added on top of the existing balance's own growth (kept separate so the UI can show
  // "how much of your projected balance came from topping up" transparently).
  const rstuTopUpGrowth = projectRstuTopUpGrowth(annualRstuTopUp, yearsToRetirement);
  const projectedSaRa = projectedSaRaBeforeTopUp + rstuTopUpGrowth;
  const projectedMA = Math.round(currentMA * Math.pow(1 + rSmra, n));

  // Investment/insurance holdings are a one-time lump sum today (no ongoing monthly top-up modelled
  // here — that's what "Monthly investment" above is for), grown at the same expected return as cash.
  const fvInvestmentHoldings = investmentHoldingsValue * Math.pow(1 + rInvest, n);
  const projectedInvestmentHoldings = Math.round(fvInvestmentHoldings);

  const projectedSavings = projectedCash + projectedOA + projectedSaRa + projectedInvestmentHoldings;

  // Inflate today's desired spending to the year you actually retire, then keep inflating it across
  // every year you're drawing down in retirement — a future-value-of-a-growing-annuity calculation —
  // so targetRequired stays comparable to projectedSavings (both are nominal dollars at retirement).
  const inflationRate = inflationRatePct / 100;
  const desiredMonthlySpendAtRetirement = desiredMonthlySpend * Math.pow(1 + inflationRate, yearsToRetirement);
  const annualSpendAtRetirement = desiredMonthlySpendAtRetirement * 12;
  const targetRequired = Math.round(
    inflationRate === 0
      ? annualSpendAtRetirement * yearsInRetirement
      : (annualSpendAtRetirement * (Math.pow(1 + inflationRate, yearsInRetirement) - 1)) / inflationRate
  );
  const shortfall = targetRequired - projectedSavings;
  const onTrack = shortfall <= 0;

  // Solve for the monthly contribution needed to close the gap (holding CPF, the cash lump sum, and
  // investment holdings fixed — none of those are something a user can top up from this calculator).
  let suggestedMonthlySavings = monthlyInvestment;
  if (!onTrack && n > 0) {
    const neededContribFv = targetRequired - fvLumpSumCash - fvInvestmentHoldings - projectedOA - projectedSaRa;
    suggestedMonthlySavings = Math.round(
      rInvest === 0 ? neededContribFv / n : neededContribFv / ((Math.pow(1 + rInvest, n) - 1) / rInvest)
    );
    if (suggestedMonthlySavings < monthlyInvestment) suggestedMonthlySavings = monthlyInvestment;
  }

  // CPF LIFE payout estimate uses projected OA + SA/RA, capped at whichever tier the user
  // is actually planning to set aside (defaults to ERS, the most anyone can set aside).
  // Anything projected beyond that tier is cash you could withdraw at 55 instead — e.g. by
  // pledging your property so you only need to set aside BRS.
  const projectedCpfForLife = projectedOA + projectedSaRa;
  const cpfLifeCapAmount = CPF_RETIREMENT_SUMS_2026[cpfLifeTargetTier];
  const cpfLife = estimateCpfLifePayout(projectedCpfForLife, cpfLifeCapAmount);
  const cpfLifeExcessCash = Math.max(0, projectedCpfForLife - cpfLife.retirementAccountBalance);

  return {
    yearsToRetirement,
    projectedCash,
    projectedOA,
    projectedSaRa,
    projectedMA,
    projectedInvestmentHoldings,
    projectedSavings,
    desiredMonthlySpendAtRetirement: Math.round(desiredMonthlySpendAtRetirement),
    targetRequired,
    shortfall,
    onTrack,
    suggestedMonthlySavings,
    cpfLife,
    cpfLifeExcessCash,
    rstuTopUpGrowth,
  };
}

export type FuelType = "petrol" | "diesel" | "electric" | "hybrid";

export interface CarCostInput {
  carPrice: number;
  downpayment: number;
  loanAmount: number;
  loanYears: number;
  interestRatePct: number; // annual, flat rate as typically quoted in SG
  monthlyPetrol: number;
  monthlyParking: number;
  monthlyErp: number;
  annualInsurance: number;
  annualRoadTax: number;
  annualMaintenance: number;
  monthlyGrabSpend?: number;
  /** Years the person plans to keep the car — used for the simplified
   *  depreciation estimate. Defaults to 10 (a full COE term) if not given. */
  ownershipYears?: number;
  /** If planning to renew COE instead of deregistering at the 10-year mark,
   *  the estimated Prevailing Quota Premium (PQP) they'd pay to renew. */
  coeRenewalPqp?: number;
  /** 5 or 10 year renewal term — 10yr = 100% of PQP, 5yr = 50% of PQP. */
  coeRenewalYears?: 5 | 10;
}

export interface CarCostResult {
  monthlyLoan: number;
  monthlyInsurance: number;
  monthlyRoadTax: number;
  monthlyMaintenance: number;
  totalMonthly: number;
  totalAnnual: number;
  /** One-time purchase-price GST — NOT part of totalMonthly/totalAnnual,
   *  since it's a one-off cost, not a recurring one. */
  gst: number;
  totalPriceInclGst: number;
  /** Simplified straight-line depreciation: total purchase price (incl. GST)
   *  spread evenly over the intended ownership period, assuming ~$0 residual
   *  value. This deliberately ignores PARF/COE deregistration rebates, which
   *  depend on the car's registration date and current LTA rules that
   *  changed materially in Budget 2026 (see the guidance text shown with
   *  this figure) — a real car's effective depreciation is usually LOWER
   *  than this once those rebates are factored in. Treat as a conservative
   *  ceiling, not a precise forecast. */
  annualDepreciation: number;
  monthlyDepreciation: number;
  /** Only set if coeRenewalPqp is provided. */
  coeRenewal?: {
    cost: number; // the actual amount paid to renew (100% or 50% of PQP)
    monthlyEquivalent: number; // amortized over the renewal term, for comparison
  };
  /** Fixed at the current Adult Monthly Travel Pass price ($122/month,
   *  effective the 27 Dec 2025 PTC fare revision) — update if PTC revises
   *  fares again (typically reviewed annually). */
  publicTransportComparison: { carCost: number; ptCost: number; monthlySavings: number; annualSavings: number };
  grabComparison?: { carCost: number; grabCost: number; monthlySavings: number; annualSavings: number };
  /** The monthly Grab spend at which owning and Grab cost exactly the same
   *  — spend more than this on Grab and owning would have been cheaper. */
  breakEvenGrabSpend: number;
}

// Singapore's standard GST rate, effective 1 Jan 2024, confirmed unchanged
// through 2026 (Budget 2026 confirmed no further rate change). Update here
// if IRAS ever revises it.
const GST_RATE = 0.09;

// PTC Adult Monthly Travel Pass — unlimited MRT/LRT/basic bus. Effective
// since the 27 Dec 2025 PTC fare revision. PTC typically reviews fares
// annually; update this if a new revision is announced.
const ADULT_MONTHLY_TRAVEL_PASS = 122;

export function calculateCarCost(input: CarCostInput): CarCostResult {
  const {
    carPrice,
    loanAmount,
    loanYears,
    interestRatePct,
    monthlyPetrol,
    monthlyParking,
    monthlyErp,
    annualInsurance,
    annualRoadTax,
    annualMaintenance,
    monthlyGrabSpend,
    ownershipYears = 10,
    coeRenewalPqp,
    coeRenewalYears = 10,
  } = input;

  // SG car loans typically quoted as flat-rate interest.
  const totalInterest = loanAmount * (interestRatePct / 100) * loanYears;
  const monthlyLoan = loanYears > 0 ? Math.round((loanAmount + totalInterest) / (loanYears * 12)) : 0;

  const monthlyInsurance = Math.round(annualInsurance / 12);
  const monthlyRoadTax = Math.round(annualRoadTax / 12);
  const monthlyMaintenance = Math.round(annualMaintenance / 12);

  const gst = Math.round(carPrice * GST_RATE);
  const totalPriceInclGst = carPrice + gst;

  const annualDepreciation = ownershipYears > 0 ? Math.round(totalPriceInclGst / ownershipYears) : 0;
  const monthlyDepreciation = Math.round(annualDepreciation / 12);

  let coeRenewal;
  if (coeRenewalPqp !== undefined && coeRenewalPqp > 0) {
    const cost = coeRenewalYears === 5 ? Math.round(coeRenewalPqp * 0.5) : coeRenewalPqp;
    const monthlyEquivalent = Math.round(cost / (coeRenewalYears * 12));
    coeRenewal = { cost, monthlyEquivalent };
  }

  const totalMonthly =
    monthlyLoan + monthlyPetrol + monthlyParking + monthlyErp + monthlyInsurance + monthlyRoadTax + monthlyMaintenance;
  const totalAnnual = totalMonthly * 12;

  const breakEvenGrabSpend = totalMonthly;

  const ptSavings = totalMonthly - ADULT_MONTHLY_TRAVEL_PASS;
  const publicTransportComparison = {
    carCost: totalMonthly,
    ptCost: ADULT_MONTHLY_TRAVEL_PASS,
    monthlySavings: ptSavings,
    annualSavings: ptSavings * 12,
  };

  let grabComparison;
  if (monthlyGrabSpend !== undefined) {
    const monthlySavings = totalMonthly - monthlyGrabSpend;
    grabComparison = {
      carCost: totalMonthly,
      grabCost: monthlyGrabSpend,
      monthlySavings,
      annualSavings: monthlySavings * 12,
    };
  }

  return {
    monthlyLoan,
    monthlyInsurance,
    monthlyRoadTax,
    monthlyMaintenance,
    totalMonthly,
    totalAnnual,
    gst,
    totalPriceInclGst,
    annualDepreciation,
    monthlyDepreciation,
    coeRenewal,
    publicTransportComparison,
    grabComparison,
    breakEvenGrabSpend,
  };
}

export function formatSgd(n: number): string {
  const rounded = Math.round(n);
  const sign = rounded < 0 ? "-" : "";
  return `${sign}$${Math.abs(rounded).toLocaleString("en-SG")}`;
}
