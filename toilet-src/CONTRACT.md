# Fieldhouse — implementation CONTRACT

**Authoritative for every file signature, data shape, CSS class name and component
prop in `toilet-src/`.** Eight agents are writing against this document
simultaneously and cannot ask each other questions. If something here disagrees
with your instinct, this document wins. If something is genuinely missing, choose
the option that requires no other file to change, and leave a one-line comment
saying so.

Read alongside the spec:
`docs/superpowers/specs/2026-07-29-fieldhouse-booking-design.md`.

---

## 0. Rules of engagement

1. **Plain `.jsx`, React 18.** Every `.jsx` file begins `import React from 'react'`
   (named hooks may be added: `import React, { useState } from 'react'`). No
   TypeScript, no JSX pragma, no `.tsx`.
2. **No network. Ever.** No `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`,
   `navigator.sendBeacon`, no `<img src="http…">`, no `@import url()`, no external
   fonts. A single network request is a build-breaking bug.
3. **No new dependencies.** `react`, `react-dom`, `esbuild`, `vitest` are the whole
   list. No CSS framework, no icon library, no date library.
4. **All CSS lives in `src/styles.css`** and is owned by one agent. Do not write
   `<style>` blocks, styled-jsx, or `style={{…}}` **except** for the four dynamic
   cases explicitly allowed in §C: progress-bar `scaleX`, drawing `viewBox`-driven
   values, `SummarySheet` nothing, and nothing else. Use the class names in §D.
5. **No emoji anywhere** — not in copy, not as icons. Icons are CSS-drawn
   (`.fh-chev`, `.fh-list--check`) or inline SVG.
6. **Money is integer dollars.** Every `amount`, `subtotal` and `total` is an
   integer. Intermediate arithmetic may be fractional; the value that lands in a
   line item is always `Math.round(...)`. Never `toFixed`, never cents.
7. **Dates are `'YYYY-MM-DD'` strings everywhere** — arguments, return values,
   state, storage, URL. Never pass a `Date` object across a module boundary.
   Never call `new Date('2026-09-19')` for display maths (it parses as UTC and
   shifts a day in US timezones); use the `format.js` helpers.
8. **Copy register:** confident, specific, plainspoken hospitality vendor. Never
   the word "luxury" about ourselves. No puns on john/throne/loo/potty. Prices and
   constraints stated plainly. Never "call us for a quote".
9. **Zero placeholders.** No `TODO`, no `…`, no lorem, no stub returning `null`.
10. **Pure libs.** Everything in `src/lib/` except `store.js` is pure and
    synchronous: no `localStorage`, no `Date.now()`, no `Math.random()`. `store.js`
    is the only module allowed to touch `localStorage`, and `format.todayISO()` is
    the only place the clock is read.

### File ownership map

| Path | Contains |
|---|---|
| `build.mjs`, `package.json`, `src/styles.css`, `CONTRACT.md` | foundation (done) |
| `src/main.jsx`, `src/app.jsx` | shell + hash router |
| `src/lib/*.js` | the six pure-ish modules of §B |
| `src/data/*.js` | the four data modules of §A |
| `src/booking/*.jsx` | the seven components of §C.1 |
| `src/drawings/*.jsx` | the drawing components of §C.2 |
| `src/routes/*.jsx` | the ten route components of §E |
| `test/*.test.js` | vitest, arithmetic only |

---

## A. DATA SHAPES

### A.1 `src/data/fleet.js`

```js
export const FLEET = [ /* the seven records below, in this order */ ];
export function unitById(id) { /* returns the record or null — never throws */ }
```

Field-by-field, every record:

| field | type | units / notes |
|---|---|---|
| `id` | string | stable slug, also the URL segment and the `drawing` key |
| `name` | string | display name, title case, e.g. `'3-Station Trailer'` |
| `kind` | `'trailer' \| 'standard' \| 'handwash'` | drives padding in `availability.js` |
| `stations` | integer | usable toilet stations; `0` for the hand-wash station |
| `dimensions` | `{lengthFt, widthFt, heightFt}` | numbers, **feet**, may be `.5` |
| `weightLb` | integer | pounds, dry |
| `capacityGuests` | integer | `stations × 60`, our conservative baseline (no bar service, ≤ 5 h) |
| `rateWeekend` | integer | **dollars**, whole weekend (Fri delivery → Mon pickup) |
| `rateMonthly` | integer \| `null` | **dollars per month**; `null` where we do not rent it monthly |
| `ada` | boolean | wheelchair-accessible |
| `powerNeed` | string | one sentence, plain |
| `waterNeed` | string | one sentence, plain |
| `features` | string[] | 4 entries, sentence case, **no trailing periods** |
| `blurb` | string | 1–2 real sentences |
| `drawing` | string | key into `DRAWINGS` (§C.2); always equal to `id` |

The seven records, with every number fixed. Copy the numbers exactly; write the
`features`/`blurb` prose yourself in the register of §0.8 (the strings below are
the intended content and may be used verbatim).

```js
{
  id: 'trailer-2', name: '2-Station Trailer', kind: 'trailer', stations: 2,
  dimensions: { lengthFt: 12, widthFt: 7, heightFt: 8.5 }, weightLb: 2600,
  capacityGuests: 120, rateWeekend: 1450, rateMonthly: null, ada: false,
  powerNeed: '120 V / 20 A for climate control and interior lighting',
  waterNeed: 'Arrives with a full 60-gallon fresh tank; 200-gallon waste tank',
  features: [
    'Two private rooms, each with a flushing china toilet',
    'Stainless sink with running hot water',
    'Climate control and interior lighting',
    'Fits down a single-lane driveway',
  ],
  blurb: 'The smallest trailer we deliver, and the right answer for a ceremony of about a hundred. Two doors means two lines moving at once, which is the whole reason to take it over a pair of standard units.',
  drawing: 'trailer-2',
}

{
  id: 'trailer-3', name: '3-Station Trailer', kind: 'trailer', stations: 3,
  dimensions: { lengthFt: 16, widthFt: 7, heightFt: 8.5 }, weightLb: 3400,
  capacityGuests: 180, rateWeekend: 1950, rateMonthly: null, ada: false,
  powerNeed: '120 V / 20 A for climate control and interior lighting',
  waterNeed: 'Arrives with a full 90-gallon fresh tank; 300-gallon waste tank',
  features: [
    'Three private rooms with separate entries',
    'Flushing china toilets and hot-water sinks',
    'Climate control, mirrors and vanity lighting',
    'Interior finish suitable for a wedding',
  ],
  blurb: 'Three rooms in a 16-foot box, and our most common wedding booking. It still fits down a vineyard row, and it gives guests a mirror, a sink and a door that latches.',
  drawing: 'trailer-3',
}

{
  id: 'trailer-4', name: '4-Station Trailer', kind: 'trailer', stations: 4,
  dimensions: { lengthFt: 20, widthFt: 8, heightFt: 9 }, weightLb: 4600,
  capacityGuests: 240, rateWeekend: 2350, rateMonthly: null, ada: false,
  powerNeed: '120 V / 20 A per HVAC circuit',
  waterNeed: 'Arrives with a full 105-gallon fresh tank; 350-gallon waste tank',
  features: [
    'Four private rooms with separate entries',
    'Flushing china toilets and hot-water sinks',
    'Climate control, mirrors and vanity lighting',
    'Handles a 200-guest reception without a queue',
  ],
  blurb: 'Four separate entries, so nobody waits behind a family with a toddler. This is the unit for a reception that runs past dark.',
  drawing: 'trailer-4',
}

{
  id: 'trailer-8', name: '8-Station Trailer', kind: 'trailer', stations: 8,
  dimensions: { lengthFt: 28, widthFt: 8.5, heightFt: 9.5 }, weightLb: 7200,
  capacityGuests: 480, rateWeekend: 2900, rateMonthly: null, ada: false,
  powerNeed: '120 V / 20 A per HVAC circuit, two circuits',
  waterNeed: 'Arrives with a full 200-gallon fresh tank; 650-gallon waste tank',
  features: [
    'Eight private rooms and two entry stairs',
    'Flushing china toilets and hot-water sinks',
    'Two independent HVAC circuits',
    'Built for festival and large-reception load',
  ],
  blurb: 'Eight rooms and two stair sets, for events where a single trailer would otherwise become the story. Two HVAC circuits mean one compressor failure does not take the whole unit down.',
  drawing: 'trailer-8',
}

{
  id: 'trailer-ada', name: 'ADA Trailer', kind: 'trailer', stations: 2,
  dimensions: { lengthFt: 14, widthFt: 8.5, heightFt: 9 }, weightLb: 3900,
  capacityGuests: 120, rateWeekend: 1650, rateMonthly: null, ada: true,
  powerNeed: '120 V / 20 A for climate control and interior lighting',
  waterNeed: 'Arrives with a full 75-gallon fresh tank; 250-gallon waste tank',
  features: [
    'Wheelchair-accessible room with a 60-inch turning circle',
    'Aluminium ramp with handrails and a 36-inch doorway',
    'Grab bars and a lowered sink',
    'Second standard room in the same trailer',
  ],
  blurb: 'A wheelchair-accessible restroom that is not an afterthought: ramp, handrails, grab bars, lowered sink, and room to turn around. Most venues require one, and almost nobody rents a good one.',
  drawing: 'trailer-ada',
}

{
  id: 'unit-standard', name: 'Standard Unit', kind: 'standard', stations: 1,
  dimensions: { lengthFt: 4, widthFt: 4, heightFt: 7.5 }, weightLb: 180,
  capacityGuests: 60, rateWeekend: 165, rateMonthly: 145, ada: false,
  powerNeed: 'None',
  waterNeed: 'None — self-contained 60-gallon waste tank',
  features: [
    'Single self-contained unit',
    'Non-flush, 60-gallon waste tank',
    'Hand-sanitiser dispenser and vent stack',
    'Weekly pump, restock and sanitise included',
  ],
  blurb: 'The workhorse. Delivered to a jobsite, serviced weekly, priced by the month, and booked online without a phone call.',
  drawing: 'unit-standard',
}

{
  id: 'station-handwash', name: 'Hand-Wash Station', kind: 'handwash', stations: 0,
  dimensions: { lengthFt: 2.5, widthFt: 2, heightFt: 5 }, weightLb: 120,
  capacityGuests: 0, rateWeekend: 95, rateMonthly: 75, ada: false,
  powerNeed: 'None',
  waterNeed: 'Arrives with a full 22-gallon fresh tank',
  features: [
    'Two foot-pump basins',
    '22-gallon fresh-water tank',
    'Soap and paper-towel dispensers',
    'No power or plumbing needed',
  ],
  blurb: 'Two basins, foot pumps, fresh water on board. Required by most counties wherever food is served, and cheap insurance beside any restroom.',
  drawing: 'station-handwash',
}
```

