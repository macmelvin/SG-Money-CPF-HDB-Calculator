import { useState } from "react";
import { ADVERTISER_CONTACT_EMAIL } from "../lib/offers";
import { isFirebaseConfigured, submitLead } from "../lib/leads";
import { trackEvent } from "../lib/analytics";

export function LeadForm({
  calculatorId,
  category,
  compact,
}: {
  calculatorId: string;
  category: string;
  compact: boolean;
}) {
  const [open, setOpen] = useState(!compact);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
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
    if (!name.trim() || !contact.trim()) {
      setFieldError("Enter your name and a way to reach you first.");
      return;
    }
    setFieldError("");
    setStatus("submitting");
    const ok = await submitLead({ calculator: calculatorId, category, name: name.trim(), contact: contact.trim(), note: note.trim() });
    if (ok) {
      setStatus("done");
      trackEvent("lead_submitted", { calculator: calculatorId, category });
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
      <div className={`ad-slot-available ${compact ? "compact" : ""}`}>
        <p className="ad-slot-text">Thanks — we'll reach out once we have a partner for this.</p>
      </div>
    );
  }

  if (compact && !open) {
    return (
      <div className="ad-slot-available compact">
        <button type="button" className="ad-slot-link ad-slot-link-btn" onClick={() => setOpen(true)}>
          No partner here yet — want us to notify you? →
        </button>
      </div>
    );
  }

  return (
    <div className={`ad-slot-available ${compact ? "compact" : ""}`}>
      <span className="sponsored-label">No partner here yet</span>
      <p className="ad-slot-text">Leave your contact and we'll reach out once we have one for this.</p>
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
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="lead-form-input"
        />
        <input
          type="text"
          placeholder="Phone or email"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          className="lead-form-input"
        />
        <input
          type="text"
          placeholder="Anything else (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="lead-form-input"
        />
        {fieldError && <p className="lead-form-error">{fieldError}</p>}
        {status === "error" && <p className="lead-form-error">Something went wrong — try again in a moment.</p>}
        <button type="submit" className="lead-form-submit" disabled={status === "submitting"}>
          {status === "submitting" ? "Sending…" : "Notify me"}
        </button>
      </form>
      <a href={`mailto:${ADVERTISER_CONTACT_EMAIL}?subject=SG%20Money%20ad%20spot`} className="ad-slot-advertiser-link">
        Advertiser? Contact the owner →
      </a>
    </div>
  );
}
