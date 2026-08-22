import { useState } from "react";
import { Link } from "react-router-dom";
import { BTO_TOOL_URL, DOC_TOOLS_URL, EXPIRY_TRACKER_URL, PROTEIN_TRACKER_URL, LOBANG_SHARE_URL } from "../lib/calculators";
import { trackEvent } from "../lib/analytics";

// The same "share + signature + sister apps" block Melvin uses across his
// other apps (Document Tools, BTO Planning Tool, Expiry Tracker, Protein
// Tracker) — added here so SG Money matches and cross-promotes the rest of
// the suite. Opt-in per page via CalcShell's showAppSuiteFooter prop (see
// there), currently only the 5 core calculators.
export function AppSuiteFooter() {
  const [justShared, setJustShared] = useState(false);

  const handleShare = async () => {
    const shareData = {
      title: document.title,
      text: "Free Singapore money calculators — CPF, salary, HDB sale proceeds, retirement and car costs. No login, calculations stay on your device.",
      url: window.location.href,
    };
    trackEvent("app_shared", { page: window.location.pathname });

    // Native share sheet where available (mobile, and most modern desktop
    // browsers) — falls back to copying the link so the button still does
    // something useful on browsers without the Web Share API.
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // AbortError when the person just closes the share sheet without
        // picking anything — not a real failure, nothing to show for it.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(shareData.url);
      setJustShared(true);
      setTimeout(() => setJustShared(false), 2000);
    } catch {
      // Clipboard access can fail (permissions, insecure context) — fail silently,
      // same as everywhere else non-essential in this app.
    }
  };

  return (
    <div className="app-suite-footer">
      <button type="button" className="app-suite-share-btn" onClick={handleShare}>
        💙 {justShared ? "Link copied!" : "Share this app if you find it useful"}
      </button>
      <a
        href="https://buymeacoffee.com/waypointsg"
        target="_blank"
        rel="noopener noreferrer"
        className="app-suite-support-link"
      >
        ☕ Buy me a coffee — help keep this running
      </a>
      <p className="app-suite-signature">
        Build by Yours Truly - 小猫好介绍 -{" "}
        <a href={LOBANG_SHARE_URL} target="_blank" rel="noopener noreferrer">
          Good Lobang must share
        </a>
      </p>
      <p className="app-suite-phone">+65 88877041</p>
      <nav className="app-suite-links" aria-label="More free apps">
        <a href={DOC_TOOLS_URL} target="_blank" rel="noopener noreferrer">
          Document Tools
        </a>
        <Link to="/">SG Money</Link>
        <a href={BTO_TOOL_URL} target="_blank" rel="noopener noreferrer">
          BTO Planning Tool
        </a>
        <a href={EXPIRY_TRACKER_URL} target="_blank" rel="noopener noreferrer">
          Expiry Tracker
        </a>
        <a href={PROTEIN_TRACKER_URL} target="_blank" rel="noopener noreferrer">
          Protein Tracker
        </a>
      </nav>
    </div>
  );
}
