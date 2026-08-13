// SG Money — Shared CPF calculation engine
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

export interface SalaryCpfInput {
  age: number;
  monthlyGross: number;
  monthlyBonus?: number; // additional wages, simplified as flat monthly addition
  status: CitizenshipStatus;
}

export interface SalaryCpfResult {
  grossSalary: number;
  employeeCpf: number;
  takeHome: number;
  employerCpf: number;
  totalCpf: number;
  ratesUsed: { employer: number; employee: number };
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
  const { age, monthlyGross, monthlyBonus = 0, status } = input;
  const base = getCpfRatesForAge(age);
  const mult = PR_MULTIPLIER[status];

  const employerRate = base.employer * mult.employer;
  const employeeRate = base.employee * mult.employee;

  // CPF only applies up to the OW ceiling for ordinary wages.
  const cpfableWage = Math.min(monthlyGross, OW_CEILING_MONTHLY) + monthlyBonus;

  const employeeCpf = Math.round(cpfableWage * employeeRate);
  const employerCpf = Math.round(cpfableWage * employerRate);
  const takeHome = monthlyGross + monthlyBonus - employeeCpf;

  return {
    grossSalary: monthlyGross + monthlyBonus,
    employeeCpf,
    takeHome,
    employerCpf,
    totalCpf: employeeCpf + employerCpf,
    ratesUsed: { employer: employerRate, employee: employeeRate },
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

export interface AccruedInterestInput {
  principal: number;
  yearFirstUsed: number;
  currentYear: number;
  interestRate?: number; // default 2.5% p.a., matching CPF OA rate
}

export interface AccruedInterestResult {
  principal: number;
  years: number;
  accruedInterest: number;
  totalRefund: number;
}

// SIMPLE ESTIMATE ONLY: assumes one lump-sum withdrawal, compounded annually at a flat
// rate. Real CPF accrued interest is computed per-withdrawal, compounded based on the
// actual dates funds were used, and the rate can vary. Treat this as a rough estimate.
export function calculateAccruedInterest(input: AccruedInterestInput): AccruedInterestResult {
  const { principal, yearFirstUsed, currentYear, interestRate = 0.025 } = input;
  const years = Math.max(0, currentYear - yearFirstUsed);
  const totalWithInterest = principal * Math.pow(1 + interestRate, years);
  const accruedInterest = totalWithInterest - principal;

  return {
    principal,
    years,
    accruedInterest: Math.round(accruedInterest),
    totalRefund: Math.round(totalWithInterest),
  };
}

export interface RetirementInput {
  currentAge: number;
  retirementAge: number;
  currentSavings: number;
  currentCpfRetirement: number;
  monthlyInvestment: number;
  expectedReturnPct: number; // annual, e.g. 4 for 4%
  desiredMonthlySpend: number;
  yearsInRetirement?: number; // default 25
}

export interface RetirementResult {
  yearsToRetirement: number;
  projectedSavings: number;
  targetRequired: number;
  shortfall: number; // positive = shortfall, negative = surplus
  onTrack: boolean;
  suggestedMonthlySavings: number;
}

export function calculateRetirement(input: RetirementInput): RetirementResult {
  const {
    currentAge,
    retirementAge,
    currentSavings,
    currentCpfRetirement,
    monthlyInvestment,
    expectedReturnPct,
    desiredMonthlySpend,
    yearsInRetirement = 25,
  } = input;

  const yearsToRetirement = Math.max(0, retirementAge - currentAge);
  const r = expectedReturnPct / 100 / 12;
  const n = yearsToRetirement * 12;
  const startingPot = currentSavings + currentCpfRetirement;

  // Future value of current savings + monthly contributions (ordinary annuity).
  const fvLumpSum = startingPot * Math.pow(1 + r, n);
  const fvContributions = r === 0 ? monthlyInvestment * n : monthlyInvestment * ((Math.pow(1 + r, n) - 1) / r);
  const projectedSavings = Math.round(fvLumpSum + fvContributions);

  const targetRequired = Math.round(desiredMonthlySpend * 12 * yearsInRetirement);
  const shortfall = targetRequired - projectedSavings;
  const onTrack = shortfall <= 0;

  // Solve for the monthly contribution needed to close the gap (holding lump sum fixed).
  let suggestedMonthlySavings = monthlyInvestment;
  if (!onTrack && n > 0) {
    const neededContribFv = targetRequired - fvLumpSum;
    suggestedMonthlySavings = Math.round(
      r === 0 ? neededContribFv / n : neededContribFv / ((Math.pow(1 + r, n) - 1) / r)
    );
    if (suggestedMonthlySavings < monthlyInvestment) suggestedMonthlySavings = monthlyInvestment;
  }

  return { yearsToRetirement, projectedSavings, targetRequired, shortfall, onTrack, suggestedMonthlySavings };
}

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
}

export interface CarCostResult {
  monthlyLoan: number;
  monthlyInsurance: number;
  monthlyRoadTax: number;
  monthlyMaintenance: number;
  totalMonthly: number;
  totalAnnual: number;
  grabComparison?: { carCost: number; grabCost: number; monthlySavings: number; annualSavings: number };
}

export function calculateCarCost(input: CarCostInput): CarCostResult {
  const {
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
  } = input;

  // SG car loans typically quoted as flat-rate interest.
  const totalInterest = loanAmount * (interestRatePct / 100) * loanYears;
  const monthlyLoan = loanYears > 0 ? Math.round((loanAmount + totalInterest) / (loanYears * 12)) : 0;

  const monthlyInsurance = Math.round(annualInsurance / 12);
  const monthlyRoadTax = Math.round(annualRoadTax / 12);
  const monthlyMaintenance = Math.round(annualMaintenance / 12);

  const totalMonthly =
    monthlyLoan + monthlyPetrol + monthlyParking + monthlyErp + monthlyInsurance + monthlyRoadTax + monthlyMaintenance;
  const totalAnnual = totalMonthly * 12;

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

  return { monthlyLoan, monthlyInsurance, monthlyRoadTax, monthlyMaintenance, totalMonthly, totalAnnual, grabComparison };
}

export function formatSgd(n: number): string {
  const rounded = Math.round(n);
  const sign = rounded < 0 ? "-" : "";
  return `${sign}$${Math.abs(rounded).toLocaleString("en-SG")}`;
}
