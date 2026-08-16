import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { NEXT_STEP_OFFERS } from "../lib/offers";
import type { Sponsor } from "../lib/offers";
import { trackEvent } from "../lib/analytics";
import { LeadForm } from "./LeadForm";

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

// Everything a <LeadForm> needs to render itself — exposed so a parent page
// can render the form somewhere OTHER than directly under the buttons (see
// hideLeadForm below), e.g. stacked with a standalone AdSpot column instead.
export interface LeadFormRenderInfo {
  calculatorId: string;
  category: string;
  compact: boolean;
  showProjectPicker?: boolean;
  message?: string;
  headline?: string;
  intentLabel: string;
  sponsor?: Sponsor;
}

export function NextStep({
  calculatorId,
  prompt = "What are you planning next?",
  onSelect,
  hideEmbeddedAdSpot,
  hideLeadForm,
  onActiveSponsorChange,
  onSelectionInfoChange,
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
  /**
   * Set true on calculators that already show a standalone AdSpot column
   * elsewhere on the page (Salary & CPF, Car Cost) — suppresses the
   * embedded "Claim this spot" pitch inside the lead form so it doesn't
   * show twice at once. Leave unset on calculators without a standalone
   * column (HDB Sale, CPF Accrued Interest).
   */
  hideEmbeddedAdSpot?: boolean;
  /**
   * Set true to stop NextStep rendering the LeadForm itself under the
   * buttons — instead use onSelectionInfoChange to get everything needed
   * to render a <LeadForm> elsewhere on the page (e.g. Car Cost stacks it
   * with the standalone AdSpot image in a separate column). Leave unset
   * for the normal inline-under-the-buttons layout.
   */
  hideLeadForm?: boolean;
  /**
   * Fires whenever the currently-active sponsor changes (including to/from
   * undefined) — lets the parent page swap its own standalone AdSpot column
   * between the generic "Claim this spot" pitch and this same sponsor's
   * content, so a real sponsor gets shown loudly in BOTH places at once,
   * not just the quieter embedded card. Only relevant alongside
   * hideEmbeddedAdSpot.
   */
  onActiveSponsorChange?: (sponsor: Sponsor | undefined) => void;
  /**
   * Fires with everything needed to render a <LeadForm> whenever the
   * selection changes (null when nothing selected, or the selected intent
   * has no lead form at all e.g. a plain "Continue" link). Only relevant
   * alongside hideLeadForm.
   */
  onSelectionInfoChange?: (info: LeadFormRenderInfo | null) => void;
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

  // Randomly picks one sponsor from this intent's list — a simple rotation
  // so multiple advertisers in the same category get roughly even exposure
  // over many page views, without any backend scheduling. Only re-picks
  // when the selected intent actually changes, not on every re-render.
  const pickedSponsor = useMemo(() => {
    const sponsors = selected?.sponsors;
    if (!sponsors || sponsors.length === 0) return undefined;
    return sponsors[Math.floor(Math.random() * sponsors.length)];
  }, [selectedId]);

  useEffect(() => {
    onActiveSponsorChange?.(pickedSponsor);
  }, [pickedSponsor, onActiveSponsorChange]);

  // The lead form itself now handles BOTH cases: a real sponsor (captures
  // contact info AND opens the advertiser's site on submit) and the open
  // "no partner yet" fallback. Shown for any ad-category intent regardless
  // of whether a sponsor exists — only the copy/behaviour inside differs.
  const showLeadForm = Boolean(selected?.adCategory);
  const adSlotCompact = Boolean(selected?.to);

  useViewedOnce(Boolean(pickedSponsor), () => {
    if (pickedSponsor) {
      trackEvent("sponsored_offer_viewed", {
        calculator: calculatorId,
        intent: selected!.id,
        category: pickedSponsor.category,
        advertiser: pickedSponsor.advertiserId,
      });
    }
  });

  useViewedOnce(showLeadForm && !pickedSponsor, () => {
    if (selected?.adCategory) {
      trackEvent("sponsored_offer_viewed", { calculator: calculatorId, intent: selected.id, category: selected.adCategory, slot: "open" });
    }
  });

  useEffect(() => {
    if (!onSelectionInfoChange) return;
    if (!showLeadForm || !selected) {
      onSelectionInfoChange(null);
      return;
    }
    onSelectionInfoChange({
      calculatorId,
      category: pickedSponsor?.category ?? selected.adCategory!,
      compact: adSlotCompact,
      showProjectPicker: selected.showProjectPicker,
      message: selected.leadFormMessage,
      headline: selected.leadFormHeadline,
      intentLabel: selected.label,
      sponsor: pickedSponsor,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLeadForm, selected, pickedSponsor, adSlotCompact, calculatorId, onSelectionInfoChange]);

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

      {selected?.to && !showLeadForm && (
        <Link to={selected.to} className="next-step-cta">
          Continue →
        </Link>
      )}

      {showLeadForm && !hideLeadForm && (
        <LeadForm
          key={selected!.id}
          calculatorId={calculatorId}
          category={pickedSponsor?.category ?? selected!.adCategory!}
          compact={adSlotCompact}
          showProjectPicker={selected!.showProjectPicker}
          message={selected!.leadFormMessage}
          headline={selected!.leadFormHeadline}
          intentLabel={selected!.label}
          sponsor={pickedSponsor}
          showAdSpot={!hideEmbeddedAdSpot}
        />
      )}
    </div>
  );
}
