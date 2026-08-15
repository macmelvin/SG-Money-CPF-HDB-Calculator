import { ADVERTISER_CONTACT_EMAIL } from "../lib/offers";

// A persistent ad slot that always shows on the page it's placed on,
// unlike the ones inside NextStep which only appear once someone taps a
// specific button. This is genuinely more valuable inventory — guaranteed
// visibility to every visitor, not conditional on interaction — so it's
// worth offering separately rather than folding it into the interactive
// flow. Same "honest, no fake sponsor" approach as everywhere else: shows
// a plain "this spot is open" card until a real advertiser is wired in via
// a sponsor prop (not yet built — add if/when this actually sells).
export function AdSpot({ label = "SG Money ad spot" }: { label?: string }) {
  return (
    <div className="ad-slot-available">
      <span className="sponsored-label">Ad space</span>
      <p className="ad-slot-text">This spot is open for a relevant, Singapore-verified advertiser.</p>
      <a
        href={`mailto:${ADVERTISER_CONTACT_EMAIL}?subject=${encodeURIComponent(label)}`}
        className="ad-slot-link"
      >
        Advertiser? Contact the owner →
      </a>
    </div>
  );
}
