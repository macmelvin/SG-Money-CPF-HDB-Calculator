import { ADVERTISER_CONTACT_EMAIL } from "../lib/offers";

// A persistent, deliberately eye-catching ad slot — unlike the quiet
// "no partner here yet" fallback inside NextStep (which stays muted on
// purpose, since it's shown to end users mid-calculation), this one's
// entire job is to grab an advertiser's attention. Bold border, tinted
// background, punchy copy, real CTA button — not the honest-but-unobtrusive
// style used elsewhere.
export function AdSpot({ label = "SG Money ad spot" }: { label?: string }) {
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

