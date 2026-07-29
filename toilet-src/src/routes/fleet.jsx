import React from 'react';
import { FLEET, unitById } from '../data/fleet.js';
import { GUESTS_PER_STATION } from '../lib/capacity.js';
import { money } from '../lib/format.js';
import { buildHash } from '../lib/store.js';
import { DrawingPlate } from '../drawings/index.jsx';

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

// Surveyor form, matching the dimension text inside the drawings: 8.5 -> 8'-6".
function ft(value) {
  let whole = Math.floor(value);
  let inches = Math.round((value - whole) * 12);
  if (inches === 12) {
    whole += 1;
    inches = 0;
  }
  return `${whole}'-${inches}"`;
}

function num(value) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

const KIND_LABEL = {
  trailer: 'Restroom trailer',
  standard: 'Single unit',
  handwash: 'Hand-wash station',
};

function kindLabel(unit) {
  return KIND_LABEL[unit.kind] || 'Unit';
}

function footprint(unit) {
  return `${ft(unit.dimensions.lengthFt)} × ${ft(unit.dimensions.widthFt)}`;
}

// Short attribute chips, derived from the record so they cannot drift from it.
function unitTags(unit) {
  const tags = [];
  if (unit.ada) tags.push({ label: 'ADA accessible', accent: true });
  if (unit.kind === 'trailer') {
    tags.push({ label: 'Flushing, hot water' });
    tags.push({ label: 'Climate controlled' });
  }
  if (/^none/i.test(unit.powerNeed)) tags.push({ label: 'No power needed' });
  if (unit.rateMonthly !== null) tags.push({ label: 'Monthly rate' });
  return tags;
}

// Where "book this" goes. Trailers open the events wizard with the unit pre-picked;
// the two stocked items open the jobsite wizard with a quantity of one.
function bookTarget(unit) {
  if (unit.kind === 'trailer') {
    return { path: '/book/event', params: { u: unit.id }, label: 'Book this trailer' };
  }
  if (unit.id === 'station-handwash') {
    return { path: '/book/site', params: { qh: 1 }, label: 'Book this station' };
  }
  return { path: '/book/site', params: { qs: 1 }, label: 'Book this unit' };
}

function RateBlock({ unit }) {
  const monthly = unit.rateMonthly !== null;
  return (
    <div className="fh-stack fh-stack--sm">
      <div className="fh-unit__rate">
        <span className="fh-unit__rate-amount">
          {money(monthly ? unit.rateMonthly : unit.rateWeekend)}
        </span>
        <span className="fh-unit__rate-unit">
          {monthly ? 'per month, weekly service included' : 'per weekend, Friday to Monday'}
        </span>
      </div>
      <p className="fh-fine">
        {monthly
          ? `${money(unit.rateWeekend)} for a single event weekend. Four-week minimum on the monthly rate.`
          : 'Extra days are 35% of the rate, and any peak-season premium is its own line.'}
      </p>
    </div>
  );
}

function UnitCard({ unit, navigate }) {
  const target = bookTarget(unit);
  return (
    <article className="fh-unit">
      <div className="fh-unit__figure">
        <DrawingPlate
          id={unit.id}
          view="plan"
          title={`${unit.name}, plan view`}
          label="Plan"
          caption={footprint(unit)}
        />
      </div>
      <div className="fh-unit__body">
        <div>
          <span className="fh-unit__kind">{kindLabel(unit)}</span>
          <h3 className="fh-unit__name">{unit.name}</h3>
        </div>
        <p className="fh-unit__blurb">{unit.blurb}</p>
        <div className="fh-unit__specs">
          <div className="fh-spec">
            <span className="fh-spec__k">Stations</span>
            <span className="fh-spec__v">{unit.stations > 0 ? unit.stations : '—'}</span>
          </div>
          <div className="fh-spec">
            <span className="fh-spec__k">Guests</span>
            <span className="fh-spec__v">
              {unit.capacityGuests > 0 ? unit.capacityGuests : '—'}
            </span>
          </div>
          <div className="fh-spec">
            <span className="fh-spec__k">Height</span>
            <span className="fh-spec__v">{ft(unit.dimensions.heightFt)}</span>
          </div>
          <div className="fh-spec">
            <span className="fh-spec__k">Dry weight</span>
            <span className="fh-spec__v">{num(unit.weightLb)} lb</span>
          </div>
        </div>
        <ul className="fh-unit__features">
          {unitTags(unit).map((tag) => (
            <li className={tag.accent ? 'fh-tag fh-tag--accent' : 'fh-tag'} key={tag.label}>
              {tag.label}
            </li>
          ))}
        </ul>
        <RateBlock unit={unit} />
        <div className="fh-unit__actions">
          <a
            className="fh-btn fh-btn--primary fh-btn--sm"
            {...linkProps(navigate, target.path, target.params)}
          >
            {target.label}
          </a>
          <a
            className="fh-btn fh-btn--ghost fh-btn--sm"
            {...linkProps(navigate, `/fleet/${unit.id}`)}
          >
            Drawings and specs
          </a>
        </div>
      </div>
    </article>
  );
}

