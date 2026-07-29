import { describe, it, expect, vi } from 'vitest';

// store.js is pulled in transitively (pricing -> availability -> store) and the
// contract requires it to degrade silently without localStorage. Install a
// memory-backed localStorage before any import is evaluated so these tests
// exercise the same code path a browser would.
vi.hoisted(() => {
  const map = new Map();
  const storage = {
    get length() {
      return map.size;
    },
    key(i) {
      return Array.from(map.keys())[i] ?? null;
    },
    getItem(k) {
      const key = String(k);
      return map.has(key) ? map.get(key) : null;
    },
    setItem(k, v) {
      map.set(String(k), String(v));
    },
    removeItem(k) {
      map.delete(String(k));
    },
    clear() {
      map.clear();
    },
  };
  globalThis.localStorage = storage;
  if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
});

import { quote } from '../src/lib/pricing.js';
import { unitById } from '../src/data/fleet.js';
import {
  ADD_ONS,
  EXTRA_DAY_PCT,
  FREE_MILES,
  JOBSITE_ITEMS,
  MILEAGE_PER_MILE,
  PEAK_MONTHS,
  PEAK_UPLIFT,
  SECOND_VISIT_PER_UNIT_MONTH,
} from '../src/data/rates.js';

// ---------------------------------------------------------------------------
// Fixtures: the canonical selection of CONTRACT section F, built here rather
// than through store.emptySelection so pricing is tested in isolation.
// ---------------------------------------------------------------------------

const DEFAULTS = {
  mode: 'event',
  step: 0,
  start: null,
  end: null,
  guests: 120,
  hours: 6,
  alcohol: false,
  unitId: null,
  extraStandardUnits: 0,
  extraHandwash: 0,
  addOns: { generator: false, waterBuffalo: false, attendant: false },
  units: { 'unit-standard': 0, 'unit-standard-ada': 0, 'station-handwash': 0 },
  term: { unit: 'months', count: 1 },
  serviceFrequency: 'weekly',
  location: { query: '', name: null, county: null, miles: null, zone: null },
  offGrid: false,
  contact: { name: '', email: '', phone: '' },
};

function sel(over = {}) {
  const out = { ...DEFAULTS, ...over };
  out.addOns = { ...DEFAULTS.addOns, ...(over.addOns || {}) };
  out.units = { ...DEFAULTS.units, ...(over.units || {}) };
  out.term = { ...DEFAULTS.term, ...(over.term || {}) };
  out.location = { ...DEFAULTS.location, ...(over.location || {}) };
  out.contact = { ...DEFAULTS.contact, ...(over.contact || {}) };
  return out;
}

const NAPA = { query: 'Napa', name: 'Napa', county: 'Napa', miles: 50, zone: 'Z2' };
const OAKLAND = { query: 'Oakland', name: 'Oakland', county: 'Alameda', miles: 3, zone: 'Z1' };
const PLEASANTON = { query: 'Pleasanton', name: 'Pleasanton', county: 'Alameda', miles: 25, zone: 'Z1' };
const FREMONT = { query: 'Fremont', name: 'Fremont', county: 'Alameda', miles: 26, zone: 'Z2' };
const GUALALA = { query: 'Gualala', name: 'Gualala', county: 'Mendocino', miles: 111, zone: 'Z5' };
const WALNUT_CREEK = { query: 'Walnut Creek', name: 'Walnut Creek', county: 'Contra Costa', miles: 20, zone: 'Z1' };
const UNMATCHED = { query: 'Ashland, Oregon', name: null, county: null, miles: null, zone: null };

const N1 =
  'The rate covers delivery Friday, service Saturday and pickup Monday. Friday through Sunday is held on the calendar for your trailer.';
const N2 = 'Weekly service is included: pump, restock, sanitise. The minimum term is four weeks.';
const N3 = 'Extra days are billed at 35% of the base rate.';
const N4 =
  'May through October is peak season. The premium is on its own line above, never folded into the rate.';
const N5 = 'Pick a date and we will show whether peak-season pricing applies.';
const N6 =
  'Zone 5: beyond 110 miles we hold the date and call within one business day to confirm the delivery window. Nothing is charged before that call.';
const N7 =
  'We could not match that city or ZIP, so delivery is quoted inside the base radius. We will confirm the mileage on the callback.';
const N8 =
  'You marked the site as off-grid. Climate control and interior lighting need 120 V / 20 A — add the generator or arrange power on site.';
const N9 =
  'You marked the site as off-grid. Tanks arrive full, which covers a normal event; the fresh-water buffalo is what lets us refill on site.';
const N10 =
  'You have chosen fewer stations than we recommend for this headcount. It will work; expect a line at the peak hour.';
const N11 =
  'Above 480 guests we pair the 8-station trailer with standard units set at the far side of the site.';

