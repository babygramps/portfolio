// Quantity control. Two 44px buttons and a numeric field, because a select menu
// for "how many guests" is the slowest control ever put on a phone.
//
// Typing is allowed to pass through an out-of-range value while the field is
// focused — otherwise clearing the field and typing "2" of "250" would snap to
// the minimum and eat the rest of the keystrokes — and is clamped on blur. NaN
// never reaches onChange.
import React, { useEffect, useState } from 'react';

function clamp(n, min, max) {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

export function Stepper({
  id,
  label,
  unit,
  value,
  onChange,
  min = 0,
  max = 99,
  step = 1,
  editable = true,
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  function emit(next) {
    const clamped = clamp(next, min, max);
    if (clamped !== value) onChange(clamped);
  }

  function handleInput(event) {
    const digits = event.target.value.replace(/[^0-9]/g, '');
    setDraft(digits);
    if (digits === '') return;
    const parsed = parseInt(digits, 10);
    if (!Number.isFinite(parsed)) return;
    if (parsed < min || parsed > max) return;
    if (parsed !== value) onChange(parsed);
  }

  function handleBlur() {
    const parsed = parseInt(draft, 10);
    const next = Number.isFinite(parsed) ? clamp(parsed, min, max) : value;
    setDraft(String(next));
    if (next !== value) onChange(next);
  }

  function handleKeyDown(event) {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      emit(value + step);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      emit(value - step);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      handleBlur();
    }
  }

  const spoken = unit ? `${value} ${unit}` : String(value);

  return (
    <div className="fh-stepper__row">
      <div>
        {editable ? (
          <label className="fh-stepper__label" htmlFor={id}>
            {label}
          </label>
        ) : (
          <span className="fh-stepper__label">{label}</span>
        )}
        {unit && <span className="fh-stepper__unit">{unit}</span>}
        {/* The plus and minus buttons keep focus when they are pressed, so the new
            quantity has to be spoken from somewhere. */}
        <span className="fh-visually-hidden" aria-live="polite">
          {spoken}
        </span>
      </div>
      <div className="fh-stepper" role="group" aria-label={label}>
        <button
          type="button"
          className="fh-stepper__btn fh-stepper__btn--minus"
          aria-label="Fewer"
          disabled={value <= min}
          onClick={() => emit(value - step)}
        >
          −
        </button>
        {editable ? (
          <input
            id={id}
            className="fh-stepper__input"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            value={draft}
            onChange={handleInput}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
          />
        ) : (
          <span className="fh-stepper__value" id={id}>
            {value}
          </span>
        )}
        <button
          type="button"
          className="fh-stepper__btn fh-stepper__btn--plus"
          aria-label="More"
          disabled={value >= max}
          onClick={() => emit(value + step)}
        >
          +
        </button>
      </div>
    </div>
  );
}

export default Stepper;