Notes that other modules depend on:

- `stations: 0` and `capacityGuests: 0` on the hand-wash station. It must never
  enter capacity arithmetic.
- The **ADA standard unit** ($185/month) is a *jobsite variant* of
  `unit-standard`, not an eighth fleet record. It lives in `JOBSITE_ITEMS`
  (§A.2). `FLEET.length === 7`, always.
- `rateWeekend` on `unit-standard` (165) and `station-handwash` (95) is the
  **event** rate; those two are the only units with both rates.

### A.2 `src/data/rates.js`

Everything that is not a unit rate. No unit rate is duplicated here except the
two jobsite quantities, which must equal their fleet values (`pricing.test.js`
asserts this).

```js
export const EXTRA_DAY_PCT = 0.35;           // of base, per extra day
export const PEAK_UPLIFT = 0.2;              // +20%
export const PEAK_MONTHS = [5, 6, 7, 8, 9, 10]; // May–Oct, 1-indexed months
export const FREE_MILES = 25;                // one-way, from the Oakland yard
export const MILEAGE_PER_MILE = 3.5;         // dollars per excess mile
export const SECOND_VISIT_PER_UNIT_MONTH = 45;
export const MIN_TERM_WEEKS = 4;             // jobsite minimum
export const GUEST_MIN = 10;
export const GUEST_MAX = 2000;
export const GUEST_STEP = 10;

export const ADD_ONS = [
  { id: 'generator',    label: 'Generator',            amount: 125,
    detail: '6.5 kW inverter generator, fuelled for twelve hours' },
  { id: 'waterBuffalo', label: 'Fresh-water buffalo',  amount: 175,
    detail: '265-gallon towable tank so we can refill on site' },
  { id: 'attendant',    label: 'On-site attendant',    amount: 350,
    detail: 'Uniformed attendant for up to six hours' },
];
// ADD_ONS order is the line-item order. The three ids are exactly the keys of
// selection.addOns (§F).

export const EVENT_DURATION_OPTIONS = [
  { value: 4,  label: '4 hrs'  },
  { value: 6,  label: '6 hrs'  },
  { value: 8,  label: '8 hrs'  },
  { value: 12, label: '12 hrs' },
];

export const JOBSITE_ITEMS = [
  { id: 'unit-standard',     unitId: 'unit-standard',     ada: false,
    label: 'Standard unit',      rateMonthly: 145 },
  { id: 'unit-standard-ada', unitId: 'unit-standard',     ada: true,
    label: 'ADA standard unit',  rateMonthly: 185 },
  { id: 'station-handwash',  unitId: 'station-handwash',  ada: false,
    label: 'Hand-wash station',  rateMonthly: 75  },
];
// `id` keys selection.units (§F) AND is the line-item order.
// `unitId` points at the FLEET record used for drawings, dimensions and specs.

export const TERM_UNIT_OPTIONS = [
  { value: 'weeks',  label: 'Weeks'  },
  { value: 'months', label: 'Months' },
];

export const SERVICE_FREQUENCY_OPTIONS = [
  { value: 'weekly',       label: 'Once weekly',  detail: 'Included' },
  { value: 'twice-weekly', label: 'Twice weekly', detail: '+$45 per unit, per month' },
];

export const RATE_CARD = [
  {
    group: 'Event trailers — weekend rate',
    rows: [
      { item: '2-station trailer', display: '$1,450',
        note: 'Delivered Friday, picked up Monday' },
      // one row per trailer, then the remaining groups
    ],
  },
];
```

`RATE_CARD` is a published document, not a calculator. Each group:
`{ group: string, rows: [{ item: string, display: string, note: string }] }`.
`display` is a formatted string (`'$1,450'`, `'$3.50 / mile'`, `'+20%'`,
`'35% of base'`). **Nothing may be computed from `display`.** Required groups, in
order: `'Event trailers — weekend rate'`, `'Event extras'`,
`'Jobsite and monthly'`, `'Delivery, season and service'`. Every rate in spec
§3.3 must appear in exactly one row.

### A.3 `src/data/locations.js`

```js
export const LOCATIONS = [
  { name: 'Napa', county: 'Napa', zips: ['94558', '94559'], miles: 50 },
  // roughly 150 entries of exactly this shape
];
```

| field | type | notes |
|---|---|---|
| `name` | string | city / town, title case, unique across the array |
| `county` | string | county name without the word "County" |
| `zips` | string[] | 1–6 five-digit strings, unique across the whole array |
| `miles` | **integer** | *driving* miles from the Oakland yard, one way |

Coverage requirement: the nine Bay Area counties (Alameda, Contra Costa, Marin,
Napa, San Francisco, San Mateo, Santa Clara, Solano, Sonoma) plus Santa Cruz and
the Mendocino coast south of Gualala. Roughly 150 entries; array order is
"nearest first" within reason (order only matters for the tie-break in
`lookup`). `miles` must be integers, plausible as *driving* distance, and must
increase with real-world distance.

**These anchor entries are required verbatim** — `zones.test.js` asserts the
zone-boundary values, so do not adjust them:

```js
{ name: 'Oakland',        county: 'Alameda',       zips: ['94601','94607','94612','94619'], miles: 3   }
{ name: 'Berkeley',       county: 'Alameda',       zips: ['94702','94703','94709','94710'], miles: 8   }
{ name: 'San Francisco',  county: 'San Francisco', zips: ['94102','94110','94114','94123'], miles: 12  }
{ name: 'Walnut Creek',   county: 'Contra Costa',  zips: ['94596','94597','94598'],          miles: 20  }
{ name: 'Pleasanton',     county: 'Alameda',       zips: ['94566','94588'],                  miles: 25  }  // Z1 ceiling
{ name: 'Fremont',        county: 'Alameda',       zips: ['94536','94538','94539','94555'],  miles: 26  }  // Z2 floor
{ name: 'Vallejo',        county: 'Solano',        zips: ['94589','94590','94591'],          miles: 30  }
{ name: 'Livermore',      county: 'Alameda',       zips: ['94550','94551'],                  miles: 32  }
{ name: 'San Jose',       county: 'Santa Clara',   zips: ['95110','95112','95125','95128'],  miles: 41  }
{ name: 'Half Moon Bay',  county: 'San Mateo',     zips: ['94019'],                          miles: 42  }
{ name: 'Sonoma',         county: 'Sonoma',        zips: ['95476'],                          miles: 45  }
{ name: 'Napa',           county: 'Napa',          zips: ['94558','94559'],                  miles: 50  }  // Z2 ceiling
{ name: 'Petaluma',       county: 'Sonoma',        zips: ['94952','94954'],                  miles: 51  }  // Z3 floor
{ name: 'Santa Rosa',     county: 'Sonoma',        zips: ['95401','95403','95404','95405'],  miles: 64  }
{ name: 'Calistoga',      county: 'Napa',          zips: ['94515'],                          miles: 75  }
{ name: 'Santa Cruz',     county: 'Santa Cruz',    zips: ['95060','95062','95065'],          miles: 78  }
{ name: 'Windsor',        county: 'Sonoma',        zips: ['95492'],                          miles: 80  }  // Z3 ceiling
{ name: 'Healdsburg',     county: 'Sonoma',        zips: ['95448'],                          miles: 81  }  // Z4 floor
{ name: 'Sea Ranch',      county: 'Sonoma',        zips: ['95497'],                          miles: 110 }  // Z4 ceiling
{ name: 'Gualala',        county: 'Mendocino',     zips: ['95445'],                          miles: 111 }  // Z5 floor
```

### A.4 `src/data/season.js`

```js
export const SEASON_LEDGER = [
  { unitId: 'trailer-4', start: '2026-09-19', end: '2026-09-19' },
  // 60 to 120 entries of exactly this shape, across the 2026 and 2027 seasons
];
```

| field | type | notes |
|---|---|---|
| `unitId` | string | **must be a `kind: 'trailer'` id.** Standard units and hand-wash stations are stocked in quantity and never appear here. |
| `start` | `'YYYY-MM-DD'` | first day of the *event*, inclusive |
| `end` | `'YYYY-MM-DD'` | last day of the *event*, inclusive; equal to `start` for a single-day booking |

Store the **event days only**. The Friday-through-Sunday delivery/pickup block is
applied by `availability.js` (§B.4) — do not pre-expand it here, or dates get
double-blocked.

Hand-authored, never generated at runtime. Required shape of the season:

- Most September and October **2026** Saturdays taken across most trailers.
- Most September and October **2027** Saturdays taken across most trailers.
- August 2026 moderately booked (roughly half of Saturdays, one trailer or two).
- November 2026 – April 2027 mostly open; a handful of entries only.
- At least four entries that are 2- or 3-day ranges (a Saturday wedding that also
  holds the Sunday), to exercise range logic.