function labels(q) {
  return q.lineItems.map((li) => li.label);
}

function amountOf(q, label) {
  const hit = q.lineItems.find((li) => li.label === label);
  return hit ? hit.amount : null;
}

function lineOf(q, label) {
  return q.lineItems.find((li) => li.label === label) || null;
}

// ---------------------------------------------------------------------------

describe('rate constants', () => {
  it('are the published rates from the spec', () => {
    expect(EXTRA_DAY_PCT).toBe(0.35);
    expect(PEAK_UPLIFT).toBe(0.2);
    expect(PEAK_MONTHS).toEqual([5, 6, 7, 8, 9, 10]);
    expect(FREE_MILES).toBe(25);
    expect(MILEAGE_PER_MILE).toBe(3.5);
    expect(SECOND_VISIT_PER_UNIT_MONTH).toBe(45);
  });

  it('keeps the two jobsite monthly rates equal to their fleet values', () => {
    const standard = JOBSITE_ITEMS.find((i) => i.id === 'unit-standard');
    const handwash = JOBSITE_ITEMS.find((i) => i.id === 'station-handwash');
    expect(standard.rateMonthly).toBe(unitById('unit-standard').rateMonthly);
    expect(handwash.rateMonthly).toBe(unitById('station-handwash').rateMonthly);
    expect(standard.rateMonthly).toBe(145);
    expect(handwash.rateMonthly).toBe(75);
    expect(JOBSITE_ITEMS.find((i) => i.id === 'unit-standard-ada').rateMonthly).toBe(185);
  });

  it('keeps the two event unit rates on their fleet records', () => {
    expect(unitById('unit-standard').rateWeekend).toBe(165);
    expect(unitById('station-handwash').rateWeekend).toBe(95);
  });

  it('lists the three add-ons in line-item order', () => {
    expect(ADD_ONS.map((a) => a.id)).toEqual(['generator', 'waterBuffalo', 'attendant']);
    expect(ADD_ONS.map((a) => a.amount)).toEqual([125, 175, 350]);
    for (const a of ADD_ONS) {
      expect(typeof a.label).toBe('string');
      expect(a.label.length).toBeGreaterThan(0);
      expect(typeof a.detail).toBe('string');
      expect(a.detail.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// The order of operations. This is the highest-value test in the suite.
// base -> extra days at 35% of base each -> peak x1.2 on that sum -> then
// mileage and add-ons, which are never multiplied.
// ---------------------------------------------------------------------------

describe('order of operations (spec 3.3)', () => {
  const selection = sel({
    unitId: 'trailer-3',
    start: '2026-09-19',
    end: '2026-09-20', // one extra day
    location: NAPA, // 50 mi -> 25 excess miles
    addOns: { generator: true },
  });

  // Hand-computed, and every wrong ordering produces a different number:
  //   base            1950
  //   extraDayEach    round(1950 * 0.35)  = 683
  //   extraDaysAmount 683 * 1             = 683
  //   preSeason       1950 + 683          = 2633
  //   peakAmount      round(2633 * 0.2)   = 527
  //   mileage         round(25 * 3.5)     = 88
  //   generator                           = 125
  //   total                               = 3373
  const BASE = 1950;
  const EXTRA_EACH = 683;
  const PRE_SEASON = 2633;
  const PEAK = 527;
  const MILEAGE = 88;
  const GENERATOR = 125;
  const TOTAL = 3373;

  it('computes the documented total', () => {
    const q = quote(selection);
    expect(q.total).toBe(TOTAL);
    expect(q.subtotal).toBe(TOTAL);
  });

  it('applies the peak multiplier to base plus extra days, not to base alone', () => {
    const q = quote(selection);
    expect(amountOf(q, 'Peak season (September)')).toBe(PEAK);
    // Peak on the base only would be round(1950 * 0.2) = 390.
    expect(amountOf(q, 'Peak season (September)')).not.toBe(390);
    // And the whole quote would come out 137 dollars light.
    expect(q.total).not.toBe(3236);
  });

  it('applies the peak multiplier before mileage, never after it', () => {
    const q = quote(selection);
    // Peak applied after mileage would be round((2633 + 88) * 0.2) = 544.
    expect(amountOf(q, 'Peak season (September)')).not.toBe(544);
    expect(q.total).not.toBe(3390);
  });

  it('never multiplies mileage or add-ons by the peak uplift', () => {
    const q = quote(selection);
    expect(amountOf(q, 'Delivery and pickup')).toBe(MILEAGE);
    expect(amountOf(q, 'Generator')).toBe(GENERATOR);
    // Peak over mileage and add-ons would be round((2633+88+125) * 0.2) = 569.
    expect(amountOf(q, 'Peak season (September)')).not.toBe(569);
  });

  it('holds the peak amount constant as mileage and add-ons change', () => {
    // The structural proof: only base and extra days feed the multiplier, so
    // moving the job from Napa to Oakland and dropping every add-on must not
    // move the peak line by a dollar.
    const near = quote(
      sel({
        unitId: 'trailer-3',
        start: '2026-09-19',
        end: '2026-09-20',
        location: OAKLAND,
      }),
    );
    const far = quote(
      sel({
        unitId: 'trailer-3',
        start: '2026-09-19',
        end: '2026-09-20',
        location: GUALALA,
        addOns: { generator: true, waterBuffalo: true, attendant: true },
        extraStandardUnits: 3,
        extraHandwash: 2,
      }),
    );
    expect(amountOf(near, 'Peak season (September)')).toBe(PEAK);
    expect(amountOf(far, 'Peak season (September)')).toBe(PEAK);
    expect(amountOf(near, '1 extra day')).toBe(EXTRA_EACH);
    expect(amountOf(far, '1 extra day')).toBe(EXTRA_EACH);
  });

  it('bills each extra day at 35% of base, added not compounded', () => {
    const one = quote(sel({ unitId: 'trailer-3', start: '2026-09-19', end: '2026-09-20', location: OAKLAND }));
    const two = quote(sel({ unitId: 'trailer-3', start: '2026-09-19', end: '2026-09-21', location: OAKLAND }));
    const three = quote(sel({ unitId: 'trailer-3', start: '2026-09-19', end: '2026-09-22', location: OAKLAND }));

    expect(amountOf(one, '1 extra day')).toBe(683);
    expect(amountOf(two, '2 extra days')).toBe(1366);
    expect(amountOf(three, '3 extra days')).toBe(2049);

    // Compounding 1.35 per day would give 2632, 3554, 4798 for the pre-season
    // sum instead of 2633, 3316, 3999.
    expect(amountOf(two, 'Peak season (September)')).toBe(663); // round(3316 * 0.2)
    expect(amountOf(three, 'Peak season (September)')).toBe(800); // round(3999 * 0.2)
  });

  it('charges no extra day for a single-day event', () => {
    const q = quote(sel({ unitId: 'trailer-3', start: '2026-09-19', end: '2026-09-19', location: OAKLAND }));
    expect(labels(q)).toEqual(['3-Station Trailer', 'Peak season (September)', 'Delivery and pickup']);
    expect(q.notes).not.toContain(N3);
    expect(amountOf(q, '3-Station Trailer')).toBe(BASE);
    expect(amountOf(q, 'Peak season (September)')).toBe(390); // round(1950 * 0.2)
  });

  it('matches a from-first-principles recomputation of the whole quote', () => {
    const q = quote(selection);
    const base = unitById('trailer-3').rateWeekend;
    const extraDayEach = Math.round(base * EXTRA_DAY_PCT);
    const preSeason = base + extraDayEach * 1;
    const peak = Math.round(preSeason * PEAK_UPLIFT);
    const mileage = Math.round(Math.max(0, NAPA.miles - FREE_MILES) * MILEAGE_PER_MILE);
    const addOn = ADD_ONS.find((a) => a.id === 'generator').amount;
    expect(preSeason).toBe(PRE_SEASON);
    expect(q.total).toBe(preSeason + peak + mileage + addOn);
  });

  it('itemises the whole quote in the contract order, with the contract strings', () => {
    const q = quote(selection);
    expect(q.lineItems).toEqual([
      { label: '3-Station Trailer', detail: 'Weekend rate · 3 stations', amount: 1950 },
      { label: '1 extra day', detail: '35% of base rate, $683 each', amount: 683 },
      {
        label: 'Peak season (September)',
        detail: '+20% on the rate and any extra days',
        amount: 527,
      },
      {
        label: 'Delivery and pickup',
        detail: 'Z2 · 50 mi · 25 mi beyond the free 25 at $3.50/mi',
        amount: 88,
      },
      {
        label: 'Generator',
        detail: '6.5 kW inverter generator, fuelled for twelve hours',
        amount: 125,
      },
    ]);
    expect(q.notes).toEqual([N1, N3, N4]);
  });
});

describe('the maximal event quote', () => {
  const q = quote(
    sel({
      unitId: 'trailer-8',
      start: '2026-09-18',
      end: '2026-09-20', // two extra days
      guests: 400, // 7 recommended stations, so the 8-station trailer is not undersized
      hours: 4,
      alcohol: false,
      extraStandardUnits: 2,
      extraHandwash: 1,
      addOns: { generator: true, waterBuffalo: true, attendant: true },
      location: GUALALA,
      offGrid: false,
    }),
  );

  //   base            2900
  //   extraDayEach    round(2900 * 0.35) = 1015, x2 = 2030
  //   preSeason       4930
  //   peakAmount      round(4930 * 0.2)  = 986
  //   mileage         round(86 * 3.5)    = 301
  //   standard units  2 x 165            = 330
  //   hand-wash       1 x 95             = 95
  //   add-ons         125 + 175 + 350    = 650
  //   total                              = 7292

  it('orders every line exactly as the contract table does', () => {
    expect(labels(q)).toEqual([
      '8-Station Trailer',
      '2 extra days',
      'Peak season (September)',
      'Delivery and pickup',
      'Standard units',
      'Hand-wash stations',
      'Generator',
      'Fresh-water buffalo',
      'On-site attendant',
    ]);
  });

  it('prices every line', () => {
    expect(q.lineItems.map((li) => li.amount)).toEqual([2900, 2030, 986, 301, 330, 95, 125, 175, 350]);
    expect(q.total).toBe(7292);
    expect(q.subtotal).toBe(7292);
  });

  it('writes the extra-unit details from the fleet event rates', () => {
    expect(lineOf(q, 'Standard units').detail).toBe('2 × $165 event rate');
    expect(lineOf(q, 'Hand-wash stations').detail).toBe('1 × $95 event rate');
    expect(amountOf(q, 'Standard units')).toBe(2 * unitById('unit-standard').rateWeekend);
    expect(amountOf(q, 'Hand-wash stations')).toBe(1 * unitById('station-handwash').rateWeekend);
  });

  it('names the extra-day rate in the detail', () => {
    expect(lineOf(q, '2 extra days').detail).toBe('35% of base rate, $1,015 each');
  });

  it('discloses the Zone 5 callback condition and the pairing note', () => {
    expect(q.notes).toEqual([N1, N3, N4, N6, N11]);
  });
});

describe('peak season', () => {
  const peakByMonth = {
    1: false,
    2: false,
    3: false,
    4: false,
    5: true,
    6: true,
    7: true,
    8: true,
    9: true,
    10: true,
    11: false,
    12: false,
  };
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  for (const [monthStr, isPeakMonth] of Object.entries(peakByMonth)) {
    const month = Number(monthStr);
    const name = monthNames[month - 1];
    const date = `2026-${String(month).padStart(2, '0')}-15`;

    it(`${isPeakMonth ? 'charges' : 'does not charge'} the premium in ${name}`, () => {
      const q = quote(sel({ unitId: 'trailer-2', start: date, end: date, location: OAKLAND }));
      const peakLines = q.lineItems.filter((li) => li.label.startsWith('Peak season'));
      if (isPeakMonth) {
        expect(peakLines).toHaveLength(1);
        expect(peakLines[0].label).toBe(`Peak season (${name})`);
        expect(peakLines[0].amount).toBe(Math.round(1450 * PEAK_UPLIFT));
        expect(q.notes).toContain(N4);
      } else {
        expect(peakLines).toHaveLength(0);
        expect(q.notes).not.toContain(N4);
      }
    });
  }

  it('brackets the season on the first and last day of May and October', () => {
    const inSeason = ['2026-05-01', '2026-05-31', '2026-10-01', '2026-10-31'];
    const outOfSeason = ['2026-04-30', '2026-11-01', '2026-12-31', '2027-01-01'];
    for (const date of inSeason) {
      const q = quote(sel({ unitId: 'trailer-2', start: date, end: date, location: OAKLAND }));
      expect(q.lineItems.some((li) => li.label.startsWith('Peak season')), date).toBe(true);
    }
    for (const date of outOfSeason) {
      const q = quote(sel({ unitId: 'trailer-2', start: date, end: date, location: OAKLAND }));
      expect(q.lineItems.some((li) => li.label.startsWith('Peak season')), date).toBe(false);
    }
  });

  it('takes the season from the start date, not the end date', () => {
    // A booking that starts 30 April and runs into May is not peak.
    const shoulder = quote(
      sel({ unitId: 'trailer-2', start: '2026-04-30', end: '2026-05-02', location: OAKLAND }),
    );
    expect(shoulder.lineItems.some((li) => li.label.startsWith('Peak season'))).toBe(false);
    // One that starts 31 October and runs into November is.
    const closing = quote(
      sel({ unitId: 'trailer-2', start: '2026-10-31', end: '2026-11-01', location: OAKLAND }),
    );
    expect(amountOf(closing, 'Peak season (October)')).toBe(
      Math.round((1450 + Math.round(1450 * EXTRA_DAY_PCT)) * PEAK_UPLIFT),
    );
  });

  it('never folds the premium into the base line', () => {
    const q = quote(sel({ unitId: 'trailer-4', start: '2026-07-04', end: '2026-07-04', location: OAKLAND }));
    expect(amountOf(q, '4-Station Trailer')).toBe(unitById('trailer-4').rateWeekend);
    expect(amountOf(q, 'Peak season (July)')).toBe(470); // round(2350 * 0.2)
    expect(q.total).toBe(2820);
  });

  it('asks for a date instead of guessing, when no date is set', () => {
    const q = quote(sel({ unitId: 'trailer-3', start: null, end: null, location: OAKLAND }));
    expect(q.lineItems.some((li) => li.label.startsWith('Peak season'))).toBe(false);
    expect(q.notes).toContain(N5);
    expect(q.notes).not.toContain(N4);
    expect(q.total).toBe(1950);
  });
});

describe('mileage', () => {
  it('is zero at exactly the free radius', () => {
    const q = quote(sel({ unitId: 'trailer-2', start: '2026-11-14', end: '2026-11-14', location: PLEASANTON }));
    const delivery = lineOf(q, 'Delivery and pickup');
    expect(delivery.amount).toBe(0);
    expect(delivery.detail).toBe('Z1 · 25 mi · inside the free 25-mile radius');
  });

  it('charges only the excess above the free radius', () => {
    const cases = [
      { location: OAKLAND, amount: 0, detail: 'Z1 · 3 mi · inside the free 25-mile radius' },
      { location: PLEASANTON, amount: 0, detail: 'Z1 · 25 mi · inside the free 25-mile radius' },
      { location: FREMONT, amount: 4, detail: 'Z2 · 26 mi · 1 mi beyond the free 25 at $3.50/mi' },
      { location: NAPA, amount: 88, detail: 'Z2 · 50 mi · 25 mi beyond the free 25 at $3.50/mi' },
      { location: GUALALA, amount: 301, detail: 'Z5 · 111 mi · 86 mi beyond the free 25 at $3.50/mi' },
    ];
    for (const c of cases) {
      const q = quote(
        sel({ unitId: 'trailer-2', start: '2026-11-14', end: '2026-11-14', location: c.location }),
      );
      const delivery = lineOf(q, 'Delivery and pickup');
      expect(delivery.amount, c.location.name).toBe(c.amount);
      expect(delivery.detail, c.location.name).toBe(c.detail);
      expect(delivery.amount, c.location.name).toBe(
        Math.round(Math.max(0, c.location.miles - FREE_MILES) * MILEAGE_PER_MILE),
      );
    }
  });

  it('always shows the delivery line, even at zero dollars', () => {
    const event = quote(
      sel({ unitId: 'trailer-2', start: '2026-11-14', end: '2026-11-14', location: OAKLAND }),
    );
    expect(labels(event)).toContain('Delivery and pickup');
    const site = quote(
      sel({ mode: 'site', units: { 'unit-standard': 1 }, start: '2026-11-14', location: OAKLAND }),
    );
    expect(labels(site)).toContain('Delivery and pickup');
    expect(amountOf(site, 'Delivery and pickup')).toBe(0);
  });

  it('quotes inside the base radius when the location did not match', () => {
    const q = quote(sel({ unitId: 'trailer-2', start: '2026-11-14', end: '2026-11-14', location: UNMATCHED }));
    const delivery = lineOf(q, 'Delivery and pickup');
    expect(delivery.amount).toBe(0);
    expect(delivery.detail).toBe('Location not matched yet · quoted inside the free 25-mile radius');
    expect(q.notes).toContain(N7);
  });

  it('does not double-charge the return trip', () => {
    // One-way only: 50 miles is 25 excess miles, not 50.
    const q = quote(sel({ unitId: 'trailer-2', start: '2026-11-14', end: '2026-11-14', location: NAPA }));
    expect(amountOf(q, 'Delivery and pickup')).toBe(88);
    expect(amountOf(q, 'Delivery and pickup')).not.toBe(175);
  });
});

describe('integer money', () => {
  const matrix = [];
  for (const unitId of ['trailer-2', 'trailer-3', 'trailer-4', 'trailer-8', 'trailer-ada']) {
    for (const [start, end] of [
      ['2026-09-19', '2026-09-19'],
      ['2026-09-19', '2026-09-20'],
      ['2026-09-19', '2026-09-22'],
      ['2027-02-13', '2027-02-13'],
      ['2027-02-13', '2027-02-15'],
      [null, null],
    ]) {
      for (const location of [OAKLAND, PLEASANTON, FREMONT, NAPA, GUALALA, UNMATCHED]) {
        matrix.push(
          sel({
            unitId,
            start,
            end,
            location,
            extraStandardUnits: 3,
            extraHandwash: 1,
            addOns: { generator: true, waterBuffalo: true, attendant: true },
          }),
        );
        matrix.push(sel({ unitId, start, end, location }));
      }
    }
  }
  for (const units of [
    { 'unit-standard': 1 },
    { 'unit-standard': 3, 'unit-standard-ada': 1, 'station-handwash': 2 },
    { 'unit-standard-ada': 2 },
    { 'station-handwash': 5 },
    { 'unit-standard': 7, 'station-handwash': 3 },
  ]) {
    for (const term of [
      { unit: 'months', count: 1 },
      { unit: 'months', count: 3 },
      { unit: 'months', count: 12 },
      { unit: 'weeks', count: 4 },
      { unit: 'weeks', count: 5 },
      { unit: 'weeks', count: 6 },
      { unit: 'weeks', count: 7 },
      { unit: 'weeks', count: 13 },
    ]) {
      for (const serviceFrequency of ['weekly', 'twice-weekly']) {
        matrix.push(
          sel({ mode: 'site', units, term, serviceFrequency, start: '2026-09-01', location: NAPA }),
        );
        matrix.push(
          sel({ mode: 'site', units, term, serviceFrequency, start: '2027-01-11', location: UNMATCHED }),
        );
      }
    }
  }

  it(`returns whole dollars everywhere across ${matrix.length} selections`, () => {
    for (const selection of matrix) {
      const q = quote(selection);
      const tag = `${selection.mode}/${selection.unitId}/${selection.start}/${selection.location.name}`;
      for (const li of q.lineItems) {
        expect(Number.isInteger(li.amount), `${tag} :: ${li.label} = ${li.amount}`).toBe(true);
        expect(li.amount, `${tag} :: ${li.label}`).toBeGreaterThanOrEqual(0);
      }
      expect(Number.isInteger(q.subtotal), tag).toBe(true);
      expect(Number.isInteger(q.total), tag).toBe(true);
    }
  });

  it('keeps subtotal equal to the sum of the line items, and total equal to subtotal', () => {
    for (const selection of matrix) {
      const q = quote(selection);
      const sum = q.lineItems.reduce((acc, li) => acc + li.amount, 0);
      const tag = `${selection.mode}/${selection.unitId}/${selection.start}`;
      expect(q.subtotal, tag).toBe(sum);
      expect(q.total, tag).toBe(q.subtotal);
    }
  });

  it('keeps every label unique and every detail non-empty', () => {
    for (const selection of matrix) {
      const q = quote(selection);
      const seen = labels(q);
      expect(new Set(seen).size, seen.join(' / ')).toBe(seen.length);
      for (const li of q.lineItems) {
        expect(typeof li.label).toBe('string');
        expect(li.label.length).toBeGreaterThan(0);
        expect(typeof li.detail).toBe('string');
        expect(li.detail.length).toBeGreaterThan(0);
        expect(li.detail).not.toContain('undefined');
        expect(li.detail).not.toContain('NaN');
      }
      for (const note of q.notes) {
        expect(typeof note).toBe('string');
        expect(note.length).toBeGreaterThan(0);
      }
      expect(Object.keys(q).sort()).toEqual(['lineItems', 'notes', 'subtotal', 'total']);
    }
  });

  it('is pure: the same selection quotes the same numbers every time', () => {
    const selection = sel({
      unitId: 'trailer-4',
      start: '2026-06-13',
      end: '2026-06-14',
      location: NAPA,
      addOns: { attendant: true },
    });
    const first = quote(selection);
    const second = quote(selection);
    expect(second).toEqual(first);
    expect(selection.location.miles).toBe(50); // and it does not mutate its input
  });
});

describe('jobsite monthly pricing', () => {
  const units = { 'unit-standard': 3, 'unit-standard-ada': 1, 'station-handwash': 2 };

  it('prices a three-month term with once-weekly service', () => {
    const q = quote(
      sel({
        mode: 'site',
        units,
        term: { unit: 'months', count: 3 },
        serviceFrequency: 'weekly',
        start: '2026-09-19',
        location: WALNUT_CREEK,
      }),
    );
    expect(q.lineItems).toEqual([
      { label: 'Standard unit', detail: '3 × $145/month × 3 months', amount: 1305 },
      { label: 'ADA standard unit', detail: '1 × $185/month × 3 months', amount: 555 },
      { label: 'Hand-wash station', detail: '2 × $75/month × 3 months', amount: 450 },
      {
        label: 'Delivery and pickup',
        detail: 'Z1 · 20 mi · inside the free 25-mile radius',
        amount: 0,
      },
    ]);
    expect(q.total).toBe(2310);
    expect(q.notes).toContain(N2);
    expect(q.notes).not.toContain(N1);
  });

  it('adds the second weekly visit at $45 per unit per month', () => {
    const q = quote(
      sel({
        mode: 'site',
        units,
        term: { unit: 'months', count: 3 },
        serviceFrequency: 'twice-weekly',
        start: '2026-09-19',
        location: WALNUT_CREEK,
      }),
    );
    expect(labels(q)).toEqual([
      'Standard unit',
      'ADA standard unit',
      'Hand-wash station',
      'Second weekly service visit',
      'Delivery and pickup',
    ]);
    const visit = lineOf(q, 'Second weekly service visit');
    expect(visit.detail).toBe('6 units × $45/month × 3 months');
    expect(visit.amount).toBe(810); // round(45 * 3) x 6 units
    expect(q.total).toBe(3120);
  });

  it('charges the second visit for hand-wash stations too', () => {
    const weekly = quote(
      sel({
        mode: 'site',
        units: { 'station-handwash': 2 },
        term: { unit: 'months', count: 1 },
        serviceFrequency: 'weekly',
        location: OAKLAND,
      }),
    );
    const twice = quote(
      sel({
        mode: 'site',
        units: { 'station-handwash': 2 },
        term: { unit: 'months', count: 1 },
        serviceFrequency: 'twice-weekly',
        location: OAKLAND,
      }),
    );
    expect(weekly.total).toBe(150);
    expect(lineOf(twice, 'Second weekly service visit').detail).toBe('2 units × $45/month × 1 months');
    expect(twice.total).toBe(150 + 90);
  });

  it('prices a term given in weeks as a fraction of a month', () => {
    const q = quote(
      sel({
        mode: 'site',
        units: { 'unit-standard': 2 },
        term: { unit: 'weeks', count: 6 },
        serviceFrequency: 'weekly',
        location: OAKLAND,
      }),
    );
    // monthsFactor = 6 / 4 = 1.5 -> round(145 * 1.5) = 218 per unit.
    expect(q.lineItems[0]).toEqual({
      label: 'Standard unit',
      detail: '2 × $145/month × 6 weeks',
      amount: 436,
    });
    expect(q.total).toBe(436);
  });

  it('prices the four-week minimum term as one month', () => {
    const fourWeeks = quote(
      sel({
        mode: 'site',
        units: { 'unit-standard': 1 },
        term: { unit: 'weeks', count: 4 },
        location: OAKLAND,
      }),
    );
    const oneMonth = quote(
      sel({
        mode: 'site',
        units: { 'unit-standard': 1 },
        term: { unit: 'months', count: 1 },
        location: OAKLAND,
      }),
    );
    expect(fourWeeks.total).toBe(145);
    expect(oneMonth.total).toBe(145);
    expect(fourWeeks.lineItems[0].detail).toBe('1 × $145/month × 4 weeks');
    // The machine-plain term text, singular special-casing deliberately absent.
    expect(oneMonth.lineItems[0].detail).toBe('1 × $145/month × 1 months');
  });

  it('omits any unit type with a quantity of zero', () => {
    const q = quote(
      sel({
        mode: 'site',
        units: { 'unit-standard': 0, 'unit-standard-ada': 2, 'station-handwash': 0 },
        term: { unit: 'months', count: 2 },
        location: OAKLAND,
      }),
    );
    expect(labels(q)).toEqual(['ADA standard unit', 'Delivery and pickup']);
    expect(q.lineItems[0].amount).toBe(740); // round(185 * 2) x 2
  });

  it('never charges a seasonal premium on a jobsite rental', () => {
    for (const month of [5, 6, 7, 8, 9, 10]) {
      const q = quote(
        sel({
          mode: 'site',
          units,
          term: { unit: 'months', count: 6 },
          serviceFrequency: 'twice-weekly',
          start: `2026-${String(month).padStart(2, '0')}-01`,
          location: NAPA,
        }),
      );
      expect(q.lineItems.some((li) => li.label.startsWith('Peak season')), `month ${month}`).toBe(false);
      const june = quote(
        sel({
          mode: 'site',
          units,
          term: { unit: 'months', count: 6 },
          serviceFrequency: 'twice-weekly',
          start: '2026-01-05',
          location: NAPA,
        }),
      );
      expect(q.total, `month ${month}`).toBe(june.total);
    }
  });

  it('charges mileage on a jobsite delivery like any other', () => {
    const q = quote(
      sel({
        mode: 'site',
        units: { 'unit-standard': 1 },
        term: { unit: 'months', count: 1 },
        location: NAPA,
      }),
    );
    expect(amountOf(q, 'Delivery and pickup')).toBe(88);
    expect(q.total).toBe(145 + 88);
  });

  it('scales linearly with the term length', () => {
    const one = quote(
      sel({ mode: 'site', units: { 'unit-standard': 4 }, term: { unit: 'months', count: 1 }, location: OAKLAND }),
    );
    const twelve = quote(
      sel({ mode: 'site', units: { 'unit-standard': 4 }, term: { unit: 'months', count: 12 }, location: OAKLAND }),
    );
    expect(one.total).toBe(580);
    expect(twelve.total).toBe(6960);
    expect(twelve.total).toBe(one.total * 12);
  });
});

describe('empty states', () => {
  it('says what it needs when no size has been chosen', () => {
    expect(quote(sel({ mode: 'event', unitId: null }))).toEqual({
      lineItems: [],
      subtotal: 0,
      total: 0,
      notes: ['Choose a size and we will price it here.'],
    });
  });

  it('says what it needs when no jobsite unit has been chosen', () => {
    expect(
      quote(
        sel({
          mode: 'site',
          units: { 'unit-standard': 0, 'unit-standard-ada': 0, 'station-handwash': 0 },
          serviceFrequency: 'twice-weekly',
          location: NAPA,
        }),
      ),
    ).toEqual({
      lineItems: [],
      subtotal: 0,
      total: 0,
      notes: ['Add at least one unit and we will price it here.'],
    });
  });

  it('still empties out when a date and a location are already set', () => {
    const q = quote(sel({ mode: 'event', unitId: null, start: '2026-09-19', end: '2026-09-19', location: NAPA }));
    expect(q.lineItems).toEqual([]);
    expect(q.total).toBe(0);
    expect(q.notes).toHaveLength(1);
  });
});

describe('notes', () => {
  it('explains the weekend hold on any trailer booking', () => {
    const q = quote(sel({ unitId: 'trailer-ada', start: '2026-11-14', end: '2026-11-14', location: OAKLAND }));
    expect(q.notes).toContain(N1);
    expect(amountOf(q, 'ADA Trailer')).toBe(1650);
  });

  it('warns, and does not block, when the customer sizes below the recommendation', () => {
    // 400 guests over 6 hours with a bar wants 10 stations; the 2-station
    // trailer is still bookable.
    const under = quote(
      sel({
        unitId: 'trailer-2',
        guests: 400,
        hours: 6,
        alcohol: true,
        start: '2026-11-14',
        end: '2026-11-14',
        location: OAKLAND,
      }),
    );
    expect(under.notes).toContain(N10);
    expect(under.total).toBe(1450);

    const over = quote(
      sel({
        unitId: 'trailer-8',
        guests: 100,
        hours: 4,
        alcohol: false,
        start: '2026-11-14',
        end: '2026-11-14',
        location: OAKLAND,
      }),
    );
    expect(over.notes).not.toContain(N10);
  });

  it('explains the off-grid add-ons only while they are missing', () => {
    const bare = quote(
      sel({
        unitId: 'trailer-3',
        start: '2026-11-14',
        end: '2026-11-14',
        location: NAPA,
        offGrid: true,
      }),
    );
    expect(bare.notes).toContain(N8);
    expect(bare.notes).toContain(N9);

    const equipped = quote(
      sel({
        unitId: 'trailer-3',
        start: '2026-11-14',
        end: '2026-11-14',
        location: NAPA,
        offGrid: true,
        addOns: { generator: true, waterBuffalo: true },
      }),
    );
    expect(equipped.notes).not.toContain(N8);
    expect(equipped.notes).not.toContain(N9);

    const onGrid = quote(
      sel({ unitId: 'trailer-3', start: '2026-11-14', end: '2026-11-14', location: NAPA, offGrid: false }),
    );
    expect(onGrid.notes).not.toContain(N8);
    expect(onGrid.notes).not.toContain(N9);
  });

  it('pushes the notes in the contract order', () => {
    const q = quote(
      sel({
        unitId: 'trailer-8',
        guests: 900,
        hours: 12,
        alcohol: true,
        start: '2026-09-19',
        end: '2026-09-20',
        location: UNMATCHED,
        offGrid: true,
        extraStandardUnits: 4,
      }),
    );
    // N1 trailer, N3 extra day, N4 peak, N7 unmatched, N8 no generator,
    // N9 no water buffalo, N10 under-sized against 900 guests, N11 paired.
    expect(q.notes).toEqual([N1, N3, N4, N7, N8, N9, N10, N11]);
  });

  it('never tells the customer to call for a quote', () => {
    const samples = [
      sel({ unitId: 'trailer-3', start: '2026-09-19', end: '2026-09-19', location: GUALALA }),
      sel({ unitId: null }),
      sel({ mode: 'site', units: { 'unit-standard': 2 }, location: GUALALA }),
      sel({ mode: 'site', units: {} }),
      sel({ unitId: 'trailer-2', guests: 2000, hours: 12, alcohol: true, location: UNMATCHED }),
    ];
    for (const selection of samples) {
      const text = quote(selection).notes.join(' ').toLowerCase();
      expect(text).not.toContain('call us');
      expect(text).not.toContain('request a quote');
      expect(text).not.toContain('luxury');
    }
  });
});
