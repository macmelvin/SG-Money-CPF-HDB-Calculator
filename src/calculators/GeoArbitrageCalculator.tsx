import { useMemo, useState } from "react";
import { CalcShell, Disclaimer, NumberField, ResultCard, ResultRow, SelectField } from "../components/CalcShell";
import { calculateHdbSaleProceeds, formatSgd } from "../lib/cpf";
import type { HdbSaleInput } from "../lib/cpf";
import { clearCalculatorData, loadCalculatorData, saveCalculatorData } from "../lib/storage";
import { usePageMeta } from "../lib/usePageMeta";

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
  cpfLifeIncome: 900,
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
  investmentItems?: Array<{ amount: number }>;
}

function futureValue(principal: number, monthlyContribution: number, annualReturnPct: number, years: number) {
  const months = Math.max(0, years * 12);
  const monthlyRate = annualReturnPct / 100 / 12;
  if (monthlyRate === 0) return principal + monthlyContribution * months;
  return principal * Math.pow(1 + monthlyRate, months) + monthlyContribution * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
}

function growingAnnuityPresentValue(firstYearSpend: number, returnRate: number, inflationRate: number, years: number) {
  if (years <= 0 || firstYearSpend <= 0) return 0;
  if (Math.abs(returnRate - inflationRate) < 0.000001) return firstYearSpend * years / (1 + returnRate);
  return firstYearSpend * (1 - Math.pow((1 + inflationRate) / (1 + returnRate), years)) / (returnRate - inflationRate);
}

