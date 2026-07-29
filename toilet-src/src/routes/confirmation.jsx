import React from 'react';
import { findBooking, loadBookings, encodeSelection, buildHash } from '../lib/store.js';
import { money, plural, formatDateLong, formatRange } from '../lib/format.js';
import { unitById } from '../data/fleet.js';
import { JOBSITE_ITEMS } from '../data/rates.js';

function baseUrl() {
  return String(window.location.href).split('#')[0];
}

// A saved record is read back from storage, so treat its dates as untrusted rather
// than letting one malformed string blank out the whole receipt.
function longDate(date, fallback) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(date || '')) ? formatDateLong(date) : fallback;
}

function rangeText(start, end) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(start || ''))) return 'the date we confirm on the call';
  const finish = /^\d{4}-\d{2}-\d{2}$/.test(String(end || '')) ? end : start;
  return start === finish ? formatDateLong(start) : formatRange(start, finish);
}

function CopyField({ id, label, value, hint }) {
  const inputRef = React.useRef(null);
  const [state, setState] = React.useState('idle');

  function copy() {
    const el = inputRef.current;
    if (el) {
      el.focus();
      el.select();
    }
    let ok = false;
    try {
      ok = !!(document.execCommand && document.execCommand('copy'));
    } catch (err) {
      ok = false;
    }
    if (!ok && navigator.clipboard && navigator.clipboard.writeText) {
      try {
        const pending = navigator.clipboard.writeText(value);
        if (pending && typeof pending.catch === 'function') pending.catch(() => {});
        ok = true;
      } catch (err) {
        ok = false;
      }
    }
    setState(ok ? 'copied' : 'manual');
  }

  return (
    <div className="fh-field">
      <label className="fh-label" htmlFor={id}>
        {label}
      </label>
      <div className="fh-copyfield">
        <input
          id={id}
          ref={inputRef}
          className="fh-copyfield__input"
          type="text"
          readOnly
          value={value}
          onFocus={(event) => event.target.select()}
        />
        <button
          type="button"
          className="fh-btn fh-btn--secondary fh-btn--sm fh-copyfield__btn"
          onClick={copy}
        >
          {state === 'copied' ? 'Copied' : 'Copy'}
        </button>
      </div>
      <span className="fh-hint">
        {state === 'manual'
          ? 'Your browser would not let us copy it for you. The link is selected — press Cmd-C or Ctrl-C.'
          : hint}
      </span>
    </div>
  );
}

function MetaRow({ label, value }) {
  return (
    <div className="fh-kv">
      <span className="fh-kv__k">{label}</span>
      <span className="fh-kv__v">{value}</span>
    </div>
  );
}

function LineItems({ lineItems, total }) {
  return (
    <div className="fh-lineitems">
      {lineItems.map((item) => (
        <div
          className={'fh-lineitem' + (item.amount === 0 ? ' fh-lineitem--free' : '')}
          key={item.label}
        >
          <span className="fh-lineitem__label">{item.label}</span>
          <span className="fh-lineitem__amount">{money(item.amount)}</span>
          <span className="fh-lineitem__detail">{item.detail}</span>
        </div>
      ))}
      <div className="fh-lineitems__total">
        <span className="fh-lineitems__total-label">Total</span>
        <span className="fh-lineitems__total-amount">{money(total)}</span>
      </div>
    </div>
  );
}

