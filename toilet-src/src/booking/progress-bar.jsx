// A slim filling bar, never numbered stepper dots: dots read as bureaucracy, a
// bar that fills reads as momentum. The scaleX transform is one of the two
// inline styles sanctioned by CONTRACT.md §0.4.
import React from 'react';

export function ProgressBar({ value, max, label }) {
  const ratio = max > 0 ? value / max : 0;
  const filled = Math.max(0, Math.min(1, ratio));

  return (
    <div className="fh-progress">
      <div
        className="fh-progress__track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={label}
      >
        <span
          className="fh-progress__fill"
          style={{ transform: `scaleX(${filled})` }}
        />
      </div>
      <span className="fh-progress__label">{label}</span>
    </div>
  );
}

export default ProgressBar;
