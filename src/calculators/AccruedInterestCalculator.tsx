import { useMemo, useState } from "react";
import { CalcShell, Disclaimer, NumberField, ResultCard, ResultRow } from "../components/CalcShell";
import { calculateAccruedInterest, formatSgd } from "../lib/cpf";

export default function AccruedInterestCalculator() {
  const currentYear = new Date().getFullYear();
  const [principal, setPrincipal] = useState(180000);
  const [yearFirstUsed, setYearFirstUsed] = useState(2010);

  const result = useMemo(
    () => calculateAccruedInterest({ principal, yearFirstUsed, currentYear }),
    [principal, yearFirstUsed, currentYear]
  );

  return (
    <CalcShell title="📈 CPF Accrued Interest Calculator" subtitle="Estimate how much CPF you'll need to refund when you sell your property.">
      <div className="form-grid">
        <NumberField label="CPF used for property" value={principal} onChange={setPrincipal} prefix="$" step={1000} />
        <NumberField label="Year CPF was first used" value={yearFirstUsed} onChange={setYearFirstUsed} step={1} />
      </div>

      <ResultCard>
        <ResultRow label="CPF Principal Used" value={formatSgd(result.principal)} />
        <ResultRow label={`Years accrued (${result.years} yrs)`} value="" />
        <ResultRow label="Estimated Accrued Interest" value={formatSgd(result.accruedInterest)} />
        <ResultRow label="ESTIMATED CPF REFUND" value={formatSgd(result.totalRefund)} emphasis />
      </ResultCard>

      <p className="explainer">
        Accrued interest is the interest your CPF savings would have earned (at the CPF Ordinary Account rate) had
        they stayed in your CPF account instead of being used for your property.
      </p>

      <Disclaimer>
        Simple estimate only — assumes a single lump-sum withdrawal compounded annually at 2.5%. Real CPF accrued
        interest is calculated per-withdrawal based on actual dates and prevailing rates, which can change over time.
        For an exact figure, check your CPF statement or myTax Portal.
      </Disclaimer>
    </CalcShell>
  );
}
