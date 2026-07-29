import React from 'react';
import {
  RATE_CARD,
  ADD_ONS,
  EXTRA_DAY_PCT,
  PEAK_UPLIFT,
  PEAK_MONTHS,
  FREE_MILES,
  SECOND_VISIT_PER_UNIT_MONTH,
  MIN_TERM_WEEKS,
} from '../data/rates.js';
import { unitById } from '../data/fleet.js';
import { lookup, mileageFee } from '../lib/zones.js';
import { quote } from '../lib/pricing.js';
import { emptySelection, buildHash } from '../lib/store.js';
import { money, monthName, formatDateLong } from '../lib/format.js';

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

// One line of commentary per published group. Keyed by the group name from
// data/rates.js; an unrecognised group simply renders without a note.
const GROUP_NOTES = {
  'Event trailers — weekend rate':
    'One price for the whole weekend: we deliver Friday, look in on Saturday, and pull out Monday.',
  'Event extras':
    'Flat amounts. None of these is ever multiplied by the season or by an extra day.',
  'Jobsite and monthly':
    'Per unit, per month, weekly service included. Four-week minimum.',
  'Delivery, season and service':
    'The three things most rate sheets leave off, which is exactly why they are on this one.',
};

const MILEAGE_EXAMPLE_CITIES = [
  'Berkeley',
  'Pleasanton',
  'Fremont',
  'San Jose',
  'Napa',
  'Santa Rosa',
  'Windsor',
  'Sea Ranch',
  'Gualala',
];

function num(value) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function addOnById(id) {
  return ADD_ONS.find((addOn) => addOn.id === id) || { label: id, detail: '', amount: 0 };
}

function peakMonthText() {
  const names = PEAK_MONTHS.map((month) => monthName(month));
  if (names.length < 2) return names.join('');
  return `${names[0]} through ${names[names.length - 1]}`;
}