function UnitDetail({ unit, navigate }) {
  const target = bookTarget(unit);
  const others = FLEET.filter((other) => other.id !== unit.id);
  return (
    <React.Fragment>
      <header className="fh-page__head">
        <span className="fh-eyebrow fh-eyebrow--accent">{kindLabel(unit)}</span>
        <h1 className="fh-display">{unit.name}</h1>
        <p className="fh-lede">{unit.blurb}</p>
        <ul className="fh-unit__features">
          {unitTags(unit).map((tag) => (
            <li className={tag.accent ? 'fh-tag fh-tag--accent' : 'fh-tag'} key={tag.label}>
              {tag.label}
            </li>
          ))}
        </ul>
      </header>

      <section className="fh-section fh-section--first">
        <div className="fh-drawings-pair">
          <DrawingPlate
            id={unit.id}
            view="plan"
            title={`${unit.name}, plan view`}
            label="Plan"
            caption={footprint(unit)}
          />
          <DrawingPlate
            id={unit.id}
            view="elevation"
            title={`${unit.name}, elevation`}
            label="Elevation"
            caption={`${ft(unit.dimensions.heightFt)} overall`}
          />
        </div>
        <p className="fh-fine">
          Drawn to the dimensions we deliver, not to a brochure. We do not own this fleet
          yet, so there is no photograph of it — a dimensioned drawing is the honest version.{' '}
          {unit.kind === 'trailer'
            ? `It is also what a venue's events director actually needs: they are deciding where a ${ft(unit.dimensions.lengthFt)} box can stand.`
            : 'It also shows exactly how much room the unit takes on a site that is already crowded.'}
        </p>
      </section>

      <section className="fh-section">
        <div className="fh-grid-2">
          <div className="fh-card">
            <div className="fh-card__head">
              <h2 className="fh-h3">Specification</h2>
              <span className="fh-eyebrow">{unit.id}</span>
            </div>
            <div className="fh-card__body">
              <dl className="fh-kv">
                <dt className="fh-kv__k">Stations</dt>
                <dd className="fh-kv__v">
                  {unit.stations > 0 ? unit.stations : 'None — wash only'}
                </dd>
                <dt className="fh-kv__k">Guests</dt>
                <dd className="fh-kv__v">
                  {unit.capacityGuests > 0
                    ? `Up to ${unit.capacityGuests} at ${GUESTS_PER_STATION} per station`
                    : 'Sized alongside restrooms, not instead of them'}
                </dd>
                <dt className="fh-kv__k">Footprint</dt>
                <dd className="fh-kv__v">{footprint(unit)}</dd>
                <dt className="fh-kv__k">Height</dt>
                <dd className="fh-kv__v">{ft(unit.dimensions.heightFt)}</dd>
                <dt className="fh-kv__k">Dry weight</dt>
                <dd className="fh-kv__v">{num(unit.weightLb)} lb</dd>
                <dt className="fh-kv__k">Accessible</dt>
                <dd className="fh-kv__v">{unit.ada ? 'Yes — ramp, grab bars, lowered sink' : 'No'}</dd>
                <dt className="fh-kv__k">Weekend</dt>
                <dd className="fh-kv__v">{money(unit.rateWeekend)}</dd>
                <dt className="fh-kv__k">Monthly</dt>
                <dd className="fh-kv__v">
                  {unit.rateMonthly !== null ? money(unit.rateMonthly) : 'Not rented monthly'}
                </dd>
              </dl>
            </div>
            <div className="fh-card__foot">
              <p className="fh-fine">
                Rates are the published ones. Delivery, extra days and any peak-season
                premium are added as their own lines, never folded into the number above.
              </p>
            </div>
          </div>

          <div className="fh-stack fh-stack--lg">
            <div>
              <h2 className="fh-h3">What is in it</h2>
              <ul className="fh-list fh-list--check">
                {unit.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </div>
            <div className="fh-note">
              <span className="fh-note__title">Power</span>
              <div className="fh-note__body">
                <p>{unit.powerNeed}</p>
              </div>
            </div>
            <div className="fh-note">
              <span className="fh-note__title">Water and waste</span>
              <div className="fh-note__body">
                <p>{unit.waterNeed}</p>
              </div>
            </div>
            <RateBlock unit={unit} />
            <div className="fh-unit__actions">
              <a
                className="fh-btn fh-btn--primary"
                {...linkProps(navigate, target.path, target.params)}
              >
                {target.label}
              </a>
              <a className="fh-btn fh-btn--ghost" {...linkProps(navigate, '/pricing')}>
                Rate card
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="fh-section">
        <div className="fh-section__head">
          <span className="fh-eyebrow">The rest of the fleet</span>
        </div>
        <div className="fh-row fh-row--wrap">
          {others.map((other) => (
            <a
              className="fh-btn fh-btn--ghost fh-btn--sm"
              key={other.id}
              {...linkProps(navigate, `/fleet/${other.id}`)}
            >
              {other.name}
            </a>
          ))}
          <a className="fh-btn fh-btn--secondary fh-btn--sm" {...linkProps(navigate, '/fleet')}>
            All {FLEET.length} units
          </a>
        </div>
      </section>
    </React.Fragment>
  );
}

export function Fleet({ route, navigate }) {
  const wanted = route.segments[1] || null;
  const unit = wanted ? unitById(wanted) : null;
  const trailerCount = FLEET.filter((item) => item.kind === 'trailer').length;

  if (unit) {
    return (
      <div className="fh-page">
        <div className="fh-container">
          <UnitDetail unit={unit} navigate={navigate} />
        </div>
      </div>
    );
  }

  return (
    <div className="fh-page">
      <div className="fh-container">
        <header className="fh-page__head">
          <span className="fh-eyebrow fh-eyebrow--accent">Fleet</span>
          <h1 className="fh-display">{FLEET.length} units, drawn to size</h1>
          <p className="fh-lede">
            The fleet is {trailerCount} restroom trailers, the standard jobsite unit and the
            hand-wash station. Every plate below is a dimensioned drawing rather than a
            photograph, because this fleet is not on the ground yet and a soft-focus interior
            shot would be a lie about it.
          </p>
        </header>

        {wanted && !unit && (
          <div className="fh-note fh-note--warn">
            <span className="fh-note__title">Not a unit we run</span>
            <div className="fh-note__body">
              <p>
                There is no unit with the id <span className="fh-mono">{wanted}</span> in the
                Fieldhouse fleet. The {FLEET.length} we do run are below, and every one of
                them is linkable on its own.
              </p>
            </div>
          </div>
        )}

        <section className="fh-section fh-section--first">
          <div className="fh-fleet__grid">
            {FLEET.map((item) => (
              <UnitCard unit={item} navigate={navigate} key={item.id} />
            ))}
          </div>
        </section>

        <section className="fh-section">
          <div className="fh-grid-2">
            <div className="fh-stack">
              <h2 className="fh-h3">How to pick one</h2>
              <p className="fh-prose">
                Divide your headcount by {GUESTS_PER_STATION}, add a quarter if there is a
                bar, add a bit more for a long evening, and round up. That is the whole
                method, and the sizing step does it on screen while you watch. Doors matter
                more than the badge on the trailer: two rooms means two queues moving, which
                is the real reason a small trailer beats a pair of single units.
              </p>
            </div>
            <div className="fh-stack">
              <h2 className="fh-h3">Pairing units</h2>
              <p className="fh-prose">
                Above {unitById('trailer-8').capacityGuests} guests there is no bigger
                trailer to move up to, so we pair the {unitById('trailer-8').name} with
                standard units placed at the far side of the site. That keeps a second queue
                away from the main one, and it books online like anything else.
              </p>
              <div className="fh-row fh-row--wrap">
                <a className="fh-btn fh-btn--primary fh-btn--sm" {...linkProps(navigate, '/book/event')}>
                  Size it for me
                </a>
                <a className="fh-btn fh-btn--ghost fh-btn--sm" {...linkProps(navigate, '/pricing')}>
                  Rate card
                </a>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Fleet;