- Entries must not overlap for the same `unitId`, including the ±1 day pad.

**Required anchors** — `availability.test.js` asserts these, so include them
exactly:

```js
{ unitId: 'trailer-2',   start: '2026-09-19', end: '2026-09-19' }
{ unitId: 'trailer-3',   start: '2026-09-19', end: '2026-09-19' }
{ unitId: 'trailer-4',   start: '2026-09-19', end: '2026-09-19' }
{ unitId: 'trailer-8',   start: '2026-09-19', end: '2026-09-19' }
{ unitId: 'trailer-ada', start: '2026-09-19', end: '2026-09-19' }   // every trailer out
{ unitId: 'trailer-3',   start: '2026-10-17', end: '2026-10-17' }   // pads to 10-16 … 10-18
{ unitId: 'trailer-4',   start: '2026-10-10', end: '2026-10-11' }   // pads to 10-09 … 10-12
```

**Required-open dates** — no entry, for any unit, may cover or pad into
`2026-11-14`, `2026-12-05`, `2027-01-16` or `2027-03-06`.

---

## B. LIB SIGNATURES

### B.1 `src/lib/capacity.js`

```js
export const GUESTS_PER_STATION = 60;
export const ALCOHOL_FACTOR = 1.25;
export const INDUSTRY_PER_STATION = 75;     // the common rule of thumb, for comparison copy
export const COMPETITOR_PER_STATION = 92;   // a Bay Area operator's advertised figure
export const RECOMMEND_POOL = ['trailer-2', 'trailer-3', 'trailer-4', 'trailer-8'];
export const EVENT_UNIT_IDS = ['trailer-2', 'trailer-3', 'trailer-4', 'trailer-8', 'trailer-ada'];

export function durationFactor(hours) {}      // number
export function recommend({ guests, hours, alcohol }) {}
```

`durationFactor(hours)`: `hours <= 5 → 1.0`; `hours > 5 && hours <= 8 → 1.15`;
`hours > 8 → 1.3`. Boundaries are exactly that: 5 → 1.0, 8 → 1.15.

`recommend({guests, hours, alcohol})` — `guests` integer, `hours` integer,
`alcohol` boolean. Returns:

```js
{
  stations: 5,                 // integer, >= 2
  unitId: 'trailer-8',         // string, always one of RECOMMEND_POOL
  extraStandardUnits: 0,       // integer >= 0
  steps: [/* strings: the arithmetic above, printed on screen — table below */],
}
```

Arithmetic, in this exact order:

```
raw  = guests / 60
raw  = raw * 1.25                 // only when alcohol
raw  = raw * durationFactor(hours)
ceil = Math.ceil(raw)             // ceil the UNROUNDED value, not a display-rounded one
stations = Math.max(2, ceil)
```

`unitId`: the first id in `RECOMMEND_POOL` whose `stations >= stations`; if none
qualifies (`stations > 8`), `unitId = 'trailer-8'`. The ADA trailer is never
auto-recommended — accessibility is a decision the customer makes explicitly.

`extraStandardUnits`: `Math.max(0, stations - unitById(unitId).stations)`. Non-zero
only above 480 guests. This is the "never a dead end" path (spec §5.6): we pair
the 8-station trailer with standard units rather than refusing the booking.

`steps` — exact strings, in order, omitting the conditional ones. `n()` formats a
number to at most 2 decimals with trailing zeros stripped
(`String(Math.round(x * 100) / 100)`):

| # | condition | string |
|---|---|---|
| 1 | always | `` `${guests} guests ÷ 60 guests per station = ${n(guests / 60)}` `` |
| 2 | `alcohol` | `` `× 1.25 for bar service = ${n(afterAlcohol)}` `` |
| 3 | `durationFactor(hours) !== 1` | `` `× ${n(factor)} for a ${hours}-hour event = ${n(afterDuration)}` `` |
| 4 | always | `` `Rounded up to ${ceil} stations` `` |
| 5 | `ceil < 2` | `` `Minimum 2 stations on any Fieldhouse booking` `` |

Worked example — `recommend({guests: 180, hours: 6, alcohol: true})`:

```js
{
  stations: 5,
  unitId: 'trailer-8',        // 5 stations; the pool has no 5-, 6- or 7-station unit
  extraStandardUnits: 0,
  steps: [
    '180 guests ÷ 60 guests per station = 3',
    '× 1.25 for bar service = 3.75',
    '× 1.15 for a 6-hour event = 4.31',
    'Rounded up to 5 stations',
  ],
}
```

Two things that example pins down. The ceiling is taken on `4.3125`, not on the
displayed `4.31`. And because the fleet jumps from 4 stations to 8, a 5-station
recommendation lands on the 8-station trailer — which is exactly why the
recommendation is overridable: the Size step must show the 4-station trailer as a
one-tap alternative, with note N10 attached, rather than pushing the larger unit
as though it were the only answer.

Second example — `recommend({guests: 40, hours: 4, alcohol: false})` →
`{ stations: 2, unitId: 'trailer-2', extraStandardUnits: 0, steps: ['40 guests ÷ 60 guests per station = 0.67', 'Rounded up to 1 stations', 'Minimum 2 stations on any Fieldhouse booking'] }`.
Yes, step 4 reads "1 stations" — it is arithmetic, not prose, and step 5
immediately corrects it. Do not add pluralisation logic to step 4.

### B.2 `src/lib/zones.js`

```js
export const ZONES = [
  { id: 'Z1', label: 'Zone 1', maxMiles: 25, blurb: 'Oakland, Berkeley, San Francisco and the inner East Bay. Late changes are usually possible.' },
  { id: 'Z2', label: 'Zone 2', maxMiles: 50, blurb: 'The South Bay, the Peninsula coast, Napa and southern Sonoma. Delivery is billed from mile 26.' },
  { id: 'Z3', label: 'Zone 3', maxMiles: 80, blurb: 'Santa Rosa, Santa Cruz and the Sonoma and Petaluma valleys. Friday delivery windows are firm.' },
  { id: 'Z4', label: 'Zone 4', maxMiles: 110, blurb: 'Healdsburg, Calistoga, the Russian River and the Sonoma coast. The truck leaves the yard before dawn.' },
  { id: 'Z5', label: 'Zone 5', maxMiles: null, blurb: 'Beyond 110 miles. Bookable at a real price: we hold the date and call within one business day to confirm the window.' },
];

export function zoneFor(miles) {}     // 'Z1' | 'Z2' | 'Z3' | 'Z4' | 'Z5'
export function mileageFee(miles) {}  // integer dollars
export function lookup(query) {}      // {name, county, miles, zone} | null
export function suggest(query) {}     // up to 3 LOCATIONS records
```

`zoneFor(miles)`: `<= 25 → 'Z1'`, `26–50 → 'Z2'`, `51–80 → 'Z3'`,
`81–110 → 'Z4'`, `> 110 → 'Z5'`. `miles` is an integer; negatives and `null` are
not valid input.

`mileageFee(miles)`: `Math.round(Math.max(0, miles - 25) * 3.5)`. One way only —
the return trip is already inside the base rate, and double-charging it is exactly
the behaviour this site is positioned against. Examples: `25 → 0`, `26 → 4`
(3.5 rounds up), `50 → 88` (87.5 rounds up), `111 → 301`.

`lookup(query)` — `query` is whatever the customer typed. Trim it, lowercase for
comparison. Match precedence, first hit wins:

1. `/^\d{5}$/` → the record whose `zips` includes it.
2. exact `name.toLowerCase() === q`.
3. `q.length >= 4` and `name.toLowerCase().startsWith(q)` → the **first** such
   record in `LOCATIONS` order.
4. otherwise `null`.

Returns `{ name, county, miles, zone }` — `name` and `county` from the record,
`zone` from `zoneFor(miles)`. Note the return value has **no `zips`**.

`suggest(query)`: `[]` when `query.trim().length < 2`. Otherwise score every
record — `0` if the name starts with the query, `1` if the name contains it, `2`
if any zip starts with it, otherwise excluded — sort by score then by `miles`
ascending, and return the first **3 whole `LOCATIONS` records** (with `zips`).
Used for the tappable suggestions under an unmatched field; a `null` lookup must
never block progress.

### B.3 `src/lib/pricing.js`

```js
export function quote(selection) {}
```

Returns exactly:

```js
{
  lineItems: [ { label: string, detail: string, amount: integer } ],
  subtotal: integer,   // sum of lineItems[].amount
  total: integer,      // === subtotal, always, in this prototype
  notes: string[],
}
```

- `label` is unique within a quote — components may key React lists on it.
- `detail` is always a non-empty string.
- `amount` is an integer number of dollars and may be `0` (the delivery line is
  always present, and reads `$0` inside the free radius — that transparency is
  the point).
- `subtotal` exists for the tests. `total === subtotal` because there is no tax
  line and no service fee. The UI renders the line items and then a single
  **Total** row from `total`; it must not render a separate subtotal row.
- `quote` is **pure**: no clock, no storage, no randomness.

#### Order of operations — fixed, and directly tested

```
base            = unitById(selection.unitId).rateWeekend           // integer
extraDays       = daysBetween(selection.start, selection.end)      // 0 for a single day
extraDayEach    = Math.round(base * 0.35)
extraDaysAmount = extraDayEach * extraDays
preSeason       = base + extraDaysAmount
peakAmount      = isPeak(selection.start) ? Math.round(preSeason * 0.2) : 0
mileage         = mileageFee(miles)                                 // never multiplied
addOnAmounts    = flat table values                                 // never multiplied
extraUnitAmount = 165 * extraStandardUnits + 95 * extraHandwash     // never multiplied
total           = preSeason + peakAmount + mileage + extraUnitAmount + addOnsTotal
```

