import { describe, it, expect } from 'vitest';
import {
  GUESTS_PER_STATION,
  ALCOHOL_FACTOR,
  INDUSTRY_PER_STATION,
  COMPETITOR_PER_STATION,
  RECOMMEND_POOL,
  EVENT_UNIT_IDS,
  durationFactor,
  recommend,
} from '../src/lib/capacity.js';
import { FLEET, unitById } from '../src/data/fleet.js';

// Reference implementation of the ratio table from spec 3.1 / CONTRACT B.1.
// Deliberately independent of capacity.js apart from durationFactor, which has
// its own table test below.
function expectedFor(guests, hours, alcohol) {
  let raw = guests / GUESTS_PER_STATION;
  if (alcohol) raw = raw * ALCOHOL_FACTOR;
  raw = raw * durationFactor(hours);
  const ceil = Math.ceil(raw);
  return { raw, ceil, stations: Math.max(2, ceil) };
}

describe('capacity constants', () => {
  it('publishes the ratio and the comparison figures the copy quotes', () => {
    expect(GUESTS_PER_STATION).toBe(60);
    expect(ALCOHOL_FACTOR).toBe(1.25);
    expect(INDUSTRY_PER_STATION).toBe(75);
    expect(COMPETITOR_PER_STATION).toBe(92);
  });

  it('recommends only from the four non-ADA trailers', () => {
    expect(RECOMMEND_POOL).toEqual(['trailer-2', 'trailer-3', 'trailer-4', 'trailer-8']);
    expect(RECOMMEND_POOL).not.toContain('trailer-ada');
  });

  it('offers all five trailers as overridable event units', () => {
    expect(EVENT_UNIT_IDS).toEqual([
      'trailer-2',
      'trailer-3',
      'trailer-4',
      'trailer-8',
      'trailer-ada',
    ]);
    for (const id of EVENT_UNIT_IDS) {
      const unit = unitById(id);
      expect(unit, `${id} must exist in FLEET`).not.toBeNull();
      expect(unit.kind).toBe('trailer');
    }
  });

  it('never puts the hand-wash station into capacity arithmetic', () => {
    const handwash = unitById('station-handwash');
    expect(handwash.stations).toBe(0);
    expect(handwash.capacityGuests).toBe(0);
    expect(RECOMMEND_POOL).not.toContain('station-handwash');
    expect(EVENT_UNIT_IDS).not.toContain('station-handwash');
  });

  it('keeps capacityGuests equal to stations x 60 across the fleet', () => {
    expect(FLEET).toHaveLength(7);
    for (const unit of FLEET) {
      expect(unit.capacityGuests, unit.id).toBe(unit.stations * GUESTS_PER_STATION);
    }
  });
});

describe('durationFactor', () => {
  it('is 1.0 up to and including 5 hours', () => {
    expect(durationFactor(1)).toBe(1);
    expect(durationFactor(4)).toBe(1);
    expect(durationFactor(5)).toBe(1);
  });

  it('is 1.15 above 5 hours up to and including 8', () => {
    expect(durationFactor(5.5)).toBe(1.15);
    expect(durationFactor(6)).toBe(1.15);
    expect(durationFactor(7)).toBe(1.15);
    expect(durationFactor(8)).toBe(1.15);
  });

  it('is 1.3 above 8 hours', () => {
    expect(durationFactor(8.5)).toBe(1.3);
    expect(durationFactor(9)).toBe(1.3);
    expect(durationFactor(12)).toBe(1.3);
    expect(durationFactor(24)).toBe(1.3);
  });

  it('treats the boundaries as the lower band, not the higher one', () => {
    // 5 -> 1.0 and 8 -> 1.15 are the two boundaries stated in CONTRACT B.1.
    expect(durationFactor(5)).not.toBe(1.15);
    expect(durationFactor(8)).not.toBe(1.3);
  });
});

