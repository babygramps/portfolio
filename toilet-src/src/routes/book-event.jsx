import React from 'react';
import { Wizard } from '../booking/wizard.jsx';
import { SummarySheet } from '../booking/summary-sheet.jsx';
import { Calendar } from '../booking/calendar.jsx';
import { Stepper } from '../booking/stepper.jsx';
import { Segmented } from '../booking/segmented.jsx';
import {
  recommend,
  EVENT_UNIT_IDS,
  GUESTS_PER_STATION,
  INDUSTRY_PER_STATION,
  COMPETITOR_PER_STATION,
} from '../lib/capacity.js';
import { lookup, suggest, zoneFor, mileageFee, ZONES } from '../lib/zones.js';
import { quote } from '../lib/pricing.js';
import { isAvailable, nextAvailable, dayState, isPeak } from '../lib/availability.js';
import {
  decodeSelection,
  encodeSelection,
  saveBooking,
  nextConfirmationNumber,
} from '../lib/store.js';
import {
  money,
  plural,
  monthName,
  todayISO,
  parseISO,
  addDays,
  daysBetween,
  dowOf,
  formatDate,
  formatDateLong,
  formatRange,
  isPastDate,
} from '../lib/format.js';
import { unitById } from '../data/fleet.js';
import {
  ADD_ONS,
  EVENT_DURATION_OPTIONS,
  GUEST_MIN,
  GUEST_MAX,
  GUEST_STEP,
  PEAK_UPLIFT,
  FREE_MILES,
} from '../data/rates.js';

const PATH = '/book/event';
const MODE = 'event';
const STEP_LABELS = ['Date', 'Size', 'Location', 'Finish'];
const LAST_STEP = STEP_LABELS.length - 1;
const MAX_EXTRA_DAYS = 3;
// 2000 guests × 1.25 bar × 1.3 duration = 55 stations, so the pairing path needs
// room for 55 − 8 standard units before the stepper starts fighting recommend().
const MAX_EXTRA_STANDARD = 48;
const MAX_EXTRA_HANDWASH = 8;
const MAX_MONTH = { year: 2027, month: 12 };
const SATURDAY = 6;

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

function nearestDuration(hours) {
  const wanted = Number(hours);
  let best = EVENT_DURATION_OPTIONS[0].value;
  if (!Number.isFinite(wanted)) return 6;
  for (let i = 0; i < EVENT_DURATION_OPTIONS.length; i += 1) {
    const option = EVENT_DURATION_OPTIONS[i].value;
    if (Math.abs(option - wanted) < Math.abs(best - wanted)) best = option;
  }
  return best;
}

function normalizeEvent(input) {
  const sel = Object.assign({}, input);
  sel.mode = MODE;
  sel.step = Math.max(0, Math.min(LAST_STEP, Number(sel.step) || 0));
  sel.guests = Math.max(GUEST_MIN, Math.min(GUEST_MAX, Number(sel.guests) || GUEST_MIN));
  sel.hours = nearestDuration(sel.hours);
  sel.alcohol = !!sel.alcohol;
  sel.offGrid = !!sel.offGrid;
  sel.addOns = Object.assign({ generator: false, waterBuffalo: false, attendant: false }, sel.addOns);
  sel.location = Object.assign(
    { query: '', name: null, county: null, miles: null, zone: null },
    sel.location,
  );
  sel.contact = Object.assign({ name: '', email: '', phone: '' }, sel.contact);
  sel.extraStandardUnits = Math.max(0, Math.min(MAX_EXTRA_STANDARD, Number(sel.extraStandardUnits) || 0));
  sel.extraHandwash = Math.max(0, Math.min(MAX_EXTRA_HANDWASH, Number(sel.extraHandwash) || 0));
  if (sel.start) {
    if (!sel.end || daysBetween(sel.start, sel.end) < 0) sel.end = sel.start;
    if (daysBetween(sel.start, sel.end) > MAX_EXTRA_DAYS) {
      sel.end = addDays(sel.start, MAX_EXTRA_DAYS);
    }
  } else {
    sel.end = null;
  }
  // A hand-edited link cannot skip the date: there is nothing to price without one.
  if (!sel.start) sel.step = 0;
  if (sel.step >= 1 && !sel.unitId) {
    // CONTRACT §F: the recommendation is the default, so the summary is never $0
    // once the Size step is reached. The paired standard units are part of that
    // recommendation above 480 guests (note N11), not a separate opt-in.
    const rec = recommend({
      guests: sel.guests,
      hours: sel.hours,
      alcohol: sel.alcohol,
    });
    sel.unitId = rec.unitId;
    if (!sel.extraStandardUnits) sel.extraStandardUnits = rec.extraStandardUnits;
  }
  return sel;
}

