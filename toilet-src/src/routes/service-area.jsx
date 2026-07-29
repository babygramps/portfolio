import React from 'react';
import { LOCATIONS } from '../data/locations.js';
import { ZONES, zoneFor, mileageFee, lookup } from '../lib/zones.js';
import { FREE_MILES } from '../data/rates.js';
import { money } from '../lib/format.js';
import { buildHash } from '../lib/store.js';

// Local link helper: a real href so the link is copyable and cmd-clickable, plus a
// click handler so navigate() can reset scroll on the way to the new route.
function linkProps(navigate, path, params = {}) {
  return {
    href: buildHash(path, params),
    onClick(event) {
      if (event.defaultPrevented) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      navigate(path, params);
    },
  };
}

// ---------------------------------------------------------------------------
// The map. Hand-simplified county outlines, projected once at
// x = (123.70 + lon) * 300 + 8, y = (38.92 - lat) * 380 + 10 into a fixed
// 760 x 800 viewBox. No tile server, no map library, no network: the whole map
// is the path data below. Shapes that run off the edge (the Pacific, Monterey)
// are clipped by the viewBox on purpose, because our area ends there.
// ---------------------------------------------------------------------------

const YARD = { x: 436.7, y: 434.1 };

// Straight-line pixels per DRIVING mile, using a 1.22 road-to-crow factor. The
// rings are therefore an approximation and the page says so; the quote always
// uses the published driving mileage for the town.
const RINGS = [
  { miles: 25, r: 112.8, zone: 'Z1', label: '25 MI · Z1', x: 493, y: 532 },
  { miles: 50, r: 225.5, zone: 'Z2', label: '50 MI · Z2', x: 335, y: 635 },
  { miles: 80, r: 360.9, zone: 'Z3', label: '80 MI · Z3', x: 274, y: 755 },
  { miles: 110, r: 496.2, zone: 'Z4', label: '110 MI · Z4', x: 40, y: 136 },
];

const WATER = {
  pacific:
    'M551 891.6 L575 792.8 L524 756.7 L452 747.2 L417.5 697.8 L398 606.6 L386 564.8 ' +
    'L371 511.6 L364.1 470.6 L363.5 431.8 L362 412.8 L329 397.6 L311 363.4 L278 352 ' +
    'L212 361.5 L215 333 L230 287.4 L236 268.4 L230 241.8 L203 226.6 L179 188.6 ' +
    'L92 131.6 L59 70.8 L2 10 L-142 10 L-142 891.6 Z',
  bay:
    'M362 412.8 L374 424.2 L383 420.4 L386 409 L383 397.6 L377 378.6 L371 355.8 ' +
    'L374 333 L377 310.2 L392 306.4 L410 314 L428 329.2 L437 336.8 L458 340.6 ' +
    'L488 336.8 L524 329.2 L560 329.2 L557 348.2 L524 352 L488 355.8 L452 352 ' +
    'L434 355.8 L410 367.2 L419 386.2 L419 401.4 L425 424.2 L431 439.4 L458 469.8 ' +
    'L473 496.4 L500 523 L518 549.6 L512 564.8 L488 572.4 L479 561 L458 545.8 ' +
    'L431 519.2 L404 488.8 L405.5 469.8 L402.5 454.6 L401 439.4 L392 432.6 ' +
    'L377 431.8 L363.5 431.8 Z',
};

const OUTSIDE = [
  { id: 'lake', label: 'LAKE', x: 332, y: 36.6, d: 'M248 32.8 L254 10 L428 10 L398 93.6 L269 86 Z' },
  {
    id: 'san-joaquin',
    label: 'SAN JOAQUIN',
    x: 692,
    y: 374.8,
    d: 'M611 325.4 L638 245.6 L752 245.6 L752 557.2 L677 557.2 L653 466 L644 397.6 L554 352 Z',
  },
];

