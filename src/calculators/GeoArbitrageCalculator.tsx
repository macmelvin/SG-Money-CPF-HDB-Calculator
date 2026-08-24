import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalcShell, Disclaimer, NumberField, ResultCard, ResultRow, SelectField } from "../components/CalcShell";
import { calculateHdbSaleProceeds, formatSgd } from "../lib/cpf";
import type { HdbSaleInput } from "../lib/cpf";
import { clearCalculatorData, loadCalculatorData, saveCalculatorData } from "../lib/storage";
import { usePageMeta } from "../lib/usePageMeta";
import { dateAtAge, sumLineItems } from "../lib/dashboard";
import type { LineItem } from "../lib/dashboard";

type DestinationId = "bangkok" | "johor-bahru" | "ho-chi-minh-city" | "chiang-mai" | "kuala-lumpur" | "penang" | "bali";

interface DestinationCosts {
  rent: number;
  food: number;
  healthcare: number;
  transport: number;
  lifestyle: number;
  utilitiesVisa: number;
}

interface Destination {
  id: DestinationId;
  name: string;
  country: string;
  enabled: boolean;
  currency: string;
  flag: string;
  costs: DestinationCosts;
}

// The selector and cost model are destination-agnostic. Enabling another city only
// requires destination assumptions and (later) removing its disabled option.
const DESTINATIONS: Destination[] = [
  { id: "bangkok", name: "Bangkok", country: "Thailand", enabled: true, currency: "THB", flag: "🇹🇭", costs: { rent: 1200, food: 650, healthcare: 400, transport: 180, lifestyle: 450, utilitiesVisa: 250 } },
  { id: "johor-bahru", name: "Johor Bahru", country: "Malaysia", enabled: true, currency: "MYR", flag: "🇲🇾", costs: { rent: 900, food: 550, healthcare: 350, transport: 180, lifestyle: 350, utilitiesVisa: 180 } },
  { id: "ho-chi-minh-city", name: "Ho Chi Minh City", country: "Vietnam", enabled: true, currency: "VND", flag: "🇻🇳", costs: { rent: 950, food: 500, healthcare: 350, transport: 120, lifestyle: 350, utilitiesVisa: 220 } },
  { id: "chiang-mai", name: "Chiang Mai", country: "Thailand", enabled: false, currency: "THB", flag: "🇹🇭", costs: { rent: 800, food: 500, healthcare: 350, transport: 140, lifestyle: 350, utilitiesVisa: 220 } },
  { id: "kuala-lumpur", name: "Kuala Lumpur", country: "Malaysia", enabled: false, currency: "MYR", flag: "🇲🇾", costs: { rent: 1100, food: 600, healthcare: 400, transport: 200, lifestyle: 400, utilitiesVisa: 180 } },
  { id: "penang", name: "Penang", country: "Malaysia", enabled: false, currency: "MYR", flag: "🇲🇾", costs: { rent: 850, food: 550, healthcare: 350, transport: 180, lifestyle: 350, utilitiesVisa: 180 } },
  { id: "bali", name: "Bali", country: "Indonesia", enabled: false, currency: "IDR", flag: "🇮🇩", costs: { rent: 1000, food: 550, healthcare: 400, transport: 160, lifestyle: 400, utilitiesVisa: 250 } },
];

const DEFAULTS = {
  destinationId: "bangkok" as DestinationId,
  currentAge: 45,
  retirementAge: 60,
  lifeExpectancy: 90,
  expectedReturnPct: 4,
  inflationPct: 2.5,
  cashSavings: 180000,
  investments: 120000,
  accessibleCpf: 150000,
  propertyProceeds: 0,
  monthlyContributions: 1000,
  bangkokRent: 1200,
  bangkokFood: 650,
  bangkokHealthcare: 400,
  bangkokTransport: 180,
  bangkokLifestyle: 450,
  bangkokUtilitiesVisa: 250,
  retainedSingaporeCosts: 500,
  cpfLifeIncome: 0,
  rentalIncome: 0,
  pensionIncome: 0,
  otherPassiveIncome: 0,
  relocationCost: 25000,
};

const STORAGE_KEY = "geo-arbitrage-calculator";
const RETIREMENT_STORAGE_KEY = "retirement-calculator";
const RETIREMENT_LIVE_STORAGE_KEY = "retirement-calculator-geo-sync";
const HDB_SALE_STORAGE_KEY = "hdb-sale-proceeds";

