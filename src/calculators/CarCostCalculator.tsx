import { useEffect, useMemo, useRef, useState } from "react";
import { CalcShell, Disclaimer, NumberField, ResultCard, ResultRow, SelectField } from "../components/CalcShell";
import { NextStep } from "../components/NextStep";
import type { LeadFormRenderInfo } from "../components/NextStep";
import { LeadForm } from "../components/LeadForm";
import { AdSpot } from "../components/AdSpot";
import { calculateCarCost, formatSgd } from "../lib/cpf";
import type { FuelType } from "../lib/cpf";
import type { Sponsor } from "../lib/offers";
import { usePageMeta } from "../lib/usePageMeta";
import { clearCalculatorData, loadCalculatorData, saveCalculatorData } from "../lib/storage";
import { downloadCalculatorPdf } from "../lib/pdf";
import { trackEvent } from "../lib/analytics";

const CALCULATOR_ID = "car-cost-calculator";

const STORAGE_KEY = "car-cost-calculator";

const FUEL_TYPE_LABELS: Record<FuelType, string> = {
  petrol: "Petrol",
  diesel: "Diesel",
  electric: "Electric (EV)",
  hybrid: "Petrol-electric hybrid",
};

// Road tax stays a manual input (always matches the person's actual bill),
// but the exact formula differs a lot by fuel type, so we show guidance
// pointing them to the right LTA reference instead of guessing at a
// computed number — getting a government tax formula wrong is worse than
// not showing one. Diesel's Special Tax rate depends on emission standard
// (Euro V vs IV and below), which we have no way to know from this form.
const ROAD_TAX_GUIDANCE: Partial<Record<FuelType, string>> = {
  diesel:
    "Diesel road tax works differently — it's a Special Tax based on engine capacity AND emission standard (Euro V vs Euro IV and below pay very different rates), not the standard petrol schedule. Check your OneMotoring renewal notice for the exact figure.",
  electric:
    "EV road tax is based on motor power (kW), not engine capacity, plus an Additional Flat Component — a different formula entirely from petrol/diesel cars. Check LTA's EV road tax table or your OneMotoring notice for the exact figure.",
};

// VES (Vehicle Emissions Scheme) rebate/surcharge is applied by the dealer
// BEFORE the car is priced and quoted to a buyer — it's already baked into
// "Car purchase price" above, not an extra cost to add on top (unlike GST,
// which genuinely is added at point of sale). This is purely informational
// context, not a calculated line, since the exact band depends on pollutant
// readings (CO2, HC, CO, NOx, PM) that aren't something a buyer can look up
// from this form. Bands were revised for 2026-2027 (Budget 2026) — only EVs
// now get a rebate; hybrids lost theirs entirely.
const VES_NOTE =
  "New cars also carry a Vehicle Emissions Scheme (VES) rebate or surcharge (roughly -$22,500 for the cleanest EVs down to +$35,000 for the most polluting petrol cars, 2026 rates) — but this is already factored into whatever price a dealer quotes you, not an extra cost to add here.";

// GST is a manual field, not auto-computed at a fixed rate, because not every
// car sale actually charges it — e.g. a private sale between individuals, or
// a deal with a seller who isn't GST-registered. Defaults to 9% of the price
// above (the standard rate for a GST-registered dealer) but should be
// adjusted (or set to $0) to match what's actually on your quote/invoice.
const GST_NOTE =
  "Not every car sale charges GST — e.g. private sales or deals with a non-GST-registered seller often don't. This defaults to 9% of the price above (the standard rate for a GST-registered dealer); check your actual quote or invoice and adjust it, or set it to $0 if GST doesn't apply.";

