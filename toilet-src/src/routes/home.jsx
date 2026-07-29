import React from 'react';
import { unitById } from '../data/fleet.js';
import { GUESTS_PER_STATION, INDUSTRY_PER_STATION, COMPETITOR_PER_STATION } from '../lib/capacity.js';
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

const CONTRAST = [
  {
    them: 'Request a quote and someone will get back to you.',
    us: 'The total is on screen before you give us your name.',
  },
  {
    them: 'Pricing available on request.',
    us: 'Every rate published on one page — delivery, extra days and the peak-season premium included.',
  },
  {
    them: 'That weekend might be open. Let me check with dispatch.',
    us: 'Booked dates are struck through on the calendar, with the nearest open date one tap away.',
  },
  {
    them: 'Six stations, serves up to 550 guests.',
    us: `One station per ${GUESTS_PER_STATION} guests, with the arithmetic printed on the screen you size it on.`,
  },
  {
    them: 'Delivery and fuel calculated at time of invoice.',
    us: `Free inside ${FREE_MILES} miles, then $3.50 a mile, on its own line, before you commit.`,
  },
  {
    them: 'Your call is important to us. Please hold.',
    us: 'One operator in Oakland, named on the about page, who owns the calendar and the truck.',
  },
];

export function Home({ navigate }) {
  const smallTrailer = unitById('trailer-2');
  const standard = unitById('unit-standard');
  const bigTrailer = unitById('trailer-8');

  return (
    <React.Fragment>
      <div className="fh-container">
        <section className="fh-hero">
          <h1 className="fh-hero__claim">
            A restroom trailer, booked in <em>two minutes</em>, at the price on the screen.
          </h1>
          <p className="fh-hero__sub">
            Fieldhouse rents restroom trailers and jobsite units across the nine Bay Area
            counties, wine country, and the coast from Monterey to Point Arena. Pick the date,
            see the total, hold it. No quote form, no callback to find out what it costs.
          </p>
          <div className="fh-hero__meta">
            <span className="fh-tag fh-tag--accent">Published rates</span>
            <span className="fh-tag">Live availability</span>
            <span className="fh-tag">Oakland yard</span>
            <span className="fh-tag">Friday delivery, Monday pickup</span>
          </div>
        </section>

        <section className="fh-section fh-section--first">
          <div className="fh-doors">
            <a className="fh-door" {...linkProps(navigate, '/book/event')}>
              <span className="fh-door__kicker">Fieldhouse Events</span>
              <span className="fh-door__title">Weddings and events</span>
              <span className="fh-door__desc">
                A trailer with flushing toilets, hot running water and climate control,
                delivered Friday and collected Monday. Tell us the date, the headcount and
                where it is going; we size it, price it and hold it while you read the
                receipt.
              </span>
              <span className="fh-door__meta">
                <span>From {money(smallTrailer.rateWeekend)} per weekend</span>
                <span>2 to {bigTrailer.stations} stations</span>
                <span>Four steps</span>
              </span>
              <span className="fh-door__cta">
                Book an event
                <span className="fh-chev fh-chev--right" aria-hidden="true" />
              </span>
            </a>

            <a className="fh-door" {...linkProps(navigate, '/book/site')}>
              <span className="fh-door__kicker">Fieldhouse Site Services</span>
              <span className="fh-door__title">Jobsite and ongoing</span>
              <span className="fh-door__desc">
                Standard units, accessible units and hand-wash stations on a monthly rate
                with weekly service included. A four-week minimum, a start date of your
                choosing, and no phone call in the middle of it.
              </span>
              <span className="fh-door__meta">
                <span>From {money(standard.rateMonthly)} per month</span>
                <span>Weekly service included</span>
                <span>Three steps</span>
              </span>
              <span className="fh-door__cta">
                Book monthly service
                <span className="fh-chev fh-chev--right" aria-hidden="true" />
              </span>
            </a>
          </div>
        </section>

        <section className="fh-section">
          <div className="fh-section__head">
            <span className="fh-eyebrow fh-eyebrow--accent">Three numbers we publish</span>
            <h2 className="fh-h2">The whole quote, before you talk to anyone</h2>
          </div>
          <div className="fh-proof">
            <div className="fh-proof__item">
              <span className="fh-proof__num">2 min</span>
              <span className="fh-proof__label">
                Four steps from the calendar to a held date. Nothing in this app waits on a
                server, so the total re-adds itself as you change your mind.
              </span>
            </div>
            <div className="fh-proof__item">
              <span className="fh-proof__num">{money(smallTrailer.rateWeekend)}</span>
              <span className="fh-proof__label">
                The weekend rate for the {smallTrailer.name.toLowerCase()}, delivered Friday
                and collected Monday. Every other rate in the fleet is on one page.
              </span>
            </div>
            <div className="fh-proof__item">
              <span className="fh-proof__num">{GUESTS_PER_STATION}</span>
              <span className="fh-proof__label">
                Guests per station in our sizing. The common trade rule of thumb is{' '}
                {INDUSTRY_PER_STATION}; we would rather you had no queue than a defensible
                one.
              </span>
            </div>
          </div>
        </section>
      </div>

      <section className="fh-section fh-section--sunken">
        <div className="fh-container">
          <div className="fh-section__head">
            <span className="fh-eyebrow fh-eyebrow--accent">The difference</span>
            <h2 className="fh-h2">What renting a restroom usually sounds like, and what it sounds like here</h2>
          </div>
          <div className="fh-stack fh-stack--lg">
            <div className="fh-contrast__grid">
              {CONTRAST.map((row) => (
                <div className="fh-contrast__row" key={row.us}>
                  <span className="fh-contrast__them">{row.them}</span>
                  <span className="fh-contrast__us">{row.us}</span>
                </div>
              ))}
            </div>
            <div className="fh-prose">
              <p>
                None of that is a knock on the equipment or on the drivers. The rental end
                of this trade consolidated into a handful of national operators, one of
                which spent the past year working through a bankruptcy, and consolidation
                has a way of moving the phone a long way from the yard. It is genuinely
                hard to quote a vineyard in Healdsburg from a call centre that has never
                seen the driveway.
              </p>
              <p>
                So we are betting on the opposite shape: a small fleet, one truck, one
                person, a calendar that says no when it means no, and prices printed where
                anyone can check them.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="fh-container">
        <section className="fh-section">
          <div className="fh-section__head">
            <span className="fh-eyebrow fh-eyebrow--accent">Off-grid work</span>
            <h2 className="fh-h2">Built for sites with nothing on them</h2>
            <p className="fh-lede">
              Ranches, vineyards and coastal properties are where this equipment earns its
              keep, and where most of it gets delivered badly. Every trailer leaves the yard
              self-sufficient.
            </p>
          </div>
          <div className="fh-grid-2">
            <ul className="fh-list fh-list--check">
              <li>
                Tanks arrive full. Fresh water is aboard before we hitch up, and the waste
                tank is empty and treated.
              </li>
              <li>
                Power is only needed for climate control and interior lights — 120 V and
                20 A, an ordinary household circuit. The toilets flush without it.
              </li>
              <li>
                No power within reach? A 6.5 kW inverter generator, fuelled for twelve
                hours, is a published add-on rather than a phone call.
              </li>
              <li>
                A {unitById('trailer-3').dimensions.lengthFt}-foot trailer fits down a
                vineyard row, and we bring blocking and mats for ground that is not flat.
              </li>
            </ul>
            <div className="fh-stack">
              <div className="fh-note fh-note--info">
                <span className="fh-note__title">Why this matters</span>
                <div className="fh-note__body">
                  <p>
                    A trailer that runs out of fresh water at hour four is not a plumbing
                    problem, it is a sizing problem — and sizing is arithmetic anyone can
                    check. We publish ours, along with the reason a{' '}
                    {COMPETITOR_PER_STATION}-guests-per-station claim makes us nervous.
                  </p>
                </div>
              </div>
              <div className="fh-row fh-row--wrap">
                <a className="fh-btn fh-btn--secondary fh-btn--sm" {...linkProps(navigate, '/faq')}>
                  The off-grid answers
                </a>
                <a className="fh-btn fh-btn--ghost fh-btn--sm" {...linkProps(navigate, '/fleet')}>
                  Fleet drawings
                </a>
                <a className="fh-btn fh-btn--ghost fh-btn--sm" {...linkProps(navigate, '/service-area')}>
                  Where we deliver
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="fh-section">
          <div className="fh-row fh-row--between fh-row--wrap">
            <div className="fh-stack--sm">
              <h2 className="fh-h3">Ready when you are</h2>
              <p className="fh-text-muted">
                Both flows end in a held date and an itemised receipt. Neither one asks for a
                card.
              </p>
            </div>
            <div className="fh-row fh-row--wrap">
              <a className="fh-btn fh-btn--primary" {...linkProps(navigate, '/book/event')}>
                Book an event
              </a>
              <a className="fh-btn fh-btn--secondary" {...linkProps(navigate, '/book/site')}>
                Book jobsite service
              </a>
              <a className="fh-link" {...linkProps(navigate, '/pricing')}>
                Or read the rate card first
              </a>
            </div>
          </div>
        </section>
      </div>
    </React.Fragment>
  );
}

export default Home;