**base → extra days at 35% of base each → peak multiplier on that sum → then
mileage and add-ons, which are never multiplied.** The peak premium appears as its
own line item whose amount is the +20% delta, never folded into the base line.
Extra standard units, extra hand-wash stations and the three add-ons are flat and
are never touched by the peak multiplier or the extra-day percentage.

#### Event line items — exact order and strings

`money()` is `format.money`. `unit` is `unitById(selection.unitId)`.

| # | when | `label` | `detail` | `amount` |
|---|---|---|---|---|
| 1 | always | `unit.name` | `` `Weekend rate · ${unit.stations} stations` `` | `base` |
| 2 | `extraDays >= 1` | `` `${extraDays} extra day` `` / `` `${extraDays} extra days` `` | `` `35% of base rate, ${money(extraDayEach)} each` `` | `extraDaysAmount` |
| 3 | `isPeak(start)` | `` `Peak season (${monthName(month of start)})` `` | `'+20% on the rate and any extra days'` | `peakAmount` |
| 4 | always | `'Delivery and pickup'` | see below | `mileage` |
| 5 | `extraStandardUnits > 0` | `'Standard units'` | `` `${qty} × ${money(165)} event rate` `` | `165 * qty` |
| 6 | `extraHandwash > 0` | `'Hand-wash stations'` | `` `${qty} × ${money(95)} event rate` `` | `95 * qty` |

Rows 5 and 6 must read those two rates from the fleet
(`unitById('unit-standard').rateWeekend` and
`unitById('station-handwash').rateWeekend`) rather than hardcoding `165` / `95`.
The literals appear here only so the expected strings are unambiguous.
| 7 | each selected add-on, in `ADD_ONS` order | `addOn.label` | `addOn.detail` | `addOn.amount` |

Delivery `detail`, three cases:

- location matched, `miles <= 25`:
  `` `${zone} · ${miles} mi · inside the free 25-mile radius` ``
- location matched, `miles > 25`:
  `` `${zone} · ${miles} mi · ${miles - 25} mi beyond the free 25 at $3.50/mi` ``
- location not matched (`selection.location.miles === null`):
  `'Location not matched yet · quoted inside the free 25-mile radius'`, amount `0`

#### Jobsite line items — exact order and strings

```
monthsFactor = term.unit === 'months' ? term.count : term.count / 4
termText     = `${term.count} ${term.unit}`            // '6 weeks', '3 months', '1 months'
```

Yes, `'1 months'` — do not special-case it; the term stepper's minimum is
`1 month` / `4 weeks` and the label is machine-plain. (Route copy may say
"1 month" in its own prose; the line-item detail uses `termText` verbatim.)

| # | when | `label` | `detail` | `amount` |
|---|---|---|---|---|
| 1–3 | each `JOBSITE_ITEMS` entry with `qty > 0`, in array order | `item.label` | `` `${qty} × ${money(item.rateMonthly)}/month × ${termText}` `` | `Math.round(item.rateMonthly * monthsFactor) * qty` |
| 4 | `serviceFrequency === 'twice-weekly'` | `'Second weekly service visit'` | `` `${unitCount} units × ${money(45)}/month × ${termText}` `` | `Math.round(45 * monthsFactor) * unitCount` |
| 5 | always | `'Delivery and pickup'` | as for events | `mileageFee(miles)` |

`unitCount` = the sum of all three quantities in `selection.units` — hand-wash
stations are serviced too. **No peak line ever appears on a jobsite quote**: a
seasonal premium on a construction rental would be indefensible, and
`pricing.test.js` asserts its absence.

#### Empty states

- `selection.mode === 'event'` and `selection.unitId === null` →
  `{ lineItems: [], subtotal: 0, total: 0, notes: ['Choose a size and we will price it here.'] }`
- `selection.mode === 'site'` and every quantity is `0` →
  `{ lineItems: [], subtotal: 0, total: 0, notes: ['Add at least one unit and we will price it here.'] }`

These are defined results, not placeholders.

#### `notes` — exact strings, pushed in this order when the condition holds

| id | condition | string |
|---|---|---|
| N1 | mode `event`, unit is a trailer | `'The rate covers delivery Friday, service Saturday and pickup Monday. Friday through Sunday is held on the calendar for your trailer.'` |
| N2 | mode `site` | `'Weekly service is included: pump, restock, sanitise. The minimum term is four weeks.'` |
| N3 | `extraDays >= 1` | `'Extra days are billed at 35% of the base rate.'` |
| N4 | `isPeak(start)` | `'May through October is peak season. The premium is on its own line above, never folded into the rate.'` |
| N5 | `start === null` (event) | `'Pick a date and we will show whether peak-season pricing applies.'` |
| N6 | `zone === 'Z5'` | `'Zone 5: beyond 110 miles we hold the date and call within one business day to confirm the delivery window. Nothing is charged before that call.'` |
| N7 | `location.miles === null` | `'We could not match that city or ZIP, so delivery is quoted inside the base radius. We will confirm the mileage on the callback.'` |
| N8 | `offGrid` and `!addOns.generator` (event) | `'You marked the site as off-grid. Climate control and interior lighting need 120 V / 20 A — add the generator or arrange power on site.'` |
| N9 | `offGrid` and `!addOns.waterBuffalo` (event) | `'You marked the site as off-grid. Tanks arrive full, which covers a normal event; the fresh-water buffalo is what lets us refill on site.'` |
| N10 | event, `unit.stations < recommend(...).stations` | `'You have chosen fewer stations than we recommend for this headcount. It will work; expect a line at the peak hour.'` |
| N11 | `extraStandardUnits > 0` | `'Above 480 guests we pair the 8-station trailer with standard units set at the far side of the site.'` |

N10 is the only note requiring `quote` to call `capacity.recommend` — that is
allowed and keeps the warning consistent with the sizing step. It is a warning,
never a block.

### B.4 `src/lib/availability.js`

```js
export const TRAILER_PAD_DAYS = 1;

export function isPeak(date) {}                       // boolean; date 'YYYY-MM-DD'
export function isAvailable(unitId, { start, end }) {} // boolean
export function nextAvailable(unitId, fromDate) {}     // 'YYYY-MM-DD'
export function dayState(unitId, date) {}              // {date, available, peak, blockedBy}
```

`isPeak(date)`: `PEAK_MONTHS.includes(month of date)`. `date` must be a
`'YYYY-MM-DD'` string; `null` returns `false`.

`isAvailable(unitId, {start, end})`:

- `end` may equal `start`. If `end` is `null` or missing, treat it as `start`.
- Units whose `kind !== 'trailer'` return `true` for any range — standard units
  and hand-wash stations are stocked in quantity.
- For trailers, a booking consumes `TRAILER_PAD_DAYS` on each side: delivery the
  day before, pickup the day after. A Saturday booking therefore consumes Friday
  through Sunday — **three days, not five.**
- Apply that pad to the *held* windows only, never to the requested range. Padding
  both sides double-counts and blocks Thursday through Monday, which contradicts
  note N1 printed on every receipt. (The one-sided form is equivalent to padding
  the request instead, since `overlap(aS-1, aE+1, bS, bE) ⟺ overlap(aS, aE, bS-1,
  bE+1)` — but only one of the two may be applied, not both.)
- Conflicts = `SEASON_LEDGER` entries for the same `unitId`, each expanded by the
  pad, **plus** `store.bookingBlocks()` entries for the same `unitId`, expanded the
  same way. The requested range is compared as asked for.
- Return `false` if any conflict window overlaps the requested window, else
  `true`. Overlap is inclusive on both ends.
- **Never consults the clock.** A date in the past is "available" as far as this
  module is concerned; the Calendar greys out the past using
  `format.isPastDate`. This is what makes the module testable.

`nextAvailable(unitId, fromDate)`: walk forward one day at a time from `fromDate`
(inclusive) and return the first date where `isAvailable(unitId, {start: d, end: d})`
is true. Hard-stop after 730 iterations and return that 730th date, so the
function always returns a string and always terminates.

`dayState(unitId, date)`:

```js
{ date: '2026-09-19', available: false, peak: true, blockedBy: 'ledger' }
```

`blockedBy` is `'ledger'`, `'booking'` or `null`. Ledger wins when both apply.
This is what `Calendar`'s `getDay` prop is built from.

### B.5 `src/lib/store.js`

The only module that may touch `localStorage`. **Every** access is wrapped so that
a blocked or absent storage (vitest's node environment, Safari private mode,
`file://` restrictions) degrades silently and nothing throws.

```js
export const BOOKINGS_KEY = 'fieldhouse.bookings.v1';
export const SEQ_KEY = 'fieldhouse.seq.v1';
export const SEQ_START = 143;

export function loadBookings() {}          // Booking[] — [] on any failure
export function findBooking(number) {}     // Booking | null
export function saveBooking(input) {}      // Booking — never throws
export function bookingBlocks() {}         // [{unitId, start, end}]
export function clearBookings() {}         // void
export function nextConfirmationNumber() {}// string, no side effect

export function emptySelection(mode) {}    // canonical selection (§F)
export function encodeSelection(selection) {}      // query string, no leading '?'
export function decodeSelection(query, mode) {}    // selection

export function parseHash(hash) {}         // {path, segments, params}
export function buildHash(path, params) {} // '#/book/event?step=1'
```

`Booking` record:

```js
{
  confirmationNumber: 'FH-2026-0143',
  createdAt: '2026-07-29T18:04:11.000Z',   // new Date().toISOString()
  mode: 'event',                            // 'event' | 'site'
  unitId: 'trailer-3',                      // event only; null for 'site'
  start: '2026-09-19',
  end: '2026-09-19',                        // === start for a single day
  selection: { /* the full selection object, contact included */ },
  quote: { lineItems, subtotal, total, notes },
  contact: { name: 'Dana Ruiz', email: 'dana@example.com', phone: '5105550117' },
  holdPending: true,                        // true when location.zone === 'Z5'
}
```

