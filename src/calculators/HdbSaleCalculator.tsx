import { useEffect, useMemo, useRef, useState } from "react";
import { CalcShell, Disclaimer, NumberField, ResultCard, ResultRow, BtoPromo, SelectField } from "../components/CalcShell";
import { NextStep } from "../components/NextStep";
import { calculateHdbSaleProceeds, calculateResaleLevy, checkMop, formatSgd } from "../lib/cpf";
import type { FlatTypeForLevy } from "../lib/cpf";
import { usePageMeta } from "../lib/usePageMeta";
import { clearCalculatorData, loadCalculatorData, saveCalculatorData } from "../lib/storage";
import { downloadCalculatorPdf } from "../lib/pdf";
import { trackEvent } from "../lib/analytics";

const CALCULATOR_ID = "hdb-sale-proceeds";

const FLAT_TYPE_LABELS: Record<FlatTypeForLevy, string> = {
  "2-room": "2-Room",
  "3-room": "3-Room",
  "4-room": "4-Room",
  "5-room": "5-Room",
  executive: "Executive / Multi-Generation",
};

const DEFAULTS = {
  sellingPrice: 650000,
  outstandingLoan: 80000,
  cpfPrincipalUsed: 180000,
  cpfAccruedInterest: 115000,
  agentCommissionPct: 2,
  otherCosts: 2500,
  mopStartDate: "",
  buyingAnotherSubsidisedFlat: false,
  firstFlatType: "4-room" as FlatTypeForLevy,
  isSingleScheme: false,
};

const STORAGE_KEY = "hdb-sale-proceeds";

