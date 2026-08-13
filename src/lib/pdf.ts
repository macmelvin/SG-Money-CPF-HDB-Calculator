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

function drawRows(doc: jsPDF, rows: PdfRow[], startY: number): number {
  let y = startY;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(40);
  for (const row of rows) {
    doc.text(row.label, MARGIN_X, y);
    doc.text(row.value, VALUE_X, y);
    y += 20;
  }
  return y;
}

export function downloadCalculatorPdf(spec: PdfSpec): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = 56;

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

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(20);
  doc.text("Your Inputs", MARGIN_X, y);
  y += 18;
  y = drawRows(doc, spec.inputs, y);

  y += 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(20);
  doc.text("Results", MARGIN_X, y);
  y += 18;
  y = drawRows(doc, spec.results, y);

  if (spec.disclaimer) {
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(130);
    const lines = doc.splitTextToSize(spec.disclaimer, PAGE_WIDTH - MARGIN_X * 2);
    doc.text(lines, MARGIN_X, y);
    y += lines.length * 12;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(160);
  doc.text(
    "Generated locally in your browser. No figures were sent to any server.",
    MARGIN_X,
    800
  );

  const filenameSafe = spec.calculatorTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  doc.save(`${filenameSafe}.pdf`);
}
