import { useMemo, useState } from "react";
import { CalcShell, Disclaimer, NumberField, ResultCard, ResultRow, SelectField } from "../components/CalcShell";
import { calculateSalaryCpf, formatSgd } from "../lib/cpf";
import type { CitizenshipStatus } from "../lib/cpf";

export default function SalaryCalculator() {
  const [age, setAge] = useState(35);
  const [monthlyGross, setMonthlyGross] = useState(5000);
  const [monthlyBonus, setMonthlyBonus] = useState(0);
  const [status, setStatus] = useState<CitizenshipStatus>("citizen");

  const result = useMemo(
    () => calculateSalaryCpf({ age, monthlyGross, monthlyBonus, status }),
    [age, monthlyGross, monthlyBonus, status]
  );

  return (
    <CalcShell title="💰 Salary & CPF Calculator" subtitle="Find your estimated take-home pay and CPF contributions.">
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

      <Disclaimer>
        Estimate based on 2026 CPF contribution rates and the S$8,000 Ordinary Wage ceiling. PR rates are simplified
        approximations — actual graduated rates may differ. Not tax advice.
      </Disclaimer>
    </CalcShell>
  );
}
