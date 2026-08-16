import { ADVERTISER_CONTACT_EMAIL } from "../lib/offers";
import type { Sponsor } from "../lib/offers";

// A persistent, deliberately eye-catching ad slot — unlike the quiet
// "no partner here yet" fallback inside NextStep (which stays muted on
// purpose, since it's shown to end users mid-calculation), this one's
// entire job is to grab attention. Bold border, tinted background, punchy
// copy, real CTA button.
//
// When a real `sponsor` is passed in (an intent this column sits next to
// currently has an active advertiser), shows THEIR content in this same
// loud style instead of the generic "Claim this spot" pitch — so a real
// sponsor gets shown prominently in two places at once (here, plus the
// quieter embedded card), not just the one people might scroll past.
export function AdSpot({
  label = "SG Money ad spot",
  sponsor,
}: {
  label?: string;
  sponsor?: Sponsor;
}) {
  if (sponsor) {
    return (
      <div className="ad-spot-prominent">
        <span className="ad-spot-prominent-label">SPONSORED</span>
        <p className="ad-spot-prominent-headline">{sponsor.headline}</p>
        <p className="ad-spot-prominent-text">{sponsor.desc}</p>
        {/* Deliberately no CTA/link here — this column is purely visual/attention-grabbing.
            The only way through to the advertiser's site is via the embedded card next
            to the buttons, which requires submitting Name/Phone/Email first. Keeps lead
            capture as a required step rather than letting people bypass it from here. */}
      </div>
    );
  }

  return (
    <div className="ad-spot-prominent">
      <span className="ad-spot-prominent-label">📢 Advertise Here</span>
      <p className="ad-spot-prominent-headline">Your ad could be right here.</p>
      <p className="ad-spot-prominent-text">
        Reach Singaporeans actively researching HDB sales, CPF, retirement and property —
        high-intent traffic, not passive scrolling.
      </p>
      <a
        href={`mailto:${ADVERTISER_CONTACT_EMAIL}?subject=${encodeURIComponent(label)}`}
        className="ad-spot-prominent-cta"
      >
        Claim this spot →
      </a>
    </div>
  );
}

