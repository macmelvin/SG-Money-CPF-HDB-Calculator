import { useMemo, useState } from "react";
import { BtoPromo, CalcShell, Disclaimer, NumberField, ResultCard, ResultRow, SelectField } from "../components/CalcShell";
import { calculateSalaryCpf, formatSgd } from "../lib/cpf";
import type { CitizenshipStatus } from "../lib/cpf";
import { usePageMeta } from "../lib/usePageMeta";
import { clearCalculatorData, loadCalculatorData, saveCalculatorData } from "../lib/storage";
import { downloadCalculatorPdf } from "../lib/pdf";

const DEFAULTS = {
  age: 35,
  monthlyGross: 5000,
  monthlyBonus: 0,
  status: "citizen" as CitizenshipStatus,
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
  const [monthlyBonus, setMonthlyBonus] = useState(initial.monthlyBonus);
  const [status, setStatus] = useState<CitizenshipStatus>(initial.status);
  const [savedAt, setSavedAt] = useState<number | null>(saved?.savedAt ?? null);

  const result = useMemo(
    () => calculateSalaryCpf({ age, monthlyGross, monthlyBonus, status }),
    [age, monthlyGross, monthlyBonus, status]
  );

  const clearInputs = () => {
    setAge(DEFAULTS.age);
    setMonthlyGross(DEFAULTS.monthlyGross);
    setMonthlyBonus(DEFAULTS.monthlyBonus);
    setStatus(DEFAULTS.status);
    clearCalculatorData(STORAGE_KEY);
    setSavedAt(null);
  };

  const handleSave = () => {
    const at = saveCalculatorData(STORAGE_KEY, { age, monthlyGross, monthlyBonus, status });
    setSavedAt(at);
  };

  const handleDownloadPdf = () => {
    downloadCalculatorPdf({
      calculatorTitle: "Salary & CPF Calculator",
      inputs: [
        { label: "Age", value: String(age) },
        { label: "Monthly gross salary", value: formatSgd(monthlyGross) },
        { label: "Monthly bonus / additional wages", value: formatSgd(monthlyBonus) },
        { label: "Citizenship status", value: STATUS_LABELS[status] },
      ],
      results: [
        { label: "Gross Salary", value: formatSgd(result.grossSalary) },
        { label: "Employee CPF", value: formatSgd(result.employeeCpf) },
        { label: "Estimated take-home", value: formatSgd(result.takeHome) },
        { label: "Employer CPF", value: formatSgd(result.employerCpf) },
        { label: "Total CPF contribution", value: formatSgd(result.totalCpf) },
      ],
      disclaimer:
        "Estimate based on 2026 CPF contribution rates and the S$8,000 Ordinary Wage ceiling. PR rates are simplified approximations. Not tax advice.",
    });
  };

  return (
    <CalcShell
      title="💰 Salary & CPF Calculator"
      subtitle="Find your estimated take-home pay and CPF contributions."
      onClear={clearInputs}
      onSave={handleSave}
      onDownloadPdf={handleDownloadPdf}
      savedAt={savedAt}
    >
      <div className="form-grid">
        <NumberField label="Your age" value={age} onChange={setAge} />
        <NumberField label="Monthly gross salary" value={monthlyGross} onChange={setMonthlyGross} prefix="$" />
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

      <ResultCard title="Your Monthly Salary">
        <ResultRow label="Gross Salary" value={formatSgd(result.grossSalary)} />
        <ResultRow label="Employee CPF" value={`-${formatSgd(result.employeeCpf)}`} positive={false} />
        <ResultRow label="ESTIMATED TAKE-HOME" value={formatSgd(result.takeHome)} emphasis positive />
        <ResultRow label="Employer CPF" value={`+${formatSgd(result.employerCpf)}`} positive />
        <ResultRow label="Total CPF contribution" value={formatSgd(result.totalCpf)} />
      </ResultCard>

      <BtoPromo />

      <Disclaimer>
        Estimate based on 2026 CPF contribution rates and the S$8,000 Ordinary Wage ceiling. PR rates are simplified
        approximations — actual graduated rates may differ. Not tax advice.
      </Disclaimer>
    </CalcShell>
  );
}
