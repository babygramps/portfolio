// Mount, and the whole router.
//
// Routing is by hash — `/toilet/#/fleet`, `/toilet/#/book/event` — and hand-rolled
// against the `hashchange` event. There is no router dependency, and clean paths are
// not an option here: this app is a single `index.html` on S3 behind CloudFront, and a
// request for `/toilet/fleet` misses in the bucket and is answered with the bucket's
// error document, which is the portfolio homepage, at HTTP 200. That is a broken deep
// link that looks perfectly healthy to every status check and to every crawler. The
// hash never leaves the browser, so it cannot miss.
//
// `navigate` is the only way the app changes route, and it does two things a bare
// `location.hash = …` cannot:
//
//   * `replace: true` uses history.replaceState, so the hundred keystrokes that fill in
//     a booking do not become a hundred back-button steps. replaceState does not fire
//     `hashchange`, so this component updates its own state on that path.
//   * a push scrolls to the top, because arriving on a new page already scrolled
//     halfway down is disorienting; a replace deliberately does not, because a wizard
//     editing its own URL must not yank the page while someone is typing.
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app.jsx';
import { buildHash, parseHash } from './lib/store.js';

function currentHash() {
  return typeof window === 'undefined' ? '' : String(window.location.hash || '');
}

// The hash swapped in place, leaving the path and query of the page itself alone.
function replaceHash(hash) {
  const { pathname, search } = window.location;
  try {
    window.history.replaceState(null, '', `${pathname}${search}${hash}`);
    return true;
  } catch (err) {
    // Some file:// contexts refuse replaceState. Fall back to a normal hash write,
    // which costs a history entry but keeps the app navigable.
    window.location.hash = hash;
    return false;
  }
}

function Root() {
  const [route, setRoute] = React.useState(() => parseHash(currentHash()));

  React.useEffect(() => {
    function onHashChange() {
      setRoute(parseHash(currentHash()));
    }
    window.addEventListener('hashchange', onHashChange);
    // The hash can change between the first render and this effect running — a paste
    // into the address bar, or a redirect from another sub-app. Re-read once so the
    // first paint is never a route behind.
    onHashChange();
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = React.useCallback((pathOrHash, params = {}, options = {}) => {
    const replace = !!(options && options.replace);
    const hash = buildHash(pathOrHash, params);

    if (hash === currentHash()) {
      // Already there. A push still means "the customer asked to go to this page", so
      // honour the scroll; a replace is a no-op.
      if (!replace) window.scrollTo(0, 0);
      return;
    }

    if (replace) {
      const swapped = replaceHash(hash);
      // replaceState fires no event, so tell React ourselves. The fallback path does
      // fire hashchange, and setting the same value twice is harmless.
      if (swapped) setRoute(parseHash(hash));
      return;
    }

    window.location.hash = hash;
    window.scrollTo(0, 0);
  }, []);

  return <App route={route} navigate={navigate} />;
}

const container = document.getElementById('root');
ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