- `saveBooking({ mode, selection, quote, contact })` assigns
  `confirmationNumber`, `createdAt`, `unitId`, `start`, `end` and `holdPending`,
  appends to storage, increments the counter, **and also keeps the record in a
  module-level variable** so `findBooking` still resolves it when storage is
  unavailable. It returns the complete `Booking` in every case.
- `nextConfirmationNumber()` returns `` `FH-${year}-${String(seq).padStart(4,'0')}` ``
  where `year` is the current calendar year and `seq` is the stored counter,
  defaulting to `SEQ_START` (143). It does **not** increment. First booking of a
  fresh browser therefore reads `FH-2026-0143`.
- `bookingBlocks()` returns one entry per saved booking with `mode === 'event'`
  and a non-null `unitId`: `{unitId, start, end}`. Jobsite bookings never block a
  calendar — those units are stocked in quantity.
- `loadBookings()` tolerates corrupt JSON (returns `[]`) and filters out entries
  missing `confirmationNumber`.

`parseHash(hash)` takes `window.location.hash` (with or without the leading `#`)
and returns:

```js
{ path: '/book/event', segments: ['book', 'event'], params: { step: '2', g: '180' } }
```

- Empty or `'#'` → `{ path: '/', segments: [], params: {} }`.
- `params` values are `decodeURIComponent`-decoded **strings** — never numbers.
- `buildHash('/book/event', {step: 1})` → `'#/book/event?step=1'`; keys whose
  value is `null`, `undefined` or `''` are omitted; values are
  `encodeURIComponent`-encoded; key order follows §F's table so links are stable.

### B.6 `src/lib/format.js`

Pure. `todayISO()` is the only clock read in the entire app.

```js
export const MONTH_NAMES = [/* 12 full month names, index 0 = January */];
export const MONTH_ABBR  = [/* 12 three-letter abbreviations, 'Jan' … 'Dec' */];
export const DOW_NAMES   = [/* 7 full day names, index 0 = Sunday */];
export const DOW_ABBR    = [/* 7 three-letter abbreviations, 'Sun' … 'Sat' */];

export function money(dollars) {}          // 1450 -> '$1,450'; 0 -> '$0'; -120 -> '-$120'
export function plural(n, one, many) {}    // (2,'day','days') -> '2 days'
export function monthName(month) {}        // 9 -> 'September'   (month is 1-12)
export function monthAbbr(month) {}        // 9 -> 'Sep'
export function todayISO() {}              // local clock -> 'YYYY-MM-DD'
export function parseISO(date) {}          // '2026-09-19' -> {y:2026, m:9, d:19}
export function toISO(y, m, d) {}          // (2026,9,19) -> '2026-09-19', zero-padded
export function addDays(date, n) {}        // '2026-09-19', -1 -> '2026-09-18'
export function daysBetween(a, b) {}       // b minus a, in whole days (signed)
export function dowOf(date) {}             // 0 = Sunday … 6 = Saturday
export function shiftMonth(year, month, delta) {}  // -> {year, month}
export function monthGrid(year, month) {}  // 42 cells, see below
export function isPastDate(date) {}        // strictly before todayISO()
export function formatDate(date) {}        // 'Sat Sep 19'
export function formatDateLong(date) {}    // 'Saturday, September 19, 2026'
export function formatRange(start, end) {} // see below
```

- `money`: round the input, group thousands with commas, prefix `'$'`, put the
  minus sign before the `'$'`. Implement the grouping yourself
  (`String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')`). **Do not use
  `toLocaleString`** — the output must be identical in every locale.
- `daysBetween('2026-09-19', '2026-09-21') === 2`; same date → `0`. This is the
  value `pricing.js` uses as `extraDays`.
- `addDays` / `daysBetween` must go through `Date.UTC(y, m-1, d)` so no timezone
  can shift a day. Never `new Date(string)`.
- `monthGrid(2026, 9)` returns exactly **42** entries,
  `{ date: 'YYYY-MM-DD' | null, inMonth: boolean }`, weeks starting Sunday,
  leading and trailing cells `{date: null, inMonth: false}`. Fixed 42 keeps the
  calendar from changing height between months.
- `formatRange`: equal dates → `formatDate(start)`; otherwise
  `` `${formatDate(start)} – ${formatDate(end)}` `` with an en dash surrounded by
  single spaces.

---

## C. COMPONENT PROPS

Every component below is a plain function component with a **named export** whose
name matches the table, plus a `default` export of the same function. All props
are required unless a default is given. No component fetches, no component reads
`localStorage` (route components call `store.js` for that).

Where a **required DOM** skeleton is given, follow it — the stylesheet depends on
that nesting, and a different structure will silently break layout.

### C.1 `src/booking/`

#### `wizard.jsx` → `Wizard`

Dumb chrome. Owns no booking state.

| prop | type | notes |
|---|---|---|
| `title` | string | small eyebrow above the heading, e.g. `'Book an event'` |
| `stepLabels` | string[] | e.g. `['Date','Size','Location','Finish']`; length is the step count |
| `stepIndex` | integer | 0-based |
| `direction` | `1 \| -1` | `1` forward, `-1` back; drives the slide direction |
| `heading` | string | the step's `h1` |
| `sub` | string \| null | one supporting line, or `null` |
| `onBack` | function \| null | `null` renders no back control (step 0) |
| `primaryLabel` | string | e.g. `'Continue'`, `'Confirm booking'` |
| `primaryDisabled` | boolean | default `false` |
| `onPrimary` | function | click handler |
| `note` | string \| null | fine print beside the primary action; desktop only |
| `summary` | ReactNode \| null | a `<SummarySheet …/>`, or `null` before pricing exists |
| `children` | ReactNode | the step body |

Required DOM:

```jsx
<div className="fh-wizard" data-direction={direction === -1 ? 'back' : 'forward'}>
  <div className="fh-wizard__bar">
    <div className="fh-container">
      <ProgressBar value={stepIndex + 1} max={stepLabels.length}
        label={`Step ${stepIndex + 1} of ${stepLabels.length} · ${stepLabels[stepIndex]}`} />
    </div>
  </div>
  <div className="fh-container">
    <div className="fh-wizard__layout">
      <div className="fh-wizard__col">
        <div className="fh-wizard__head">
          {onBack && (
            <button type="button" className="fh-header__back" onClick={onBack}>
              <span className="fh-chev fh-chev--left" aria-hidden="true" /> Back
            </button>
          )}
          <span className="fh-eyebrow">{title}</span>
          <h1 className="fh-wizard__title">{heading}</h1>
          {sub && <p className="fh-wizard__sub">{sub}</p>}
        </div>
        <div className="fh-wizard__body">
          <div className="fh-wizard__panel" key={stepIndex}>{children}</div>
        </div>
      </div>
      {summary && <aside className="fh-wizard__aside">{summary}</aside>}
      <div className="fh-actionbar">
        <div className="fh-actionbar__inner">
          <button type="button" className="fh-btn fh-btn--primary fh-btn--block"
            disabled={primaryDisabled} onClick={onPrimary}>{primaryLabel}</button>
          {note && <p className="fh-actionbar__note">{note}</p>}
        </div>
      </div>
    </div>
  </div>
</div>
```

`key={stepIndex}` on `.fh-wizard__panel` is **required** — remounting is what
replays the slide animation. `data-direction` is what chooses which way it slides.

Mobile: the aside is a pinned line directly above a fixed full-width primary
button. Desktop (≥900px): the aside becomes the sticky right column, the action
bar goes static under the step, and `note` appears. All of that is CSS; the markup
above is identical in both.

#### `summary-sheet.jsx` → `SummarySheet`

One component, two presentations, no `matchMedia`.

| prop | type | notes |
|---|---|---|
| `lineItems` | array | straight from `quote()` |
| `total` | integer | dollars |
| `meta` | string | the collapsed line's context, e.g. `'4 stations · Sat Sep 19 · Napa'` |
| `notes` | string[] | straight from `quote()` |
| `open` | boolean | whether the mobile sheet is open |
| `onToggle` | function | called with no arguments by the trigger and by the sheet's close |
| `title` | string | default `'Order summary'` |

Required DOM:

```jsx
<div className="fh-summary">
  <button type="button" className="fh-summary__trigger" onClick={onToggle}
    aria-expanded={open}>
    <span className="fh-summary__trigger-total">{money(total)}</span>
    <span className="fh-summary__trigger-meta">{meta}</span>
    <span className="fh-summary__chev" aria-hidden="true">
      <span className={'fh-chev' + (open ? ' fh-chev--up' : '')} />
    </span>
  </button>

  <div className="fh-summary__inline">{panel}</div>

  {open && (
    <Sheet open title={title} onClose={onToggle}>{panel}</Sheet>
  )}
</div>
```

where `panel` is this element, built once and used in both slots:

```jsx
const panel = (
  <div className="fh-summary__panel">
    <h2 className="fh-summary__title">{title}</h2>
    <div className="fh-lineitems">
      {lineItems.map((li) => (
        <div className="fh-lineitem" key={li.label}>
          <span className="fh-lineitem__label">{li.label}</span>
          <span className="fh-lineitem__amount">{money(li.amount)}</span>
          <span className="fh-lineitem__detail">{li.detail}</span>
        </div>
      ))}
      <div className="fh-lineitems__total">
        <span className="fh-lineitems__total-label">Total</span>
        <span className="fh-lineitems__total-amount">{money(total)}</span>
      </div>
    </div>
    {notes.length > 0 && (
      <div className="fh-summary__notes">
        {notes.map((n) => <p className="fh-summary__note" key={n}>{n}</p>)}
      </div>
    )}
  </div>
);
```

