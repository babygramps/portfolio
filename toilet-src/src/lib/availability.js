// What is actually free, and when. Two sources of truth: the hand-authored season
// ledger in data/season.js (the bookings we already have) and the customer's own
// saved bookings from lib/store.js. Unavailable dates are shown struck through
// rather than hidden — visible scarcity is the whole conversion mechanism (spec §3.4).
//
// This module never reads the clock. A date in the past is "available" as far as
// availability is concerned; the Calendar greys the past out with format.isPastDate.
// That is deliberate: it is what makes every branch here testable.
import { SEASON_LEDGER } from '../data/season.js';
import { PEAK_MONTHS } from '../data/rates.js';
import { unitById } from '../data/fleet.js';
import { addDays, parseISO } from './format.js';
import { bookingBlocks } from './store.js';

// One day either side of every trailer job: we deliver the day before and collect
// the day after, so a Saturday wedding consumes Friday through Sunday. One truck,
// one operator, no way around it.
export const TRAILER_PAD_DAYS = 1;

// Walk at most two years forward looking for an opening. A bounded loop is what
// guarantees nextAvailable always returns a string and always terminates.
const MAX_SCAN_DAYS = 730;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isISODate(value) {
  return typeof value === 'string' && ISO_DATE.test(value);
}

// 'YYYY-MM-DD' sorts chronologically as a plain string, so date comparison needs no
// parsing and cannot be shifted by a timezone.
function later(a, b) {
  return a >= b ? a : b;
}

// Inclusive on both ends: two jobs that merely touch on the same day still collide,
// because the trailer cannot be in two places that morning.
function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart <= bEnd && bStart <= aEnd;
}

function toRange(entry) {
  if (!entry || !isISODate(entry.start)) return null;
  const start = entry.start;
  const end = isISODate(entry.end) ? later(start, entry.end) : start;
  return { start, end };
}

// Every job for this unit, already padded: the days the trailer is not in the yard.
function paddedRanges(entries, unitId) {
  const windows = [];
  for (const entry of entries) {
    if (!entry || entry.unitId !== unitId) continue;
    const range = toRange(entry);
    if (!range) continue;
    windows.push({
      start: addDays(range.start, -TRAILER_PAD_DAYS),
      end: addDays(range.end, TRAILER_PAD_DAYS),
    });
  }
  return windows;
}

// Computed once per query rather than once per candidate date, so nextAvailable's
// two-year walk does not re-read storage 700 times.
function heldWindows(unitId) {
  const blocks = bookingBlocks();
  return {
    ledger: paddedRanges(SEASON_LEDGER, unitId),
    bookings: paddedRanges(Array.isArray(blocks) ? blocks : [], unitId),
  };
}

// May through October. The premium that rides on this is always its own line item.
export function isPeak(date) {
  if (!isISODate(date)) return false;
  return PEAK_MONTHS.includes(parseISO(date).m);
}

// 'ledger' | 'booking' | null. Ledger wins when both apply, so the reason shown to
// the customer is the older commitment.
function blockingSource(unitId, start, end, held) {
  const unit = unitById(unitId);
  // Standard units and hand-wash stations are stocked in quantity: they are never on
  // a calendar, and an unknown id has nothing booked against it either.
  if (!unit || unit.kind !== 'trailer') return null;
  if (!isISODate(start)) return null;

  const to = isISODate(end) ? later(start, end) : start;

  // The pad lives on the held windows only — the days a committed job actually
  // takes the trailer out of the yard — and the request is compared to them as
  // asked for. That is what makes a booked Saturday consume exactly Friday through
  // Sunday, which is the promise on every quote (note N1), on the printed receipt,
  // in spec §3.4 and in the CONTRACT's own ledger anchor comment ("2026-10-17 pads
  // to 10-16 … 10-18"). Padding both sides as well as the request would quietly
  // block Thursday and Monday too — five days for a one-day job, and a receipt that
  // contradicts the calendar.
  const wantStart = start;
  const wantEnd = to;
  const windows = held || heldWindows(unitId);

  for (const window of windows.ledger) {
    if (overlaps(wantStart, wantEnd, window.start, window.end)) return 'ledger';
  }

  // Ledger first, so an existing commitment outranks the customer's own booking as
  // the stated reason.
  for (const window of windows.bookings) {
    if (overlaps(wantStart, wantEnd, window.start, window.end)) return 'booking';
  }

  return null;
}

// isAvailable('trailer-3', {start: '2026-09-19', end: '2026-09-19'}) -> boolean
// `end` may equal `start`, or be absent for a single-day event.
export function isAvailable(unitId, range) {
  const { start, end } = range || {};
  return blockingSource(unitId, start, end) === null;
}

// The soonest date this unit is free, walking forward one day at a time from
// fromDate inclusive. The UI uses it so an unavailable date offers the nearest open
// one instead of dead-ending (spec §5.6).
export function nextAvailable(unitId, fromDate) {
  // Callers always pass a real 'YYYY-MM-DD' — format.todayISO() or a calendar cell.
  // A malformed value has no successor to compute, so hand it straight back rather
  // than throw: the contract promises a string in every case.
  if (!isISODate(fromDate)) return typeof fromDate === 'string' ? fromDate : '';

  const held = heldWindows(unitId);
  let date = fromDate;
  for (let i = 0; i < MAX_SCAN_DAYS - 1; i += 1) {
    if (blockingSource(unitId, date, date, held) === null) return date;
    date = addDays(date, 1);
  }
  // Two years of scanning and nothing open: return the last date examined so the
  // caller still has a valid date to show.
  return date;
}

// Everything the Calendar needs for one cell.
export function dayState(unitId, date) {
  const blockedBy = blockingSource(unitId, date, date);
  return {
    date,
    available: blockedBy === null,
    peak: isPeak(date),
    blockedBy,
  };
}
