import { describe, it, expect } from 'vitest';
import { ZONES, zoneFor, mileageFee, lookup, suggest } from '../src/lib/zones.js';
import { LOCATIONS } from '../src/data/locations.js';

// The anchor entries the contract fixes verbatim, because the zone boundaries
// are asserted against them. Comments mark the four boundary pairs.
const ANCHORS = [
  { name: 'Oakland', county: 'Alameda', zips: ['94601', '94607', '94612', '94619'], miles: 3, zone: 'Z1' },
  { name: 'Berkeley', county: 'Alameda', zips: ['94702', '94703', '94709', '94710'], miles: 8, zone: 'Z1' },
  { name: 'San Francisco', county: 'San Francisco', zips: ['94102', '94110', '94114', '94123'], miles: 12, zone: 'Z1' },
  { name: 'Walnut Creek', county: 'Contra Costa', zips: ['94596', '94597', '94598'], miles: 20, zone: 'Z1' },
  { name: 'Pleasanton', county: 'Alameda', zips: ['94566', '94588'], miles: 25, zone: 'Z1' }, // Z1 ceiling
  { name: 'Fremont', county: 'Alameda', zips: ['94536', '94538', '94539', '94555'], miles: 26, zone: 'Z2' }, // Z2 floor
  { name: 'Vallejo', county: 'Solano', zips: ['94589', '94590', '94591'], miles: 30, zone: 'Z2' },
  { name: 'Livermore', county: 'Alameda', zips: ['94550', '94551'], miles: 32, zone: 'Z2' },
  { name: 'San Jose', county: 'Santa Clara', zips: ['95110', '95112', '95125', '95128'], miles: 41, zone: 'Z2' },
  { name: 'Half Moon Bay', county: 'San Mateo', zips: ['94019'], miles: 42, zone: 'Z2' },
  { name: 'Sonoma', county: 'Sonoma', zips: ['95476'], miles: 45, zone: 'Z2' },
  { name: 'Napa', county: 'Napa', zips: ['94558', '94559'], miles: 50, zone: 'Z2' }, // Z2 ceiling
  { name: 'Petaluma', county: 'Sonoma', zips: ['94952', '94954'], miles: 51, zone: 'Z3' }, // Z3 floor
  { name: 'Santa Rosa', county: 'Sonoma', zips: ['95401', '95403', '95404', '95405'], miles: 64, zone: 'Z3' },
  { name: 'Calistoga', county: 'Napa', zips: ['94515'], miles: 75, zone: 'Z3' },
  { name: 'Santa Cruz', county: 'Santa Cruz', zips: ['95060', '95062', '95065'], miles: 78, zone: 'Z3' },
  { name: 'Windsor', county: 'Sonoma', zips: ['95492'], miles: 80, zone: 'Z3' }, // Z3 ceiling
  { name: 'Healdsburg', county: 'Sonoma', zips: ['95448'], miles: 81, zone: 'Z4' }, // Z4 floor
  { name: 'Sea Ranch', county: 'Sonoma', zips: ['95497'], miles: 110, zone: 'Z4' }, // Z4 ceiling
  { name: 'Gualala', county: 'Mendocino', zips: ['95445'], miles: 111, zone: 'Z5' }, // Z5 floor
];

const REQUIRED_COUNTIES = [
  'Alameda',
  'Contra Costa',
  'Marin',
  'Napa',
  'San Francisco',
  'San Mateo',
  'Santa Clara',
  'Solano',
  'Sonoma',
  'Santa Cruz',
  'Mendocino',
];

describe('ZONES', () => {
  it('is the five drive-time bands, in order', () => {
    expect(ZONES.map((z) => z.id)).toEqual(['Z1', 'Z2', 'Z3', 'Z4', 'Z5']);
    expect(ZONES.map((z) => z.maxMiles)).toEqual([25, 50, 80, 110, null]);
  });

  it('labels and describes every band in plain language', () => {
    for (const zone of ZONES) {
      expect(typeof zone.label).toBe('string');
      expect(zone.label.length).toBeGreaterThan(0);
      expect(typeof zone.blurb).toBe('string');
      expect(zone.blurb.length).toBeGreaterThan(20);
      expect(zone.blurb.toLowerCase()).not.toContain('luxury');
      expect(zone.blurb.toLowerCase()).not.toContain('call us for a quote');
    }
  });

  it('keeps Zone 5 bookable rather than a quote wall', () => {
    const z5 = ZONES.find((z) => z.id === 'Z5');
    expect(z5.maxMiles).toBeNull();
    expect(z5.blurb.toLowerCase()).toContain('bookable');
  });

  it('agrees with zoneFor at each band ceiling', () => {
    for (let i = 0; i < ZONES.length - 1; i += 1) {
      const zone = ZONES[i];
      expect(zoneFor(zone.maxMiles), `${zone.id} ceiling`).toBe(zone.id);
      expect(zoneFor(zone.maxMiles + 1), `${zone.id} ceiling + 1`).toBe(ZONES[i + 1].id);
    }
  });
});