Reusing one `panel` variable in two slots is intentional and safe — it is a
description, not an instance. At ≥900px the stylesheet hides the trigger and the
sheet and shows `.fh-summary__inline`; below it, the reverse.

Add `is-ticking` to `.fh-lineitems__total-amount` and
`.fh-summary__trigger-total` for one animation frame whenever `total` changes
(a `useEffect` on `total` that sets a state flag and clears it on a
`setTimeout(…, 240)`). Nothing else animates the total. The `fh-lineitem--free`
modifier goes on any line whose `amount === 0`.

#### `calendar.jsx` → `Calendar`

| prop | type | notes |
|---|---|---|
| `year` | integer | e.g. `2026` |
| `month` | integer | **1–12** |
| `selected` | `'YYYY-MM-DD'` \| null | range start |
| `end` | `'YYYY-MM-DD'` \| null | range end; `null` or equal to `selected` for one day |
| `getDay` | function | `(dateISO) => ({ available, peak, past })`, all booleans |
| `onSelect` | function | `(dateISO) => void`; called only for days that are `available && !past` |
| `onMonthChange` | function | `(year, month) => void` from the two nav buttons |
| `minMonth` | `{year, month}` \| null | disables the back button at that month |
| `maxMonth` | `{year, month}` \| null | disables the forward button |
| `showLegend` | boolean | default `true` |

Required DOM: `.fh-cal` > `.fh-cal__head` (with `.fh-cal__month` and
`.fh-cal__nav` > two `.fh-cal__navbtn` containing a `.fh-chev fh-chev--left` /
`.fh-chev fh-chev--right`), `.fh-cal__dows` (seven `.fh-cal__dow` from
`DOW_ABBR`), `.fh-cal__grid`, then `.fh-cal__legend`.

Each of the 42 cells from `monthGrid` is:

```jsx
<div className="fh-cal__cell" key={i}>
  <button type="button" className={dayClass} disabled={!selectable}
    aria-label={ariaLabel} aria-pressed={isSelected} onClick={…}>
    <span className="fh-cal__daynum">{dayNumber}</span>
    <span className="fh-cal__peakdot" aria-hidden="true" />
  </button>
</div>
```

`dayClass` is `'fh-cal__day'` plus, as applicable:
`fh-cal__day--blank` (null date), `--past`, `--unavailable`, `--peak`,
`--in-range` (strictly between `selected` and `end`), `--selected` (equal to
`selected` or `end`), `--today` (equals `todayISO()`).
`aria-label` = `formatDateLong(date)` plus `' — unavailable'` when not available
and `' — peak season'` when peak. Unavailable days are rendered **struck through
and disabled, never hidden** — visible scarcity is the conversion mechanism.

Legend items, in order: selected, peak season (+20%), unavailable — each an
`.fh-cal__legend-item` containing the matching
`.fh-cal__swatch--selected|--peak|--unavailable`.

#### `stepper.jsx` → `Stepper`

| prop | type | notes |
|---|---|---|
| `id` | string | input id, for the label's `htmlFor` |
| `label` | string | |
| `unit` | string \| null | small line under the label, e.g. `'guests'` |
| `value` | integer | |
| `onChange` | function | `(nextInteger) => void`, already clamped |
| `min` | integer | default `0` |
| `max` | integer | default `99` |
| `step` | integer | default `1` |
| `editable` | boolean | default `true`; `false` renders a read-only value |

Required DOM: `.fh-stepper__row` > (label block) + `.fh-stepper` >
`.fh-stepper__btn.fh-stepper__btn--minus`, then either
`<input className="fh-stepper__input" type="text" inputMode="numeric" pattern="[0-9]*">`
(editable) or `<span className="fh-stepper__value">` (not), then
`.fh-stepper__btn.fh-stepper__btn--plus`. Button glyphs are `−` (U+2212) and `+`,
each with `aria-label` (`'Fewer'` / `'More'`). Buttons are `disabled` at the
bounds. Clamp to `[min, max]` and coerce non-numeric typing to the last good
value — never let `NaN` reach `onChange`.

#### `segmented.jsx` → `Segmented`

| prop | type | notes |
|---|---|---|
| `label` | string | used as the group's `aria-label` |
| `options` | array | `[{ value, label, detail? }]`; `value` is a string or number |
| `value` | string \| number | the selected value |
| `onChange` | function | `(value) => void` |
| `stack` | boolean | default `false`; `true` adds `fh-seg--stack` for vertical rows |

Required DOM: `<div className="fh-seg" role="radiogroup" aria-label={label}>` with
one `<button type="button" role="radio" aria-checked={…} className="fh-seg__opt">`
per option, adding `fh-seg__opt--active` to the selected one and wrapping any
`detail` in `<span className="fh-seg__detail">`.

#### `sheet.jsx` → `Sheet`

| prop | type | notes |
|---|---|---|
| `open` | boolean | when `false` the component returns `null` (no exit animation, by design) |
| `title` | string | |
| `onClose` | function | |
| `children` | ReactNode | |
| `footer` | ReactNode \| null | default `null`; rendered in `.fh-sheet__foot` |

Required DOM: `.fh-sheet` > `.fh-sheet__scrim` (click calls `onClose`) +
`.fh-sheet__panel[role="dialog"][aria-modal="true"][aria-label={title}]` >
`.fh-sheet__grab` + `.fh-sheet__head` (`.fh-sheet__title` +
`.fh-sheet__close` with `aria-label="Close"`) + `.fh-sheet__body` + optional
`.fh-sheet__foot`.

Required behaviour: while open, a `keydown` listener on `document` calls
`onClose` on `Escape`, and `document.body.style.overflow` is set to `'hidden'`
and restored on cleanup. Both are removed on unmount.

#### `progress-bar.jsx` → `ProgressBar`

| prop | type | notes |
|---|---|---|
| `value` | number | current step, 1-based |
| `max` | number | total steps |
| `label` | string | shown under the bar and used as `aria-label` |

Required DOM — and this is the one sanctioned inline style:

```jsx
<div className="fh-progress">
  <div className="fh-progress__track" role="progressbar" aria-valuemin={0}
    aria-valuemax={max} aria-valuenow={value} aria-label={label}>
    <span className="fh-progress__fill"
      style={{ transform: `scaleX(${Math.max(0, Math.min(1, value / max))})` }} />
  </div>
  <span className="fh-progress__label">{label}</span>
</div>
```

A filling bar, never numbered dots.

### C.2 `src/drawings/`

One file per unit, named after the unit id: `trailer-2.jsx`, `trailer-3.jsx`,
`trailer-4.jsx`, `trailer-8.jsx`, `trailer-ada.jsx`, `unit-standard.jsx`,
`station-handwash.jsx`, plus `index.jsx`.

Each unit file exports a named component in PascalCase with a `Drawing` suffix —
`Trailer2Drawing`, `Trailer3Drawing`, `Trailer4Drawing`, `Trailer8Drawing`,
`TrailerAdaDrawing`, `UnitStandardDrawing`, `StationHandwashDrawing` — plus the
same function as `default`. Every one takes **exactly** these props:

| prop | type | notes |
|---|---|---|
| `view` | `'plan' \| 'elevation'` | required |
| `showDims` | boolean | default `true`; `false` hides dimension lines and their text |
| `title` | string | required; becomes the SVG's `aria-label`, e.g. `'3-Station Trailer, plan view'` |

Every drawing renders a single root `<svg>`:

```jsx
<svg className="fh-drawing__svg" viewBox="0 0 400 260"
  preserveAspectRatio="xMidYMid meet" role="img" aria-label={title}
  focusable="false">…</svg>
```

`viewBox="0 0 400 260"` is fixed for **both** views of **every** unit, so plates
line up in a grid. Draw to the unit's real proportions inside it and leave margin
for dimension text. No `width`/`height` attributes, no inline `fill`/`stroke`
attributes, no `<style>` — use only these classes, which are already defined:

`.fh-dwg-outline` (the outer shell), `.fh-dwg-fill` (filled bodies: fixtures,
wheels), `.fh-dwg-interior` (interior partitions), `.fh-dwg-hatch` (decking,
hatched surfaces), `.fh-dwg-hidden` (dashed hidden edges), `.fh-dwg-center`
(centre lines), `.fh-dwg-dim` (dimension and extension lines, plus arrow
strokes), `.fh-dwg-dimtext` (dimension numbers), `.fh-dwg-callout` (station and
fixture labels), `.fh-dwg-leader` (leader lines to callouts).

Dimension text uses feet-and-inches in surveyor form: `12'-0"`, `8'-6"`. Callouts
are uppercase and terse: `STATION 1`, `SINK`, `RAMP`, `TONGUE`, `AXLE`. Plan
views show length × width; elevations show height and axle position. Numbers must
match `dimensions` in the fleet record exactly.

`index.jsx` exports:

```js
export const DRAWINGS = {
  'trailer-2': Trailer2Drawing, 'trailer-3': Trailer3Drawing,
  'trailer-4': Trailer4Drawing, 'trailer-8': Trailer8Drawing,
  'trailer-ada': TrailerAdaDrawing, 'unit-standard': UnitStandardDrawing,
  'station-handwash': StationHandwashDrawing,
};

export function Drawing({ id, view, showDims = true, title }) {}
export function DrawingPlate({ id, view, showDims = true, title, label, caption }) {}
```

- `Drawing` looks up `DRAWINGS[id]` and renders it with the same props. If `id`
  is unknown it renders a real fallback plate — an `.fh-drawing__svg` with a
  dashed `.fh-dwg-hidden` rectangle and an `.fh-dwg-callout` reading
  `DRAWING NOT ON FILE` — not `null`.
