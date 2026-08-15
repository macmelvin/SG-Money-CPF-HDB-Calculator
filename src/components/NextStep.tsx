import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ADVERTISER_CONTACT_EMAIL, NEXT_STEP_OFFERS } from "../lib/offers";
import { trackEvent } from "../lib/analytics";

// Fires once, the first time a sponsored card actually renders on screen for
// a given intent — not on every re-render.
function useViewedOnce(fire: boolean, event: () => void) {
  const [fired, setFired] = useState(false);
  useEffect(() => {
    if (fire && !fired) {
      event();
      setFired(true);
    }
  }, [fire, fired, event]);
}

export function NextStep({
  calculatorId,
  prompt = "What are you planning next?",
  onSelect,
}: {
  calculatorId: string;
  prompt?: string;
  /**
   * Called with the chosen intent's id whenever the person taps a button
   * below, before navigation happens. Use this to auto-save the current
   * calculator's data — e.g. HDB Sale passes its own handleSave here, so
   * Retirement Calculator has something to read the moment the person
   * lands there via a "Continue" link, instead of silently showing nothing
   * because they never separately tapped Save first.
   */
  onSelect?: (intentId: string) => void;
}) {
  const intents = NEXT_STEP_OFFERS[calculatorId];
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!intents || intents.length === 0) return null;

  const selected = intents.find((i) => i.id === selectedId) ?? null;

  const handleSelect = (id: string) => {
    setSelectedId(id);
    trackEvent("next_step_selected", { calculator: calculatorId, intent: id });
    onSelect?.(id);
  };

  useViewedOnce(Boolean(selected?.sponsor), () => {
    if (selected?.sponsor) {
      trackEvent("sponsored_offer_viewed", { calculator: calculatorId, intent: selected.id, category: selected.sponsor.category });
    }
  });

  const showAdSlotFallback = Boolean(selected?.adCategory && !selected.sponsor);
  const adSlotCompact = Boolean(selected?.to);

  useViewedOnce(showAdSlotFallback, () => {
    if (selected?.adCategory) {
      trackEvent("sponsored_offer_viewed", { calculator: calculatorId, intent: selected.id, category: selected.adCategory, slot: "open" });
    }
  });

  return (
    <div className="next-step">
      <h3 className="next-step-prompt">{prompt}</h3>
      <div className="next-step-options">
        {intents.map((intent) => (
          <button
            key={intent.id}
            type="button"
            className={`next-step-btn ${selectedId === intent.id ? "selected" : ""}`}
            onClick={() => handleSelect(intent.id)}
          >
            <span className="next-step-icon">{intent.icon}</span>
            {intent.label}
          </button>
        ))}
      </div>

      {selected?.to && (
        <Link to={selected.to} className="next-step-cta">
          Continue →
        </Link>
      )}

      {selected?.sponsor && (
        <div className="sponsored-card">
          <span className="sponsored-label">Sponsored</span>
          <p className="sponsored-headline">{selected.sponsor.headline}</p>
          <p className="sponsored-desc">{selected.sponsor.desc}</p>
          <a
            href={selected.sponsor.href}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="sponsored-cta"
            onClick={() =>
              trackEvent("sponsored_offer_clicked", {
                calculator: calculatorId,
                intent: selected.id,
                category: selected.sponsor!.category,
              })
            }
          >
            {selected.sponsor.ctaLabel} →
          </a>
        </div>
      )}

      {showAdSlotFallback && (
        <div className={`ad-slot-available ${adSlotCompact ? "compact" : ""}`}>
          <span className="sponsored-label">Ad space</span>
          <p className="ad-slot-text">
            This spot is open for a relevant, Singapore-verified advertiser.
          </p>
          <a
            href={`mailto:${ADVERTISER_CONTACT_EMAIL}?subject=SG%20Money%20ad%20spot`}
            className="ad-slot-link"
            onClick={() =>
              trackEvent("sponsored_offer_clicked", {
                calculator: calculatorId,
                intent: selected!.id,
                category: selected!.adCategory!,
                slot: "open",
              })
            }
          >
            Contact the owner →
          </a>
        </div>
      )}
    </div>
  );
}
