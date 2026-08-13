# SG-Money-CPF-HDB-Calculator — v0.1 Starter

Singapore money calculators: Salary & CPF, HDB Sale Proceeds, CPF Accrued Interest,
Retirement, and Car True Cost. One React codebase → Web/PWA (for iOS + Android browser
+ Google search traffic) and a Capacitor-wrapped Android app (for Google Play).

All calculations run **locally on the device** — no backend, no accounts, no API calls.

## What's inside

```
src/
  lib/cpf.ts              shared calculation engine (all 5 calculators' math + formatSgd)
  calculators/             one screen per calculator + the Home screen
    Home.tsx
    SalaryCalculator.tsx
    HdbSaleCalculator.tsx
    AccruedInterestCalculator.tsx
    RetirementCalculator.tsx
    CarCostCalculator.tsx
  components/CalcShell.tsx shared form fields + result-card UI primitives
  App.tsx                  routes (HashRouter — see note below)
public/
  manifest.webmanifest     PWA manifest
  icon-192.png / icon-512.png / favicon.svg   placeholder app icons — swap these
capacitor.config.ts         Capacitor project config (appId: sg.money.app)
```

## Run it locally (web)

```bash
npm install
npm run dev        # http://localhost:5173
```

## Build for production (web/PWA)

```bash
npm run build       # outputs to dist/
npm run preview     # serve the production build locally
```

Deploy `dist/` to any static host (Vercel, Netlify, Cloudflare Pages, etc.) for the
web/PWA version that reaches iPhone, Android and desktop users via Google search.

## Turn it into the Android app (Play Store)

This only needs to be done once per machine setup; after that `cap sync` picks up your
web changes.

```bash
npm run build              # 1. build the web app into dist/
npx cap add android        # 2. generate the native Android project (creates /android)
npx cap sync android       # 3. copy the web build + plugins into the Android project
npx cap open android       # 4. opens the /android folder in Android Studio
```

From Android Studio you can run SG-Money-CPF-HDB-Calculator on an emulator or a physical phone, and later
use Build → Generate Signed Bundle/APK to produce the AAB for Google Play or an APK for
sideloading/testing.

After any change to the web app, re-run:

```bash
npm run build && npx cap sync android
```

then rebuild from Android Studio.

## Known simplifications (fix before real launch)

- **CPF rates**: 2026 age-band rates and the S$8,000 Ordinary Wage ceiling are correct
  per CPF Board as of this build, but PR Year 1/Year 2 graduated rates are rough
  approximations, not the exact CPF Board table. Additional Wage (bonus) ceiling logic
  is also simplified (treated as a flat monthly add rather than the annual $102,000 AW
  ceiling formula).
- **CPF accrued interest**: assumes a single lump-sum withdrawal compounded annually at
  a flat 2.5%. Real CPF accrued interest is computed per-withdrawal from the actual
  dates funds were used, at prevailing rates (which have changed over time). Treat the
  result as a rough estimate only — the UI says this explicitly.
- **HDB sale proceeds**: doesn't yet account for resale levy, joint-owner CPF splits, or
  minimum-cash-over-valuation scenarios.
- **Retirement**: doesn't model CPF LIFE payouts or the Retirement Sum tiers (BRS/FRS/ERS)
  — it treats "current CPF retirement savings" as a lump sum only.
- **Routing**: `App.tsx` uses `HashRouter` (URLs like `/#/hdb-sale-proceeds`) so the same
  build works unmodified inside the Capacitor Android WebView. For the public website
  you'll likely want clean URLs (`/hdb-sale-proceeds`) for SEO — swap in `BrowserRouter`
  for the web deployment (most static hosts support an SPA fallback rewrite to
  `index.html`) and keep `HashRouter` for the Capacitor build, or pick one router and
  configure your host's rewrites accordingly.
- **Icons**: `public/icon-*.png` and `favicon.svg` are placeholders generated for this
  starter — replace with real brand assets before publishing.

None of this blocks testing the app end-to-end; it's the punch list for turning this
into a production-ready calculator (see the "Build order" from the product plan: get
Salary/CPF and HDB Sale Proceeds accurate first, since those are the two highest-intent,
most search-driven calculators).