describe('zoneFor', () => {
  it('bands Zone 1 at 25 miles and under', () => {
    expect(zoneFor(0)).toBe('Z1');
    expect(zoneFor(1)).toBe('Z1');
    expect(zoneFor(24)).toBe('Z1');
    expect(zoneFor(25)).toBe('Z1');
  });

  it('bands Zone 2 from 26 to 50', () => {
    expect(zoneFor(26)).toBe('Z2');
    expect(zoneFor(40)).toBe('Z2');
    expect(zoneFor(50)).toBe('Z2');
  });

  it('bands Zone 3 from 51 to 80', () => {
    expect(zoneFor(51)).toBe('Z3');
    expect(zoneFor(64)).toBe('Z3');
    expect(zoneFor(80)).toBe('Z3');
  });

  it('bands Zone 4 from 81 to 110', () => {
    expect(zoneFor(81)).toBe('Z4');
    expect(zoneFor(100)).toBe('Z4');
    expect(zoneFor(110)).toBe('Z4');
  });

  it('bands Zone 5 above 110', () => {
    expect(zoneFor(111)).toBe('Z5');
    expect(zoneFor(150)).toBe('Z5');
    expect(zoneFor(400)).toBe('Z5');
  });

  it('never returns anything but the five band ids', () => {
    for (let miles = 0; miles <= 400; miles += 1) {
      expect(['Z1', 'Z2', 'Z3', 'Z4', 'Z5'], String(miles)).toContain(zoneFor(miles));
    }
  });
});

describe('mileageFee', () => {
  it('is free inside the 25-mile radius, and zero at exactly 25', () => {
    expect(mileageFee(0)).toBe(0);
    expect(mileageFee(3)).toBe(0);
    expect(mileageFee(24)).toBe(0);
    expect(mileageFee(25)).toBe(0);
  });

  it('charges $3.50 on the excess mile only', () => {
    expect(mileageFee(26)).toBe(4); // 3.5 rounds up
    expect(mileageFee(27)).toBe(7);
    expect(mileageFee(50)).toBe(88); // 87.5 rounds up
    expect(mileageFee(111)).toBe(301);
  });

  it('is one way, so the return trip is not double charged', () => {
    expect(mileageFee(50)).not.toBe(175);
    expect(mileageFee(111)).not.toBe(602);
  });

  it('returns whole dollars for every plausible distance', () => {
    for (let miles = 0; miles <= 400; miles += 1) {
      const fee = mileageFee(miles);
      expect(Number.isInteger(fee), String(miles)).toBe(true);
      expect(fee, String(miles)).toBe(Math.round(Math.max(0, miles - 25) * 3.5));
      expect(fee, String(miles)).toBeGreaterThanOrEqual(0);
    }
  });

  it('rises monotonically with distance', () => {
    let previous = 0;
    for (let miles = 0; miles <= 400; miles += 1) {
      const fee = mileageFee(miles);
      expect(fee).toBeGreaterThanOrEqual(previous);
      previous = fee;
    }
  });
});

