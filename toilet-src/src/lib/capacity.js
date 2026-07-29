// Sizing: guest count -> restroom stations -> the smallest fleet unit that covers
// it, with the arithmetic returned in plain English so the Size step can print it
// on screen. Publishing the capacity logic is the product (spec §3.1); no
// competitor does it, so the numbers have to be defensible line by line.
//
// Pure and synchronous per CONTRACT §0.10: no clock, no storage, no randomness.
import { unitById } from '../data/fleet.js';

export const GUESTS_PER_STATION = 60;
export const ALCOHOL_FACTOR = 1.25;
export const INDUSTRY_PER_STATION = 75; // the common rule of thumb, for comparison copy
export const COMPETITOR_PER_STATION = 92; // a Bay Area operator's advertised figure
export const RECOMMEND_POOL = ['trailer-2', 'trailer-3', 'trailer-4', 'trailer-8'];
export const EVENT_UNIT_IDS = ['trailer-2', 'trailer-3', 'trailer-4', 'trailer-8', 'trailer-ada'];

// Every Fieldhouse booking carries at least two stations: one station is a single
// point of failure, and a locked door with nobody coming out is the worst moment
// of an event.
const MIN_STATIONS = 2;

// ALCOHOL_FACTOR expressed as an exact fraction (5 / 4 === 1.25).
const ALCOHOL_NUM = 5;
const ALCOHOL_DEN = 4;

// Duration bands. Each carries the factor twice: as the decimal we print, and as
// an exact fraction we round with. That is not redundancy — 1.15 and 1.3 have no
// exact binary representation, so `10 * 1.3` evaluates to 13.000000000000002 and a
// naive Math.ceil would recommend 14 stations for a 600-guest, 12-hour event.
// Integer numerator/denominator arithmetic makes the ceiling exact at every input.
const DURATION_BANDS = [
  { maxHours: 5, factor: 1, num: 1, den: 1 },
  { maxHours: 8, factor: 1.15, num: 23, den: 20 },
  { maxHours: null, factor: 1.3, num: 13, den: 10 },
];

function bandFor(hours) {
  const h = Number(hours);
  if (!Number.isFinite(h)) return DURATION_BANDS[0];
  for (const band of DURATION_BANDS) {
    if (band.maxHours === null || h <= band.maxHours) return band;
  }
  return DURATION_BANDS[DURATION_BANDS.length - 1];
}

// Format a number for the printed arithmetic: at most two decimals, trailing
// zeros stripped. 3 -> '3', 4.3125 -> '4.31', two thirds -> '0.67'.
function n(value) {
  return String(Math.round(value * 100) / 100);
}

function safeGuests(guests) {
  const g = Math.round(Number(guests));
  return Number.isFinite(g) && g > 0 ? g : 0;
}

// 1.0 at five hours or less, 1.15 through eight, 1.3 beyond. The boundaries belong
// to the lower band: 5 -> 1.0 and 8 -> 1.15.
export function durationFactor(hours) {
  return bandFor(hours).factor;
}

// recommend({guests, hours, alcohol}) -> {stations, unitId, extraStandardUnits, steps}
//
// stations = max(2, ceil(guests / 60 × alcoholFactor × durationFactor))
//
// The ceiling is taken on the unrounded value, never on the two-decimal figure we
// display: 180 guests with bar service over six hours is 4.3125, which ceilings to
// 5 even though the screen reads 4.31.
export function recommend({ guests, hours, alcohol } = {}) {
  const g = safeGuests(guests);
  const band = bandFor(hours);
  const factor = band.factor;
  const withAlcohol = Boolean(alcohol);

  // Display arithmetic, in the order it is printed.
  const perStation = g / GUESTS_PER_STATION;
  const afterAlcohol = withAlcohol ? perStation * ALCOHOL_FACTOR : perStation;
  const afterDuration = afterAlcohol * factor;

  // Rounding arithmetic, held in integers so no floating-point crumb can push a
  // whole number over the line and sell someone a station they do not need.
  const numerator = g * (withAlcohol ? ALCOHOL_NUM : 1) * band.num;
  const denominator = GUESTS_PER_STATION * (withAlcohol ? ALCOHOL_DEN : 1) * band.den;
  const ceil = Math.ceil(numerator / denominator);
  const stations = Math.max(MIN_STATIONS, ceil);

  const steps = [`${g} guests ÷ ${GUESTS_PER_STATION} guests per station = ${n(perStation)}`];
  if (withAlcohol) {
    steps.push(`× ${n(ALCOHOL_FACTOR)} for bar service = ${n(afterAlcohol)}`);
  }
  if (factor !== 1) {
    steps.push(`× ${n(factor)} for a ${hours}-hour event = ${n(afterDuration)}`);
  }
  steps.push(`Rounded up to ${ceil} stations`);
  if (ceil < MIN_STATIONS) {
    steps.push(`Minimum ${MIN_STATIONS} stations on any Fieldhouse booking`);
  }

  // Smallest unit in the pool that covers the station count. The ADA trailer is
  // never auto-recommended: accessibility is a decision the customer makes
  // explicitly, not one we make for them. Above eight stations we fall back to the
  // largest trailer and pair standard units with it below, rather than refusing
  // the booking (spec §5.6).
  let unitId = RECOMMEND_POOL[RECOMMEND_POOL.length - 1];
  for (const id of RECOMMEND_POOL) {
    const candidate = unitById(id);
    if (candidate && candidate.stations >= stations) {
      unitId = id;
      break;
    }
  }

  const chosen = unitById(unitId);
  const covered = chosen ? chosen.stations : 0;
  const extraStandardUnits = Math.max(0, stations - covered);

  return { stations, unitId, extraStandardUnits, steps };
}