function estimateMoneyLastsYears(startingAssets: number, firstYearSpend: number, annualReturn: number, annualInflation: number, maxYears: number) {
  if (firstYearSpend <= 0) return Infinity;
  let balance = Math.max(0, startingAssets);
  let annualSpend = firstYearSpend;
  for (let year = 0; year < maxYears; year += 1) {
    balance = balance * (1 + annualReturn) - annualSpend;
    if (balance < 0) return year + 1;
    annualSpend *= 1 + annualInflation;
  }
  return maxYears;
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
  const savedHdb = loadCalculatorData<HdbSaleInput>(HDB_SALE_STORAGE_KEY);
  const hdbCashProceeds = savedHdb?.data ? calculateHdbSaleProceeds(savedHdb.data).cashProceeds : undefined;
  const retirementImport = retirementSource?.data
    ? {
        currentAge: retirementSource.data.currentAge ?? DEFAULTS.currentAge,
        retirementAge: retirementSource.data.retirementAge ?? DEFAULTS.retirementAge,
        cashSavings: roundCurrency(retirementSource.data.currentSavings ?? DEFAULTS.cashSavings),
        investments: roundCurrency(
          retirementSource.data.investmentItems?.reduce((total, item) => total + item.amount, 0) ?? DEFAULTS.investments
        ),
        accessibleCpf: roundCurrency((retirementSource.data.currentOA ?? 0) + (retirementSource.data.currentSaRa ?? 0)),
        monthlyContributions: roundCurrency(retirementSource.data.monthlyInvestment ?? DEFAULTS.monthlyContributions),
        expectedReturnPct: retirementSource.data.expectedReturnPct ?? DEFAULTS.expectedReturnPct,
        inflationPct: retirementSource.data.inflationRatePct ?? DEFAULTS.inflationPct,
        propertyProceeds: roundCurrency(hdbCashProceeds ?? DEFAULTS.propertyProceeds),
      }
    : null;
  // A saved Geo scenario belongs to the user and wins on return visits. On the first
  // visit, seed shared financial inputs from the other calculators instead of examples.
  const initial = { ...DEFAULTS, ...(saved ? saved.data : retirementImport ?? {}) };

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
    const startingAssets = cashSavings + investments + accessibleCpf + propertyProceeds;
    const projectedAssetsBeforeMove = futureValue(startingAssets, monthlyContributions, expectedReturnPct, yearsToRetirement);
    const projectedRelocationCost = relocationCost * Math.pow(1 + inflationPct / 100, yearsToRetirement);
    const projectedAssets = Math.max(0, projectedAssetsBeforeMove - projectedRelocationCost);
    const destinationMonthlyCosts = bangkokRent + bangkokFood + bangkokHealthcare + bangkokTransport + bangkokLifestyle + bangkokUtilitiesVisa;
    const totalMonthlyCostsToday = destinationMonthlyCosts + retainedSingaporeCosts;
    const monthlyCostsAtRetirement = totalMonthlyCostsToday * Math.pow(1 + inflationPct / 100, yearsToRetirement);
    const passiveIncome = cpfLifeIncome + rentalIncome + pensionIncome + otherPassiveIncome;
    const netMonthlySpend = Math.max(0, monthlyCostsAtRetirement - passiveIncome);
    const requiredNestEgg = growingAnnuityPresentValue(netMonthlySpend * 12, expectedReturnPct / 100, inflationPct / 100, retirementYears);
    const surplus = projectedAssets - requiredNestEgg;
    const lastsYears = estimateMoneyLastsYears(projectedAssets, netMonthlySpend * 12, expectedReturnPct / 100, inflationPct / 100, 100);
    return { yearsToRetirement, retirementYears, startingAssets, projectedRelocationCost, projectedAssets, destinationMonthlyCosts, monthlyCostsAtRetirement, passiveIncome, netMonthlySpend, requiredNestEgg, surplus, lastsYears };
  }, [currentAge, retirementAge, lifeExpectancy, cashSavings, investments, accessibleCpf, propertyProceeds, monthlyContributions, expectedReturnPct, inflationPct, relocationCost, bangkokRent, bangkokFood, bangkokHealthcare, bangkokTransport, bangkokLifestyle, bangkokUtilitiesVisa, retainedSingaporeCosts, cpfLifeIncome, rentalIncome, pensionIncome, otherPassiveIncome]);

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
    setJustImported(true);
  };
  const horizon = result.lastsYears === Infinity
    ? "Indefinitely"
    : result.lastsYears >= result.retirementYears
      ? `Past age ${lifeExpectancy}`
      : `To about age ${retirementAge + result.lastsYears}`;

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
      <p className="explainer">Bangkok, Johor Bahru and Ho Chi Minh City are available now. All cost presets are editable examples in SGD.</p>

      <div className="geo-summary-grid" aria-label="Retirement summary">
        <div className="geo-summary-card"><span>Projected assets</span><strong>{formatSgd(result.projectedAssets)}</strong><small>After relocation cost</small></div>
        <div className="geo-summary-card"><span>Required nest egg</span><strong>{formatSgd(result.requiredNestEgg)}</strong><small>To age {lifeExpectancy}</small></div>
        <div className="geo-summary-card"><span>Net monthly spend</span><strong>{formatSgd(result.netMonthlySpend)}</strong><small>At retirement, after income</small></div>
        <div className={`geo-summary-card ${result.surplus >= 0 ? "positive" : "negative"}`}><span>{result.surplus >= 0 ? "Surplus" : "Shortfall"}</span><strong>{formatSgd(Math.abs(result.surplus))}</strong><small>{result.surplus >= 0 ? "Above target" : "Below target"}</small></div>
        <div className="geo-summary-card"><span>Money-lasts horizon</span><strong>{horizon}</strong><small>Based on entered assumptions</small></div>
      </div>

      <ResultCard title="💰 Assets funding the move">
        {retirementImport ? (
          <>
            <button type="button" className="dashboard-btn" onClick={importSavedPlan}>
              {justImported ? "✓ Retirement numbers imported" : "↻ Import saved Retirement numbers"}
            </button>
            <p className="explainer">
              Uses your latest Retirement Calculator ages, cash, investment holdings, OA + SA/RA, monthly investment, return and inflation
              from the Retirement Calculator{hdbCashProceeds !== undefined ? ", plus cash proceeds from HDB Sale" : ""}.
              Destination costs stay separate and editable. Tap Save above to keep this scenario.
            </p>
          </>
        ) : (
          <p className="explainer">
            Open the Retirement Calculator once in this browser, then return here to import its latest figures automatically.
          </p>
        )}
        <NumberField label="Cash & savings today" value={cashSavings} onChange={setCashSavings} prefix="$" />
        <NumberField label="Investments today" value={investments} onChange={setInvestments} prefix="$" />
        <NumberField label="CPF accessible for retirement" value={accessibleCpf} onChange={setAccessibleCpf} prefix="$" />
        <NumberField label="Expected property sale proceeds" value={propertyProceeds} onChange={setPropertyProceeds} prefix="$" />
        <NumberField label="Monthly contributions until retirement" value={monthlyContributions} onChange={setMonthlyContributions} prefix="$" />
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
        <NumberField label="Housing, family, tax or other commitments" value={retainedSingaporeCosts} onChange={setRetainedSingaporeCosts} prefix="$" suffix="/mo" />
        <p className="explainer">Include expenses that continue after moving, such as property charges, family support, storage, insurance or frequent trips home.</p>
      </ResultCard>

      <ResultCard title="💵 Passive retirement income">
        <NumberField label="CPF LIFE income at retirement" value={cpfLifeIncome} onChange={setCpfLifeIncome} prefix="$" suffix="/mo" />
        <NumberField label="Rental income at retirement" value={rentalIncome} onChange={setRentalIncome} prefix="$" suffix="/mo" />
        <NumberField label="Pension / annuity income" value={pensionIncome} onChange={setPensionIncome} prefix="$" suffix="/mo" />
        <NumberField label="Other passive income" value={otherPassiveIncome} onChange={setOtherPassiveIncome} prefix="$" suffix="/mo" />
        <ResultRow label="Total passive income" value={`${formatSgd(result.passiveIncome)}/mo`} emphasis />
      </ResultCard>

      <ResultCard title="✈️ Relocation & runway">
        <NumberField label="One-time relocation cost today" value={relocationCost} onChange={setRelocationCost} prefix="$" />
        <ResultRow label="Estimated cost at retirement" value={formatSgd(result.projectedRelocationCost)} />
        <ResultRow label="Monthly costs at retirement" value={`${formatSgd(result.monthlyCostsAtRetirement)}/mo`} />
        <ResultRow label="NET MONTHLY SPEND" value={`${formatSgd(result.netMonthlySpend)}/mo`} emphasis />
      </ResultCard>

      <Disclaimer>
        Planning estimate only, not financial, tax, immigration or healthcare advice. All amounts are in SGD. Destination presets are editable examples, not live prices. Verify exchange rates, visa rules, insurance coverage and actual neighbourhood costs before deciding to relocate. CPF amounts should include only funds you expect to be accessible for retirement spending.
      </Disclaimer>
    </CalcShell>
  );
}
