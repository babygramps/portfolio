import React from 'react';
import { Wizard } from '../booking/wizard.jsx';
import { SummarySheet } from '../booking/summary-sheet.jsx';
import { Calendar } from '../booking/calendar.jsx';
import { Stepper } from '../booking/stepper.jsx';
import { Segmented } from '../booking/segmented.jsx';
import { lookup, suggest, zoneFor, mileageFee, ZONES } from '../lib/zones.js';
import { quote } from '../lib/pricing.js';
import { dayState } from '../lib/availability.js';
import {
  decodeSelection,
  encodeSelection,
  saveBooking,
  nextConfirmationNumber,
} from '../lib/store.js';
import {
  money,
  plural,
  todayISO,
  parseISO,
  formatDateLong,
  isPastDate,
} from '../lib/format.js';
import { unitById } from '../data/fleet.js';
import {
  JOBSITE_ITEMS,
  TERM_UNIT_OPTIONS,
  SERVICE_FREQUENCY_OPTIONS,
  SECOND_VISIT_PER_UNIT_MONTH,
  MIN_TERM_WEEKS,
  FREE_MILES,
} from '../data/rates.js';

const PATH = '/book/site';
const MODE = 'site';
const STEP_LABELS = ['Units', 'Term', 'Location'];
const LAST_STEP = STEP_LABELS.length - 1;
const MAX_QTY = 40;
const MAX_WEEKS = 52;
const MAX_MONTHS = 24;
const MAX_MONTH = { year: 2027, month: 12 };

// The contract gives `decodeSelection(query, mode)` a query string and `navigate`
// a params object, while `route.params` arrives already decoded. These two
// converters bridge that without touching any file another agent owns.
const SAFE_PARAM = /^[A-Za-z0-9,\-_.:]*$/;

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch (err) {
    return value;
  }
}

function paramsToQuery(params) {
  const keys = Object.keys(params || {});
  const out = [];
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    const raw = String(params[key]);
    out.push(key + '=' + (SAFE_PARAM.test(raw) ? raw : encodeURIComponent(raw)));
  }
  return out.join('&');
}

function queryToParams(query) {
  const out = {};
  if (!query) return out;
  const pairs = query.split('&');
  for (let i = 0; i < pairs.length; i += 1) {
    const pair = pairs[i];
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const key = eq === -1 ? pair : pair.slice(0, eq);
    const value = eq === -1 ? '' : pair.slice(eq + 1);
    out[safeDecode(key)] = safeDecode(value);
  }
  return out;
}

// Compare two query strings by their decoded contents, so that two spellings of
// the same value (a literal comma versus %2C) never read as an external change.
function canonQuery(query) {
  const params = queryToParams(query);
  return Object.keys(params)
    .map((key) => key + '=' + params[key])
    .sort()
    .join('&');
}

function termBounds(termUnit) {
  return termUnit === 'weeks'
    ? { min: MIN_TERM_WEEKS, max: MAX_WEEKS }
    : { min: 1, max: MAX_MONTHS };
}

function normalizeSite(input) {
  const sel = Object.assign({}, input);
  sel.mode = MODE;
  sel.step = Math.max(0, Math.min(LAST_STEP, Number(sel.step) || 0));
  sel.location = Object.assign(
    { query: '', name: null, county: null, miles: null, zone: null },
    sel.location,
  );
  sel.contact = Object.assign({ name: '', email: '', phone: '' }, sel.contact);

  const units = Object.assign({}, sel.units);
  for (let i = 0; i < JOBSITE_ITEMS.length; i += 1) {
    const id = JOBSITE_ITEMS[i].id;
    units[id] = Math.max(0, Math.min(MAX_QTY, Number(units[id]) || 0));
  }
  sel.units = units;

  const termUnit = sel.term && sel.term.unit === 'weeks' ? 'weeks' : 'months';
  const bounds = termBounds(termUnit);
  const rawCount = Number(sel.term ? sel.term.count : bounds.min);
  sel.term = {
    unit: termUnit,
    count: Math.max(bounds.min, Math.min(bounds.max, Number.isFinite(rawCount) ? Math.round(rawCount) : bounds.min)),
  };

  sel.serviceFrequency = sel.serviceFrequency === 'twice-weekly' ? 'twice-weekly' : 'weekly';
  sel.end = sel.start ? sel.start : null;

  // A hand-edited link cannot skip past the quantities or the start date.
  let quantity = 0;
  for (let i = 0; i < JOBSITE_ITEMS.length; i += 1) {
    quantity += units[JOBSITE_ITEMS[i].id];
  }
  if (quantity === 0) sel.step = 0;
  if (!sel.start && sel.step > 1) sel.step = 1;
  return sel;
}

