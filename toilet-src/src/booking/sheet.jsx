// Bottom-sheet primitive. Rises from the bottom, traps Tab inside the panel,
// closes on Escape and on a scrim tap, locks the page behind it, and hands focus
// back to whatever opened it. There is no exit animation by design: when `open`
// goes false the component returns null and the sheet is gone on the next frame.
import React, { useEffect, useRef } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusableNodes(root) {
  if (!root) return [];
  const found = Array.prototype.slice.call(root.querySelectorAll(FOCUSABLE));
  return found.filter(
    (node) =>
      node.getAttribute('aria-hidden') !== 'true' &&
      node.getClientRects().length > 0
  );
}

export function Sheet({ open, title, onClose, children, footer = null }) {
  const panelRef = useRef(null);
  const returnFocusRef = useRef(null);
  // Held in a ref so an inline arrow function from the caller cannot re-run the
  // effect on every render and re-lock the body or steal focus back.
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return undefined;

    returnFocusRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const panel = panelRef.current;
    if (panel && typeof panel.focus === 'function') panel.focus();

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const root = panelRef.current;
      if (!root) return;
      const nodes = focusableNodes(root);
      if (nodes.length === 0) {
        event.preventDefault();
        if (typeof root.focus === 'function') root.focus();
        return;
      }

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      const inside = root.contains(active);

      if (event.shiftKey) {
        if (!inside || active === first || active === root) {
          event.preventDefault();
          last.focus();
        }
        return;
      }
      if (!inside || active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      const target = returnFocusRef.current;
      returnFocusRef.current = null;
      if (
        target &&
        typeof target.focus === 'function' &&
        document.contains(target)
      ) {
        target.focus();
      }
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fh-sheet">
      <div
        className="fh-sheet__scrim"
        aria-hidden="true"
        onClick={() => onClose()}
      />
      <div
        className="fh-sheet__panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={panelRef}
      >
        <div className="fh-sheet__grab" aria-hidden="true" />
        <div className="fh-sheet__head">
          <h2 className="fh-sheet__title">{title}</h2>
          <button
            type="button"
            className="fh-sheet__close"
            aria-label="Close"
            onClick={() => onClose()}
          />
        </div>
        <div className="fh-sheet__body">{children}</div>
        {footer && <div className="fh-sheet__foot">{footer}</div>}
      </div>
    </div>
  );
}

export default Sheet;
