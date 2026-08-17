#!/usr/bin/env node
// Post-build prerender step: writes a real index.html into a subdirectory per
// calculator route, each with its own <title>, meta description, and Open
// Graph tags baked in statically.
//
// Why this exists: with BrowserRouter, "/hdb-sale-proceeds" is a real URL,
// but a plain `vite build` only ever produces one dist/index.html — every
// route serves the *same* generic title/description until React mounts and
// usePageMeta() (src/lib/usePageMeta.ts) updates the DOM client-side.
// Googlebot executes JS before indexing, so it eventually sees the right
// title — but link-preview bots (WhatsApp, iMessage, Telegram, Slack) do NOT
// execute JS, they just read the static HTML `<head>`. Since the plan's own
// "Car vs Grab — Share Result" feature depends on shared links looking right
// in a WhatsApp preview, every route needs correct meta tags in the HTML
// Railway actually serves, not just in the post-hydration DOM.
//
// This intentionally does NOT server-render the calculator UI itself (that
// would need a headless browser or SSR-safe components, and turning that on
// inside Railway's build container is a real operational risk we're not
// taking on for a v0.1). The <body> is still the empty #root the SPA hydrates
// into — full content-in-static-HTML is future work, most sensibly done by
// moving the web target to a proper SSG framework, not by bolting more onto
// this build.
//
// Keep this list in sync with the usePageMeta() calls in src/calculators/*.
// Duplicated on purpose to avoid pulling the Node build step through Vite's
// module graph just to read six strings.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "..", "dist");

const SITE_URL = process.env.SITE_URL || "https://sg-money-web-production.up.railway.app";

const routes = [
  {
    path: "",
    title: "SG-Money-CPF-HDB-Calculator — CPF, Salary & HDB Calculators for Singapore",
    description:
      "Free Singapore money calculators: CPF & salary take-home pay, HDB sale proceeds, CPF accrued interest, retirement and car ownership cost. No login, calculations stay on your device.",
  },
  {
    path: "salary-calculator",
    title: "Singapore Salary & CPF Calculator | SG-Money-CPF-HDB-Calculator",
    description:
      "Free CPF and take-home salary calculator for Singapore. Enter your monthly gross salary to estimate CPF contributions and your actual take-home pay, based on 2026 CPF rates.",
  },
  {
    path: "hdb-sale-proceeds",
    title: "HDB Sale Proceeds Calculator | SG-Money-CPF-HDB-Calculator",
    description:
      "Free HDB sale proceeds calculator for Singapore. Estimate your cash proceeds after CPF refund, outstanding loan, agent commission and other costs when selling your HDB flat.",
  },
  {
    path: "cpf-accrued-interest",
    title: "CPF Accrued Interest Calculator | SG-Money-CPF-HDB-Calculator",
    description:
      "Estimate the CPF accrued interest you'll need to refund when selling a property in Singapore. Free calculator based on CPF principal used and the year you first used it.",
  },
  {
    path: "retirement-calculator",
    title: "Singapore Retirement Calculator | SG-Money-CPF-HDB-Calculator",
    description:
      "Free retirement calculator for Singapore. See if your savings, CPF and monthly investments are on track to meet your target retirement income, and what to change if they're not.",
  },
  {
    path: "car-cost-calculator",
    title: "Car True Cost Calculator Singapore | SG-Money-CPF-HDB-Calculator",
    description:
      "Calculate the true monthly cost of owning a car in Singapore, including loan, petrol, parking, ERP, insurance, road tax and maintenance — plus how it compares to Grab.",
  },
  {
    path: "property-listings",
    title: "Property Listings by District | SG-Money-CPF-HDB-Calculator",
    description:
      "Browse Singapore property listings by postal district (D01–D28), or list your property for free as a CEA-registered agent.",
  },
  {
    path: "backup",
    title: "Backup & Restore Your Data | SG-Money-CPF-HDB-Calculator",
    description:
      "Export everything you've saved across SG Money's calculators to one file, and restore it any time — useful if you use a private/incognito window, clear your browser data, or switch devices.",
  },
];

function renderHead(template, route) {
  const url = `${SITE_URL}/${route.path}`;
  let html = template;

  html = html.replace(/<title>.*?<\/title>/s, `<title>${route.title}</title>`);
  html = html.replace(
    /<meta name="description" content=".*?"\s*\/>/s,
    `<meta name="description" content="${route.description}" />`
  );

  const ogTags = [
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${route.title}" />`,
    `<meta property="og:description" content="${route.description}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta name="twitter:card" content="summary" />`,
    `<link rel="canonical" href="${url}" />`,
  ].join("\n    ");

  html = html.replace("</head>", `    ${ogTags}\n  </head>`);
  return html;
}

async function main() {
  const template = await readFile(path.join(distDir, "index.html"), "utf-8");

  for (const route of routes) {
    const html = renderHead(template, route);
    const outDir = route.path ? path.join(distDir, route.path) : distDir;
    await mkdir(outDir, { recursive: true });
    await writeFile(path.join(outDir, "index.html"), html, "utf-8");
    console.log(`prerendered /${route.path} -> ${path.relative(distDir, outDir)}/index.html`);
  }
}

main().catch((err) => {
  console.error("prerender failed:", err);
  process.exit(1);
});
