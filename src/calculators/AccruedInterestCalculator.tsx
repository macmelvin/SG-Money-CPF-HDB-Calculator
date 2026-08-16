import { useEffect, useMemo, useRef, useState } from "react";
import { BtoPromo, CalcShell, Disclaimer, NumberField, ResultCard, ResultRow } from "../components/CalcShell";
import { NextStep } from "../components/NextStep";
import { calculateAccruedInterest, formatSgd } from "../lib/cpf";
import type { AccruedInterestWithdrawal } from "../lib/cpf";
import { usePageMeta } from "../lib/usePageMeta";
import { clearCalculatorData, loadCalculatorData, saveCalculatorData } from "../lib/storage";
import { downloadCalculatorPdf } from "../lib/pdf";
import { trackEvent } from "../lib/analytics";

const CALCULATOR_ID = "cpf-accrued-interest";

interface WithdrawalRow extends AccruedInterestWithdrawal {
  id: string;
}

const DEFAULT_WITHDRAWALS: WithdrawalRow[] = [{ id: "w1", principal: 180000, yearUsed: 2010 }];
const DEFAULT_MANUAL_PRINCIPAL = 180000;
const DEFAULT_MANUAL_INTEREST = 0;

const STORAGE_KEY = "cpf-accrued-interest";

let nextId = 2;