describe('LOCATIONS data', () => {
  it('covers the nine Bay Area counties plus Santa Cruz and Mendocino', () => {
    const counties = new Set(LOCATIONS.map((l) => l.county));
    for (const county of REQUIRED_COUNTIES) {
      expect([...counties], `missing ${county}`).toContain(county);
    }
  });

  it('is roughly 150 towns', () => {
    expect(LOCATIONS.length).toBeGreaterThanOrEqual(120);
    expect(LOCATIONS.length).toBeLessThanOrEqual(220);
  });

  it('has a unique name and unique ZIPs on every record', () => {
    const names = LOCATIONS.map((l) => l.name);
    expect(new Set(names).size).toBe(names.length);

    const zips = LOCATIONS.flatMap((l) => l.zips);
    const seen = new Map();
    for (const location of LOCATIONS) {
      for (const zip of location.zips) {
        expect(seen.has(zip), `${zip} appears on both ${seen.get(zip)} and ${location.name}`).toBe(false);
        seen.set(zip, location.name);
      }
    }
    expect(new Set(zips).size).toBe(zips.length);
  });

  it('holds integer driving miles and well-formed ZIPs', () => {
    for (const location of LOCATIONS) {
      expect(Number.isInteger(location.miles), location.name).toBe(true);
      expect(location.miles, location.name).toBeGreaterThan(0);
      expect(location.miles, location.name).toBeLessThan(400);
      expect(typeof location.name).toBe('string');
      expect(typeof location.county).toBe('string');
      expect(location.county, location.name).not.toContain('County');
      expect(Array.isArray(location.zips), location.name).toBe(true);
      expect(location.zips.length, location.name).toBeGreaterThanOrEqual(1);
      expect(location.zips.length, location.name).toBeLessThanOrEqual(6);
      for (const zip of location.zips) {
        expect(zip, location.name).toMatch(/^\d{5}$/);
      }
    }
  });

  it('carries every anchor entry verbatim', () => {
    for (const anchor of ANCHORS) {
      const record = LOCATIONS.find((l) => l.name === anchor.name);
      expect(record, `${anchor.name} must be in LOCATIONS`).toBeTruthy();
      expect(record.county, anchor.name).toBe(anchor.county);
      expect(record.miles, anchor.name).toBe(anchor.miles);
      expect(record.zips, anchor.name).toEqual(anchor.zips);
    }
  });
});

describe('lookup by city name', () => {
  it('returns name, county, miles and zone', () => {
    expect(lookup('Napa')).toEqual({ name: 'Napa', county: 'Napa', miles: 50, zone: 'Z2' });
  });

  it('returns no ZIP array — the field is not part of the result shape', () => {
    const hit = lookup('Oakland');
    expect(Object.keys(hit).sort()).toEqual(['county', 'miles', 'name', 'zone']);
    expect(hit.zips).toBeUndefined();
  });

  it('ignores case', () => {
    for (const query of ['napa', 'NAPA', 'nApA', 'NaPa']) {
      expect(lookup(query), query).toEqual({ name: 'Napa', county: 'Napa', miles: 50, zone: 'Z2' });
    }
  });

  it('ignores surrounding whitespace', () => {
    for (const query of ['  Napa', 'Napa   ', '\tNapa\n', '   napa  ']) {
      expect(lookup(query), JSON.stringify(query)).toEqual({
        name: 'Napa',
        county: 'Napa',
        miles: 50,
        zone: 'Z2',
      });
    }
  });

  it('handles a multi-word town', () => {
    expect(lookup('half moon bay')).toEqual({
      name: 'Half Moon Bay',
      county: 'San Mateo',
      miles: 42,
      zone: 'Z2',
    });
    expect(lookup('  WALNUT CREEK ')).toEqual({
      name: 'Walnut Creek',
      county: 'Contra Costa',
      miles: 20,
      zone: 'Z1',
    });
  });

  it('resolves every anchor town by its own name', () => {
    for (const anchor of ANCHORS) {
      expect(lookup(anchor.name), anchor.name).toEqual({
        name: anchor.name,
        county: anchor.county,
        miles: anchor.miles,
        zone: anchor.zone,
      });
    }
  });
});

describe('lookup by ZIP', () => {
  it('matches a five-digit ZIP to its town', () => {
    expect(lookup('94558')).toEqual({ name: 'Napa', county: 'Napa', miles: 50, zone: 'Z2' });
    expect(lookup('94019')).toEqual({
      name: 'Half Moon Bay',
      county: 'San Mateo',
      miles: 42,
      zone: 'Z2',
    });
    expect(lookup('95445')).toEqual({ name: 'Gualala', county: 'Mendocino', miles: 111, zone: 'Z5' });
  });

  it('ignores whitespace around a ZIP', () => {
    expect(lookup('  94612  ')).toEqual({ name: 'Oakland', county: 'Alameda', miles: 3, zone: 'Z1' });
  });

  it('resolves every ZIP on every anchor town', () => {
    for (const anchor of ANCHORS) {
      for (const zip of anchor.zips) {
        expect(lookup(zip), zip).toEqual({
          name: anchor.name,
          county: anchor.county,
          miles: anchor.miles,
          zone: anchor.zone,
        });
      }
    }
  });

  it('resolves every ZIP in the whole data set', () => {
    for (const location of LOCATIONS) {
      for (const zip of location.zips) {
        expect(lookup(zip), zip).toEqual({
          name: location.name,
          county: location.county,
          miles: location.miles,
          zone: zoneFor(location.miles),
        });
      }
    }
  });
});

