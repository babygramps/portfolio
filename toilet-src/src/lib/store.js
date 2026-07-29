// The only module in the app that touches localStorage, and the only one that knows
// how a booking is serialized into a URL.
//
// Two hard requirements shape everything here.
//
// 1. **Storage may not exist.** Safari private mode throws on `localStorage.setItem`,
//    some browsers throw on merely *reading* `window.localStorage`, a page opened from
//    `file://` can have it disabled outright, and vitest's node environment has no DOM
//    at all. Every single access is therefore wrapped, and every failure degrades to a
//    module-level in-memory copy. A booking made in private browsing still gets a
//    confirmation number, still shows a receipt, and still blocks its own date for the
//    rest of the session — it simply does not survive a reload. Nothing throws, ever.
//
// 2. **The URL is the state.** The whole selection round-trips through the hash, so a
//    half-filled booking is a shareable link and a refresh never loses work. Contact
//    details are deliberately excluded: a shared quote must not carry someone's phone
//    number to whoever they forwarded it to.
import { ADD_ONS, EVENT_DURATION_OPTIONS, GUEST_MAX, GUEST_MIN, JOBSITE_ITEMS, MIN_TERM_WEEKS } from '../data/rates.js';
import { EVENT_UNIT_IDS } from './capacity.js';
import { lookup } from './zones.js';
import { parseISO, todayISO } from './format.js';

export const BOOKINGS_KEY = 'fieldhouse.bookings.v1';
export const SEQ_KEY = 'fieldhouse.seq.v1';
export const SEQ_START = 143;

const ADD_ON_IDS = ADD_ONS.map((addOn) => addOn.id);
const JOBSITE_IDS = JOBSITE_ITEMS.map((item) => item.id);
const DURATION_VALUES = EVENT_DURATION_OPTIONS.map((option) => option.value);

const DEFAULT_GUESTS = 120;
const DEFAULT_HOURS = 6;

// Sanity ceilings for values arriving from a hand-edited link. The wizards clamp again
// to their own stepper bounds; these exist only so a mangled URL cannot produce a
// nine-figure total or a loop that walks a million months.
const MAX_QTY = 99;
const MAX_TERM = 520;
const MAX_STEP = 3;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Keys are written in this order, always, so two identical selections produce two
// identical links and the "did the hash change under us?" comparison in the wizards
// stays a plain string compare.
const KEY_ORDER = [
  'step', 's', 'e', 'g', 'h', 'a', 'u', 'xs', 'xh', 'ao',
  'qs', 'qa', 'qh', 'tu', 'tc', 'sf', 'loc', 'og',
];

// ---------------------------------------------------------------------------
// Storage, defensively
// ---------------------------------------------------------------------------

// Bookings and the counter also live here, so that a browser which refuses to store
// anything still behaves like a booking system for the length of the session.
let memoryBookings = [];
let memorySeq = null;

// Looked up on every call rather than cached at module load: the object may be
// swapped out under us (vitest installs a shim), and in some browsers the mere act of
// reading it throws when cookies are blocked.
function area() {
  try {
    const store = typeof globalThis === 'undefined' ? null : globalThis.localStorage;
    if (!store || typeof store.getItem !== 'function') return null;
    return store;
  } catch (err) {
    return null;
  }
}

function readRaw(key) {
  try {
    const store = area();
    return store ? store.getItem(key) : null;
  } catch (err) {
    return null;
  }
}

function writeRaw(key, value) {
  try {
    const store = area();
    if (!store) return false;
    store.setItem(key, value);
    return true;
  } catch (err) {
    // Quota exceeded, or private mode. The in-memory copy is the fallback.
    return false;
  }
}

function removeRaw(key) {
  try {
    const store = area();
    if (store) store.removeItem(key);
  } catch (err) {
    // Nothing to do: there was nothing readable there in the first place.
  }
}

// ---------------------------------------------------------------------------
// Small coercions. Every one of these has to survive a hand-edited URL.
// ---------------------------------------------------------------------------

