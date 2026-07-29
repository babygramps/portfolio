// The price, itemized, computed on the keystroke. Every rate that touches a total
// lives in data/rates.js or on the fleet record; nothing here is a hidden markup and
// no line is ever called "fees" (spec §3.3).
//
// Order of operations is fixed and directly tested: base rate, then extra days at
// 35% of base each, then the peak multiplier on that sum, and only then mileage and
// add-ons, which are never multiplied by anything.
//
// Pure and synchronous: no clock, no storage, no randomness.
import { unitById } from '../data/fleet.js';
import {
  ADD_ONS,
  EXTRA_DAY_PCT,
  FREE_MILES,
  JOBSITE_ITEMS,
  MILEAGE_PER_MILE,
  MIN_TERM_WEEKS,
  PEAK_UPLIFT,
  SECOND_VISIT_PER_UNIT_MONTH,
} from '../data/rates.js';
import { daysBetween, money, monthName, parseISO } from './format.js';
import { mileageFee, zoneFor } from './zones.js';
import { isPeak } from './availability.js';
import { recommend } from './capacity.js';

const DELIVERY_LABEL = 'Delivery and pickup';
const WEEKS_PER_MONTH = 4;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// A rate with cents in it, written out by hand. money() deals in whole dollars and
// toFixed is off the table (CONTRACT §0.6), so $3.50 is assembled from the constant
// rather than duplicated as a string literal.
function dollarsAndCents(rate) {
  const cents = Math.round(Number(rate) * 100);
  const whole = Math.floor(cents / 100);
  const remainder = String(cents % 100).padStart(2, '0');
  return `$${whole}.${remainder}`;
}

const EXTRA_DAY_TEXT = `${Math.round(EXTRA_DAY_PCT * 100)}%`; // '35%'
const PEAK_UPLIFT_TEXT = `+${Math.round(PEAK_UPLIFT * 100)}%`; // '+20%'
const PER_MILE_TEXT = dollarsAndCents(MILEAGE_PER_MILE); // '$3.50'

// The exact strings from CONTRACT §B.3, keyed by their note id so the mapping stays
// checkable against the document.
const NOTE = {
  n1: 'The rate covers delivery Friday, service Saturday and pickup Monday. Friday through Sunday is held on the calendar for your trailer.',
  n2: 'Weekly service is included: pump, restock, sanitise. The minimum term is four weeks.',
  n3: 'Extra days are billed at 35% of the base rate.',
  n4: 'May through October is peak season. The premium is on its own line above, never folded into the rate.',
  n5: 'Pick a date and we will show whether peak-season pricing applies.',
  n6: 'Zone 5: beyond 110 miles we hold the date and call within one business day to confirm the delivery window. Nothing is charged before that call.',
  n7: 'We could not match that city or ZIP, so delivery is quoted inside the base radius. We will confirm the mileage on the callback.',
  n8: 'You marked the site as off-grid. Climate control and interior lighting need 120 V / 20 A — add the generator or arrange power on site.',
  n9: 'You marked the site as off-grid. Tanks arrive full, which covers a normal event; the fresh-water buffalo is what lets us refill on site.',
  n10: 'You have chosen fewer stations than we recommend for this headcount. It will work; expect a line at the peak hour.',
  n11: 'Above 480 guests we pair the 8-station trailer with standard units set at the far side of the site.',
};

const EMPTY_EVENT = 'Choose a size and we will price it here.';
const EMPTY_SITE = 'Add at least one unit and we will price it here.';

function nonNegativeInt(value) {
  const rounded = Math.round(Number(value));
  return Number.isFinite(rounded) && rounded > 0 ? rounded : 0;
}

function isoOrNull(value) {
  return typeof value === 'string' && ISO_DATE.test(value) ? value : null;
}

// Only a real number counts as a matched distance. Number(null) is 0, which would
// quietly turn "we could not match that address" into "you are in the free radius".
function milesOf(location) {
  const raw = location ? location.miles : null;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  return raw;
}

function zoneOf(location, miles) {
  if (location && typeof location.zone === 'string' && location.zone) return location.zone;
  return miles === null ? null : zoneFor(miles);
}

function rateWeekendOf(unitId) {
  const unit = unitById(unitId);
  return unit ? nonNegativeInt(unit.rateWeekend) : 0;
}

// Always present, and reads $0 inside the free radius. Showing the customer that the
// drive is free is worth more than saving a row.
function deliveryLine(location) {
  const miles = milesOf(location);

  if (miles === null) {
    return {
      label: DELIVERY_LABEL,
      detail: `Location not matched yet · quoted inside the free ${FREE_MILES}-mile radius`,
      amount: 0,
    };
  }

  const zone = zoneOf(location, miles);
  const detail =
    miles <= FREE_MILES
      ? `${zone} · ${miles} mi · inside the free ${FREE_MILES}-mile radius`
      : `${zone} · ${miles} mi · ${miles - FREE_MILES} mi beyond the free ${FREE_MILES} at ${PER_MILE_TEXT}/mi`;

  return { label: DELIVERY_LABEL, detail, amount: mileageFee(miles) };
}

function settle(lineItems, notes) {
  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  // total === subtotal, always: there is no tax line and no service fee, so the UI
  // renders the items and one Total row.
  return { lineItems, subtotal, total: subtotal, notes };
}

