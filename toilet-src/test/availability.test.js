import { describe, it, expect, beforeEach, vi } from 'vitest';

// store.js owns every localStorage access and must degrade silently without it.
// These tests need a real store, so a memory-backed localStorage is installed
// before any import is evaluated.
const { storage } = vi.hoisted(() => {
  const map = new Map();
  const shim = {
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
  globalThis.localStorage = shim;
  if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
  return { storage: shim };
});

import {
  TRAILER_PAD_DAYS,
  isPeak,
  isAvailable,
  nextAvailable,
  dayState,
} from '../src/lib/availability.js';
import { SEASON_LEDGER } from '../src/data/season.js';
import { FLEET, unitById } from '../src/data/fleet.js';
import {
  bookingBlocks,
  clearBookings,
  emptySelection,
  loadBookings,
  saveBooking,
} from '../src/lib/store.js';

// ---------------------------------------------------------------------------
// Local, timezone-proof date helpers so these tests do not depend on format.js.
// ---------------------------------------------------------------------------

const DAY_MS = 86400000;

function dayNumber(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

function shift(iso, n) {
  const at = new Date((dayNumber(iso) + n) * DAY_MS);
  const y = at.getUTCFullYear();
  const m = String(at.getUTCMonth() + 1).padStart(2, '0');
  const d = String(at.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function diffDays(a, b) {
  return dayNumber(b) - dayNumber(a);
}

const TRAILERS = FLEET.filter((u) => u.kind === 'trailer').map((u) => u.id);

// Contract A.4: no ledger entry may cover or pad into any of these.
const REQUIRED_OPEN = ['2026-11-14', '2026-12-05', '2027-01-16', '2027-03-06'];

function one(date) {
  return { start: date, end: date };
}

function eventBookingInput(unitId, start, end, location) {
  const selection = emptySelection('event');
  selection.unitId = unitId;
  selection.start = start;
  selection.end = end;
  if (location) selection.location = { ...selection.location, ...location };
  return {
    mode: 'event',
    selection,
    quote: { lineItems: [], subtotal: 0, total: 0, notes: [] },
    contact: { name: 'Dana Ruiz', email: 'dana@example.com', phone: '5105550117' },
  };
}

beforeEach(() => {
  clearBookings();
  storage.clear();
  clearBookings();
});

// ---------------------------------------------------------------------------

describe('isPeak', () => {
  it('is true for May through October', () => {
    expect(isPeak('2026-05-01')).toBe(true);
    expect(isPeak('2026-06-15')).toBe(true);
    expect(isPeak('2026-07-04')).toBe(true);
    expect(isPeak('2026-08-22')).toBe(true);
    expect(isPeak('2026-09-19')).toBe(true);
    expect(isPeak('2026-10-31')).toBe(true);
  });

  it('is false for November through April', () => {
    expect(isPeak('2026-11-01')).toBe(false);
    expect(isPeak('2026-11-14')).toBe(false);
    expect(isPeak('2026-12-05')).toBe(false);
    expect(isPeak('2027-01-16')).toBe(false);
    expect(isPeak('2027-02-14')).toBe(false);
    expect(isPeak('2027-03-06')).toBe(false);
    expect(isPeak('2027-04-30')).toBe(false);
  });

  it('reads the month from the string, never from a timezone-shifted Date', () => {
    // The first and last day of each boundary month, where a UTC/local slip of
    // one day would flip the answer.
    expect(isPeak('2026-04-30')).toBe(false);
    expect(isPeak('2026-05-01')).toBe(true);
    expect(isPeak('2026-10-31')).toBe(true);
    expect(isPeak('2026-11-01')).toBe(false);
  });

  it('is false for a null date', () => {
    expect(isPeak(null)).toBe(false);
  });
});

describe('the seeded season ledger', () => {
  it('pads by exactly one day on each side', () => {
    expect(TRAILER_PAD_DAYS).toBe(1);
  });

  it('is hand-authored at a plausible size', () => {
    expect(SEASON_LEDGER.length).toBeGreaterThanOrEqual(60);
    expect(SEASON_LEDGER.length).toBeLessThanOrEqual(120);
  });

  it('books trailers only — standard units and hand-wash stations are stocked in quantity', () => {
    for (const entry of SEASON_LEDGER) {
      const unit = unitById(entry.unitId);
      expect(unit, entry.unitId).not.toBeNull();
      expect(unit.kind, entry.unitId).toBe('trailer');
    }
  });

  it('holds well-formed date ranges', () => {
    for (const entry of SEASON_LEDGER) {
      const tag = `${entry.unitId} ${entry.start}..${entry.end}`;
      expect(entry.start, tag).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.end, tag).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(diffDays(entry.start, entry.end), tag).toBeGreaterThanOrEqual(0);
      expect(diffDays(entry.start, entry.end), tag).toBeLessThanOrEqual(3);
      expect(Object.keys(entry).sort(), tag).toEqual(['end', 'start', 'unitId']);
    }
  });

  it('stores event days only, never the pre-expanded delivery block', () => {
    // A pre-expanded Friday-to-Sunday entry would be a 3-day span on every
    // record; the ledger must be mostly single days.
    const singleDay = SEASON_LEDGER.filter((e) => e.start === e.end).length;
    expect(singleDay).toBeGreaterThan(SEASON_LEDGER.length / 2);
  });

  it('never overlaps itself for one trailer, pad included', () => {
    for (const unitId of TRAILERS) {
      const entries = SEASON_LEDGER.filter((e) => e.unitId === unitId).sort((a, b) =>
        a.start < b.start ? -1 : a.start > b.start ? 1 : 0,
      );
      for (let i = 1; i < entries.length; i += 1) {
        const previous = entries[i - 1];
        const current = entries[i];
        const gap = diffDays(previous.end, current.start);
        expect(
          gap,
          `${unitId}: ${previous.start}..${previous.end} and ${current.start}..${current.end} overlap once padded`,
        ).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('includes the required anchor bookings', () => {
    const anchors = [
      { unitId: 'trailer-2', start: '2026-09-19', end: '2026-09-19' },
      { unitId: 'trailer-3', start: '2026-09-19', end: '2026-09-19' },
      { unitId: 'trailer-4', start: '2026-09-19', end: '2026-09-19' },
      { unitId: 'trailer-8', start: '2026-09-19', end: '2026-09-19' },
      { unitId: 'trailer-ada', start: '2026-09-19', end: '2026-09-19' },
      { unitId: 'trailer-3', start: '2026-10-17', end: '2026-10-17' },
      { unitId: 'trailer-4', start: '2026-10-10', end: '2026-10-11' },
    ];
    for (const anchor of anchors) {
      expect(SEASON_LEDGER, JSON.stringify(anchor)).toContainEqual(anchor);
    }
  });

  it('carries at least four multi-day ranges', () => {
    const multiDay = SEASON_LEDGER.filter((e) => diffDays(e.start, e.end) >= 1);
    expect(multiDay.length).toBeGreaterThanOrEqual(4);
  });

  it('leaves the four required-open dates clear of every entry and every pad', () => {
    for (const date of REQUIRED_OPEN) {
      for (const entry of SEASON_LEDGER) {
        const padStart = shift(entry.start, -TRAILER_PAD_DAYS);
        const padEnd = shift(entry.end, TRAILER_PAD_DAYS);
        const covered = diffDays(padStart, date) >= 0 && diffDays(date, padEnd) >= 0;
        expect(covered, `${date} is covered by ${entry.unitId} ${entry.start}..${entry.end}`).toBe(false);
      }
    }
  });

  it('is busiest in the 2026 and 2027 peak months', () => {
    const inRange = (entry, from, to) => entry.start >= from && entry.start <= to;
    const peak2026 = SEASON_LEDGER.filter((e) => inRange(e, '2026-09-01', '2026-10-31'));
    const peak2027 = SEASON_LEDGER.filter((e) => inRange(e, '2027-09-01', '2027-10-31'));
    const august2026 = SEASON_LEDGER.filter((e) => inRange(e, '2026-08-01', '2026-08-31'));
    const offSeason = SEASON_LEDGER.filter((e) => inRange(e, '2026-11-01', '2027-04-30'));

    expect(peak2026.length).toBeGreaterThanOrEqual(10);
    expect(peak2027.length).toBeGreaterThanOrEqual(10);
    expect(august2026.length).toBeGreaterThanOrEqual(2);
    expect(offSeason.length).toBeLessThan(peak2026.length);

    // Across most trailers, on several different Saturdays.
    expect(new Set(peak2026.map((e) => e.unitId)).size).toBeGreaterThanOrEqual(4);
    expect(new Set(peak2026.map((e) => e.start)).size).toBeGreaterThanOrEqual(4);
  });
});

describe('isAvailable: reading the seeded ledger', () => {
  it('shows every trailer out on the anchor Saturday', () => {
    for (const unitId of TRAILERS) {
      expect(isAvailable(unitId, one('2026-09-19')), unitId).toBe(false);
    }
  });

  it('shows every unit open on the required-open dates', () => {
    for (const date of REQUIRED_OPEN) {
      for (const unit of FLEET) {
        expect(isAvailable(unit.id, one(date)), `${unit.id} on ${date}`).toBe(true);
      }
    }
  });

  it('treats a missing or null end as a single-day request', () => {
    expect(isAvailable('trailer-3', { start: '2026-09-19' })).toBe(false);
    expect(isAvailable('trailer-3', { start: '2026-09-19', end: null })).toBe(false);
    expect(isAvailable('trailer-3', { start: '2026-11-14' })).toBe(true);
    expect(isAvailable('trailer-3', { start: '2026-11-14', end: null })).toBe(true);
  });

  it('leaves standard units and hand-wash stations always available', () => {
    for (const unitId of ['unit-standard', 'station-handwash']) {
      expect(isAvailable(unitId, one('2026-09-19')), unitId).toBe(true);
      expect(isAvailable(unitId, { start: '2026-09-18', end: '2026-09-21' }), unitId).toBe(true);
      expect(isAvailable(unitId, one('2026-10-17')), unitId).toBe(true);
    }
  });

  it('never consults the clock: a long-past date reads as available', () => {
    expect(isAvailable('trailer-3', one('2019-06-15'))).toBe(true);
    expect(isAvailable('trailer-8', one('1999-01-01'))).toBe(true);
  });
});

describe('isAvailable: Friday through Sunday blocking', () => {
  it('consumes Friday and Sunday around a booked Saturday', () => {
    // 2026-09-19 is a Saturday; every trailer is out that weekend.
    for (const unitId of TRAILERS) {
      expect(isAvailable(unitId, one('2026-09-18')), `${unitId} Friday`).toBe(false);
      expect(isAvailable(unitId, one('2026-09-19')), `${unitId} Saturday`).toBe(false);
      expect(isAvailable(unitId, one('2026-09-20')), `${unitId} Sunday`).toBe(false);
    }
  });

  it('blocks Friday and Sunday around the single-trailer October Saturday', () => {
    // trailer-3 on 2026-10-17 pads to 10-16 ... 10-18.
    expect(isAvailable('trailer-3', one('2026-10-16'))).toBe(false);
    expect(isAvailable('trailer-3', one('2026-10-17'))).toBe(false);
    expect(isAvailable('trailer-3', one('2026-10-18'))).toBe(false);
  });

  it('blocks the day either side of a two-day booking', () => {
    // trailer-4 on 2026-10-10..2026-10-11 pads to 10-09 ... 10-12.
    for (const date of ['2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12']) {
      expect(isAvailable('trailer-4', one(date)), date).toBe(false);
    }
  });

  it('blocks three days and only three days, so Thursday and Monday stay open', () => {
    // The promise on every trailer quote (note N1), on the receipt and in spec
    // §3.4 is Friday through Sunday. trailer-3 has one isolated ledger entry on
    // Saturday 2026-10-17 with no neighbour inside two weeks, so this is a clean
    // read of the whole window.
    expect(isAvailable('trailer-3', one('2026-10-14')), 'Wednesday').toBe(true);
    expect(isAvailable('trailer-3', one('2026-10-15')), 'Thursday').toBe(true);
    expect(isAvailable('trailer-3', one('2026-10-16')), 'Friday').toBe(false);
    expect(isAvailable('trailer-3', one('2026-10-17')), 'Saturday').toBe(false);
    expect(isAvailable('trailer-3', one('2026-10-18')), 'Sunday').toBe(false);
    expect(isAvailable('trailer-3', one('2026-10-19')), 'Monday').toBe(true);
    expect(isAvailable('trailer-3', one('2026-10-20')), 'Tuesday').toBe(true);
  });

  it('rejects a multi-day request that straddles a held weekend', () => {
    expect(isAvailable('trailer-3', { start: '2026-10-14', end: '2026-10-20' })).toBe(false);
    expect(isAvailable('trailer-3', { start: '2026-10-16', end: '2026-10-18' })).toBe(false);
    // Ending the day before the held window starts is fine.
    expect(isAvailable('trailer-3', { start: '2026-10-13', end: '2026-10-15' })).toBe(true);
  });

  it('holds a range request against the whole padded conflict window', () => {
    // trailer-4 on 2026-10-10..2026-10-11 holds 10-09 through 10-12. Overlap is
    // inclusive, so touching either padded edge is enough to block.
    expect(isAvailable('trailer-4', { start: '2026-10-07', end: '2026-10-09' })).toBe(false);
    expect(isAvailable('trailer-4', { start: '2026-10-12', end: '2026-10-14' })).toBe(false);
    expect(isAvailable('trailer-4', { start: '2026-10-06', end: '2026-10-08' })).toBe(true);
    expect(isAvailable('trailer-4', { start: '2026-10-13', end: '2026-10-15' })).toBe(true);
  });
});

describe('isAvailable: collision with the customer own bookings', () => {
  it('blocks the booked date and the day either side', () => {
    // 2026-12-05 is guaranteed clear of the ledger, so the only block is ours.
    expect(isAvailable('trailer-2', one('2026-12-05'))).toBe(true);

    const booking = saveBooking(eventBookingInput('trailer-2', '2026-12-05', '2026-12-05'));
    expect(booking.unitId).toBe('trailer-2');
    expect(booking.start).toBe('2026-12-05');
    expect(booking.end).toBe('2026-12-05');

    expect(isAvailable('trailer-2', one('2026-12-04'))).toBe(false);
    expect(isAvailable('trailer-2', one('2026-12-05'))).toBe(false);
    expect(isAvailable('trailer-2', one('2026-12-06'))).toBe(false);
  });

  it('reaches exactly one day out, the same three days a ledger entry holds', () => {
    // A saved booking is held on the calendar exactly as a ledger entry is:
    // delivery the day before, pickup the day after, and nothing beyond that.
    // Reading the outer days before and after the save factors out anything the
    // ledger already holds.
    const twoBefore = isAvailable('trailer-2', one('2026-12-03'));
    const twoAfter = isAvailable('trailer-2', one('2026-12-07'));

    saveBooking(eventBookingInput('trailer-2', '2026-12-05', '2026-12-05'));

    expect(isAvailable('trailer-2', one('2026-12-04'))).toBe(false);
    expect(isAvailable('trailer-2', one('2026-12-06'))).toBe(false);
    expect(isAvailable('trailer-2', one('2026-12-03'))).toBe(twoBefore);
    expect(isAvailable('trailer-2', one('2026-12-07'))).toBe(twoAfter);
  });

  it('blocks only the booked trailer', () => {
    saveBooking(eventBookingInput('trailer-2', '2026-12-05', '2026-12-05'));
    expect(isAvailable('trailer-2', one('2026-12-05'))).toBe(false);
    for (const unitId of TRAILERS.filter((id) => id !== 'trailer-2')) {
      expect(isAvailable(unitId, one('2026-12-05')), unitId).toBe(true);
    }
  });

  it('blocks a multi-day booking across its whole padded span', () => {
    saveBooking(eventBookingInput('trailer-8', '2027-01-16', '2027-01-17'));
    for (const date of ['2027-01-15', '2027-01-16', '2027-01-17', '2027-01-18']) {
      expect(isAvailable('trailer-8', one(date)), date).toBe(false);
    }
    expect(isAvailable('trailer-8', { start: '2027-01-16', end: '2027-01-17' })).toBe(false);
  });

  it('publishes the booking as a calendar block', () => {
    saveBooking(eventBookingInput('trailer-3', '2027-03-06', '2027-03-06'));
    expect(bookingBlocks()).toContainEqual({
      unitId: 'trailer-3',
      start: '2027-03-06',
      end: '2027-03-06',
    });
    expect(loadBookings()).toHaveLength(1);
  });

  it('does not let a jobsite booking block a calendar', () => {
    const selection = emptySelection('site');
    selection.units['unit-standard'] = 2;
    selection.start = '2026-12-05';
    saveBooking({
      mode: 'site',
      selection,
      quote: { lineItems: [], subtotal: 0, total: 0, notes: [] },
      contact: { name: 'Sam Okafor', email: 'sam@example.com', phone: '5105550188' },
    });
    expect(bookingBlocks()).toEqual([]);
    for (const unitId of TRAILERS) {
      expect(isAvailable(unitId, one('2026-12-05')), unitId).toBe(true);
    }
  });

  it('forgets the block once the bookings are cleared', () => {
    saveBooking(eventBookingInput('trailer-2', '2026-12-05', '2026-12-05'));
    expect(isAvailable('trailer-2', one('2026-12-05'))).toBe(false);
    clearBookings();
    expect(isAvailable('trailer-2', one('2026-12-05'))).toBe(true);
  });

  it('stacks the customer bookings on top of the seeded ledger', () => {
    saveBooking(eventBookingInput('trailer-2', '2026-12-05', '2026-12-05'));
    // Ours blocks December; the ledger still blocks September.
    expect(isAvailable('trailer-2', one('2026-12-05'))).toBe(false);
    expect(isAvailable('trailer-2', one('2026-09-19'))).toBe(false);
    expect(isAvailable('trailer-2', one('2027-01-16'))).toBe(true);
  });
});

describe('nextAvailable', () => {
  it('returns the given date when it is already open', () => {
    expect(nextAvailable('trailer-2', '2026-11-14')).toBe('2026-11-14');
    expect(nextAvailable('trailer-8', '2027-03-06')).toBe('2027-03-06');
  });

  it('walks past a ledger-blocked weekend to a genuinely open date', () => {
    const found = nextAvailable('trailer-3', '2026-09-18');
    expect(found).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // 09-18, 09-19 and 09-20 are all held for trailer-3.
    expect(diffDays('2026-09-20', found)).toBeGreaterThan(0);
    expect(isAvailable('trailer-3', one(found))).toBe(true);
  });

  it('walks past a localStorage booking to a genuinely open date', () => {
    saveBooking(eventBookingInput('trailer-2', '2026-12-05', '2026-12-05'));
    const found = nextAvailable('trailer-2', '2026-12-04');
    expect(diffDays('2026-12-06', found)).toBeGreaterThan(0);
    expect(isAvailable('trailer-2', one(found))).toBe(true);
    expect(found).not.toBe('2026-12-04');
    expect(found).not.toBe('2026-12-05');
    expect(found).not.toBe('2026-12-06');
  });

  it('never skips an open day on the way', () => {
    const from = '2026-09-18';
    const found = nextAvailable('trailer-4', from);
    for (let d = from; diffDays(d, found) > 0; d = shift(d, 1)) {
      expect(isAvailable('trailer-4', one(d)), `${d} was skipped`).toBe(false);
    }
    expect(isAvailable('trailer-4', one(found))).toBe(true);
  });

  it('returns the same day for a unit that is never blocked', () => {
    expect(nextAvailable('unit-standard', '2026-09-19')).toBe('2026-09-19');
    expect(nextAvailable('station-handwash', '2026-09-19')).toBe('2026-09-19');
  });

  it('always terminates with a date string', () => {
    for (const unitId of [...TRAILERS, 'unit-standard', 'station-handwash']) {
      for (const from of ['2026-09-18', '2026-10-10', '2026-11-14', '2027-09-18']) {
        const found = nextAvailable(unitId, from);
        expect(typeof found, `${unitId} from ${from}`).toBe('string');
        expect(found, `${unitId} from ${from}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(diffDays(from, found), `${unitId} from ${from}`).toBeGreaterThanOrEqual(0);
        expect(diffDays(from, found), `${unitId} from ${from}`).toBeLessThanOrEqual(730);
      }
    }
  });
});

describe('dayState', () => {
  it('reports a ledger block on a peak Saturday', () => {
    expect(dayState('trailer-4', '2026-09-19')).toEqual({
      date: '2026-09-19',
      available: false,
      peak: true,
      blockedBy: 'ledger',
    });
  });

  it('reports an open off-season day', () => {
    expect(dayState('trailer-4', '2026-11-14')).toEqual({
      date: '2026-11-14',
      available: true,
      peak: false,
      blockedBy: null,
    });
  });

  it('marks peak season independently of availability', () => {
    const openPeak = dayState('unit-standard', '2026-09-19');
    expect(openPeak.peak).toBe(true);
    expect(openPeak.available).toBe(true);
    expect(openPeak.blockedBy).toBeNull();

    const offSeason = dayState('trailer-2', '2026-12-05');
    expect(offSeason.peak).toBe(false);
    expect(offSeason.available).toBe(true);
  });

  it('reports a customer booking as a booking block', () => {
    saveBooking(eventBookingInput('trailer-2', '2026-12-05', '2026-12-05'));
    expect(dayState('trailer-2', '2026-12-05')).toEqual({
      date: '2026-12-05',
      available: false,
      peak: false,
      blockedBy: 'booking',
    });
    // The pad reads as a block too.
    expect(dayState('trailer-2', '2026-12-04').blockedBy).toBe('booking');
    expect(dayState('trailer-2', '2026-12-06').blockedBy).toBe('booking');
  });

  it('lets the ledger win when the ledger and a booking both apply', () => {
    saveBooking(eventBookingInput('trailer-3', '2026-09-19', '2026-09-19'));
    expect(dayState('trailer-3', '2026-09-19').blockedBy).toBe('ledger');
    expect(dayState('trailer-3', '2026-09-19').available).toBe(false);
  });

  it('agrees with isAvailable on every day of the peak months', () => {
    for (const unitId of TRAILERS) {
      let date = '2026-09-01';
      while (diffDays(date, '2026-10-31') >= 0) {
        const state = dayState(unitId, date);
        expect(state.date, `${unitId} ${date}`).toBe(date);
        expect(state.available, `${unitId} ${date}`).toBe(isAvailable(unitId, one(date)));
        expect(state.peak, `${unitId} ${date}`).toBe(true);
        expect(state.available ? state.blockedBy === null : state.blockedBy !== null).toBe(true);
        expect(['ledger', 'booking', null], `${unitId} ${date}`).toContain(state.blockedBy);
        expect(Object.keys(state).sort()).toEqual(['available', 'blockedBy', 'date', 'peak']);
        date = shift(date, 1);
      }
    }
  });
});
