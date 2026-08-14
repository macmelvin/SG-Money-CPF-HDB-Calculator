import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BtoPromo, CalcShell, Disclaimer, DocToolsPromo, NumberField, ResultCard, ResultRow } from "../components/CalcShell";
import { AssetAllocationBar, EditableLineItems, HealthBadge } from "../components/Dashboard";
import { RetirementDashboardExportCard } from "../components/RetirementDashboardExport";
import type { DashboardExportData } from "../components/RetirementDashboardExport";
import { downloadNodeAsImage } from "../lib/dashboardImage";
import {
  CPF_LIFE_STANDARD_PAYOUT_2026,
  CPF_RETIREMENT_SUMS_2026,
  calculateHdbSaleProceeds,
  calculateRetirement,
  formatSgd,
} from "../lib/cpf";
import type { CpfLifeTargetTier, HdbSaleInput } from "../lib/cpf";
import {
  computeHealthCheck,
  computeNetWorth,
  computeRightsizing,
  sumLineItems,
} from "../lib/dashboard";
import type { LineItem } from "../lib/dashboard";
import { usePageMeta } from "../lib/usePageMeta";
import { clearCalculatorData, loadCalculatorData, saveCalculatorData } from "../lib/storage";
import { downloadCalculatorPdf } from "../lib/pdf";
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
};

const CPF_LIFE_TIER_LABEL: Record<CpfLifeTargetTier, string> = {
  brs: "Basic Retirement Sum (BRS)",
  frs: "Full Retirement Sum (FRS)",
  ers: "Enhanced Retirement Sum (ERS)",
};