export default function AccruedInterestCalculator() {
  usePageMeta(
    "CPF Accrued Interest Calculator",
    "Estimate — or enter exactly — the CPF accrued interest you'll need to refund when selling a property in Singapore. Supports multiple CPF withdrawals, or manual entry if you already know your exact figure from the CPF app."
  );
  const currentYear = new Date().getFullYear();
  const saved = loadCalculatorData<{
    withdrawals: WithdrawalRow[];
    useManualEntry?: boolean;
    manualPrincipal?: number;
    manualAccruedInterest?: number;
  }>(STORAGE_KEY);
  const initial = saved?.data?.withdrawals ?? DEFAULT_WITHDRAWALS;

  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>(initial);
  const [useManualEntry, setUseManualEntry] = useState(saved?.data?.useManualEntry ?? false);
  const [manualPrincipal, setManualPrincipal] = useState(saved?.data?.manualPrincipal ?? DEFAULT_MANUAL_PRINCIPAL);
  const [manualAccruedInterest, setManualAccruedInterest] = useState(
    saved?.data?.manualAccruedInterest ?? DEFAULT_MANUAL_INTEREST
  );
  const [savedAt, setSavedAt] = useState<number | null>(saved?.savedAt ?? null);

  useEffect(() => {
    trackEvent("calculator_started", { calculator: CALCULATOR_ID });
  }, []);

  const initialSnapshot = useRef(initial);
  const hasCompletedOnce = useRef(false);

  const estimatedResult = useMemo(() => calculateAccruedInterest(withdrawals, currentYear), [withdrawals, currentYear]);

  // When manual entry is on, this replaces the withdrawal-based estimate entirely — CPF's own
  // app/statement is always more accurate than any estimate here, since it knows your exact
  // withdrawal dates (including things like monthly mortgage instalments spread over years,
  // which are easy to under/overstate if lumped into a single estimated withdrawal date).
  const effectivePrincipal = useManualEntry ? manualPrincipal : estimatedResult.totalPrincipal;
  const effectiveAccruedInterest = useManualEntry ? manualAccruedInterest : estimatedResult.totalAccruedInterest;
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
    setUseManualEntry(false);
    setManualPrincipal(DEFAULT_MANUAL_PRINCIPAL);
    setManualAccruedInterest(DEFAULT_MANUAL_INTEREST);
    clearCalculatorData(STORAGE_KEY);
    setSavedAt(null);
  };

  const handleSave = () => {
    const at = saveCalculatorData(STORAGE_KEY, {
      withdrawals,
      useManualEntry,
      manualPrincipal,
      manualAccruedInterest,
      // Precomputed totals, saved alongside the raw inputs — downstream consumers (Retirement
      // Calculator's Premium Report) read these directly instead of recomputing from withdrawals,
      // so manual-entry mode is respected everywhere, not just on this page.
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
      inputs: useManualEntry
        ? [
            { label: "Entry method", value: "Manual (from CPF app)" },
            { label: "Total CPF principal used", value: formatSgd(manualPrincipal) },
            { label: "Total accrued interest", value: formatSgd(manualAccruedInterest) },
          ]
        : withdrawals.map((w, i) => ({
            label: `Withdrawal ${i + 1}`,
            value: `${formatSgd(w.principal)} in ${w.yearUsed}`,
          })),
      results: [
        { label: "Total CPF Principal Used", value: formatSgd(effectivePrincipal) },
        { label: useManualEntry ? "Total Accrued Interest" : "Total Estimated Accrued Interest", value: formatSgd(effectiveAccruedInterest) },
        { label: useManualEntry ? "CPF REFUND" : "ESTIMATED CPF REFUND", value: formatSgd(effectiveRefund) },
        ...(!useManualEntry
          ? estimatedResult.perWithdrawal.map((p, i) => ({
              label: `Withdrawal ${i + 1} (${p.years} yrs)`,
              value: `${formatSgd(p.principal)} + ${formatSgd(p.accruedInterest)} interest = ${formatSgd(p.refund)}`,
            }))
          : []),
      ],
      disclaimer: useManualEntry
        ? "Figures entered directly from your CPF app/statement — no estimation involved."
        : "Simple estimate only — each withdrawal compounded annually at 2.5% from its own year. Real CPF accrued interest is calculated based on actual dates and prevailing rates, which can change over time. For an exact figure, check your CPF statement or myTax Portal.",
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
      <label className="hdb-scenario-toggle">
        <input type="checkbox" checked={useManualEntry} onChange={(e) => setUseManualEntry(e.target.checked)} />
        <span>I already know my exact figures (from the CPF app)</span>
      </label>
      <p className="explainer">
        Open the CPF app → Dashboard → scroll to the "Housing" tab under Quick Access — it shows your exact "Total
        Principal Amount Withdrawn" and "Total Accrued Interest" directly, based on your real withdrawal history
        (including things like monthly mortgage instalments spread over many years, which a single estimated
        withdrawal date can't capture accurately). This will always be more accurate than the estimate below.
      </p>

      {useManualEntry ? (
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
      ) : (
        <ResultCard title="CPF Withdrawals (estimate)">
          <p className="explainer" style={{ marginTop: -2 }}>
            Add one row per CPF withdrawal — most owners used CPF more than once (e.g. the initial purchase, then a
            later top-up). Each withdrawal accrues interest separately from its own year.
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
        </ResultCard>
      )}

      <ResultCard title={useManualEntry ? "Total CPF Refund" : "Total CPF Refund (estimate)"}>
        <ResultRow label="Total CPF Principal Used" value={formatSgd(effectivePrincipal)} />
        <ResultRow label={useManualEntry ? "Total Accrued Interest" : "Total Estimated Accrued Interest"} value={formatSgd(effectiveAccruedInterest)} />
        <ResultRow label={useManualEntry ? "CPF REFUND" : "ESTIMATED CPF REFUND"} value={formatSgd(effectiveRefund)} emphasis />
      </ResultCard>

      <NextStep calculatorId={CALCULATOR_ID} prompt="Why are you calculating this?" />

      <BtoPromo />

      <p className="explainer">
        Accrued interest is the interest your CPF savings would have earned (at the CPF Ordinary Account rate) had
        they stayed in your CPF account instead of being used for your property.
      </p>

      <Disclaimer>
        {useManualEntry
          ? "Figures entered directly from your own CPF app/statement — no estimation involved on this calculator's part."
          : "Simple estimate only — each withdrawal is compounded annually at 2.5% from its own year of use. Real CPF accrued interest is calculated based on actual dates and prevailing rates, which can change over time. For an exact figure, check your CPF statement or myTax Portal."}
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
          <summary>Why is the estimate so different from what my CPF app shows?</summary>
          <p>
            The estimator assumes each withdrawal happened on one specific date you enter. In reality, many owners
            used CPF gradually — an initial lump sum at purchase, then years of monthly mortgage instalments
            deducted from CPF-OA. If you lump all of that into one estimated date, the estimate can be
            significantly off. Toggle "I already know my exact figures" above and enter what your CPF app shows
            instead — it's always more accurate.
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