function unitCountOf(selection) {
  let total = 0;
  for (let i = 0; i < JOBSITE_ITEMS.length; i += 1) {
    total += selection.units[JOBSITE_ITEMS[i].id] || 0;
  }
  return total;
}

function contactErrors(contact) {
  const errors = {};
  const name = String(contact.name || '').trim();
  const email = String(contact.email || '').trim();
  const digits = String(contact.phone || '').replace(/[^0-9]/g, '');
  if (!name) {
    errors.name = 'We need a name for the delivery ticket.';
  }
  if (!email) {
    errors.email = 'We need an email address for the confirmation and the monthly statement.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    errors.email = 'That address is missing an @ or a domain. Fix it and we will keep what you typed.';
  }
  if (!digits) {
    errors.phone = 'We need a phone number: the driver calls before the first drop.';
  } else if (digits.length < 10) {
    errors.phone = 'That is ' + digits.length + ' digits. A US number needs ten.';
  }
  return errors;
}

function ProblemNote({ problems }) {
  if (problems.length === 0) return null;
  return (
    <div className="fh-note fh-note--warn">
      <span className="fh-note__title">
        {problems.length === 1 ? 'One thing first' : 'A couple of things first'}
      </span>
      <div className="fh-note__body">
        <ul className="fh-list fh-list--dash">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function LocationPicker({ location, onPick, onQuery }) {
  const query = String(location.query || '');
  const trimmed = query.trim();
  const matched = location.miles !== null && !!location.name;
  // A four-character prefix is a guess: we take the nearest town that starts with
  // it and keep the other candidates tappable, so nobody is quoted a drive to a
  // town they did not mean.
  const guessed =
    matched &&
    !/^\d{5}$/.test(trimmed) &&
    trimmed.toLowerCase() !== String(location.name).toLowerCase();
  const suggestions =
    trimmed.length < 2 || (matched && !guessed)
      ? []
      : suggest(trimmed).filter((record) => record.name !== location.name);
  const zone = matched ? ZONES.filter((z) => z.id === location.zone)[0] : null;
  const fee = matched ? mileageFee(location.miles) : 0;
  const excess = matched ? Math.max(0, location.miles - FREE_MILES) : 0;

  return (
    <div className="fh-field fh-typeahead">
      <label className="fh-label" htmlFor="fh-site-location">
        City or ZIP code of the site
      </label>
      <input
        id="fh-site-location"
        className="fh-input"
        type="text"
        inputMode="text"
        autoComplete="postal-code"
        placeholder="Livermore, or 94550"
        value={query}
        onChange={(event) => onQuery(event.target.value)}
      />
      {matched && (
        <div className="fh-typeahead__result">
          <span className={'fh-zonechip' + (location.zone === 'Z5' ? ' fh-zonechip--far' : '')}>
            {location.zone}
          </span>
          <span>
            {location.name}, {location.county} County
          </span>
          <span className="fh-mono">{location.miles} mi from the Oakland yard</span>
          <span className="fh-money">{fee === 0 ? 'Delivery $0' : 'Delivery ' + money(fee)}</span>
        </div>
      )}
      {matched && (
        <span className="fh-hint">
          {fee === 0
            ? 'Inside the free ' + FREE_MILES + '-mile radius. Delivery and pickup are one charge for the whole term, not a monthly line.'
            : excess + ' miles past the free ' + FREE_MILES + ', at $3.50 a mile one way, charged once for the term. Weekly service visits are in the monthly rate and are never billed as mileage.'}
        </span>
      )}
      {zone && <span className="fh-hint">{zone.blurb}</span>}
      {guessed && suggestions.length > 0 && (
        <span className="fh-hint">
          We matched the nearest town starting with {trimmed}. Tap another if that is the one you
          meant.
        </span>
      )}
      {suggestions.length > 0 && (
        <div className="fh-typeahead__list">
          {suggestions.map((record) => (
            <button
              type="button"
              className="fh-typeahead__opt"
              key={record.name}
              onClick={() => onPick(record)}
            >
              <span className="fh-typeahead__opt-name">{record.name}</span>
              <span className="fh-typeahead__opt-meta">
                {record.county} · {record.miles} mi
              </span>
            </button>
          ))}
        </div>
      )}
      {!matched && trimmed.length >= 2 && suggestions.length === 0 && (
        <span className="fh-hint">
          We do not have {trimmed} in our distance table. Keep going — delivery is quoted inside the
          base radius and we confirm the real mileage on the call, before anything is scheduled.
        </span>
      )}
      {!matched && trimmed.length < 2 && (
        <span className="fh-hint">
          A cross street works too, as long as the town is right. Around 150 Bay Area towns are in
          the table with real driving miles from our Oakland yard.
        </span>
      )}
    </div>
  );
}

function UnitsStep({ selection, onPatch }) {
  const total = unitCountOf(selection);

  function setQty(id, value) {
    onPatch({ units: Object.assign({}, selection.units, { [id]: value }) });
  }

  return (
    <div className="fh-stack fh-stack--lg">
      <div className="fh-stack">
        {JOBSITE_ITEMS.map((item) => {
          const fleetUnit = unitById(item.unitId);
          return (
            <div className="fh-stack fh-stack--sm" key={item.id}>
              <Stepper
                id={'fh-site-qty-' + item.id}
                label={item.label}
                unit={money(item.rateMonthly) + ' / month'}
                value={selection.units[item.id] || 0}
                onChange={(next) => setQty(item.id, next)}
                min={0}
                max={MAX_QTY}
                step={1}
              />
              <p className="fh-hint">
                {fleetUnit.dimensions.lengthFt} × {fleetUnit.dimensions.widthFt} ft footprint,{' '}
                {fleetUnit.dimensions.heightFt} ft tall.{' '}
                {item.id === 'unit-standard-ada'
                  ? 'Wheelchair-accessible: level entry, grab bars, and room to turn a chair around. Most public-works contracts require one on site.'
                  : fleetUnit.blurb}
              </p>
            </div>
          );
        })}
      </div>

      {total === 0 && (
        <div className="fh-note">
          <span className="fh-note__title">Add at least one unit</span>
          <div className="fh-note__body">
            <p>
              A standard unit is {money(JOBSITE_ITEMS[0].rateMonthly)} a month with weekly service
              included. That is the whole price, published, and you can book it right now without
              talking to anybody — which is the part of this business that should never have needed a
              phone call.
            </p>
          </div>
          <div className="fh-alts">
            <button
              type="button"
              className="fh-alts__btn"
              onClick={() => setQty('unit-standard', 1)}
            >
              One standard unit
            </button>
            <button
              type="button"
              className="fh-alts__btn"
              onClick={() =>
                onPatch({
                  units: Object.assign({}, selection.units, {
                    'unit-standard': 2,
                    'unit-standard-ada': 1,
                    'station-handwash': 1,
                  }),
                })
              }
            >
              Typical small crew: two standard, one ADA, one hand-wash
            </button>
          </div>
        </div>
      )}

      <div className="fh-note fh-note--info">
        <span className="fh-note__title">What the monthly rate covers</span>
        <div className="fh-note__body">
          <ul className="fh-list fh-list--check">
            <li>Delivery, placement and pickup — one charge for the term, not monthly</li>
            <li>Weekly service: pump the tank, restock paper and sanitiser, wash the interior</li>
            <li>Anchoring or ballast on an exposed site, at no extra charge</li>
            <li>A number that reaches a person the same day if a unit gets knocked over</li>
          </ul>
        </div>
      </div>

      <div className="fh-note">
        <span className="fh-note__title">Ratio worth knowing</span>
        <div className="fh-note__body">
          <p>
            The usual construction standard is one unit per ten workers on a forty-hour week, and one
            hand-wash station wherever anyone eats on site. Ten framers on a two-storey remodel is one
            unit; a twenty-five-person crew is three, and the third one is what stops the other two
            from being the reason people leave the site at lunch.
          </p>
        </div>
      </div>
    </div>
  );
}

function TermStep({ selection, view, onView, onPatch }) {
  const today = todayISO();
  const bounds = termBounds(selection.term.unit);
  const unitCount = unitCountOf(selection);
  const twiceWeekly = selection.serviceFrequency === 'twice-weekly';
  const monthsFactor =
    selection.term.unit === 'months' ? selection.term.count : selection.term.count / 4;

  function getDay(dateISO) {
    // Standard units and hand-wash stations are stocked in quantity, so nothing on
    // a jobsite calendar is ever blocked, and there is no seasonal premium to mark.
    const state = dayState('unit-standard', dateISO);
    return { available: state.available, peak: false, past: isPastDate(dateISO) };
  }

  return (
    <div className="fh-stack fh-stack--lg">
      <div className="fh-stack fh-stack--sm">
        <span className="fh-label">When do we drop them?</span>
        <Calendar
          year={view.year}
          month={view.month}
          selected={selection.start}
          end={selection.start}
          getDay={getDay}
          onSelect={(dateISO) => onPatch({ start: dateISO, end: dateISO })}
          onMonthChange={(year, month) => onView({ year, month })}
          minMonth={{ year: parseISO(today).y, month: parseISO(today).m }}
          maxMonth={MAX_MONTH}
          showLegend={false}
        />
        <p className="fh-hint">
          {selection.start
            ? 'Delivery ' + formatDateLong(selection.start) + '. Weekly service starts the following week.'
            : 'Pick the delivery date. We need two working days of notice; anything sooner, book it and we will call to confirm the truck.'}
        </p>
      </div>

      <div className="fh-stack fh-stack--sm">
        <span className="fh-label">How long do you need them?</span>
        <Segmented
          label="Term unit"
          options={TERM_UNIT_OPTIONS}
          value={selection.term.unit}
          onChange={(next) =>
            onPatch({
              term: { unit: next, count: next === 'weeks' ? MIN_TERM_WEEKS : 1 },
            })
          }
        />
        <Stepper
          id="fh-site-term-count"
          label={selection.term.unit === 'weeks' ? 'Weeks on site' : 'Months on site'}
          unit={selection.term.unit}
          value={selection.term.count}
          onChange={(next) => onPatch({ term: { unit: selection.term.unit, count: next } })}
          min={bounds.min}
          max={bounds.max}
          step={1}
        />
        <p className="fh-hint">
          {selection.term.unit === 'weeks'
            ? 'Four weeks is the minimum term, and weeks are billed as quarter-months — ' + MIN_TERM_WEEKS + ' weeks is one month of rate.'
            : 'One month minimum. Run long and nothing changes: the rate is the same in November as it is in July, because a seasonal premium on a jobsite rental would be indefensible.'}
        </p>
      </div>

      <div className="fh-stack fh-stack--sm">
        <span className="fh-label">How often do we service them?</span>
        <Segmented
          label="Service frequency"
          options={SERVICE_FREQUENCY_OPTIONS}
          value={selection.serviceFrequency}
          onChange={(next) => onPatch({ serviceFrequency: next })}
          stack
        />
        <p className="fh-hint">
          Once weekly is right for a crew of ten or fewer per unit. Go twice weekly above that, or
          any time the site has no water and the units are getting hard use — it is{' '}
          {money(SECOND_VISIT_PER_UNIT_MONTH)} per unit per month
          {unitCount > 0
            ? ', which on ' + plural(unitCount, 'unit', 'units') + ' is ' + money(Math.round(SECOND_VISIT_PER_UNIT_MONTH * monthsFactor) * unitCount) + ' across the term.'
            : '.'}
        </p>
      </div>

      <div className="fh-note">
        <span className="fh-note__title">No seasonal premium here</span>
        <div className="fh-note__body">
          <p>
            Event trailers carry +20% from May through October, and we put it on its own line so you
            can see it. Jobsite units do not carry it at all, in any month. A crew does not choose
            September, and charging them for it would be a fee dressed up as a season.
          </p>
          {twiceWeekly && (
            <p>
              Twice-weekly service is on your summary as its own line, so you can drop back to weekly
              later and know exactly what comes off the bill.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function LocationStep({ selection, total, errors, showErrors, onPatch }) {
  const unitCount = unitCountOf(selection);
  const termText = plural(
    selection.term.count,
    selection.term.unit === 'weeks' ? 'week' : 'month',
    selection.term.unit === 'weeks' ? 'weeks' : 'months',
  );

  function setQuery(value) {
    const hit = lookup(value);
    onPatch({
      location: hit
        ? { query: value, name: hit.name, county: hit.county, miles: hit.miles, zone: hit.zone }
        : { query: value, name: null, county: null, miles: null, zone: null },
    });
  }

  function pickSuggestion(record) {
    const hit = lookup(record.name);
    onPatch({
      location: {
        query: record.name,
        name: hit ? hit.name : record.name,
        county: hit ? hit.county : record.county,
        miles: hit ? hit.miles : record.miles,
        zone: hit ? hit.zone : zoneFor(record.miles),
      },
    });
  }

  function setContact(field, value) {
    onPatch({ contact: Object.assign({}, selection.contact, { [field]: value }) });
  }

  return (
    <div className="fh-stack fh-stack--lg">
      <LocationPicker location={selection.location} onQuery={setQuery} onPick={pickSuggestion} />

      {selection.location.zone === 'Z5' && (
        <div className="fh-note fh-note--warn">
          <span className="fh-note__title">Zone 5 — booked, with one condition</span>
          <div className="fh-note__body">
            <p>
              {selection.location.name} is {selection.location.miles} miles out. The rate above is
              real and we hold the drop date, but a weekly service route that far needs planning
              rather than a promise, so we call you within one business day to confirm the day of the
              week we can be there. Nothing is charged before that call.
            </p>
          </div>
        </div>
      )}

      <div className="fh-note fh-note--info">
        <span className="fh-note__title">No power, no plumbing, no hookup</span>
        <div className="fh-note__body">
          <p>
            Standard units and hand-wash stations are entirely self-contained: a sealed waste tank, a
            vent stack, and a fresh-water tank on the hand-wash. Nothing to connect and nothing to
            trip over. Put them where the truck can reach on service day and where a strong wind
            cannot take them, and they need nothing else from you.
          </p>
        </div>
      </div>

      <div className="fh-stack fh-stack--sm">
        <h2 className="fh-h4">Who is on site?</h2>
        <p className="fh-hint">
          Collected once, at the end. No account, no password, and your number is not in the
          shareable link.
        </p>
        <div className="fh-field">
          <label className="fh-label" htmlFor="fh-site-name">
            Name
          </label>
          <input
            id="fh-site-name"
            className={'fh-input' + (showErrors && errors.name ? ' fh-input--invalid' : '')}
            type="text"
            autoComplete="name"
            placeholder="Marisol Vega"
            aria-invalid={showErrors && errors.name ? 'true' : undefined}
            aria-describedby={showErrors && errors.name ? 'fh-site-name-error' : undefined}
            value={selection.contact.name}
            onChange={(event) => setContact('name', event.target.value)}
          />
          {showErrors && errors.name && (
            <span className="fh-error" id="fh-site-name-error">
              {errors.name}
            </span>
          )}
        </div>
        <div className="fh-field">
          <label className="fh-label" htmlFor="fh-site-email">
            Email
          </label>
          <input
            id="fh-site-email"
            className={'fh-input' + (showErrors && errors.email ? ' fh-input--invalid' : '')}
            type="email"
            autoComplete="email"
            placeholder="marisol@example.com"
            aria-invalid={showErrors && errors.email ? 'true' : undefined}
            aria-describedby={showErrors && errors.email ? 'fh-site-email-error' : undefined}
            value={selection.contact.email}
            onChange={(event) => setContact('email', event.target.value)}
          />
          {showErrors && errors.email && (
            <span className="fh-error" id="fh-site-email-error">
              {errors.email}
            </span>
          )}
        </div>
        <div className="fh-field">
          <label className="fh-label" htmlFor="fh-site-phone">
            Phone
          </label>
          <input
            id="fh-site-phone"
            className={'fh-input' + (showErrors && errors.phone ? ' fh-input--invalid' : '')}
            type="tel"
            autoComplete="tel"
            placeholder="510 555 0117"
            aria-invalid={showErrors && errors.phone ? 'true' : undefined}
            aria-describedby={showErrors && errors.phone ? 'fh-site-phone-error' : undefined}
            value={selection.contact.phone}
            onChange={(event) => setContact('phone', event.target.value)}
          />
          {showErrors && errors.phone && (
            <span className="fh-error" id="fh-site-phone-error">
              {errors.phone}
            </span>
          )}
        </div>
      </div>

      <div className="fh-note">
        <span className="fh-note__title">What confirming does</span>
        <div className="fh-note__body">
          <p>
            It books {plural(unitCount, 'unit', 'units')} for {termText}
            {selection.start ? ' from ' + formatDateLong(selection.start) : ''} at {money(total)} for
            the term, and gives you a confirmation number to quote on the phone.
          </p>
          <p>
            No card, no deposit, no contract. This is a working prototype of a business that does not
            exist yet, so nothing is charged and no email is sent — the receipt on the next screen is
            the whole of it.
          </p>
        </div>
      </div>
    </div>
  );
}

export function BookSite({ route, navigate }) {
  const incoming = paramsToQuery(route.params);

  const [selection, setSelection] = React.useState(() =>
    normalizeSite(decodeSelection(incoming, MODE)),
  );
  const [direction, setDirection] = React.useState(1);
  const [summaryOpen, setSummaryOpen] = React.useState(false);
  const [attempted, setAttempted] = React.useState(false);
  const [view, setView] = React.useState(() => {
    const anchor = selection.start || todayISO();
    const parts = parseISO(anchor);
    return { year: parts.y, month: parts.m };
  });

  const writtenRef = React.useRef(null);
  const stepRef = React.useRef(selection.step);
  const syncingRef = React.useRef(false);
  const firstRef = React.useRef(true);
  const navRef = React.useRef(navigate);
  navRef.current = navigate;

  // Mirror the selection into the hash: replace on every edit, push on a step
  // change so the browser Back button walks the steps.
  React.useEffect(() => {
    const query = encodeSelection(selection);
    if (syncingRef.current) {
      syncingRef.current = false;
      stepRef.current = selection.step;
      writtenRef.current = query;
      return;
    }
    const push = selection.step !== stepRef.current;
    stepRef.current = selection.step;
    writtenRef.current = query;
    navRef.current(PATH, queryToParams(query), { replace: !push });
  }, [selection]);

  // Absorb hash changes we did not cause: Back, Forward, a pasted quote link.
  React.useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false;
      return;
    }
    if (canonQuery(incoming) === canonQuery(writtenRef.current)) return;
    syncingRef.current = true;
    setSelection((prev) => {
      const next = normalizeSite(decodeSelection(incoming, MODE));
      // contact is never serialized, so a hash sync must not wipe what was typed.
      next.contact = prev.contact;
      return next;
    });
  }, [incoming]);

  React.useEffect(() => {
    if (!selection.start) return;
    const parts = parseISO(selection.start);
    setView((prev) =>
      prev.year === parts.y && prev.month === parts.m ? prev : { year: parts.y, month: parts.m },
    );
  }, [selection.start]);

  const step = selection.step;
  const priced = quote(selection);
  const errors = contactErrors(selection.contact);
  const unitCount = unitCountOf(selection);

  function patch(changes) {
    setSelection((prev) => normalizeSite(Object.assign({}, prev, changes)));
  }

  function goTo(nextStep) {
    const target = Math.max(0, Math.min(LAST_STEP, nextStep));
    setDirection(target >= step ? 1 : -1);
    setAttempted(false);
    patch({ step: target });
  }

  function problemsFor(index) {
    const list = [];
    if (index === 0 && unitCount === 0) {
      list.push(
        'Add at least one unit — a standard unit is ' + money(JOBSITE_ITEMS[0].rateMonthly) + ' a month with weekly service included.',
      );
    }
    if (index === 1 && !selection.start) {
      list.push('Choose the date we deliver.');
    }
    if (index === 2) {
      if (!String(selection.location.query || '').trim()) {
        list.push('Type the city or ZIP of the site, so we can price the drive.');
      }
      if (errors.name) list.push(errors.name);
      if (errors.email) list.push(errors.email);
      if (errors.phone) list.push(errors.phone);
    }
    return list;
  }

  const problems = problemsFor(step);

  function confirmBooking() {
    const booking = saveBooking({
      mode: MODE,
      selection,
      quote: priced,
      contact: selection.contact,
    });
    const number =
      booking && booking.confirmationNumber ? booking.confirmationNumber : nextConfirmationNumber();
    navRef.current('/confirmation', { c: number });
  }

  function onPrimary() {
    if (problems.length > 0) {
      setAttempted(true);
      window.scrollTo(0, 0);
      return;
    }
    if (step < LAST_STEP) {
      goTo(step + 1);
      return;
    }
    confirmBooking();
  }

  const termText = plural(
    selection.term.count,
    selection.term.unit === 'weeks' ? 'week' : 'month',
    selection.term.unit === 'weeks' ? 'weeks' : 'months',
  );
  const meta = [
    plural(unitCount, 'unit', 'units'),
    termText,
    selection.location.name || 'location to add',
  ].join(' · ');

  const summary =
    unitCount > 0 ? (
      <SummarySheet
        lineItems={priced.lineItems}
        total={priced.total}
        meta={meta}
        notes={priced.notes}
        open={summaryOpen}
        onToggle={() => setSummaryOpen(!summaryOpen)}
        title="Order summary"
      />
    ) : null;

  const HEADINGS = [
    'What do you need on site?',
    'How long, and how often do we service it?',
    'Where is the site?',
  ];
  const SUBS = [
    'Published monthly rates. Weekly service is in the price, and you can book the whole thing right now.',
    'Four-week minimum. The rate does not move with the season.',
    'Free delivery inside ' + FREE_MILES + ' miles, then $3.50 a mile one way, charged once for the term.',
  ];
  const NOTES = [
    problems[0] || 'The total updates as you change a quantity.',
    problems[0] || 'Weeks bill as quarter-months. Nothing is rounded up on you.',
    problems[0] || 'No card and no deposit. This is a prototype and nothing is charged.',
  ];

  let body = null;
  if (step === 0) {
    body = <UnitsStep selection={selection} onPatch={patch} />;
  } else if (step === 1) {
    body = <TermStep selection={selection} view={view} onView={setView} onPatch={patch} />;
  } else {
    body = (
      <LocationStep
        selection={selection}
        total={priced.total}
        errors={errors}
        showErrors={attempted}
        onPatch={patch}
      />
    );
  }

  return (
    <Wizard
      title="Fieldhouse Site Services"
      stepLabels={STEP_LABELS}
      stepIndex={step}
      direction={direction}
      heading={HEADINGS[step]}
      sub={SUBS[step]}
      onBack={step === 0 ? null : () => goTo(step - 1)}
      primaryLabel={step === LAST_STEP ? 'Confirm booking' : 'Continue'}
      primaryDisabled={false}
      onPrimary={onPrimary}
      note={NOTES[step]}
      summary={summary}
    >
      <div className="fh-stack fh-stack--lg">
        {attempted && <ProblemNote problems={problems} />}
        {body}
      </div>
    </Wizard>
  );
}

export default BookSite;
