import { useMemo, useState } from "react";
import { CalcShell, Disclaimer, NumberField, ResultCard, ResultRow } from "../components/CalcShell";
import { CPF_LIFE_STANDARD_PAYOUT_2026, CPF_RETIREMENT_SUMS_2026, calculateRetirement, formatSgd } from "../lib/cpf";
import { usePageMeta } from "../lib/usePageMeta";
import { clearCalculatorData, loadCalculatorData, saveCalculatorData } from "../lib/storage";
import { downloadCalculatorPdf } from "../lib/pdf";

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
};

const STORAGE_KEY = "retirement-calculator";

export default function RetirementCalculator() {
  usePageMeta(
    "Singapore Retirement Calculator",
    "Free retirement calculator for Singapore. See if your savings, CPF (OA/MA/SA-RA) and monthly investments are on track to meet your target retirement income, plus an estimated CPF LIFE monthly payout."
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
  const [savedAt, setSavedAt] = useState<number | null>(saved?.savedAt ?? null);

  const result = useMemo(
    () =>
      calculateRetirement({
        currentAge,
        retirementAge,
        currentSavings,
        currentOA,
        currentSaRa,
        currentMA,
        monthlyInvestment,
        expectedReturnPct,
        desiredMonthlySpend,
      }),
    [
      currentAge,
      retirementAge,
      currentSavings,
      currentOA,
      currentSaRa,
      currentMA,
      monthlyInvestment,
      expectedReturnPct,
      desiredMonthlySpend,
    ]
  );

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
        { label: "Desired retirement spending", value: `${formatSgd(desiredMonthlySpend)}/mo` },
      ],
      results: [
        { label: "Years remaining", value: `${result.yearsToRetirement} years` },
        { label: "Projected cash & investments", value: formatSgd(result.projectedCash) },
        { label: "Projected CPF OA", value: formatSgd(result.projectedOA) },
        { label: "Projected CPF SA/RA", value: formatSgd(result.projectedSaRa) },
        { label: "Projected CPF MediSave (not counted, healthcare only)", value: formatSgd(result.projectedMA) },
        { label: "Total counted toward retirement income", value: formatSgd(result.projectedSavings) },
        { label: "Target required", value: formatSgd(result.targetRequired) },
        {
          label: result.onTrack ? "Surplus" : "Shortfall",
          value: formatSgd(Math.abs(result.shortfall)),
        },
        ...(!result.onTrack
          ? [{ label: "Increase monthly savings to", value: formatSgd(result.suggestedMonthlySavings) }]
          : []),
        { label: "Projected OA + SA/RA at retirement (capped at ERS)", value: formatSgd(result.cpfLife.retirementAccountBalance) },
        { label: "Estimated CPF LIFE Standard Plan payout (from 65)", value: `${formatSgd(result.cpfLife.estimatedMonthlyPayout)}/mo` },
      ],
      disclaimer:
        "Assumes 25 years in retirement and steady investment returns — actual markets fluctuate. CPF OA/SA/MediSave balances are projected at CPF's floor interest rates (OA 2.5%, SA/MA/RA 4%) with no further CPF contributions modelled. CPF LIFE payout is an indicative Standard Plan estimate for the 2026 cohort, interpolated between CPF Board's published BRS/FRS/ERS figures — actual payouts depend on your plan choice, gender, cohort and prevailing rates. Not financial advice.",
    });
  };

  return (
    <CalcShell
      title="👴 Retirement Calculator"
      subtitle="Are you on track to retire comfortably in Singapore?"
      onClear={clearInputs}
      onSave={handleSave}
      onDownloadPdf={handleDownloadPdf}
      savedAt={savedAt}
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
      </div>

      <ResultCard title="Projected Balances at Retirement">
        <ResultRow label="Cash & investments" value={formatSgd(result.projectedCash)} />
        <ResultRow label="CPF OA" value={formatSgd(result.projectedOA)} />
        <ResultRow label="CPF SA/RA" value={formatSgd(result.projectedSaRa)} />
        <ResultRow label="COUNTED TOWARD RETIREMENT INCOME" value={formatSgd(result.projectedSavings)} emphasis />
        <ResultRow label="CPF MediSave (kept for healthcare, not counted)" value={formatSgd(result.projectedMA)} />
      </ResultCard>

      <ResultCard title="Your Retirement Outlook">
        <ResultRow label="Years remaining" value={`${result.yearsToRetirement} years`} />
        <ResultRow label="Projected savings at retirement" value={formatSgd(result.projectedSavings)} />
        <ResultRow label="Target required" value={formatSgd(result.targetRequired)} />
        <ResultRow
          label={result.onTrack ? "SURPLUS" : "SHORTFALL"}
          value={formatSgd(Math.abs(result.shortfall))}
          emphasis
          positive={result.onTrack}
        />
      </ResultCard>

      {!result.onTrack && (
        <ResultCard title="Ways to close the gap">
          <ResultRow label="Increase monthly savings to" value={formatSgd(result.suggestedMonthlySavings)} />
        </ResultCard>
      )}

      <ResultCard title="🏦 CPF LIFE Estimate (from age 65)">
        <ResultRow
          label="Projected OA + SA/RA at 65 (capped at ERS)"
          value={formatSgd(result.cpfLife.retirementAccountBalance)}
        />
        <ResultRow
          label="ESTIMATED MONTHLY PAYOUT"
          value={`${formatSgd(result.cpfLife.estimatedMonthlyPayout)}/mo`}
          emphasis
          positive
        />
        <p className="explainer">
          Based on the CPF LIFE Standard Plan, using CPF Board's published 2026 retirement sum tiers below as
          reference points. Your OA and SA/RA typically combine into your Retirement Account at age 55 — this
          estimate assumes that happens and is capped at the Enhanced Retirement Sum, since that's the most CPF
          allows you to set aside.
        </p>
        <div className="cpf-life-tiers">
          <div className="cpf-life-tier">
            <span className="cpf-life-tier-name">BRS</span>
            <span>{formatSgd(CPF_RETIREMENT_SUMS_2026.brs)}</span>
            <span className="cpf-life-tier-payout">~{formatSgd(CPF_LIFE_STANDARD_PAYOUT_2026.brs)}/mo</span>
          </div>
          <div className="cpf-life-tier">
            <span className="cpf-life-tier-name">FRS</span>
            <span>{formatSgd(CPF_RETIREMENT_SUMS_2026.frs)}</span>
            <span className="cpf-life-tier-payout">~{formatSgd(CPF_LIFE_STANDARD_PAYOUT_2026.frs)}/mo</span>
          </div>
          <div className="cpf-life-tier">
            <span className="cpf-life-tier-name">ERS</span>
            <span>{formatSgd(CPF_RETIREMENT_SUMS_2026.ers)}</span>
            <span className="cpf-life-tier-payout">~{formatSgd(CPF_LIFE_STANDARD_PAYOUT_2026.ers)}/mo</span>
          </div>
        </div>
      </ResultCard>

      <Disclaimer>
        Assumes 25 years in retirement and steady investment returns — actual markets fluctuate. CPF OA/SA/MediSave
        balances are projected at CPF's floor interest rates (OA 2.5%, SA/MA/RA 4%) with no further CPF
        contributions modelled between now and retirement. The CPF LIFE payout is an indicative Standard Plan
        estimate for the 2026 cohort, interpolated between CPF Board's published BRS/FRS/ERS figures — actual
        payouts depend on your plan choice (Standard/Basic/Escalating), gender, cohort and prevailing interest
        rates. For a personalised figure, use the official CPF LIFE Estimator on the CPF Board website. Not
        financial advice.
      </Disclaimer>
    </CalcShell>
  );
}
