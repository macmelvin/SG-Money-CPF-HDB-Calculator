// Config for the <NextStep> component (src/components/NextStep.tsx).
//
// Order matters per the monetisation plan: show the result first (already
// done by each calculator's own ResultCard), then SG Money's own next step
// (this file's `internal` options), and only *after* that a clearly-labelled
// "Sponsored" card — never before the calculation.
//
// IMPORTANT — the `sponsors` field below is intentionally left undefined
// for every intent right now. There is no real, vetted, Singapore-
// financial-services-verified advertiser wired up yet (see the plan's
// note on MAS/Google's verification requirement for banking/loan/
// investment/insurance ads in Singapore). Do not fill these in with
// placeholder company names — swap in real partners' actual headline/
// desc/href when they exist, and the card will start rendering
// automatically, rotating between them if more than one is listed. Until
// then, NextStep just shows the internal option, which is honest and
// still useful on its own.

// Contact address shown on the "this ad spot is available" fallback card —
// a real, honest CTA for advertisers, not a fake sponsor.
export const ADVERTISER_CONTACT_EMAIL = "macmelvin.tan@gmail.com";

export interface NextStepIntent {
  id: string;
  icon: string;
  label: string;
  /** Internal route to send the user to, or omitted for "just checking / not sure" type intents. */
  to?: string;
  /**
   * Marks this intent as a genuine advertising slot (e.g. "insurance",
   * "mortgage") rather than plain browsing/dismissal ("Just checking").
   * Can be combined with `to` — NextStep shows both the internal
   * recommendation and the ad slot below it, but renders the ad slot in
   * its compact one-line form in that case so it doesn't compete visually
   * with the internal recommendation. When set (and `sponsor` is empty),
   * shows an honest "this ad spot is available" card/line instead of nothing.
   */
  adCategory?: string;
  /**
   * Shows a "Interested in which project?" dropdown (see condoProjects.ts)
   * on the lead form instead of the generic free-text note field. Only set
   * this on genuinely property-related intents.
   */
  showProjectPicker?: boolean;
  /**
   * Custom copy for the lead form's body text, shown when this intent has
   * no sponsor yet. Falls back to a generic "leave your contact" message
   * if omitted — set this when a more specific message makes sense (e.g.
   * naming the kind of specialist who'll follow up).
   */
  leadFormMessage?: string;
  /**
   * Optional bold headline shown above leadFormMessage — a short "why this
   * matters" hook. Only used when leadFormMessage is also set.
   */
  leadFormHeadline?: string;
  /**
   * One or more sponsors for this slot. When more than one is set, NextStep
   * randomly picks a different one on each view — a simple rotation so
   * multiple advertisers in the same category (e.g. 4 different savings
   * accounts) all get roughly even exposure over time, without needing any
   * backend scheduling logic. Each needs a unique `advertiserId` so clicks/
   * views can be tracked per advertiser, not just per category.
   */
  sponsors?: {
    advertiserId: string;
    headline: string;
    desc: string;
    ctaLabel: string;
    href: string;
    category: string; // e.g. "mortgage", "insurance" — for the advertiser DB later
  }[];
}