function isoOrNull(value) {
  return typeof value === 'string' && ISO_DATE.test(value) ? value : null;
}

function clampInt(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}

function nearestDuration(hours) {
  const wanted = Number(hours);
  if (!Number.isFinite(wanted)) return DEFAULT_HOURS;
  let best = DURATION_VALUES[0];
  for (let i = 1; i < DURATION_VALUES.length; i += 1) {
    if (Math.abs(DURATION_VALUES[i] - wanted) < Math.abs(best - wanted)) {
      best = DURATION_VALUES[i];
    }
  }
  return best;
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch (err) {
    // A lone '%' in a pasted link. Hand back what was typed rather than throwing.
    return value;
  }
}

// encodeURIComponent, except that a comma is left alone. Commas are legal in a query
// string, `ao=generator,waterBuffalo` is the form the contract documents, and
// `ao=generator%2CwaterBuffalo` in the address bar makes a shareable quote look like
// something went wrong.
function safeEncode(value) {
  return encodeURIComponent(String(value)).replace(/%2C/g, ',');
}

function parseQuery(query) {
  const params = {};
  const raw = typeof query === 'string' ? query : '';
  const body = raw.charAt(0) === '?' ? raw.slice(1) : raw;
  if (!body) return params;
  const pairs = body.split('&');
  for (let i = 0; i < pairs.length; i += 1) {
    const pair = pairs[i];
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const key = safeDecode(eq === -1 ? pair : pair.slice(0, eq));
    const value = eq === -1 ? '' : safeDecode(pair.slice(eq + 1));
    if (key) params[key] = value;
  }
  return params;
}

function buildQuery(params) {
  const source = params && typeof params === 'object' ? params : {};
  const keys = Object.keys(source);
  const ordered = KEY_ORDER.filter((key) => keys.indexOf(key) !== -1).concat(
    keys.filter((key) => KEY_ORDER.indexOf(key) === -1),
  );
  const parts = [];
  for (let i = 0; i < ordered.length; i += 1) {
    const key = ordered[i];
    const value = source[key];
    if (value === null || value === undefined || value === '') continue;
    parts.push(`${safeEncode(key)}=${safeEncode(value)}`);
  }
  return parts.join('&');
}

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

function isBooking(value) {
  return !!value && typeof value === 'object' && typeof value.confirmationNumber === 'string' && value.confirmationNumber !== '';
}

function storedBookings() {
  const raw = readRaw(BOOKINGS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isBooking) : [];
  } catch (err) {
    // Corrupt JSON — someone edited the key by hand, or a write was truncated.
    // An empty list is a better answer than a blank page.
    return [];
  }
}

// Storage first, then anything saved this session that storage would not accept.
// Deduplicated on the confirmation number so a working localStorage does not report
// every booking twice.
export function loadBookings() {
  const stored = storedBookings();
  const seen = {};
  const all = [];
  for (let i = 0; i < stored.length; i += 1) {
    seen[stored[i].confirmationNumber] = true;
    all.push(stored[i]);
  }
  for (let i = 0; i < memoryBookings.length; i += 1) {
    const booking = memoryBookings[i];
    if (!seen[booking.confirmationNumber]) {
      seen[booking.confirmationNumber] = true;
      all.push(booking);
    }
  }
  return all;
}

export function findBooking(number) {
  const wanted = String(number || '').trim().toUpperCase();
  if (!wanted) return null;
  const all = loadBookings();
  for (let i = 0; i < all.length; i += 1) {
    if (String(all[i].confirmationNumber).toUpperCase() === wanted) return all[i];
  }
  return null;
}

function readSeq() {
  const raw = readRaw(SEQ_KEY);
  const stored = Number(raw);
  if (raw !== null && Number.isFinite(stored) && stored >= SEQ_START) {
    return Math.round(stored);
  }
  if (memorySeq !== null) return memorySeq;
  return SEQ_START;
}