const DEFAULTS = {
  fuelType: "petrol" as FuelType,
  carPrice: 160000,
  gst: 14400,
  downpayment: 60000,
  loanAmount: 100000,
  loanYears: 7,
  interestRatePct: 2.78,
  monthlyPetrol: 300,
  monthlyParking: 150,
  monthlyErp: 80,
  annualInsurance: 1800,
  annualRoadTax: 740,
  annualMaintenance: 1200,
  monthlyGrabSpend: 800,
  ownershipYears: 10,
  planningToRenewCoe: false,
  coeRenewalPqp: 0,
  coeRenewalYears: 10 as 5 | 10,
};

export default function CarCostCalculator() {
  usePageMeta(
    "Car True Cost Calculator Singapore",
    "Calculate the true monthly cost of owning a car in Singapore, including loan, petrol, parking, ERP, insurance, road tax and maintenance — plus how it compares to Grab."
  );
  const saved = loadCalculatorData<typeof DEFAULTS>(STORAGE_KEY);
  const initial = saved?.data ?? DEFAULTS;

  const [fuelType, setFuelType] = useState<FuelType>(initial.fuelType);
  const [carPrice, setCarPrice] = useState(initial.carPrice);
  // Falls back to 9% of the saved car price for data saved before GST became
  // a manual field, so returning users don't suddenly see $0 GST.
  const [gst, setGst] = useState(initial.gst ?? Math.round(initial.carPrice * 0.09));
  const [downpayment, setDownpayment] = useState(initial.downpayment);
  const [loanAmount, setLoanAmount] = useState(initial.loanAmount);
  const [loanYears, setLoanYears] = useState(initial.loanYears);
  const [interestRatePct, setInterestRatePct] = useState(initial.interestRatePct);
  const [monthlyPetrol, setMonthlyPetrol] = useState(initial.monthlyPetrol);
  const [monthlyParking, setMonthlyParking] = useState(initial.monthlyParking);
  const [monthlyErp, setMonthlyErp] = useState(initial.monthlyErp);
  const [annualInsurance, setAnnualInsurance] = useState(initial.annualInsurance);
  const [annualRoadTax, setAnnualRoadTax] = useState(initial.annualRoadTax);
  const [annualMaintenance, setAnnualMaintenance] = useState(initial.annualMaintenance);
  const [monthlyGrabSpend, setMonthlyGrabSpend] = useState(initial.monthlyGrabSpend);
  const [ownershipYears, setOwnershipYears] = useState(initial.ownershipYears);
  const [planningToRenewCoe, setPlanningToRenewCoe] = useState(initial.planningToRenewCoe);
  const [coeRenewalPqp, setCoeRenewalPqp] = useState(initial.coeRenewalPqp);
  const [coeRenewalYears, setCoeRenewalYears] = useState<5 | 10>(initial.coeRenewalYears);
  const [savedAt, setSavedAt] = useState<number | null>(saved?.savedAt ?? null);
  const [activeSponsor, setActiveSponsor] = useState<Sponsor | undefined>(undefined);
  const [selectionInfo, setSelectionInfo] = useState<LeadFormRenderInfo | null>(null);
  const [shareStatus, setShareStatus] = useState<"idle" | "generating" | "done" | "error">("idle");

  useEffect(() => {
    trackEvent("calculator_started", { calculator: CALCULATOR_ID });
  }, []);

  const initialSnapshot = useRef(initial);
  const hasCompletedOnce = useRef(false);

  const result = useMemo(
    () =>
      calculateCarCost({
        carPrice,
        gst,
        downpayment,
        loanAmount,
        loanYears,
        interestRatePct,
        monthlyPetrol,
        monthlyParking,
        monthlyErp,
        annualInsurance,
        annualRoadTax,
        annualMaintenance,
        monthlyGrabSpend,
        ownershipYears,
        coeRenewalPqp: planningToRenewCoe ? coeRenewalPqp : undefined,
        coeRenewalYears,
      }),
    [
      carPrice,
      gst,
      downpayment,
      loanAmount,
      loanYears,
      interestRatePct,
      monthlyPetrol,
      monthlyParking,
      monthlyErp,
      annualInsurance,
      annualRoadTax,
      annualMaintenance,
      monthlyGrabSpend,
      ownershipYears,
      planningToRenewCoe,
      coeRenewalPqp,
      coeRenewalYears,
    ]
  );

  useEffect(() => {
    const s = initialSnapshot.current;
    const changed =
      fuelType !== s.fuelType ||
      carPrice !== s.carPrice ||
      gst !== s.gst ||
      downpayment !== s.downpayment ||
      loanAmount !== s.loanAmount ||
      loanYears !== s.loanYears ||
      interestRatePct !== s.interestRatePct ||
      monthlyPetrol !== s.monthlyPetrol ||
      monthlyParking !== s.monthlyParking ||
      monthlyErp !== s.monthlyErp ||
      annualInsurance !== s.annualInsurance ||
      annualRoadTax !== s.annualRoadTax ||
      annualMaintenance !== s.annualMaintenance;
    if (!hasCompletedOnce.current && changed) {
      hasCompletedOnce.current = true;
      trackEvent("calculator_completed", { calculator: CALCULATOR_ID });
    }
  }, [fuelType, carPrice, gst, downpayment, loanAmount, loanYears, interestRatePct, monthlyPetrol, monthlyParking, monthlyErp, annualInsurance, annualRoadTax, annualMaintenance]);

  const clearInputs = () => {
    setFuelType(DEFAULTS.fuelType);
    setCarPrice(DEFAULTS.carPrice);
    setGst(DEFAULTS.gst);
    setDownpayment(DEFAULTS.downpayment);
    setLoanAmount(DEFAULTS.loanAmount);
    setLoanYears(DEFAULTS.loanYears);
    setInterestRatePct(DEFAULTS.interestRatePct);
    setMonthlyPetrol(DEFAULTS.monthlyPetrol);
    setMonthlyParking(DEFAULTS.monthlyParking);
    setMonthlyErp(DEFAULTS.monthlyErp);
    setAnnualInsurance(DEFAULTS.annualInsurance);
    setAnnualRoadTax(DEFAULTS.annualRoadTax);
    setAnnualMaintenance(DEFAULTS.annualMaintenance);
    setMonthlyGrabSpend(DEFAULTS.monthlyGrabSpend);
    setOwnershipYears(DEFAULTS.ownershipYears);
    setPlanningToRenewCoe(DEFAULTS.planningToRenewCoe);
    setCoeRenewalPqp(DEFAULTS.coeRenewalPqp);
    setCoeRenewalYears(DEFAULTS.coeRenewalYears);
    clearCalculatorData(STORAGE_KEY);
    setSavedAt(null);
  };

  const handleSave = () => {
    const at = saveCalculatorData(STORAGE_KEY, {
      fuelType,
      carPrice,
      gst,
      downpayment,
      loanAmount,
      loanYears,
      interestRatePct,
      monthlyPetrol,
      monthlyParking,
      monthlyErp,
      annualInsurance,
      annualRoadTax,
      annualMaintenance,
      monthlyGrabSpend,
      ownershipYears,
      planningToRenewCoe,
      coeRenewalPqp,
      coeRenewalYears,
    });
    setSavedAt(at);
  };

  const handleDownloadPdf = () => {
    downloadCalculatorPdf({
      calculatorTitle: "Car True Cost Calculator",
      inputs: [
        { label: "Fuel type", value: FUEL_TYPE_LABELS[fuelType] },
        { label: "Car purchase price (excl. GST)", value: formatSgd(carPrice) },
        { label: "GST", value: formatSgd(result.gst) },
        { label: "Total purchase price (incl. GST)", value: formatSgd(result.totalPriceInclGst) },
        { label: "Downpayment", value: formatSgd(downpayment) },
        { label: "Loan amount", value: formatSgd(loanAmount) },
        { label: "Loan duration", value: `${loanYears} years` },
        { label: "Interest rate (flat)", value: `${interestRatePct}%` },
        { label: "Monthly petrol", value: formatSgd(monthlyPetrol) },
        { label: "Monthly parking", value: formatSgd(monthlyParking) },
        { label: "Monthly ERP", value: formatSgd(monthlyErp) },
        { label: "Annual insurance", value: formatSgd(annualInsurance) },
        { label: "Annual road tax", value: formatSgd(annualRoadTax) },
        { label: "Annual maintenance", value: formatSgd(annualMaintenance) },
        { label: "Average monthly Grab spending", value: formatSgd(monthlyGrabSpend) },
        { label: "Intended ownership", value: `${ownershipYears} years` },
      ],
      results: [
        { label: "Loan", value: formatSgd(result.monthlyLoan) },
        { label: "Petrol", value: formatSgd(monthlyPetrol) },
        { label: "Parking", value: formatSgd(monthlyParking) },
        { label: "ERP", value: formatSgd(monthlyErp) },
        { label: "Insurance", value: formatSgd(result.monthlyInsurance) },
        { label: "Road Tax", value: formatSgd(result.monthlyRoadTax) },
        { label: "Maintenance", value: formatSgd(result.monthlyMaintenance) },
        { label: "True Monthly Cost", value: formatSgd(result.totalMonthly) },
        { label: "True Annual Cost", value: formatSgd(result.totalAnnual) },
        { label: "Est. Depreciation", value: `${formatSgd(result.monthlyDepreciation)}/month (${formatSgd(result.annualDepreciation)}/year)` },
        ...(result.coeRenewal
          ? [
              { label: `COE renewal (${coeRenewalYears}yr)`, value: formatSgd(result.coeRenewal.cost) },
              { label: "COE renewal, monthly equivalent", value: `${formatSgd(result.coeRenewal.monthlyEquivalent)}/month` },
            ]
          : []),
        { label: "Car (vs Public Transport)", value: `${formatSgd(result.publicTransportComparison.carCost)}/month` },
        { label: "Public Transport (Adult pass)", value: `${formatSgd(result.publicTransportComparison.ptCost)}/month` },
        ...(result.grabComparison
          ? [
              { label: "Car (vs Grab)", value: `${formatSgd(result.grabComparison.carCost)}/month` },
              { label: "Grab", value: `${formatSgd(result.grabComparison.grabCost)}/month` },
              { label: "Grab saves you approximately", value: `${formatSgd(result.grabComparison.annualSavings)}/year` },
            ]
          : []),
      ],
      disclaimer:
        "Estimate only. Assumes a flat-rate car loan (typical for Singapore) and does not include depreciation, COE renewal, or resale value.",
    });
  };

  const handleShare = async () => {
    const cardEl = document.getElementById("share-card");
    if (!cardEl) return;
    setShareStatus("generating");
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(cardEl, { backgroundColor: "#ffffff", scale: 2 });
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Could not generate image");
      const file = new File([blob], "car-true-cost.png", { type: "image/png" });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "My Car True Cost — SG Money",
          text: "See what a car really costs you in Singapore, free at sgmoney (link).",
        });
        trackEvent("lead_submitted", { calculator: CALCULATOR_ID, category: "share" });
      } else {
        // Desktop / unsupported browsers — trigger a plain download instead.
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "car-true-cost.png";
        a.click();
        URL.revokeObjectURL(url);
      }
      setShareStatus("done");
      setTimeout(() => setShareStatus("idle"), 2500);
    } catch {
      setShareStatus("error");
      setTimeout(() => setShareStatus("idle"), 2500);
    }
  };

  return (
    <CalcShell
      title="🚗 Car True Cost Calculator"
      subtitle="What does owning a car in Singapore really cost you each month?"
      whatsappTopic="Car True Cost Calculator"
      showAppSuiteFooter
      onClear={clearInputs}
      onSave={handleSave}
      onDownloadPdf={handleDownloadPdf}
      savedAt={savedAt}
    >
      <div className="form-grid">
        <SelectField
          label="Fuel type"
          value={fuelType}
          onChange={setFuelType}
          options={[
            { value: "petrol", label: "Petrol" },
            { value: "diesel", label: "Diesel" },
            { value: "electric", label: "Electric (EV)" },
            { value: "hybrid", label: "Petrol-electric hybrid" },
          ]}
        />
        <NumberField label="Car purchase price (incl. COE, excl. GST)" value={carPrice} onChange={setCarPrice} prefix="$" step={1000} />
        <NumberField label="GST" value={gst} onChange={setGst} prefix="$" step={100} />
        <NumberField label="Downpayment" value={downpayment} onChange={setDownpayment} prefix="$" step={1000} />
        <NumberField label="Loan amount" value={loanAmount} onChange={setLoanAmount} prefix="$" step={1000} />
        <NumberField label="Loan duration" value={loanYears} onChange={setLoanYears} suffix="years" />
        <NumberField label="Interest rate (flat)" value={interestRatePct} onChange={setInterestRatePct} suffix="%" step={0.01} />
        <NumberField
          label={fuelType === "electric" ? "Monthly charging cost" : "Monthly petrol"}
          value={monthlyPetrol}
          onChange={setMonthlyPetrol}
          prefix="$"
        />
        <NumberField label="Monthly parking" value={monthlyParking} onChange={setMonthlyParking} prefix="$" />
        <NumberField label="Monthly ERP" value={monthlyErp} onChange={setMonthlyErp} prefix="$" />
        <NumberField label="Annual insurance" value={annualInsurance} onChange={setAnnualInsurance} prefix="$" />
        <NumberField label="Annual road tax" value={annualRoadTax} onChange={setAnnualRoadTax} prefix="$" />
        <NumberField label="Annual maintenance" value={annualMaintenance} onChange={setAnnualMaintenance} prefix="$" />
        <NumberField label="Intended ownership" value={ownershipYears} onChange={setOwnershipYears} suffix="years" />
      </div>

      {ROAD_TAX_GUIDANCE[fuelType] && <p className="explainer">{ROAD_TAX_GUIDANCE[fuelType]}</p>}
      <p className="explainer">{VES_NOTE}</p>
      <p className="explainer">{GST_NOTE}</p>

      <ResultCard title="One-Time Purchase Price">
        <ResultRow label="Car price (excl. GST)" value={formatSgd(carPrice)} />
        <ResultRow label="GST" value={formatSgd(result.gst)} />
        <ResultRow label="TOTAL PRICE (INCL. GST)" value={formatSgd(result.totalPriceInclGst)} emphasis />
        <ResultRow label={`Est. depreciation (${ownershipYears}yr)`} value={`${formatSgd(result.annualDepreciation)}/year`} />
        <ResultRow label="Est. depreciation, monthly" value={formatSgd(result.monthlyDepreciation)} />
      </ResultCard>

      <ResultCard title="COE Renewal">
        <label className="hdb-scenario-toggle">
          <input
            type="checkbox"
            checked={planningToRenewCoe}
            onChange={(e) => setPlanningToRenewCoe(e.target.checked)}
          />
          <span>Planning to renew COE instead of deregistering?</span>
        </label>
        {planningToRenewCoe && (
          <>
            <NumberField
              label="Estimated renewal premium (PQP)"
              value={coeRenewalPqp}
              onChange={setCoeRenewalPqp}
              prefix="$"
              step={1000}
            />
            <SelectField
              label="Renewal term"
              value={String(coeRenewalYears) as "5" | "10"}
              onChange={(v) => setCoeRenewalYears(Number(v) as 5 | 10)}
              options={[
                { value: "10", label: "10 years (100% of PQP, repeatable)" },
                { value: "5", label: "5 years (50% of PQP, one-time only)" },
              ]}
            />
            <p className="explainer">
              Check the live PQP for your vehicle category on OneMotoring before renewing — it changes every
              bidding exercise. Renewing forfeits your PARF rebate for good, so it's worth comparing against what
              you'd get back by deregistering instead.
            </p>
            {result.coeRenewal && (
              <>
                <ResultRow label={`Renewal cost (${coeRenewalYears}yr)`} value={formatSgd(result.coeRenewal.cost)} emphasis />
                <ResultRow label="Monthly equivalent" value={formatSgd(result.coeRenewal.monthlyEquivalent)} />
              </>
            )}
          </>
        )}
      </ResultCard>

      <ResultCard title="Your Car Really Costs" id="share-card">
        <ResultRow label="Loan" value={formatSgd(result.monthlyLoan)} />
        <ResultRow label={fuelType === "electric" ? "Charging" : "Petrol"} value={formatSgd(monthlyPetrol)} />
        <ResultRow label="Parking" value={formatSgd(monthlyParking)} />
        <ResultRow label="ERP" value={formatSgd(monthlyErp)} />
        <ResultRow label="Insurance" value={formatSgd(result.monthlyInsurance)} />
        <ResultRow label="Road Tax" value={formatSgd(result.monthlyRoadTax)} />
        <ResultRow label="Maintenance" value={formatSgd(result.monthlyMaintenance)} />
        <ResultRow label="TRUE MONTHLY COST" value={formatSgd(result.totalMonthly)} emphasis />
        <ResultRow label="TRUE ANNUAL COST" value={formatSgd(result.totalAnnual)} />
      </ResultCard>

      <p className="explainer">
        Depreciation is a simplified straight-line estimate (total price divided by {ownershipYears} years,
        assuming near-zero residual value) — it ignores any PARF/COE rebate you'd get back on deregistration,
        which depends on your car's registration date and current LTA rules (these changed substantially in
        Budget 2026). Your real depreciation is usually lower than this once those rebates are factored in —
        treat this as a conservative ceiling, not a precise forecast.
      </p>

      <button type="button" className="share-result-btn" onClick={handleShare} disabled={shareStatus === "generating"}>
        {shareStatus === "generating" && "Preparing image…"}
        {shareStatus === "done" && "Shared ✓"}
        {shareStatus === "error" && "Couldn't share — try again"}
        {shareStatus === "idle" && "📤 Share my result"}
      </button>

      <ResultCard title="🚕 Car vs Grab">
        <NumberField label="Your average monthly Grab spending" value={monthlyGrabSpend} onChange={setMonthlyGrabSpend} prefix="$" />
        {result.grabComparison && (
          <>
            <ResultRow label="Car" value={`${formatSgd(result.grabComparison.carCost)}/month`} />
            <ResultRow label="Grab" value={`${formatSgd(result.grabComparison.grabCost)}/month`} />
            <ResultRow
              label="Grab saves you approximately"
              value={`${formatSgd(result.grabComparison.annualSavings)}/year`}
              emphasis
              positive={result.grabComparison.annualSavings >= 0}
            />
          </>
        )}
        <ResultRow label="Break-even Grab spend" value={`${formatSgd(result.breakEvenGrabSpend)}/month`} />
      </ResultCard>

      <ResultCard title="🚇 Car vs Public Transport">
        <ResultRow label="Car" value={`${formatSgd(result.publicTransportComparison.carCost)}/month`} />
        <ResultRow label="Public transport (Adult pass)" value={`${formatSgd(result.publicTransportComparison.ptCost)}/month`} />
        <ResultRow
          label="Public transport saves you approximately"
          value={`${formatSgd(result.publicTransportComparison.annualSavings)}/year`}
          emphasis
          positive={result.publicTransportComparison.annualSavings >= 0}
        />
      </ResultCard>

      <NextStep
        calculatorId={CALCULATOR_ID}
        prompt="Car services & deals"
        hideEmbeddedAdSpot
        hideLeadForm
        onActiveSponsorChange={setActiveSponsor}
        onSelectionInfoChange={setSelectionInfo}
      />

      {/* Form + image stacked together as one column, sitting beside the
          buttons instead of directly under them — the standalone ad and the
          lead-capture form now read as one combined sponsored unit. */}
      <div className="car-services-sidebar">
        {selectionInfo && (
          <LeadForm
            calculatorId={selectionInfo.calculatorId}
            category={selectionInfo.category}
            compact={selectionInfo.compact}
            showProjectPicker={selectionInfo.showProjectPicker}
            message={selectionInfo.message}
            headline={selectionInfo.headline}
            intentLabel={selectionInfo.intentLabel}
            sponsor={selectionInfo.sponsor}
            showAdSpot={false}
          />
        )}
        <AdSpot label="SG Money ad spot - Car Cost" sponsor={activeSponsor} />
      </div>

      <p className="explainer">
        Spend more than {formatSgd(result.breakEvenGrabSpend)}/month on Grab and owning this car would actually
        have been cheaper. Public transport comparison based on the $122/month Adult Monthly Travel Pass
        (unlimited MRT/LRT/basic bus), current PTC rates.
      </p>

      <Disclaimer>
        Estimate only. Assumes a flat-rate car loan (typical for Singapore). Depreciation and COE renewal are
        simplified estimates (see the notes above each) — actual figures depend on PARF/COE rebates specific to
        your car's registration date and current LTA rules, which aren't modeled here.
      </Disclaimer>

      <div className="faq-section">
        <h2 className="faq-title">Common questions about car costs in Singapore</h2>
        <details className="faq-item">
          <summary>How much does it really cost to own a car in Singapore?</summary>
          <p>
            Beyond the sticker price, owning a car in Singapore means loan repayments, petrol or charging, parking,
            ERP, insurance, road tax and maintenance every month — plus GST and depreciation on the purchase itself.
            Most owners underestimate the true monthly figure because they only think about the loan. Use the
            calculator above with your own numbers to see the real total.
          </p>
        </details>
        <details className="faq-item">
          <summary>What is COE and why does it make cars so expensive?</summary>
          <p>
            COE (Certificate of Entitlement) is a 10-year license to own and use a vehicle in Singapore, sold
            through a bidding system that caps the total number of cars on the road. The COE premium itself — often
            tens of thousands of dollars — is added on top of the car's Open Market Value, which is why cars cost
            so much more here than in most other countries.
          </p>
        </details>
        <details className="faq-item">
          <summary>Is Grab or public transport cheaper than owning a car?</summary>
          <p>
            For most people who don't drive daily, yes — by a wide margin. This calculator shows exactly how much
            you'd save switching to Grab or public transport based on your own car's true monthly cost, so you can
            see the real number instead of guessing.
          </p>
        </details>
        <details className="faq-item">
          <summary>Should I renew my COE or deregister my car?</summary>
          <p>
            Renewing means paying the Prevailing Quota Premium (PQP) to keep driving the same car for another 5 or
            10 years — but you permanently give up your PARF rebate when you do. Deregistering instead lets you
            collect both your PARF and unused COE rebate, which you can put toward a different car. The right
            choice depends on the current PQP, your car's age, and how those rebates compare — toggle "Planning to
            renew COE?" above to run your own numbers.
          </p>
        </details>
        <details className="faq-item">
          <summary>Does this calculator work for EVs and diesel cars?</summary>
          <p>
            Yes — select your fuel type above. EVs and diesel vehicles have different road tax formulas from
            petrol cars, so instead of guessing at a number, we point you to exactly where to find your real
            figure on OneMotoring.
          </p>
        </details>
      </div>
    </CalcShell>
  );
}
