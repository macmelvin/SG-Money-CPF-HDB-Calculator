import { useEffect, useState } from "react";
import { BtoPromo, CalcShell, Disclaimer, NumberField, ResultCard, ResultRow } from "../components/CalcShell";
import { NextStep } from "../components/NextStep";
import { formatSgd } from "../lib/cpf";
import type { HdbSaleInput } from "../lib/cpf";
import { usePageMeta } from "../lib/usePageMeta";
import { clearCalculatorData, loadCalculatorData, saveCalculatorData } from "../lib/storage";
import { downloadCalculatorPdf } from "../lib/pdf";
import { trackEvent } from "../lib/analytics";

const CALCULATOR_ID = "cpf-accrued-interest";
const HDB_SALE_STORAGE_KEY = "hdb-sale-proceeds";

const DEFAULT_MANUAL_PRINCIPAL = 180000;
const DEFAULT_MANUAL_INTEREST = 0;

export default function AccruedInterestCalculator() {
  usePageMeta(
    "CPF Accrued Interest Calculator",
    "Enter the CPF accrued interest you'll need to refund when selling a property in Singapore. Auto-fills from your HDB Sale Proceeds calculator if you've already entered it there."
  );
  const saved = loadCalculatorData<{
    manualPrincipal?: number;
    manualAccruedInterest?: number;
  }>(CALCULATOR_ID);
  // HDB Sale Proceeds calculator already asks for these exact two figures directly (as a
  // manual input there too) — if the person's already filled that in, there's no reason to
  // make them retype the same numbers here. Only used as the DEFAULT on first visit (no own
  // saved data yet) — doesn't override anything the person has already entered on this page.
  const savedHdbSale = loadCalculatorData<HdbSaleInput>(HDB_SALE_STORAGE_KEY);
  const hasOwnSavedData = Boolean(saved?.data);
  const hdbSaleAvailable = Boolean(savedHdbSale?.data);

  const [manualPrincipal, setManualPrincipal] = useState(
    saved?.data?.manualPrincipal ?? (hasOwnSavedData ? DEFAULT_MANUAL_PRINCIPAL : savedHdbSale?.data?.cpfPrincipalUsed ?? DEFAULT_MANUAL_PRINCIPAL)
  );
  const [manualAccruedInterest, setManualAccruedInterest] = useState(
    saved?.data?.manualAccruedInterest ??
      (hasOwnSavedData ? DEFAULT_MANUAL_INTEREST : savedHdbSale?.data?.cpfAccruedInterest ?? DEFAULT_MANUAL_INTEREST)
  );
  const [savedAt, setSavedAt] = useState<number | null>(saved?.savedAt ?? null);

  useEffect(() => {
    trackEvent("calculator_started", { calculator: CALCULATOR_ID });
  }, []);

  const totalRefund = manualPrincipal + manualAccruedInterest;

  const clearInputs = () => {
    setManualPrincipal(DEFAULT_MANUAL_PRINCIPAL);
    setManualAccruedInterest(DEFAULT_MANUAL_INTEREST);
    clearCalculatorData(CALCULATOR_ID);
    setSavedAt(null);
  };

  const handleSave = () => {
    const at = saveCalculatorData(CALCULATOR_ID, {
      manualPrincipal,
      manualAccruedInterest,
      // Precomputed totals, saved alongside the raw inputs — downstream consumers (Retirement
      // Calculator's Premium Report) read these directly rather than recomputing.
      totalPrincipal: manualPrincipal,
      totalAccruedInterest: manualAccruedInterest,
      totalRefund,
    });
    setSavedAt(at);
    trackEvent("calculator_completed", { calculator: CALCULATOR_ID });
  };

  const handleDownloadPdf = () => {
    downloadCalculatorPdf({
      calculatorTitle: "CPF Accrued Interest Calculator",
      inputs: [
        { label: "Total CPF principal used", value: formatSgd(manualPrincipal) },
        { label: "Total accrued interest", value: formatSgd(manualAccruedInterest) },
      ],
      results: [
        { label: "Total CPF Principal Used", value: formatSgd(manualPrincipal) },
        { label: "Total Accrued Interest", value: formatSgd(manualAccruedInterest) },
        { label: "CPF REFUND", value: formatSgd(totalRefund) },
      ],
      disclaimer: "Figures entered directly (or pulled from your HDB Sale Proceeds calculator) — no estimation involved.",
    });
  };

  return (
    <CalcShell
      title="📈 CPF Accrued Interest Calculator"
      subtitle="Estimate how much CPF you'll need to refund when you sell your property."
      whatsappTopic="CPF Accrued Interest Calculator"
      showAppSuiteFooter
      onClear={clearInputs}
      onSave={handleSave}
      onDownloadPdf={handleDownloadPdf}
      savedAt={savedAt}
    >
      <p className="explainer">
        Open the CPF app → Dashboard → scroll to the "Housing" tab under Quick Access — it shows your exact "Total
        Principal Amount Withdrawn" and "Total Accrued Interest" directly, based on your real withdrawal history.
        Enter those two figures below for the most accurate result.
      </p>

      <ResultCard title="Your Exact CPF Figures">
        {hdbSaleAvailable && (
          <button
            type="button"
            className="withdrawal-add-btn"
            onClick={() => {
              setManualPrincipal(savedHdbSale!.data!.cpfPrincipalUsed);
              setManualAccruedInterest(savedHdbSale!.data!.cpfAccruedInterest);
            }}
          >
            ↻ Pull from your saved HDB Sale Proceeds calculator
          </button>
        )}
        <NumberField
          label="Total CPF principal used (from CPF app)"
          value={manualPrincipal}
          onChange={setManualPrincipal}
          prefix="$"
          step={1000}
        />
        <NumberField
          label="Total accrued interest (from CPF app)"
          value={manualAccruedInterest}
          onChange={setManualAccruedInterest}
          prefix="$"
          step={1000}
        />
      </ResultCard>

      <ResultCard title="Total CPF Refund">
        <ResultRow label="Total CPF Principal Used" value={formatSgd(manualPrincipal)} />
        <ResultRow label="Total Accrued Interest" value={formatSgd(manualAccruedInterest)} />
        <ResultRow label="CPF REFUND" value={formatSgd(totalRefund)} emphasis />
      </ResultCard>

      <NextStep calculatorId={CALCULATOR_ID} prompt="Why are you calculating this?" />

      <BtoPromo />

      <p className="explainer">
        Accrued interest is the interest your CPF savings would have earned (at the CPF Ordinary Account rate) had
        they stayed in your CPF account instead of being used for your property.
      </p>

      <Disclaimer>
        Figures entered directly from your own CPF app/statement (or pulled from your HDB Sale Proceeds calculator)
        — no estimation involved.
      </Disclaimer>

      <div className="faq-section">
        <h2 className="faq-title">Common questions about CPF accrued interest</h2>
        <details className="faq-item">
          <summary>What is CPF accrued interest?</summary>
          <p>
            When you use CPF savings to buy property, that money stops earning CPF interest. Accrued interest is
            the interest those savings would have earned had they stayed in your CPF account instead — you owe
            this back to your CPF account (not as cash) when you sell.
          </p>
        </details>
        <details className="faq-item">
          <summary>Do I have to pay accrued interest back in cash?</summary>
          <p>
            No — the CPF refund (principal plus accrued interest) is credited back into your CPF account from your
            sale proceeds, not paid out as cash to you. It effectively reduces how much cash you walk away with
            from the sale.
          </p>
        </details>
        <details className="faq-item">
          <summary>What happens to the accrued interest after I refund it?</summary>
          <p>
            It goes back into your CPF Ordinary Account (or Special/Retirement Account depending on your age), 
            where it continues earning CPF interest going forward — same as any other CPF savings.
          </p>
        </details>
        <details className="faq-item">
          <summary>Where exactly do I find my exact figure in the CPF app?</summary>
          <p>
            Open the CPF app, go to Dashboard, scroll down to "Quick Access", then tap the "Housing" tab — it
            shows your exact Total Principal Amount Withdrawn and Total Accrued Interest to date, calculated from
            your real withdrawal history.
          </p>
        </details>
      </div>
    </CalcShell>
  );
}
