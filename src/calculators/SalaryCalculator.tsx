import { useEffect, useMemo, useRef, useState } from "react";
import { BtoPromo, CalcShell, Disclaimer, NumberField, ResultCard, ResultRow, SelectField } from "../components/CalcShell";
import { NextStep } from "../components/NextStep";
import { AdSpot } from "../components/AdSpot";
import { calculateSalaryCpf, formatSgd } from "../lib/cpf";
import type { CitizenshipStatus } from "../lib/cpf";
import type { Sponsor } from "../lib/offers";
import { usePageMeta } from "../lib/usePageMeta";
import { clearCalculatorData, loadCalculatorData, saveCalculatorData } from "../lib/storage";
import { downloadCalculatorPdf } from "../lib/pdf";
import { trackEvent } from "../lib/analytics";

const CALCULATOR_ID = "salary-calculator";

const DEFAULTS = {
  age: 35,
  monthlyGross: 5000,
  monthlySalesCommission: 0,
  monthlyBonus: 0,
  status: "citizen" as CitizenshipStatus,
  estimateIncomeTax: false,
};

const STORAGE_KEY = "salary-calculator";
const STATUS_LABELS: Record<CitizenshipStatus, string> = {
  citizen: "Singapore Citizen / PR (3rd yr+)",
  pr1: "PR — 1st year",
  pr2: "PR — 2nd year",
  pr3plus: "PR — 3rd year+",
};

