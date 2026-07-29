// Shared step chrome for both wizards. Dumb on purpose: it owns no booking
// state, only the frame — filling progress bar at the top, a back chevron in the
// step head, the step body that slides horizontally on every step change, the
// order summary, and the one full-width primary action pinned in the thumb zone.
//
// The `key={stepIndex}` on the panel is what replays the slide: remounting the
// element restarts the CSS animation, and `data-direction` picks which way it
// travels. Both degrade to an instant cut under prefers-reduced-motion.
import React, { useEffect, useRef } from 'react';
import ProgressBar from './progress-bar.jsx';

export function Wizard({
  title,
  stepLabels,
  stepIndex,
  direction,
  heading,
  sub,
  onBack,
  primaryLabel,
  primaryDisabled = false,
  onPrimary,
  note,
  summary,
  children,
}) {
  const headingRef = useRef(null);
  const lastStepRef = useRef(stepIndex);

  // On a step change, move focus to the new heading so a screen-reader user and a
  // keyboard user both land at the top of the new question instead of staying on
  // a Continue button that has just been replaced. Not on first render: nothing
  // has changed yet, and stealing focus on arrival would be rude.
  useEffect(() => {
    if (lastStepRef.current === stepIndex) return;
    lastStepRef.current = stepIndex;
    const node = headingRef.current;
    if (node && typeof node.focus === 'function') node.focus();
  }, [stepIndex]);

  const stepCount = stepLabels.length;
  const stepName = stepLabels[stepIndex] || stepLabels[stepCount - 1];

  return (
    <div
      className="fh-wizard"
      data-direction={direction === -1 ? 'back' : 'forward'}
    >
      <div className="fh-wizard__bar">
        <div className="fh-container">
          <ProgressBar
            value={stepIndex + 1}
            max={stepCount}
            label={`Step ${stepIndex + 1} of ${stepCount} · ${stepName}`}
          />
        </div>
      </div>
      <div className="fh-container">
        <div className="fh-wizard__layout">
          <div className="fh-wizard__col">
            <div className="fh-wizard__head">
              {onBack && (
                <button
                  type="button"
                  className="fh-header__back"
                  onClick={onBack}
                >
                  <span className="fh-chev fh-chev--left" aria-hidden="true" />{' '}
                  Back
                </button>
              )}
              <span className="fh-eyebrow">{title}</span>
              <h1 className="fh-wizard__title" tabIndex={-1} ref={headingRef}>
                {heading}
              </h1>
              {sub && <p className="fh-wizard__sub">{sub}</p>}
            </div>
            <div className="fh-wizard__body">
              <div className="fh-wizard__panel" key={stepIndex}>
                {children}
              </div>
            </div>
          </div>
          {summary && <aside className="fh-wizard__aside">{summary}</aside>}
          <div className="fh-actionbar">
            <div className="fh-actionbar__inner">
              <button
                type="button"
                className="fh-btn fh-btn--primary fh-btn--block"
                disabled={primaryDisabled}
                onClick={onPrimary}
              >
                {primaryLabel}
              </button>
              {note && <p className="fh-actionbar__note">{note}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Wizard;
