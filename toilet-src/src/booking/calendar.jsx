// Month grid with real availability on it. Two rules drive the whole component:
//
// 1. Dates that are already taken are struck through and disabled, never hidden.
//    Seeing that most peak Saturdays are gone is the point.
// 2. Peak-season dates carry a dot, and tapping one discloses the premium in
//    words underneath the grid rather than leaving it to be found in the total.
//
// Navigation is by swipe, by the two chevron buttons, and by keyboard: arrows
// move a day at a time (or a week, vertically) and roll into the next month at
// the edges, Home and End jump to the first and last bookable day of the month,
// Page Up and Page Down change month. Only bookable days can hold focus, because
// CONTRACT.md §C.1 renders the rest as `disabled` buttons.
//
// One deviation worth naming: the required DOM has no row containers between
// `.fh-cal__grid` and the 42 cells, and no stylesheet class sets
// `display: contents`, so a role="grid"/row/gridcell structure is not
// expressible here. The grid is a labelled group with a roving tab stop instead,
// and every day button carries its full date in `aria-label`.
import React, { useEffect, useId, useRef, useState } from 'react';
import {
  DOW_ABBR,
  addDays,
  formatDate,
  formatDateLong,
  monthGrid,
  monthName,
  parseISO,
  shiftMonth,
  toISO,
  todayISO,
} from '../lib/format.js';
import { PEAK_UPLIFT } from '../data/rates.js';

const NAV_KEYS = [
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'PageUp',
  'PageDown',
];

const SWIPE_MIN_PX = 56;

function buildMonth(year, month, getDay) {
  const cells = monthGrid(year, month).map((cell) => {
    if (!cell.date) {
      return {
        date: null,
        available: false,
        peak: false,
        past: false,
        selectable: false,
      };
    }
    const state = getDay(cell.date) || {};
    const available = state.available !== false;
    const past = state.past === true;
    return {
      date: cell.date,
      available,
      peak: state.peak === true,
      past,
      selectable: available && !past,
    };
  });
  const selectable = cells
    .filter((cell) => cell.selectable)
    .map((cell) => cell.date);
  return { cells, selectable };
}

function firstOnOrAfter(list, date) {
  for (let i = 0; i < list.length; i += 1) {
    if (list[i] >= date) return list[i];
  }
  return null;
}

function lastOnOrBefore(list, date) {
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (list[i] <= date) return list[i];
  }
  return null;
}