describe('lookup by prefix', () => {
  it('matches a prefix of four characters or more', () => {
    expect(lookup('heal')).toEqual({
      name: 'Healdsburg',
      county: 'Sonoma',
      miles: 81,
      zone: 'Z4',
    });
    expect(lookup('calis')).toEqual({ name: 'Calistoga', county: 'Napa', miles: 75, zone: 'Z3' });
    expect(lookup('petalu')).toEqual({ name: 'Petaluma', county: 'Sonoma', miles: 51, zone: 'Z3' });
    expect(lookup('windso')).toEqual({ name: 'Windsor', county: 'Sonoma', miles: 80, zone: 'Z3' });
    expect(lookup('gualal')).toEqual({ name: 'Gualala', county: 'Mendocino', miles: 111, zone: 'Z5' });
    expect(lookup('berkel')).toEqual({ name: 'Berkeley', county: 'Alameda', miles: 8, zone: 'Z1' });
    expect(lookup('live')).toEqual({ name: 'Livermore', county: 'Alameda', miles: 32, zone: 'Z2' });
  });

  it('ignores case and whitespace on a prefix', () => {
    expect(lookup('  HEALDS ')).toEqual({
      name: 'Healdsburg',
      county: 'Sonoma',
      miles: 81,
      zone: 'Z4',
    });
  });

  it('resolves an ambiguous prefix to the NEAREST town, not to array order', () => {
    // Two towns share each of these prefixes. Guessing the farther one over-quotes
    // delivery and can wrongly attach the Zone 5 callback condition, so the tie
    // must break on miles. 'Pacific' is Pacifica (27) and Pacific Grove (113).
    const ambiguous = [
      { query: 'pacific', name: 'Pacifica' },
      { query: 'monte', name: 'Monte Rio' },
      { query: 'pleasant', name: 'Pleasant Hill' },
      { query: 'santa', name: 'Santa Clara' },
      { query: 'bodega', name: 'Bodega' },
    ];
    for (const item of ambiguous) {
      const matches = LOCATIONS.filter((l) => l.name.toLowerCase().startsWith(item.query));
      expect(matches.length, `${item.query} must stay ambiguous for this test`).toBeGreaterThan(1);
      const nearest = Math.min(...matches.map((l) => l.miles));
      const hit = lookup(item.query);
      expect(hit.name, item.query).toBe(item.name);
      expect(hit.miles, item.query).toBe(nearest);
    }
  });

  it('never resolves a prefix to a farther town than one it also matches', () => {
    for (const location of LOCATIONS) {
      const query = location.name.toLowerCase().slice(0, 4).trim();
      // Below four characters lookup refuses to guess, and an exact town name is
      // matched by the higher-precedence rule; neither is what this asserts.
      if (query.length < 4) continue;
      if (LOCATIONS.some((l) => l.name.toLowerCase() === query)) continue;
      const matches = LOCATIONS.filter((l) => l.name.toLowerCase().startsWith(query));
      const nearest = Math.min(...matches.map((l) => l.miles));
      expect(lookup(query).miles, `${location.name} via "${query}"`).toBe(nearest);
    }
  });

  it('refuses to guess from three characters or fewer', () => {
    expect(lookup('liv')).toBeNull();
    expect(lookup('gua')).toBeNull();
    expect(lookup('cal')).toBeNull();
    expect(lookup('w')).toBeNull();
  });
});

describe('lookup misses', () => {
  it('returns null rather than throwing', () => {
    expect(lookup('Ashland')).toBeNull();
    expect(lookup('Bakersfield')).toBeNull();
    expect(lookup('zzzzzzzz')).toBeNull();
    expect(lookup('99999')).toBeNull();
    expect(lookup('00000')).toBeNull();
    expect(lookup('')).toBeNull();
    expect(lookup('   ')).toBeNull();
  });

  it('does not partially match a ZIP-shaped string', () => {
    // A five-digit string is looked up as a ZIP, full stop.
    expect(lookup('12345')).toBeNull();
  });
});