// Decode a link into a selection AND decide whether its sizing was a deliberate
// pick or just our recommendation left in place.
//
// This matters because a shared, pre-filled quote is the headline feature (spec
// §2): the same inputs must price the same whether they arrived in a link or were
// typed by hand. A unit that merely equals the recommendation for the link's own
// guest count is not a pick — it has to keep following the recommendation as the
// reader changes the numbers, or a planner's link to a 180-guest quote would
// silently under-price the couple's 600-guest version by $1,600.
function decodeEvent(query) {
  const decoded = decodeSelection(query, MODE);
  const selection = normalizeEvent(decoded);
  const rec = recommend({
    guests: selection.guests,
    hours: selection.hours,
    alcohol: selection.alcohol,
  });
  const picked = !!decoded.unitId && decoded.unitId !== rec.unitId;
  if (!picked) {
    if (selection.step >= 1) selection.unitId = rec.unitId;
    if (!decoded.extraStandardUnits) selection.extraStandardUnits = rec.extraStandardUnits;
  }
  return { selection, picked };
}

function maxExtraDaysFor(unitId, start) {
  let n = 0;
  while (n < MAX_EXTRA_DAYS && isAvailable(unitId, { start, end: addDays(start, n + 1) })) {
    n += 1;
  }
  return n;
}

function nextOpenSaturday(unitId, fromDate) {
  let day = fromDate;
  for (let i = 0; i < 420; i += 1) {
    if (dowOf(day) === SATURDAY && isAvailable(unitId, { start: day, end: day })) return day;
    day = addDays(day, 1);
  }
  return day;
}

function contactErrors(contact) {
  const errors = {};
  const name = String(contact.name || '').trim();
  const email = String(contact.email || '').trim();
  const digits = String(contact.phone || '').replace(/[^0-9]/g, '');
  if (!name) {
    errors.name = 'We put a name on the delivery paperwork, so we need one.';
  }
  if (!email) {
    errors.email = 'We need an email address for the confirmation.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    errors.email = 'That address is missing an @ or a domain. Check it and we will keep what you typed.';
  }
  if (!digits) {
    errors.phone = 'We need a phone number: the driver calls from the gate.';
  } else if (digits.length < 10) {
    errors.phone = 'That is ' + digits.length + ' digits. A US number needs ten.';
  }
  return errors;
}

function SwitchRow({ label, detail, checked, onToggle }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className="fh-switch"
      onClick={onToggle}
    >
      <span>
        <span className="fh-switch__label">{label}</span>
        <span className="fh-switch__detail">{detail}</span>
      </span>
      <span className="fh-switch__track" aria-hidden="true">
        <span className="fh-switch__knob" />
      </span>
    </button>
  );
}

function AddOnRow({ addOn, checked, onToggle }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      className="fh-addon"
      onClick={onToggle}
    >
      <span className="fh-addon__box" aria-hidden="true" />
      <span className="fh-addon__label">{addOn.label}</span>
      <span className="fh-addon__price">{money(addOn.amount)}</span>
      <span className="fh-addon__detail">{addOn.detail}</span>
    </button>
  );
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
  // A four-character prefix is a guess, not a match: "Pacific" resolves to
  // Pacifica at 27 miles, and the customer may have meant Pacific Grove at 113.
  // We take the nearest, and keep the alternatives one tap away.
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
      <label className="fh-label" htmlFor="fh-event-location">
        City or ZIP code
      </label>
      <input
        id="fh-event-location"
        className="fh-input"
        type="text"
        inputMode="text"
        autoComplete="postal-code"
        placeholder="Napa, or 94558"
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
          <span className="fh-money">
            {fee === 0
              ? 'Delivery $0'
              : 'Delivery ' + money(fee)}
          </span>
        </div>
      )}
      {matched && (
        <span className="fh-hint">
          {fee === 0
            ? 'Inside the free ' + FREE_MILES + '-mile radius, so delivery and pickup are already in the rate. The line still shows on your summary at $0, because a fee you cannot see is a fee you cannot check.'
            : excess + ' miles past the free ' + FREE_MILES + ', at $3.50 a mile one way. The return trip is already priced into the rate — charging it twice is exactly what we are not doing.'}
        </span>
      )}
      {zone && <span className="fh-hint">{zone.blurb}</span>}
      {guessed && suggestions.length > 0 && (
        <span className="fh-hint">
          We matched the nearest town starting with {trimmed}. If you meant one of these instead,
          tap it and the mileage changes with it.
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
          We do not have {trimmed} in our distance table. Keep going — we quote delivery inside the
          base radius and confirm the real mileage when we call. You will not be charged for
          something you did not see.
        </span>
      )}
      {!matched && trimmed.length < 2 && (
        <span className="fh-hint">
          Type a city or a ZIP. Around 150 Bay Area towns are in the table with real driving miles
          from our Oakland yard, so the delivery number below is the number.
        </span>
      )}
    </div>
  );
}