export function Calendar({
  year,
  month,
  selected,
  end,
  getDay,
  onSelect,
  onMonthChange,
  minMonth,
  maxMonth,
  showLegend = true,
}) {
  const [cursor, setCursor] = useState(null);
  const monthLabelId = useId();
  const dayRefs = useRef({});
  const focusRef = useRef(null);
  const pendingRef = useRef(null);
  const touchRef = useRef(null);
  const getDayRef = useRef(getDay);

  // Declared first so the month effect below always reads this render's getDay.
  useEffect(() => {
    getDayRef.current = getDay;
  });

  // A month arrived because a key ran off the edge of the last one. Land on the
  // day the keystroke was reaching for if it is bookable, otherwise on the first
  // or last bookable day of the new month, and take focus with it.
  useEffect(() => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (!pending) return;
    const list = buildMonth(year, month, getDayRef.current).selectable;
    if (list.length === 0) return;
    let target = null;
    if (pending.prefer && list.indexOf(pending.prefer) !== -1) {
      target = pending.prefer;
    } else {
      target = pending.land === 'last' ? list[list.length - 1] : list[0];
    }
    setCursor(target);
    focusRef.current = target;
  }, [year, month]);

  // Runs after every commit; a no-op unless a keystroke asked for a day.
  useEffect(() => {
    const wanted = focusRef.current;
    if (!wanted) return;
    focusRef.current = null;
    const node = dayRefs.current[wanted];
    if (node && typeof node.focus === 'function') node.focus();
  });

  const { cells, selectable } = buildMonth(year, month, getDay);
  const today = todayISO();

  // The roving tab stop. A cursor left behind in a month we have navigated away
  // from is simply not in this month's list, so it falls back on its own.
  let preferred = null;
  if (selected && selectable.indexOf(selected) !== -1) preferred = selected;
  else if (end && selectable.indexOf(end) !== -1) preferred = end;
  else if (selectable.length > 0) preferred = selectable[0];
  const activeDate =
    cursor && selectable.indexOf(cursor) !== -1 ? cursor : preferred;

  const stamp = year * 12 + month;
  const canPrev = !minMonth || stamp > minMonth.year * 12 + minMonth.month;
  const canNext = !maxMonth || stamp < maxMonth.year * 12 + maxMonth.month;
  const prevMonth = shiftMonth(year, month, -1);
  const nextMonth = shiftMonth(year, month, 1);

  function changeMonth(delta) {
    pendingRef.current = null;
    if (delta < 0 && !canPrev) return;
    if (delta > 0 && !canNext) return;
    const next = shiftMonth(year, month, delta);
    onMonthChange(next.year, next.month);
  }

  function crossMonth(delta, land, prefer) {
    if (delta < 0 && !canPrev) return;
    if (delta > 0 && !canNext) return;
    pendingRef.current = { land, prefer: prefer || null };
    const next = shiftMonth(year, month, delta);
    onMonthChange(next.year, next.month);
  }

  function moveTo(date) {
    setCursor(date);
    focusRef.current = date;
  }

  // Same day number, one month over — an out-of-range day like a 31st in
  // September produces a date that is simply not in the month's list, and the
  // first bookable day is used instead.
  function sameDayNextMonth(delta) {
    if (!activeDate) return null;
    const target = shiftMonth(year, month, delta);
    return toISO(target.year, target.month, parseISO(activeDate).d);
  }

  function handleGridKeyDown(event) {
    if (NAV_KEYS.indexOf(event.key) === -1) return;
    event.preventDefault();

    if (event.key === 'PageUp') {
      crossMonth(-1, 'first', sameDayNextMonth(-1));
      return;
    }
    if (event.key === 'PageDown') {
      crossMonth(1, 'first', sameDayNextMonth(1));
      return;
    }

    const back = event.key === 'ArrowLeft' || event.key === 'ArrowUp';

    if (selectable.length === 0) {
      crossMonth(back ? -1 : 1, back ? 'last' : 'first', null);
      return;
    }
    if (event.key === 'Home') {
      moveTo(selectable[0]);
      return;
    }
    if (event.key === 'End') {
      moveTo(selectable[selectable.length - 1]);
      return;
    }

    const index = activeDate ? selectable.indexOf(activeDate) : -1;
    if (index === -1) {
      moveTo(back ? selectable[selectable.length - 1] : selectable[0]);
      return;
    }

    if (event.key === 'ArrowLeft') {
      if (index > 0) moveTo(selectable[index - 1]);
      else crossMonth(-1, 'last', addDays(activeDate, -1));
      return;
    }
    if (event.key === 'ArrowRight') {
      if (index < selectable.length - 1) moveTo(selectable[index + 1]);
      else crossMonth(1, 'first', addDays(activeDate, 1));
      return;
    }

    const target = addDays(activeDate, back ? -7 : 7);
    const landing = back
      ? lastOnOrBefore(selectable, target)
      : firstOnOrAfter(selectable, target);
    if (landing && landing !== activeDate) moveTo(landing);
    else crossMonth(back ? -1 : 1, back ? 'last' : 'first', target);
  }

  function handleTouchStart(event) {
    const touch = event.touches && event.touches[0];
    touchRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  }

  function handleTouchEnd(event) {
    const start = touchRef.current;
    touchRef.current = null;
    const touch = event.changedTouches && event.changedTouches[0];
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < SWIPE_MIN_PX) return;
    if (Math.abs(dx) <= Math.abs(dy) * 1.5) return;
    changeMonth(dx < 0 ? 1 : -1);
  }

  const selectedState = selected ? getDay(selected) : null;
  const peakDisclosed = !!(selectedState && selectedState.peak);
  const peakPct = Math.round(PEAK_UPLIFT * 100);

  return (
    <div className="fh-stack">
      <div className="fh-cal">
        <div className="fh-cal__head">
          <h2
            className="fh-cal__month"
            id={monthLabelId}
            aria-live="polite"
          >{`${monthName(month)} ${year}`}</h2>
          <div className="fh-cal__nav">
            <button
              type="button"
              className="fh-cal__navbtn"
              disabled={!canPrev}
              aria-label={`Previous month, ${monthName(prevMonth.month)} ${prevMonth.year}`}
              onClick={() => changeMonth(-1)}
            >
              <span className="fh-chev fh-chev--left" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="fh-cal__navbtn"
              disabled={!canNext}
              aria-label={`Next month, ${monthName(nextMonth.month)} ${nextMonth.year}`}
              onClick={() => changeMonth(1)}
            >
              <span className="fh-chev fh-chev--right" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="fh-cal__dows" aria-hidden="true">
          {DOW_ABBR.map((dow) => (
            <span className="fh-cal__dow" key={dow}>
              {dow}
            </span>
          ))}
        </div>

        <div
          className="fh-cal__grid"
          role="group"
          aria-labelledby={monthLabelId}
          onKeyDown={handleGridKeyDown}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {cells.map((cell, i) => {
            if (!cell.date) {
              return (
                <div className="fh-cal__cell" key={`blank-${i}`}>
                  <button
                    type="button"
                    className="fh-cal__day fh-cal__day--blank"
                    disabled
                    tabIndex={-1}
                    aria-hidden="true"
                  >
                    <span className="fh-cal__daynum" />
                    <span className="fh-cal__peakdot" aria-hidden="true" />
                  </button>
                </div>
              );
            }

            const date = cell.date;
            const isSelected = date === selected || (!!end && date === end);
            const inRange =
              !!selected && !!end && date > selected && date < end;

            let dayClass = 'fh-cal__day';
            if (cell.past) dayClass += ' fh-cal__day--past';
            if (!cell.available) dayClass += ' fh-cal__day--unavailable';
            if (cell.peak) dayClass += ' fh-cal__day--peak';
            if (inRange) dayClass += ' fh-cal__day--in-range';
            if (isSelected) dayClass += ' fh-cal__day--selected';
            if (date === today) dayClass += ' fh-cal__day--today';

            let ariaLabel = formatDateLong(date);
            if (!cell.available) ariaLabel += ' — unavailable';
            if (cell.peak) ariaLabel += ' — peak season';

            return (
              <div className="fh-cal__cell" key={date}>
                <button
                  type="button"
                  className={dayClass}
                  disabled={!cell.selectable}
                  tabIndex={date === activeDate ? 0 : -1}
                  aria-label={ariaLabel}
                  aria-pressed={isSelected}
                  ref={(node) => {
                    dayRefs.current[date] = node;
                  }}
                  onClick={() => {
                    setCursor(date);
                    onSelect(date);
                  }}
                >
                  <span className="fh-cal__daynum">{parseISO(date).d}</span>
                  <span className="fh-cal__peakdot" aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>

        {showLegend && (
          <ul className="fh-cal__legend">
            <li className="fh-cal__legend-item">
              <span
                className="fh-cal__swatch fh-cal__swatch--selected"
                aria-hidden="true"
              />
              Selected
            </li>
            <li className="fh-cal__legend-item">
              <span
                className="fh-cal__swatch fh-cal__swatch--peak"
                aria-hidden="true"
              />
              {`Peak season (+${peakPct}%)`}
            </li>
            <li className="fh-cal__legend-item">
              <span
                className="fh-cal__swatch fh-cal__swatch--unavailable"
                aria-hidden="true"
              />
              Unavailable
            </li>
          </ul>
        )}
      </div>

      {peakDisclosed && (
        <div className="fh-note fh-note--warn">
          <span className="fh-note__title">Peak season</span>
          <div className="fh-note__body">
            {`${formatDate(selected)} falls in peak season, May through October. That adds ${peakPct}% to the rate and to any extra days. It appears as its own line in your summary, never folded into the rate.`}
          </div>
        </div>
      )}
    </div>
  );
}

export default Calendar;