describe('recommend: the ratio table', () => {
  // One station per 60 guests, no alcohol, short event.
  const table = [
    { guests: 60, stations: 2 }, // 1.0 -> ceil 1 -> floored to 2
    { guests: 61, stations: 2 }, // 1.0167 -> ceil 2
    { guests: 120, stations: 2 }, // exactly 2
    { guests: 121, stations: 3 }, // 2.0167 -> ceil 3
    { guests: 180, stations: 3 }, // exactly 3
    { guests: 181, stations: 4 },
    { guests: 240, stations: 4 }, // exactly 4
    { guests: 241, stations: 5 },
    { guests: 300, stations: 5 },
    { guests: 480, stations: 8 }, // exactly 8
    { guests: 481, stations: 9 },
  ];

  for (const row of table) {
    it(`${row.guests} guests over 4 hours with no bar service needs ${row.stations} stations`, () => {
      const out = recommend({ guests: row.guests, hours: 4, alcohol: false });
      expect(out.stations).toBe(row.stations);
    });
  }

  it('rounds up at the boundary, not across it', () => {
    // 60 and 120 are exact multiples: they must NOT tip into the next station.
    expect(recommend({ guests: 60, hours: 4, alcohol: false }).stations).toBe(2);
    expect(recommend({ guests: 120, hours: 4, alcohol: false }).stations).toBe(2);
    expect(recommend({ guests: 180, hours: 4, alcohol: false }).stations).toBe(3);
    expect(recommend({ guests: 240, hours: 4, alcohol: false }).stations).toBe(4);
    // One guest past each boundary adds a station.
    expect(recommend({ guests: 121, hours: 4, alcohol: false }).stations).toBe(3);
    expect(recommend({ guests: 181, hours: 4, alcohol: false }).stations).toBe(4);
    expect(recommend({ guests: 241, hours: 4, alcohol: false }).stations).toBe(5);
  });

  it('takes the ceiling of the unrounded value, not of the displayed one', () => {
    // 167 / 60 x 1.25 x 1.15 = 4.00104..., which displays as "4" to two
    // decimals. Ceiling the display would give 4 stations; ceiling the real
    // value gives 5.
    const out = recommend({ guests: 167, hours: 6, alcohol: true });
    expect(out.stations).toBe(5);
    expect(out.steps).toContain('× 1.15 for a 6-hour event = 4');
    expect(out.steps).toContain('Rounded up to 5 stations');
  });
});

describe('recommend: the alcohol factor', () => {
  it('multiplies by exactly 1.25 for bar service', () => {
    // 100 / 60 = 1.667 -> 2 stations dry; x 1.25 = 2.083 -> 3 stations wet.
    expect(recommend({ guests: 100, hours: 4, alcohol: false }).stations).toBe(2);
    expect(recommend({ guests: 100, hours: 4, alcohol: true }).stations).toBe(3);
  });

  it('lands exactly on 5 stations for 240 guests with a bar', () => {
    // 240 / 60 = 4, x 1.25 = 5.0 exactly. No float creep may push this to 6.
    const out = recommend({ guests: 240, hours: 4, alcohol: true });
    expect(out.stations).toBe(5);
    expect(out.steps).toContain('× 1.25 for bar service = 5');
  });

  it('leaves the count alone when there is no bar', () => {
    for (const guests of [60, 120, 180, 240, 480]) {
      const dry = recommend({ guests, hours: 4, alcohol: false });
      expect(dry.stations).toBe(expectedFor(guests, 4, false).stations);
      expect(dry.steps.join(' | ')).not.toContain('1.25');
    }
  });
});

describe('recommend: the duration factor', () => {
  it('applies 1.15 to a 6- or 8-hour event', () => {
    // 240 / 60 = 4, x 1.15 = 4.6 -> 5.
    expect(recommend({ guests: 240, hours: 6, alcohol: false }).stations).toBe(5);
    expect(recommend({ guests: 240, hours: 8, alcohol: false }).stations).toBe(5);
    // 300 / 60 = 5, x 1.15 = 5.75 -> 6.
    expect(recommend({ guests: 300, hours: 8, alcohol: false }).stations).toBe(6);
  });

  it('applies 1.3 above 8 hours', () => {
    // 240 / 60 = 4, x 1.3 = 5.2 -> 6.
    expect(recommend({ guests: 240, hours: 12, alcohol: false }).stations).toBe(6);
    // 300 / 60 = 5, x 1.3 = 6.5 -> 7.
    expect(recommend({ guests: 300, hours: 12, alcohol: false }).stations).toBe(7);
  });

  it('applies no duration factor at 4 or 5 hours', () => {
    const four = recommend({ guests: 240, hours: 4, alcohol: false });
    const five = recommend({ guests: 240, hours: 5, alcohol: false });
    expect(four.stations).toBe(4);
    expect(five.stations).toBe(4);
    expect(four.steps.join(' | ')).not.toContain('-hour event');
    expect(five.steps.join(' | ')).not.toContain('-hour event');
  });

  it('compounds alcohol and duration in that order', () => {
    // 180 / 60 = 3, x 1.25 = 3.75, x 1.15 = 4.3125 -> 5.
    const out = recommend({ guests: 180, hours: 6, alcohol: true });
    expect(out.stations).toBe(5);
    // 1200 / 60 = 20, x 1.25 = 25, x 1.3 = 32.5 -> 33.
    expect(recommend({ guests: 1200, hours: 12, alcohol: true }).stations).toBe(33);
  });
});