// Sequential from 143 so the first booking of a fresh browser reads FH-2026-0143 —
// a number that looks like a business with a season behind it rather than a demo
// starting at one. No side effect: the counter only moves when a booking is saved.
export function nextConfirmationNumber() {
  const year = parseISO(todayISO()).y;
  return `FH-${year}-${String(readSeq()).padStart(4, '0')}`;
}

function bumpSeq(from) {
  const next = from + 1;
  memorySeq = next;
  writeRaw(SEQ_KEY, String(next));
}

// saveBooking({mode, selection, quote, contact}) -> the complete Booking.
// Never throws, and always returns a usable record even when nothing can be persisted.
export function saveBooking(input) {
  const source = input && typeof input === 'object' ? input : {};
  const mode = source.mode === 'site' ? 'site' : 'event';
  const selection = source.selection && typeof source.selection === 'object' ? source.selection : emptySelection(mode);
  const contact = Object.assign({ name: '', email: '', phone: '' }, source.contact || selection.contact);
  const quote = source.quote && typeof source.quote === 'object'
    ? source.quote
    : { lineItems: [], subtotal: 0, total: 0, notes: [] };

  const start = isoOrNull(selection.start);
  const end = isoOrNull(selection.end) || start;
  const location = selection.location || {};

  const booking = {
    confirmationNumber: nextConfirmationNumber(),
    createdAt: new Date().toISOString(),
    mode,
    // Only an event holds a specific trailer. Jobsite units are stocked in quantity,
    // so a jobsite booking has no unit to block a calendar with.
    unitId: mode === 'event' ? selection.unitId || null : null,
    start,
    end,
    selection: Object.assign({}, selection, { contact: Object.assign({}, contact) }),
    quote,
    contact,
    // Zone 5 is bookable at a real price, with the callback condition attached.
    holdPending: location.zone === 'Z5',
  };

  const current = readSeq();
  const all = storedBookings().concat([booking]);
  writeRaw(BOOKINGS_KEY, JSON.stringify(all));
  // Kept in memory as well as in storage, so findBooking resolves the number on the
  // very next screen even if the write above was silently refused.
  memoryBookings = memoryBookings.concat([booking]);
  bumpSeq(current);

  return booking;
}

// The customer's own bookings, as calendar blocks. availability.js pads each one by a
// day on either side, exactly as it pads the seeded ledger.
export function bookingBlocks() {
  const blocks = [];
  const all = loadBookings();
  for (let i = 0; i < all.length; i += 1) {
    const booking = all[i];
    if (booking.mode !== 'event') continue;
    const unitId = booking.unitId;
    const start = isoOrNull(booking.start);
    if (!unitId || !start) continue;
    blocks.push({ unitId, start, end: isoOrNull(booking.end) || start });
  }
  return blocks;
}

// Clears the counter too: a store with no bookings in it is a fresh browser, and the
// next number it hands out should be FH-<year>-0143 again.
export function clearBookings() {
  memoryBookings = [];
  memorySeq = null;
  removeRaw(BOOKINGS_KEY);
  removeRaw(SEQ_KEY);
}

// ---------------------------------------------------------------------------
// The canonical selection, and its round trip through the URL
// ---------------------------------------------------------------------------

function emptyUnits() {
  const units = {};
  for (let i = 0; i < JOBSITE_IDS.length; i += 1) units[JOBSITE_IDS[i]] = 0;
  return units;
}

function emptyAddOns() {
  const addOns = {};
  for (let i = 0; i < ADD_ON_IDS.length; i += 1) addOns[ADD_ON_IDS[i]] = false;
  return addOns;
}

// Both modes carry every key, so quote() never reads an undefined field. A jobsite
// selection reuses `start` for the delivery date rather than inventing a second one.
export function emptySelection(mode) {
  return {
    mode: mode === 'site' ? 'site' : 'event',
    step: 0,

    start: null,
    end: null,
    guests: DEFAULT_GUESTS,
    hours: DEFAULT_HOURS,
    alcohol: false,
    unitId: null,
    extraStandardUnits: 0,
    extraHandwash: 0,
    addOns: emptyAddOns(),

    units: emptyUnits(),
    term: { unit: 'months', count: 1 },
    serviceFrequency: 'weekly',

    location: { query: '', name: null, county: null, miles: null, zone: null },
    offGrid: false,
    contact: { name: '', email: '', phone: '' },
  };
}

