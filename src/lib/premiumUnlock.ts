// Tracks whether this browser has paid for the Premium Retirement Report.
//
// There's no backend/accounts in SG Money, so this is a soft, honor-system gate:
// after a successful Stripe payment, the Payment Link redirects back here with
// ?unlocked=true, and we set a flag in this browser's localStorage. Someone
// determined could open devtools and set the flag themselves without paying —
// that's an accepted trade-off for a low-price, no-backend indie tool, the same
// one plenty of small paid web utilities make. A tamper-proof version would need
// a server to verify the Stripe session, which isn't worth the added
// infrastructure at this price point.

const PREMIUM_UNLOCK_KEY = "sgmoney:premium-report-unlocked";

export function isPremiumReportUnlocked(): boolean {
  try {
    return localStorage.getItem(PREMIUM_UNLOCK_KEY) === "true";
  } catch {
    return false;
  }
}

export function setPremiumReportUnlocked(): void {
  try {
    localStorage.setItem(PREMIUM_UNLOCK_KEY, "true");
  } catch {
    // localStorage unavailable — nothing we can do, fail silently like the rest of the app.
  }
}

// Called once on mount by the Retirement Calculator: if the Stripe Payment
// Link's redirect brought us back here with ?unlocked=true, persist the
// unlock and strip the query param so refreshing/sharing the URL doesn't
// carry it around forever.
export function consumeUnlockRedirect(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("unlocked") !== "true") return false;
    setPremiumReportUnlocked();
    params.delete("unlocked");
    const newSearch = params.toString();
    const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : "") + window.location.hash;
    window.history.replaceState(null, "", newUrl);
    return true;
  } catch {
    return false;
  }
}
