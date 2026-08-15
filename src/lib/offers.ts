// Config for the <NextStep> component (src/components/NextStep.tsx).
//
// Order matters per the monetisation plan: show the result first (already
// done by each calculator's own ResultCard), then SG Money's own next step
// (this file's `internal` options), and only *after* that a clearly-labelled
// "Sponsored" card — never before the calculation.
//
// IMPORTANT — the `sponsor` field below is intentionally left undefined for
// every intent right now. There is no real, vetted, Singapore-financial-
// -services-verified advertiser wired up yet (see the plan's note on MAS/
// Google's verification requirement for banking/loan/investment/insurance
// ads in Singapore). Do not fill these in with placeholder company names —
// swap in a real partner's actual headline/desc/href when one exists, and
// the card will start rendering automatically. Until then, NextStep just
// shows the internal option, which is honest and still useful on its own.

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
   * Only set this on intents that DON'T already have a strong internal `to`
   * destination — if SG Money has its own good next step, that's the
   * recommendation; don't also clutter it with an "ad space available" card.
   * When set (and `to` is empty and `sponsor` is empty), NextStep shows an
   * honest "this ad spot is available" card instead of nothing.
   */
  adCategory?: string;
  sponsor?: {
    headline: string;
    desc: string;
    ctaLabel: string;
    href: string;
    category: string; // e.g. "mortgage", "insurance" — for the advertiser DB later
  };
}

export const NEXT_STEP_OFFERS: Record<string, NextStepIntent[]> = {
  "hdb-sale-proceeds": [
    {
      id: "buy-hdb",
      icon: "🏠",
      label: "Buy another HDB",
      to: "/",
    },
    {
      id: "buy-condo",
      icon: "🏢",
      label: "Buy a condo",
      to: "/retirement-calculator",
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
      label: "Retire",
      to: "/retirement-calculator",
    },
    {
      id: "just-checking",
      icon: "👀",
      label: "Just checking",
    },
  ],

  "salary-calculator": [
    {
      id: "savings",
      icon: "🏦",
      label: "Grow my savings",
      adCategory: "savings",
    },
    {
      id: "investing",
      icon: "📈",
      label: "Start investing",
      adCategory: "investing",
    },
    {
      id: "insurance",
      icon: "🛡",
      label: "Review my insurance",
      adCategory: "insurance",
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
      label: "Planning retirement",
      to: "/retirement-calculator",
    },
    {
      id: "buying-property",
      icon: "🏢",
      label: "Buying another property",
      adCategory: "mortgage",
    },
    {
      id: "just-checking",
      icon: "👀",
      label: "Just checking",
    },
  ],

  "car-cost-calculator": [
    {
      id: "insurance",
      icon: "🛡",
      label: "Cheaper insurance",
      adCategory: "car-insurance",
    },
    {
      id: "petrol",
      icon: "⛽",
      label: "Save on petrol",
      adCategory: "petrol",
    },
    {
      id: "servicing",
      icon: "🔧",
      label: "Servicing deals",
      adCategory: "car-servicing",
    },
    {
      id: "refinancing",
      icon: "💰",
      label: "Refinance my loan",
      adCategory: "car-loan-refinancing",
    },
  ],
};