// A query string, no leading '?'. Anything sitting at its default is left out, so a
// fresh wizard has a clean URL and a shared link contains only real decisions.
// `contact` is never written: a shared quote must not carry anyone's phone number.
export function encodeSelection(selection) {
  const sel = selection && typeof selection === 'object' ? selection : {};
  const params = {};

  const step = clampInt(sel.step, 0, MAX_STEP, 0);
  if (step !== 0) params.step = step;

  const start = isoOrNull(sel.start);
  if (start) params.s = start;
  const end = isoOrNull(sel.end);
  if (start && end && end !== start) params.e = end;

  const guests = clampInt(sel.guests, GUEST_MIN, GUEST_MAX, DEFAULT_GUESTS);
  if (guests !== DEFAULT_GUESTS) params.g = guests;

  const hours = nearestDuration(sel.hours);
  if (hours !== DEFAULT_HOURS) params.h = hours;

  if (sel.alcohol) params.a = 1;

  if (typeof sel.unitId === 'string' && EVENT_UNIT_IDS.indexOf(sel.unitId) !== -1) {
    params.u = sel.unitId;
  }

  const extraStandard = clampInt(sel.extraStandardUnits, 0, MAX_QTY, 0);
  if (extraStandard !== 0) params.xs = extraStandard;
  const extraHandwash = clampInt(sel.extraHandwash, 0, MAX_QTY, 0);
  if (extraHandwash !== 0) params.xh = extraHandwash;

  const addOns = sel.addOns || {};
  const chosen = ADD_ON_IDS.filter((id) => !!addOns[id]);
  if (chosen.length > 0) params.ao = chosen.join(',');

  const units = sel.units || {};
  const qs = clampInt(units[JOBSITE_IDS[0]], 0, MAX_QTY, 0);
  const qa = clampInt(units[JOBSITE_IDS[1]], 0, MAX_QTY, 0);
  const qh = clampInt(units[JOBSITE_IDS[2]], 0, MAX_QTY, 0);
  if (qs !== 0) params.qs = qs;
  if (qa !== 0) params.qa = qa;
  if (qh !== 0) params.qh = qh;

  const term = sel.term || {};
  const termUnit = term.unit === 'weeks' ? 'weeks' : 'months';
  const minCount = termUnit === 'weeks' ? MIN_TERM_WEEKS : 1;
  const count = clampInt(term.count, minCount, MAX_TERM, minCount);
  if (termUnit === 'weeks') params.tu = 'w';
  if (!(termUnit === 'months' && count === 1)) params.tc = count;

  if (sel.serviceFrequency === 'twice-weekly') params.sf = 2;

  const query = sel.location && typeof sel.location.query === 'string' ? sel.location.query.trim() : '';
  if (query) params.loc = query;

  if (sel.offGrid) params.og = 1;

  return buildQuery(params);
}

