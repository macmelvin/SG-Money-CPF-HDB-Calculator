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

const STORAGE_KEY = "cpf-accrued-interest";

let nextId = 2;

export default function AccruedInterestCalculator() {
  usePageMeta(
    "CPF Accrued Interest Calculator",
    "Estimate the CPF accrued interest you'll need to refund when selling a property in Singapore. Free calculator that supports multiple CPF withdrawals, each compounded from its own date."
  );
  const currentYear = new Date().getFullYear();
  const saved = loadCalculatorData<{ withdrawals: WithdrawalRow[] }>(STORAGE_KEY);
  const initial = saved?.data?.withdrawals ?? DEFAULT_WITHDRAWALS;

  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>(initial);
  const [savedAt, setSavedAt] = useState<number | null>(saved?.savedAt ?? null);

  useEffect(() => {
    trackEvent("calculator_started", { calculator: CALCULATOR_ID });
  }, []);

  const initialSnapshot = useRef(initial);
  const hasCompletedOnce = useRef(false);

  const result = useMemo(() => calculateAccruedInterest(withdrawals, currentYear), [withdrawals, currentYear]);

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
    clearCalculatorData(STORAGE_KEY);
    setSavedAt(null);
  };

  const handleSave = () => {
    const at = saveCalculatorData(STORAGE_KEY, { withdrawals });
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
      inputs: withdrawals.map((w, i) => ({
        label: `Withdrawal ${i + 1}`,
        value: `${formatSgd(w.principal)} in ${w.yearUsed}`,
      })),
      results: [
        { label: "Total CPF Principal Used", value: formatSgd(result.totalPrincipal) },
        { label: "Total Estimated Accrued Interest", value: formatSgd(result.totalAccruedInterest) },
        { label: "ESTIMATED CPF REFUND", value: formatSgd(result.totalRefund) },
        ...result.perWithdrawal.map((p, i) => ({
          label: `Withdrawal ${i + 1} (${p.years} yrs)`,
          value: `${formatSgd(p.principal)} + ${formatSgd(p.accruedInterest)} interest = ${formatSgd(p.refund)}`,
        })),
      ],
      disclaimer:
        "Simple estimate only — each withdrawal compounded annually at 2.5% from its own year. Real CPF accrued interest is calculated based on actual dates and prevailing rates, which can change over time. For an exact figure, check your CPF statement or myTax Portal.",
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
        Add one row per CPF withdrawal — most owners used CPF more than once (e.g. the initial purchase, then a
        later top-up). Each withdrawal accrues interest separately from its own year, which this now models
        properly instead of treating everything as one lump sum.
      </p>

      <ResultCard title="CPF Withdrawals">
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

      <ResultCard title="Total CPF Refund">
        <ResultRow label="Total CPF Principal Used" value={formatSgd(result.totalPrincipal)} />
        <ResultRow label="Total Estimated Accrued Interest" value={formatSgd(result.totalAccruedInterest)} />
        <ResultRow label="ESTIMATED CPF REFUND" value={formatSgd(result.totalRefund)} emphasis />
      </ResultCard>

      <p className="explainer">
        Accrued interest is the interest your CPF savings would have earned (at the CPF Ordinary Account rate) had
        they stayed in your CPF account instead of being used for your property.
      </p>

      <NextStep calculatorId={CALCULATOR_ID} prompt="Why are you calculating this?" />

      <BtoPromo />

      <Disclaimer>
        Simple estimate only — each withdrawal is compounded annually at 2.5% from its own year of use. Real CPF
        accrued interest is calculated based on actual dates and prevailing rates, which can change over time. For
        an exact figure, check your CPF statement or myTax Portal.
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
          <summary>Why do I need to enter multiple withdrawals?</summary>
          <p>
            Most property owners use CPF more than once — the initial purchase, then sometimes a later top-up or
            renovation draw. Each withdrawal accrues interest separately starting from its own date, so lumping
            them together as one withdrawal understates or overstates the true figure depending on the dates
            involved.
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
          <summary>Where can I find the exact figure instead of an estimate?</summary>
          <p>
            Check your CPF statement via the CPF website, or the "Home Ownership" section of the myTax Portal / My
            CPF app, which shows your exact withdrawal history and up-to-date accrued interest based on actual
            dates and any rate changes over time.
          </p>
        </details>
      </div>
    </CalcShell>
  );
}
