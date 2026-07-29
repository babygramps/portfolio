// The book of business: every trailer date already committed for the 2026 and 2027
// seasons. Hand-authored and literal, never generated at runtime, so the calendar
// and the tests see the same season every time.
//
// Event days only. The Friday-delivery / Monday-pickup block is applied by
// lib/availability.js, which pads each entry by one day on each side; pre-expanding
// it here would double-block the calendar. A Saturday entry therefore consumes
// Friday through Sunday for that trailer.
//
// Only kind: 'trailer' ids appear. Standard units and hand-wash stations are
// stocked in quantity and never block a date.
//
// The shape of the season, which is the honest shape of this business:
// September and October Saturdays go first and go early, August fills in behind
// them, and the winter is wide open. Some Fridays and Sundays are taken on their
// own — a rehearsal dinner or a Sunday brunch that holds the trailer across the
// adjacent Saturday.

export const SEASON_LEDGER = [
  // August 2026 — moderately booked. The 1st and the 15th are still open.
  { unitId: 'trailer-2', start: '2026-08-08', end: '2026-08-08' },
  { unitId: 'trailer-4', start: '2026-08-08', end: '2026-08-08' },
  { unitId: 'trailer-3', start: '2026-08-22', end: '2026-08-22' },
  { unitId: 'trailer-8', start: '2026-08-22', end: '2026-08-22' },
  { unitId: 'trailer-4', start: '2026-08-29', end: '2026-08-29' },

  // September 2026 — peak. Every Saturday is spoken for and the 19th is a full
  // house: all five trailers out, which is what the calendar is meant to show.
  { unitId: 'trailer-2', start: '2026-09-05', end: '2026-09-05' },
  { unitId: 'trailer-3', start: '2026-09-05', end: '2026-09-05' },
  { unitId: 'trailer-8', start: '2026-09-05', end: '2026-09-05' },
  { unitId: 'trailer-ada', start: '2026-09-05', end: '2026-09-06' },
  { unitId: 'trailer-4', start: '2026-09-11', end: '2026-09-11' }, // Friday rehearsal dinner
  { unitId: 'trailer-2', start: '2026-09-12', end: '2026-09-12' },
  { unitId: 'trailer-3', start: '2026-09-12', end: '2026-09-12' },
  { unitId: 'trailer-8', start: '2026-09-12', end: '2026-09-12' },
  { unitId: 'trailer-ada', start: '2026-09-13', end: '2026-09-13' }, // Sunday reception
  { unitId: 'trailer-2', start: '2026-09-19', end: '2026-09-19' },
  { unitId: 'trailer-3', start: '2026-09-19', end: '2026-09-19' },
  { unitId: 'trailer-4', start: '2026-09-19', end: '2026-09-19' },
  { unitId: 'trailer-8', start: '2026-09-19', end: '2026-09-19' },
  { unitId: 'trailer-ada', start: '2026-09-19', end: '2026-09-19' },
  { unitId: 'trailer-3', start: '2026-09-26', end: '2026-09-27' }, // wedding that holds the Sunday
  { unitId: 'trailer-4', start: '2026-09-26', end: '2026-09-26' },
  { unitId: 'trailer-8', start: '2026-09-26', end: '2026-09-26' },
  { unitId: 'trailer-ada', start: '2026-09-26', end: '2026-09-26' },

  // October 2026 — still peak. Harvest weekends in Napa and Sonoma.
  { unitId: 'trailer-2', start: '2026-10-03', end: '2026-10-03' },
  { unitId: 'trailer-3', start: '2026-10-03', end: '2026-10-03' },
  { unitId: 'trailer-8', start: '2026-10-03', end: '2026-10-03' },
  { unitId: 'trailer-2', start: '2026-10-10', end: '2026-10-10' },
  { unitId: 'trailer-4', start: '2026-10-10', end: '2026-10-11' }, // two-day winery event
  { unitId: 'trailer-8', start: '2026-10-10', end: '2026-10-10' },
  { unitId: 'trailer-ada', start: '2026-10-10', end: '2026-10-10' },
  { unitId: 'trailer-ada', start: '2026-10-14', end: '2026-10-14' }, // midweek corporate
  { unitId: 'trailer-3', start: '2026-10-17', end: '2026-10-17' },
  { unitId: 'trailer-4', start: '2026-10-17', end: '2026-10-17' },
  { unitId: 'trailer-8', start: '2026-10-17', end: '2026-10-17' },
  { unitId: 'trailer-2', start: '2026-10-24', end: '2026-10-24' },
  { unitId: 'trailer-3', start: '2026-10-24', end: '2026-10-24' },
  { unitId: 'trailer-ada', start: '2026-10-24', end: '2026-10-24' },
  { unitId: 'trailer-2', start: '2026-10-31', end: '2026-11-01' }, // Halloween weekend, both days
  { unitId: 'trailer-3', start: '2026-10-31', end: '2026-10-31' },
  { unitId: 'trailer-8', start: '2026-10-31', end: '2026-10-31' },
  { unitId: 'trailer-ada', start: '2026-10-31', end: '2026-10-31' },

  // November 2026 — shoulder. Four trailers or more are free on every Saturday,
  // and the 14th is completely open.
  { unitId: 'trailer-3', start: '2026-11-07', end: '2026-11-07' },
  { unitId: 'trailer-4', start: '2026-11-07', end: '2026-11-07' },
  { unitId: 'trailer-8', start: '2026-11-21', end: '2026-11-21' },
  { unitId: 'trailer-2', start: '2026-11-28', end: '2026-11-28' },

  // December 2026 — holiday parties, and one New Year's Eve into 2027.
  { unitId: 'trailer-3', start: '2026-12-12', end: '2026-12-12' },
  { unitId: 'trailer-8', start: '2026-12-12', end: '2026-12-12' },
  { unitId: 'trailer-2', start: '2026-12-19', end: '2026-12-19' },
  { unitId: 'trailer-4', start: '2026-12-19', end: '2026-12-19' },
  { unitId: 'trailer-8', start: '2026-12-31', end: '2027-01-01' },

  // January and February 2027 — off-season. Almost everything is available.
  { unitId: 'trailer-3', start: '2027-01-23', end: '2027-01-23' },
  { unitId: 'trailer-3', start: '2027-02-13', end: '2027-02-14' }, // Valentine's weekend, both days

  // March and April 2027 — shoulder. The book starts filling from the far end.
  { unitId: 'trailer-2', start: '2027-03-13', end: '2027-03-13' },
  { unitId: 'trailer-ada', start: '2027-03-20', end: '2027-03-20' },
  { unitId: 'trailer-3', start: '2027-03-27', end: '2027-03-27' },
  { unitId: 'trailer-3', start: '2027-04-10', end: '2027-04-10' },
  { unitId: 'trailer-4', start: '2027-04-10', end: '2027-04-10' },
  { unitId: 'trailer-8', start: '2027-04-24', end: '2027-04-24' },

  // May and June 2027 — peak opens.
  { unitId: 'trailer-3', start: '2027-05-08', end: '2027-05-08' },
  { unitId: 'trailer-4', start: '2027-05-08', end: '2027-05-08' },
  { unitId: 'trailer-2', start: '2027-05-15', end: '2027-05-15' },
  { unitId: 'trailer-ada', start: '2027-05-22', end: '2027-05-22' },
  { unitId: 'trailer-4', start: '2027-05-29', end: '2027-05-30' }, // Memorial Day weekend
  { unitId: 'trailer-8', start: '2027-05-29', end: '2027-05-29' },
  { unitId: 'trailer-2', start: '2027-06-05', end: '2027-06-05' },
  { unitId: 'trailer-3', start: '2027-06-12', end: '2027-06-12' },
  { unitId: 'trailer-8', start: '2027-06-12', end: '2027-06-12' },
  { unitId: 'trailer-4', start: '2027-06-19', end: '2027-06-19' },
  { unitId: 'trailer-ada', start: '2027-06-19', end: '2027-06-19' },

  // July and August 2027.
  { unitId: 'trailer-4', start: '2027-07-02', end: '2027-07-04' }, // Fourth of July, three days
  { unitId: 'trailer-8', start: '2027-07-17', end: '2027-07-17' },
  { unitId: 'trailer-3', start: '2027-07-24', end: '2027-07-24' },
  { unitId: 'trailer-2', start: '2027-08-07', end: '2027-08-07' },
  { unitId: 'trailer-4', start: '2027-08-14', end: '2027-08-14' },
  { unitId: 'trailer-8', start: '2027-08-28', end: '2027-08-28' },

  // September 2027 — peak again, and already the busiest month on the books.
  { unitId: 'trailer-8', start: '2027-09-03', end: '2027-09-05' }, // Labor Day festival, three days
  { unitId: 'trailer-2', start: '2027-09-04', end: '2027-09-04' },
  { unitId: 'trailer-3', start: '2027-09-04', end: '2027-09-04' },
  { unitId: 'trailer-4', start: '2027-09-04', end: '2027-09-04' },
  { unitId: 'trailer-2', start: '2027-09-11', end: '2027-09-11' },
  { unitId: 'trailer-3', start: '2027-09-11', end: '2027-09-11' },
  { unitId: 'trailer-ada', start: '2027-09-11', end: '2027-09-11' },
  { unitId: 'trailer-3', start: '2027-09-18', end: '2027-09-18' },
  { unitId: 'trailer-4', start: '2027-09-18', end: '2027-09-18' },
  { unitId: 'trailer-8', start: '2027-09-18', end: '2027-09-18' },
  { unitId: 'trailer-2', start: '2027-09-25', end: '2027-09-25' },
  { unitId: 'trailer-4', start: '2027-09-25', end: '2027-09-25' },
  { unitId: 'trailer-ada', start: '2027-09-25', end: '2027-09-25' },

  // October 2027 — harvest again. Every Saturday has at least three trailers out.
  { unitId: 'trailer-2', start: '2027-10-02', end: '2027-10-02' },
  { unitId: 'trailer-3', start: '2027-10-02', end: '2027-10-02' },
  { unitId: 'trailer-8', start: '2027-10-02', end: '2027-10-02' },
  { unitId: 'trailer-2', start: '2027-10-09', end: '2027-10-09' },
  { unitId: 'trailer-4', start: '2027-10-09', end: '2027-10-09' },
  { unitId: 'trailer-ada', start: '2027-10-09', end: '2027-10-09' },
  { unitId: 'trailer-3', start: '2027-10-16', end: '2027-10-16' },
  { unitId: 'trailer-4', start: '2027-10-16', end: '2027-10-16' },
  { unitId: 'trailer-8', start: '2027-10-16', end: '2027-10-16' },
  { unitId: 'trailer-2', start: '2027-10-23', end: '2027-10-23' },
  { unitId: 'trailer-3', start: '2027-10-23', end: '2027-10-23' },
  { unitId: 'trailer-4', start: '2027-10-23', end: '2027-10-23' },
  { unitId: 'trailer-3', start: '2027-10-30', end: '2027-10-30' },
  { unitId: 'trailer-4', start: '2027-10-30', end: '2027-10-30' },
  { unitId: 'trailer-ada', start: '2027-10-30', end: '2027-10-30' },
];