function quoteEvent(selection) {
  const unit = unitById(selection.unitId);
  if (!unit) {
    return { lineItems: [], subtotal: 0, total: 0, notes: [EMPTY_EVENT] };
  }

  const start = isoOrNull(selection.start);
  const endRaw = isoOrNull(selection.end);
  const end = start ? (endRaw && endRaw > start ? endRaw : start) : null;

  const base = nonNegativeInt(unit.rateWeekend);
  const extraDays = start ? Math.max(0, daysBetween(start, end)) : 0;
  const extraDayEach = Math.round(base * EXTRA_DAY_PCT);
  const extraDaysAmount = extraDayEach * extraDays;
  const preSeason = base + extraDaysAmount;

  const peak = isPeak(start);
  const peakAmount = peak ? Math.round(preSeason * PEAK_UPLIFT) : 0;

  const location = selection.location || {};
  const miles = milesOf(location);
  const zone = zoneOf(location, miles);

  const extraStandardUnits = nonNegativeInt(selection.extraStandardUnits);
  const extraHandwash = nonNegativeInt(selection.extraHandwash);
  const standardRate = rateWeekendOf('unit-standard');
  const handwashRate = rateWeekendOf('station-handwash');

  const chosenAddOns = selection.addOns || {};

  const lineItems = [
    {
      label: unit.name,
      detail: `Weekend rate · ${unit.stations} stations`,
      amount: base,
    },
  ];

  if (extraDays >= 1) {
    lineItems.push({
      label: `${extraDays} extra ${extraDays === 1 ? 'day' : 'days'}`,
      detail: `${EXTRA_DAY_TEXT} of base rate, ${money(extraDayEach)} each`,
      amount: extraDaysAmount,
    });
  }

  if (peak) {
    lineItems.push({
      label: `Peak season (${monthName(parseISO(start).m)})`,
      detail: `${PEAK_UPLIFT_TEXT} on the rate and any extra days`,
      amount: peakAmount,
    });
  }

  lineItems.push(deliveryLine(location));

  if (extraStandardUnits > 0) {
    lineItems.push({
      label: 'Standard units',
      detail: `${extraStandardUnits} × ${money(standardRate)} event rate`,
      amount: standardRate * extraStandardUnits,
    });
  }

  if (extraHandwash > 0) {
    lineItems.push({
      label: 'Hand-wash stations',
      detail: `${extraHandwash} × ${money(handwashRate)} event rate`,
      amount: handwashRate * extraHandwash,
    });
  }

  for (const addOn of ADD_ONS) {
    if (chosenAddOns[addOn.id]) {
      lineItems.push({ label: addOn.label, detail: addOn.detail, amount: addOn.amount });
    }
  }

  const notes = [];
  if (unit.kind === 'trailer') notes.push(NOTE.n1);
  if (extraDays >= 1) notes.push(NOTE.n3);
  if (peak) notes.push(NOTE.n4);
  if (!start) notes.push(NOTE.n5);
  if (zone === 'Z5') notes.push(NOTE.n6);
  if (miles === null) notes.push(NOTE.n7);
  if (selection.offGrid && !chosenAddOns.generator) notes.push(NOTE.n8);
  if (selection.offGrid && !chosenAddOns.waterBuffalo) notes.push(NOTE.n9);

  const recommended = recommend({
    guests: selection.guests,
    hours: selection.hours,
    alcohol: selection.alcohol,
  });
  if (unit.stations < recommended.stations) notes.push(NOTE.n10);
  if (extraStandardUnits > 0) notes.push(NOTE.n11);

  return settle(lineItems, notes);
}

function quoteSite(selection) {
  const units = selection.units || {};
  const quantities = JOBSITE_ITEMS.map((item) => nonNegativeInt(units[item.id]));
  const unitCount = quantities.reduce((sum, qty) => sum + qty, 0);

  if (unitCount === 0) {
    return { lineItems: [], subtotal: 0, total: 0, notes: [EMPTY_SITE] };
  }

  const term = selection.term || {};
  const termUnit = term.unit === 'weeks' ? 'weeks' : 'months';
  const minCount = termUnit === 'weeks' ? MIN_TERM_WEEKS : 1;
  const count = Math.max(minCount, nonNegativeInt(term.count));
  const monthsFactor = termUnit === 'months' ? count : count / WEEKS_PER_MONTH;
  const termText = `${count} ${termUnit}`;

  const location = selection.location || {};
  const miles = milesOf(location);
  const zone = zoneOf(location, miles);

  const lineItems = [];

  JOBSITE_ITEMS.forEach((item, index) => {
    const qty = quantities[index];
    if (qty === 0) return;
    lineItems.push({
      label: item.label,
      detail: `${qty} × ${money(item.rateMonthly)}/month × ${termText}`,
      amount: Math.round(item.rateMonthly * monthsFactor) * qty,
    });
  });

  if (selection.serviceFrequency === 'twice-weekly') {
    lineItems.push({
      label: 'Second weekly service visit',
      detail: `${unitCount} units × ${money(SECOND_VISIT_PER_UNIT_MONTH)}/month × ${termText}`,
      amount: Math.round(SECOND_VISIT_PER_UNIT_MONTH * monthsFactor) * unitCount,
    });
  }

  lineItems.push(deliveryLine(location));

  // No peak line on a jobsite quote, ever. Charging a construction crew more for a
  // September portable toilet would be indefensible, so the seasonal premium simply
  // does not exist on this side of the business.
  const notes = [NOTE.n2];
  if (zone === 'Z5') notes.push(NOTE.n6);
  if (miles === null) notes.push(NOTE.n7);

  return settle(lineItems, notes);
}

// quote(selection) -> {lineItems, subtotal, total, notes}
export function quote(selection) {
  const sel = selection || {};
  return sel.mode === 'site' ? quoteSite(sel) : quoteEvent(sel);
}
