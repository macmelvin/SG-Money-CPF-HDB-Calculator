import { useMemo, useState } from "react";
import { CalcShell, Disclaimer, NumberField, ResultCard, ResultRow } from "../components/CalcShell";
import { calculateRetirement, formatSgd } from "../lib/cpf";
import { usePageMeta } from "../lib/usePageMeta";

const DEFAULTS = {
  currentAge: 45,
  retirementAge: 65,
  currentSavings: 200000,
  currentCpfRetirement: 120000,
  monthlyInvestment: 1000,
  expectedReturnPct: 4,
  desiredMonthlySpend: 3000,
};

export default function RetirementCalculator() {
  usePageMeta(
    "Singapore Retirement Calculator",
    "Free retirement calculator for Singapore. See if your savings, CPF and monthly investments are on track to meet your target retirement income, and what to change if they're not."
  );
  const [currentAge, setCurrentAge] = useState(DEFAULTS.currentAge);
  const [retirementAge, setRetirementAge] = useState(DEFAULTS.retirementAge);
  const [currentSavings, setCurrentSavings] = useState(DEFAULTS.currentSavings);
  const [currentCpfRetirement, setCurrentCpfRetirement] = useState(DEFAULTS.currentCpfRetirement);
  const [monthlyInvestment, setMonthlyInvestment] = useState(DEFAULTS.monthlyInvestment);
  const [expectedReturnPct, setExpectedReturnPct] = useState(DEFAULTS.expectedReturnPct);
  const [desiredMonthlySpend, setDesiredMonthlySpend] = useState(DEFAULTS.desiredMonthlySpend);

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
  };

  return (
    <CalcShell
      title="👴 Retirement Calculator"
      subtitle="Are you on track to retire comfortably in Singapore?"
      onClear={clearInputs}
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