const STORAGE_KEY = "retirement-calculator";
// Must match the storage key HdbSaleCalculator.tsx saves under.
const HDB_SALE_STORAGE_KEY = "hdb-sale-proceeds";

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
  const [isGeneratingDashboard, setIsGeneratingDashboard] = useState(false);
  const dashboardExportRef = useRef<HTMLDivElement>(null);
  const [premiumUnlocked, setPremiumUnlocked] = useState(() => isPremiumReportUnlocked());

  // If we just got redirected back here from a successful Stripe payment
  // (?unlocked=true), persist the unlock and clean the URL up.
  useEffect(() => {
    if (consumeUnlockRedirect()) {
      setPremiumUnlocked(true);
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

  // Pull whatever the user last saved in the HDB Sale Proceeds calculator (if anything) so this
  // page can offer a "what if I sold today" scenario without asking them to re-enter numbers.
  const savedHdb = loadCalculatorData<HdbSaleInput>(HDB_SALE_STORAGE_KEY);
  const hdbScenario = savedHdb?.data ? calculateHdbSaleProceeds(savedHdb.data) : null;
  const applyHdbScenario = includeHdbSale && hdbScenario !== null;
  const effectiveOA = currentOA + (applyHdbScenario ? hdbScenario.cpfRefund : 0);
  const effectiveSavings = currentSavings + (applyHdbScenario ? hdbScenario.cashProceeds : 0);

  // Total value of the Net Worth Snapshot's investment/insurance holdings — computed here (ahead of the
  // projection below) so it can optionally be grown and counted toward "how much you'll have at retirement."
  const totalInvestmentsPortfolio = sumLineItems(investmentItems);
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
    ]
  );

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
    cpfFrs: CPF_RETIREMENT_SUMS_2026.frs,
    cpfBrs: CPF_RETIREMENT_SUMS_2026.brs,
    cpfErs: CPF_RETIREMENT_SUMS_2026.ers,
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
    });
    setSavedAt(at);
  };

  const handleDownloadPdf = () => {
    downloadCalculatorPdf({
      calculatorTitle: "Retirement Calculator",
      inputs: [
        { label: "Current age", value: String(currentAge) },
        { label: "Target retirement age", value: String(retirementAge) },
        { label: "Current savings (cash/investments)", value: formatSgd(currentSavings) },
        { label: "Current CPF Ordinary Account (OA)", value: formatSgd(currentOA) },
        { label: "Current CPF Special/Retirement Account (SA/RA)", value: formatSgd(currentSaRa) },
        { label: "Current CPF MediSave (MA)", value: formatSgd(currentMA) },
        { label: "Monthly investment", value: formatSgd(monthlyInvestment) },
        { label: "Expected annual return (cash/investments)", value: `${expectedReturnPct}%` },
        { label: "Desired retirement spending (today's dollars)", value: `${formatSgd(desiredMonthlySpend)}/mo` },
        { label: "Expected inflation rate", value: `${inflationRatePct}%` },
        ...(applyHdbScenario
          ? [
              { label: "Includes selling HDB today: CPF refund added to OA", value: `+${formatSgd(hdbScenario.cpfRefund)}` },
              { label: "Includes selling HDB today: cash added to savings", value: `+${formatSgd(hdbScenario.cashProceeds)}` },
            ]
          : []),
      ],
      results: [
        { label: "Years remaining", value: `${result.yearsToRetirement} years` },
        { label: "Projected cash & investments", value: formatSgd(result.projectedCash) },
        { label: "Projected CPF OA", value: formatSgd(result.projectedOA) },
        { label: "Projected CPF SA/RA", value: formatSgd(result.projectedSaRa) },
        {
          label: includeInvestmentHoldings
            ? "Projected investment & insurance holdings (grown)"
            : "Projected investment & insurance holdings (not included)",
          value: formatSgd(result.projectedInvestmentHoldings),
        },
        { label: "Projected CPF MediSave (not counted, healthcare only)", value: formatSgd(result.projectedMA) },
        { label: "Total counted toward retirement income", value: formatSgd(result.projectedSavings) },
        {
          label: `Desired spending at retirement (${inflationRatePct}%/yr inflation)`,
          value: `${formatSgd(result.desiredMonthlySpendAtRetirement)}/mo`,
        },
        { label: "Target required (inflation-adjusted)", value: formatSgd(result.targetRequired) },
        {
          label: result.onTrack ? "Surplus" : "Shortfall",
          value: formatSgd(Math.abs(result.shortfall)),
        },
        ...(!result.onTrack
          ? [{ label: "Increase monthly savings to", value: formatSgd(result.suggestedMonthlySavings) }]
          : []),
        {
          label: `Retirement Account target: ${CPF_LIFE_TIER_LABEL[cpfLifeTargetTier]}`,
          value: formatSgd(CPF_RETIREMENT_SUMS_2026[cpfLifeTargetTier]),
        },
        { label: "Projected OA + SA/RA set aside in RA", value: formatSgd(result.cpfLife.retirementAccountBalance) },
        { label: "Estimated CPF LIFE Standard Plan payout (from 65)", value: `${formatSgd(result.cpfLife.estimatedMonthlyPayout)}/mo` },
        ...(result.cpfLifeExcessCash > 0
          ? [{ label: "Estimated cash withdrawable at 55 (above chosen tier)", value: formatSgd(result.cpfLifeExcessCash) }]
          : []),
        { label: "— Net Worth Snapshot —", value: "" },
        { label: "HDB Property", value: formatSgd(hdbCurrentValue) },
        { label: "Total CPF (OA+SA/RA+MediSave)", value: formatSgd(totalCpfToday) },
        ...investmentItems.map((item) => ({ label: `  Investment: ${item.label || "(unlabelled)"}`, value: formatSgd(item.amount) })),
        { label: "Total Investments & Insurance", value: formatSgd(totalInvestmentsPortfolio) },
        { label: "TOTAL NET WORTH", value: formatSgd(netWorth) },
        { label: "— Monthly Cash Flow —", value: "" },
        ...incomeItems.map((item) => ({ label: `  Income: ${item.label || "(unlabelled)"}`, value: formatSgd(item.amount) })),
        ...expenseItems.map((item) => ({ label: `  Expense: ${item.label || "(unlabelled)"}`, value: formatSgd(item.amount) })),
        ...liabilityItems.map((item) => ({ label: `  Liability: ${item.label || "(unlabelled)"}`, value: formatSgd(item.amount) })),
        { label: "Total Income", value: formatSgd(totalIncome) },
        { label: "Total Expenses", value: formatSgd(totalExpenses) },
        { label: "Total Liabilities", value: formatSgd(totalLiabilities) },
        { label: monthlySurplus >= 0 ? "Monthly Surplus" : "Monthly Deficit", value: formatSgd(Math.abs(monthlySurplus)) },
        ...(rightsizing
          ? [
              { label: "— Rightsizing Scenario —", value: "" },
              { label: "Estimated sale proceeds", value: formatSgd(hdbCurrentValue) },
              { label: "Less: CPF refund", value: `-${formatSgd(hdbScenario!.cpfRefund)}` },
              { label: "Balance after CPF refund", value: formatSgd(rightsizing.balanceAfterCpfRefund) },
              { label: "Less: replacement flat price", value: `-${formatSgd(replacementFlatPrice)}` },
              { label: "Less: legal & moving costs", value: `-${formatSgd(legalMovingCosts)}` },
              { label: "Cash released from rightsizing", value: formatSgd(rightsizing.cashReleased) },
              { label: "Estimated financial assets after rightsizing", value: formatSgd(estimatedAssetsAfterRightsizing ?? 0) },
            ]
          : []),
        { label: "— Retirement Health Check —", value: "" },
        ...healthCheck.dimensions.map((d) => ({ label: d.label, value: d.status })),
        { label: "Overall illustrative score", value: `${healthCheck.overallScore}/100` },
      ],
      disclaimer:
        "Assumes 25 years in retirement and steady investment returns — actual markets fluctuate. CPF OA/SA/MediSave balances are projected at CPF's floor interest rates (OA 2.5%, SA/MA/RA 4%) with no further CPF contributions modelled. CPF LIFE payout is an indicative Standard Plan estimate for the 2026 cohort, interpolated between CPF Board's published BRS/FRS/ERS figures. The net worth, cash flow, rightsizing and health-check figures are computed only from what you typed in on this device — nothing is verified or fetched. The health check score is an illustrative self-check using simple rules of thumb, not a professional financial assessment. Not financial advice.",
    });
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

  const handleDownloadDashboard = async () => {
    if (!dashboardExportRef.current || isGeneratingDashboard) return;
    setIsGeneratingDashboard(true);
    try {
      await downloadNodeAsImage(dashboardExportRef.current, "sg-money-retirement-dashboard.png");
    } catch (err) {
      console.error("Could not generate the dashboard image", err);
      window.alert("Sorry, something went wrong generating the dashboard image. Please try again.");
    } finally {
      setIsGeneratingDashboard(false);
    }
  };

  const handleDownloadPremiumReport = () => {
    try {
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
        },
        result,
        cpfLifeTargetTier,
      });
    } catch (err) {
      console.error("Could not generate the premium report", err);
      window.alert("Sorry, something went wrong generating your report. Please try again.");
    }
  };

  return (
    <CalcShell
      title="👴 Retirement Calculator"
      subtitle="Are you on track to retire comfortably in Singapore?"
      onClear={clearInputs}
      onSave={handleSave}
      onDownloadPdf={handleDownloadPdf}
      savedAt={savedAt}
      extraActions={
        <button type="button" className="dashboard-btn" onClick={handleDownloadDashboard} disabled={isGeneratingDashboard}>
          {isGeneratingDashboard ? "Generating…" : "📊 Dashboard"}
        </button>
      }
    >
      <div className="form-grid">
        <NumberField label="Current age" value={currentAge} onChange={setCurrentAge} />
        <NumberField label="Target retirement age" value={retirementAge} onChange={setRetirementAge} />
        <NumberField label="Current savings (cash/investments)" value={currentSavings} onChange={setCurrentSavings} prefix="$" step={1000} />
        <NumberField label="CPF Ordinary Account (OA)" value={currentOA} onChange={setCurrentOA} prefix="$" step={1000} />
        <NumberField label="CPF Special / Retirement Account (SA/RA)" value={currentSaRa} onChange={setCurrentSaRa} prefix="$" step={1000} />
        <NumberField label="CPF MediSave (MA)" value={currentMA} onChange={setCurrentMA} prefix="$" step={1000} />
        <NumberField label="Monthly investment" value={monthlyInvestment} onChange={setMonthlyInvestment} prefix="$" step={100} />
        <NumberField label="Expected annual return (cash/investments)" value={expectedReturnPct} onChange={setExpectedReturnPct} suffix="%" step={0.5} />
        <NumberField label="Desired retirement spending" value={desiredMonthlySpend} onChange={setDesiredMonthlySpend} prefix="$" suffix="/mo" step={100} />
        <NumberField label="Expected inflation rate" value={inflationRatePct} onChange={setInflationRatePct} suffix="%" step={0.5} />
      </div>

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
        />
        <ResultRow label="TOTAL NET WORTH" value={formatSgd(netWorth)} emphasis />
        <AssetAllocationBar slices={slices} />
      </ResultCard>

      <ResultCard title="💵 Monthly Cash Flow">
        <p className="explainer" style={{ marginTop: -2 }}>Income</p>
        <EditableLineItems items={incomeItems} onChange={setIncomeItems} addLabel="Add income source" placeholder="e.g. Salary" />
        <p className="explainer" style={{ marginTop: 14 }}>Expenses</p>
        <EditableLineItems items={expenseItems} onChange={setExpenseItems} addLabel="Add expense" placeholder="e.g. Insurance premium" />
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
            <ResultRow label="CPF refund → added to your OA" value={`+${formatSgd(hdbScenario.cpfRefund)}`} positive />
            <ResultRow label="Cash proceeds → added to your savings" value={`+${formatSgd(hdbScenario.cashProceeds)}`} positive />
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
          <p className="explainer">
            Save your numbers in the <Link to="/hdb-sale-proceeds">HDB Sale Proceeds calculator</Link> and
            they'll show up here as a "what if I sold today" scenario — the CPF refund gets added to your OA
            and the cash proceeds to your savings, plus you'll be able to model downsizing to a smaller flat.
          </p>
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

      <ResultCard title="💎 Premium Retirement Report">
        {premiumUnlocked ? (
          <>
            <p className="explainer" style={{ marginTop: -2 }}>
              Unlocked — download your personalized multi-page report: a written breakdown of where you stand,
              retirement-age and savings scenarios, a year-by-year growth projection, and a CPF LIFE tier
              comparison, all built from the numbers above.
            </p>
            <button type="button" className="dashboard-btn" onClick={handleDownloadPremiumReport}>
              📄 Download Premium Report
            </button>
          </>
        ) : (
          <>
            <p className="explainer" style={{ marginTop: -2 }}>
              Go deeper than the free outlook above: a written breakdown of where you stand, side-by-side
              scenarios for retiring earlier/later or saving more each month, a year-by-year growth projection,
              and a CPF LIFE tier comparison — all in one personalized PDF, generated on your device.
            </p>
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
              <span>{formatSgd(CPF_RETIREMENT_SUMS_2026[tier])}</span>
              <span className="cpf-life-tier-payout">~{formatSgd(CPF_LIFE_STANDARD_PAYOUT_2026[tier])}/mo</span>
            </button>
          ))}
        </div>
        <ResultRow
          label={`Set aside for ${CPF_LIFE_TIER_LABEL[cpfLifeTargetTier]}`}
          value={formatSgd(result.cpfLife.retirementAccountBalance)}
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
          Based on the CPF LIFE Standard Plan, using CPF Board's published 2026 retirement sum tiers above as
          reference points. Your OA and SA/RA typically combine into your Retirement Account at age 55 — this
          estimate assumes that happens, then caps at whichever tier you've selected above.
        </p>
      </ResultCard>

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

      {/* Rendered off-screen (not display:none, so html2canvas can lay it out) purely so the
          "📊 Dashboard" button can capture it as a PNG on demand. */}
      <div style={{ position: "fixed", top: 0, left: -99999, pointerEvents: "none" }} aria-hidden="true">
        <div ref={dashboardExportRef}>
          <RetirementDashboardExportCard data={dashboardExportData} />
        </div>
      </div>
    </CalcShell>
  );
}