describe('zone boundaries through lookup', () => {
  const pairs = [
    { below: 'Pleasanton', belowMiles: 25, belowZone: 'Z1', above: 'Fremont', aboveMiles: 26, aboveZone: 'Z2' },
    { below: 'Napa', belowMiles: 50, belowZone: 'Z2', above: 'Petaluma', aboveMiles: 51, aboveZone: 'Z3' },
    { below: 'Windsor', belowMiles: 80, belowZone: 'Z3', above: 'Healdsburg', aboveMiles: 81, aboveZone: 'Z4' },
    { below: 'Sea Ranch', belowMiles: 110, belowZone: 'Z4', above: 'Gualala', aboveMiles: 111, aboveZone: 'Z5' },
  ];

  for (const pair of pairs) {
    it(`splits ${pair.below} (${pair.belowMiles} mi) from ${pair.above} (${pair.aboveMiles} mi)`, () => {
      const below = lookup(pair.below);
      const above = lookup(pair.above);
      expect(below.miles).toBe(pair.belowMiles);
      expect(below.zone).toBe(pair.belowZone);
      expect(above.miles).toBe(pair.aboveMiles);
      expect(above.zone).toBe(pair.aboveZone);
    });
  }

  it('keeps mileage free right up to the Zone 1 ceiling', () => {
    expect(mileageFee(lookup('Pleasanton').miles)).toBe(0);
    expect(mileageFee(lookup('Fremont').miles)).toBe(4);
  });

  it('bands every town in the data set consistently', () => {
    for (const location of LOCATIONS) {
      const hit = lookup(location.name);
      expect(hit, location.name).not.toBeNull();
      expect(hit.zone, location.name).toBe(zoneFor(location.miles));
    }
  });
});

describe('suggest', () => {
  it('stays quiet until two characters are typed', () => {
    expect(suggest('')).toEqual([]);
    expect(suggest(' ')).toEqual([]);
    expect(suggest('n')).toEqual([]);
    expect(suggest('  a  ')).toEqual([]);
  });

  it('returns at most three records for a near-miss', () => {
    const hits = suggest('san');
    expect(lookup('san')).toBeNull(); // three characters: no match, but never a dead end
    expect(hits).toHaveLength(3);
    for (const hit of hits) {
      expect(hit.name.toLowerCase().startsWith('san')).toBe(true);
    }
  });

  it('never returns more than three for any query', () => {
    for (const query of ['sa', 'san', 'so', 'wa', 'pa', 'oa', 'be', '945', '9455', 'a', 'e', 'na']) {
      expect(suggest(query).length, query).toBeLessThanOrEqual(3);
    }
  });

  it('returns whole LOCATIONS records, ZIPs included', () => {
    const hits = suggest('napa');
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits.map((h) => h.name)).toContain('Napa');
    for (const hit of hits) {
      expect(Array.isArray(hit.zips), hit.name).toBe(true);
      expect(hit.zips.length, hit.name).toBeGreaterThanOrEqual(1);
      expect(typeof hit.miles, hit.name).toBe('number');
      expect(typeof hit.county, hit.name).toBe('string');
      expect(LOCATIONS, hit.name).toContainEqual(hit);
    }
  });

  it('prefers a prefix match and then the nearest town', () => {
    const hits = suggest('san');
    const miles = hits.map((h) => h.miles);
    expect([...miles].sort((a, b) => a - b)).toEqual(miles);
  });

  it('falls back to a name that merely contains the query', () => {
    const hits = suggest('rosa');
    expect(hits.map((h) => h.name)).toContain('Santa Rosa');
  });

  it('matches on a partial ZIP', () => {
    const hits = suggest('9455');
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits.length).toBeLessThanOrEqual(3);
    for (const hit of hits) {
      const matchedZip = hit.zips.some((z) => z.startsWith('9455'));
      const matchedName = hit.name.toLowerCase().includes('9455');
      expect(matchedZip || matchedName, hit.name).toBe(true);
    }
  });

  it('ignores case and whitespace', () => {
    expect(suggest('  NAPA ').map((h) => h.name)).toEqual(suggest('napa').map((h) => h.name));
    expect(suggest('SoNoM').map((h) => h.name)).toEqual(suggest('sonom').map((h) => h.name));
  });

  it('returns an empty list for a query nothing can match', () => {
    expect(suggest('zzzzzz')).toEqual([]);
    expect(suggest('qqqq')).toEqual([]);
  });

  it('never blocks progress: a missed lookup still offers somewhere to tap', () => {
    for (const query of ['sant', 'nap', 'oak', 'sono', 'peta']) {
      const hits = suggest(query);
      expect(hits.length, query).toBeGreaterThanOrEqual(1);
      expect(hits.length, query).toBeLessThanOrEqual(3);
    }
  });
});
