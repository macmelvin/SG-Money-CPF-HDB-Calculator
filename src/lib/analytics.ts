// Thin wrapper around the Umami analytics script already loaded in index.html
// (script.js / data-website-id). Umami is privacy-friendly (no cookies, no
// personal data) which is why it was already chosen for a "nothing leaves the
// device" product — this only adds anonymous event *names* and small numeric/
// string properties, never form inputs or calculated dollar amounts tied to a person.
//
// Five funnel events, matching the monetisation plan:
//   calculator_started    - user lands on / opens a calculator
//   calculator_completed  - user has a non-empty result (fires once per session per calc)
//   next_step_selected    - user picked an intent in the NextStep component
//   sponsored_offer_viewed
//   sponsored_offer_clicked
//
// If umami hasn't loaded yet (slow network, ad blocker) calls are silently
// dropped — never throw, never block the UI.

declare global {
  interface Window {
    umami?: {
      track: (eventName: string, data?: Record<string, string | number | boolean>) => void;
    };
  }
}

export type SgMoneyEvent =
  | "calculator_started"
  | "calculator_completed"
  | "next_step_selected"
  | "sponsored_offer_viewed"
  | "sponsored_offer_clicked"
  | "lead_submitted";

export function trackEvent(event: SgMoneyEvent, data?: Record<string, string | number | boolean>): void {
  try {
    window.umami?.track(event, data);
  } catch {
    // analytics must never break the calculator
  }
}