function NotFound({ number }) {
  const saved = loadBookings();
  return (
    <div className="fh-page">
      <div className="fh-container fh-container--narrow">
        <div className="fh-stack fh-stack--lg">
          <div className="fh-page__head">
            <span className="fh-eyebrow">Confirmation</span>
            <h1 className="fh-display">
              {number ? 'We cannot find ' + number + '.' : 'That link has no booking number in it.'}
            </h1>
            <p className="fh-lede">
              Nothing is broken and nothing was lost — there is simply no booking under that number
              in this browser.
            </p>
          </div>

          <div className="fh-note fh-note--warn">
            <span className="fh-note__title">Why that happens</span>
            <div className="fh-note__body">
              <p>
                This is a prototype, so bookings are stored in the browser that made them rather than
                on a server. A confirmation number from a different device, a different browser, or a
                cleared history will not resolve here. In the real version the number would work
                anywhere, and so would a phone call.
              </p>
            </div>
          </div>

          {saved.length > 0 && (
            <div className="fh-stack fh-stack--sm">
              <h2 className="fh-h3">Bookings made in this browser</h2>
              <ul className="fh-list fh-list--rule">
                {saved.map((entry) => (
                  <li key={entry.confirmationNumber}>
                    <a className="fh-link" href={buildHash('/confirmation', { c: entry.confirmationNumber })}>
                      {entry.confirmationNumber}
                    </a>{' '}
                    — {entry.mode === 'site' ? 'jobsite units' : unitById(entry.unitId) ? unitById(entry.unitId).name : 'event booking'}
                    {entry.start ? ', ' + formatRange(entry.start, entry.end || entry.start) : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="fh-row fh-row--wrap">
            <a className="fh-btn fh-btn--primary" href="#/book/event">
              Book an event
            </a>
            <a className="fh-btn fh-btn--secondary" href="#/book/site">
              Book jobsite units
            </a>
            <a className="fh-btn fh-btn--ghost" href="#/pricing">
              See the rate card
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function eventMeta(booking, selection) {
  const unit = unitById(booking.unitId);
  const start = booking.start;
  const end = booking.end || start;
  const location = selection.location || {};
  const rows = [];
  rows.push({ label: 'Date', value: rangeText(start, end) });
  rows.push({ label: 'Unit', value: unit ? unit.name : 'Event trailer' });
  rows.push({
    label: 'Size',
    value:
      selection.guests +
      ' guests · ' +
      (unit ? plural(unit.stations, 'station', 'stations') : 'stations to confirm'),
  });
  rows.push({
    label: 'Duration',
    value: selection.hours + ' hours' + (selection.alcohol ? ', bar service' : ', no bar service'),
  });
  rows.push({
    label: 'Delivering to',
    value: location.name
      ? location.name + ' · ' + location.zone + ' · ' + location.miles + ' mi'
      : (location.query || 'Location to confirm') + ' · mileage to confirm',
  });
  rows.push({
    label: 'Booked',
    value: longDate(String(booking.createdAt || '').slice(0, 10), 'Just now'),
  });
  return rows;
}

function siteUnitsText(selection) {
  const parts = [];
  const units = selection.units || {};
  for (let i = 0; i < JOBSITE_ITEMS.length; i += 1) {
    const item = JOBSITE_ITEMS[i];
    const qty = units[item.id] || 0;
    if (qty > 0) parts.push(qty + ' × ' + item.label);
  }
  return parts.length > 0 ? parts.join(', ') : 'Units to confirm';
}

function siteTermText(selection) {
  const term = selection.term || { unit: 'months', count: 1 };
  return plural(
    term.count,
    term.unit === 'weeks' ? 'week' : 'month',
    term.unit === 'weeks' ? 'weeks' : 'months',
  );
}

function siteMeta(booking, selection) {
  const location = selection.location || {};
  const rows = [];
  rows.push({ label: 'Delivery', value: longDate(booking.start, 'Date to confirm') });
  rows.push({ label: 'Units', value: siteUnitsText(selection) });
  rows.push({ label: 'Term', value: siteTermText(selection) });
  rows.push({
    label: 'Service',
    value: selection.serviceFrequency === 'twice-weekly' ? 'Twice weekly' : 'Once weekly',
  });
  rows.push({
    label: 'Site',
    value: location.name
      ? location.name + ' · ' + location.zone + ' · ' + location.miles + ' mi'
      : (location.query || 'Location to confirm') + ' · mileage to confirm',
  });
  rows.push({
    label: 'Booked',
    value: longDate(String(booking.createdAt || '').slice(0, 10), 'Just now'),
  });
  return rows;
}

export function Confirmation({ route }) {
  const number = String((route.params && route.params.c) || '').trim();
  const booking = React.useMemo(() => (number ? findBooking(number) : null), [number]);

  if (!booking) return <NotFound number={number} />;

  const selection = booking.selection || {};
  const priced = booking.quote || { lineItems: [], subtotal: 0, total: 0, notes: [] };
  const contact = booking.contact || { name: '', email: '', phone: '' };
  const location = selection.location || {};
  const isSite = booking.mode === 'site';
  const unit = unitById(booking.unitId);
  const start = booking.start;
  const end = booking.end || start;
  const held = !!booking.holdPending;

  const rows = isSite ? siteMeta(booking, selection) : eventMeta(booking, selection);
  const receiptLink = baseUrl() + buildHash('/confirmation', { c: booking.confirmationNumber });
  const wizardPath = isSite ? '/book/site' : '/book/event';
  const encoded = encodeSelection(selection);
  const quoteLink = baseUrl() + '#' + wizardPath + (encoded ? '?' + encoded : '');

  const heading = held
    ? 'Your date is held.'
    : isSite
      ? 'Your units are scheduled.'
      : unit
        ? 'Your ' + unit.name + ' is on the calendar.'
        : 'Your booking is on the calendar.';

  const nextSteps = [];
  nextSteps.push(
    'Your confirmation number is ' +
      booking.confirmationNumber +
      '. One number gets the whole booking on the phone. There is no account and no password, which is the point.',
  );
  if (held) {
    nextSteps.push(
      'Because ' +
        (location.name || 'that address') +
        ' is ' +
        (location.miles !== null && location.miles !== undefined ? location.miles + ' miles' : 'well past 110 miles') +
        ' out, we call ' +
        (contact.phone || 'you') +
        ' within one business day to confirm the delivery window. The date is held for you until that call, and nothing is charged before it.',
    );
  } else {
    nextSteps.push(
      'We call ' +
        (contact.phone || 'you') +
        (isSite
          ? ' to confirm gate access, where the truck can turn around, and exactly where the units sit.'
          : ' the week before to settle where the trailer parks, where power comes from, and who is on site Friday.'),
    );
  }
  if (isSite) {
    nextSteps.push(
      'Delivery ' +
        longDate(start, 'on the date we confirm') +
        '. Weekly service starts the following week: pump the tank, restock paper and sanitiser, wash the interior. Nothing for your crew to do.',
    );
    nextSteps.push(
      'The term runs ' +
        siteTermText(selection) +
        '. After the four-week minimum, two weeks of notice ends it — there is no rolling contract to get out of.',
    );
  } else {
    nextSteps.push(
      'Delivery on the Friday between 8am and 2pm. We level the trailer, fill the fresh tank, test every flush and every light, and leave a card with a number that reaches a person.',
    );
    nextSteps.push(
      'Pickup Monday. There is nothing to do at the end of the night except shut the door.',
    );
  }

  return (
    <div className="fh-page">
      <div className="fh-container fh-container--narrow">
        <div className="fh-stack fh-stack--lg">
          <div className="fh-page__head">
            <span className="fh-eyebrow fh-eyebrow--accent">
              {held ? 'Held pending one call' : 'Booked'}
            </span>
            <h1 className="fh-display">{heading}</h1>
            <p className="fh-lede">
              {held
                ? 'The price below is real and the date is off the board for everyone else. One phone call finishes it.'
                : isSite
                  ? 'Booked online, at a published price, without a quote form and without waiting for anybody to call you back.'
                  : 'Booked in under two minutes at a price you could read the whole way through. That was the entire idea.'}
            </p>
          </div>

          {held && (
            <div className="fh-note fh-note--warn">
              <span className="fh-note__title">Zone 5 — the condition, stated plainly</span>
              <div className="fh-note__body">
                <p>
                  {(location.name || 'This address')} is{' '}
                  {location.miles !== null && location.miles !== undefined
                    ? location.miles + ' driving miles'
                    : 'more than 110 driving miles'}{' '}
                  from our yard. Beyond about 110 miles a single-truck operator cannot honestly
                  promise a delivery window sight-unseen, so this booking is a hold rather than a
                  confirmation: {rangeText(start, end)} is off the board for everyone else, and we
                  call you within one business day to confirm the window.
                </p>
                <p>
                  If we cannot make it work, you hear that from a person within one business day and
                  the hold is released. Nothing is charged either way. That is a caveat, not a quote
                  form.
                </p>
              </div>
            </div>
          )}

          <div className="fh-receipt">
            <div className="fh-receipt__head">
              <div>
                <span className="fh-eyebrow">Confirmation number</span>
                <div className="fh-receipt__number">{booking.confirmationNumber}</div>
              </div>
              <span className="fh-receipt__stamp">{held ? 'Date held' : 'Booked'}</span>
            </div>
            <div className="fh-receipt__body">
              <div className="fh-receipt__meta">
                {rows.map((row) => (
                  <MetaRow label={row.label} value={row.value} key={row.label} />
                ))}
              </div>

              <LineItems lineItems={priced.lineItems} total={priced.total} />

              {priced.notes && priced.notes.length > 0 && (
                <div className="fh-note">
                  <span className="fh-note__title">On the record</span>
                  <div className="fh-note__body">
                    <ul className="fh-list fh-list--dash">
                      {priced.notes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <div className="fh-receipt__next">
                <h2 className="fh-h3">What happens next</h2>
                <ol className="fh-numlist">
                  {nextSteps.map((entry) => (
                    <li className="fh-numlist__item" key={entry}>
                      {entry}
                    </li>
                  ))}
                </ol>
              </div>

              <div className="fh-receipt__share">
                <h2 className="fh-h3">Share it</h2>
                <CopyField
                  id="fh-share-receipt"
                  label="This receipt"
                  value={receiptLink}
                  hint="Opens this page again, on this device. In the real version it would be a signed link that works anywhere; in the prototype the booking lives in this browser."
                />
                <CopyField
                  id="fh-share-quote"
                  label="The same booking, pre-filled, for someone else to check"
                  value={quoteLink}
                  hint={
                    'Every choice is in the link and it works on any device — a planner can send a couple the finished quote and they can change a number and watch the total move. Your name, email and phone are deliberately not in it.'
                  }
                />
              </div>
            </div>
          </div>

          {!isSite && unit && (
            <div className="fh-note fh-note--info">
              <span className="fh-note__title">The calendar just changed</span>
              <div className="fh-note__body">
                <p>
                  {rangeText(start, end)} is now struck through for the {unit.name} everywhere on
                  this site, plus the day either side for delivery and pickup. Go back to the booking
                  calendar and you will see your own booking blocking it. That is what the ledger
                  looks like from the inside, and it is why peak Saturdays are worth taking early.
                </p>
              </div>
            </div>
          )}

          <p className="fh-fine">
            Fieldhouse Restroom Co. is a prototype of a business that does not exist yet. No payment
            was taken, no email or text was sent, no contract exists, and there are no trailers in a
            yard in Oakland. Everything above was computed in your browser, which is why it appeared
            the instant you asked for it.
          </p>

          <div className="fh-row fh-row--wrap">
            <a className="fh-btn fh-btn--secondary" href="#/fleet">
              Look at the fleet drawings
            </a>
            <a className="fh-btn fh-btn--ghost" href="#/pricing">
              The whole rate card
            </a>
            <a className="fh-btn fh-btn--ghost" href={isSite ? '#/book/event' : '#/book/site'}>
              {isSite ? 'Book an event' : 'Book jobsite units'}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Confirmation;