const SERVED = [
  {
    id: 'mendocino',
    label: 'MENDOCINO',
    x: 83,
    y: 25.2,
    d: 'M2 10 L242 10 L248 32.8 L179 40.4 L59 70.8 Z',
  },
  {
    id: 'sonoma',
    label: 'SONOMA',
    x: 233,
    y: 181,
    d:
      'M59 70.8 L179 40.4 L248 32.8 L269 86 L302 101.2 L314 131.6 L350 169.6 L392 238 ' +
      'L398 298.8 L383 310.2 L368 302.6 L323 283.6 L260 253.2 L230 241.8 L203 226.6 ' +
      'L179 188.6 L92 131.6 Z',
  },
  {
    id: 'napa',
    label: 'NAPA',
    x: 434,
    y: 188.6,
    d:
      'M302 101.2 L398 93.6 L488 124 L500 207.6 L461 298.8 L413 336.8 L398 298.8 ' +
      'L392 238 L350 169.6 L314 131.6 Z',
  },
  {
    id: 'solano',
    label: 'SOLANO',
    x: 527,
    y: 238,
    d:
      'M461 298.8 L488 158.2 L593 150.6 L638 245.6 L611 325.4 L578 336.8 L533 348.2 ' +
      'L473 348.2 L440 336.8 L425 314 Z',
  },
  {
    id: 'marin',
    label: 'MARIN',
    x: 302,
    y: 329.2,
    d:
      'M230 241.8 L260 253.2 L323 283.6 L368 302.6 L377 310.2 L374 333 L371 355.8 ' +
      'L377 378.6 L383 397.6 L386 409 L383 420.4 L374 424.2 L362 412.8 L329 397.6 ' +
      'L311 363.4 L278 352 L212 361.5 L215 333 L230 287.4 L236 268.4 Z',
  },
  {
    id: 'contra-costa',
    label: 'CONTRA COSTA',
    x: 533,
    y: 363.4,
    d:
      'M395 359.6 L434 355.8 L473 352 L518 352 L554 352 L644 397.6 L653 466 L557 466 ' +
      'L503 439.4 L458 412.8 L425 401.4 L419 386.2 L404 371 Z',
  },
  {
    id: 'alameda',
    label: 'ALAMEDA',
    x: 563,
    y: 523,
    d:
      'M425 401.4 L458 412.8 L503 439.4 L557 466 L653 466 L677 557.2 L542 557.2 ' +
      'L506 538.2 L488 511.6 L473 496.4 L458 469.8 L431 439.4 L425 424.2 Z',
  },
  {
    id: 'san-francisco',
    label: null,
    x: 0,
    y: 0,
    d: 'M363.5 431.8 L405.5 431.8 L402.5 439.4 L402.5 458.4 L405.5 470.6 L364.1 470.6 Z',
  },
  {
    id: 'san-mateo',
    label: 'SAN MATEO',
    x: 419,
    y: 602.8,
    d:
      'M364.1 470.6 L371 511.6 L386 564.8 L398 606.6 L417.5 697.8 L473 667.4 L470 572.4 ' +
      'L479 561 L458 545.8 L431 519.2 L404 488.8 L405.5 470.6 Z',
  },
  {
    id: 'santa-clara',
    label: 'SANTA CLARA',
    x: 584,
    y: 640.8,
    d:
      'M542 557.2 L677 557.2 L746 682.6 L692 747.2 L632 732 L557 701.6 L473 667.4 ' +
      'L470 572.4 L509 564.8 Z',
  },
  {
    id: 'santa-cruz',
    label: 'SANTA CRUZ',
    x: 524,
    y: 720.6,
    d: 'M473 667.4 L417.5 697.8 L452 747.2 L524 756.7 L575 792.8 L632 777.6 L557 701.6 Z',
  },
  {
    id: 'monterey',
    label: 'MONTEREY',
    x: 683,
    y: 792.8,
    d: 'M575 792.8 L632 777.6 L758 777.6 L758 929.6 L551 929.6 Z',
  },
];

// Towns plotted on the map. `miles` and `zone` come from the location table via
// lookup(), so the map and the mileage we bill can never disagree.
const MAP_TOWNS = [
  { name: 'Gualala', x: 58.7, y: 68.5 },
  { name: 'Sea Ranch', x: 83, y: 89.8 },
  { name: 'Healdsburg', x: 257.3, y: 127.8 },
  { name: 'Calistoga', x: 344, y: 139.6 },
  { name: 'Santa Rosa', x: 303.8, y: 192.4 },
  { name: 'Napa', x: 431.9, y: 246.7 },
  { name: 'Sonoma', x: 380.6, y: 248.6 },
  { name: 'Petaluma', x: 326.9, y: 271.4 },
  { name: 'Vallejo', x: 441.2, y: 320.1 },
  { name: 'Walnut Creek', x: 498.5, y: 395.3 },
  { name: 'San Francisco', x: 392.3, y: 445.1, anchorEnd: true },
  { name: 'Livermore', x: 587.6, y: 480.4 },
  { name: 'Pleasanton', x: 555.5, y: 488, anchorEnd: true },
  { name: 'Half Moon Bay', x: 389.3, y: 563.7 },
  { name: 'San Jose', x: 549.5, y: 610.8 },
  { name: 'Santa Cruz', x: 509, y: 749.5 },
  { name: 'Watsonville', x: 590.9, y: 773.8 },
];

