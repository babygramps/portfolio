// Segmented control for small option sets — four durations, two term units — in
// place of a dropdown. Behaves as a real radiogroup: one tab stop for the whole
// group, arrow keys move and select, Home and End jump to the ends.
import React, { useRef } from 'react';

export function Segmented({ label, options, value, onChange, stack = false }) {
  const buttonsRef = useRef([]);
  const selectedIndex = options.findIndex((opt) => opt.value === value);
  const tabbableIndex = selectedIndex === -1 ? 0 : selectedIndex;

  function select(index) {
    const option = options[index];
    if (!option) return;
    const node = buttonsRef.current[index];
    if (node && typeof node.focus === 'function') node.focus();
    if (option.value !== value) onChange(option.value);
  }

  function handleKeyDown(event, index) {
    const last = options.length - 1;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      select(index === last ? 0 : index + 1);
      return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      select(index === 0 ? last : index - 1);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      select(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      select(last);
    }
  }

  return (
    <div
      className={'fh-seg' + (stack ? ' fh-seg--stack' : '')}
      role="radiogroup"
      aria-label={label}
    >
      {options.map((option, index) => {
        const active = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={index === tabbableIndex ? 0 : -1}
            className={'fh-seg__opt' + (active ? ' fh-seg__opt--active' : '')}
            ref={(node) => {
              buttonsRef.current[index] = node;
            }}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            <span>{option.label}</span>
            {option.detail && (
              <span className="fh-seg__detail">{option.detail}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default Segmented;
