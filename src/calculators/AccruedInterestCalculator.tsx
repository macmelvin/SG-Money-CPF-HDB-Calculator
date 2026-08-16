import { useEffect, useMemo, useRef, useState } from "react";
import { BtoPromo, CalcShell, Disclaimer, NumberField, ResultCard, ResultRow } from "../components/CalcShell";
import { NextStep } from "../components/NextStep";
import { calculateAccruedInterest, formatSgd } from "../lib/cpf";
import type { AccruedInterestWithdrawal, HdbSaleInput } from "../lib/cpf";
import { usePageMeta } from "../lib/usePageMeta";
import { clearCalculatorData, loadCalculatorData, saveCalculatorData } from "../lib/storage";
import { downloadCalculatorPdf } from "../lib/pdf";
import { trackEvent } from "../lib/analytics";

const CALCULATOR_ID = "cpf-accrued-interest";
const HDB_SALE_STORAGE_KEY = "hdb-sale-proceeds";

interface WithdrawalRow extends AccruedInterestWithdrawal {
  id: string;
}

const DEFAULT_WITHDRAWALS: WithdrawalRow[] = [{ id: "w1", principal: 180000, yearUsed: 2010 }];
const DEFAULT_MANUAL_PRINCIPAL = 180000;
const DEFAULT_MANUAL_INTEREST = 0;

let nextId = 2;

