import { jsPDF } from "jspdf";

export interface PdfRow {
  label: string;
  value: string;
}

export interface PdfSpec {
  calculatorTitle: string;
  inputs: PdfRow[];
  results: PdfRow[];
  disclaimer?: string;
}

const APP_NAME = "SG-Money-CPF-HDB-Calculator";
const MARGIN_X = 48;
const VALUE_X = 360;
const PAGE_WIDTH = 595.28; // A4 pt
const PAGE_HEIGHT = 841.89; // A4 pt
const TOP_MARGIN = 56;
const BOTTOM_LIMIT = 780; // leave room for the per-page footer below this

// Adds a new page and resets to the top margin if the next `needed` points of
// content wouldn't fit above BOTTOM_LIMIT. Every calculator's PDF used to assume
// everything fit on one page — the retirement dashboard's added sections proved
// that wrong, so all drawing now flows through this.
function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > BOTTOM_LIMIT) {
    doc.addPage();
    return TOP_MARGIN;
  }
  return y;
}

function drawSectionTitle(doc: jsPDF, title: string, y: number): number {
  y = ensureSpace(doc, y, 26);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(20);
  doc.text(title, MARGIN_X, y);
  return y + 18;
}

function drawRows(doc: jsPDF, rows: PdfRow[], startY: number): number {
  let y = startY;
  for (const row of rows) {
    // A row with no value is a sub-heading (e.g. "— Net Worth Snapshot —") — give it more air
    // and bolder text rather than rendering it like a label/value pair.
    const isSubheading = row.value === "";
    y = ensureSpace(doc, y, isSubheading ? 26 : 20);
    if (isSubheading) {
      y += 8;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(70);
      doc.text(row.label, MARGIN_X, y);
      y += 18;
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(40);
      doc.text(row.label, MARGIN_X, y);
      doc.text(row.value, VALUE_X, y);
      y += 20;
    }
  }
  return y;
}

function drawFooters(doc: jsPDF): void {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(160);
    doc.text("Generated locally in your browser. No figures were sent to any server.", MARGIN_X, PAGE_HEIGHT - 42);
    if (pageCount > 1) {
      doc.text(`Page ${i} of ${pageCount}`, PAGE_WIDTH - MARGIN_X - 60, PAGE_HEIGHT - 42);
    }
  }
}

export function downloadCalculatorPdf(spec: PdfSpec): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = TOP_MARGIN;

  // Note: jsPDF's built-in fonts only support WinAnsi-encodable characters,
  // so emoji (used freely elsewhere in the app's UI) must be avoided here.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(179, 38, 30); // matches --primary
  doc.text(APP_NAME, MARGIN_X, y);
  y += 26;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(20);
  doc.text(spec.calculatorTitle, MARGIN_X, y);
  y += 16;

  doc.setDrawColor(230);
  doc.line(MARGIN_X, y, PAGE_WIDTH - MARGIN_X, y);
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Generated ${new Date().toLocaleString()}`, MARGIN_X, y);
  y += 30;

  y = drawSectionTitle(doc, "Your Inputs", y);
  y = drawRows(doc, spec.inputs, y);

  y += 12;
  y = drawSectionTitle(doc, "Results", y);
  y = drawRows(doc, spec.results, y);

  if (spec.disclaimer) {
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(130);
    const lines = doc.splitTextToSize(spec.disclaimer, PAGE_WIDTH - MARGIN_X * 2);
    y = ensureSpace(doc, y, lines.length * 12);
    doc.text(lines, MARGIN_X, y);
  }

  drawFooters(doc);

  const filenameSafe = spec.calculatorTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  doc.save(`${filenameSafe}.pdf`);
}