function AvailabilityResolver({ selection, unit, onPatch, onPickUnit }) {
  const start = selection.start;
  if (!start || !unit) return null;
  const end = selection.end || start;
  if (isAvailable(unit.id, { start, end })) return null;

  const soonest = nextAvailable(unit.id, start);
  const shortenable = daysBetween(start, end) > 0 && isAvailable(unit.id, { start, end: start });
  const freeThatDay = EVENT_UNIT_IDS.map((id) => unitById(id)).filter(
    (candidate) => candidate && candidate.id !== unit.id && isAvailable(candidate.id, { start, end }),
  );

  return (
    <div className="fh-note fh-note--warn">
      <span className="fh-note__title">That trailer is already out</span>
      <div className="fh-note__body">
        <p>
          The {unit.name} is committed for {formatRange(start, end)}. A trailer booked for a Saturday
          is off the board Friday through Sunday, because delivery and pickup use those days. That is
          a one-truck constraint and we would rather show it to you than pretend.
        </p>
        <p>Here is what is genuinely free:</p>
      </div>
      <div className="fh-alts">
        <button
          type="button"
          className="fh-alts__btn"
          onClick={() => onPatch({ start: soonest, end: soonest })}
        >
          Move to {formatDate(soonest)}
        </button>
        {shortenable && (
          <button type="button" className="fh-alts__btn" onClick={() => onPatch({ end: start })}>
            Keep {formatDate(start)}, one day only
          </button>
        )}
        {freeThatDay.map((candidate) => (
          <button
            type="button"
            className="fh-alts__btn"
            key={candidate.id}
            onClick={() => onPickUnit(candidate.id)}
          >
            {candidate.name} on {formatDate(start)}
          </button>
        ))}
      </div>
    </div>
  );
}

