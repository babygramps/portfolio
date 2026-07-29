// Everything priced that is not a unit rate: the add-ons, the mileage rule, the
// peak-season uplift, the extra-day percentage, the second service visit, and the
// option sets the wizards render.
//
// No unit rate is duplicated here except the three jobsite monthly rates, which
// must stay equal to their fleet values (pricing.test.js asserts it).
// Order of operations lives in lib/pricing.js: base, then extra days at 35% of
// base each, then the peak uplift on that sum, then mileage and add-ons, which are
// never multiplied by anything.

export const EXTRA_DAY_PCT = 0.35; // of base, per extra day
export const PEAK_UPLIFT = 0.2; // +20%
export const PEAK_MONTHS = [5, 6, 7, 8, 9, 10]; // May-October inclusive, 1-indexed
export const FREE_MILES = 25; // one-way, from the Oakland yard
export const MILEAGE_PER_MILE = 3.5; // dollars per excess mile, one way only
export const SECOND_VISIT_PER_UNIT_MONTH = 45;
export const MIN_TERM_WEEKS = 4; // jobsite minimum
export const GUEST_MIN = 10;
export const GUEST_MAX = 2000;
export const GUEST_STEP = 10;

// ADD_ONS order is the line-item order. The three ids are exactly the keys of
// selection.addOns.
export const ADD_ONS = [
  {
    id: 'generator',
    label: 'Generator',
    amount: 125,
    detail: '6.5 kW inverter generator, fuelled for twelve hours',
  },
  {
    id: 'waterBuffalo',
    label: 'Fresh-water buffalo',
    amount: 175,
    detail: '265-gallon towable tank so we can refill on site',
  },
  {
    id: 'attendant',
    label: 'On-site attendant',
    amount: 350,
    detail: 'Uniformed attendant for up to six hours',
  },
];

export const EVENT_DURATION_OPTIONS = [
  { value: 4, label: '4 hrs' },
  { value: 6, label: '6 hrs' },
  { value: 8, label: '8 hrs' },
  { value: 12, label: '12 hrs' },
];

// `id` keys selection.units AND is the line-item order.
// `unitId` points at the FLEET record used for drawings, dimensions and specs.
// The ADA standard unit is a jobsite variant of unit-standard, not a fleet record.
export const JOBSITE_ITEMS = [
  {
    id: 'unit-standard',
    unitId: 'unit-standard',
    ada: false,
    label: 'Standard unit',
    rateMonthly: 145,
  },
  {
    id: 'unit-standard-ada',
    unitId: 'unit-standard',
    ada: true,
    label: 'ADA standard unit',
    rateMonthly: 185,
  },
  {
    id: 'station-handwash',
    unitId: 'station-handwash',
    ada: false,
    label: 'Hand-wash station',
    rateMonthly: 75,
  },
];

export const TERM_UNIT_OPTIONS = [
  { value: 'weeks', label: 'Weeks' },
  { value: 'months', label: 'Months' },
];

export const SERVICE_FREQUENCY_OPTIONS = [
  { value: 'weekly', label: 'Once weekly', detail: 'Included' },
  { value: 'twice-weekly', label: 'Twice weekly', detail: '+$45 per unit, per month' },
];

// The zone bands as published, by one-way driving miles from the Oakland yard.
// lib/zones.js owns the canonical ZONES array with the customer-facing blurbs; this
// is the numeric band table, kept here so the rate card and the service-area page
// can read the boundaries without importing a lib module.
export const ZONE_BANDS = [
  { id: 'Z1', label: 'Zone 1', minMiles: 0, maxMiles: 25 },
  { id: 'Z2', label: 'Zone 2', minMiles: 26, maxMiles: 50 },
  { id: 'Z3', label: 'Zone 3', minMiles: 51, maxMiles: 80 },
  { id: 'Z4', label: 'Zone 4', minMiles: 81, maxMiles: 110 },
  { id: 'Z5', label: 'Zone 5', minMiles: 111, maxMiles: null },
];

// RATE_CARD is a published document, not a calculator. Nothing may be computed
// from `display`.
export const RATE_CARD = [
  {
    group: 'Event trailers — weekend rate',
    rows: [
      {
        item: '2-station trailer',
        display: '$1,450',
        note: 'Delivered Friday, picked up Monday. We size it at 120 guests',
      },
      {
        item: '3-station trailer',
        display: '$1,950',
        note: 'Our most-booked wedding trailer. We size it at 180 guests',
      },
      {
        item: '4-station trailer',
        display: '$2,350',
        note: 'Four separate entries. We size it at 240 guests',
      },
      {
        item: '8-station trailer',
        display: '$2,900',
        note: 'Two stair sets, two HVAC circuits. We size it at 480 guests',
      },
      {
        item: 'ADA trailer',
        display: '$1,650',
        note: 'Ramp, handrails, grab bars, lowered sink, plus a second standard room',
      },
    ],
  },
  {
    group: 'Event extras',
    rows: [
      {
        item: 'Standard unit, event',
        display: '$165',
        note: 'Per unit for the weekend, set and serviced with the trailer',
      },
      {
        item: 'Hand-wash station, event',
        display: '$95',
        note: 'Two foot-pump basins, 22 gallons of fresh water on board',
      },
      {
        item: 'Generator',
        display: '$125',
        note: '6.5 kW inverter generator, fuelled for twelve hours',
      },
      {
        item: 'Fresh-water buffalo',
        display: '$175',
        note: '265-gallon towable tank so we can refill on site',
      },
      {
        item: 'On-site attendant',
        display: '$350',
        note: 'Uniformed attendant for up to six hours',
      },
    ],
  },
  {
    group: 'Jobsite and monthly',
    rows: [
      {
        item: 'Standard unit',
        display: '$145 / month',
        note: 'Weekly pump, restock and sanitise included. Four-week minimum',
      },
      {
        item: 'ADA standard unit',
        display: '$185 / month',
        note: 'Wheelchair-accessible unit. Most inspected sites are required to have one',
      },
      {
        item: 'Hand-wash station',
        display: '$75 / month',
        note: 'Restocked and sanitised on the same weekly visit',
      },
    ],
  },
  {
    group: 'Delivery, season and service',
    rows: [
      {
        item: 'Delivery and pickup, first 25 miles',
        display: '$0',
        note: 'Free inside 25 driving miles of the Oakland yard',
      },
      {
        item: 'Mileage beyond 25 miles',
        display: '$3.50 / mile',
        note: 'Charged one way only. The return trip is already inside the base rate',
      },
      {
        item: 'Extra day beyond the weekend',
        display: '35% of base',
        note: 'Per additional day, on the trailer rate only',
      },
      {
        item: 'Peak season, May through October',
        display: '+20%',
        note: 'On the base rate and any extra days, shown as its own line and never folded in',
      },
      {
        item: 'Second weekly service visit',
        display: '$45 / unit / month',
        note: 'Monthly rentals only, for sites that need servicing twice a week',
      },
    ],
  },
];