function ZoneMap() {
  return (
    <svg
      className="fh-map__svg"
      viewBox="0 0 760 800"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Simplified map of the counties Fieldhouse delivers to, from the Mendocino coast down to Monterey, with drive-time rings at 25, 50, 80 and 110 miles from the Oakland yard. The same distances are listed town by town in the tables below."
      focusable="false"
    >
      <path className="fh-map-water" d={WATER.pacific} />
      <path className="fh-map-water" d={WATER.bay} />

      {OUTSIDE.map((county) => (
        <path className="fh-map-county" d={county.d} key={county.id} />
      ))}
      {SERVED.map((county) => (
        <path className="fh-map-county fh-map-county--served" d={county.d} key={county.id} />
      ))}

      {RINGS.map((ring) => (
        <circle className="fh-map-ring" cx={YARD.x} cy={YARD.y} r={ring.r} key={ring.zone} />
      ))}
      {RINGS.map((ring) => (
        <text className="fh-map-ring-label" x={ring.x} y={ring.y} key={`${ring.zone}-label`}>
          {ring.label}
        </text>
      ))}

      {OUTSIDE.map((county) => (
        <text className="fh-map-city" x={county.x} y={county.y} key={`${county.id}-label`}>
          {county.label}
        </text>
      ))}
      {SERVED.filter((county) => county.label).map((county) => (
        <text className="fh-map-city" x={county.x} y={county.y} key={`${county.id}-label`}>
          {county.label}
        </text>
      ))}

      {MAP_TOWNS.map((town) => (
        <circle className="fh-map-dot" cx={town.x} cy={town.y} r="2.4" key={`${town.name}-dot`} />
      ))}
      {MAP_TOWNS.map((town) => (
        <text
          className="fh-map-city"
          x={town.anchorEnd ? town.x - 6.5 : town.x + 6.5}
          y={town.y + 3}
          textAnchor={town.anchorEnd ? 'end' : 'start'}
          key={`${town.name}-label`}
        >
          {town.name}
        </text>
      ))}

      <circle className="fh-map-yard" cx={YARD.x} cy={YARD.y} r="5.5" />
      <text className="fh-map-ring-label" x={YARD.x + 9} y={YARD.y + 4}>
        OAKLAND YARD
      </text>
    </svg>
  );
}

function zoneBands() {
  return ZONES.map((zone, index) => {
    const low = index === 0 ? 0 : ZONES[index - 1].maxMiles + 1;
    const high = zone.maxMiles;
    const range = high === null ? `${low} mi and beyond` : `${low}–${high} mi`;
    let fee;
    if (high === null) {
      fee = `${money(mileageFee(low))} and up`;
    } else if (mileageFee(high) === 0) {
      fee = money(0);
    } else {
      fee = `${money(mileageFee(low))} – ${money(mileageFee(high))}`;
    }
    return { id: zone.id, label: zone.label, blurb: zone.blurb, range, fee };
  });
}

function countySummary() {
  const grouped = new Map();
  LOCATIONS.forEach((location) => {
    const entry = grouped.get(location.county) || {
      county: location.county,
      towns: 0,
      min: Infinity,
      max: 0,
      zones: new Set(),
    };
    entry.towns += 1;
    entry.min = Math.min(entry.min, location.miles);
    entry.max = Math.max(entry.max, location.miles);
    entry.zones.add(zoneFor(location.miles));
    grouped.set(location.county, entry);
  });
  return Array.from(grouped.values())
    .map((entry) => ({
      county: entry.county,
      towns: entry.towns,
      min: entry.min,
      max: entry.max,
      zones: Array.from(entry.zones).sort().join(', '),
    }))
    .sort((a, b) => a.min - b.min);
}