function DateStep({ selection, unit, view, onView, onPatch, onPickUnit }) {
  const start = selection.start;
  const end = selection.end || start;
  const today = todayISO();
  const extraDays = start ? daysBetween(start, end) : 0;
  const maxExtra = start ? maxExtraDaysFor(unit.id, start) : 0;
  const peak = isPeak(start);
  const peakAmount = Math.round(unit.rateWeekend * PEAK_UPLIFT);
  const soonest = nextAvailable(unit.id, today);
  const soonestSaturday = nextOpenSaturday(unit.id, today);

  function getDay(dateISO) {
    const state = dayState(unit.id, dateISO);
    return { available: state.available, peak: state.peak, past: isPastDate(dateISO) };
  }

  function pickDate(dateISO) {
    const keep = Math.min(extraDays, maxExtraDaysFor(unit.id, dateISO));
    onPatch({ start: dateISO, end: addDays(dateISO, Math.max(0, keep)) });
  }

  return (
    <div className="fh-stack fh-stack--lg">
      <div className="fh-stack fh-stack--sm">
        <Calendar
          year={view.year}
          month={view.month}
          selected={start}
          end={end}
          getDay={getDay}
          onSelect={pickDate}
          onMonthChange={(year, month) => onView({ year, month })}
          minMonth={{ year: parseISO(today).y, month: parseISO(today).m }}
          maxMonth={MAX_MONTH}
          showLegend
        />
        <p className="fh-hint">
          Availability is for the {unit.name}
          {selection.unitId
            ? ''
            : ', the size we recommend for ' + selection.guests + ' guests'}
          . Change the size on the next step and we re-check the date against that trailer instead.
        </p>
      </div>

      {!start && (
        <div className="fh-note">
          <span className="fh-note__title">Pick a date to continue</span>
          <div className="fh-note__body">
            <p>
              Struck-through dates are already committed. We leave them on the grid rather than
              hiding them, because the useful thing to know in July is that September Saturdays are
              mostly gone.
            </p>
          </div>
          <div className="fh-alts">
            <button
              type="button"
              className="fh-alts__btn"
              onClick={() => {
                onPatch({ start: soonest, end: soonest });
                onView({ year: parseISO(soonest).y, month: parseISO(soonest).m });
              }}
            >
              Next open day: {formatDate(soonest)}
            </button>
            <button
              type="button"
              className="fh-alts__btn"
              onClick={() => {
                onPatch({ start: soonestSaturday, end: soonestSaturday });
                onView({ year: parseISO(soonestSaturday).y, month: parseISO(soonestSaturday).m });
              }}
            >
              Next open Saturday: {formatDate(soonestSaturday)}
            </button>
          </div>
        </div>
      )}

      {start && (
        <div className="fh-stack fh-stack--sm">
          <div className="fh-row fh-row--between fh-row--wrap">
            <span className="fh-h4">{formatDateLong(start)}</span>
            {peak && <span className="fh-tag fh-tag--accent">Peak season</span>}
          </div>
          <Stepper
            id="fh-event-extra-days"
            label="Keep it an extra day?"
            unit="extra days"
            value={extraDays}
            onChange={(next) => onPatch({ end: addDays(start, next) })}
            min={0}
            max={maxExtra}
            step={1}
          />
          <p className="fh-hint">
            {maxExtra === 0
              ? 'We cannot extend this one: the ' + unit.name + ' is committed the following day. A single-day booking already covers Friday delivery through Monday pickup.'
              : 'Each extra day is 35% of the base rate and keeps the trailer, the water and the power on site for a rehearsal dinner or a Sunday brunch. We can hold this trailer for ' + plural(maxExtra, 'extra day', 'extra days') + ' on that weekend.'}
          </p>
        </div>
      )}

      {start && peak && (
        <div className="fh-note fh-note--info">
          <span className="fh-note__title">Peak season, disclosed</span>
          <div className="fh-note__body">
            <p>
              {monthName(parseISO(start).m)} is inside our May-through-October peak, so the rate and
              any extra days carry +20%. On the {unit.name} that is {money(peakAmount)} on a
              single-day booking, and it appears as its own line in your summary. Folding a seasonal
              premium into the base rate is the practice this whole site is built against.
            </p>
          </div>
        </div>
      )}

      <AvailabilityResolver
        selection={selection}
        unit={unit}
        onPatch={onPatch}
        onPickUnit={onPickUnit}
      />
    </div>
  );
}

