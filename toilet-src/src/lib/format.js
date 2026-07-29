// Presentation of numbers and dates, and nothing else. Pure, with one exception the
// contract names explicitly: todayISO() is the only place in the whole app that reads
// the clock. Everything else here is a function of its arguments.
//
// Two rules drive every date function below.
//
// 1. A date is a 'YYYY-MM-DD' string at every boundary. Never a Date object, never a
//    timestamp. Those strings also sort chronologically as plain strings, which is why
//    availability.js can compare them with < and > and no parsing at all.
// 2. All date arithmetic goes through Date.UTC(y, m - 1, d). `new Date('2026-09-19')`
//    parses as midnight UTC, which is 2026-09-18 17:00 in California — so a naive
//    getDate() on the west coast reports the 18th and every calendar in the app is off
//    by one. Building the day from its parts in UTC and reading it back in UTC removes
//    the timezone from the arithmetic completely.
//
// Money is integer dollars, grouped by hand. toLocaleString is deliberately not used:
// it would render '1 450' or '1.450' depending on the viewer's locale, and a rate card
// that changes shape between browsers is not a published rate card.

export const MONTH_NAMES = [
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

export const MONTH_ABBR = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export const DOW_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export const DOW_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const DAY_MS = 86400000;
const ISO_DATE = /^-?\d{4,}-\d{2}-\d{2}$/;
const GRID_CELLS = 42; // 6 rows of 7. Fixed, so the calendar never changes height.

function isISODate(value) {
  return typeof value === 'string' && ISO_DATE.test(value);
}

// 1450 -> '1,450'. Written out rather than delegated to Intl so the output is byte
// identical in every locale.
function groupThousands(digits) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

// money(1450) -> '$1,450'; money(0) -> '$0'; money(-120) -> '-$120'.
// Integer dollars only: the minus sign goes outside the currency symbol, and there is
// never a decimal point, because nothing in this business is priced in cents.
export function money(dollars) {
  const value = Number(dollars);
  const rounded = Number.isFinite(value) ? Math.round(value) : 0;
  const sign = rounded < 0 ? '-' : '';
  return `${sign}$${groupThousands(String(Math.abs(rounded)))}`;
}

// plural(2, 'day', 'days') -> '2 days'; plural(1, 'day', 'days') -> '1 day'.
// Both forms are passed in because English is irregular and guessing is worse.
export function plural(n, one, many) {
  const value = Number(n);
  const count = Number.isFinite(value) ? value : 0;
  return `${count} ${count === 1 ? one : many}`;
}

// month is 1-12, matching every other month value in the app.
export function monthName(month) {
  const index = Number(month) - 1;
  return MONTH_NAMES[index] || '';
}

export function monthAbbr(month) {
  const index = Number(month) - 1;
  return MONTH_ABBR[index] || '';
}

// The only clock read in the application. Local calendar day, not UTC: "today" means
// today where the customer is standing.
export function todayISO() {
  const now = new Date();
  return toISO(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

// '2026-09-19' -> {y: 2026, m: 9, d: 19}. A value that is not an ISO date yields
// zeros rather than NaN, so a malformed string degrades to "no month" instead of
// poisoning arithmetic downstream.
export function parseISO(date) {
  if (!isISODate(date)) return { y: 0, m: 0, d: 0 };
  const negative = date.charAt(0) === '-';
  const body = negative ? date.slice(1) : date;
  const parts = body.split('-');
  const year = Number(parts[0]);
  return {
    y: negative ? -year : year,
    m: Number(parts[1]),
    d: Number(parts[2]),
  };
}

// (2026, 9, 19) -> '2026-09-19'. Years are padded to four digits so the result always
// string-sorts chronologically.
export function toISO(y, m, d) {
  const year = Number(y);
  const sign = year < 0 ? '-' : '';
  const yearText = String(Math.abs(Math.trunc(year))).padStart(4, '0');
  return `${sign}${yearText}-${pad2(Math.trunc(Number(m)))}-${pad2(Math.trunc(Number(d)))}`;
}

// Day-number in UTC, i.e. days since the epoch. The one place a Date is constructed
// for arithmetic, and it is constructed from parts so no timezone is involved.
function dayNumber(date) {
  const { y, m, d } = parseISO(date);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

function fromDayNumber(n) {
  const at = new Date(n * DAY_MS);
  return toISO(at.getUTCFullYear(), at.getUTCMonth() + 1, at.getUTCDate());
}

// addDays('2026-09-19', -1) -> '2026-09-18'. Month and year ends are handled by the
// day arithmetic itself, so there is no rollover logic to get wrong.
export function addDays(date, n) {
  if (!isISODate(date)) return date;
  const offset = Math.trunc(Number(n)) || 0;
  return fromDayNumber(dayNumber(date) + offset);
}

// b minus a, in whole days, signed. daysBetween('2026-09-19', '2026-09-21') === 2,
// which is exactly the number pricing.js bills as extra days.
export function daysBetween(a, b) {
  if (!isISODate(a) || !isISODate(b)) return 0;
  return dayNumber(b) - dayNumber(a);
}

// 0 = Sunday ... 6 = Saturday, read in UTC from a UTC-built date.
export function dowOf(date) {
  if (!isISODate(date)) return 0;
  const { y, m, d } = parseISO(date);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// shiftMonth(2026, 12, 1) -> {year: 2027, month: 1}. Months are counted as one
// number so the year rolls over on its own.
export function shiftMonth(year, month, delta) {
  const total = Number(year) * 12 + (Number(month) - 1) + (Math.trunc(Number(delta)) || 0);
  return { year: Math.floor(total / 12), month: (((total % 12) + 12) % 12) + 1 };
}

function daysInMonth(year, month) {
  // Day 0 of the following month is the last day of this one.
  return new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
}

// Exactly 42 cells, weeks starting Sunday, leading and trailing cells blank. Always 42
// — never 35 — because a grid that changes height between months makes the whole
// calendar jump under the customer's thumb when they page through the season.
export function monthGrid(year, month) {
  const y = Number(year);
  const m = Number(month);
  const lead = dowOf(toISO(y, m, 1));
  const length = daysInMonth(y, m);
  const cells = [];
  for (let i = 0; i < GRID_CELLS; i += 1) {
    const day = i - lead + 1;
    if (day >= 1 && day <= length) {
      cells.push({ date: toISO(y, m, day), inMonth: true });
    } else {
      cells.push({ date: null, inMonth: false });
    }
  }
  return cells;
}

// Strictly before today. Today itself is not past — a same-day booking is a bad idea
// but it is the customer's call, and availability.js has no opinion about the clock.
export function isPastDate(date) {
  if (!isISODate(date)) return false;
  return date < todayISO();
}

// 'Sat Sep 19'. The day number is not zero-padded: 'Sat Sep 5', not 'Sat Sep 05'.
export function formatDate(date) {
  if (!isISODate(date)) return '';
  const { m, d } = parseISO(date);
  return `${DOW_ABBR[dowOf(date)]} ${MONTH_ABBR[m - 1]} ${d}`;
}

// 'Saturday, September 19, 2026'. Used for aria-labels and for the receipt, where the
// year matters and the abbreviation reads as clipped.
export function formatDateLong(date) {
  if (!isISODate(date)) return '';
  const { y, m, d } = parseISO(date);
  return `${DOW_NAMES[dowOf(date)]}, ${MONTH_NAMES[m - 1]} ${d}, ${y}`;
}

// One day -> 'Sat Sep 19'. A range -> 'Fri Sep 18 – Sun Sep 20', en dash, spaced.
export function formatRange(start, end) {
  if (!isISODate(start)) return '';
  if (!isISODate(end) || end === start) return formatDate(start);
  return `${formatDate(start)} – ${formatDate(end)}`;
}