export const NEXT_STEP_OFFERS: Record<string, NextStepIntent[]> = {
  "hdb-sale-proceeds": [
    {
      id: "buy-condo",
      icon: "🏢",
      label: "Buy a condo",
      to: "/retirement-calculator",
      adCategory: "mortgage",
      showProjectPicker: true,
    },
    {
      id: "downsize",
      icon: "📉",
      label: "Downsize",
      to: "/retirement-calculator?rightsizing=1",
    },
    {
      id: "retire",
      icon: "👴",
      label: "Build Retirement Portfolio",
      to: "/retirement-calculator",
      adCategory: "financial-planning",
      leadFormMessage: "Leave your contact and we will have our retirement specialist contact you to understand your needs first.",
    },
    {
      id: "refinance-loan",
      icon: "💰",
      label: "Refinance my loan",
      adCategory: "home-loan-refinancing",
      leadFormHeadline: "A lower interest rate on your home loan could save you thousands over the years.",
      leadFormMessage: "Leave your name, phone and email and our Refinancing Specialist will reach out to see if you qualify for a better rate.",
    },
  ],

  "salary-calculator": [
    {
      id: "savings",
      icon: "🏦",
      label: "Grow my savings",
      adCategory: "savings",
      leadFormHeadline: "Every year you wait, compound interest quietly costs you thousands.",
      leadFormMessage: "Leave your name, phone and email and our Growth Specialist will reach out to understand your goals.",
    },
    {
      id: "investing",
      icon: "📈",
      label: "Start investing",
      adCategory: "investing",
      leadFormHeadline: "Cash sitting idle loses value to inflation every single day — investing is how you stay ahead of it.",
      leadFormMessage: "Leave your name, phone and email and our Investment Specialist will reach out to understand your goals.",
    },
    {
      id: "insurance",
      icon: "🛡",
      label: "Review my insurance",
      adCategory: "insurance",
      leadFormHeadline: "One uninsured emergency can undo years of careful saving.",
      leadFormMessage: "Leave your name, phone and email and our Financial Advisor will reach out to understand your needs.",
    },
    {
      id: "plan-retirement",
      icon: "👴",
      label: "Plan for retirement",
      to: "/retirement-calculator",
    },
  ],

  "cpf-accrued-interest": [
    {
      id: "selling-hdb",
      icon: "🏠",
      label: "Selling my HDB",
      to: "/hdb-sale-proceeds",
    },
    {
      id: "planning-retirement",
      icon: "👴",
      label: "Build Retirement Portfolio",
      to: "/retirement-calculator",
      adCategory: "financial-planning",
      leadFormMessage: "Leave your contact and we will have our retirement specialist contact you to understand your needs first.",
    },
    {
      id: "buying-property",
      icon: "🏢",
      label: "Buying another property",
      adCategory: "mortgage",
      showProjectPicker: true,
    },
  ],

  "car-cost-calculator": [
    {
      id: "insurance",
      icon: "🛡",
      label: "Cheaper insurance",
      adCategory: "car-insurance",
      leadFormHeadline: "Most drivers overpay on car insurance without ever comparing quotes.",
      leadFormMessage: "Leave your name, phone and email and our Insurance Specialist will reach out to compare rates for you.",
    },
    {
      id: "petrol",
      icon: "⛽",
      label: "Save on petrol",
      adCategory: "petrol",
      leadFormHeadline: "Small savings at the pump add up fast when you're driving every day.",
      leadFormMessage: "Leave your name, phone and email and our Fuel Savings Specialist will reach out with ways to cut your petrol bill.",
    },
    {
      id: "servicing",
      icon: "🔧",
      label: "Servicing deals",
      adCategory: "car-servicing",
      leadFormHeadline: "The workshop your dealer recommends isn't always the best price for the same service.",
      leadFormMessage: "Leave your name, phone and email and our Servicing Specialist will reach out with trusted workshop deals.",
    },
    {
      id: "refinancing",
      icon: "💰",
      label: "Refinance my loan",
      adCategory: "car-loan-refinancing",
      leadFormHeadline: "A lower interest rate on your car loan could free up real cash every month.",
      leadFormMessage: "Leave your name, phone and email and our Refinancing Specialist will reach out to see if you qualify for a better rate.",
    },
    {
      id: "promotions",
      icon: "🏷️",
      label: "Car deals",
      adCategory: "car-deals",
      leadFormHeadline: "Dealers run limited-time promos most buyers never hear about.",
      leadFormMessage: "Leave your name, phone and email and we'll notify you of the latest car deals and promotions.",
      sponsors: [
        {
          advertiserId: "78-automobile",
          headline: "Your happiness is what matters.",
          desc: "Buy smart, sell easy with 78 Automobile.",
          ctaLabel: "Explore Our Cars",
          href: "https://www.sgcarmart.com/used-cars/listing?dl=4228",
          category: "car-deals",
        },
      ],
    },
  ],
};
