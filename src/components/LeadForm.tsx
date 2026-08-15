import { useState } from "react";
import { ADVERTISER_CONTACT_EMAIL } from "../lib/offers";
import { isFirebaseConfigured, submitLead } from "../lib/leads";
import { trackEvent } from "../lib/analytics";
import { CONDO_PROJECTS } from "../lib/condoProjects";
import { AdSpot } from "./AdSpot";

interface SponsorInfo {
  advertiserId: string;
  headline: string;
  desc: string;
  ctaLabel: string;
  href: string;
}

export function LeadForm({
  calculatorId,
  category,
  compact,
  showProjectPicker,
  message,
  headline,
  intentLabel,
  sponsor,
  showAdSpot = true,
}: {
  calculatorId: string;
  category: string;
  compact: boolean;
  showProjectPicker?: boolean;
  message?: string;
  headline?: string;
  intentLabel: string;
  /**
   * When set, this slot has a real advertiser — the form still captures
   * Name/Phone/Email as a lead (so Melvin has a contact list), but on
   * submit ALSO opens the advertiser's actual site in a new tab and shows
   * their real headline/desc/CTA label instead of the generic "no partner
   * yet" copy. Omit for the honest open-slot fallback.
   */
  sponsor?: SponsorInfo;
  /**
   * Set to false on calculators that already show a standalone AdSpot
   * column elsewhere on the page (Salary & CPF, Car Cost) — avoids
   * showing the "Claim this spot" pitch twice at once. Defaults to true
   * so calculators without a standalone column (HDB Sale, CPF Accrued
   * Interest) keep this as their only advertiser pitch.
   */
  showAdSpot?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [projectInterest, setProjectInterest] = useState("");
  const [note, setNote] = useState("");
  const [company, setCompany] = useState(""); // honeypot — real users never see/fill this
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [fieldError, setFieldError] = useState("");

  const configured = isFirebaseConfigured();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (company) {
      // Honeypot tripped — pretend success, don't actually write anything.
      setStatus("done");
      return;
    }
    if (!name.trim() || !phone.trim() || !email.trim()) {
      setFieldError("Enter your name, phone and email first.");
      return;
    }
    if (showProjectPicker && !projectInterest) {
      setFieldError("Pick a project first.");
      return;
    }
    setFieldError("");
    setStatus("submitting");
    const selectedProject = CONDO_PROJECTS.find((p) => p.name === projectInterest.trim());
    const effectiveCategory = showProjectPicker ? selectedProject?.type ?? "Property" : category;
    // For non-property leads there's no project list to fill this in,
    // so default it to the intent's own label (e.g. "Retirement", "Grow my
    // savings") rather than leaving it blank — every lead should show what
    // the person was actually interested in.
    const effectiveProjectInterest = showProjectPicker ? projectInterest.trim() : intentLabel;
    const ok = await submitLead({
      calculator: calculatorId,
      category: effectiveCategory,
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      projectInterest: effectiveProjectInterest,
      note: note.trim(),
    });
    if (ok) {
      setStatus("done");
      trackEvent("lead_submitted", { calculator: calculatorId, category: effectiveCategory });
      if (sponsor) {
        // Real advertiser — send the lead's browser straight to their site,
        // same as clicking a normal sponsored link, but we've also captured
        // the contact details as a lead first.
        window.open(sponsor.href, "_blank", "noopener,noreferrer");
        trackEvent("sponsored_offer_clicked", {
          calculator: calculatorId,
          category: effectiveCategory,
          advertiser: sponsor.advertiserId,
        });
      } else if (selectedProject) {
        // No sponsor yet for this project slot — open a Google search
        // instead of one hand-picked URL per project, since individual
        // listing pages go stale/duplicate/disappear and a search always
        // resolves to something real and current. Skipped for "Not sure
        // yet" since there's nothing specific to search for.
        const query = encodeURIComponent(`${selectedProject.name} Singapore condo`);
        window.open(`https://www.google.com/search?q=${query}`, "_blank", "noopener,noreferrer");
      }
    } else {
      setStatus("error");
    }
  };

  if (!configured) {
    // Firebase isn't wired up yet — fall back to the old advertiser-only
    // mailto link rather than showing a form that can't actually save anything.
    return (
      <div className={`ad-slot-available ${compact ? "compact" : ""}`}>
        <span className="sponsored-label">Ad space</span>
        <p className="ad-slot-text">This spot is open for a relevant, Singapore-verified advertiser.</p>
        <a href={`mailto:${ADVERTISER_CONTACT_EMAIL}?subject=SG%20Money%20ad%20spot`} className="ad-slot-link">
          Contact the owner →
        </a>
      </div>
    );
  }

  if (status === "done") {
    return (
      <div className={`ad-slot-available ${sponsor ? "sponsored" : ""} ${compact ? "compact" : ""}`}>
        <p className="ad-slot-text">
          {sponsor
            ? "Thanks — we've opened the offer in a new tab too."
            : "Thanks — we'll reach out once we have a partner for this."}
          {!sponsor && showProjectPicker && projectInterest && projectInterest !== "Not sure yet"
            ? " Opened that project's page in a new tab too."
            : ""}
        </p>
      </div>
    );
  }

  if (compact && !open) {
    // Kept as a safety fallback in case `open` is ever toggled closed again
    // in future, though nothing currently does that.
    return (
      <div className="ad-slot-available compact">
        <button type="button" className="ad-slot-link ad-slot-link-btn" onClick={() => setOpen(true)}>
          No partner here yet — want us to notify you? →
        </button>
      </div>
    );
  }

  const displayHeadline = sponsor?.headline ?? headline;
  const displayMessage = sponsor?.desc ?? message ?? "Leave your contact and we'll reach out on your interest.";
  const submitLabel = sponsor?.ctaLabel ?? "Get My Free Consultation";

  return (
    <div className={`ad-slot-available ${sponsor ? "sponsored" : ""} ${compact ? "compact" : ""}`}>
      {sponsor && <span className="sponsored-label">Sponsored</span>}
      {displayHeadline && <p className="ad-slot-headline">{displayHeadline}</p>}
      <p className="ad-slot-text">{displayMessage}</p>
      <form onSubmit={handleSubmit} className="lead-form">
        <input
          type="text"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className="lead-form-honeypot"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
        />
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="lead-form-input"
        />
        <input
          type="tel"
          placeholder="Phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="lead-form-input"
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="lead-form-input"
        />
        {showProjectPicker ? (
          <div className="lead-form-project-list">
            {CONDO_PROJECTS.map((p) => (
              <button
                type="button"
                key={p.name}
                className={`lead-form-project-item ${projectInterest === p.name ? "selected" : ""}`}
                onClick={() => setProjectInterest(p.name)}
              >
                <span>{p.name}</span>
                <span className="lead-form-project-type">{p.type}</span>
              </button>
            ))}
            <button
              type="button"
              className={`lead-form-project-item ${projectInterest === "Not sure yet" ? "selected" : ""}`}
              onClick={() => setProjectInterest("Not sure yet")}
            >
              <span>Not sure yet</span>
            </button>
          </div>
        ) : (
          <input
            type="text"
            placeholder="Anything else (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="lead-form-input"
          />
        )}
        {fieldError && <p className="lead-form-error">{fieldError}</p>}
        {status === "error" && <p className="lead-form-error">Something went wrong — try again in a moment.</p>}
        <button type="submit" className="lead-form-submit" disabled={status === "submitting"}>
          {status === "submitting" ? "Sending…" : `${submitLabel} →`}
        </button>
      </form>
      {!sponsor && showAdSpot && <AdSpot label={`SG Money ad spot - ${category}`} />}
    </div>
  );
}
