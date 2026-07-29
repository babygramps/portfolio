// Where we go and what the drive costs, computed locally from a hand-built table of
// driving miles out of the Oakland yard. There is no geocoding service and no
// network call anywhere in this app (spec §3.2), which is exactly why the Location
// step can answer on the keystroke.
//
// Pure and synchronous per CONTRACT §0.10.
import { LOCATIONS } from '../data/locations.js';
import { FREE_MILES, MILEAGE_PER_MILE } from '../data/rates.js';

export const ZONES = [
  {
    id: 'Z1',
    label: 'Zone 1',
    maxMiles: 25,
    blurb:
      'Oakland, Berkeley, San Francisco and the inner East Bay. Late changes are usually possible.',
  },
  {
    id: 'Z2',
    label: 'Zone 2',
    maxMiles: 50,
    blurb:
      'The South Bay, the Peninsula coast, Napa and southern Sonoma. Delivery is billed from mile 26.',
  },
  {
    id: 'Z3',
    label: 'Zone 3',
    maxMiles: 80,
    blurb:
      'Santa Rosa, Santa Cruz and the Sonoma and Petaluma valleys. Friday delivery windows are firm.',
  },
  {
    id: 'Z4',
    label: 'Zone 4',
    maxMiles: 110,
    blurb:
      'Healdsburg, Calistoga, the Russian River and the Sonoma coast. The truck leaves the yard before dawn.',
  },
  {
    id: 'Z5',
    label: 'Zone 5',
    maxMiles: null,
    blurb:
      'Beyond 110 miles. Bookable at a real price: we hold the date and call within one business day to confirm the window.',
  },
];

const MIN_QUERY_LENGTH_FOR_PREFIX = 4;
const MIN_QUERY_LENGTH_FOR_SUGGEST = 2;
const MAX_SUGGESTIONS = 3;

// Trim, collapse runs of internal whitespace, lowercase. 'san   JOSE  ' -> 'san jose'.
function normalize(query) {
  if (typeof query !== 'string' && typeof query !== 'number') return '';
  return String(query).trim().replace(/\s+/g, ' ').toLowerCase();
}

function zipsOf(record) {
  return Array.isArray(record.zips) ? record.zips : [];
}

// Drive-time bands, in miles one way from the yard.
export function zoneFor(miles) {
  const m = Number(miles);
  // Not a valid input per the contract. Answer with the nearest band rather than
  // the farthest, so a malformed value never invents a Zone 5 callback condition.
  if (!Number.isFinite(m)) return ZONES[0].id;
  for (const zone of ZONES) {
    if (zone.maxMiles === null || m <= zone.maxMiles) return zone.id;
  }
  return ZONES[ZONES.length - 1].id;
}

// Free inside 25 miles, then $3.50 on each excess mile. Charged one way only: the
// return trip is already inside the base rate, and billing it twice is precisely
// the behaviour this site is positioned against.
export function mileageFee(miles) {
  const m = Number(miles);
  if (!Number.isFinite(m)) return 0;
  return Math.round(Math.max(0, m - FREE_MILES) * MILEAGE_PER_MILE);
}

function toResult(record) {
  return {
    name: record.name,
    county: record.county,
    miles: record.miles,
    zone: zoneFor(record.miles),
  };
}

// Whatever the customer typed -> {name, county, miles, zone}, or null.
// Precedence: five-digit ZIP, then an exact city name, then a name prefix of at
// least four characters.
//
// On an ambiguous prefix ('Pacific' matches both Pacifica and Pacific Grove) the
// nearest town wins. CONTRACT §B.2 words that rule as "the first such record in
// LOCATIONS order" on the strength of §A.3's claim that the array is ordered
// nearest first — which it is not; it is grouped by county. Resolving on miles is
// the same answer the contract intends, it matches how suggest() already ranks,
// and no later edit to the data file can silently turn it back into a $300
// over-quote for a Pacifica delivery.
export function lookup(query) {
  const q = normalize(query);
  if (q.length === 0) return null;

  if (/^\d{5}$/.test(q)) {
    const byZip = LOCATIONS.find((record) => zipsOf(record).includes(q));
    if (byZip) return toResult(byZip);
  }

  const exact = LOCATIONS.find((record) => String(record.name).toLowerCase() === q);
  if (exact) return toResult(exact);

  if (q.length >= MIN_QUERY_LENGTH_FOR_PREFIX) {
    let prefixed = null;
    for (const record of LOCATIONS) {
      if (!String(record.name).toLowerCase().startsWith(q)) continue;
      if (!prefixed || record.miles < prefixed.miles) prefixed = record;
    }
    if (prefixed) return toResult(prefixed);
  }

  return null;
}

// Up to three whole LOCATIONS records for the tappable suggestions under a field
// that did not match. A miss offers alternatives and never blocks progress.
export function suggest(query) {
  const q = normalize(query);
  if (q.length < MIN_QUERY_LENGTH_FOR_SUGGEST) return [];

  const scored = [];
  for (const record of LOCATIONS) {
    const name = String(record.name).toLowerCase();
    let score = -1;
    if (name.startsWith(q)) score = 0;
    else if (name.includes(q)) score = 1;
    else if (zipsOf(record).some((zip) => String(zip).startsWith(q))) score = 2;
    if (score >= 0) scored.push({ record, score });
  }

  // Best match first, then nearest to the yard. Array.prototype.sort is stable, so
  // an exact tie keeps LOCATIONS order.
  scored.sort((a, b) => a.score - b.score || a.record.miles - b.record.miles);

  return scored.slice(0, MAX_SUGGESTIONS).map((entry) => entry.record);
}
