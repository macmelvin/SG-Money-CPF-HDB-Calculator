// Singapore's 28 postal districts, derived from the first 2 digits (the
// "postal sector") of a 6-digit postal code. Source: URA's official
// district-to-sector mapping — this is public/gazetted information, stable
// since the 1995 six-digit postcode system (the districts themselves date
// back to 1950 and haven't been restructured since).
//
// Note the mapping is NOT sequential — e.g. sectors 22/23 map to D9, not
// D22/D23. This trips up a lot of people; see teeco.sg or recatools.com for
// the same table if this ever needs re-verifying.
export interface DistrictInfo {
  district: string; // "D01".."D28"
  sectors: string[]; // 2-digit sector strings belonging to this district
  areas: string; // general locations, for display in the filter dropdown
}

export const SG_POSTAL_DISTRICTS: DistrictInfo[] = [
  { district: "D01", sectors: ["01", "02", "03", "04", "05", "06"], areas: "Raffles Place, Cecil, Marina, People's Park" },
  { district: "D02", sectors: ["07", "08"], areas: "Anson, Tanjong Pagar" },
  { district: "D03", sectors: ["14", "15", "16"], areas: "Queenstown, Tiong Bahru" },
  { district: "D04", sectors: ["09", "10"], areas: "Telok Blangah, Harbourfront" },
  { district: "D05", sectors: ["11", "12", "13"], areas: "Pasir Panjang, Hong Leong Garden, Clementi New Town" },
  { district: "D06", sectors: ["17"], areas: "High Street, Beach Road" },
  { district: "D07", sectors: ["18", "19"], areas: "Middle Road, Golden Mile" },
  { district: "D08", sectors: ["20", "21"], areas: "Little India" },
  { district: "D09", sectors: ["22", "23"], areas: "Orchard, Cairnhill, River Valley" },
  { district: "D10", sectors: ["24", "25", "26", "27"], areas: "Ardmore, Bukit Timah, Holland Road, Tanglin" },
  { district: "D11", sectors: ["28", "29", "30"], areas: "Watten Estate, Novena, Thomson" },
  { district: "D12", sectors: ["31", "32", "33"], areas: "Balestier, Toa Payoh, Serangoon" },
  { district: "D13", sectors: ["34", "35", "36", "37"], areas: "Macpherson, Braddell" },
  { district: "D14", sectors: ["38", "39", "40", "41"], areas: "Geylang, Eunos" },
  { district: "D15", sectors: ["42", "43", "44", "45"], areas: "Katong, Joo Chiat, Amber Road" },
  { district: "D16", sectors: ["46", "47", "48"], areas: "Bedok, Upper East Coast, Eastwood, Kew Drive" },
  { district: "D17", sectors: ["49", "50", "81"], areas: "Loyang, Changi" },
  { district: "D18", sectors: ["51", "52"], areas: "Tampines, Pasir Ris" },
  { district: "D19", sectors: ["53", "54", "55", "82"], areas: "Serangoon Garden, Hougang, Punggol" },
  { district: "D20", sectors: ["56", "57"], areas: "Bishan, Ang Mo Kio" },
  { district: "D21", sectors: ["58", "59"], areas: "Upper Bukit Timah, Clementi Park, Ulu Pandan" },
  { district: "D22", sectors: ["60", "61", "62", "63", "64"], areas: "Jurong" },
  { district: "D23", sectors: ["65", "66", "67", "68"], areas: "Hillview, Dairy Farm, Bukit Panjang, Choa Chu Kang" },
  { district: "D24", sectors: ["69", "70", "71"], areas: "Lim Chu Kang, Tengah" },
  { district: "D25", sectors: ["72", "73"], areas: "Kranji, Woodgrove" },
  { district: "D26", sectors: ["77", "78"], areas: "Upper Thomson, Springleaf" },
  { district: "D27", sectors: ["75", "76"], areas: "Yishun, Sembawang" },
  { district: "D28", sectors: ["79", "80"], areas: "Seletar" },
];

const SECTOR_TO_DISTRICT: Record<string, string> = {};
for (const d of SG_POSTAL_DISTRICTS) {
  for (const s of d.sectors) SECTOR_TO_DISTRICT[s] = d.district;
}

/** Returns "D09" etc., or null if the postal code isn't a recognised 6-digit
 *  Singapore code / its sector isn't in the active table. */
export function getDistrictFromPostalCode(postalCode: string): string | null {
  const digits = postalCode.replace(/\D/g, "");
  if (digits.length !== 6) return null;
  const sector = digits.slice(0, 2);
  return SECTOR_TO_DISTRICT[sector] ?? null;
}

export function getDistrictInfo(district: string): DistrictInfo | undefined {
  return SG_POSTAL_DISTRICTS.find((d) => d.district === district);
}
