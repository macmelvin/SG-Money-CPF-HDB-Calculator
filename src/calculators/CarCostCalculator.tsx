import { useMemo, useState } from "react";
import { CalcShell, Disclaimer, NumberField, ResultCard, ResultRow } from "../components/CalcShell";
import { calculateCarCost, formatSgd } from "../lib/cpf";
import { usePageMeta } from "../lib/usePageMeta";

export default function CarCostCalculator() {
  usePageMeta(
    "Car True Cost Calculator Singapore",
    "Calculate the true monthly cost of owning a car in Singapore, including loan, petrol, parking, ERP, insurance, road tax and maintenance — plus how it compares to Grab."
  );
  const [carPrice, setCarPrice] = useState(160000);
  const [downpayment, setDownpayment] = useState(60000);
  const [loanAmount, setLoanAmount] = useState(100000);
  const [loanYears, setLoanYears] = useState(7);
  const [interestRatePct, setInterestRatePct] = useState(2.78);
  const [monthlyPetrol, setMonthlyPetrol] = useState(300);
  const [monthlyParking, setMonthlyParking] = useState(150);
  const [monthlyErp, setMonthlyErp] = useState(80);
  const [annualInsurance, setAnnualInsurance] = useState(1800);
  const [annualRoadTax, setAnnualRoadTax] = useState(740);
  const [annualMaintenance, setAnnualMaintenance] = useState(1200);
  const [monthlyGrabSpend, setMonthlyGrabSpend] = useState(800);

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

  return (
    <CalcShell title="🚗 Car True Cost Calculator" subtitle="What does owning a car in Singapore really cost you each month?">
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

      <Disclaimer>
        Estimate only. Assumes a flat-rate car loan (typical for Singapore) and does not include depreciation, COE
        renewal, or resale value.
      </Disclaimer>
    </CalcShell>
  );
}