function SizeStep({ selection, unit, rec, sizeTouched, onSizing, onPatch, onPickUnit, onUseRec }) {
  const standardRate = unitById('unit-standard').rateWeekend;
  const start = selection.start;
  const end = selection.end || start;
  const under = unit.stations < rec.stations;
  const showExtras = rec.extraStandardUnits > 0 || selection.extraStandardUnits > 0 || under;
  const recUnit = unitById(rec.unitId);

  return (
    <div className="fh-stack fh-stack--lg">
      <Stepper
        id="fh-event-guests"
        label="How many guests?"
        unit="guests"
        value={selection.guests}
        onChange={(next) => onSizing({ guests: next })}
        min={GUEST_MIN}
        max={GUEST_MAX}
        step={GUEST_STEP}
      />

      <div className="fh-stack fh-stack--sm">
        <span className="fh-label">How long are people on site?</span>
        <Segmented
          label="Event duration"
          options={EVENT_DURATION_OPTIONS}
          value={selection.hours}
          onChange={(next) => onSizing({ hours: next })}
        />
        <p className="fh-hint">
          Ceremony through last call, not the vendor day. A longer event needs more stations, not
          because more people come but because each guest goes more than once.
        </p>
      </div>

      <SwitchRow
        label="Bar service"
        detail="Beer, wine or spirits served. Adds 25% to the station count, which is the one factor everyone underestimates."
        checked={!!selection.alcohol}
        onToggle={() => onSizing({ alcohol: !selection.alcohol })}
      />

      <div className="fh-stack fh-stack--sm">
        <h2 className="fh-h4">How we get to {plural(rec.stations, 'station', 'stations')}</h2>
        <div className="fh-mathsteps">
          {rec.steps.map((step) => (
            <span className="fh-mathsteps__step" key={step}>
              {step}
            </span>
          ))}
          <div className="fh-mathsteps__result">
            <span>We recommend</span>
            <span>{plural(rec.stations, 'station', 'stations')}</span>
          </div>
        </div>
        <div className="fh-note">
          <span className="fh-note__title">Why {GUESTS_PER_STATION} guests per station</span>
          <div className="fh-note__body">
            <p>
              The common industry rule of thumb is one station per {INDUSTRY_PER_STATION} guests. At
              least one Bay Area operator advertises a six-station trailer as serving 550 guests,
              which works out to about {COMPETITOR_PER_STATION} guests per station. We size at{' '}
              {GUESTS_PER_STATION} and round up.
            </p>
            <p>
              On a 200-guest wedding that is the difference between three stations and four, and
              three stations is where the line forms in the twenty minutes after dinner. Nobody else
              publishes this arithmetic. It is on screen so you can check our number and overrule it.
            </p>
          </div>
        </div>
      </div>

      <div className="fh-stack fh-stack--sm">
        <span className="fh-label">
          Choose your unit{' '}
          <span className="fh-label__optional">
            {sizeTouched ? 'your pick' : 'defaulted to our recommendation'}
          </span>
        </span>
        <div className="fh-unitpick" role="radiogroup" aria-label="Choose your unit">
          {EVENT_UNIT_IDS.map((id) => unitById(id))
            .filter(Boolean)
            .map((candidate) => {
              const active = candidate.id === selection.unitId;
              const out = start && !isAvailable(candidate.id, { start, end });
              const badge =
                candidate.id === rec.unitId
                  ? 'Recommended'
                  : candidate.ada
                    ? 'Accessible'
                    : null;
              return (
                <button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={'fh-unitpick__opt' + (active ? ' fh-unitpick__opt--active' : '')}
                  key={candidate.id}
                  onClick={() => onPickUnit(candidate.id)}
                >
                  <span className="fh-unitpick__opt-name">{candidate.name}</span>
                  <span className="fh-unitpick__opt-rate">{money(candidate.rateWeekend)}</span>
                  <span className="fh-unitpick__opt-meta">
                    {plural(candidate.stations, 'station', 'stations')} · up to{' '}
                    {candidate.capacityGuests} guests · {candidate.dimensions.lengthFt} ×{' '}
                    {candidate.dimensions.widthFt} ft
                    {out ? ' · out on ' + formatDate(start) : ''}
                  </span>
                  {badge && <span className="fh-unitpick__badge">{badge}</span>}
                </button>
              );
            })}
        </div>
        <p className="fh-hint">
          Rates are the whole weekend: delivered Friday, serviced Saturday, picked up Monday. The ADA
          trailer is never recommended automatically, because accessibility is your call to make and
          most venues have a requirement of their own.
        </p>
        {sizeTouched && selection.unitId !== rec.unitId && (
          <div className="fh-alts">
            <button type="button" className="fh-alts__btn" onClick={onUseRec}>
              Back to our recommendation: {recUnit.name}
            </button>
          </div>
        )}
      </div>

      {under && (
        <div className="fh-note fh-note--warn">
          <span className="fh-note__title">Fewer stations than we recommend</span>
          <div className="fh-note__body">
            <p>
              You have {plural(unit.stations, 'station', 'stations')} for {selection.guests} guests
              {selection.alcohol ? ' with bar service' : ''}, and our arithmetic says{' '}
              {rec.stations}. It will work. Plenty of events run this way and nothing breaks. Expect
              a line at the peak hour, and expect it to be the twenty minutes right after dinner.
            </p>
            <p>
              We are telling you, not stopping you. If the budget is the constraint, adding standard
              units below is the cheap way to buy back capacity.
            </p>
          </div>
        </div>
      )}

      {rec.extraStandardUnits > 0 && (
        <div className="fh-note fh-note--info">
          <span className="fh-note__title">Above {unitById('trailer-8').capacityGuests} guests</span>
          <div className="fh-note__body">
            <p>
              {selection.guests} guests works out to {rec.stations} stations and the largest trailer
              we own has eight. Rather than turn the booking away, we pair the 8-Station Trailer with{' '}
              {plural(rec.extraStandardUnits, 'standard unit', 'standard units')} set at the far side
              of the site — {money(standardRate)} each for the weekend. Eight finished rooms where
              the guests are, coverage where the tents are.
            </p>
          </div>
        </div>
      )}

      {showExtras && (
        <div className="fh-stack fh-stack--sm">
          <Stepper
            id="fh-event-extra-standard"
            label="Standard units alongside"
            unit="units"
            value={selection.extraStandardUnits}
            onChange={(next) => onPatch({ extraStandardUnits: next })}
            min={0}
            max={MAX_EXTRA_STANDARD}
            step={1}
          />
          <p className="fh-hint">
            {money(standardRate)} each for the weekend. Self-contained, no power and no water needed,
            serviced before delivery. These are the answer for overflow at the far end of a field,
            not for the guests walking out of the reception.
          </p>
        </div>
      )}

      <AvailabilityResolver
        selection={selection}
        unit={unit}
        onPatch={onPatch}
        onPickUnit={onPickUnit}
      />
    </div>
  );
}

