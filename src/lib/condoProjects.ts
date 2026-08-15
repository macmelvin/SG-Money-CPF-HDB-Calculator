// Curated list of real, currently-selling or imminent (2026) Singapore
// private new-launch condo/EC projects, for the "Interested in which
// project?" picker on HDB Sale's "Buy a condo" lead form. Each entry's
// `type` (Condo/EC) is used as the Category field on the lead record
// instead of the generic internal "mortgage" ad-category, since that's
// more useful information for an advertiser reviewing the leads list.
//
// IMPORTANT — this is a manually maintained snapshot, not a live feed.
// New launches happen monthly and take-up rates change fast; this list
// will drift out of date within a few months. There's no API wired up
// here (URA/99.co/EdgeProp don't offer a free public one worth building
// against yet) — refresh this list periodically by asking Claude to pull
// current listings, or maintain it by hand.
//
// Sourced from 99.co, Stacked Homes, and PropertyNet's 2026 new-launch
// coverage, current as of August 15, 2026.

export interface CondoProject {
  name: string;
  type: "Condo" | "EC";
}

export const CONDO_PROJECTS: CondoProject[] = [
  { name: "Amberwood at Holland", type: "Condo" },
  { name: "Chuan Grove Residences", type: "Condo" },
  { name: "Coastal Cabana", type: "EC" },
  { name: "Dunearn House", type: "Condo" },
  { name: "ELTA", type: "Condo" },
  { name: "Faber Residence", type: "Condo" },
  { name: "Hillock Green", type: "Condo" },
  { name: "Hougang Central Condo", type: "Condo" },
  { name: "Hudson Place Residences", type: "Condo" },
  { name: "Lentor Gardens Residences", type: "Condo" },
  { name: "Narra Residences", type: "Condo" },
  { name: "Newport Residences", type: "Condo" },
  { name: "Orchard Sophia", type: "Condo" },
  { name: "Parktown Residence", type: "Condo" },
  { name: "Pinery Residences", type: "Condo" },
  { name: "Pinetree Hill", type: "Condo" },
  { name: "Promenade Peak", type: "Condo" },
  { name: "River Green", type: "Condo" },
  { name: "River Modern", type: "Condo" },
  { name: "Rivelle Tampines", type: "EC" },
  { name: "Terra Hill", type: "Condo" },
  { name: "The Serra Residences", type: "Condo" },
  { name: "The SEN", type: "Condo" },
  { name: "Thomson Reserve", type: "Condo" },
  { name: "Upper Thomson Residences", type: "Condo" },
  { name: "Vela Bay", type: "Condo" },
  { name: "Zyon Grand", type: "Condo" },
];
