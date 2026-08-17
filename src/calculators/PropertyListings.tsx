import { useEffect, useState } from "react";
import { CalcShell, NumberField, SelectField, Disclaimer, ResultCard } from "../components/CalcShell";
import { SG_POSTAL_DISTRICTS, getDistrictFromPostalCode, getDistrictInfo } from "../lib/postalDistricts";
import { submitListing, fetchListingsByDistrict, isFirebaseConfigured } from "../lib/listings";
import type { PropertyType, Listing } from "../lib/listings";
import { uploadListingPhotos, MAX_LISTING_PHOTOS } from "../lib/photoUpload";
import { ADVERTISER_CONTACT_EMAIL } from "../lib/offers";
import { usePageMeta } from "../lib/usePageMeta";
import { trackEvent } from "../lib/analytics";

const CALCULATOR_ID = "property-listings";

const CEA_REG_PATTERN = /^R\d{6}[A-Za-z]$/;

const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: "HDB", label: "HDB" },
  { value: "Condo", label: "Condo" },
  { value: "EC", label: "Executive Condo" },
  { value: "Landed", label: "Landed" },
];

function formatSgd(n: number): string {
  return `$${n.toLocaleString("en-SG")}`;
}

export default function PropertyListings() {
  usePageMeta(
    "Property Listings by District — Singapore",
    "Browse property listings by Singapore postal district (D01–D28), or list your property as a CEA-registered agent. Free to browse and list."
  );

  const [selectedDistrict, setSelectedDistrict] = useState<string>(SG_POSTAL_DISTRICTS[8].district); // default D09, a recognisable starting point
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [ceaRegNumber, setCeaRegNumber] = useState("");
  const [agentPhone, setAgentPhone] = useState("");
  const [agentEmail, setAgentEmail] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [propertyType, setPropertyType] = useState<PropertyType>("HDB");
  const [unitDescription, setUnitDescription] = useState("");
  const [price, setPrice] = useState(0);
  const [floorAreaSqft, setFloorAreaSqft] = useState(0);
  const [description, setDescription] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [company, setCompany] = useState(""); // honeypot
  const [formError, setFormError] = useState("");
  const [formStatus, setFormStatus] = useState<"idle" | "uploading" | "submitting" | "done" | "error">("idle");

  const configured = isFirebaseConfigured();
  const derivedDistrict = postalCode ? getDistrictFromPostalCode(postalCode) : null;

  useEffect(() => {
    trackEvent("calculator_started", { calculator: CALCULATOR_ID });
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchListingsByDistrict(selectedDistrict).then((results) => {
      setListings(results);
      setLoading(false);
    });
  }, [selectedDistrict]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    e.target.value = ""; // lets the same file be re-selected later if removed then re-added
    setPhotoFiles((prev) => {
      const combined = [...prev, ...selected].slice(0, MAX_LISTING_PHOTOS);
      return combined;
    });
  };

  useEffect(() => {
    const urls = photoFiles.map((f) => URL.createObjectURL(f));
    setPhotoPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [photoFiles]);

  const removePhoto = (index: number) => {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (company) {
      setFormStatus("done");
      return;
    }
    if (!agentName.trim() || !agentPhone.trim() || !agentEmail.trim()) {
      setFormError("Enter your name, phone and email.");
      return;
    }
    if (!CEA_REG_PATTERN.test(ceaRegNumber.trim())) {
      setFormError("Enter a valid CEA registration number, e.g. R123456A — required on every property listing.");
      return;
    }
    if (!derivedDistrict) {
      setFormError("Enter a valid 6-digit Singapore postal code.");
      return;
    }
    if (!unitDescription.trim() || !price || price <= 0) {
      setFormError("Enter the unit type and an asking price.");
      return;
    }
    if (videoUrl.trim() && !/^https?:\/\//i.test(videoUrl.trim())) {
      setFormError("Video link should be a full URL starting with https://");
      return;
    }
    setFormError("");
    let photoUrls: string[] = [];
    if (photoFiles.length > 0) {
      setFormStatus("uploading");
      try {
        photoUrls = await uploadListingPhotos(photoFiles);
      } catch {
        setFormStatus("error");
        setFormError("Couldn't upload one or more photos — try again, or submit without photos for now.");
        return;
      }
    }
    setFormStatus("submitting");
    const ok = await submitListing({
      agentName: agentName.trim(),
      ceaRegNumber: ceaRegNumber.trim().toUpperCase(),
      agentPhone: agentPhone.trim(),
      agentEmail: agentEmail.trim(),
      postalCode: postalCode.trim(),
      district: derivedDistrict,
      propertyType,
      unitDescription: unitDescription.trim(),
      price,
      floorAreaSqft: floorAreaSqft || undefined,
      description: description.trim(),
      photoUrls: photoUrls.length > 0 ? photoUrls : undefined,
      videoUrl: videoUrl.trim() || undefined,
    });
    if (ok) {
      setFormStatus("done");
      trackEvent("calculator_completed", { calculator: CALCULATOR_ID });
      // Refresh the visible list if the new listing landed in the currently
      // selected district, so the agent sees their own listing appear.
      if (derivedDistrict === selectedDistrict) {
        fetchListingsByDistrict(selectedDistrict).then(setListings);
      }
    } else {
      setFormStatus("error");
    }
  };

  const districtInfo = getDistrictInfo(selectedDistrict);

  return (
    <CalcShell title="🏘️ Property Listings" subtitle="Browse property listings by Singapore postal district, or list your own.">
      <div className="form-grid">
        <SelectField
          label="District"
          value={selectedDistrict}
          onChange={setSelectedDistrict}
          options={SG_POSTAL_DISTRICTS.map((d) => ({ value: d.district, label: `${d.district} — ${d.areas}` }))}
        />
      </div>

      <ResultCard title={`${selectedDistrict} — ${districtInfo?.areas}`}>
        {loading && <p className="ad-slot-text">Loading listings…</p>}
        {!loading && listings.length === 0 && (
          <p className="ad-slot-text">No active listings in this district yet — be the first to list one below.</p>
        )}
        {!loading &&
          listings.map((l) => (
            <div key={l.id} className="listing-row">
              {l.photoUrls && l.photoUrls.length > 0 && (
                <div className="listing-photo-strip">
                  {l.photoUrls.map((url) => (
                    <img key={url} src={url} alt={l.unitDescription} />
                  ))}
                </div>
              )}
              <div className="listing-row-header">
                <span className="listing-row-type">{l.propertyType}</span>
                <span className="listing-row-price">{formatSgd(l.price)}</span>
              </div>
              <p className="listing-row-unit">{l.unitDescription}{l.floorAreaSqft ? ` · ${l.floorAreaSqft} sqft` : ""}</p>
              {l.description && <p className="listing-row-desc">{l.description}</p>}
              {l.videoUrl && (
                <a href={l.videoUrl} target="_blank" rel="noopener noreferrer" className="listing-video-link">
                  ▶ Watch video
                </a>
              )}
              <p className="listing-row-agent">
                {l.agentName} · CEA {l.ceaRegNumber} · {l.agentPhone}
              </p>
            </div>
          ))}
      </ResultCard>

      <button type="button" className="withdrawal-add-btn" onClick={() => setShowForm((s) => !s)}>
        {showForm ? "Hide listing form" : "+ List your property"}
      </button>

      {showForm && (
        <ResultCard title="List Your Property">
          {!configured ? (
            <div className="ad-slot-available">
              <p className="ad-slot-text">
                Listing submission isn't wired up yet on this deployment — email{" "}
                <a href={`mailto:${ADVERTISER_CONTACT_EMAIL}`}>{ADVERTISER_CONTACT_EMAIL}</a> instead.
              </p>
            </div>
          ) : formStatus === "done" ? (
            <p className="ad-slot-text">
              Thanks — your listing is live. It'll appear under {derivedDistrict ?? "the matching district"} for buyers browsing that area.
            </p>
          ) : (
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
              <p className="explainer" style={{ marginTop: 0 }}>
                Every property listing in Singapore is legally required to show the agent's name, CEA registration
                number, and phone number.
              </p>
              <input type="text" placeholder="Your name" value={agentName} onChange={(e) => setAgentName(e.target.value)} className="lead-form-input" />
              <input
                type="text"
                placeholder="CEA registration number, e.g. R123456A"
                value={ceaRegNumber}
                onChange={(e) => setCeaRegNumber(e.target.value)}
                className="lead-form-input"
              />
              <input type="tel" placeholder="Phone" value={agentPhone} onChange={(e) => setAgentPhone(e.target.value)} className="lead-form-input" />
              <input type="email" placeholder="Email" value={agentEmail} onChange={(e) => setAgentEmail(e.target.value)} className="lead-form-input" />
              <input
                type="text"
                placeholder="Property's postal code (6 digits)"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                className="lead-form-input"
              />
              {postalCode && (
                <p className="explainer" style={{ marginTop: -8 }}>
                  {derivedDistrict ? `Resolves to ${derivedDistrict}.` : "Doesn't look like a valid Singapore postal code yet."}
                </p>
              )}
              <SelectField label="Property type" value={propertyType} onChange={setPropertyType} options={PROPERTY_TYPES} />
              <input
                type="text"
                placeholder="Unit type, e.g. 4-Room, 3-Bedroom Condo"
                value={unitDescription}
                onChange={(e) => setUnitDescription(e.target.value)}
                className="lead-form-input"
              />
              <NumberField label="Asking price" value={price} onChange={setPrice} prefix="$" step={1000} />
              <NumberField label="Floor area (optional)" value={floorAreaSqft} onChange={setFloorAreaSqft} suffix="sqft" step={10} />
              <textarea
                placeholder="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="lead-form-input listing-textarea"
                rows={3}
              />
              <label className="field">
                <span className="field-label">Photos (optional, up to {MAX_LISTING_PHOTOS})</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoSelect}
                  disabled={photoFiles.length >= MAX_LISTING_PHOTOS}
                />
              </label>
              {photoPreviews.length > 0 && (
                <div className="listing-photo-preview-grid">
                  {photoPreviews.map((src, i) => (
                    <div key={src} className="listing-photo-preview">
                      <img src={src} alt={`Preview ${i + 1}`} />
                      <button type="button" onClick={() => removePhoto(i)} aria-label="Remove photo">
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <input
                type="text"
                placeholder="Video link (optional) — YouTube or Instagram Reel URL"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                className="lead-form-input"
              />
              {formError && <p className="lead-form-error">{formError}</p>}
              {formStatus === "error" && <p className="lead-form-error">Something went wrong — try again in a moment.</p>}
              <button type="submit" className="lead-form-submit" disabled={formStatus === "uploading" || formStatus === "submitting"}>
                {formStatus === "uploading" ? "Uploading photos…" : formStatus === "submitting" ? "Submitting…" : "Submit Listing"}
              </button>
            </form>
          )}
        </ResultCard>
      )}

      <Disclaimer>
        Listings are submitted directly by agents and shown as-is — SG Money doesn't verify listing accuracy,
        property availability, or CEA registration status. Always verify an agent's registration at{" "}
        <a href="https://www.cea.gov.sg" target="_blank" rel="noopener noreferrer">
          cea.gov.sg
        </a>{" "}
        before transacting.
      </Disclaimer>
    </CalcShell>
  );
}