export function Pricing({ navigate }) {
  const pct = (value) => `${Math.round(value * 100)}%`;
  const generator = addOnById('generator');
  const buffalo = addOnById('waterBuffalo');
  const attendant = addOnById('attendant');
  const bigTrailer = unitById('trailer-8');
  const standard = unitById('unit-standard');

  const mileageRows = MILEAGE_EXAMPLE_CITIES.map((city) => lookup(city)).filter(Boolean);

  // A real quote, produced by the same function the booking wizard uses, so this
  // page cannot drift from the engine: 120 guests, bar service, six hours, a
  // Saturday in peak season, delivered to Napa, generator added.
  const exampleSelection = {
    ...emptySelection('event'),
    start: '2026-09-26',
    end: '2026-09-26',
    guests: 120,
    hours: 6,
    alcohol: true,
    unitId: 'trailer-3',
    addOns: { generator: true, waterBuffalo: false, attendant: false },
    location: {
      query: 'Napa',
      ...(lookup('Napa') || { name: null, county: null, miles: null, zone: null }),
    },
  };
  const exampleQuote = quote(exampleSelection);

  return (
    <div className="fh-page">
      <div className="fh-container">
        <header className="fh-page__head">
          <span className="fh-eyebrow fh-eyebrow--accent">Rate card</span>
          <h1 className="fh-display">Every price we charge, on one page</h1>
          <p className="fh-lede">
            This is the whole rate sheet. Not a starting-at range, not a sample, not a
            brochure that says call for pricing. If a number can appear on a Fieldhouse
            invoice, it is printed below, and the booking flow adds nothing that is not here.
          </p>
        </header>

        <section className="fh-section fh-section--first">
          <div className="fh-ratecard">
            {RATE_CARD.map((group) => (
              <section className="fh-ratecard__group" key={group.group}>
                <div className="fh-ratecard__grouphead">
                  <h2 className="fh-h3">{group.group}</h2>
                  <span className="fh-eyebrow">Published</span>
                </div>
                {GROUP_NOTES[group.group] && (
                  <p className="fh-fine">{GROUP_NOTES[group.group]}</p>
                )}
                <div className="fh-table-wrap">
                  <table className="fh-table">
                    <caption className="fh-visually-hidden">{group.group}</caption>
                    <thead>
                      <tr>
                        <th scope="col">Item</th>
                        <th scope="col" className="fh-table__num">
                          Rate
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((row) => (
                        <tr key={row.item}>
                          <td>
                            {row.item}
                            {row.note && <span className="fh-table__note">{row.note}</span>}
                          </td>
                          <td className="fh-table__num">{row.display}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        </section>

        <section className="fh-section">
          <div className="fh-section__head">
            <span className="fh-eyebrow fh-eyebrow--accent">How a total is built</span>
            <h2 className="fh-h2">Six steps, in this order, every time</h2>
            <p className="fh-lede">
              The order matters, because it decides what the percentages apply to. Ours only
              ever apply to the rate itself.
            </p>
          </div>
          <ol className="fh-numlist">
            <li className="fh-numlist__item">
              Start with the published weekend rate for the unit you picked.
            </li>
            <li className="fh-numlist__item">
              Add {pct(EXTRA_DAY_PCT)} of that rate for each extra day beyond the
              Friday-to-Monday window. Setup and teardown are inside the window, so they are
              never billed as extra days.
            </li>
            <li className="fh-numlist__item">
              If the date is in peak season, add {pct(PEAK_UPLIFT)} of those two lines
              together — and see it as its own line, named for the month. It is never folded
              into the rate.
            </li>
            <li className="fh-numlist__item">
              Add delivery: nothing inside {FREE_MILES} miles of the Oakland yard, then $3.50
              for each mile past that. Charged one way, because the return trip is already in
              the base rate and charging for it twice is the trick this whole site is
              arguing against.
            </li>
            <li className="fh-numlist__item">
              Add any extras at their flat published amount. Extras are never multiplied by
              the season or by extra days.
            </li>
            <li className="fh-numlist__item">
              That is the total. No tax line, no fuel surcharge, no service fee, and no
              number that appears for the first time on an invoice.
            </li>
          </ol>
        </section>

        <section className="fh-section">
          <div className="fh-section__head">
            <span className="fh-eyebrow fh-eyebrow--accent">Worked example</span>
            <h2 className="fh-h2">A 120-guest wedding in Napa, September</h2>
            <p className="fh-lede">
              Computed on this page by the same function that runs the booking wizard, so it
              cannot quietly disagree with what you are charged.
            </p>
          </div>
          <div className="fh-grid-2">
            <div className="fh-card">
              <div className="fh-card__head">
                <h3 className="fh-h4">Itemised quote</h3>
                <span className="fh-eyebrow">{formatDateLong(exampleSelection.start)}</span>
              </div>
              <div className="fh-card__body">
                <div className="fh-lineitems">
                  {exampleQuote.lineItems.map((line) => (
                    <div
                      className={line.amount === 0 ? 'fh-lineitem fh-lineitem--free' : 'fh-lineitem'}
                      key={line.label}
                    >
                      <span className="fh-lineitem__label">{line.label}</span>
                      <span className="fh-lineitem__amount">{money(line.amount)}</span>
                      <span className="fh-lineitem__detail">{line.detail}</span>
                    </div>
                  ))}
                  <div className="fh-lineitems__total">
                    <span className="fh-lineitems__total-label">Total</span>
                    <span className="fh-lineitems__total-amount">
                      {money(exampleQuote.total)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="fh-card__foot">
                <p className="fh-fine">
                  {exampleSelection.guests} guests, bar service, {exampleSelection.hours}{' '}
                  hours, delivered to Napa with a generator. Nothing else is added at
                  checkout, because there is no checkout.
                </p>
              </div>
            </div>
            <div className="fh-stack">
              <h3 className="fh-h3">Reading it back</h3>
              <div className="fh-prose">
                <p>
                  The rate is the rate. The peak-season line is separate and named, so you
                  can see exactly what a September Saturday costs against the same booking in
                  March. Delivery is the mileage past the free radius and nothing else. The
                  generator is a flat amount that the season never touches. Move the date to
                  February and two of those lines disappear on their own — you can predict the
                  answer before the software gives it to you.
                </p>
              </div>
              {exampleQuote.notes.length > 0 && (
                <div className="fh-note fh-note--info">
                  <span className="fh-note__title">What the quote says out loud</span>
                  <div className="fh-note__body">
                    {exampleQuote.notes.map((note) => (
                      <p key={note}>{note}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="fh-section">
          <div className="fh-section__head">
            <span className="fh-eyebrow fh-eyebrow--accent">Delivery</span>
            <h2 className="fh-h2">$3.50 a mile, past the first {FREE_MILES}</h2>
            <p className="fh-lede">
              Measured one way in driving miles from the Oakland yard — not straight-line
              miles, and not the round trip. The trade surcharge runs $3 to $4 a mile; we sit
              inside that and publish the arithmetic.
            </p>
          </div>
          <div className="fh-table-wrap">
            <table className="fh-table">
              <caption>Delivery, worked from the published mileage table</caption>
              <thead>
                <tr>
                  <th scope="col">Town</th>
                  <th scope="col">County</th>
                  <th scope="col">Zone</th>
                  <th scope="col" className="fh-table__num">
                    Drive miles
                  </th>
                  <th scope="col" className="fh-table__num">
                    Billable miles
                  </th>
                  <th scope="col" className="fh-table__num">
                    Delivery
                  </th>
                </tr>
              </thead>
              <tbody>
                {mileageRows.map((row) => (
                  <tr key={row.name}>
                    <td>{row.name}</td>
                    <td>{row.county}</td>
                    <td>{row.zone}</td>
                    <td className="fh-table__num">{row.miles}</td>
                    <td className="fh-table__num">{Math.max(0, row.miles - FREE_MILES)}</td>
                    <td className="fh-table__num">{money(mileageFee(row.miles))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="fh-fine">
            Every town we list has a fixed driving mileage, so two customers in the same town
            are quoted the same delivery. The full table drives the{' '}
            <a className="fh-link" {...linkProps(navigate, '/service-area')}>
              service-area map
            </a>
            .
          </p>
        </section>

        <section className="fh-section">
          <div className="fh-section__head">
            <span className="fh-eyebrow fh-eyebrow--accent">Season</span>
            <h2 className="fh-h2">
              Peak season is {peakMonthText()}, and the premium is {pct(PEAK_UPLIFT)}
            </h2>
          </div>
          <div className="fh-grid-2">
            <div className="fh-prose">
              <p>
                From {peakMonthText()} the calendar is full, the truck runs every weekend, and
                a Saturday costs {pct(PEAK_UPLIFT)} more. That premium applies to the rate and
                to any extra days, and to nothing else — not to delivery, not to the generator,
                not to the attendant.
              </p>
              <p>
                Ours is a line item with the month written on it, not a number buried in the
                rate. Move a date into the shoulder season and you can see what you save before
                you decide.
              </p>
            </div>
            <div className="fh-included">
              <div className="fh-included__col">
                <span className="fh-eyebrow">Peak months</span>
                <ul className="fh-list fh-list--dash">
                  {PEAK_MONTHS.map((month) => (
                    <li key={month}>{monthName(month)}</li>
                  ))}
                </ul>
              </div>
              <div className="fh-included__col">
                <span className="fh-eyebrow">What the premium touches</span>
                <ul className="fh-list fh-list--check">
                  <li>The unit rate</li>
                  <li>Extra days, at {pct(EXTRA_DAY_PCT)} of that rate</li>
                </ul>
                <ul className="fh-list fh-list--cross">
                  <li>Delivery mileage</li>
                  <li>Generator, water buffalo, attendant</li>
                  <li>Extra standard units and hand-wash stations</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="fh-section">
          <div className="fh-section__head">
            <span className="fh-eyebrow fh-eyebrow--accent">Included and not included</span>
            <h2 className="fh-h2">There are no hidden fees. Here is the proof.</h2>
            <p className="fh-lede">
              Saying there are no hidden fees is worth nothing on its own — everyone says it.
              So here is everything that is inside the price, and everything that is not,
              with the price of the things that are not.
            </p>
          </div>
          <div className="fh-included">
            <div className="fh-included__col">
              <h3 className="fh-h4">In every price</h3>
              <ul className="fh-list fh-list--check">
                <li>
                  Delivery, placement and pickup inside {FREE_MILES} miles of the Oakland
                  yard
                </li>
                <li>
                  Levelling on uneven ground, with blocking under the frame and a mat at the
                  stairs
                </li>
                <li>Tanks arriving full: fresh water aboard, waste tank empty and treated</li>
                <li>Paper, soap and hand towels stocked for the headcount you booked</li>
                <li>Pump-out and legal disposal of everything we haul away</li>
                <li>A Saturday service check on any multi-day event</li>
                <li>
                  Friday-to-Monday possession, so setup and teardown days are not billed as
                  extra days
                </li>
                <li>
                  Sizing advice, and the arithmetic behind it, printed on the screen you size
                  it on
                </li>
                <li>
                  Weekly pump, restock and sanitise on every monthly rental —{' '}
                  {money(SECOND_VISIT_PER_UNIT_MONTH)} per unit per month adds a second visit
                </li>
              </ul>
            </div>
            <div className="fh-included__col">
              <h3 className="fh-h4">Not in the price, and what it costs</h3>
              <ul className="fh-list fh-list--cross">
                <li>
                  <strong>Power.</strong> Climate control and interior lights want 120 V and
                  20 A. Run a cord from the venue, or add the generator at{' '}
                  {money(generator.amount)}: {generator.detail}.
                </li>
                <li>
                  <strong>Refills on site.</strong> Full tanks cover a normal event. The
                  fresh-water buffalo is {money(buffalo.amount)} when we need to top up
                  without leaving.
                </li>
                <li>
                  <strong>An attendant.</strong> {money(attendant.amount)} for up to six
                  hours, and worth it above roughly 250 guests or wherever the queue is the
                  photograph nobody wants.
                </li>
                <li>
                  <strong>Permits and closures.</strong> Whatever a city, county or park
                  charges to put a trailer where you want it.
                </li>
                <li>
                  <strong>A route the truck can use.</strong> Ten feet of width, twelve feet
                  of clearance, and ground firm enough for {num(bigTrailer.weightLb)} lb on
                  two axles.
                </li>
                <li>
                  <strong>Overnight security, gratuity, and damage</strong> beyond ordinary
                  use.
                </li>
                <li>
                  <strong>Anything past 110 miles before we have called you.</strong> Zone 5
                  books at a real price, and we confirm the delivery window within one
                  business day.
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className="fh-section">
          <div className="fh-grid-2">
            <div className="fh-stack">
              <h2 className="fh-h3">Charges that do not exist here</h2>
              <ul className="fh-list fh-list--cross">
                <li>Fuel surcharge</li>
                <li>Environmental or disposal fee</li>
                <li>Administrative, documentation or contract fee</li>
                <li>Weekend, after-hours or holiday delivery fee</li>
                <li>Minimum-order fee</li>
                <li>Card-processing fee</li>
                <li>A price that changes between the quote and the invoice</li>
              </ul>
            </div>
            <div className="fh-stack">
              <h2 className="fh-h3">Monthly rentals, plainly</h2>
              <div className="fh-prose">
                <p>
                  A standard unit is {money(standard.rateMonthly)} a month with one service
                  visit a week: pumped, restocked, sanitised. The minimum term is{' '}
                  {MIN_TERM_WEEKS} weeks, and a term in weeks is priced as that many
                  quarter-months rather than rounded up to the next whole one.
                </p>
                <p>
                  Twice-weekly service is {money(SECOND_VISIT_PER_UNIT_MONTH)} per unit per
                  month. There is no seasonal premium on a jobsite rental at all — charging a
                  framing crew more in July because weddings are busy would be indefensible,
                  so the peak line simply never appears on a monthly quote.
                </p>
              </div>
              <div className="fh-note">
                <span className="fh-note__title">Prototype</span>
                <div className="fh-note__body">
                  <p>
                    Nothing on this site takes a payment and no contract is issued. These are
                    the rates the real business would publish; the booking flow holds a date
                    in your browser and shows you the receipt it would send.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="fh-section">
          <div className="fh-row fh-row--between fh-row--wrap">
            <div className="fh-stack fh-stack--sm">
              <h2 className="fh-h3">See it against your own date</h2>
              <p className="fh-text-muted">
                The wizard prices as you type, and the peak line appears the moment you pick
                a date in season.
              </p>
            </div>
            <div className="fh-row fh-row--wrap">
              <a className="fh-btn fh-btn--primary" {...linkProps(navigate, '/book/event')}>
                Price an event
              </a>
              <a className="fh-btn fh-btn--secondary" {...linkProps(navigate, '/book/site')}>
                Price a jobsite
              </a>
              <a className="fh-link" {...linkProps(navigate, '/fleet')}>
                Or compare the units
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Pricing;
