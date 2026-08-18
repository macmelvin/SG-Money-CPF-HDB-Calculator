import { useEffect, useMemo, useState } from "react";
import { NEXT_STEP_OFFERS } from "../lib/offers";
import { trackEvent } from "../lib/analytics";

// A small, dismissible banner shown right when someone lands on a
// calculator — unlike the sponsor cards inside <NextStep>, which only
// appear after the person picks a "next step" option, this one needs no
// interaction to show up. Deliberately quiet: text-only, one line where it
// fits, a plain "Sponsored" label rather than anything flashier, and an ✕
// so it's gone for the rest of that visit if it's not wanted.
//
// Pulls from the SAME sponsor pool already configured in lib/offers.ts
// (NEXT_STEP_OFFERS[calculatorId][*].sponsors) rather than a separate list,
// so a calculator with no real advertiser yet (everything except Car Cost,
// today) simply renders nothing here — no placeholder, no "advertise here"
// pitch, since that pitch is aimed at prospective advertisers, not visitors
// looking for their calculator result.
export function SponsorBanner({ calculatorId }: { calculatorId: string }) {
  const [dismissed, setDismissed] = useState(false);

  // Flattens every intent's sponsor list for this calculator into one pool,
  // then picks one at random — same simple rotation NextStep uses for a
  // single intent, just pooled across all of them. Only re-picks if the
  // calculator itself changes (i.e. navigating to a different page), not on
  // every re-render.
  const picked = useMemo(() => {
    const intents = NEXT_STEP_OFFERS[calculatorId] ?? [];
    const pool = intents.flatMap((intent) => (intent.sponsors ?? []).map((sponsor) => ({ intent, sponsor })));
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calculatorId]);

  useEffect(() => {
    if (!picked) return;
    trackEvent("sponsored_offer_viewed", {
      calculator: calculatorId,
      intent: picked.intent.id,
      category: picked.sponsor.category,
      advertiser: picked.sponsor.advertiserId,
      slot: "top-banner",
    });
    // Fire once per mount (per calculator landed on), not on every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked]);

  if (!picked || dismissed) return null;
  const { sponsor } = picked;

  return (
    <div className="sponsor-banner">
      <span className="sponsor-banner-label">Sponsored</span>
      <div className="sponsor-banner-content">
        <span className="sponsor-banner-headline">{sponsor.headline}</span>
        <span className="sponsor-banner-desc">{sponsor.desc}</span>
      </div>
      <a
        href={sponsor.href}
        target="_blank"
        rel="noopener noreferrer"
        className="sponsor-banner-cta"
        onClick={() =>
          trackEvent("sponsored_offer_clicked", {
            calculator: calculatorId,
            intent: picked.intent.id,
            category: sponsor.category,
            advertiser: sponsor.advertiserId,
            slot: "top-banner",
          })
        }
      >
        {sponsor.ctaLabel}
      </a>
      <button
        type="button"
        className="sponsor-banner-dismiss"
        aria-label="Dismiss ad"
        onClick={() => setDismissed(true)}
      >
        ✕
      </button>
    </div>
  );
}