describe('recommend: the minimum-2 floor', () => {
  it('never returns fewer than 2 stations', () => {
    for (const guests of [10, 20, 30, 40, 50, 60, 100, 119, 120]) {
      const out = recommend({ guests, hours: 4, alcohol: false });
      expect(out.stations, `${guests} guests`).toBeGreaterThanOrEqual(2);
    }
  });

  it('explains the floor in the printed arithmetic when it bites', () => {
    const out = recommend({ guests: 40, hours: 4, alcohol: false });
    expect(out.stations).toBe(2);
    expect(out.steps).toContain('Minimum 2 stations on any Fieldhouse booking');
  });

  it('does not mention the floor when the arithmetic already clears it', () => {
    const out = recommend({ guests: 121, hours: 4, alcohol: false });
    expect(out.stations).toBe(3);
    expect(out.steps).not.toContain('Minimum 2 stations on any Fieldhouse booking');
  });

  it('routes a tiny guest count to the smallest trailer', () => {
    const out = recommend({ guests: 10, hours: 4, alcohol: false });
    expect(out.stations).toBe(2);
    expect(out.unitId).toBe('trailer-2');
    expect(out.extraStandardUnits).toBe(0);
  });
});

describe('recommend: unit selection', () => {
  const cases = [
    { guests: 60, expected: 'trailer-2' }, // 2 stations
    { guests: 120, expected: 'trailer-2' }, // 2 stations
    { guests: 121, expected: 'trailer-3' }, // 3 stations
    { guests: 180, expected: 'trailer-3' }, // 3 stations
    { guests: 181, expected: 'trailer-4' }, // 4 stations
    { guests: 240, expected: 'trailer-4' }, // 4 stations
    { guests: 241, expected: 'trailer-8' }, // 5 stations, no 5-station unit exists
    { guests: 480, expected: 'trailer-8' }, // 8 stations
    { guests: 900, expected: 'trailer-8' }, // 15 stations, capped at the 8
  ];

  for (const c of cases) {
    it(`${c.guests} guests picks ${c.expected}`, () => {
      const out = recommend({ guests: c.guests, hours: 4, alcohol: false });
      expect(out.unitId).toBe(c.expected);
    });
  }

  it('always picks the first pool unit large enough', () => {
    for (let guests = 10; guests <= 1000; guests += 10) {
      const out = recommend({ guests, hours: 6, alcohol: true });
      expect(RECOMMEND_POOL).toContain(out.unitId);
      const picked = unitById(out.unitId);
      if (out.stations <= 8) {
        expect(picked.stations, `${guests} guests`).toBeGreaterThanOrEqual(out.stations);
        const smaller = RECOMMEND_POOL.slice(0, RECOMMEND_POOL.indexOf(out.unitId));
        for (const id of smaller) {
          expect(unitById(id).stations, `${guests} guests`).toBeLessThan(out.stations);
        }
      } else {
        expect(out.unitId).toBe('trailer-8');
      }
    }
  });

  it('never auto-recommends the ADA trailer', () => {
    for (let guests = 10; guests <= 2000; guests += 10) {
      for (const hours of [4, 6, 8, 12]) {
        for (const alcohol of [false, true]) {
          expect(recommend({ guests, hours, alcohol }).unitId).not.toBe('trailer-ada');
        }
      }
    }
  });
});