- `DrawingPlate` is the framed presentation:

```jsx
<figure className="fh-drawing">
  <div className="fh-drawing__frame">
    <Drawing id={id} view={view} showDims={showDims} title={title} />
  </div>
  <figcaption className="fh-drawing__caption">
    <span className="fh-drawing__label">{label}</span>
    <span>{caption}</span>
  </figcaption>
</figure>
```

`label` is the view name, e.g. `'Plan'` or `'Elevation'`; `caption` is the
governing dimension, e.g. `"16'-0\" × 7'-0\""`. Two plates side by side go in
`.fh-drawings-pair`.

The service-area map is **not** a drawing component: it is inline SVG inside
`routes/service-area.jsx` using the `.fh-map-*` classes of §D.

---

## D. CSS CLASS INVENTORY

Every class defined in `src/styles.css`. Use these; do not invent names, and do
not add inline styles beyond the two sanctioned dynamic cases (`ProgressBar`'s
`scaleX`, and nothing else in the booking components).

**Shell / layout** — `fh-app` `fh-main` `fh-container` `fh-container--narrow`
`fh-container--wide` `fh-page` `fh-page__head` `fh-section` `fh-section--first`
`fh-section--sunken` `fh-section__head` `fh-rule` `fh-rule--strong`
`fh-rule--double` `fh-stack` `fh-stack--sm` `fh-stack--lg` `fh-row`
`fh-row--between` `fh-row--wrap` `fh-row--top` `fh-grid-2` `fh-grid-3`
`fh-visually-hidden` `fh-skip-link` `fh-hide-desktop` `fh-hide-mobile`

**Header / nav / footer** — `fh-header` `fh-header__inner` `fh-header__back`
`fh-wordmark` `fh-wordmark__mark` `fh-wordmark__text` `fh-wordmark__suffix`
`fh-nav` `fh-nav__link` `fh-nav__link--active` `fh-nav-toggle` `fh-nav-drawer`
`fh-footer` `fh-footer__cols` `fh-footer__col` `fh-footer__note`

**Type** — `fh-display` `fh-h1` `fh-h2` `fh-h3` `fh-h4` `fh-eyebrow`
`fh-eyebrow--accent` `fh-lede` `fh-prose` `fh-mono` `fh-num` `fh-money`
`fh-money--lg` `fh-fine` `fh-text-muted` `fh-text-warn` `fh-text-accent`

**Buttons / links / chevron** — `fh-btn` `fh-btn--primary` `fh-btn--secondary`
`fh-btn--ghost` `fh-btn--block` `fh-btn--sm` `fh-btn__hint` `fh-link`
`fh-link--quiet` `fh-chev` `fh-chev--left` `fh-chev--right` `fh-chev--up`

**Cards / tags / notes / lists** — `fh-card` `fh-card--flat` `fh-card__head`
`fh-card__body` `fh-card__foot` `fh-tag` `fh-tag--accent` `fh-tag--warn`
`fh-tag--muted` `fh-note` `fh-note--info` `fh-note--warn` `fh-note__title`
`fh-note__body` `fh-list` `fh-list--check` `fh-list--cross` `fh-list--dash`
`fh-list--rule` `fh-kv` `fh-kv__k` `fh-kv__v` `fh-numlist` `fh-numlist__item`

**Forms** — `fh-field` `fh-label` `fh-label__optional` `fh-input`
`fh-input--invalid` `fh-input--num` `fh-hint` `fh-error` `fh-switch`
`fh-switch__label` `fh-switch__detail` `fh-switch__track` `fh-switch__knob`
`fh-typeahead` `fh-typeahead__list` `fh-typeahead__opt` `fh-typeahead__opt-name`
`fh-typeahead__opt-meta` `fh-typeahead__result` `fh-zonechip` `fh-zonechip--far`

`fh-switch` is a `<button role="switch" aria-checked>`; the accent state is driven
by `aria-checked="true"`, not by a modifier class.

**Segmented** — `fh-seg` `fh-seg--stack` `fh-seg__opt` `fh-seg__opt--active`
`fh-seg__detail` (also styles on `aria-checked="true"`)

**Stepper** — `fh-stepper` `fh-stepper--sm` `fh-stepper__row` `fh-stepper__btn`
`fh-stepper__btn--minus` `fh-stepper__btn--plus` `fh-stepper__value`
`fh-stepper__input` `fh-stepper__label` `fh-stepper__unit`

**Progress** — `fh-progress` `fh-progress__track` `fh-progress__fill`
`fh-progress__label`

**Wizard** — `fh-wizard` `fh-wizard__bar` `fh-wizard__head` `fh-wizard__title`
`fh-wizard__sub` `fh-wizard__body` `fh-wizard__panel` `fh-wizard__layout`
`fh-wizard__col` `fh-wizard__aside` `fh-actionbar` `fh-actionbar__inner`
`fh-actionbar__note` (plus the `data-direction="forward|back"` attribute on
`fh-wizard`)

**Summary / line items** — `fh-summary` `fh-summary__trigger`
`fh-summary__trigger-total` `fh-summary__trigger-meta` `fh-summary__chev`
`fh-summary__inline` `fh-summary__panel` `fh-summary__title` `fh-summary__notes`
`fh-summary__note` `fh-lineitems` `fh-lineitem` `fh-lineitem--free`
`fh-lineitem__label` `fh-lineitem__detail` `fh-lineitem__amount`
`fh-lineitems__total` `fh-lineitems__total-label` `fh-lineitems__total-amount`
`is-ticking`

**Sheet** — `fh-sheet` `fh-sheet__scrim` `fh-sheet__panel` `fh-sheet__grab`
`fh-sheet__head` `fh-sheet__title` `fh-sheet__close` `fh-sheet__body`
`fh-sheet__foot`

**Calendar** — `fh-cal` `fh-cal__head` `fh-cal__month` `fh-cal__nav`
`fh-cal__navbtn` `fh-cal__dows` `fh-cal__dow` `fh-cal__grid` `fh-cal__cell`
`fh-cal__day` `fh-cal__daynum` `fh-cal__peakdot` `fh-cal__day--blank`
`fh-cal__day--today` `fh-cal__day--peak` `fh-cal__day--in-range`
`fh-cal__day--selected` `fh-cal__day--unavailable` `fh-cal__day--past`
`fh-cal__legend` `fh-cal__legend-item` `fh-cal__swatch`
`fh-cal__swatch--selected` `fh-cal__swatch--peak` `fh-cal__swatch--unavailable`

**Booking-step blocks** — `fh-mathsteps` `fh-mathsteps__step`
`fh-mathsteps__result` `fh-unitpick` `fh-unitpick__opt`
`fh-unitpick__opt--active` `fh-unitpick__opt-name` `fh-unitpick__opt-meta`
`fh-unitpick__opt-rate` `fh-unitpick__badge` `fh-addons` `fh-addon`
`fh-addon__box` `fh-addon__label` `fh-addon__detail` `fh-addon__price` `fh-alts`
`fh-alts__btn`

`fh-unitpick__opt` and `fh-addon` are `<button>`s with `role="radio"` /
`role="checkbox"` and `aria-checked`; both accent states also key off
`aria-checked="true"`. `fh-mathsteps` is where `recommend().steps` is printed.
`fh-alts__btn` is the inline "nearest open date / larger unit" affordance.

**Tables / rate card** — `fh-table-wrap` `fh-table` `fh-table__num`
`fh-table__note` `fh-ratecard` `fh-ratecard__group` `fh-ratecard__grouphead`
`fh-included` `fh-included__col`

Wide tables must sit inside `.fh-table-wrap` so they scroll on their own instead
of scrolling the page.

**Fleet** — `fh-fleet__grid` `fh-unit` `fh-unit__figure` `fh-unit__body`
`fh-unit__name` `fh-unit__kind` `fh-unit__blurb` `fh-unit__specs` `fh-spec`
`fh-spec__k` `fh-spec__v` `fh-unit__features` `fh-unit__rate`
`fh-unit__rate-amount` `fh-unit__rate-unit` `fh-unit__actions`

**Drawings** — `fh-drawing` `fh-drawing__frame` `fh-drawing__svg`
`fh-drawing__caption` `fh-drawing__label` `fh-drawings-pair` `fh-dwg-outline`
`fh-dwg-fill` `fh-dwg-interior` `fh-dwg-hatch` `fh-dwg-hidden` `fh-dwg-center`
`fh-dwg-dim` `fh-dwg-dimtext` `fh-dwg-callout` `fh-dwg-leader`

**Map** — `fh-map__frame` `fh-map__svg` `fh-map__legend` `fh-map-county`
`fh-map-county--served` `fh-map-water` `fh-map-ring` `fh-map-ring-label`
`fh-map-city` `fh-map-dot` `fh-map-yard`

**Home** — `fh-hero` `fh-hero__claim` `fh-hero__sub` `fh-hero__meta` `fh-doors`
`fh-door` `fh-door__kicker` `fh-door__title` `fh-door__desc` `fh-door__meta`
`fh-door__cta` `fh-contrast__grid` `fh-contrast__row` `fh-contrast__them`
`fh-contrast__us` `fh-proof` `fh-proof__item` `fh-proof__num` `fh-proof__label`

`fh-hero__claim em` renders in the accent colour with no italics — that is the
one emphasis device in the hero.

**FAQ / About / Receipt** — `fh-faq` `fh-faq__item` `fh-faq__q` `fh-faq__a`
`fh-about__portrait` `fh-signature` `fh-receipt` `fh-receipt__head`
`fh-receipt__number` `fh-receipt__stamp` `fh-receipt__body` `fh-receipt__meta`
`fh-receipt__next` `fh-receipt__share` `fh-copyfield` `fh-copyfield__input`
`fh-copyfield__btn`

