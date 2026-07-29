// The collapsible order summary, one component with two presentations and no
// matchMedia. Below 900px it is a single tappable line pinned above the primary
// action — total, then context — that expands into a bottom sheet with the full
// itemization. At 900px and up the stylesheet hides the trigger and the sheet and
// reveals the same panel as a sticky right-hand column, always expanded.
//
// The panel element is built once and handed to both slots. That is a
// description, not a mounted instance, so there is no duplicated state.
import React, { useEffect, useRef, useState } from 'react';
import { money } from '../lib/format.js';
import Sheet from './sheet.jsx';

export function SummarySheet({
  lineItems = [],
  total,
  meta,
  notes = [],
  open,
  onToggle,
  title = 'Order summary',
}) {
  // Every price change lifts the total for one animation frame. Nothing pends and
  // nothing spins: the number is already correct, the tick just marks that it
  // moved. The 240 ms class reset is the only timer in the app, and the
  // stylesheet flattens the animation under prefers-reduced-motion.
  const [ticking, setTicking] = useState(false);
  const seenRef = useRef(false);

  useEffect(() => {
    if (!seenRef.current) {
      seenRef.current = true;
      return undefined;
    }
    setTicking(true);
    const timer = setTimeout(() => setTicking(false), 240);
    return () => clearTimeout(timer);
  }, [total]);

  const tick = ticking ? ' is-ticking' : '';

  const panel = (
    <div className="fh-summary__panel">
      <h2 className="fh-summary__title">{title}</h2>
      <div className="fh-lineitems">
        {lineItems.map((li) => (
          <div
            className={
              'fh-lineitem' + (li.amount === 0 ? ' fh-lineitem--free' : '')
            }
            key={li.label}
          >
            <span className="fh-lineitem__label">{li.label}</span>
            <span className="fh-lineitem__amount">{money(li.amount)}</span>
            <span className="fh-lineitem__detail">{li.detail}</span>
          </div>
        ))}
        <div className="fh-lineitems__total">
          <span className="fh-lineitems__total-label">Total</span>
          <span
            className={'fh-lineitems__total-amount' + tick}
            aria-live="polite"
            aria-atomic="true"
          >
            {money(total)}
          </span>
        </div>
      </div>
      {notes.length > 0 && (
        <div className="fh-summary__notes">
          {notes.map((n) => (
            <p className="fh-summary__note" key={n}>
              {n}
            </p>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="fh-summary">
      <button
        type="button"
        className="fh-summary__trigger"
        onClick={() => onToggle()}
        aria-expanded={open}
      >
        <span className="fh-visually-hidden">{title}</span>
        <span
          className={'fh-summary__trigger-total' + tick}
          aria-live="polite"
          aria-atomic="true"
        >
          {money(total)}
        </span>
        <span className="fh-summary__trigger-meta">{meta}</span>
        <span className="fh-summary__chev" aria-hidden="true">
          <span className={'fh-chev' + (open ? ' fh-chev--up' : '')} />
        </span>
      </button>

      <div className="fh-summary__inline">{panel}</div>

      {open && (
        <Sheet open title={title} onClose={() => onToggle()}>
          {panel}
        </Sheet>
      )}
    </div>
  );
}

export default SummarySheet;
