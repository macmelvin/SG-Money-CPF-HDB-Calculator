import { jsPDF } from "jspdf";
import {
  APP_NAME,
  MARGIN_X,
  PAGE_WIDTH,
  TOP_MARGIN,
  drawFooters,
  drawRows,
  drawSectionTitle,
  ensureSpace,
} from "./pdf";
import type { PdfRow } from "./pdf";
import {
  CPF_LIFE_STANDARD_PAYOUT_2026,
  CPF_RETIREMENT_SUMS_2026,
  calculateRetirement,
  formatSgd,
} from "./cpf";
import type { CpfLifeTargetTier, RetirementInput, RetirementResult } from "./cpf";

export interface PremiumReportInput {
  base: RetirementInput;
  result: RetirementResult;
  cpfLifeTargetTier: CpfLifeTargetTier;
}

const PRIMARY = { r: 179, g: 38, b: 30 }; // matches --primary

function drawCoverPage(doc: jsPDF, input: PremiumReportInput): void {
  const { base, result } = input;

  doc.setFillColor(PRIMARY.r, PRIMARY.g, PRIMARY.b);
  doc.rect(0, 0, PAGE_WIDTH, 220, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(APP_NAME.toUpperCase(), MARGIN_X, 70);

  doc.setFontSize(26);
  doc.text("Premium Retirement Report", MARGIN_X, 110);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text(
    `Prepared for a ${base.currentAge}-year-old planning to retire at ${base.retirementAge}`,
    MARGIN_X,
    140
  );
  doc.text(`Generated ${new Date().toLocaleDateString()}`, MARGIN_X, 160);

  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(
    "A deeper look than the free calculator: scenario comparisons, a year-by-year growth",
    MARGIN_X,
    190
  );
  doc.text("projection, and a written breakdown of where you stand.", MARGIN_X, 204);

  let y = 260;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(20);
  doc.text("At a glance", MARGIN_X, y);
  y += 28;

  const glance: PdfRow[] = [
    { label: "Years to retirement", value: `${result.yearsToRetirement} years` },
    { label: "Projected savings at retirement", value: formatSgd(result.projectedSavings) },
    { label: "Target required", value: formatSgd(result.targetRequired) },
    {
      label: result.onTrack ? "Projected surplus" : "Projected shortfall",
      value: formatSgd(Math.abs(result.shortfall)),
    },
  ];
  y = drawRows(doc, glance, y);

  y += 20;
  doc.setDrawColor(230);
  doc.line(MARGIN_X, y, PAGE_WIDTH - MARGIN_X, y);
  y += 24;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(9.5);
  doc.setTextColor(140);
  const note = doc.splitTextToSize(
    "This report is generated entirely on your device from the numbers you entered — the same as the free calculator. Nothing is sent to a server to produce it. It's a planning aid, not professional financial advice.",
    PAGE_WIDTH - MARGIN_X * 2
  );
  doc.text(note, MARGIN_X, y);
}

function narrativeSummary(input: PremiumReportInput): string {
  const { base, result } = input;
  const shortfallAmt = formatSgd(Math.abs(result.shortfall));

  if (result.onTrack) {
    return (
      `At age ${base.currentAge}, saving and investing on your current path, you're projected to reach ` +
      `${formatSgd(result.projectedSavings)} by age ${base.retirementAge} — ${shortfallAmt} more than the ` +
      `${formatSgd(result.targetRequired)} you'd need to fund ${base.yearsInRetirement ?? 25} years of your desired spending. ` +
      `That gives you room: you could retire a little earlier, spend a bit more in retirement, or simply treat the ` +
      `surplus as a buffer against the assumptions in this report not playing out exactly as modelled (markets, ` +
      `inflation, and CPF policy can all move). The scenarios on the next pages show what changing your retirement ` +
      `age or savings rate would do to this picture.`
    );
  }

  return (
    `At age ${base.currentAge}, on your current savings path, you're projected to reach ` +
    `${formatSgd(result.projectedSavings)} by age ${base.retirementAge} — ${shortfallAmt} short of the ` +
    `${formatSgd(result.targetRequired)} you'd need to fund ${base.yearsInRetirement ?? 25} years of your desired spending. ` +
    `That's not a verdict, it's a starting point: the scenarios on the next pages show three concrete levers — ` +
    `retiring later, saving more each month, or both — and roughly how much of the gap each one closes on its own.`
  );
}

function drawNarrativePage(doc: jsPDF, input: PremiumReportInput): void {
  let y = TOP_MARGIN;
  y = drawSectionTitle(doc, "Where You Stand", y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(40);
  const lines = doc.splitTextToSize(narrativeSummary(input), PAGE_WIDTH - MARGIN_X * 2);
  doc.text(lines, MARGIN_X, y, { lineHeightFactor: 1.5 });
  y += lines.length * 16 + 20;

  y = ensureSpace(doc, y, 26);
  y = drawSectionTitle(doc, "Your Inputs", y);
  const { base } = input;
  const inputRows: PdfRow[] = [
    { label: "Current age", value: `${base.currentAge}` },
    { label: "Target retirement age", value: `${base.retirementAge}` },
    { label: "Current savings (cash/investments)", value: formatSgd(base.currentSavings) },
    { label: "CPF Ordinary Account (OA)", value: formatSgd(base.currentOA) },
    { label: "CPF Special/Retirement Account (SA/RA)", value: formatSgd(base.currentSaRa) },
    { label: "CPF MediSave (MA)", value: formatSgd(base.currentMA) },
    { label: "Monthly investment", value: formatSgd(base.monthlyInvestment) },
    { label: "Expected annual return", value: `${base.expectedReturnPct}%` },
    { label: "Desired retirement spending (today's dollars)", value: `${formatSgd(base.desiredMonthlySpend)}/mo` },
    { label: "Expected inflation rate", value: `${base.inflationRatePct ?? 2.5}%` },
  ];
  drawRows(doc, inputRows, y);
}

// Recomputes the projection at a handful of alternate retirement ages / savings rates so the
// report can show what each lever is actually worth, not just the single number the free
// calculator gives. Everything here reuses the exact same calculateRetirement() the app already
// trusts — no separate/duplicated math to keep in sync.
function drawScenariosPage(doc: jsPDF, input: PremiumReportInput): void {
  const { base } = input;
  let y = TOP_MARGIN;
  y = drawSectionTitle(doc, "Scenario: Retirement Age", y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  const intro = doc.splitTextToSize(
    "How much does retiring a few years earlier or later change your position? Everything else — savings rate, " +
      "expected return, spending — is held the same as your inputs.",
    PAGE_WIDTH - MARGIN_X * 2
  );
  doc.text(intro, MARGIN_X, y);
  y += intro.length * 13 + 16;

  const ageOffsets = [-3, 0, 3, 5];
  const ageRows: PdfRow[] = [];
  for (const offset of ageOffsets) {
    const age = base.retirementAge + offset;
    if (age <= base.currentAge || age > 75) continue;
    const scenario = calculateRetirement({ ...base, retirementAge: age });
    const label = offset === 0 ? `Age ${age} (your plan)` : `Age ${age} (${offset > 0 ? "+" : ""}${offset} yrs)`;
    ageRows.push({
      label,
      value: `${scenario.onTrack ? "Surplus" : "Shortfall"} ${formatSgd(Math.abs(scenario.shortfall))}`,
    });
  }
  y = drawRows(doc, ageRows, y);

  y += 20;
  y = ensureSpace(doc, y, 26);
  y = drawSectionTitle(doc, "Scenario: Monthly Savings", y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  const intro2 = doc.splitTextToSize(
    "How much would saving more each month close the gap by your original target retirement age?",
    PAGE_WIDTH - MARGIN_X * 2
  );
  doc.text(intro2, MARGIN_X, y);
  y += intro2.length * 13 + 16;

  const savingsDeltas = [0, 200, 500, 1000];
  const savingsRows: PdfRow[] = [];
  for (const delta of savingsDeltas) {
    const scenario = calculateRetirement({ ...base, monthlyInvestment: base.monthlyInvestment + delta });
    const label = delta === 0 ? "Current savings (your plan)" : `+${formatSgd(delta)}/mo more`;
    savingsRows.push({
      label,
      value: `${scenario.onTrack ? "Surplus" : "Shortfall"} ${formatSgd(Math.abs(scenario.shortfall))}`,
    });
  }
  drawRows(doc, savingsRows, y);
}

// A simple hand-drawn line chart (jsPDF has no charting library built in) showing projected
// total savings at each age between now and retirement — reusing calculateRetirement() once per
// year on the x-axis rather than modelling growth separately.
function drawProjectionChart(doc: jsPDF, input: PremiumReportInput): void {
  const { base } = input;
  let y = TOP_MARGIN;
  y = drawSectionTitle(doc, "Growth Projection", y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  const intro = doc.splitTextToSize(
    "Projected total savings (cash, investments, and CPF combined) if you retired at each age between now and " +
      "your target — showing the trajectory your current plan is on, not just the endpoint.",
    PAGE_WIDTH - MARGIN_X * 2
  );
  doc.text(intro, MARGIN_X, y);
  y += intro.length * 13 + 24;

  const years = Math.max(1, base.retirementAge - base.currentAge);
  const points: { age: number; savings: number }[] = [];
  for (let age = base.currentAge; age <= base.retirementAge; age++) {
    const scenario = calculateRetirement({ ...base, retirementAge: age });
    points.push({ age, savings: scenario.projectedSavings });
  }

  const chartX = MARGIN_X + 30;
  const chartWidth = PAGE_WIDTH - MARGIN_X * 2 - 30;
  const chartHeight = 220;
  const chartTop = y;
  const chartBottom = chartTop + chartHeight;
  const maxSavings = Math.max(...points.map((p) => p.savings), 1);

  // Axes
  doc.setDrawColor(210);
  doc.line(chartX, chartTop, chartX, chartBottom);
  doc.line(chartX, chartBottom, chartX + chartWidth, chartBottom);

  // Y-axis labels (4 gridlines)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(140);
  for (let i = 0; i <= 4; i++) {
    const val = (maxSavings / 4) * i;
    const gy = chartBottom - (chartHeight * i) / 4;
    doc.setDrawColor(240);
    doc.line(chartX, gy, chartX + chartWidth, gy);
    doc.text(formatSgd(Math.round(val)), MARGIN_X, gy + 3);
  }

  // Line
  doc.setDrawColor(PRIMARY.r, PRIMARY.g, PRIMARY.b);
  doc.setLineWidth(1.6);
  for (let i = 0; i < points.length - 1; i++) {
    const x1 = chartX + (chartWidth * i) / years;
    const x2 = chartX + (chartWidth * (i + 1)) / years;
    const y1 = chartBottom - (chartHeight * points[i].savings) / maxSavings;
    const y2 = chartBottom - (chartHeight * points[i + 1].savings) / maxSavings;
    doc.line(x1, y1, x2, y2);
  }
  doc.setLineWidth(1);

  // X-axis labels — thin out if there are many years so labels don't collide
  const labelEvery = years > 20 ? 5 : years > 10 ? 2 : 1;
  doc.setFontSize(8);
  doc.setTextColor(140);
  points.forEach((p, i) => {
    if (i % labelEvery !== 0 && i !== points.length - 1) return;
    const x = chartX + (chartWidth * i) / years;
    doc.text(`${p.age}`, x - 5, chartBottom + 14);
  });

  drawSectionTitle(doc, "", chartBottom + 30); // reserve nothing, just advance past chart cleanly
}

function drawCpfLifePage(doc: jsPDF, input: PremiumReportInput): void {
  const { result, cpfLifeTargetTier } = input;
  let y = TOP_MARGIN;
  y = drawSectionTitle(doc, "CPF LIFE Tier Comparison", y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  const intro = doc.splitTextToSize(
    "Indicative CPF LIFE Standard Plan monthly payouts at each retirement sum tier, based on CPF Board's " +
      "published 2026 figures. Your selected tier is marked below.",
    PAGE_WIDTH - MARGIN_X * 2
  );
  doc.text(intro, MARGIN_X, y);
  y += intro.length * 13 + 16;

  const tiers: CpfLifeTargetTier[] = ["brs", "frs", "ers"];
  const tierRows: PdfRow[] = tiers.map((tier) => ({
    label: `${tier.toUpperCase()}${tier === cpfLifeTargetTier ? " (your selection)" : ""} — set aside ${formatSgd(
      CPF_RETIREMENT_SUMS_2026[tier]
    )}`,
    value: `~${formatSgd(CPF_LIFE_STANDARD_PAYOUT_2026[tier])}/mo`,
  }));
  y = drawRows(doc, tierRows, y);

  y += 20;
  y = ensureSpace(doc, y, 26);
  y = drawSectionTitle(doc, "Your CPF LIFE Estimate", y);
  const estimateRows: PdfRow[] = [
    { label: "Set aside for your selected tier", value: formatSgd(result.cpfLife.retirementAccountBalance) },
    { label: "Estimated monthly payout", value: `${formatSgd(result.cpfLife.estimatedMonthlyPayout)}/mo` },
  ];
  if (result.cpfLifeExcessCash > 0) {
    estimateRows.push({
      label: "Estimated cash withdrawable at 55 (above this tier)",
      value: formatSgd(result.cpfLifeExcessCash),
    });
  }
  drawRows(doc, estimateRows, y);
}

export function generatePremiumRetirementReport(input: PremiumReportInput): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  drawCoverPage(doc, input);

  doc.addPage();
  drawNarrativePage(doc, input);

  doc.addPage();
  drawScenariosPage(doc, input);

  doc.addPage();
  drawProjectionChart(doc, input);

  doc.addPage();
  drawCpfLifePage(doc, input);

  drawFooters(doc);
  doc.save("sg-money-premium-retirement-report.pdf");
}