### Design tokens available to all agents

Palette custom properties (light and dark are swapped by
`prefers-color-scheme`, so never hardcode a colour): `--paper` `--paper-raised`
`--paper-sunken` `--ink` `--ink-2` `--ink-3` `--rule` `--rule-strong` `--accent`
`--accent-deep` `--accent-tint` `--accent-on` `--accent-fill` `--warn`
`--warn-surface` `--warn-line` `--unavail`. Type: `--font-display` (a serif
system stack — the display face), `--font-sans`, `--font-mono`, `--fs-100` …
`--fs-1100`. Space: `--sp-1` … `--sp-9`. The accent is **deep field green**
(`#2C5A3B` light, `#8CC79A` dark); amber means warning only; grey means
unavailable only.

---

## E. ROUTES

Hash routing only. Clean paths are impossible here: a request for
`/toilet/fleet` misses in S3 and is answered with the portfolio homepage at HTTP
200 — a broken deep link that looks healthy.

| hash | file | component | notes |
|---|---|---|---|
| `#/` | `routes/home.jsx` | `Home` | the two doors |
| `#/fleet` | `routes/fleet.jsx` | `Fleet` | all seven units |
| `#/fleet/<unitId>` | `routes/fleet.jsx` | `Fleet` | same component; `segments[1]` is the unit id, e.g. `#/fleet/trailer-4`. Unknown id renders the list plus an `.fh-note` saying so |
| `#/pricing` | `routes/pricing.jsx` | `Pricing` | the published rate card |
| `#/service-area` | `routes/service-area.jsx` | `ServiceArea` | inline SVG zone map |
| `#/faq` | `routes/faq.jsx` | `Faq` | |
| `#/about` | `routes/about.jsx` | `About` | the named human |
| `#/book/event` | `routes/book-event.jsx` | `BookEvent` | 4 steps; state in the query (§F) |
| `#/book/site` | `routes/book-site.jsx` | `BookSite` | 3 steps; state in the query (§F) |
| `#/confirmation?c=FH-2026-0143` | `routes/confirmation.jsx` | `Confirmation` | reads `params.c` via `store.findBooking`; unknown or missing number renders a real "we cannot find that number" panel with links to both wizards — never a blank page |
| anything else | — | `Home` | render `Home` and `history.replaceState`-free: set `window.location.hash = '#/'` once |

`main.jsx` owns routing: it reads `window.location.hash`, subscribes to
`hashchange`, holds `route` in state, and renders
`<App route={route} navigate={navigate} />` inside
`ReactDOM.createRoot(document.getElementById('root')).render(…)` wrapped in
`<React.StrictMode>`.

```js
route = { path: '/fleet/trailer-4', segments: ['fleet','trailer-4'], params: {} }
navigate(pathOrHash, params = {}, { replace = false } = {})
```

`navigate('/book/event', {step: 2, g: 180})` sets
`window.location.hash = '#/book/event?step=2&g=180'`. With `replace: true` it uses
`history.replaceState` so wizard keystrokes do not fill the back button; step
changes use a normal push so Back walks the steps. `navigate` also scrolls to top
(`window.scrollTo(0, 0)`) on a push, never on a replace.

`app.jsx` exports `App({ route, navigate })` and renders the shell:
`.fh-skip-link`, `.fh-header` (wordmark, `.fh-nav` with the seven links,
`.fh-nav-toggle` + `.fh-nav-drawer` on mobile), `<main id="main" className="fh-main">`
with the route switch, and `.fh-footer`. The header is hidden on neither wizard —
the wizard's own back control lives in `.fh-wizard__head`.

Every route component receives exactly `{ route, navigate }`.

Nav links, in order: Fleet, Pricing, Service area, FAQ, About, and a
`.fh-btn.fh-btn--primary.fh-btn--sm` reading "Book an event" pointing at
`#/book/event`. `.fh-nav__link--active` is set by prefix-matching
`route.path`.

---

## F. BOOKING STATE

One canonical `selection` object, threaded through both wizards, produced by
`store.emptySelection(mode)`. The wizard route owns it in `useState`, passes it
down, and mirrors it into the hash on every change with `replace: true`.

```js
{
  mode: 'event',            // 'event' | 'site' — set from the route, never from a param
  step: 0,                  // integer, 0-based

  // event only
  start: null,              // 'YYYY-MM-DD' | null
  end: null,                // 'YYYY-MM-DD' | null — equals start for a single day
  guests: 120,              // integer, GUEST_MIN…GUEST_MAX, step GUEST_STEP
  hours: 6,                 // integer, one of EVENT_DURATION_OPTIONS values
  alcohol: false,           // bar service
  unitId: null,             // 'trailer-3' etc.; null until the Size step sets it
  extraStandardUnits: 0,    // integer >= 0
  extraHandwash: 0,         // integer >= 0
  addOns: { generator: false, waterBuffalo: false, attendant: false },

  // jobsite only
  units: { 'unit-standard': 0, 'unit-standard-ada': 0, 'station-handwash': 0 },
  term: { unit: 'months', count: 1 },      // unit: 'weeks' | 'months'
  serviceFrequency: 'weekly',              // 'weekly' | 'twice-weekly'

  // shared
  location: { query: '', name: null, county: null, miles: null, zone: null },
  offGrid: false,
  contact: { name: '', email: '', phone: '' },
}
```

`emptySelection('site')` uses the same object with `mode: 'site'` and
`start: null` (the term start date lives in `start`, reusing the field). Both
shapes carry every key — `quote()` reads only the ones relevant to `mode`, so
there are no `undefined` reads.

Rules:

- `end` is never `null` once `start` is set; a single-day event has `end === start`.
- `unitId` must be set the moment the customer reaches the Size step: default it
  to `recommend({guests, hours, alcohol}).unitId` so the summary is never $0
  after step 1. The customer may then pick any id in `EVENT_UNIT_IDS`, up or
  down; sizing below the recommendation produces note N10, never a block.
- `location` is written wholesale from `zones.lookup()`. On a `null` lookup keep
  `query` (so the field keeps what was typed) and leave the other four `null`;
  offer `zones.suggest(query)` as tappable `.fh-typeahead__opt` rows.
- `term.count` is clamped to `>= 4` when `unit === 'weeks'` and `>= 1` when
  `unit === 'months'`.
- Switching `term.unit` converts nothing — it resets `count` to `4` (weeks) or
  `1` (months).

### Hash serialization

`store.encodeSelection(selection)` produces a query string in exactly this key
order, omitting any key whose value equals the default. `decodeSelection(query,
mode)` merges over `emptySelection(mode)`, coerces types, clamps to legal ranges,
and silently ignores anything it does not recognise — a hand-mangled link must
never throw.

| key | field | encoding |
|---|---|---|
| `step` | `step` | integer, e.g. `2` |
| `s` | `start` | `'2026-09-19'` |
| `e` | `end` | omitted when `end === start` |
| `g` | `guests` | integer |
| `h` | `hours` | integer |
| `a` | `alcohol` | `1` when true, omitted when false |
| `u` | `unitId` | the id string |
| `xs` | `extraStandardUnits` | integer, omitted when `0` |
| `xh` | `extraHandwash` | integer, omitted when `0` |
| `ao` | `addOns` | comma-separated ids of the true ones, e.g. `generator,attendant`; omitted when none |
| `qs` | `units['unit-standard']` | integer, omitted when `0` |
| `qa` | `units['unit-standard-ada']` | integer, omitted when `0` |
| `qh` | `units['station-handwash']` | integer, omitted when `0` |
| `tu` | `term.unit` | `w` or `m` |
| `tc` | `term.count` | integer |
| `sf` | `serviceFrequency` | `1` for weekly, `2` for twice-weekly; omitted when weekly |
| `loc` | `location.query` | `encodeURIComponent`; on decode, re-run `zones.lookup()` to rebuild the rest of `location` rather than trusting the link |
| `og` | `offGrid` | `1` when true, omitted when false |

`contact` is **never** serialized. A shared link is a shareable quote — a planner
sending a couple a pre-filled booking — and it must not carry anyone's phone
number. `mode` is not serialized either; it comes from the route path.

Example: `#/book/event?step=3&s=2026-09-19&g=180&h=6&a=1&u=trailer-4&ao=generator,waterBuffalo&loc=Napa&og=1`

---

## G. Behaviour that spans files

1. **Nothing pends.** No spinners, no skeletons, no `setTimeout` that delays a
   value. Every number is computed synchronously on the keystroke. The only timer
   in the app is the 240 ms `is-ticking` class reset.
2. **Never a dead end** (spec §5.6). Every unavailable state resolves inline with
   `.fh-alts__btn` buttons: the nearest open date (`nextAvailable`), the next
   larger unit, or the 8-station trailer plus standard units. Zone 5 books at a
   real price with the callback condition disclosed. No screen may end in "call
   us for a quote"; there is no phone-only path anywhere.
3. **Autofill matters.** The contact fields use
   `autoComplete="name" | "email" | "tel"`, `type="email" | "tel"`, and
   `inputMode="numeric"` on quantities. Location uses
   `autoComplete="postal-code"` and `inputMode="text"`.
4. **Simulated, and honest about it.** Confirmation copy says a real human will
   confirm; nothing claims a payment was taken, an email was sent, or a contract
   exists. The footer carries one plain line stating this is a prototype and no
   bookings are real.
5. **Accessibility floor.** Every interactive element is a real `button`, `a` or
   `input` with an accessible name, a ≥44px touch target, and a visible
   focus ring (already styled globally). Every SVG that carries meaning has
   `role="img"` and an `aria-label`; decorative SVG gets `aria-hidden="true"`.