export function ServiceArea({ navigate }) {
  const bands = zoneBands();
  const counties = countySummary();
  const townRows = MAP_TOWNS.map((town) => lookup(town.name))
    .filter(Boolean)
    .sort((a, b) => a.miles - b.miles);

  return (
    <div className="fh-page">
      <div className="fh-container">
        <header className="fh-page__head">
          <span className="fh-eyebrow fh-eyebrow--accent">Service area</span>
          <h1 className="fh-display">One yard in Oakland, and honest rings around it</h1>
          <p className="fh-lede">
            We deliver to all nine Bay Area counties — Napa, Sonoma and Solano included —
            south through Santa Cruz to the Monterey Peninsula, and north up the coast as far
            as Point Arena. How far out a town is decides what delivery costs and how firm a
            Friday window we can promise, so both are printed here rather than discovered
            later.
          </p>
        </header>

        <section className="fh-section fh-section--first">
          <div className="fh-map__frame">
            <ZoneMap />
            <div className="fh-map__legend">
              <span className="fh-tag fh-tag--accent">Counties we deliver to</span>
              <span className="fh-tag fh-tag--muted">Outside our area</span>
              <span className="fh-tag">Dashed rings: drive-time bands from the yard</span>
              <span className="fh-tag">Solid marker: the Oakland yard</span>
              <span>Beyond the 110-mile ring is Zone 5.</span>
            </div>
          </div>
          <p className="fh-fine">
            The rings are circles. Roads are not, and the drive to Gualala proves it. Every
            quote uses the published driving mileage for your town, listed in the tables below,
            which is why one or two towns sit a hair on the wrong side of a ring. Mendocino and
            Monterey run off the top and bottom of the frame — we quote both coasts, up to
            Point Arena and down to Big Sur.
          </p>
        </section>

        <section className="fh-section">
          <div className="fh-section__head">
            <span className="fh-eyebrow fh-eyebrow--accent">Zones</span>
            <h2 className="fh-h2">Five bands, one rule</h2>
            <p className="fh-lede">
              Delivery is free inside {FREE_MILES} miles and $3.50 a mile beyond it, one way.
              The zone is not a price band of its own — it is shorthand for how far the truck
              goes and what that means for your delivery window.
            </p>
          </div>
          <div className="fh-table-wrap">
            <table className="fh-table">
              <caption>Zones, mileage and delivery</caption>
              <thead>
                <tr>
                  <th scope="col">Zone</th>
                  <th scope="col" className="fh-table__num">
                    Drive miles
                  </th>
                  <th scope="col" className="fh-table__num">
                    Delivery
                  </th>
                  <th scope="col">What is in it</th>
                </tr>
              </thead>
              <tbody>
                {bands.map((band) => (
                  <tr key={band.id}>
                    <td>
                      <span className={band.id === 'Z5' ? 'fh-zonechip fh-zonechip--far' : 'fh-zonechip'}>
                        {band.id}
                      </span>
                    </td>
                    <td className="fh-table__num">{band.range}</td>
                    <td className="fh-table__num">{band.fee}</td>
                    <td>{band.blurb}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="fh-section">
          <div className="fh-section__head">
            <span className="fh-eyebrow fh-eyebrow--accent">The honest part</span>
            <h2 className="fh-h2">What one truck can promise, and where it stops</h2>
          </div>
          <div className="fh-grid-2">
            <div className="fh-prose">
              <p>
                Fieldhouse is one operator with one truck. That is the whole reason the
                calendar is worth trusting: nothing is double-booked in the background and
                nobody is quietly subcontracting your Saturday. It is also the reason some
                dates are unavailable that a national dispatcher would happily sell you.
              </p>
              <p>
                <strong>Inside 50 miles</strong> — Zones 1 and 2 — a Friday morning window is
                straightforward, and a late change on Thursday is usually absorbed.
              </p>
              <p>
                <strong>51 to 80 miles</strong> — Zone 3, which covers Santa Rosa, Santa Cruz
                and the Petaluma and Sonoma valleys — gets a firm Friday window with a
                week&rsquo;s notice, but it is most of a day, so it is one delivery, not two.
              </p>
              <p>
                <strong>81 to 110 miles</strong> — Zone 4, Healdsburg through the Russian
                River to the Sonoma coast — means leaving the yard before dawn and a full day
                on the road. We take one Zone 4 delivery per weekend, first booked.
              </p>
              <p>
                <strong>Beyond 110 miles</strong> — Zone 5 — books at a real price with a real
                condition attached: we hold the date and call within one business day to agree
                the window. Gualala is a four-hour round trip before anything comes off the
                trailer and Big Sur is worse, so promising a sight-unseen Friday out there
                would be a promise we could not keep.
              </p>
            </div>
            <div className="fh-stack">
              <div className="fh-note fh-note--warn">
                <span className="fh-note__title">The one thing we cannot do</span>
                <div className="fh-note__body">
                  <p>
                    Two deliveries in opposite directions on the same Friday. If your date is
                    already committed the other way, the calendar shows it struck through
                    instead of taking the booking and working it out later — and the app offers
                    the nearest open date, or a different unit, rather than a phone number.
                  </p>
                </div>
              </div>
              <div className="fh-note fh-note--info">
                <span className="fh-note__title">If we ever need help</span>
                <div className="fh-note__body">
                  <p>
                    If a date ever has to go to another operator, you will hear it from us
                    first, with the name of who is coming and what they are bringing. A
                    subcontracted trailer that shows up unannounced is how this trade earned
                    its reputation.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="fh-section">
          <div className="fh-section__head">
            <span className="fh-eyebrow fh-eyebrow--accent">Coverage</span>
            <h2 className="fh-h2">{counties.length} counties, {LOCATIONS.length} towns priced in advance</h2>
            <p className="fh-lede">
              Every town in the list below has a fixed driving mileage from the yard, so two
              customers in the same town get the same delivery number. If we do not recognise
              what you type, the booking flow suggests the nearest matches and quotes inside
              the base radius rather than stopping you.
            </p>
          </div>
          <div className="fh-table-wrap">
            <table className="fh-table">
              <caption>Counties we deliver to</caption>
              <thead>
                <tr>
                  <th scope="col">County</th>
                  <th scope="col" className="fh-table__num">
                    Towns listed
                  </th>
                  <th scope="col" className="fh-table__num">
                    Drive miles
                  </th>
                  <th scope="col">Zones</th>
                </tr>
              </thead>
              <tbody>
                {counties.map((county) => (
                  <tr key={county.county}>
                    <td>{county.county}</td>
                    <td className="fh-table__num">{county.towns}</td>
                    <td className="fh-table__num">
                      {county.min === county.max ? county.min : `${county.min}–${county.max}`}
                    </td>
                    <td>{county.zones}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="fh-section">
          <div className="fh-section__head">
            <span className="fh-eyebrow fh-eyebrow--accent">Sample distances</span>
            <h2 className="fh-h2">The towns on the map, with the delivery they carry</h2>
          </div>
          <div className="fh-table-wrap">
            <table className="fh-table">
              <caption>Driving miles from the Oakland yard, one way</caption>
              <thead>
                <tr>
                  <th scope="col">Town</th>
                  <th scope="col">County</th>
                  <th scope="col">Zone</th>
                  <th scope="col" className="fh-table__num">
                    Drive miles
                  </th>
                  <th scope="col" className="fh-table__num">
                    Delivery
                  </th>
                </tr>
              </thead>
              <tbody>
                {townRows.map((town) => (
                  <tr key={town.name}>
                    <td>{town.name}</td>
                    <td>{town.county}</td>
                    <td>{town.zone}</td>
                    <td className="fh-table__num">{town.miles}</td>
                    <td className="fh-table__num">{money(mileageFee(town.miles))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="fh-fine">
            Delivery is charged one way. The return trip is already inside the weekend rate,
            and billing it twice is the sort of thing that makes people ask for an itemised
            invoice. The full arithmetic is on the{' '}
            <a className="fh-link" {...linkProps(navigate, '/pricing')}>
              rate card
            </a>
            .
          </p>
        </section>

        <section className="fh-section">
          <div className="fh-row fh-row--between fh-row--wrap">
            <div className="fh-stack fh-stack--sm">
              <h2 className="fh-h3">Check your own town</h2>
              <p className="fh-text-muted">
                Type a city or a ZIP on the location step and the zone, the mileage and the
                delivery line appear as you type.
              </p>
            </div>
            <div className="fh-row fh-row--wrap">
              <a className="fh-btn fh-btn--primary" {...linkProps(navigate, '/book/event')}>
                Book an event
              </a>
              <a className="fh-btn fh-btn--secondary" {...linkProps(navigate, '/book/site')}>
                Book jobsite service
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default ServiceArea;