function LocationStep({ selection, onPatch }) {
  const offGrid = !!selection.offGrid;
  const generator = ADD_ONS.filter((item) => item.id === 'generator')[0];
  const waterBuffalo = ADD_ONS.filter((item) => item.id === 'waterBuffalo')[0];

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

  function toggleAddOn(id) {
    onPatch({ addOns: Object.assign({}, selection.addOns, { [id]: !selection.addOns[id] }) });
  }

  return (
    <div className="fh-stack fh-stack--lg">
      <LocationPicker location={selection.location} onQuery={setQuery} onPick={pickSuggestion} />

      {selection.location.zone === 'Z5' && (
        <div className="fh-note fh-note--warn">
          <span className="fh-note__title">Zone 5 — booked, with one condition</span>
          <div className="fh-note__body">
            <p>
              {selection.location.name} is {selection.location.miles} miles out, past the point where
              one operator can promise a Friday window sight-unseen. So the price above is real and
              the date is held on our calendar, and we call you within one business day to confirm
              the delivery window. Nothing is charged before that call.
            </p>
            <p>
              That is the whole caveat. We are not sending you to a quote form, and we are not
              pretending the distance is free.
            </p>
          </div>
        </div>
      )}

      <SwitchRow
        label="Off-grid site — no water and no power"
        detail="A pasture, a ridge-top vineyard block, a ranch with the nearest outlet in the barn."
        checked={offGrid}
        onToggle={() => onPatch({ offGrid: !offGrid })}
      />

      {offGrid && (
        <div className="fh-stack fh-stack--sm">
          <div className="fh-note fh-note--info">
            <span className="fh-note__title">What off-grid actually needs</span>
            <div className="fh-note__body">
              <p>
                A trailer is plumbing and refrigeration on wheels. It arrives with its fresh tank
                full, so water is handled for a normal event; what it cannot make for itself is
                electricity. Climate control and interior lighting need 120 V / 20 A at the trailer,
                and a ridge-top winery block or a ranch pasture is rarely within extension-cord reach
                of a working outlet.
              </p>
              <p>
                Without power the flush and the sinks still work, but the air conditioning and the
                lights do not — which on a September evening in Healdsburg is the difference between
                a nice room and a hot dark one. The generator is how we solve that. The water buffalo
                is how we refill on site when a hot day or a long bar service outruns the onboard
                tank.
              </p>
              <p>
                If the venue does have a spigot and a dedicated 20-amp circuit within about 100 feet,
                skip both. We would rather you spent the {money(generator.amount + waterBuffalo.amount)}{' '}
                on the bar.
              </p>
            </div>
          </div>
          <div className="fh-addons">
            <AddOnRow
              addOn={generator}
              checked={!!selection.addOns.generator}
              onToggle={() => toggleAddOn('generator')}
            />
            <AddOnRow
              addOn={waterBuffalo}
              checked={!!selection.addOns.waterBuffalo}
              onToggle={() => toggleAddOn('waterBuffalo')}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function FinishStep({ selection, unit, total, errors, showErrors, onPatch }) {
  const handwashRate = unitById('station-handwash').rateWeekend;
  const start = selection.start;
  const end = selection.end || start;

  function toggleAddOn(id) {
    onPatch({ addOns: Object.assign({}, selection.addOns, { [id]: !selection.addOns[id] }) });
  }

  function setContact(field, value) {
    onPatch({ contact: Object.assign({}, selection.contact, { [field]: value }) });
  }

  return (
    <div className="fh-stack fh-stack--lg">
      <div className="fh-stack fh-stack--sm">
        <span className="fh-label">Anything else on site?</span>
        <div className="fh-addons">
          {ADD_ONS.map((addOn) => (
            <AddOnRow
              addOn={addOn}
              key={addOn.id}
              checked={!!selection.addOns[addOn.id]}
              onToggle={() => toggleAddOn(addOn.id)}
            />
          ))}
        </div>
        <Stepper
          id="fh-event-handwash"
          label="Hand-wash stations"
          unit="stations"
          value={selection.extraHandwash}
          onChange={(next) => onPatch({ extraHandwash: next })}
          min={0}
          max={MAX_EXTRA_HANDWASH}
          step={1}
        />
        <p className="fh-hint">
          {money(handwashRate)} each for the weekend. Two foot-pump basins, fresh water on board, no
          power or plumbing needed. Most counties require one wherever food is served, and caterers
          ask for a second one by the prep tent.
        </p>
      </div>

      <div className="fh-stack fh-stack--sm">
        <h2 className="fh-h4">Where do we reach you?</h2>
        <p className="fh-hint">
          Three fields, once, at the end. There is no account to make and no password to forget, and
          your number is not in the shareable link.
        </p>
        <div className="fh-field">
          <label className="fh-label" htmlFor="fh-event-name">
            Name
          </label>
          <input
            id="fh-event-name"
            className={'fh-input' + (showErrors && errors.name ? ' fh-input--invalid' : '')}
            type="text"
            autoComplete="name"
            placeholder="Dana Ruiz"
            aria-invalid={showErrors && errors.name ? 'true' : undefined}
            aria-describedby={showErrors && errors.name ? 'fh-event-name-error' : undefined}
            value={selection.contact.name}
            onChange={(event) => setContact('name', event.target.value)}
          />
          {showErrors && errors.name && (
            <span className="fh-error" id="fh-event-name-error">
              {errors.name}
            </span>
          )}
        </div>
        <div className="fh-field">
          <label className="fh-label" htmlFor="fh-event-email">
            Email
          </label>
          <input
            id="fh-event-email"
            className={'fh-input' + (showErrors && errors.email ? ' fh-input--invalid' : '')}
            type="email"
            autoComplete="email"
            placeholder="dana@example.com"
            aria-invalid={showErrors && errors.email ? 'true' : undefined}
            aria-describedby={showErrors && errors.email ? 'fh-event-email-error' : undefined}
            value={selection.contact.email}
            onChange={(event) => setContact('email', event.target.value)}
          />
          {showErrors && errors.email && (
            <span className="fh-error" id="fh-event-email-error">
              {errors.email}
            </span>
          )}
        </div>
        <div className="fh-field">
          <label className="fh-label" htmlFor="fh-event-phone">
            Phone
          </label>
          <input
            id="fh-event-phone"
            className={'fh-input' + (showErrors && errors.phone ? ' fh-input--invalid' : '')}
            type="tel"
            autoComplete="tel"
            placeholder="510 555 0117"
            aria-invalid={showErrors && errors.phone ? 'true' : undefined}
            aria-describedby={showErrors && errors.phone ? 'fh-event-phone-error' : undefined}
            value={selection.contact.phone}
            onChange={(event) => setContact('phone', event.target.value)}
          />
          {showErrors && errors.phone && (
            <span className="fh-error" id="fh-event-phone-error">
              {errors.phone}
            </span>
          )}
        </div>
      </div>

      <div className="fh-note">
        <span className="fh-note__title">What confirming does</span>
        <div className="fh-note__body">
          <p>
            It puts the {unit.name} on our calendar for {formatRange(start, end)} at {money(total)},
            gives you a confirmation number, and blocks the date so nobody else sees it as open.
          </p>
          <p>
            No card, no deposit, no contract, no signature. This is a working prototype of a business
            that does not exist yet, so nothing is charged and no email leaves the building — the
            receipt on the next screen is the whole of it.
          </p>
        </div>
      </div>
    </div>
  );
}

export function BookEvent({ route, navigate }) {
  const incoming = paramsToQuery(route.params);

  const [selection, setSelection] = React.useState(() => decodeEvent(incoming).selection);
  const [direction, setDirection] = React.useState(1);
  const [summaryOpen, setSummaryOpen] = React.useState(false);
  const [attempted, setAttempted] = React.useState(false);
  // Read from the link, not from the already-defaulted selection: the default IS
  // the recommendation, and mistaking it for a customer decision freezes the
  // sizing engine for the rest of the session.
  const [sizeTouched, setSizeTouched] = React.useState(() => decodeEvent(incoming).picked);
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
    const decoded = decodeEvent(incoming);
    setSizeTouched(decoded.picked);
    setSelection((prev) => {
      const next = decoded.selection;
      // contact is never serialized, so a hash sync must not wipe what was typed.
      next.contact = prev.contact;
      return next;
    });
  }, [incoming]);

  const step = selection.step;
  const rec = recommend({
    guests: selection.guests,
    hours: selection.hours,
    alcohol: selection.alcohol,
  });
  const unit = unitById(selection.unitId) || unitById(rec.unitId);
  const priced = quote(selection);
  const errors = contactErrors(selection.contact);

  React.useEffect(() => {
    if (!selection.start) return;
    const parts = parseISO(selection.start);
    setView((prev) => (prev.year === parts.y && prev.month === parts.m ? prev : { year: parts.y, month: parts.m }));
  }, [selection.start]);

  function patch(changes) {
    setSelection((prev) => normalizeEvent(Object.assign({}, prev, changes)));
  }

  function patchSizing(changes) {
    setSelection((prev) => {
      const next = Object.assign({}, prev, changes);
      if (!sizeTouched) {
        const fresh = recommend({
          guests: next.guests,
          hours: next.hours,
          alcohol: next.alcohol,
        });
        next.unitId = fresh.unitId;
        next.extraStandardUnits = fresh.extraStandardUnits;
      }
      return normalizeEvent(next);
    });
  }

  function pickUnit(unitId) {
    setSizeTouched(true);
    patch({ unitId });
  }

  function useRecommendation() {
    setSizeTouched(false);
    patch({ unitId: rec.unitId, extraStandardUnits: rec.extraStandardUnits });
  }

  function goTo(nextStep) {
    const target = Math.max(0, Math.min(LAST_STEP, nextStep));
    setDirection(target >= step ? 1 : -1);
    setAttempted(false);
    patch({ step: target });
  }

  function problemsFor(index) {
    const list = [];
    const start = selection.start;
    const end = selection.end || start;
    if (index === 0) {
      if (!start) list.push('Pick a date on the calendar.');
      else if (!isAvailable(unit.id, { start, end })) {
        list.push(
          'The ' + unit.name + ' is already out for ' + formatRange(start, end) + '. Use one of the open options below.',
        );
      }
    }
    if (index === 1) {
      if (start && !isAvailable(unit.id, { start, end })) {
        list.push(
          'The ' + unit.name + ' is already out for ' + formatRange(start, end) + '. Pick another unit or move the date.',
        );
      }
    }
    if (index === 2) {
      if (!String(selection.location.query || '').trim()) {
        list.push('Type the city or ZIP where we are delivering, so we can price the drive.');
      }
    }
    if (index === 3) {
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

  const metaParts = [];
  metaParts.push(plural(unit.stations, 'station', 'stations'));
  metaParts.push(selection.start ? formatRange(selection.start, selection.end) : 'date to pick');
  metaParts.push(selection.location.name || 'location to add');
  const meta = metaParts.join(' · ');

  const summary = selection.unitId ? (
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
    'When is your event?',
    'How many people are coming?',
    'Where are we delivering?',
    'Confirm your booking',
  ];
  const SUBS = [
    'One day, or hold the trailer through the weekend. Committed dates are struck through rather than hidden.',
    'We show the arithmetic, then let you overrule it.',
    'Free delivery inside ' + FREE_MILES + ' miles, then $3.50 a mile one way. No round-trip double-count.',
    'Three fields and it is booked. No account, no card, no callback required.',
  ];
  const NOTES = [
    problems[0] || 'Every number updates the moment you change something.',
    problems[0] || 'The recommendation is a default, never a gate.',
    problems[0] || 'Delivery is a line item you can see, not a fee we bury.',
    problems[0] || 'No card and no deposit. This is a prototype and nothing is charged.',
  ];

  let body = null;
  if (step === 0) {
    body = (
      <DateStep
        selection={selection}
        unit={unit}
        view={view}
        onView={setView}
        onPatch={patch}
        onPickUnit={pickUnit}
      />
    );
  } else if (step === 1) {
    body = (
      <SizeStep
        selection={selection}
        unit={unit}
        rec={rec}
        sizeTouched={sizeTouched}
        onSizing={patchSizing}
        onPatch={patch}
        onPickUnit={pickUnit}
        onUseRec={useRecommendation}
      />
    );
  } else if (step === 2) {
    body = <LocationStep selection={selection} onPatch={patch} />;
  } else {
    body = (
      <FinishStep
        selection={selection}
        unit={unit}
        total={priced.total}
        errors={errors}
        showErrors={attempted}
        onPatch={patch}
      />
    );
  }

  return (
    <Wizard
      title="Book an event"
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

export default BookEvent;
