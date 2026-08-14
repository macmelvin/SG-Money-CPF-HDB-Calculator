// A horizontally-scrollable strip of small mockup "pages" showing what the Premium Retirement
// Report actually looks like, using illustrative example numbers (never the person's real data)
// — so someone deciding whether to pay S$12.90 can see the shape of the report first. Built as
// plain HTML/CSS/SVG rather than screenshots of the real PDF so it stays crisp at any size and
// needs no image assets or build step to keep in sync.

function MiniRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rp-row">
      <span className="rp-row-label">{label}</span>
      <span className="rp-row-value">{value}</span>
    </div>
  );
}

function TextBlock({ width }: { width: string }) {
  return <div className="rp-text-block" style={{ width }} />;
}

function CoverPreview() {
  return (
    <div className="rp-page">
      <div className="rp-cover-band">
        <div className="rp-cover-app">SG MONEY</div>
        <div className="rp-cover-title">Premium Retirement Report</div>
      </div>
      <div className="rp-page-body">
        <div className="rp-mini-heading">At a glance</div>
        <MiniRow label="Years to retirement" value="20 yrs" />
        <MiniRow label="Projected savings" value="$1.12M" />
        <MiniRow label="Target required" value="$2.01M" />
        <MiniRow label="Shortfall" value="$890,791" />
      </div>
    </div>
  );
}

function NarrativePreview() {
  return (
    <div className="rp-page">
      <div className="rp-page-body">
        <div className="rp-mini-heading">Where You Stand</div>
        <TextBlock width="100%" />
        <TextBlock width="100%" />
        <TextBlock width="70%" />
        <div className="rp-mini-heading" style={{ marginTop: 10 }}>
          Your Inputs
        </div>
        <MiniRow label="Current age" value="40" />
        <MiniRow label="Target retirement age" value="62" />
        <MiniRow label="Monthly investment" value="$1,200" />
      </div>
    </div>
  );
}

function ScenarioPreview() {
  return (
    <div className="rp-page">
      <div className="rp-page-body">
        <div className="rp-mini-heading">Scenario: Retirement Age</div>
        <MiniRow label="Age 59" value="-$1.02M" />
        <MiniRow label="Age 62 (your plan)" value="-$890k" />
        <MiniRow label="Age 65" value="-$620k" />
        <MiniRow label="Age 67" value="-$410k" />
        <div className="rp-mini-heading" style={{ marginTop: 10 }}>
          Growth Projection
        </div>
        <svg className="rp-chart" viewBox="0 0 120 46" preserveAspectRatio="none">
          <polyline
            points="2,40 26,34 50,28 74,18 98,10 118,4"
            fill="none"
            stroke="var(--primary)"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}

function CpfLifeAndModulesPreview() {
  return (
    <div className="rp-page">
      <div className="rp-page-body">
        <div className="rp-mini-heading">CPF LIFE Tier Comparison</div>
        <div className="rp-tier-bars">
          <div className="rp-tier-bar">
            <div className="rp-tier-fill" style={{ height: "30%" }} />
            <span className="rp-tier-label">BRS</span>
            <span className="rp-tier-value">$950/mo</span>
          </div>
          <div className="rp-tier-bar">
            <div className="rp-tier-fill" style={{ height: "55%" }} />
            <span className="rp-tier-label">FRS</span>
            <span className="rp-tier-value">$1,780/mo</span>
          </div>
          <div className="rp-tier-bar">
            <div className="rp-tier-fill rp-tier-fill-selected" style={{ height: "100%" }} />
            <span className="rp-tier-label">ERS ✓</span>
            <span className="rp-tier-value">$3,440/mo</span>
          </div>
        </div>
        <div className="rp-mini-heading" style={{ marginTop: 10 }}>
          Your Full Financial Picture
        </div>
        <MiniRow label="Salary & CPF" value="included ✓" />
        <MiniRow label="HDB Sale Proceeds" value="included ✓" />
        <MiniRow label="Car True Cost" value="included ✓" />
      </div>
    </div>
  );
}

export function PremiumReportPreview() {
  return (
    <div className="rp-strip-wrap">
      <div className="rp-strip">
        {[CoverPreview, NarrativePreview, ScenarioPreview, CpfLifeAndModulesPreview].map((Page, i) => (
          <div className="rp-page-frame" key={i}>
            <Page />
            <div className="rp-watermark">SAMPLE DATA</div>
          </div>
        ))}
      </div>
      <p className="rp-caption">
        Preview shown with example numbers — your report uses your own inputs. Scroll for more →
      </p>
    </div>
  );
}
