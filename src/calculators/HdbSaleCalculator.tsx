import { useMemo, useState } from "react";
import { CalcShell, Disclaimer, NumberField, ResultCard, ResultRow, BtoPromo } from "../components/CalcShell";
import { calculateHdbSaleProceeds, formatSgd } from "../lib/cpf";
import { usePageMeta } from "../lib/usePageMeta";

const DEFAULTS = {
  sellingPrice: 650000,
  outstandingLoan: 80000,
  cpfPrincipalUsed: 180000,
  cpfAccruedInterest: 115000,
  agentCommissionPct: 2,
  otherCosts: 2500,
};

export default function HdbSaleCalculator() {
  usePageMeta(
    "HDB Sale Proceeds Calculator",
    "Free HDB sale proceeds calculator for Singapore. Estimate your cash proceeds after CPF refund, outstanding loan, agent commission and other costs when selling your HDB flat."
  );
  const [sellingPrice, setSellingPrice] = useState(DEFAULTS.sellingPrice);
  const [outstandingLoan, setOutstandingLoan] = useState(DEFAULTS.outstandingLoan);
  const [cpfPrincipalUsed, setCpfPrincipalUsed] = useState(DEFAULTS.cpfPrincipalUsed);
  const [cpfAccruedInterest, setCpfAccruedInterest] = useState(DEFAULTS.cpfAccruedInterest);
  const [agentCommissionPct, setAgentCommissionPct] = useState(DEFAULTS.agentCommissionPct);
  const [otherCosts, setOtherCosts] = useState(DEFAULTS.otherCosts);

  const result = useMemo(
    () =>
      calculateHdbSaleProceeds({
        sellingPrice,
        outstandingLoan,
        cpfPrincipalUsed,
        cpfAccruedInterest,
        agentCommissionPct,
        otherCosts,
      }),
    [sellingPrice, outstandingLoan, cpfPrincipalUsed, cpfAccruedInterest, agentCommissionPct, otherCosts]
  );

  const clearInputs = () => {
    setSellingPrice(DEFAULTS.sellingPrice);
    setOutstandingLoan(DEFAULTS.outstandingLoan);
    setCpfPrincipalUsed(DEFAULTS.cpfPrincipalUsed);
    setCpfAccruedInterest(DEFAULTS.cpfAccruedInterest);
    setAgentCommissionPct(DEFAULTS.agentCommissionPct);
    setOtherCosts(DEFAULTS.otherCosts);
  };

  return (
    <CalcShell
      title="🏠 HDB Sale Proceeds Calculator"
      subtitle="See how much cash you'll walk away with after selling your HDB flat."
      onClear={clearInputs}
    >
      <div className="form-grid">
        <NumberField label="Estimated selling price" value={sellingPrice} onChange={setSellingPrice} prefix="$" step={1000} />
        <NumberField label="Outstanding HDB/bank loan" value={outstandingLoan} onChange={setOutstandingLoan} prefix="$" step={1000} />
        <NumberField label="CPF principal used" value={cpfPrincipalUsed} onChange={setCpfPrincipalUsed} prefix="$" step={1000} />
        <NumberField label="CPF accrued interest" value={cpfAccruedInterest} onChange={setCpfAccruedInterest} prefix="$" step={1000} />
        <NumberField label="Agent commission" value={agentCommissionPct} onChange={setAgentCommissionPct} suffix="%" step={0.5} />
        <NumberField label="Legal / other costs" value={otherCosts} onChange={setOtherCosts} prefix="$" step={100} />
      </div>

      <ResultCard title="Estimated HDB Sale">
        <ResultRow label="Selling Price" value={formatSgd(result.sellingPrice)} />
        <ResultRow label="Outstanding Loan" value={`-${formatSgd(result.outstandingLoan)}`} positive={false} />
        <ResultRow label="CPF Refund" value={`-${formatSgd(result.cpfRefund)}`} positive={false} />
        <ResultRow label="Agent Fee" value={`-${formatSgd(result.agentFee)}`} positive={false} />
        <ResultRow label="Other Costs" value={`-${formatSgd(result.otherCosts)}`} positive={false} />
        <ResultRow label="ESTIMATED CASH PROCEEDS" value={formatSgd(result.cashProceeds)} emphasis positive={result.cashProceeds >= 0} />
      </ResultCard>

      <ResultCard title="Where did the money go?">
        {result.breakdown.map((b) => (
          <ResultRow key={b.label} label={b.label} value={`${formatSgd(b.amount)}  (${b.pct.toFixed(0)}%)`} />
        ))}
      </ResultCard>

      <BtoPromo
        title="Selling to upgrade to a BTO?"
        desc="Check eligibility, timelines and flat selection with our BTO Planning Tool."
      />

      <Disclaimer>
        Simplified estimate. Actual proceeds depend on your exact CPF withdrawal history, resale levy (if any), and
        HDB/bank documentation at point of sale. Verify with HDB and CPF Board before making decisions.
      </Disclaimer>
    </CalcShell>
  );
}
