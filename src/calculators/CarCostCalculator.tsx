import { useEffect, useMemo, useRef, useState } from "react";
import { BtoPromo, CalcShell, Disclaimer, NumberField, ResultCard, ResultRow } from "../components/CalcShell";
import { NextStep } from "../components/NextStep";
import { calculateCarCost, formatSgd } from "../lib/cpf";
import { usePageMeta } from "../lib/usePageMeta";
import { clearCalculatorData, loadCalculatorData, saveCalculatorData } from "../lib/storage";
import { downloadCalculatorPdf } from "../lib/pdf";
import { trackEvent } from "../lib/analytics";

const CALCULATOR_ID = "car-cost-calculator";

const STORAGE_KEY = "car-cost-calculator";

const DEFAULTS = {
  carPrice: 160000,
  downpayment: 60000,
  loanAmount: 100000,
  loanYears: 7,
  interestRatePct: 2.78,
  monthlyPetrol: 300,
  monthlyParking: 150,
  monthlyErp: 80,
  annualInsurance: 1800,
  annualRoadTax: 740,
  annualMaintenance: 1200,
  monthlyGrabSpend: 800,
};

export default function CarCostCalculator() {
  usePageMeta(
    "Car True Cost Calculator Singapore",
    "Calculate the true monthly cost of owning a car in Singapore, including loan, petrol, parking, ERP, insurance, road tax and maintenance — plus how it compares to Grab."
  );
  const saved = loadCalculatorData<typeof DEFAULTS>(STORAGE_KEY);
  const initial = saved?.data ?? DEFAULTS;

  const [carPrice, setCarPrice] = useState(initial.carPrice);
  const [downpayment, setDownpayment] = useState(initial.downpayment);
  const [loanAmount, setLoanAmount] = useState(initial.loanAmount);
  const [loanYears, setLoanYears] = useState(initial.loanYears);
  const [interestRatePct, setInterestRatePct] = useState(initial.interestRatePct);
  const [monthlyPetrol, setMonthlyPetrol] = useState(initial.monthlyPetrol);
  const [monthlyParking, setMonthlyParking] = useState(initial.monthlyParking);
  const [monthlyErp, setMonthlyErp] = useState(initial.monthlyErp);
  const [annualInsurance, setAnnualInsurance] = useState(initial.annualInsurance);
  const [annualRoadTax, setAnnualRoadTax] = useState(initial.annualRoadTax);
  const [annualMaintenance, setAnnualMaintenance] = useState(initial.annualMaintenance);
  const [monthlyGrabSpend, setMonthlyGrabSpend] = useState(initial.monthlyGrabSpend);
  const [savedAt, setSavedAt] = useState<number | null>(saved?.savedAt ?? null);

  useEffect(() => {
    trackEvent("calculator_started", { calculator: CALCULATOR_ID });
  }, []);

  const initialSnapshot = useRef(initial);
  const hasCompletedOnce = useRef(false);

  const result = useMemo(
    () =>
      calculateCarCost({
        carPrice,
        downpayment,
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
      }),
    [carPrice, downpayment, loanAmount, loanYears, interestRatePct, monthlyPetrol, monthlyParking, monthlyErp, annualInsurance, annualRoadTax, annualMaintenance, monthlyGrabSpend]
  );

  useEffect(() => {
    const s = initialSnapshot.current;
    const changed =
      carPrice !== s.carPrice ||
      downpayment !== s.downpayment ||
      loanAmount !== s.loanAmount ||
      loanYears !== s.loanYears ||
      interestRatePct !== s.interestRatePct ||
      monthlyPetrol !== s.monthlyPetrol ||
      monthlyParking !== s.monthlyParking ||
      monthlyErp !== s.monthlyErp ||
      annualInsurance !== s.annualInsurance ||
      annualRoadTax !== s.annualRoadTax ||
      annualMaintenance !== s.annualMaintenance;
    if (!hasCompletedOnce.current && changed) {
      hasCompletedOnce.current = true;
      trackEvent("calculator_completed", { calculator: CALCULATOR_ID });
    }
  }, [carPrice, downpayment, loanAmount, loanYears, interestRatePct, monthlyPetrol, monthlyParking, monthlyErp, annualInsurance, annualRoadTax, annualMaintenance]);

  const clearInputs = () => {
    setCarPrice(DEFAULTS.carPrice);
    setDownpayment(DEFAULTS.downpayment);
    setLoanAmount(DEFAULTS.loanAmount);
    setLoanYears(DEFAULTS.loanYears);
    setInterestRatePct(DEFAULTS.interestRatePct);
    setMonthlyPetrol(DEFAULTS.monthlyPetrol);
    setMonthlyParking(DEFAULTS.monthlyParking);
    setMonthlyErp(DEFAULTS.monthlyErp);
    setAnnualInsurance(DEFAULTS.annualInsurance);
    setAnnualRoadTax(DEFAULTS.annualRoadTax);
    setAnnualMaintenance(DEFAULTS.annualMaintenance);
    setMonthlyGrabSpend(DEFAULTS.monthlyGrabSpend);
    clearCalculatorData(STORAGE_KEY);
    setSavedAt(null);
  };

  const handleSave = () => {
    const at = saveCalculatorData(STORAGE_KEY, {
      carPrice,
      downpayment,
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
    });
    setSavedAt(at);
  };

  const handleDownloadPdf = () => {
    downloadCalculatorPdf({
      calculatorTitle: "Car True Cost Calculator",
      inputs: [
        { label: "Car purchase price (incl. COE)", value: formatSgd(carPrice) },
        { label: "Downpayment", value: formatSgd(downpayment) },
        { label: "Loan amount", value: formatSgd(loanAmount) },
        { label: "Loan duration", value: `${loanYears} years` },
        { label: "Interest rate (flat)", value: `${interestRatePct}%` },
        { label: "Monthly petrol", value: formatSgd(monthlyPetrol) },
        { label: "Monthly parking", value: formatSgd(monthlyParking) },
        { label: "Monthly ERP", value: formatSgd(monthlyErp) },
        { label: "Annual insurance", value: formatSgd(annualInsurance) },
        { label: "Annual road tax", value: formatSgd(annualRoadTax) },
        { label: "Annual maintenance", value: formatSgd(annualMaintenance) },
        { label: "Average monthly Grab spending", value: formatSgd(monthlyGrabSpend) },
      ],
      results: [
        { label: "Loan", value: formatSgd(result.monthlyLoan) },
        { label: "Petrol", value: formatSgd(monthlyPetrol) },
        { label: "Parking", value: formatSgd(monthlyParking) },
        { label: "ERP", value: formatSgd(monthlyErp) },
        { label: "Insurance", value: formatSgd(result.monthlyInsurance) },
        { label: "Road Tax", value: formatSgd(result.monthlyRoadTax) },
        { label: "Maintenance", value: formatSgd(result.monthlyMaintenance) },
        { label: "True Monthly Cost", value: formatSgd(result.totalMonthly) },
        { label: "True Annual Cost", value: formatSgd(result.totalAnnual) },
        ...(result.grabComparison
          ? [
              { label: "Car (vs Grab)", value: `${formatSgd(result.grabComparison.carCost)}/month` },
              { label: "Grab", value: `${formatSgd(result.grabComparison.grabCost)}/month` },
              { label: "Grab saves you approximately", value: `${formatSgd(result.grabComparison.annualSavings)}/year` },
            ]
          : []),
      ],
      disclaimer:
        "Estimate only. Assumes a flat-rate car loan (typical for Singapore) and does not include depreciation, COE renewal, or resale value.",
    });
  };

  return (
    <CalcShell
      title="🚗 Car True Cost Calculator"
      subtitle="What does owning a car in Singapore really cost you each month?"
      onClear={clearInputs}
      onSave={handleSave}
      onDownloadPdf={handleDownloadPdf}
      savedAt={savedAt}
    >
      <div className="form-grid">
        <NumberField label="Car purchase price (incl. COE)" value={carPrice} onChange={setCarPrice} prefix="$" step={1000} />
        <NumberField label="Downpayment" value={downpayment} onChange={setDownpayment} prefix="$" step={1000} />
        <NumberField label="Loan amount" value={loanAmount} onChange={setLoanAmount} prefix="$" step={1000} />
        <NumberField label="Loan duration" value={loanYears} onChange={setLoanYears} suffix="years" />
        <NumberField label="Interest rate (flat)" value={interestRatePct} onChange={setInterestRatePct} suffix="%" step={0.01} />
        <NumberField label="Monthly petrol" value={monthlyPetrol} onChange={setMonthlyPetrol} prefix="$" />
        <NumberField label="Monthly parking" value={monthlyParking} onChange={setMonthlyParking} prefix="$" />
        <NumberField label="Monthly ERP" value={monthlyErp} onChange={setMonthlyErp} prefix="$" />
        <NumberField label="Annual insurance" value={annualInsurance} onChange={setAnnualInsurance} prefix="$" />
        <NumberField label="Annual road tax" value={annualRoadTax} onChange={setAnnualRoadTax} prefix="$" />
        <NumberField label="Annual maintenance" value={annualMaintenance} onChange={setAnnualMaintenance} prefix="$" />
      </div>

      <ResultCard title="Your Car Really Costs">
        <ResultRow label="Loan" value={formatSgd(result.monthlyLoan)} />
        <ResultRow label="Petrol" value={formatSgd(monthlyPetrol)} />
        <ResultRow label="Parking" value={formatSgd(monthlyParking)} />
        <ResultRow label="ERP" value={formatSgd(monthlyErp)} />
        <ResultRow label="Insurance" value={formatSgd(result.monthlyInsurance)} />
        <ResultRow label="Road Tax" value={formatSgd(result.monthlyRoadTax)} />
        <ResultRow label="Maintenance" value={formatSgd(result.monthlyMaintenance)} />
        <ResultRow label="TRUE MONTHLY COST" value={formatSgd(result.totalMonthly)} emphasis />
        <ResultRow label="TRUE ANNUAL COST" value={formatSgd(result.totalAnnual)} />
      </ResultCard>

      <ResultCard title="🚕 Car vs Grab">
        <NumberField label="Your average monthly Grab spending" value={monthlyGrabSpend} onChange={setMonthlyGrabSpend} prefix="$" />
        {result.grabComparison && (
          <>
            <ResultRow label="Car" value={`${formatSgd(result.grabComparison.carCost)}/month`} />
            <ResultRow label="Grab" value={`${formatSgd(result.grabComparison.grabCost)}/month`} />
            <ResultRow
              label="Grab saves you approximately"
              value={`${formatSgd(result.grabComparison.annualSavings)}/year`}
              emphasis
              positive={result.grabComparison.annualSavings >= 0}
            />
          </>
        )}
      </ResultCard>

      <NextStep calculatorId={CALCULATOR_ID} prompt="Reduce your car expenses" />

      <BtoPromo />

      <Disclaimer>
        Estimate only. Assumes a flat-rate car loan (typical for Singapore) and does not include depreciation, COE
        renewal, or resale value.
      </Disclaimer>
    </CalcShell>
  );
}
