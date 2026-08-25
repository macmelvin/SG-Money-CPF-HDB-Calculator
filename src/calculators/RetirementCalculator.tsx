import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BtoPromo, CalcShell, Disclaimer, DocToolsPromo, NumberField, ResultCard, ResultRow, SelectField } from "../components/CalcShell";
import { AssetAllocationBar, EditableLineItems, HealthBadge } from "../components/Dashboard";
import { RetirementDashboardExportCard } from "../components/RetirementDashboardExport";
import type { DashboardExportData } from "../components/RetirementDashboardExport";
import { PremiumReportPreview } from "../components/PremiumReportPreview";
import { captureNodeAsCanvas, downloadCanvasAsPng } from "../lib/dashboardImage";
import {
  CPF_LIFE_DEFERRAL_BONUS_PER_YEAR,
  CPF_LIFE_FEMALE_PAYOUT_FACTOR,
  CPF_LIFE_STANDARD_PAYOUT_2026,
  RSTU_SELF_RELIEF_CAP,
  RSTU_COMBINED_RELIEF_CAP,
  calculateCarCost,
  calculateHdbSaleProceeds,
  calculateRetirement,
  calculateSalaryCpf,
  estimateCpfLifeAllPlans,
  estimateCpfLifePlanPayoutAtAge,
  formatSgd,
  planCpfLifeTopUp,
} from "../lib/cpf";
import type {
  CarCostInput,
  CpfLifePlanChoice,
  CpfLifeSex,
  CpfLifeTargetTier,
  HdbSaleInput,
  SalaryCpfInput,
} from "../lib/cpf";
import {
  computeHealthCheck,
  computeNetWorth,
  computeRightsizing,
  sumLineItems,
} from "../lib/dashboard";
import type { LineItem } from "../lib/dashboard";
import { usePageMeta } from "../lib/usePageMeta";
import { clearCalculatorData, loadCalculatorData, saveCalculatorData } from "../lib/storage";
import { generatePremiumRetirementReport } from "../lib/premiumReport";
import { consumeUnlockRedirect, isPremiumReportUnlocked } from "../lib/premiumUnlock";
import { PREMIUM_REPORT_PAYMENT_LINK, PREMIUM_REPORT_PRICE_LABEL } from "../lib/calculators";

const DEFAULTS = {
  currentAge: 45,
  retirementAge: 65,
  currentSavings: 200000,
  currentOA: 55000,
  currentSaRa: 50000,
  currentMA: 15000,
  monthlyInvestment: 1000,
  expectedReturnPct: 4,
  desiredMonthlySpend: 3000,
  inflationRatePct: 2.5,
  hdbCurrentValue: 650000,
  incomeItems: [{ id: "income-1", label: "Salary", amount: 5000 }] as LineItem[],
  expenseItems: [{ id: "expense-1", label: "Living expenses", amount: 2400 }] as LineItem[],
  investmentItems: [{ id: "invest-1", label: "Unit trusts / stocks", amount: 50000 }] as LineItem[],
  liabilityItems: [{ id: "liability-1", label: "Home loan / mortgage", amount: 0 }] as LineItem[],
  planRightsizing: false,
  replacementFlatPrice: 300000,
  legalMovingCosts: 15000,
  cpfLifeTargetTier: "ers" as CpfLifeTargetTier,
  includeInvestmentHoldings: true,
  yearsInRetirement: 25,
  annualRstuTopUp: 0,
  sex: "male" as CpfLifeSex,
  birthYear: 0, // 0 = not set — falls back to deriving your cohort from Current age instead
  cpfLifePlanChoice: "standard" as CpfLifePlanChoice,
  desiredMonthlyPayoutGoal: 2000,
  payoutStartAge: 65,
};

const CPF_LIFE_TIER_LABEL: Record<CpfLifeTargetTier, string> = {
  brs: "Basic Retirement Sum (BRS)",
  frs: "Full Retirement Sum (FRS)",
  ers: "Enhanced Retirement Sum (ERS)",
};

const CPF_LIFE_PLAN_LABEL: Record<CpfLifePlanChoice, string> = {
  escalating: "Escalating Plan",
  standard: "Standard Plan",
  basic: "Basic Plan",
};

const CPF_LIFE_PLAN_DESC: Record<CpfLifePlanChoice, string> = {
  escalating:
    "Payouts start lower but grow ~2%/year for life — helps protect your lifestyle against rising prices over a long retirement.",
  standard: "Steady, unchanging monthly payouts for life — a fixed amount that's easy to budget around.",
  basic: "Lower payouts than Standard, but keeps the largest bequest for your beneficiaries from any RA savings you haven't drawn down.",
};

const STORAGE_KEY = "retirement-calculator";
// Lightweight shared snapshot for Geo Arbitrage. Unlike the main saved scenario,
// this updates as fields change so moving between calculators does not require an
// extra Save tap. It remains local to this browser like all other calculator data.
const GEO_SYNC_STORAGE_KEY = "retirement-calculator-geo-sync";
// Persists the "user wants to model downsizing" intent from HDB Sale's
// Downsize next-step option, so it survives the round trip: land here with
// no saved HDB data -> go save it on HDB Sale -> come back (no query param
// this time) -> still get the rightsizing box pre-checked automatically.
const DOWNSIZE_INTENT_KEY = "downsize-intent";
// Must match the storage keys the other calculators save under — read here so the
// Premium Report can pull in whatever the person already entered elsewhere, instead
// of asking them to re-type it.
const HDB_SALE_STORAGE_KEY = "hdb-sale-proceeds";
const SALARY_STORAGE_KEY = "salary-calculator";
const ACCRUED_INTEREST_STORAGE_KEY = "cpf-accrued-interest";
const CAR_COST_STORAGE_KEY = "car-cost-calculator";