export default function HdbSaleCalculator() {
  usePageMeta(
    "HDB Sale Proceeds Calculator",
    "Free HDB sale proceeds calculator for Singapore. Estimate your cash proceeds after CPF refund, outstanding loan, agent commission and other costs when selling your HDB flat."
  );
  const saved = loadCalculatorData<typeof DEFAULTS>(STORAGE_KEY);
  const initial = saved?.data ?? DEFAULTS;

  const [sellingPrice, setSellingPrice] = useState(initial.sellingPrice);
  const [outstandingLoan, setOutstandingLoan] = useState(initial.outstandingLoan);
  const [cpfPrincipalUsed, setCpfPrincipalUsed] = useState(initial.cpfPrincipalUsed);
  const [cpfAccruedInterest, setCpfAccruedInterest] = useState(initial.cpfAccruedInterest);
  const [agentCommissionPct, setAgentCommissionPct] = useState(initial.agentCommissionPct);
  const [otherCosts, setOtherCosts] = useState(initial.otherCosts);
  const [mopStartDate, setMopStartDate] = useState(initial.mopStartDate ?? DEFAULTS.mopStartDate);
  const [buyingAnotherSubsidisedFlat, setBuyingAnotherSubsidisedFlat] = useState(
    initial.buyingAnotherSubsidisedFlat ?? DEFAULTS.buyingAnotherSubsidisedFlat
  );
  const [firstFlatType, setFirstFlatType] = useState<FlatTypeForLevy>(
    initial.firstFlatType ?? DEFAULTS.firstFlatType
  );
  const [isSingleScheme, setIsSingleScheme] = useState(initial.isSingleScheme ?? DEFAULTS.isSingleScheme);
  const [savedAt, setSavedAt] = useState<number | null>(saved?.savedAt ?? null);

  useEffect(() => {
    trackEvent("calculator_started", { calculator: CALCULATOR_ID });
  }, []);

  const initialSnapshot = useRef(initial);
  const hasCompletedOnce = useRef(false);

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

  const mopResult = useMemo(() => {
    if (!mopStartDate) return null;
    const parsed = new Date(mopStartDate);
    if (isNaN(parsed.getTime())) return null;
    return checkMop(parsed);
  }, [mopStartDate]);

  const resaleLevy = useMemo(
    () => (buyingAnotherSubsidisedFlat ? calculateResaleLevy(firstFlatType, isSingleScheme) : null),
    [buyingAnotherSubsidisedFlat, firstFlatType, isSingleScheme]
  );

  useEffect(() => {
    const s = initialSnapshot.current;
    const changed =
      sellingPrice !== s.sellingPrice ||
      outstandingLoan !== s.outstandingLoan ||
      cpfPrincipalUsed !== s.cpfPrincipalUsed ||
      cpfAccruedInterest !== s.cpfAccruedInterest ||
      agentCommissionPct !== s.agentCommissionPct ||
      otherCosts !== s.otherCosts;
    if (!hasCompletedOnce.current && changed) {
      hasCompletedOnce.current = true;
      trackEvent("calculator_completed", { calculator: CALCULATOR_ID });
    }
  }, [sellingPrice, outstandingLoan, cpfPrincipalUsed, cpfAccruedInterest, agentCommissionPct, otherCosts]);

  const clearInputs = () => {
    setSellingPrice(DEFAULTS.sellingPrice);
    setOutstandingLoan(DEFAULTS.outstandingLoan);
    setCpfPrincipalUsed(DEFAULTS.cpfPrincipalUsed);
    setCpfAccruedInterest(DEFAULTS.cpfAccruedInterest);
    setAgentCommissionPct(DEFAULTS.agentCommissionPct);
    setOtherCosts(DEFAULTS.otherCosts);
    setMopStartDate(DEFAULTS.mopStartDate);
    setBuyingAnotherSubsidisedFlat(DEFAULTS.buyingAnotherSubsidisedFlat);
    setFirstFlatType(DEFAULTS.firstFlatType);
    setIsSingleScheme(DEFAULTS.isSingleScheme);
    clearCalculatorData(STORAGE_KEY);
    setSavedAt(null);
  };

  const handleSave = () => {
    const at = saveCalculatorData(STORAGE_KEY, {
      sellingPrice,
      outstandingLoan,
      cpfPrincipalUsed,
      cpfAccruedInterest,
      agentCommissionPct,
      otherCosts,
      mopStartDate,
      buyingAnotherSubsidisedFlat,
      firstFlatType,
      isSingleScheme,
    });
    setSavedAt(at);
  };

  const handleDownloadPdf = () => {
    downloadCalculatorPdf({
      calculatorTitle: "HDB Sale Proceeds Calculator",
      inputs: [
        { label: "Estimated selling price", value: formatSgd(sellingPrice) },
        { label: "Outstanding HDB/bank loan", value: formatSgd(outstandingLoan) },
        { label: "CPF principal used", value: formatSgd(cpfPrincipalUsed) },
        { label: "CPF accrued interest", value: formatSgd(cpfAccruedInterest) },
        { label: "Agent commission", value: `${agentCommissionPct}%` },
        { label: "Legal / other costs", value: formatSgd(otherCosts) },
      ],
      results: [
        { label: "Selling Price", value: formatSgd(result.sellingPrice) },
        { label: "Outstanding Loan", value: `-${formatSgd(result.outstandingLoan)}` },
        { label: "CPF Refund", value: `-${formatSgd(result.cpfRefund)}` },
        { label: "Agent Fee", value: `-${formatSgd(result.agentFee)}` },
        { label: "Other Costs", value: `-${formatSgd(result.otherCosts)}` },
        { label: "Estimated Cash Proceeds", value: formatSgd(result.cashProceeds) },
        ...(mopResult
          ? [{ label: "MOP status", value: mopResult.metMop ? "Met" : `${mopResult.monthsRemaining} months remaining` }]
          : []),
        ...(resaleLevy !== null
          ? [{ label: "Resale levy (owed at next subsidised purchase)", value: formatSgd(resaleLevy) }]
          : []),
      ],
      disclaimer:
        "Simplified estimate. Actual proceeds depend on your exact CPF withdrawal history, resale levy (if any), and HDB/bank documentation at point of sale. Verify with HDB and CPF Board before making decisions.",
    });
  };

  return (
    <CalcShell
      title="🏠 HDB Sale Proceeds Calculator"
      subtitle="See how much cash you'll walk away with after selling your HDB flat."
      onClear={clearInputs}
      onSave={handleSave}
      onDownloadPdf={handleDownloadPdf}
      savedAt={savedAt}
    >
      <div className="form-grid">
        <NumberField label="Estimated selling price" value={sellingPrice} onChange={setSellingPrice} prefix="$" step={1000} />
        <NumberField label="Outstanding HDB/bank loan" value={outstandingLoan} onChange={setOutstandingLoan} prefix="$" step={1000} />
        <NumberField label="CPF principal used" value={cpfPrincipalUsed} onChange={setCpfPrincipalUsed} prefix="$" step={1000} />
        <NumberField label="CPF accrued interest" value={cpfAccruedInterest} onChange={setCpfAccruedInterest} prefix="$" step={1000} />
        <NumberField label="Agent commission" value={agentCommissionPct} onChange={setAgentCommissionPct} suffix="%" step={0.5} />
        <NumberField label="Legal / other costs" value={otherCosts} onChange={setOtherCosts} prefix="$" step={100} />
      </div>
      <p className="explainer">
        Legal/conveyancing fees for an HDB resale transaction are typically in the $1,000–$3,000 range depending on
        whether you use HDB's own conveyancing service or a private lawyer — adjust "Legal / other costs" above to
        match your actual quote.
      </p>

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

      <ResultCard title="Minimum Occupation Period (MOP)">
        <label className="explainer" style={{ display: "block", marginBottom: 6 }}>
          When did you collect your keys?
        </label>
        <input
          type="date"
          value={mopStartDate}
          onChange={(e) => setMopStartDate(e.target.value)}
          className="lead-form-input"
          style={{ width: "100%", marginBottom: 10 }}
        />
        {mopResult && (
          <ResultRow
            label={mopResult.metMop ? "✅ MOP met — you can sell" : "⏳ MOP not yet met"}
            value={mopResult.metMop ? "" : `${mopResult.monthsRemaining} months remaining`}
            emphasis
            positive={mopResult.metMop}
          />
        )}
        <p className="explainer">
          Standard 5-year MOP for most flat types/schemes. Some cases (e.g. short-lease 2-Room Flexi for seniors)
          differ — check your specific eligibility on HDB's website.
        </p>
      </ResultCard>

      <ResultCard title="Resale Levy">
        <label className="hdb-scenario-toggle">
          <input
            type="checkbox"
            checked={buyingAnotherSubsidisedFlat}
            onChange={(e) => setBuyingAnotherSubsidisedFlat(e.target.checked)}
          />
          <span>Buying another new BTO/SBF/EC (not resale)?</span>
        </label>
        {buyingAnotherSubsidisedFlat && (
          <>
            <SelectField
              label="This flat's type (the one you're selling)"
              value={firstFlatType}
              onChange={setFirstFlatType}
              options={Object.entries(FLAT_TYPE_LABELS).map(([value, label]) => ({ value: value as FlatTypeForLevy, label }))}
            />
            <label className="hdb-scenario-toggle" style={{ marginTop: 8 }}>
              <input type="checkbox" checked={isSingleScheme} onChange={(e) => setIsSingleScheme(e.target.checked)} />
              <span>Applying under the Single Singapore Citizen (SSC) scheme</span>
            </label>
            {resaleLevy !== null && (
              <ResultRow label="RESALE LEVY OWED" value={formatSgd(resaleLevy)} emphasis positive={false} />
            )}
            <p className="explainer">
              This is NOT deducted from this sale's proceeds — it's owed separately when you complete your NEXT
              subsidised flat purchase (payable from CPF OA or cash then). Shown here so you can budget ahead.
              Doesn't apply at all if your next flat is a resale flat or private property.
            </p>
          </>
        )}
      </ResultCard>

      <NextStep calculatorId={CALCULATOR_ID} onSelect={handleSave} />

      <BtoPromo
        title="Selling to upgrade to a BTO?"
        desc="Check eligibility, timelines and flat selection with our BTO Planning Tool."
      />

      <Disclaimer>
        Simplified estimate. Actual proceeds depend on your exact CPF withdrawal history, resale levy (if any), and
        HDB/bank documentation at point of sale. Verify with HDB and CPF Board before making decisions.
      </Disclaimer>

      <div className="faq-section">
        <h2 className="faq-title">Common questions about selling your HDB flat</h2>
        <details className="faq-item">
          <summary>How much CPF refund will I need to make?</summary>
          <p>
            You'll need to refund the CPF principal amount you used to buy this flat, plus the accrued interest
            your CPF would have earned had it stayed in your account instead (at the CPF Ordinary Account rate).
            This gets credited back into your CPF account, not paid out as cash.
          </p>
        </details>
        <details className="faq-item">
          <summary>What is the Minimum Occupation Period (MOP)?</summary>
          <p>
            MOP is the minimum time — usually 5 years from key collection — you must live in your flat before
            you're allowed to sell it or rent out the whole unit. It applies to most HDB flats and ECs, with a
            few exceptions for specific schemes.
          </p>
        </details>
        <details className="faq-item">
          <summary>What is the HDB resale levy and do I have to pay it?</summary>
          <p>
            The resale levy is a fixed charge (S$15,000–S$50,000, depending on your current flat type) for
            buyers purchasing a SECOND subsidised flat — a new BTO, SBF, or EC unit. It does NOT apply if you're
            buying a resale flat or private property instead, which covers most sellers.
          </p>
        </details>
        <details className="faq-item">
          <summary>Can I sell my HDB and buy private property?</summary>
          <p>
            Yes — once you've met MOP, you're free to sell your HDB and buy private property. No resale levy
            applies in this case since you're not buying another subsidised flat.
          </p>
        </details>
        <details className="faq-item">
          <summary>How much are agent fees when selling an HDB flat?</summary>
          <p>
            Agent commission is negotiable, but 1–2% of the selling price is typical for HDB resale
            transactions in Singapore. Some sellers choose to sell without an agent to save on this cost.
          </p>
        </details>
      </div>
    </CalcShell>
  );
}