const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

interface SavedRetirementData {
  currentAge?: number;
  retirementAge?: number;
  currentSavings?: number;
  currentOA?: number;
  currentSaRa?: number;
  monthlyInvestment?: number;
  expectedReturnPct?: number;
  inflationRatePct?: number;
  investmentItems?: LineItem[];
  incomeItems?: LineItem[];
  expenseItems?: LineItem[];
  liabilityItems?: LineItem[];
  cpfLifeMonthlyIncome?: number;
  // Mirrors the Retirement Calculator's "Include selling my HDB today in this
  // projection" checkbox. Absent on data saved before this field existed —
  // treated as true (the old, always-include behaviour) so existing saves
  // keep working.
  includeHdbSale?: boolean;
}

function futureValue(principal: number, monthlyContribution: number, annualReturnPct: number, years: number) {
  const months = Math.max(0, years * 12);
  const monthlyRate = annualReturnPct / 100 / 12;
  if (monthlyRate === 0) return principal + monthlyContribution * months;
  return principal * Math.pow(1 + monthlyRate, months) + monthlyContribution * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
}

function annualAmountNeededFromAssets(
  monthlyCost: number,
  monthlyPassiveIncome: number,
  year: number,
  inflationRate: number
) {
  const annualCost = monthlyCost * 12 * Math.pow(1 + inflationRate, year);
  const annualIncome = monthlyPassiveIncome * 12;
  return Math.max(0, annualCost - annualIncome);
}

function calculateRequiredNestEgg(
  monthlyCost: number,
  monthlyPassiveIncome: number,
  years: number,
  annualReturn: number,
  annualInflation: number
) {
  let required = 0;
  for (let year = 0; year < years; year += 1) {
    const withdrawal = annualAmountNeededFromAssets(monthlyCost, monthlyPassiveIncome, year, annualInflation);
    required += withdrawal / Math.pow(1 + annualReturn, year + 1);
  }
  return required;
}

function estimateMoneyLastsYears(
  startingAssets: number,
  monthlyCost: number,
  monthlyPassiveIncome: number,
  annualReturn: number,
  annualInflation: number,
  maxYears: number
) {
  let balance = Math.max(0, startingAssets);
  let requiresAssets = false;
  for (let year = 0; year < maxYears; year += 1) {
    const withdrawal = annualAmountNeededFromAssets(monthlyCost, monthlyPassiveIncome, year, annualInflation);
    requiresAssets ||= withdrawal > 0;
    balance = balance * (1 + annualReturn) - withdrawal;
    if (balance < 0) return year + 1;
  }
  return requiresAssets ? maxYears : Infinity;
}