// The inverse, and the more important half: this one has to survive whatever is in the
// address bar. Unknown keys are ignored, every value is coerced and clamped, and a
// hand-mangled link produces a slightly wrong booking rather than an exception.
export function decodeSelection(query, mode) {
  const sel = emptySelection(mode);
  const params = parseQuery(query);
  const has = (key) => Object.prototype.hasOwnProperty.call(params, key);
  const lastStep = sel.mode === 'site' ? 2 : MAX_STEP;

  if (has('step')) sel.step = clampInt(params.step, 0, lastStep, 0);

  if (has('s')) sel.start = isoOrNull(params.s);
  if (sel.start) {
    const end = has('e') ? isoOrNull(params.e) : null;
    // A single-day event omits `e` entirely, and an end before the start is nonsense.
    sel.end = end && end > sel.start ? end : sel.start;
  } else {
    sel.start = null;
    sel.end = null;
  }

  if (has('g')) sel.guests = clampInt(params.g, GUEST_MIN, GUEST_MAX, DEFAULT_GUESTS);
  if (has('h')) sel.hours = nearestDuration(params.h);
  if (has('a')) sel.alcohol = params.a === '1';

  if (has('u') && EVENT_UNIT_IDS.indexOf(params.u) !== -1) sel.unitId = params.u;

  if (has('xs')) sel.extraStandardUnits = clampInt(params.xs, 0, MAX_QTY, 0);
  if (has('xh')) sel.extraHandwash = clampInt(params.xh, 0, MAX_QTY, 0);

  if (has('ao')) {
    const wanted = String(params.ao).split(',');
    for (let i = 0; i < ADD_ON_IDS.length; i += 1) {
      sel.addOns[ADD_ON_IDS[i]] = wanted.indexOf(ADD_ON_IDS[i]) !== -1;
    }
  }

  if (has('qs')) sel.units[JOBSITE_IDS[0]] = clampInt(params.qs, 0, MAX_QTY, 0);
  if (has('qa')) sel.units[JOBSITE_IDS[1]] = clampInt(params.qa, 0, MAX_QTY, 0);
  if (has('qh')) sel.units[JOBSITE_IDS[2]] = clampInt(params.qh, 0, MAX_QTY, 0);

  const termUnit = has('tu') && params.tu === 'w' ? 'weeks' : 'months';
  const minCount = termUnit === 'weeks' ? MIN_TERM_WEEKS : 1;
  sel.term = {
    unit: termUnit,
    count: has('tc') ? clampInt(params.tc, minCount, MAX_TERM, minCount) : minCount,
  };

  if (has('sf')) sel.serviceFrequency = params.sf === '2' ? 'twice-weekly' : 'weekly';

  if (has('loc')) {
    const typed = String(params.loc);
    sel.location = { query: typed, name: null, county: null, miles: null, zone: null };
    // Re-run the lookup rather than trusting mileage that arrived in a URL. Somebody
    // could otherwise hand-edit `miles` and change what the delivery line says.
    const hit = lookup(typed);
    if (hit) {
      sel.location.name = hit.name;
      sel.location.county = hit.county;
      sel.location.miles = hit.miles;
      sel.location.zone = hit.zone;
    }
  }

  if (has('og')) sel.offGrid = params.og === '1';

  return sel;
}

// ---------------------------------------------------------------------------
// The hash itself
// ---------------------------------------------------------------------------

// parseHash('#/fleet/trailer-4?view=plan') ->
//   {path: '/fleet/trailer-4', segments: ['fleet','trailer-4'], params: {view: 'plan'}}
// Every param value is a decoded string, never a number: the caller decides what a
// value means, and '007' must not silently become 7.
export function parseHash(hash) {
  const raw = typeof hash === 'string' ? hash : '';
  const body = raw.charAt(0) === '#' ? raw.slice(1) : raw;
  if (!body) return { path: '/', segments: [], params: {} };

  const mark = body.indexOf('?');
  const pathPart = mark === -1 ? body : body.slice(0, mark);
  const queryPart = mark === -1 ? '' : body.slice(mark + 1);

  const segments = pathPart
    .split('/')
    .filter((segment) => segment.length > 0)
    .map(safeDecode);

  return {
    path: segments.length === 0 ? '/' : `/${segments.join('/')}`,
    segments,
    params: parseQuery(queryPart),
  };
}

// buildHash('/book/event', {step: 1}) -> '#/book/event?step=1'.
// Empty values are dropped so a default-valued wizard produces a clean link.
export function buildHash(path, params) {
  const raw = typeof path === 'string' && path ? path : '/';
  const body = raw.charAt(0) === '#' ? raw.slice(1) : raw;
  const clean = body.charAt(0) === '/' ? body : `/${body}`;
  const query = buildQuery(params);
  return `#${clean}${query ? `?${query}` : ''}`;
}
