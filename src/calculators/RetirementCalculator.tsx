import { useMemo, useState } from "react";
import { CalcShell, Disclaimer, NumberField, ResultCard, ResultRow } from "../components/CalcShell";
import { calculateRetirement, formatSgd } from "../lib/cpf";
import { usePageMeta } from "../lib/usePageMeta";
import { clearCalculatorData, loadCalculatorData, saveCalculatorData } from "../lib/storage";
import { downloadCalculatorPdf } from "../lib/pdf";

const DEFAULTS = {
  currentAge: 45,
  retirementAge: 65,
  currentSavings: 200000,
  currentCpfRetirement: 120000,
  monthlyInvestment: 1000,
  expectedReturnPct: 4,
  desiredMonthlySpend: 3000,
};

const STORAGE_KEY = "retirement-calculator";

export default function RetirementCalculator() {
  usePageMeta(
    "Singapore Retirement Calculator",
    "Free retirement calculator for Singapore. See if your savings, CPF and monthly investments are on track to meet your target retirement income, and what to change if they're not."
  );
  const saved = loadCalculatorData<typeof DEFAULTS>(STORAGE_KEY);
  const initial = saved?.data ?? DEFAULTS;

  const [currentAge, setCurrentAge] = useState(initial.currentAge);
  const [retirementAge, setRetirementAge] = useState(initial.retirementAge);
  const [currentSavings, setCurrentSavings] = useState(initial.currentSavings);
  const [currentCpfRetirement, setCurrentCpfRetirement] = useState(initial.currentCpfRetirement);
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
        currentCpfRetirement,
        monthlyInvestment,
        expectedReturnPct,
        desiredMonthlySpend,
      }),
    [currentAge, retirementAge, currentSavings, currentCpfRetirement, monthlyInvestment, expectedReturnPct, desiredMonthlySpend]
  );

  const clearInputs = () => {
    setCurrentAge(DEFAULTS.currentAge);
    setRetirementAge(DEFAULTS.retirementAge);
    setCurrentSavings(DEFAULTS.currentSavings);
    setCurrentCpfRetirement(DEFAULTS.currentCpfRetirement);
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
      currentCpfRetirement,
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
        { label: "Current CPF retirement savings", value: formatSgd(currentCpfRetirement) },
        { label: "Monthly investment", value: formatSgd(monthlyInvestment) },
        { label: "Expected annual return", value: `${expectedReturnPct}%` },
        { label: "Desired retirement spending", value: `${formatSgd(desiredMonthlySpend)}/mo` },
      ],
      results: [
        { label: "Years remaining", value: `${result.yearsToRetirement} years` },
        { label: "Projected savings at retirement", value: formatSgd(result.projectedSavings) },
        { label: "Target required", value: formatSgd(result.targetRequired) },
        {
          label: result.onTrack ? "Surplus" : "Shortfall",
          value: formatSgd(Math.abs(result.shortfall)),
        },
        ...(!result.onTrack
          ? [{ label: "Increase monthly savings to", value: formatSgd(result.suggestedMonthlySavings) }]
          : []),
      ],
      disclaimer:
        "Assumes 25 years in retirement and steady returns — actual markets fluctuate. Does not include CPF LIFE payouts, which depend on your Retirement Sum tier. Not financial advice.",
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
        <NumberField label="Current CPF retirement savings" value={currentCpfRetirement} onChange={setCurrentCpfRetirement} prefix="$" step={1000} />
        <NumberField label="Monthly investment" value={monthlyInvestment} onChange={setMonthlyInvestment} prefix="$" step={100} />
        <NumberField label="Expected annual return" value={expectedReturnPct} onChange={setExpectedReturnPct} suffix="%" step={0.5} />
        <NumberField label="Desired retirement spending" value={desiredMonthlySpend} onChange={setDesiredMonthlySpend} prefix="$" suffix="/mo" step={100} />
      </div>

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

      <Disclaimer>
        Assumes 25 years in retirement and steady returns — actual markets fluctuate. Does not include CPF LIFE
        payouts, which depend on your Retirement Sum tier. Not financial advice.
      </Disclaimer>
    </CalcShell>
  );
}