export default function GeoArbitrageCalculator() {
  usePageMeta(
    "Overseas Retirement & Geo Arbitrage Calculator",
    "Plan an overseas retirement in Bangkok, Johor Bahru or Ho Chi Minh City. Compare projected assets, living costs, retained Singapore expenses and passive income."
  );
  const saved = loadCalculatorData<typeof DEFAULTS>(STORAGE_KEY);
  const savedRetirement = loadCalculatorData<SavedRetirementData>(RETIREMENT_STORAGE_KEY);
  const liveRetirement = loadCalculatorData<SavedRetirementData>(RETIREMENT_LIVE_STORAGE_KEY);
  const retirementSource = liveRetirement ?? savedRetirement;
  const hasLinkedCpfLife = retirementSource?.data.cpfLifeMonthlyIncome !== undefined;
  const hasLinkedIncomeItems = retirementSource?.data.incomeItems !== undefined;
  const linkedRentalIncome = roundCurrency(
    retirementSource?.data.incomeItems
      ?.filter((item) => /rent/i.test(item.label))
      .reduce((total, item) => total + item.amount, 0) ?? 0
  );
  const hasLinkedExpenses = retirementSource?.data.expenseItems !== undefined;
  // Kept as plain arrays here (not summed yet) — the actual total is computed inside the
  // `result` useMemo below, evaluated as of the calendar date the person actually reaches
  // their chosen retirement age, not today. That way an item with an end date before then
  // (a car loan finishing next year) correctly drops out, and one that hasn't started yet
  // correctly counts in, using the same start/end-date rules as the Retirement Calculator.
  const linkedExpenseItems = retirementSource?.data.expenseItems ?? [];
  const linkedLiabilityItems = retirementSource?.data.liabilityItems ?? [];
  const savedHdb = loadCalculatorData<HdbSaleInput>(HDB_SALE_STORAGE_KEY);
  // Respect the Retirement Calculator's "Include selling my HDB today" checkbox — if the
  // person has explicitly unchecked it there, don't assume the sale happens here either.
  // No Retirement data synced yet, or data saved before this flag existed, falls back to
  // the original always-include behaviour.
  const includeHdbInImport = retirementSource?.data.includeHdbSale !== false;
  const hdbCashProceeds =
    savedHdb?.data && includeHdbInImport ? calculateHdbSaleProceeds(savedHdb.data).cashProceeds : undefined;
  const retirementImport = retirementSource?.data
    ? {
        currentAge: retirementSource.data.currentAge ?? DEFAULTS.currentAge,
        retirementAge: retirementSource.data.retirementAge ?? DEFAULTS.retirementAge,
        cashSavings: roundCurrency(retirementSource.data.currentSavings ?? DEFAULTS.cashSavings),
        // ignoreEndDate: an investment/policy's end date marks when it matures and pays out,
        // not when the money disappears — matches the Retirement Calculator's own treatment
        // of this same list, so a matured holding keeps counting here too.
        investments: roundCurrency(
          retirementSource.data.investmentItems
            ? sumLineItems(retirementSource.data.investmentItems, undefined, { ignoreEndDate: true })
            : DEFAULTS.investments
        ),
        accessibleCpf: roundCurrency((retirementSource.data.currentOA ?? 0) + (retirementSource.data.currentSaRa ?? 0)),
        monthlyContributions: roundCurrency(retirementSource.data.monthlyInvestment ?? DEFAULTS.monthlyContributions),
        expectedReturnPct: retirementSource.data.expectedReturnPct ?? DEFAULTS.expectedReturnPct,
        inflationPct: retirementSource.data.inflationRatePct ?? DEFAULTS.inflationPct,
        propertyProceeds: roundCurrency(hdbCashProceeds ?? DEFAULTS.propertyProceeds),
        cpfLifeIncome: roundCurrency(retirementSource.data.cpfLifeMonthlyIncome ?? DEFAULTS.cpfLifeIncome),
        rentalIncome: linkedRentalIncome,
      }
    : null;
  // A saved Geo scenario belongs to the user and wins on return visits. On the first
  // visit, seed shared financial inputs from the other calculators instead of examples.
  const initial = {
    ...DEFAULTS,
    ...(saved ? saved.data : retirementImport ?? {}),
    // CPF LIFE is owned by the Retirement Calculator. Always let its latest
    // calculated payout replace an older Geo scenario's former $900 placeholder.
    ...(hasLinkedCpfLife && retirementImport ? { cpfLifeIncome: retirementImport.cpfLifeIncome } : { cpfLifeIncome: 0 }),
    ...(hasLinkedIncomeItems ? { rentalIncome: linkedRentalIncome } : {}),
  };

  const [destinationId, setDestinationId] = useState<DestinationId>(initial.destinationId);
  const [currentAge, setCurrentAge] = useState(initial.currentAge);
  const [retirementAge, setRetirementAge] = useState(initial.retirementAge);
  const [lifeExpectancy, setLifeExpectancy] = useState(initial.lifeExpectancy);
  const [expectedReturnPct, setExpectedReturnPct] = useState(initial.expectedReturnPct);
  const [inflationPct, setInflationPct] = useState(initial.inflationPct);
  const [cashSavings, setCashSavings] = useState(initial.cashSavings);
  const [investments, setInvestments] = useState(initial.investments);
  const [accessibleCpf, setAccessibleCpf] = useState(initial.accessibleCpf);
  const [propertyProceeds, setPropertyProceeds] = useState(initial.propertyProceeds);
  const [monthlyContributions, setMonthlyContributions] = useState(initial.monthlyContributions);
  const [bangkokRent, setBangkokRent] = useState(initial.bangkokRent);
  const [bangkokFood, setBangkokFood] = useState(initial.bangkokFood);
  const [bangkokHealthcare, setBangkokHealthcare] = useState(initial.bangkokHealthcare);
  const [bangkokTransport, setBangkokTransport] = useState(initial.bangkokTransport);
  const [bangkokLifestyle, setBangkokLifestyle] = useState(initial.bangkokLifestyle);
  const [bangkokUtilitiesVisa, setBangkokUtilitiesVisa] = useState(initial.bangkokUtilitiesVisa);
  const [retainedSingaporeCosts, setRetainedSingaporeCosts] = useState(initial.retainedSingaporeCosts);
  const [cpfLifeIncome, setCpfLifeIncome] = useState(initial.cpfLifeIncome);
  const [rentalIncome, setRentalIncome] = useState(initial.rentalIncome);
  const [pensionIncome, setPensionIncome] = useState(initial.pensionIncome);
  const [otherPassiveIncome, setOtherPassiveIncome] = useState(initial.otherPassiveIncome);
  const [relocationCost, setRelocationCost] = useState(initial.relocationCost);
  const [savedAt, setSavedAt] = useState<number | null>(saved?.savedAt ?? null);
  const [justImported, setJustImported] = useState(!saved && retirementImport !== null);
  const selectedDestination = DESTINATIONS.find((destination) => destination.id === destinationId) ?? DESTINATIONS[0];

  const changeDestination = (nextId: DestinationId) => {
    const next = DESTINATIONS.find((destination) => destination.id === nextId);
    if (!next) return;
    setDestinationId(nextId);
    setBangkokRent(next.costs.rent);
    setBangkokFood(next.costs.food);
    setBangkokHealthcare(next.costs.healthcare);
    setBangkokTransport(next.costs.transport);
    setBangkokLifestyle(next.costs.lifestyle);
    setBangkokUtilitiesVisa(next.costs.utilitiesVisa);
  };

  const values = {
    destinationId, currentAge, retirementAge, lifeExpectancy, expectedReturnPct, inflationPct,
    cashSavings, investments, accessibleCpf, propertyProceeds, monthlyContributions,
    bangkokRent, bangkokFood, bangkokHealthcare, bangkokTransport, bangkokLifestyle,
    bangkokUtilitiesVisa, retainedSingaporeCosts, cpfLifeIncome, rentalIncome, pensionIncome,
    otherPassiveIncome, relocationCost,
  };

  const result = useMemo(() => {
    const yearsToRetirement = Math.max(0, retirementAge - currentAge);
    const retirementYears = Math.max(0, lifeExpectancy - retirementAge);
    // CPF OA/SA-RA isn't actually accessible for retirement funding before age 65 (Payout
    // Eligibility Age) — same cutoff already used for CPF LIFE income below. Before that,
    // only cash, investments and property proceeds count toward what's actually available.
    const cpfCountedInAssets = retirementAge >= 65 ? accessibleCpf : 0;
    const startingAssets = cashSavings + investments + cpfCountedInAssets + propertyProceeds;
    const projectedAssetsBeforeMove = futureValue(startingAssets, monthlyContributions, expectedReturnPct, yearsToRetirement);
    const projectedRelocationCost = relocationCost * Math.pow(1 + inflationPct / 100, yearsToRetirement);
    const projectedAssets = Math.max(0, projectedAssetsBeforeMove - projectedRelocationCost);
    const destinationMonthlyCosts = bangkokRent + bangkokFood + bangkokHealthcare + bangkokTransport + bangkokLifestyle + bangkokUtilitiesVisa;
    // Expenses/liabilities linked from the Retirement Calculator, checked against the date
    // the person actually reaches retirementAge (today, if "Retire now" is picked) — not
    // just today's date — so this stays correct no matter which retirement age is chosen.
    const retirementDate = dateAtAge(currentAge, retirementAge);
    const retainedExpensesAtRetirement = roundCurrency(
      sumLineItems(linkedExpenseItems, retirementDate) + sumLineItems(linkedLiabilityItems, retirementDate)
    );
    const retainedCostsUsed = retainedExpensesAtRetirement + retainedSingaporeCosts;
    const totalMonthlyCostsToday = destinationMonthlyCosts + retainedCostsUsed;
    const monthlyCostsBeforeInflation = totalMonthlyCostsToday;
    const monthlyCostsAtRetirement = totalMonthlyCostsToday * Math.pow(1 + inflationPct / 100, yearsToRetirement);
    const otherIncome = pensionIncome + otherPassiveIncome;
    const passiveIncome = retirementAge < 65
      ? rentalIncome + otherIncome
      : cpfLifeIncome + otherIncome;
    const netMonthlySpend = Math.max(0, monthlyCostsAtRetirement - passiveIncome);
    const monthlyIncomeSurplus = Math.max(0, passiveIncome - monthlyCostsAtRetirement);
    const requiredNestEgg = calculateRequiredNestEgg(monthlyCostsAtRetirement, passiveIncome, retirementYears, expectedReturnPct / 100, inflationPct / 100);
    const surplus = projectedAssets - requiredNestEgg;
    const lastsYears = estimateMoneyLastsYears(projectedAssets, monthlyCostsAtRetirement, passiveIncome, expectedReturnPct / 100, inflationPct / 100, 100);
    return { yearsToRetirement, retirementYears, startingAssets, cpfCountedInAssets, projectedRelocationCost, projectedAssets, destinationMonthlyCosts, retainedExpensesAtRetirement, retainedCostsUsed, monthlyCostsBeforeInflation, monthlyCostsAtRetirement, passiveIncome, netMonthlySpend, monthlyIncomeSurplus, requiredNestEgg, surplus, lastsYears };
  }, [currentAge, retirementAge, lifeExpectancy, cashSavings, investments, accessibleCpf, propertyProceeds, monthlyContributions, expectedReturnPct, inflationPct, relocationCost, bangkokRent, bangkokFood, bangkokHealthcare, bangkokTransport, bangkokLifestyle, bangkokUtilitiesVisa, retainedSingaporeCosts, linkedExpenseItems, linkedLiabilityItems, cpfLifeIncome, rentalIncome, pensionIncome, otherPassiveIncome]);

  const save = () => {
    saveCalculatorData(STORAGE_KEY, values);
    setSavedAt(Date.now());
  };
  const clear = () => {
    clearCalculatorData(STORAGE_KEY);
    window.location.reload();
  };
  const importSavedPlan = () => {
    if (!retirementImport) return;
    setCurrentAge(retirementImport.currentAge);
    setRetirementAge(retirementImport.retirementAge);
    setCashSavings(retirementImport.cashSavings);
    setInvestments(retirementImport.investments);
    setAccessibleCpf(retirementImport.accessibleCpf);
    setMonthlyContributions(retirementImport.monthlyContributions);
    setExpectedReturnPct(retirementImport.expectedReturnPct);
    setInflationPct(retirementImport.inflationPct);
    setPropertyProceeds(retirementImport.propertyProceeds);
    setCpfLifeIncome(retirementImport.cpfLifeIncome);
    setRentalIncome(retirementImport.rentalIncome);
    setJustImported(true);
  };
  const horizon = result.lastsYears === Infinity
    ? "Indefinitely"
    : result.lastsYears >= result.retirementYears
      ? `Past age ${lifeExpectancy}`
      : `To about age ${retirementAge + result.lastsYears}`;
  const feasibilityScale = Math.max(result.projectedAssets, result.requiredNestEgg, 1);
  const projectedAssetsPct = (result.projectedAssets / feasibilityScale) * 100;
  const requiredNestEggPct = (result.requiredNestEgg / feasibilityScale) * 100;
  const fundingRatio = result.requiredNestEgg > 0
    ? Math.round((result.projectedAssets / result.requiredNestEgg) * 100)
    : Infinity;
  const incomeIfRetireNow = rentalIncome + pensionIncome + otherPassiveIncome;
  const incomeFromAge65 = cpfLifeIncome + pensionIncome + otherPassiveIncome;
  const monthlyBalanceLabel = result.monthlyIncomeSurplus > 0
    ? "Net monthly surplus"
    : "Monthly amount needed from retirement assets";
  const monthlyBalanceAmount = result.monthlyIncomeSurplus > 0 ? result.monthlyIncomeSurplus : result.netMonthlySpend;
  const quickRetirementAges = Array.from(new Set([currentAge, 55, 60, 62, 65])).filter((age) => age >= currentAge);

  return (
    <CalcShell
      title="🌏 Geo Arbitrage Calculator"
      subtitle={`Could your retirement savings go further in ${selectedDestination.name}? Model the move in Singapore dollars.`}
      onSave={save}
      onClear={clear}
      savedAt={savedAt}
      whatsappTopic={`${selectedDestination.name} Retirement Calculator`}
      showAppSuiteFooter
    >
      <div className="form-grid">
        <SelectField
          label="Destination"
          value={destinationId}
          onChange={changeDestination}
          options={DESTINATIONS.filter((d) => d.enabled).map((d) => ({ value: d.id, label: `${d.name}, ${d.country}` }))}
        />
        <NumberField label="Current age" value={currentAge} onChange={setCurrentAge} />
        <NumberField label="Target retirement age" value={retirementAge} onChange={setRetirementAge} />
        <NumberField label="Life expectancy" value={lifeExpectancy} onChange={setLifeExpectancy} />
        <NumberField label="Expected annual return" value={expectedReturnPct} onChange={setExpectedReturnPct} suffix="%" />
        <NumberField label="Expected inflation" value={inflationPct} onChange={setInflationPct} suffix="%" />
      </div>
      <div className="retirement-age-picker" aria-label="Quick retirement age choices">
        <strong>When do you want to retire?</strong>
        <div>
          {quickRetirementAges.map((age) => (
            <button
              type="button"
              key={age}
              className={retirementAge === age ? "selected" : ""}
              aria-pressed={retirementAge === age}
              onClick={() => setRetirementAge(age)}
            >
              {age === currentAge ? `Retire now (${age})` : `Age ${age}`}
            </button>
          ))}
        </div>
        <small>Before age 65, the plan uses rental income and excludes CPF LIFE. From age 65, it uses CPF LIFE and excludes rental income.</small>
      </div>
      <p className="explainer">Bangkok, Johor Bahru and Ho Chi Minh City are available now. All cost presets are editable examples in SGD.</p>

      <div className="geo-summary-grid" aria-label="Retirement summary">
        <div className="geo-summary-card"><span>Projected assets</span><strong>{formatSgd(result.projectedAssets)}</strong><small>After relocation cost</small></div>
        <div className="geo-summary-card"><span>Required nest egg</span><strong>{formatSgd(result.requiredNestEgg)}</strong><small>To age {lifeExpectancy}</small></div>
        <div className="geo-summary-card"><span>{monthlyBalanceLabel}</span><strong>{formatSgd(monthlyBalanceAmount)}</strong><small>At retirement, after income</small></div>
        <div className={`geo-summary-card ${result.surplus >= 0 ? "positive" : "negative"}`}><span>{result.surplus >= 0 ? "Surplus" : "Shortfall"}</span><strong>{formatSgd(Math.abs(result.surplus))}</strong><small>{result.surplus >= 0 ? "Above target" : "Below target"}</small></div>
        <div className="geo-summary-card"><span>Money-lasts horizon</span><strong>{horizon}</strong><small>Based on entered assumptions</small></div>
      </div>

      <div className="calculation-notes">
        <strong>How these figures are calculated</strong>
        <ul>
          <li><b>Projected assets:</b> your current assets grown at the expected return, plus monthly contributions, less the relocation cost.</li>
          <li><b>Required nest egg:</b> the amount needed at retirement to fund net spending until your life expectancy, allowing for return and inflation.</li>
          <li><b>Amount needed from retirement assets:</b> the after-inflation retirement cost, less passive income.</li>
          <li><b>Surplus / shortfall:</b> projected assets minus the required nest egg.</li>
          <li><b>Money-lasts horizon:</b> a year-by-year projection as assets earn returns and spending rises with inflation.</li>
        </ul>
      </div>

      <section className={`result-card feasibility-chart ${result.surplus >= 0 ? "possible" : "not-yet"}`} aria-live="polite">
        <h3>📊 Can I retire in {selectedDestination.name}?</h3>
        <p className="feasibility-status">
          {result.surplus >= 0
            ? `Yes — possible under these assumptions, with a ${formatSgd(result.surplus)} buffer.`
            : `Not yet — projected assets are ${formatSgd(Math.abs(result.surplus))} below the target.`}
        </p>
        <div className="feasibility-row">
          <div className="feasibility-label"><span>Projected assets</span><strong>{formatSgd(result.projectedAssets)}</strong></div>
          <div className="feasibility-track" role="img" aria-label={`Projected assets ${formatSgd(result.projectedAssets)}`}>
            <div className="feasibility-bar projected" style={{ width: `${projectedAssetsPct}%` }} />
          </div>
        </div>
        <div className="feasibility-row">
          <div className="feasibility-label"><span>Required nest egg</span><strong>{formatSgd(result.requiredNestEgg)}</strong></div>
          <div className="feasibility-track" role="img" aria-label={`Required nest egg ${formatSgd(result.requiredNestEgg)}`}>
            <div className="feasibility-bar required" style={{ width: `${requiredNestEggPct}%` }} />
          </div>
        </div>
        <p className="feasibility-ratio">
          {fundingRatio === Infinity ? "Ongoing passive income covers the modeled spending." : `${fundingRatio}% of the required nest egg funded.`}
        </p>
      </section>

      <ResultCard title="💰 Assets funding the move">
        {hasLinkedCpfLife ? (
          <>
            <button type="button" className="dashboard-btn" onClick={importSavedPlan}>
              {justImported ? "✓ Retirement numbers imported" : "↻ Import saved Retirement numbers"}
            </button>
            <p className="explainer">
              Uses your latest Retirement Calculator ages, cash, investment holdings, OA + SA/RA, monthly investment, return and inflation
              from the Retirement Calculator{hdbCashProceeds !== undefined ? ", plus cash proceeds from HDB Sale" : ""}.
              The linked fields below are read-only. Update them in Retirement or HDB Sale, then tap this import button again.
              Destination costs stay separate and editable. Tap Save above to keep this scenario.
            </p>
          </>
        ) : (
          <p className="explainer">
            Open the Retirement Calculator once in this browser, then return here to import its latest figures automatically.
          </p>
        )}
        <NumberField label="Cash & savings today" value={cashSavings} onChange={setCashSavings} prefix="$" readOnly={retirementImport !== null} />
        <NumberField label="Investments today" value={investments} onChange={setInvestments} prefix="$" readOnly={retirementImport !== null} />
        <NumberField label="CPF accessible for retirement" value={accessibleCpf} onChange={setAccessibleCpf} prefix="$" readOnly={retirementImport !== null} />
        {retirementAge < 65 && (
          <p className="explainer" style={{ marginTop: -6 }}>
            Not counted in the projection below at age {retirementAge} — CPF savings are treated as accessible from
            age 65 (Payout Eligibility Age), same as CPF LIFE income above. Pick Age 65 above to include it.
          </p>
        )}
        <NumberField label="Expected property sale proceeds" value={propertyProceeds} onChange={setPropertyProceeds} prefix="$" readOnly={retirementImport !== null} />
        <NumberField label="Monthly contributions until retirement" value={monthlyContributions} onChange={setMonthlyContributions} prefix="$" readOnly={retirementImport !== null} />
        <ResultRow label="Assets today" value={formatSgd(result.startingAssets)} />
        <ResultRow label={`Projected assets in ${result.yearsToRetirement} years`} value={formatSgd(result.projectedAssets + result.projectedRelocationCost)} emphasis />
      </ResultCard>

      <ResultCard title={`${selectedDestination.flag} ${selectedDestination.name} monthly costs`}>
        <NumberField label="Rent" value={bangkokRent} onChange={setBangkokRent} prefix="$" />
        <NumberField label="Food & groceries" value={bangkokFood} onChange={setBangkokFood} prefix="$" />
        <NumberField label="Healthcare & insurance" value={bangkokHealthcare} onChange={setBangkokHealthcare} prefix="$" />
        <NumberField label="Transport" value={bangkokTransport} onChange={setBangkokTransport} prefix="$" />
        <NumberField label="Lifestyle & travel" value={bangkokLifestyle} onChange={setBangkokLifestyle} prefix="$" />
        <NumberField label="Utilities, mobile & visa allowance" value={bangkokUtilitiesVisa} onChange={setBangkokUtilitiesVisa} prefix="$" />
        <ResultRow label={`${selectedDestination.name} costs today`} value={`${formatSgd(result.destinationMonthlyCosts)}/mo`} emphasis />
      </ResultCard>

      <ResultCard title="🇸🇬 Costs retained in Singapore">
        <NumberField label="Monthly expenses from Retirement Calculator" value={result.retainedExpensesAtRetirement} onChange={() => {}} prefix="$" suffix="/mo" readOnly />
        <p className="explainer">
          {hasLinkedExpenses
            ? retirementAge === currentAge
              ? "Includes every expense and liability from the Retirement Calculator that's active today, based on each item's start/end date."
              : `Includes expenses and liabilities from the Retirement Calculator still active around age ${retirementAge} (in ${result.yearsToRetirement} ${result.yearsToRetirement === 1 ? "year" : "years"}), based on each item's start/end date — so a loan or premium that finishes before then is left out.`
            : "Open the Retirement Calculator and enter your monthly expenses to link them here."}
        </p>
        <NumberField label="Additional costs after moving" value={retainedSingaporeCosts} onChange={setRetainedSingaporeCosts} prefix="$" suffix="/mo" />
        <p className="explainer">Anything not already in your Retirement Calculator list, such as property charges, family support, storage, insurance top-ups, or frequent trips home.</p>
        <ResultRow label="Total retained in Singapore" value={`${formatSgd(result.retainedCostsUsed)}/mo`} emphasis />
      </ResultCard>

      <ResultCard title="💵 Retirement Income & Assets">
        <NumberField label="CPF LIFE income at retirement" value={cpfLifeIncome} onChange={setCpfLifeIncome} prefix="$" suffix="/mo" readOnly />
        {retirementImport ? (
          <p className="explainer">Linked to the Retirement Calculator's estimated CPF LIFE payout. Change the CPF LIFE tier or retirement inputs there, then return here.</p>
        ) : (
          <p className="explainer">No calculated CPF LIFE payout is available yet. Open the <Link to="/retirement-calculator">Retirement Calculator</Link> once to calculate and link it automatically.</p>
        )}
        <NumberField label="Rental income from Retirement Calculator" value={rentalIncome} onChange={setRentalIncome} prefix="$" suffix="/mo" readOnly={hasLinkedIncomeItems} />
        {hasLinkedIncomeItems ? (
          <p className="explainer">Linked from income entries containing “rent” in the Retirement Calculator's Monthly Cash Flow section.</p>
        ) : (
          <p className="explainer">Add a rental-income line in the Retirement Calculator's Monthly Cash Flow section to link it here.</p>
        )}
        <NumberField label="Pension / annuity income" value={pensionIncome} onChange={setPensionIncome} prefix="$" suffix="/mo" />
        <NumberField label="Other passive income" value={otherPassiveIncome} onChange={setOtherPassiveIncome} prefix="$" suffix="/mo" />
        <div className="retirement-income-summary">
          <ResultRow label="PASSIVE INCOME BEFORE AGE 65" value={`${formatSgd(incomeIfRetireNow)}/mo`} emphasis />
          <ResultRow label="PASSIVE INCOME FROM AGE 65 (WITH CPF LIFE)" value={`${formatSgd(incomeFromAge65)}/mo`} emphasis />
          <ResultRow label="RETIREMENT ASSETS" value={formatSgd(result.projectedAssets)} emphasis />
        </div>
        <p className="explainer">Your passive income is not your spending limit. These projected assets can fund spending above CPF LIFE and are already included in the required nest egg and retirement-feasibility calculations.</p>
      </ResultCard>

      <ResultCard title="✈️ Retirement Costs">
        <NumberField label="Enter your one-time relocation cost today" value={relocationCost} onChange={setRelocationCost} prefix="$" />
        <div className="retirement-cost-details">
          <ResultRow label="1× RELOCATION COST" value={formatSgd(result.projectedRelocationCost)} />
          <ResultRow label="MONTHLY RETIREMENT COST (BEFORE INFLATION)" value={`${formatSgd(result.monthlyCostsBeforeInflation)}/mo`} />
          <ResultRow label="MONTHLY RETIREMENT COST (AFTER INFLATION)" value={`${formatSgd(result.monthlyCostsAtRetirement)}/mo`} />
          <ResultRow label="LESS: PASSIVE INCOME" value={`${formatSgd(result.passiveIncome)}/mo`} />
          <ResultRow label={monthlyBalanceLabel.toUpperCase()} value={`${formatSgd(monthlyBalanceAmount)}/mo`} emphasis positive={result.monthlyIncomeSurplus > 0 ? true : undefined} />
        </div>
      </ResultCard>

      <Disclaimer>
        Planning estimate only, not financial, tax, immigration or healthcare advice. All amounts are in SGD. Destination presets are editable examples, not live prices. Verify exchange rates, visa rules, insurance coverage and actual neighbourhood costs before deciding to relocate. CPF amounts should include only funds you expect to be accessible for retirement spending.
      </Disclaimer>
    </CalcShell>
  );
}