describe('recommend: the pairing path above eight stations', () => {
  it('pairs the 8-station trailer with standard units instead of refusing', () => {
    const out = recommend({ guests: 481, hours: 4, alcohol: false });
    expect(out.stations).toBe(9);
    expect(out.unitId).toBe('trailer-8');
    expect(out.extraStandardUnits).toBe(1);
  });

  it('adds one standard unit per station above the 8-station trailer', () => {
    const six = recommend({ guests: 600, hours: 4, alcohol: false });
    expect(six.stations).toBe(10);
    expect(six.unitId).toBe('trailer-8');
    expect(six.extraStandardUnits).toBe(2);

    const huge = recommend({ guests: 1200, hours: 12, alcohol: true });
    expect(huge.stations).toBe(33);
    expect(huge.unitId).toBe('trailer-8');
    expect(huge.extraStandardUnits).toBe(25);
  });

  it('pairs nothing at or below 480 guests with no factors applied', () => {
    for (const guests of [10, 60, 120, 240, 480]) {
      const out = recommend({ guests, hours: 4, alcohol: false });
      expect(out.extraStandardUnits, `${guests} guests`).toBe(0);
    }
  });

  it('keeps extraStandardUnits equal to the shortfall against the chosen unit', () => {
    for (let guests = 10; guests <= 2000; guests += 10) {
      const out = recommend({ guests, hours: 12, alcohol: true });
      const shortfall = Math.max(0, out.stations - unitById(out.unitId).stations);
      expect(out.extraStandardUnits, `${guests} guests`).toBe(shortfall);
      expect(Number.isInteger(out.extraStandardUnits)).toBe(true);
      expect(out.extraStandardUnits).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('recommend: the printed arithmetic', () => {
  it('matches the worked example in the contract exactly', () => {
    expect(recommend({ guests: 180, hours: 6, alcohol: true })).toEqual({
      stations: 5,
      unitId: 'trailer-8',
      extraStandardUnits: 0,
      steps: [
        '180 guests ÷ 60 guests per station = 3',
        '× 1.25 for bar service = 3.75',
        '× 1.15 for a 6-hour event = 4.31',
        'Rounded up to 5 stations',
      ],
    });
  });

  it('matches the second worked example, including the un-pluralised step 4', () => {
    expect(recommend({ guests: 40, hours: 4, alcohol: false })).toEqual({
      stations: 2,
      unitId: 'trailer-2',
      extraStandardUnits: 0,
      steps: [
        '40 guests ÷ 60 guests per station = 0.67',
        'Rounded up to 1 stations',
        'Minimum 2 stations on any Fieldhouse booking',
      ],
    });
  });

  it('omits the conditional steps when their factor is 1', () => {
    const out = recommend({ guests: 300, hours: 4, alcohol: false });
    expect(out.steps).toEqual([
      '300 guests ÷ 60 guests per station = 5',
      'Rounded up to 5 stations',
    ]);
  });

  it('names the duration factor and the hours when the duration factor bites', () => {
    const out = recommend({ guests: 240, hours: 12, alcohol: false });
    expect(out.steps).toContain('× 1.3 for a 12-hour event = 5.2');
    expect(out.steps).toContain('Rounded up to 6 stations');
  });

  it('is never empty and always mentions the numbers it used', () => {
    for (const guests of [10, 40, 61, 121, 167, 180, 300, 481, 1200]) {
      for (const hours of [4, 6, 8, 12]) {
        for (const alcohol of [false, true]) {
          const out = recommend({ guests, hours, alcohol });
          const joined = out.steps.join(' | ');
          const label = `${guests}/${hours}/${alcohol}`;

          expect(out.steps.length, label).toBeGreaterThan(0);
          for (const step of out.steps) {
            expect(typeof step, label).toBe('string');
            expect(step.length, label).toBeGreaterThan(0);
            expect(step, label).not.toContain('undefined');
            expect(step, label).not.toContain('NaN');
            expect(step, label).not.toContain('TODO');
          }

          // The head count and the ratio always appear.
          expect(joined, label).toContain(String(guests));
          expect(joined, label).toContain('60 guests per station');
          // The rounded-up station count always appears.
          expect(joined, label).toContain(`Rounded up to ${expectedFor(guests, hours, alcohol).ceil} stations`);
          // Each factor appears exactly when it was applied.
          expect(joined.includes('1.25'), label).toBe(alcohol);
          expect(joined.includes(`${hours}-hour event`), label).toBe(
            durationFactor(hours) !== 1,
          );
          if (durationFactor(hours) !== 1) {
            expect(joined, label).toContain(String(durationFactor(hours)));
          }
          // The floor is explained exactly when it applied.
          expect(
            out.steps.includes('Minimum 2 stations on any Fieldhouse booking'),
            label,
          ).toBe(expectedFor(guests, hours, alcohol).ceil < 2);
        }
      }
    }
  });
});

describe('recommend: shape and integrality', () => {
  it('always returns integers and a pool unit across the whole guest range', () => {
    for (let guests = 10; guests <= 2000; guests += 10) {
      for (const hours of [4, 6, 8, 12]) {
        for (const alcohol of [false, true]) {
          const out = recommend({ guests, hours, alcohol });
          const label = `${guests}/${hours}/${alcohol}`;
          expect(Number.isInteger(out.stations), label).toBe(true);
          expect(out.stations, label).toBe(expectedFor(guests, hours, alcohol).stations);
          expect(RECOMMEND_POOL, label).toContain(out.unitId);
          expect(Array.isArray(out.steps), label).toBe(true);
          expect(Object.keys(out).sort()).toEqual([
            'extraStandardUnits',
            'stations',
            'steps',
            'unitId',
          ]);
        }
      }
    }
  });

  it('is monotonic in guests, hours and bar service', () => {
    let previous = 0;
    for (let guests = 10; guests <= 1500; guests += 10) {
      const out = recommend({ guests, hours: 6, alcohol: false }).stations;
      expect(out).toBeGreaterThanOrEqual(previous);
      previous = out;
    }
    for (const guests of [120, 300, 600]) {
      const dry = recommend({ guests, hours: 6, alcohol: false }).stations;
      const wet = recommend({ guests, hours: 6, alcohol: true }).stations;
      expect(wet).toBeGreaterThanOrEqual(dry);
      const short = recommend({ guests, hours: 4, alcohol: false }).stations;
      const long = recommend({ guests, hours: 12, alcohol: false }).stations;
      expect(long).toBeGreaterThanOrEqual(short);
    }
  });
});