export default function SalaryCalculator() {
  usePageMeta(
    "Singapore Salary & CPF Calculator",
    "Free CPF and take-home salary calculator for Singapore. Enter your monthly gross salary to estimate CPF contributions and your actual take-home pay, based on 2026 CPF rates."
  );
  const saved = loadCalculatorData<typeof DEFAULTS>(STORAGE_KEY);
  const initial = saved?.data ?? DEFAULTS;

  const [age, setAge] = useState(initial.age);
  const [monthlyGross, setMonthlyGross] = useState(initial.monthlyGross);
  const [monthlySalesCommission, setMonthlySalesCommission] = useState(
    initial.monthlySalesCommission ?? DEFAULTS.monthlySalesCommission
  );
  const [monthlyBonus, setMonthlyBonus] = useState(initial.monthlyBonus);
  const [status, setStatus] = useState<CitizenshipStatus>(initial.status);
  const [estimateIncomeTax, setEstimateIncomeTax] = useState(
    initial.estimateIncomeTax ?? DEFAULTS.estimateIncomeTax
  );
  const [savedAt, setSavedAt] = useState<number | null>(saved?.savedAt ?? null);
  const [activeSponsor, setActiveSponsor] = useState<Sponsor | undefined>(undefined);

  useEffect(() => {
    trackEvent("calculator_started", { calculator: CALCULATOR_ID });
  }, []);

  const initialSnapshot = useRef(initial);
  const hasCompletedOnce = useRef(false);

  const result = useMemo(
    () => calculateSalaryCpf({ age, monthlyGross, monthlySalesCommission, monthlyBonus, status, estimateIncomeTax }),
    [age, monthlyGross, monthlySalesCommission, monthlyBonus, status, estimateIncomeTax]
  );

  useEffect(() => {
    const s = initialSnapshot.current;
    const changed =
      age !== s.age ||
      monthlyGross !== s.monthlyGross ||
      monthlySalesCommission !== (s.monthlySalesCommission ?? DEFAULTS.monthlySalesCommission) ||
      monthlyBonus !== s.monthlyBonus ||
      status !== s.status;
    if (!hasCompletedOnce.current && changed) {
      hasCompletedOnce.current = true;
      trackEvent("calculator_completed", { calculator: CALCULATOR_ID });
    }
  }, [age, monthlyGross, monthlySalesCommission, monthlyBonus, status]);

  const clearInputs = () => {
    setAge(DEFAULTS.age);
    setMonthlyGross(DEFAULTS.monthlyGross);
    setMonthlySalesCommission(DEFAULTS.monthlySalesCommission);
    setMonthlyBonus(DEFAULTS.monthlyBonus);
    setStatus(DEFAULTS.status);
    setEstimateIncomeTax(DEFAULTS.estimateIncomeTax);
    clearCalculatorData(STORAGE_KEY);
    setSavedAt(null);
  };

  const handleSave = () => {
    const at = saveCalculatorData(STORAGE_KEY, {
      age,
      monthlyGross,
      monthlySalesCommission,
      monthlyBonus,
      status,
      estimateIncomeTax,
    });
    setSavedAt(at);
  };

  const handleDownloadPdf = () => {
    downloadCalculatorPdf({
      calculatorTitle: "Salary & CPF Calculator",
      inputs: [
        { label: "Age", value: String(age) },
        { label: "Monthly gross salary", value: formatSgd(monthlyGross) },
        { label: "Monthly sales commission", value: formatSgd(monthlySalesCommission) },
        { label: "Monthly bonus / additional wages", value: formatSgd(monthlyBonus) },
        { label: "Citizenship status", value: STATUS_LABELS[status] },
      ],
      results: [
        { label: "Gross Salary", value: formatSgd(result.grossSalary) },
        { label: "Employee CPF", value: formatSgd(result.employeeCpf) },
        { label: "Estimated take-home", value: formatSgd(result.takeHome) },
        { label: "Employer CPF", value: formatSgd(result.employerCpf) },
        { label: "Total CPF contribution", value: formatSgd(result.totalCpf) },
        { label: "CPF — Ordinary Account", value: formatSgd(result.allocation.oa) },
        { label: "CPF — Special/Retirement Account", value: formatSgd(result.allocation.saRa) },
        { label: "CPF — MediSave Account", value: formatSgd(result.allocation.ma) },
        { label: "Annual gross salary", value: formatSgd(result.annual.grossSalary) },
        { label: "Annual employee CPF", value: formatSgd(result.annual.employeeCpf) },
        { label: "Annual take-home", value: formatSgd(result.annual.takeHome) },
        ...(result.incomeTaxEstimate
          ? [
              { label: "Estimated chargeable income", value: formatSgd(result.incomeTaxEstimate.chargeableIncome) },
              { label: "Estimated annual income tax", value: formatSgd(result.incomeTaxEstimate.estimatedTax) },
            ]
          : []),
      ],
      disclaimer:
        "Estimate based on 2026 CPF contribution rates and the S$8,000 Ordinary Wage ceiling. PR rates are simplified approximations. Not tax advice.",
    });
  };

  return (
    <CalcShell
      title="💰 Salary & CPF Calculator"
      subtitle="Find your estimated take-home pay and CPF contributions."
      whatsappTopic="Salary & CPF Calculator"
      onClear={clearInputs}
      onSave={handleSave}
      onDownloadPdf={handleDownloadPdf}
      savedAt={savedAt}
    >
      <div className="form-grid">
        <NumberField label="Your age" value={age} onChange={setAge} />
        <NumberField label="Monthly gross salary" value={monthlyGross} onChange={setMonthlyGross} prefix="$" />
        <NumberField
          label="Monthly sales commission"
          value={monthlySalesCommission}
          onChange={setMonthlySalesCommission}
          prefix="$"
        />
        <NumberField label="Monthly bonus / additional wages" value={monthlyBonus} onChange={setMonthlyBonus} prefix="$" />
        <SelectField
          label="Citizenship status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "citizen", label: "Singapore Citizen / PR (3rd yr+)" },
            { value: "pr1", label: "PR — 1st year" },
            { value: "pr2", label: "PR — 2nd year" },
          ]}
        />
      </div>

      <p className="explainer">
        Sales commission is treated as regular Ordinary Wages (combined with your gross salary for the $8,000/month
        CPF ceiling) — the standard treatment for commission paid monthly as part of normal wages, common for
        property and insurance agents. If your commission is instead an irregular lump-sum payment, add it to
        "Monthly bonus" instead, which uses the separate annual Additional Wage ceiling.
      </p>

      <ResultCard title="Your Monthly Salary">
        <ResultRow label="Gross Salary" value={formatSgd(result.grossSalary)} />
        <ResultRow label="Employee CPF" value={`-${formatSgd(result.employeeCpf)}`} positive={false} />
        <ResultRow label="ESTIMATED TAKE-HOME" value={formatSgd(result.takeHome)} emphasis positive />
        <ResultRow label="Employer CPF" value={`+${formatSgd(result.employerCpf)}`} positive />
        <ResultRow label="Total CPF contribution" value={formatSgd(result.totalCpf)} />
      </ResultCard>

      <ResultCard title="CPF Account Breakdown">
        <ResultRow label="Ordinary Account (OA)" value={formatSgd(result.allocation.oa)} />
        <ResultRow label={age >= 55 ? "Retirement Account (RA)" : "Special Account (SA)"} value={formatSgd(result.allocation.saRa)} />
        <ResultRow label="MediSave Account (MA)" value={formatSgd(result.allocation.ma)} />
      </ResultCard>

      <ResultCard title="Annual Summary">
        <ResultRow label="Gross Salary" value={formatSgd(result.annual.grossSalary)} />
        <ResultRow label="Employee CPF" value={`-${formatSgd(result.annual.employeeCpf)}`} positive={false} />
        <ResultRow label="ESTIMATED TAKE-HOME" value={formatSgd(result.annual.takeHome)} emphasis positive />
        <ResultRow label="Employer CPF" value={`+${formatSgd(result.annual.employerCpf)}`} positive />
      </ResultCard>

      <ResultCard title="Income Tax Estimate">
        <label className="hdb-scenario-toggle">
          <input
            type="checkbox"
            checked={estimateIncomeTax}
            onChange={(e) => setEstimateIncomeTax(e.target.checked)}
          />
          <span>Estimate my income tax? (optional)</span>
        </label>
        {estimateIncomeTax && result.incomeTaxEstimate && (
          <>
            <ResultRow label="Est. chargeable income" value={formatSgd(result.incomeTaxEstimate.chargeableIncome)} />
            <ResultRow label="ESTIMATED ANNUAL TAX" value={formatSgd(result.incomeTaxEstimate.estimatedTax)} emphasis />
            <ResultRow label="Effective tax rate" value={`${(result.incomeTaxEstimate.effectiveRate * 100).toFixed(1)}%`} />
            <p className="explainer">
              Includes CPF relief and the standard Earned Income Relief only — NOT spouse, parent, child, NSman or
              other personal reliefs, which would lower your actual tax further. Also excludes any one-off Budget
              rebate (these are announced year to year and aren't guaranteed to recur). Treat this as a ceiling
              estimate, not your actual tax bill — use IRAS's own calculator or myTax Portal for that.
            </p>
          </>
        )}
      </ResultCard>

      <NextStep
        calculatorId={CALCULATOR_ID}
        hideEmbeddedAdSpot
        onActiveSponsorChange={setActiveSponsor}
      />

      <AdSpot label="SG Money ad spot - Salary & CPF" sponsor={activeSponsor} />

      <BtoPromo />

      <Disclaimer>
        Estimate based on 2026 CPF contribution rates and the S$8,000 Ordinary Wage ceiling. PR rates are simplified
        approximations — actual graduated rates may differ. Not tax advice.
      </Disclaimer>

      <div className="faq-section">
        <h2 className="faq-title">Common questions about salary & CPF in Singapore</h2>
        <details className="faq-item">
          <summary>How is CPF calculated on my salary?</summary>
          <p>
            CPF is calculated as a percentage of your Ordinary Wages, up to the $8,000/month ceiling (2026), split
            between you and your employer based on age-based rates. Bonuses and other Additional Wages are subject
            to a separate annual ceiling of $102,000 minus your Ordinary Wages already subject to CPF for the year.
          </p>
        </details>
        <details className="faq-item">
          <summary>What's the difference between OA, SA and MediSave?</summary>
          <p>
            Ordinary Account (OA) can be used for housing, insurance, investment and education. Special Account
            (SA) — becoming your Retirement Account (RA) from age 55 — is for retirement savings and earns a
            higher interest rate. MediSave (MA) is for hospitalisation and approved medical insurance. The split
            between them changes with your age — younger workers get more into OA, older workers get more into
            MediSave and retirement savings.
          </p>
        </details>
        <details className="faq-item">
          <summary>Do PRs pay the same CPF rates as citizens?</summary>
          <p>
            No — new PRs pay lower graduated rates for their first two years of PR status, rising to full rates
            (same as citizens) from their third year onward. This calculator uses simplified approximations for
            PR1/PR2 rates — check CPF Board's official table for your exact figure.
          </p>
        </details>
        <details className="faq-item">
          <summary>Is sales commission treated the same as salary for CPF?</summary>
          <p>
            If your commission is paid regularly (e.g. monthly, as part of your normal wage structure), it's
            treated as Ordinary Wages just like your base salary. If it's an irregular lump-sum payment instead,
            it's typically treated as Additional Wages (like a bonus), which has a different, separate annual
            ceiling.
          </p>
        </details>
        <details className="faq-item">
          <summary>How much income tax will I actually pay?</summary>
          <p>
            Singapore uses a progressive tax system from 0% to 24%, with the first $20,000 of chargeable income
            tax-free. Your actual tax depends on personal reliefs (CPF relief, Earned Income Relief, and others
            like spouse or parent relief if applicable) that reduce your chargeable income before tax is applied.
            Toggle "Estimate my income tax?" above for a rough figure based on the standard reliefs everyone gets.
          </p>
        </details>
      </div>
    </CalcShell>
  );
}