export default function AccruedInterestCalculator() {
  usePageMeta(
    "CPF Accrued Interest Calculator",
    "Enter — or estimate — the CPF accrued interest you'll need to refund when selling a property in Singapore. Auto-fills from your HDB Sale Proceeds calculator if you've already entered it there."
  );
  const currentYear = new Date().getFullYear();
  const saved = loadCalculatorData<{
    withdrawals: WithdrawalRow[];
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

  const initial = saved?.data?.withdrawals ?? DEFAULT_WITHDRAWALS;

  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>(initial);
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

  const initialSnapshot = useRef(initial);
  const hasCompletedOnce = useRef(false);

  // The withdrawal estimator below is a reference tool to help figure out what to type into
  // the fields above if you don't already know your exact figure — it doesn't feed into the
  // total directly. Manual entry (pre-filled from HDB Sale when available) is the primary,
  // authoritative source now.
  const estimatedResult = useMemo(() => calculateAccruedInterest(withdrawals, currentYear), [withdrawals, currentYear]);

  const effectivePrincipal = manualPrincipal;
  const effectiveAccruedInterest = manualAccruedInterest;
  const effectiveRefund = effectivePrincipal + effectiveAccruedInterest;

  useEffect(() => {
    const s = initialSnapshot.current;
    const changed = JSON.stringify(withdrawals) !== JSON.stringify(s);
    if (!hasCompletedOnce.current && changed) {
      hasCompletedOnce.current = true;
      trackEvent("calculator_completed", { calculator: CALCULATOR_ID });
    }
  }, [withdrawals]);

  const clearInputs = () => {
    setWithdrawals(DEFAULT_WITHDRAWALS);
    setManualPrincipal(DEFAULT_MANUAL_PRINCIPAL);
    setManualAccruedInterest(DEFAULT_MANUAL_INTEREST);
    clearCalculatorData(CALCULATOR_ID);
    setSavedAt(null);
  };

  const handleSave = () => {
    const at = saveCalculatorData(CALCULATOR_ID, {
      withdrawals,
      manualPrincipal,
      manualAccruedInterest,
      // Precomputed totals, saved alongside the raw inputs — downstream consumers (Retirement
      // Calculator's Premium Report) read these directly rather than recomputing.
      totalPrincipal: effectivePrincipal,
      totalAccruedInterest: effectiveAccruedInterest,
      totalRefund: effectiveRefund,
    });
    setSavedAt(at);
  };

  const updateWithdrawal = (id: string, field: "principal" | "yearUsed", value: number) => {
    setWithdrawals((prev) => prev.map((w) => (w.id === id ? { ...w, [field]: value } : w)));
  };

  const addWithdrawal = () => {
    setWithdrawals((prev) => [...prev, { id: `w${nextId++}`, principal: 50000, yearUsed: currentYear }]);
  };

  const removeWithdrawal = (id: string) => {
    setWithdrawals((prev) => (prev.length > 1 ? prev.filter((w) => w.id !== id) : prev));
  };

  const handleDownloadPdf = () => {
    downloadCalculatorPdf({
      calculatorTitle: "CPF Accrued Interest Calculator",
      inputs: [
        { label: "Total CPF principal used", value: formatSgd(manualPrincipal) },
        { label: "Total accrued interest", value: formatSgd(manualAccruedInterest) },
      ],
      results: [
        { label: "Total CPF Principal Used", value: formatSgd(effectivePrincipal) },
        { label: "Total Accrued Interest", value: formatSgd(effectiveAccruedInterest) },
        { label: "CPF REFUND", value: formatSgd(effectiveRefund) },
      ],
      disclaimer: "Figures entered directly (or pulled from your HDB Sale Proceeds calculator) — no estimation involved unless you used the withdrawal estimator as a reference.",
    });
  };

  return (
    <CalcShell
      title="📈 CPF Accrued Interest Calculator"
      subtitle="Estimate how much CPF you'll need to refund when you sell your property."
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

      <ResultCard title="Your Exact CPF Figures">
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
        <ResultRow label="Total CPF Principal Used" value={formatSgd(effectivePrincipal)} />
        <ResultRow label="Total Accrued Interest" value={formatSgd(effectiveAccruedInterest)} />
        <ResultRow label="CPF REFUND" value={formatSgd(effectiveRefund)} emphasis />
      </ResultCard>

      <NextStep calculatorId={CALCULATOR_ID} prompt="Why are you calculating this?" />

      <BtoPromo />

      <p className="explainer">
        Accrued interest is the interest your CPF savings would have earned (at the CPF Ordinary Account rate) had
        they stayed in your CPF account instead of being used for your property.
      </p>

      <ResultCard title="Not sure of your exact figure? Estimate it here">
        <p className="explainer" style={{ marginTop: -2 }}>
          Add one row per CPF withdrawal to get a rough estimate — most owners used CPF more than once (e.g. the
          initial purchase, then a later top-up). This is a reference tool only; it doesn't automatically fill in
          "Your Exact CPF Figures" above, since checking your CPF app directly is always more accurate.
        </p>
        {withdrawals.map((w, i) => (
          <div key={w.id} className="withdrawal-row">
            <NumberField
              label={`Withdrawal ${i + 1} — amount`}
              value={w.principal}
              onChange={(v) => updateWithdrawal(w.id, "principal", v)}
              prefix="$"
              step={1000}
            />
            <NumberField
              label="Year used"
              value={w.yearUsed}
              onChange={(v) => updateWithdrawal(w.id, "yearUsed", v)}
              step={1}
            />
            {withdrawals.length > 1 && (
              <button type="button" className="withdrawal-remove-btn" onClick={() => removeWithdrawal(w.id)}>
                Remove
              </button>
            )}
          </div>
        ))}
        <button type="button" className="withdrawal-add-btn" onClick={addWithdrawal}>
          + Add another withdrawal
        </button>
        <ResultRow label="Estimated Principal" value={formatSgd(estimatedResult.totalPrincipal)} />
        <ResultRow label="Estimated Accrued Interest" value={formatSgd(estimatedResult.totalAccruedInterest)} />
        <ResultRow label="Estimated Refund" value={formatSgd(estimatedResult.totalRefund)} emphasis />
      </ResultCard>

      <Disclaimer>
        Figures entered directly from your own CPF app/statement (or pulled from your HDB Sale Proceeds calculator)
        are used for the total above — no estimation involved unless you're using the withdrawal estimator as a
        reference. The estimator itself is a simple approximation: each withdrawal compounded annually at 2.5%
        from its own year of use.
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
          <summary>Why is the estimator so different from what my CPF app shows?</summary>
          <p>
            The estimator assumes each withdrawal happened on one specific date you enter. In reality, many owners
            used CPF gradually — an initial lump sum at purchase, then years of monthly mortgage instalments
            deducted from CPF-OA. If you lump all of that into one estimated date, the estimate can be
            significantly off. Always prefer entering the exact figure from your CPF app in "Your Exact CPF
            Figures" above instead.
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