export default function RetirementCalculator() {
  usePageMeta(
    "Singapore Retirement Calculator",
    "Free retirement calculator for Singapore. Net worth, monthly cash flow, CPF (OA/MA/SA-RA), rightsizing and CPF LIFE — see if you're on track for retirement and where you stand today."
  );
  const saved = loadCalculatorData<typeof DEFAULTS>(STORAGE_KEY);
  const initial = { ...DEFAULTS, ...(saved?.data ?? {}) };

  const [currentAge, setCurrentAge] = useState(initial.currentAge);
  const [retirementAge, setRetirementAge] = useState(initial.retirementAge);
  const [currentSavings, setCurrentSavings] = useState(initial.currentSavings);
  const [currentOA, setCurrentOA] = useState(initial.currentOA);
  const [currentSaRa, setCurrentSaRa] = useState(initial.currentSaRa);
  const [currentMA, setCurrentMA] = useState(initial.currentMA);
  const [monthlyInvestment, setMonthlyInvestment] = useState(initial.monthlyInvestment);
  const [expectedReturnPct, setExpectedReturnPct] = useState(initial.expectedReturnPct);
  const [desiredMonthlySpend, setDesiredMonthlySpend] = useState(initial.desiredMonthlySpend);
  const [inflationRatePct, setInflationRatePct] = useState(initial.inflationRatePct);
  const [savedAt, setSavedAt] = useState<number | null>(saved?.savedAt ?? null);
  const [includeHdbSale, setIncludeHdbSale] = useState(true);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isGeneratingDashboardImage, setIsGeneratingDashboardImage] = useState(false);
  const dashboardExportRef = useRef<HTMLDivElement>(null);
  const [premiumUnlocked, setPremiumUnlocked] = useState(() => isPremiumReportUnlocked());

  // If we just got redirected back here from a successful Stripe payment
  // (?unlocked=true), persist the unlock and clean the URL up.
  useEffect(() => {
    if (consumeUnlockRedirect()) {
      setPremiumUnlocked(true);
    }
  }, []);

  // Coming from HDB Sale Calculator's "Downsize" next-step option
  // (?rightsizing=1) — pre-check the rightsizing box so the person doesn't
  // have to find and toggle it themselves. Also queue the intent in
  // localStorage: if they haven't saved their HDB Sale numbers yet, the
  // checkbox below won't even be visible (it's gated on hdbScenario), so
  // this makes sure the intent survives them going to save it and coming
  // back later.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cameFromDownsize = params.get("rightsizing") === "1";
    const queuedIntent = Boolean(loadCalculatorData<{ queued: boolean }>(DOWNSIZE_INTENT_KEY)?.data?.queued);
    if (cameFromDownsize) {
      setPlanRightsizing(true);
      saveCalculatorData(DOWNSIZE_INTENT_KEY, { queued: true });
    } else if (queuedIntent) {
      setPlanRightsizing(true);
    }
  }, []);

  const [hdbCurrentValue, setHdbCurrentValue] = useState(initial.hdbCurrentValue);
  const [incomeItems, setIncomeItems] = useState<LineItem[]>(initial.incomeItems);
  const [expenseItems, setExpenseItems] = useState<LineItem[]>(initial.expenseItems);
  const [investmentItems, setInvestmentItems] = useState<LineItem[]>(initial.investmentItems);
  const [liabilityItems, setLiabilityItems] = useState<LineItem[]>(initial.liabilityItems);
  const [planRightsizing, setPlanRightsizing] = useState(initial.planRightsizing);
  const [replacementFlatPrice, setReplacementFlatPrice] = useState(initial.replacementFlatPrice);
  const [legalMovingCosts, setLegalMovingCosts] = useState(initial.legalMovingCosts);
  const [cpfLifeTargetTier, setCpfLifeTargetTier] = useState<CpfLifeTargetTier>(initial.cpfLifeTargetTier);
  const [includeInvestmentHoldings, setIncludeInvestmentHoldings] = useState(initial.includeInvestmentHoldings);
  const [yearsInRetirement, setYearsInRetirement] = useState(initial.yearsInRetirement ?? DEFAULTS.yearsInRetirement);
  const [annualRstuTopUp, setAnnualRstuTopUp] = useState(initial.annualRstuTopUp ?? DEFAULTS.annualRstuTopUp);
  const [sex, setSex] = useState<CpfLifeSex>(initial.sex ?? DEFAULTS.sex);
  const [birthYear, setBirthYear] = useState(initial.birthYear ?? DEFAULTS.birthYear);
  const [cpfLifePlanChoice, setCpfLifePlanChoice] = useState<CpfLifePlanChoice>(
    initial.cpfLifePlanChoice ?? DEFAULTS.cpfLifePlanChoice
  );
  const [desiredMonthlyPayoutGoal, setDesiredMonthlyPayoutGoal] = useState(
    initial.desiredMonthlyPayoutGoal ?? DEFAULTS.desiredMonthlyPayoutGoal
  );
  const [payoutStartAge, setPayoutStartAge] = useState(initial.payoutStartAge ?? DEFAULTS.payoutStartAge);

  // Pull whatever the user last saved in the HDB Sale Proceeds calculator (if anything) so this
  // page can offer a "what if I sold today" scenario without asking them to re-enter numbers.
  const savedHdb = loadCalculatorData<HdbSaleInput>(HDB_SALE_STORAGE_KEY);
  const hdbScenario = savedHdb?.data ? calculateHdbSaleProceeds(savedHdb.data) : null;
  const applyHdbScenario = includeHdbSale && hdbScenario !== null;

  // Once the downsize intent has actually been fulfilled (HDB data exists
  // and the box is checked), clear the queued flag so it doesn't keep
  // re-checking the box on unrelated future visits.
  useEffect(() => {
    if (hdbScenario && planRightsizing) {
      clearCalculatorData(DOWNSIZE_INTENT_KEY);
    }
  }, [hdbScenario, planRightsizing]);
  const effectiveOA = currentOA + (applyHdbScenario ? hdbScenario.cpfRefund : 0);
  const effectiveSavings = currentSavings + (applyHdbScenario ? hdbScenario.cashProceeds : 0);

  // Same idea for the other three calculators — only used to enrich the Premium Report
  // with a fuller financial picture, so someone who's used the whole app doesn't have to
  // re-enter everything just to see it summarized in one place.
  const savedSalary = loadCalculatorData<SalaryCpfInput>(SALARY_STORAGE_KEY);
  const salaryResult = savedSalary?.data ? calculateSalaryCpf(savedSalary.data) : null;
  // Reads the precomputed totals directly (saved by AccruedInterestCalculator.tsx alongside
  // its raw inputs) rather than recomputing from withdrawals — this correctly respects manual
  // entry mode too (when the person types in their exact figures from the CPF app instead of
  // estimating from withdrawal dates), and avoids re-implementing that calculator's logic here.
  const savedAccruedInterest = loadCalculatorData<{
    totalPrincipal?: number;
    totalAccruedInterest?: number;
    totalRefund?: number;
  }>(ACCRUED_INTEREST_STORAGE_KEY);
  const accruedInterestResult =
    savedAccruedInterest?.data?.totalRefund !== undefined
      ? {
          totalPrincipal: savedAccruedInterest.data.totalPrincipal ?? 0,
          totalAccruedInterest: savedAccruedInterest.data.totalAccruedInterest ?? 0,
          totalRefund: savedAccruedInterest.data.totalRefund,
        }
      : null;
  const savedCarCost = loadCalculatorData<CarCostInput>(CAR_COST_STORAGE_KEY);
  const carCostResult = savedCarCost?.data ? calculateCarCost(savedCarCost.data) : null;

  // Total value of the Net Worth Snapshot's investment/insurance holdings — computed here (ahead of the
  // projection below) so it can optionally be grown and counted toward "how much you'll have at retirement."
  // ignoreEndDate: a policy's end date marks when it matures and pays out, not when the
  // money disappears — so unlike expenses/liabilities, a matured holding keeps counting.
  const totalInvestmentsPortfolio = sumLineItems(investmentItems, undefined, { ignoreEndDate: true });
  const effectiveInvestmentHoldings = includeInvestmentHoldings ? totalInvestmentsPortfolio : 0;

  const result = useMemo(
    () =>
      calculateRetirement({
        currentAge,
        retirementAge,
        currentSavings: effectiveSavings,
        currentOA: effectiveOA,
        currentSaRa,
        currentMA,
        monthlyInvestment,
        expectedReturnPct,
        desiredMonthlySpend,
        cpfLifeTargetTier,
        investmentHoldingsValue: effectiveInvestmentHoldings,
        inflationRatePct,
        yearsInRetirement,
        annualRstuTopUp,
        sex,
        birthYear: birthYear > 0 ? birthYear : undefined,
      }),
    [
      currentAge,
      retirementAge,
      effectiveSavings,
      effectiveOA,
      currentSaRa,
      currentMA,
      monthlyInvestment,
      expectedReturnPct,
      desiredMonthlySpend,
      cpfLifeTargetTier,
      effectiveInvestmentHoldings,
      inflationRatePct,
      yearsInRetirement,
      annualRstuTopUp,
      sex,
      birthYear,
    ]
  );

  useEffect(() => {
    saveCalculatorData(GEO_SYNC_STORAGE_KEY, {
      currentAge,
      retirementAge,
      currentSavings,
      currentOA,
      currentSaRa,
      monthlyInvestment,
      expectedReturnPct,
      inflationRatePct,
      investmentItems,
      incomeItems,
      expenseItems,
      liabilityItems,
      cpfLifeMonthlyIncome: result.cpfLife.estimatedMonthlyPayout,
      includeHdbSale,
    });
  }, [currentAge, retirementAge, currentSavings, currentOA, currentSaRa, monthlyInvestment, expectedReturnPct, inflationRatePct, investmentItems, incomeItems, expenseItems, liabilityItems, result.cpfLife.estimatedMonthlyPayout, includeHdbSale]);

  const cpfLifePlans = useMemo(
    () =>
      estimateCpfLifeAllPlans(
        result.cpfLife.retirementAccountBalance,
        result.cpfRetirementSums[cpfLifeTargetTier],
        result.cpfRetirementSums,
        sex
      ),
    [result.cpfLife.retirementAccountBalance, result.cpfRetirementSums, cpfLifeTargetTier, sex]
  );

  // What CPF LIFE would pay TODAY on your current OA + SA/RA balance, with no further growth
  // assumed — this is the same basis CPF Board's own Monthly Payout Estimator uses (it takes
  // whatever RA balance you type in and computes a payout right now, not a projection years
  // out). The figures elsewhere on this page (CPF LIFE Estimate, Compare CPF LIFE Plans "at
  // retirement" rows) instead project your balance forward to your target retirement age, so
  // they're deliberately a DIFFERENT, larger number for anyone who hasn't retired yet — this
  // gives an apples-to-apples figure for comparing against CPF Board's own tools.
  const currentRaBalanceToday = Math.min(effectiveOA + currentSaRa, result.cpfRetirementSums.ers);
  const cpfLifePlansToday = useMemo(
    () => estimateCpfLifeAllPlans(currentRaBalanceToday, result.cpfRetirementSums.ers, result.cpfRetirementSums, sex),
    [currentRaBalanceToday, result.cpfRetirementSums, sex]
  );

  // Total projected OA + SA/RA (regardless of which BRS/FRS/ERS tier is selected above) is what's
  // actually available toward a CPF LIFE plan — capped at ERS, the real ceiling on what can sit in
  // a Retirement Account. Feeds the reverse "how much do I need to top up" planner below.
  const currentProjectedRaBalanceForPlanner = Math.min(
    result.projectedOA + result.projectedSaRa,
    result.cpfRetirementSums.ers
  );
  const cpfLifeTopUpPlan = useMemo(
    () =>
      planCpfLifeTopUp({
        desiredMonthlyPayout: desiredMonthlyPayoutGoal,
        payoutStartAge,
        plan: cpfLifePlanChoice,
        sex,
        sums: result.cpfRetirementSums,
        currentProjectedRaBalance: currentProjectedRaBalanceForPlanner,
      }),
    [
      desiredMonthlyPayoutGoal,
      payoutStartAge,
      cpfLifePlanChoice,
      sex,
      result.cpfRetirementSums,
      currentProjectedRaBalanceForPlanner,
    ]
  );
  const maxProjectedPayout = Math.max(1, ...cpfLifeTopUpPlan.payoutProjection.map((p) => p.payout));

  // Picking a plan card auto-fills "Desired monthly payout" with what that plan would actually
  // pay from your current projected balance — so the planner opens on a real number instead of
  // an arbitrary default, and you're not left wondering why choosing Escalating didn't change
  // anything. The field stays editable afterwards: type a different amount to see the top-up
  // needed to reach it instead.
  const selectCpfLifePlan = (plan: CpfLifePlanChoice) => {
    setCpfLifePlanChoice(plan);
    setDesiredMonthlyPayoutGoal(
      estimateCpfLifePlanPayoutAtAge(currentProjectedRaBalanceForPlanner, plan, payoutStartAge, result.cpfRetirementSums, sex)
    );
  };

  // --- Net worth snapshot ---
  const totalCpfToday = currentOA + currentSaRa + currentMA;
  const { netWorth, slices } = computeNetWorth({
    hdbValue: hdbCurrentValue,
    totalCpf: totalCpfToday,
    totalInvestments: totalInvestmentsPortfolio,
  });

  // --- Monthly cash flow ---
  const totalIncome = sumLineItems(incomeItems);
  const totalExpenses = sumLineItems(expenseItems);
  const totalLiabilities = sumLineItems(liabilityItems);
  const monthlySurplus = totalIncome - totalExpenses - totalLiabilities;

  // --- Rightsizing scenario ---
  const rightsizing =
    planRightsizing && hdbScenario
      ? computeRightsizing({
          saleProceeds: hdbCurrentValue,
          cpfRefund: hdbScenario.cpfRefund,
          replacementFlatPrice,
          legalMovingCosts,
        })
      : null;
  const estimatedAssetsAfterRightsizing = rightsizing
    ? totalCpfToday + totalInvestmentsPortfolio + rightsizing.cashReleased
    : null;

  // --- Health check ---
  const hasLoanLikeExpense = expenseItems.some((item) => /loan/i.test(item.label));
  const healthCheck = computeHealthCheck({
    cpfOaSaRa: currentOA + currentSaRa,
    cpfFrs: result.cpfRetirementSums.frs,
    cpfBrs: result.cpfRetirementSums.brs,
    cpfErs: result.cpfRetirementSums.ers,
    hdbLoanOutstanding: savedHdb?.data ? savedHdb.data.outstandingLoan : null,
    totalInvestments: totalInvestmentsPortfolio,
    investmentItemCount: investmentItems.length,
    cashAndInvestmentsForLiquidity: currentSavings,
    totalMonthlyExpenses: totalExpenses,
    totalMonthlyLiabilities: totalLiabilities,
    hasLoanLikeExpense,
    monthlySurplus,
    totalMonthlyIncome: totalIncome,
    onTrackForRetirement: result.onTrack,
    cpfLifeTargetTier,
    projectedCpfForRetirementAccount: result.projectedOA + result.projectedSaRa,
  });

  // --- Timeline ---
  const timelineSteps = [
    { age: `${currentAge}–${retirementAge}`, icon: "📈", label: "Grow investments & build cash reserves" },
    {
      age: `${retirementAge}`,
      icon: "🏁",
      label: planRightsizing ? "Retire — consider rightsizing to a smaller flat" : "Retire",
    },
    {
      age: "65",
      icon: "🏦",
      label:
        retirementAge >= 65
          ? "CPF LIFE payouts begin"
          : "CPF LIFE payouts begin (bridge the gap before this with cash/investments)",
    },
    { age: "80+", icon: "🩺", label: "Review portfolio & healthcare needs" },
    { age: "Legacy", icon: "🌳", label: "Preserve wealth & plan for beneficiaries" },
  ];

  const clearInputs = () => {
    setCurrentAge(DEFAULTS.currentAge);
    setRetirementAge(DEFAULTS.retirementAge);
    setCurrentSavings(DEFAULTS.currentSavings);
    setCurrentOA(DEFAULTS.currentOA);
    setCurrentSaRa(DEFAULTS.currentSaRa);
    setCurrentMA(DEFAULTS.currentMA);
    setMonthlyInvestment(DEFAULTS.monthlyInvestment);
    setExpectedReturnPct(DEFAULTS.expectedReturnPct);
    setDesiredMonthlySpend(DEFAULTS.desiredMonthlySpend);
    setInflationRatePct(DEFAULTS.inflationRatePct);
    setHdbCurrentValue(DEFAULTS.hdbCurrentValue);
    setIncomeItems(DEFAULTS.incomeItems.map((i) => ({ ...i })));
    setExpenseItems(DEFAULTS.expenseItems.map((i) => ({ ...i })));
    setInvestmentItems(DEFAULTS.investmentItems.map((i) => ({ ...i })));
    setLiabilityItems(DEFAULTS.liabilityItems.map((i) => ({ ...i })));
    setPlanRightsizing(DEFAULTS.planRightsizing);
    setReplacementFlatPrice(DEFAULTS.replacementFlatPrice);
    setLegalMovingCosts(DEFAULTS.legalMovingCosts);
    setCpfLifeTargetTier(DEFAULTS.cpfLifeTargetTier);
    setIncludeInvestmentHoldings(DEFAULTS.includeInvestmentHoldings);
    setYearsInRetirement(DEFAULTS.yearsInRetirement);
    setAnnualRstuTopUp(DEFAULTS.annualRstuTopUp);
    setSex(DEFAULTS.sex);
    setBirthYear(DEFAULTS.birthYear);
    setCpfLifePlanChoice(DEFAULTS.cpfLifePlanChoice);
    setDesiredMonthlyPayoutGoal(DEFAULTS.desiredMonthlyPayoutGoal);
    setPayoutStartAge(DEFAULTS.payoutStartAge);
    clearCalculatorData(STORAGE_KEY);
    setSavedAt(null);
  };

  const handleSave = () => {
    const at = saveCalculatorData(STORAGE_KEY, {
      currentAge,
      retirementAge,
      currentSavings,
      currentOA,
      currentSaRa,
      currentMA,
      monthlyInvestment,
      expectedReturnPct,
      desiredMonthlySpend,
      inflationRatePct,
      hdbCurrentValue,
      incomeItems,
      expenseItems,
      investmentItems,
      liabilityItems,
      planRightsizing,
      replacementFlatPrice,
      legalMovingCosts,
      cpfLifeTargetTier,
      includeInvestmentHoldings,
      yearsInRetirement,
      annualRstuTopUp,
      sex,
      birthYear,
      cpfLifePlanChoice,
      desiredMonthlyPayoutGoal,
      payoutStartAge,
      cpfLifeMonthlyIncome: result.cpfLife.estimatedMonthlyPayout,
      includeHdbSale,
    });
    setSavedAt(at);
  };

  const dashboardExportData: DashboardExportData = {
    generatedOn: new Date().toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }),
    currentAge,
    retirementAge,
    yearsToRetirement: result.yearsToRetirement,
    monthlyIncome: totalIncome,
    monthlySurplus,
    onTrack: result.onTrack,
    netWorth,
    hdbValue: hdbCurrentValue,
    totalCpf: totalCpfToday,
    totalInvestments: totalInvestmentsPortfolio,
    slices,
    cpfOa: currentOA,
    cpfMa: currentMA,
    cpfSaRa: currentSaRa,
    incomeItems,
    totalIncome,
    totalExpenses,
    totalLiabilities,
    investmentItems,
    expenseItems,
    liabilityItems,
    hdbOverview:
      savedHdb?.data && hdbScenario
        ? {
            saleValue: hdbCurrentValue,
            cpfPrincipalUsed: savedHdb.data.cpfPrincipalUsed,
            cpfAccruedInterest: savedHdb.data.cpfAccruedInterest,
            cpfRefund: hdbScenario.cpfRefund,
            loanOutstanding: savedHdb.data.outstandingLoan,
          }
        : null,
    rightsizing:
      rightsizing && hdbScenario
        ? {
            saleProceeds: hdbCurrentValue,
            cpfRefund: hdbScenario.cpfRefund,
            balanceAfterCpfRefund: rightsizing.balanceAfterCpfRefund,
            replacementFlatPrice,
            legalMovingCosts,
            cashReleased: rightsizing.cashReleased,
          }
        : null,
    financialPositionAfter:
      rightsizing && estimatedAssetsAfterRightsizing !== null
        ? {
            cpfSavings: totalCpfToday,
            investmentsAndInsurance: totalInvestmentsPortfolio,
            cashReleased: rightsizing.cashReleased,
            estimatedFinancialAssets: estimatedAssetsAfterRightsizing,
          }
        : null,
    healthDimensions: healthCheck.dimensions,
    overallScore: healthCheck.overallScore,
    timelineSteps,
  };

  // The Dashboard infographic used to be its own free PNG download — it's now folded into the
  // Premium Report as an appendix instead, so generating the report captures it first.
  const handleDownloadPremiumReport = async () => {
    if (isGeneratingReport) return;
    setIsGeneratingReport(true);
    try {
      const dashboardCanvas = dashboardExportRef.current
        ? await captureNodeAsCanvas(dashboardExportRef.current)
        : null;
      generatePremiumRetirementReport({
        base: {
          currentAge,
          retirementAge,
          currentSavings: effectiveSavings,
          currentOA: effectiveOA,
          currentSaRa,
          currentMA,
          monthlyInvestment,
          expectedReturnPct,
          desiredMonthlySpend,
          cpfLifeTargetTier,
          investmentHoldingsValue: effectiveInvestmentHoldings,
          inflationRatePct,
          yearsInRetirement,
          annualRstuTopUp,
          sex,
          birthYear: birthYear > 0 ? birthYear : undefined,
        },
        result,
        cpfLifeTargetTier,
        dashboardCanvas,
        otherModules: {
          salary: savedSalary?.data && salaryResult ? { input: savedSalary.data, result: salaryResult, savedAt: savedSalary.savedAt } : null,
          accruedInterest:
            accruedInterestResult
              ? { result: accruedInterestResult, savedAt: savedAccruedInterest!.savedAt }
              : null,
          carCost: savedCarCost?.data && carCostResult ? { input: savedCarCost.data, result: carCostResult, savedAt: savedCarCost.savedAt } : null,
          hdbSale: savedHdb?.data && hdbScenario ? { input: savedHdb.data, result: hdbScenario, savedAt: savedHdb.savedAt } : null,
        },
      });
    } catch (err) {
      console.error("Could not generate the premium report", err);
      window.alert("Sorry, something went wrong generating your report. Please try again.");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // A quick single-image alternative to the full multi-page PDF — same capture as the report's
  // Dashboard appendix, just exported straight away as one PNG instead of being embedded in a
  // report. Gated behind the same unlock flag as the Premium Report so it isn't re-exposed to
  // everyone as a free standalone feature.
  const handleDownloadDashboardImage = async () => {
    if (isGeneratingDashboardImage) return;
    setIsGeneratingDashboardImage(true);
    try {
      const canvas = dashboardExportRef.current ? await captureNodeAsCanvas(dashboardExportRef.current) : null;
      if (!canvas) {
        window.alert("Could not generate the dashboard image. Please try again.");
        return;
      }
      downloadCanvasAsPng(canvas, "sg-money-retirement-dashboard.png");
    } catch (err) {
      console.error("Could not generate the dashboard image", err);
      window.alert("Sorry, something went wrong generating the dashboard image. Please try again.");
    } finally {
      setIsGeneratingDashboardImage(false);
    }
  };

  return (
    <CalcShell
      title="👴 Retirement Calculator"
      subtitle="Are you on track to retire comfortably in Singapore?"
      whatsappTopic="Retirement Calculator"
      showAppSuiteFooter
      onClear={clearInputs}
      onSave={handleSave}
      savedAt={savedAt}
    >
      <div className="form-grid">
        <NumberField label="Current age" value={currentAge} onChange={setCurrentAge} />
        <NumberField label="Target retirement age" value={retirementAge} onChange={setRetirementAge} />
        <SelectField
          label="Sex"
          value={sex}
          onChange={setSex}
          options={[
            { value: "male", label: "Male" },
            { value: "female", label: "Female" },
          ]}
        />
        <NumberField label="Birth year (optional)" value={birthYear} onChange={setBirthYear} />
        <NumberField label="Current savings (cash/investments)" value={currentSavings} onChange={setCurrentSavings} prefix="$" step={1000} />
        <NumberField label="CPF Ordinary Account (OA)" value={currentOA} onChange={setCurrentOA} prefix="$" step={1000} />
        <NumberField label="CPF Special / Retirement Account (SA/RA)" value={currentSaRa} onChange={setCurrentSaRa} prefix="$" step={1000} />
        <NumberField label="CPF MediSave (MA)" value={currentMA} onChange={setCurrentMA} prefix="$" step={1000} />
        <NumberField label="Monthly investment" value={monthlyInvestment} onChange={setMonthlyInvestment} prefix="$" step={100} />
        <NumberField label="Expected annual return (cash/investments)" value={expectedReturnPct} onChange={setExpectedReturnPct} suffix="%" step={0.5} />
        <NumberField label="Desired retirement spending" value={desiredMonthlySpend} onChange={setDesiredMonthlySpend} prefix="$" suffix="/mo" step={100} />
        <NumberField label="Expected inflation rate" value={inflationRatePct} onChange={setInflationRatePct} suffix="%" step={0.5} />
        <NumberField label="Years in retirement" value={yearsInRetirement} onChange={setYearsInRetirement} suffix="years" step={1} />
        <NumberField label="Annual RSTU top-up to SA/RA" value={annualRstuTopUp} onChange={setAnnualRstuTopUp} prefix="$" step={500} />
      </div>
      <p className="explainer">
        "Years in retirement" drives how long your savings need to last — try 30 or 35 instead of the default 25
        to see how much more you'd need if you live longer than planned. Voluntary top-ups to SA/RA under the
        RSTU scheme earn 4% p.a. and qualify for up to $8,000/year in tax relief (up to $16,000/year combined with
        top-ups to a loved one's account) — not modeled as a tax saving here since that depends on your marginal
        tax rate, but the retirement-balance growth from topping up is reflected below.
      </p>
      <p className="explainer">
        "Sex" feeds into the CPF LIFE Estimate below — CPF Board calculates payouts using gender-specific life
        expectancy, so male and female members with the same Retirement Account balance get different monthly
        payouts (see the estimate card for details). "Birth year" is optional — leave it at 0 to derive your CPF
        cohort year from "Current age" (already accurate to the year for most cases); fill it in only if you want
        the more precise, official-calculator-style derivation instead.
      </p>

      <ResultCard title="📊 Net Worth Snapshot">
        <NumberField label="Current HDB value" value={hdbCurrentValue} onChange={setHdbCurrentValue} prefix="$" step={5000} />
        <p className="explainer" style={{ marginTop: 4 }}>
          Investments & insurance holdings — add each one (unit trusts, whole life policies, brokerage accounts,
          SRS, etc). This is separate from "Current savings" above — it can optionally be grown and added into
          your retirement projection too (see "Projected Balances at Retirement" below).
        </p>
        <EditableLineItems
          items={investmentItems}
          onChange={setInvestmentItems}
          addLabel="Add a holding"
          placeholder="e.g. Whole life policy"
          showDateRange
          currentAge={currentAge}
          keepValueAfterEnd
        />
        <ResultRow label="TOTAL NET WORTH" value={formatSgd(netWorth)} emphasis />
        <AssetAllocationBar slices={slices} />
      </ResultCard>

      <ResultCard title="💵 Monthly Cash Flow">
        <p className="explainer" style={{ marginTop: -2 }}>Income</p>
        <EditableLineItems items={incomeItems} onChange={setIncomeItems} addLabel="Add income source" placeholder="e.g. Salary" />
        <p className="explainer" style={{ marginTop: 14 }}>Expenses</p>
        <EditableLineItems
          items={expenseItems}
          onChange={setExpenseItems}
          addLabel="Add expense"
          placeholder="e.g. Insurance premium"
          showDateRange
          currentAge={currentAge}
        />
        <p className="explainer" style={{ marginTop: 14 }}>Liabilities</p>
        <p className="explainer" style={{ marginTop: -6 }}>
          Monthly loan/debt repayments — home mortgage, car loan, children's education loan, etc. These reduce
          your cash flow surplus below, not your Net Worth above (which only subtracts outstanding loan
          balances, tracked separately via the HDB Sale Proceeds calculator).
        </p>
        <EditableLineItems
          items={liabilityItems}
          onChange={setLiabilityItems}
          addLabel="Add a liability"
          placeholder="e.g. Home mortgage, car loan, children's education loan"
        />
        <ResultRow label="Total income" value={formatSgd(totalIncome)} />
        <ResultRow label="Total expenses" value={`-${formatSgd(totalExpenses)}`} positive={false} />
        <ResultRow label="Total liabilities" value={`-${formatSgd(totalLiabilities)}`} positive={false} />
        <ResultRow
          label={monthlySurplus >= 0 ? "MONTHLY SURPLUS" : "MONTHLY DEFICIT"}
          value={formatSgd(Math.abs(monthlySurplus))}
          emphasis
          positive={monthlySurplus >= 0}
        />
      </ResultCard>

      <ResultCard title="🏠 Selling Your HDB">
        {hdbScenario ? (
          <>
            <ResultRow
              label={applyHdbScenario ? "CPF refund → added to your OA" : "CPF refund → not counted below (box unchecked)"}
              value={`+${formatSgd(hdbScenario.cpfRefund)}`}
              positive={applyHdbScenario || undefined}
            />
            <ResultRow
              label={applyHdbScenario ? "Cash proceeds → added to your savings" : "Cash proceeds → not counted below (box unchecked)"}
              value={`+${formatSgd(hdbScenario.cashProceeds)}`}
              positive={applyHdbScenario || undefined}
            />
            <p className="explainer">
              Pulled from what you saved in the{" "}
              <Link to="/hdb-sale-proceeds">HDB Sale Proceeds calculator</Link>
              {savedHdb?.savedAt
                ? ` on ${new Date(savedHdb.savedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                : ""}
              .
            </p>

            <label className="hdb-scenario-toggle">
              <input
                type="checkbox"
                checked={includeHdbSale}
                onChange={(e) => setIncludeHdbSale(e.target.checked)}
              />
              <span>Include selling my HDB today in this projection</span>
            </label>
            <p className="explainer" style={{ marginTop: -6 }}>
              Adds the CPF refund and cash proceeds above into your projected balances below. Uncheck to see
              your outlook without selling.
            </p>

            <label className="dashboard-toggle section-divider">
              <input type="checkbox" checked={planRightsizing} onChange={(e) => setPlanRightsizing(e.target.checked)} />
              <span>I'm considering downsizing to a smaller flat</span>
            </label>
            {!planRightsizing && (
              <p className="explainer">
                Check the box above to model buying a smaller replacement flat and see how much cash that
                would release for retirement.
              </p>
            )}
            {planRightsizing && rightsizing && (
              <>
                <NumberField
                  label="Replacement flat price"
                  value={replacementFlatPrice}
                  onChange={setReplacementFlatPrice}
                  prefix="$"
                  step={5000}
                />
                <NumberField
                  label="Estimated legal & moving costs"
                  value={legalMovingCosts}
                  onChange={setLegalMovingCosts}
                  prefix="$"
                  step={500}
                />
                <ResultRow label="Estimated sale proceeds" value={formatSgd(hdbCurrentValue)} />
                <ResultRow label="Less: CPF refund" value={`-${formatSgd(hdbScenario.cpfRefund)}`} positive={false} />
                <ResultRow label="Balance after CPF refund" value={formatSgd(rightsizing.balanceAfterCpfRefund)} />
                <ResultRow label="Less: replacement flat price" value={`-${formatSgd(replacementFlatPrice)}`} positive={false} />
                <ResultRow label="Less: legal & moving costs" value={`-${formatSgd(legalMovingCosts)}`} positive={false} />
                <ResultRow
                  label="ESTIMATED CASH RELEASED"
                  value={formatSgd(rightsizing.cashReleased)}
                  emphasis
                  positive={rightsizing.cashReleased >= 0}
                />
                <div className="result-card" style={{ marginTop: 12, marginBottom: 0, boxShadow: "none" }}>
                  <h3>Financial Position After Rightsizing</h3>
                  <ResultRow label="CPF savings" value={formatSgd(totalCpfToday)} />
                  <ResultRow label="Investments & insurance" value={formatSgd(totalInvestmentsPortfolio)} />
                  <ResultRow label="Cash released from rightsizing" value={formatSgd(rightsizing.cashReleased)} />
                  <ResultRow
                    label="ESTIMATED FINANCIAL ASSETS"
                    value={formatSgd(estimatedAssetsAfterRightsizing ?? 0)}
                    emphasis
                  />
                  <p className="explainer">Excludes the value of your replacement flat.</p>
                </div>
              </>
            )}
          </>
        ) : (
          <>
            {planRightsizing && (
              <p className="explainer" style={{ fontWeight: 500 }}>
                Got it — you're considering downsizing. Save your numbers in the HDB Sale Proceeds calculator
                and this section will model it for you automatically when you come back.
              </p>
            )}
            <p className="explainer">
              Save your numbers in the <Link to="/hdb-sale-proceeds">HDB Sale Proceeds calculator</Link> and
              they'll show up here as a "what if I sold today" scenario — the CPF refund gets added to your OA
              and the cash proceeds to your savings, plus you'll be able to model downsizing to a smaller flat.
            </p>
          </>
        )}
      </ResultCard>

      <ResultCard title="Projected Balances at Retirement">
        {applyHdbScenario && (
          <p className="explainer">Includes a one-time boost from selling your HDB today (see above).</p>
        )}
        <p className="explainer" style={{ marginTop: -2 }}>
          Cash, investments and the holdings below all compound monthly at the{" "}
          <strong>{expectedReturnPct}% expected annual return</strong> you set in the "Expected annual return
          (cash/investments)" field near the top of this page — CPF balances use their own fixed rates instead.
        </p>
        <ResultRow label="Cash & investments" value={formatSgd(result.projectedCash)} />
        <ResultRow label="CPF OA" value={formatSgd(result.projectedOA)} />
        <ResultRow label="CPF SA/RA" value={formatSgd(result.projectedSaRa)} />
        <label className="hdb-scenario-toggle" style={{ marginTop: 4 }}>
          <input
            type="checkbox"
            checked={includeInvestmentHoldings}
            onChange={(e) => setIncludeInvestmentHoldings(e.target.checked)}
          />
          <span>Include my investment &amp; insurance holdings</span>
        </label>
        <ResultRow
          label="Investments & insurance (grown)"
          value={formatSgd(result.projectedInvestmentHoldings)}
        />
        <p className="explainer" style={{ marginTop: -6 }}>
          {includeInvestmentHoldings
            ? `Today's ${formatSgd(totalInvestmentsPortfolio)} in holdings from your Net Worth Snapshot, compounded monthly at your ${expectedReturnPct}% expected annual return (same field as above). No further monthly top-ups are assumed for these.`
            : `Unchecked — your Net Worth Snapshot holdings aren't counted here. Recheck to include them, compounded at your ${expectedReturnPct}% expected annual return.`}
        </p>
        <ResultRow label="COUNTED TOWARD RETIREMENT INCOME" value={formatSgd(result.projectedSavings)} emphasis />
        <ResultRow label="CPF MediSave (kept for healthcare, not counted)" value={formatSgd(result.projectedMA)} />
      </ResultCard>

      <ResultCard title="Your Retirement Outlook">
        <ResultRow label="Years remaining" value={`${result.yearsToRetirement} years`} />
        <ResultRow label="Projected savings at retirement" value={formatSgd(result.projectedSavings)} />
        <ResultRow
          label={`Desired spending at retirement (${inflationRatePct}%/yr inflation)`}
          value={`${formatSgd(result.desiredMonthlySpendAtRetirement)}/mo`}
        />
        <ResultRow label="Target required" value={formatSgd(result.targetRequired)} />
        <p className="explainer" style={{ marginTop: -6 }}>
          Your {formatSgd(desiredMonthlySpend)}/mo today is inflated to {formatSgd(result.desiredMonthlySpendAtRetirement)}/mo by
          the time you retire, then kept rising at the same rate across your 25 years in retirement — "Target required" is
          the total nominal dollars that takes.
        </p>
        <ResultRow
          label={result.onTrack ? "SURPLUS" : "SHORTFALL"}
          value={formatSgd(Math.abs(result.shortfall))}
          emphasis
          positive={result.onTrack}
        />
      </ResultCard>

      <Link to="/geo-arbitrage" className="geo-arbitrage-cta">
        <span className="geo-arbitrage-cta-icon">🌏</span>
        <span>
          <strong>What if I retire overseas?</strong>
          <small>Compare Bangkok, Johor Bahru and Ho Chi Minh City.</small>
        </span>
        <span aria-hidden="true">→</span>
      </Link>

      <ResultCard title="💎 Premium Retirement Report">
        {premiumUnlocked ? (
          <>
            <p className="explainer" style={{ marginTop: -2 }}>
              Unlocked — download your personalized multi-page report: a written breakdown of where you stand,
              retirement-age and savings scenarios, a year-by-year growth projection, a CPF LIFE tier comparison,
              and the full Dashboard infographic, all built from the numbers above. Or just grab the Dashboard as a
              quick single image, no need to regenerate the full report every time you update your numbers.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              <button
                type="button"
                className="dashboard-btn"
                onClick={handleDownloadPremiumReport}
                disabled={isGeneratingReport}
              >
                {isGeneratingReport ? "Generating…" : "📄 Download Premium Report"}
              </button>
              <button
                type="button"
                className="dashboard-btn"
                onClick={handleDownloadDashboardImage}
                disabled={isGeneratingDashboardImage}
              >
                {isGeneratingDashboardImage ? "Generating…" : "📊 Download Dashboard (PNG)"}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="explainer" style={{ marginTop: -2 }}>
              Go deeper than the free outlook above: a written breakdown of where you stand, side-by-side
              scenarios for retiring earlier/later or saving more each month, a year-by-year growth projection,
              a CPF LIFE tier comparison, and the full Dashboard infographic — all in one personalized PDF,
              generated on your device.
            </p>
            <PremiumReportPreview />
            <a
              href={PREMIUM_REPORT_PAYMENT_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="dashboard-btn"
              style={{ display: "inline-block", textDecoration: "none", textAlign: "center" }}
            >
              🔓 Unlock for {PREMIUM_REPORT_PRICE_LABEL}
            </a>
          </>
        )}
      </ResultCard>

      {!result.onTrack && (
        <ResultCard title="Ways to close the gap">
          <ResultRow label="Increase monthly savings to" value={formatSgd(result.suggestedMonthlySavings)} />
        </ResultCard>
      )}

      <ResultCard title="🏦 CPF LIFE Estimate (from age 65)">
        <p className="explainer" style={{ marginTop: -2 }}>
          Which tier are you actually planning to set aside in your CPF Retirement Account? Pick BRS if you plan to
          pledge your property (or already own one) and only need the Basic Retirement Sum set aside — the rest of
          your projected CPF becomes cash you could withdraw at 55. Most people without a pledge default to FRS.
        </p>
        <div className="cpf-life-tiers" role="radiogroup" aria-label="CPF LIFE target tier">
          {(["brs", "frs", "ers"] as CpfLifeTargetTier[]).map((tier) => (
            <button
              type="button"
              key={tier}
              role="radio"
              aria-checked={cpfLifeTargetTier === tier}
              className={`cpf-life-tier${cpfLifeTargetTier === tier ? " cpf-life-tier-selected" : ""}`}
              onClick={() => setCpfLifeTargetTier(tier)}
            >
              <span className="cpf-life-tier-name">{tier.toUpperCase()}</span>
              <span>{formatSgd(result.cpfRetirementSums[tier])}</span>
              <span className="cpf-life-tier-payout">
                ~{formatSgd(
                  sex === "female"
                    ? CPF_LIFE_STANDARD_PAYOUT_2026[tier] * CPF_LIFE_FEMALE_PAYOUT_FACTOR
                    : CPF_LIFE_STANDARD_PAYOUT_2026[tier]
                )}/mo
              </span>
            </button>
          ))}
        </div>
        <ResultRow
          label={`Set aside for ${CPF_LIFE_TIER_LABEL[cpfLifeTargetTier]}`}
          value={formatSgd(result.cpfLife.retirementAccountBalance)}
        />
        <ResultRow
          label={`Top up needed to reach ${cpfLifeTargetTier.toUpperCase()} from today's balance`}
          value={
            result.cpfRetirementSums[cpfLifeTargetTier] > currentRaBalanceToday
              ? formatSgd(result.cpfRetirementSums[cpfLifeTargetTier] - currentRaBalanceToday)
              : "Already there today"
          }
          positive={result.cpfRetirementSums[cpfLifeTargetTier] <= currentRaBalanceToday}
        />
        <ResultRow
          label="ESTIMATED MONTHLY PAYOUT"
          value={`${formatSgd(result.cpfLife.estimatedMonthlyPayout)}/mo`}
          emphasis
          positive
        />
        {result.cpfLifeExcessCash > 0 && (
          <ResultRow
            label="Estimated cash withdrawable at 55 (above this tier)"
            value={formatSgd(result.cpfLifeExcessCash)}
            positive
          />
        )}
        <p className="explainer">
          The BRS/FRS/ERS amounts above are for{" "}
          {result.cpfRetirementSums.isCohortEstimated
            ? `the nearest year CPF Board has published (your own ${result.cpfRetirementSums.cohortYear} cohort figures aren't out yet, or predate our data)`
            : `your own cohort — you turn 55 in ${result.cpfRetirementSums.cohortYear}`}
          , not just whatever the current year's figures happen to be (BRS and FRS are fixed for life the year you
          turn 55; ERS is the one exception and moves with the current year's ceiling instead). The monthly payout
          estimate itself is still based on the CPF LIFE Standard Plan's published 2026 reference payouts — CPF Board
          doesn't publish an exact payout figure per cohort, so treat it as illustrative, not precise to your cohort.
          Your OA and SA/RA typically combine into your Retirement Account at age 55 — this estimate assumes that
          happens, then caps at whichever tier you've selected above. The "Top up needed" row compares that tier
          directly against your CURRENT {formatSgd(currentRaBalanceToday)} OA + SA/RA balance (no growth assumed) —
          the ESTIMATED MONTHLY PAYOUT below it, though, is still projected forward to age {retirementAge} first, so
          the two rows are on different bases and won't line up unless you're already at your target retirement age.
          One more gap worth knowing about: for balances heading into the FRS→ERS range, this estimate uses{" "}
          <strong>today's</strong> ERS ceiling as the top of that curve — but CPF Board only publishes ERS figures
          through 2027, so if your payout start age is many years out, the real future ceiling is very likely higher
          than today's, which would widen that band and pull the true payout down. Checked against one of CPF
          Board's own published examples, this can overstate the estimate by roughly 50% for someone years away from
          hitting ERS — so treat this card as a rough guide to the shape of the numbers, and use CPF Board's own
          Monthly Payout Estimator at{" "}
          <a href="https://www.cpf.gov.sg/lifeestimator" target="_blank" rel="noopener noreferrer">
            cpf.gov.sg/lifeestimator
          </a>{" "}
          as the authoritative figure for any real decision.
          {result.sex === "female" && (
            <>
              {" "}
              Since Sex is set to Female, the payout above has been scaled down by an approximate ~8% — CPF Board's
              published reference payouts (and the tier previews above) are male-member figures, and CPF LIFE pays
              female members less for the same balance because of their longer average life expectancy. This
              adjustment is an illustrative estimate (see the source in this app's code), not an official CPF Board
              factor — for your exact figure, use CPF Board's own Monthly Payout Estimator at{" "}
              <a href="https://www.cpf.gov.sg/lifeestimator" target="_blank" rel="noopener noreferrer">
                cpf.gov.sg/lifeestimator
              </a>
              .
            </>
          )}
        </p>
      </ResultCard>

      <ResultCard title="⚖️ Compare CPF LIFE Plans">
        <p className="explainer" style={{ marginTop: -2 }}>
          Plan choice is locked 12 months after joining CPF LIFE — worth comparing before you decide. These are
          approximations (CPF Board publishes the ~10-15% and ~20% reduction ranges below, not an exact formula),
          based on the same {formatSgd(result.cpfLife.retirementAccountBalance)} Retirement Account balance as above.
        </p>
        <ResultRow
          label="Standard — steady payout, smaller bequest"
          value={`${formatSgd(cpfLifePlans.standard.estimatedMonthlyPayout)}/mo`}
          emphasis
        />
        <ResultRow
          label="Basic — ~12.5% lower, largest bequest"
          value={`${formatSgd(cpfLifePlans.basic.estimatedMonthlyPayout)}/mo`}
        />
        <ResultRow
          label="Escalating — starts ~20% lower, +2%/yr for life"
          value={`${formatSgd(cpfLifePlans.escalating.estimatedMonthlyPayout)}/mo`}
        />
        <p className="explainer">
          At this rate, Escalating overtakes Standard's payout around year {cpfLifePlans.escalating.crossoverYear} of
          retirement (roughly age {65 + cpfLifePlans.escalating.crossoverYear}) — worth considering if you expect a
          long retirement and want built-in inflation protection. Basic suits those prioritising a larger legacy for
          beneficiaries over maximum lifetime income.
        </p>

        <div style={{ borderTop: "1px dashed var(--border)", margin: "16px 0 12px" }} />
        <p className="explainer" style={{ marginTop: -2 }}>
          The rows above project your OA + SA/RA balance forward to age {retirementAge} before estimating a payout —
          useful for "what will I end up with," but not directly comparable to CPF Board's own Monthly Payout
          Estimator, which instead takes whatever balance you type in and computes a payout as if you joined CPF LIFE
          right now, with no further growth. Here's that same "today" comparison, using your current{" "}
          {formatSgd(currentRaBalanceToday)} OA + SA/RA balance (capped at ERS) as-is:
        </p>
        <ResultRow
          label="Standard, on today's balance"
          value={`${formatSgd(cpfLifePlansToday.standard.estimatedMonthlyPayout)}/mo`}
        />
        <ResultRow
          label="Basic, on today's balance"
          value={`${formatSgd(cpfLifePlansToday.basic.estimatedMonthlyPayout)}/mo`}
        />
        <ResultRow
          label="Escalating, on today's balance"
          value={`${formatSgd(cpfLifePlansToday.escalating.estimatedMonthlyPayout)}/mo`}
        />
      </ResultCard>

      <ResultCard title="🎯 CPF LIFE Payout Planner">
        <p className="explainer" style={{ marginTop: -2 }}>
          Pick a plan and we'll fill in what it would actually pay you based on your projected balance — edit that
          number afterwards if you'd rather target a different payout and see how much more you'd need to top up.
        </p>
        <div className="cpf-life-plan-picker" role="radiogroup" aria-label="CPF LIFE plan for this planner">
          {(["escalating", "standard", "basic"] as CpfLifePlanChoice[]).map((plan) => (
            <button
              type="button"
              key={plan}
              role="radio"
              aria-checked={cpfLifePlanChoice === plan}
              className={`cpf-life-plan-card${cpfLifePlanChoice === plan ? " cpf-life-plan-card-selected" : ""}`}
              onClick={() => selectCpfLifePlan(plan)}
            >
              <span className="cpf-life-plan-card-name">{CPF_LIFE_PLAN_LABEL[plan]}</span>
              <span className="cpf-life-plan-card-desc">{CPF_LIFE_PLAN_DESC[plan]}</span>
            </button>
          ))}
        </div>

        <div className="form-grid" style={{ marginTop: 14 }}>
          <NumberField
            label="Desired monthly payout"
            value={desiredMonthlyPayoutGoal}
            onChange={setDesiredMonthlyPayoutGoal}
            prefix="$"
            suffix="/mo"
            step={100}
          />
          <SelectField
            label="I'd like to start payouts at age"
            value={String(payoutStartAge)}
            onChange={(v) => setPayoutStartAge(Number(v))}
            options={[65, 66, 67, 68, 69, 70].map((age) => ({ value: String(age), label: `Age ${age}` }))}
          />
        </div>

        {cpfLifeTopUpPlan.additionalTopUpNeeded > 0 ? (
          <ResultRow label="Additional top-up needed" value={formatSgd(cpfLifeTopUpPlan.additionalTopUpNeeded)} emphasis />
        ) : (
          <ResultRow label="You're already on track for this" value="No extra top-up needed" emphasis positive />
        )}
        <ResultRow label="Retirement Account balance needed" value={formatSgd(cpfLifeTopUpPlan.requiredRaBalance)} />
        <ResultRow
          label={`Projected payout at age ${payoutStartAge}`}
          value={`${formatSgd(cpfLifeTopUpPlan.payoutAtStartAge)}/mo`}
          positive={cpfLifeTopUpPlan.payoutAtStartAge >= desiredMonthlyPayoutGoal}
        />

        <p className="explainer" style={{ marginTop: 12, marginBottom: 4 }}>
          Projected payout over time on the {CPF_LIFE_PLAN_LABEL[cpfLifePlanChoice]}:
        </p>
        <div className="payout-projection-bars" role="img" aria-label="Projected CPF LIFE payout over time">
          {cpfLifeTopUpPlan.payoutProjection.map((p) => (
            <div className="payout-projection-row" key={p.age}>
              <span className="payout-projection-age">Age {p.age}</span>
              <div className="payout-projection-track">
                <div
                  className="payout-projection-fill"
                  style={{ width: `${Math.max(4, (p.payout / maxProjectedPayout) * 100)}%` }}
                />
              </div>
              <span className="payout-projection-value">{formatSgd(p.payout)}/mo</span>
            </div>
          ))}
        </div>

        <p className="explainer">
          {cpfLifeTopUpPlan.exceedsErs
            ? `Even topping up to the current Enhanced Retirement Sum ceiling (${formatSgd(
                result.cpfRetirementSums.ers
              )}) — the most anyone can set aside — the ${CPF_LIFE_PLAN_LABEL[
                cpfLifePlanChoice
              ].toLowerCase()} can't reach ${formatSgd(
                desiredMonthlyPayoutGoal
              )}/mo starting at age ${payoutStartAge}. The figures above show the closest achievable instead — starting later (up to age 70) or switching plans may help close the gap.`
            : `This assumes you have exactly ${formatSgd(
                cpfLifeTopUpPlan.requiredRaBalance
              )} in your Retirement Account by age 55, capped at ERS (the most anyone can set aside). Deferring past 65 boosts every subsequent payout by an approximate ${(
                CPF_LIFE_DEFERRAL_BONUS_PER_YEAR * 100
              ).toFixed(0)}%/year deferred, up to age 70 — CPF Board's own published deferral bonus, applied here as a simple approximation of their actual formula.`}
          {!cpfLifeTopUpPlan.exceedsErs &&
            cpfLifeTopUpPlan.requiredRaBalance > result.cpfRetirementSums.frs &&
            " If that required balance sits above FRS, treat it as a rough guide rather than a precise target — this planner uses today's ERS ceiling, and CPF Board's real future ceiling (only published through 2027) is very likely higher by the time you get there, which would mean you actually need less than shown here."}
          {result.sex === "female" &&
            " This also reflects the same approximate Female payout adjustment used in the CPF LIFE Estimate above."}
        </p>
      </ResultCard>

      {annualRstuTopUp > 0 && (
        <ResultCard title="💰 RSTU Top-Up Impact">
          <ResultRow label="Extra in SA/RA from topping up" value={formatSgd(result.rstuTopUpGrowth)} emphasis positive />
          <p className="explainer">
            Topping up {formatSgd(annualRstuTopUp)}/year from now to retirement grows to an estimated{" "}
            {formatSgd(result.rstuTopUpGrowth)} extra in your SA/RA (already included in the projections above),
            on top of up to {formatSgd(RSTU_SELF_RELIEF_CAP)}/year in tax relief for topping up yourself (up to{" "}
            {formatSgd(RSTU_COMBINED_RELIEF_CAP)}/year combined with a top-up to a loved one's account) — the actual
            dollar tax saving depends on your marginal tax rate, which isn't modeled here.
          </p>
        </ResultCard>
      )}

      <ResultCard title="✅ Retirement Health Check">
        <div className="score-ring">
          <div className="score-number">
            {healthCheck.overallScore}
            <span>/100</span>
          </div>
          <p className="score-caption">
            An illustrative self-check from the numbers above — simple rules of thumb, not a professional
            assessment.
          </p>
        </div>
        <div className="health-grid">
          {healthCheck.dimensions.map((d) => (
            <HealthBadge key={d.key} dimension={d} />
          ))}
        </div>
      </ResultCard>

      <ResultCard title="🗓️ Retirement Timeline">
        <div className="timeline">
          {timelineSteps.map((step) => (
            <div className="timeline-step" key={step.age + step.label}>
              <div className="timeline-dot">{step.icon}</div>
              <div className="timeline-body">
                <div className="timeline-age">{step.age}</div>
                <div className="timeline-label">{step.label}</div>
              </div>
            </div>
          ))}
        </div>
      </ResultCard>

      <div className="promo-pair">
        <BtoPromo
          title="Considering rightsizing to a smaller flat?"
          desc="Check out our BTO Planning Tool for eligibility, timelines and flat selection."
        />
        <DocToolsPromo />
      </div>

      <Disclaimer>
        <p>
          Assumes 25 years in retirement and steady investment returns — actual markets fluctuate. Your desired
          retirement spending is entered in today's dollars and inflated at your chosen rate (2.5% by default, in
          line with MAS's long-run core inflation range) to the year you retire, then kept rising at that same rate
          across your years in retirement — investment returns and CPF interest rates themselves are not adjusted
          for inflation, only spending. CPF OA/SA/MediSave balances are projected at CPF's floor interest rates
          (OA 2.5%, SA/MA/RA 4%) with no further CPF contributions modelled between now and retirement.
        </p>
        <p>
          The CPF LIFE payout is an indicative Standard Plan estimate for the 2026 cohort, interpolated between
          CPF Board's published BRS/FRS/ERS figures — actual payouts depend on your plan choice
          (Standard/Basic/Escalating), gender, cohort and prevailing interest rates. For a personalised figure, use
          the official CPF LIFE Estimator on the CPF Board website.
        </p>
        <p>
          The HDB sale and rightsizing scenarios add the whole CPF refund and cash proceeds in one lump sum at
          today's prices — they don't model when you'd actually sell or where you'd live afterwards.
        </p>
        <p>
          The net worth, cash flow and health-check figures are computed only from what you type in here — nothing
          is verified, and the health-check score is a simple illustrative self-check, not a professional
          assessment. Not financial advice.
        </p>
      </Disclaimer>

      <div className="faq-section">
        <h2 className="faq-title">Common questions about retirement planning in Singapore</h2>
        <details className="faq-item">
          <summary>Which CPF LIFE plan should I choose?</summary>
          <p>
            Standard gives you the highest steady monthly payout with a smaller bequest — good if maximising
            lifetime income is your priority. Basic pays less but leaves the largest inheritance for your
            beneficiaries. Escalating starts lowest but grows 2% every year, which can overtake Standard's payout
            after a decade or more — worth considering if you expect a long retirement. The choice is locked 12
            months after joining, so compare carefully first.
          </p>
        </details>
        <details className="faq-item">
          <summary>How much should I have in my CPF Retirement Account?</summary>
          <p>
            CPF Board publishes three reference sums: Basic (BRS), Full (FRS), and Enhanced (ERS) Retirement Sum.
            FRS is the default most people aim for. BRS works if you're pledging your property (or already own
            one) — you can set aside less and withdraw the rest as cash at 55. ERS gets you the highest CPF LIFE
            payout if you have the savings to reach it.
          </p>
        </details>
        <details className="faq-item">
          <summary>What is RSTU and is it worth doing?</summary>
          <p>
            The Retirement Sum Topping-Up Scheme lets you voluntarily add cash to your SA/RA, earning a guaranteed
            4% p.a. and up to $8,000/year in tax relief ($16,000/year combined with topping up a loved one's
            account). It's generally worth it if you're confident you won't need that cash before retirement — CPF
            top-ups are locked in and can't be withdrawn early.
          </p>
        </details>
        <details className="faq-item">
          <summary>What if I live longer than expected?</summary>
          <p>
            This is exactly why CPF LIFE exists — it pays for as long as you live, regardless of how long your CPF
            balance would otherwise last. For savings and investments outside CPF, try increasing "Years in
            retirement" above (e.g. to 30 or 35) to see how much more you'd need to fund a longer retirement from
            your own savings.
          </p>
        </details>
        <details className="faq-item">
          <summary>How accurate is this retirement projection?</summary>
          <p>
            It's a planning tool, not a guarantee — it assumes a constant investment return and inflation rate
            every year, which real markets never actually deliver. Treat the output as a reasonable ballpark to
            guide saving decisions, not a precise forecast, and revisit it periodically as your actual numbers
            change.
          </p>
        </details>
      </div>

      {/* Rendered off-screen (not display:none, so html2canvas can lay it out) purely so the
          Premium Report generator can capture it and fold it in as an appendix. */}
      <div style={{ position: "fixed", top: 0, left: -99999, pointerEvents: "none" }} aria-hidden="true">
        <div ref={dashboardExportRef}>
          <RetirementDashboardExportCard data={dashboardExportData} />
        </div>
      </div>
    </CalcShell>
  );
}
