// The shell: skip link, header, nav, route switch, footer. It holds no booking state —
// the wizards own theirs, and the URL owns the rest.
//
// The wordmark is type and nothing else. There is no logo image and no mark: a serif
// "Fieldhouse" against a small monospace "Restroom Co." is the whole identity, which
// costs zero bytes of image, scales to any size, and reads as a company rather than as
// a startup that bought a logo before it bought a trailer.
import React from 'react';
import { buildHash } from './lib/store.js';
import { Home } from './routes/home.jsx';
import { Fleet } from './routes/fleet.jsx';
import { Pricing } from './routes/pricing.jsx';
import { ServiceArea } from './routes/service-area.jsx';
import { Faq } from './routes/faq.jsx';
import { About } from './routes/about.jsx';
import { BookEvent } from './routes/book-event.jsx';
import { BookSite } from './routes/book-site.jsx';
import { Confirmation } from './routes/confirmation.jsx';

const NAV_LINKS = [
  { path: '/fleet', label: 'Fleet' },
  { path: '/pricing', label: 'Pricing' },
  { path: '/service-area', label: 'Service area' },
  { path: '/faq', label: 'FAQ' },
  { path: '/about', label: 'About' },
];

const FOOTER_COLS = [
  {
    heading: 'Book',
    links: [
      { path: '/book/event', label: 'Book an event' },
      { path: '/book/site', label: 'Book jobsite units' },
      { path: '/pricing', label: 'Rate card' },
    ],
  },
  {
    heading: 'Equipment',
    links: [
      { path: '/fleet', label: 'The whole fleet' },
      { path: '/fleet/trailer-3', label: '3-station trailer' },
      { path: '/fleet/trailer-ada', label: 'ADA trailer' },
      { path: '/fleet/unit-standard', label: 'Standard unit' },
    ],
  },
  {
    heading: 'Where we go',
    links: [
      { path: '/service-area', label: 'Service area and zones' },
      { path: '/faq', label: 'Off-grid, power and water' },
    ],
  },
  {
    heading: 'Fieldhouse',
    links: [
      { path: '/about', label: 'Who you are calling' },
      { path: '/faq', label: 'Common questions' },
    ],
  },
];

// A real href, so the link is copyable, hoverable and cmd-clickable, plus a click
// handler so navigate() can reset the scroll position on the way to the new route.
// Modified clicks and middle clicks fall through to the browser untouched.
function linkProps(navigate, path, params = {}) {
  return {
    href: buildHash(path, params),
    onClick(event) {
      if (event.defaultPrevented) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      event.preventDefault();
      navigate(path, params);
    },
  };
}

// Prefix match, so /fleet/trailer-4 still lights up Fleet.
function isActive(currentPath, linkPath) {
  return currentPath === linkPath || currentPath.indexOf(`${linkPath}/`) === 0;
}

// The route table. Returns null for anything unrecognised, which is what triggers the
// fall back to home — a deep link that has rotted must land somewhere real, never on a
// blank page.
function viewFor(route) {
  const seg = route.segments;

  if (seg.length === 0) return Home;

  // Both #/fleet and #/fleet/<unitId> are the same component; an unknown unit id is
  // the route component's problem, not the router's, and it renders the list with a
  // note rather than failing.
  if (seg[0] === 'fleet' && seg.length <= 2) return Fleet;

  if (seg.length === 1) {
    if (seg[0] === 'pricing') return Pricing;
    if (seg[0] === 'service-area') return ServiceArea;
    if (seg[0] === 'faq') return Faq;
    if (seg[0] === 'about') return About;
    if (seg[0] === 'confirmation') return Confirmation;
  }

  if (seg.length === 2 && seg[0] === 'book') {
    if (seg[1] === 'event') return BookEvent;
    if (seg[1] === 'site') return BookSite;
  }

  return null;
}

export function App({ route, navigate }) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const mainRef = React.useRef(null);

  const matched = viewFor(route);
  const View = matched || Home;

  // A route we do not have: show home and correct the address bar once, so the URL
  // matches what is on screen and a reload lands in the same place.
  React.useEffect(() => {
    if (!matched) navigate('/');
  }, [matched, navigate]);

  // Any navigation closes the mobile drawer. Without this, tapping a link leaves the
  // drawer sitting open over the page it just opened.
  React.useEffect(() => {
    setMenuOpen(false);
  }, [route.path]);

  // The skip link is a button rather than an <a href="#main">, because in a
  // hash-routed app that href *is* a route change: it would rewrite the hash to
  // '#main', which is not a route, and bounce the customer to the homepage. Moving
  // focus directly does the same job with none of that.
  function skipToMain() {
    const el = mainRef.current;
    if (el) {
      el.focus();
      el.scrollIntoView();
    }
  }

  return (
    <div className="fh-app">
      <button type="button" className="fh-skip-link" onClick={skipToMain}>
        Skip to content
      </button>

      <header className="fh-header">
        <div className="fh-container">
          <div className="fh-header__inner">
            <a className="fh-wordmark" {...linkProps(navigate, '/')}>
              <span className="fh-wordmark__text">Fieldhouse</span>
              <span className="fh-wordmark__suffix">Restroom Co.</span>
            </a>

            <nav className="fh-nav" aria-label="Main">
              {NAV_LINKS.map((link) => (
                <a
                  className={
                    'fh-nav__link' + (isActive(route.path, link.path) ? ' fh-nav__link--active' : '')
                  }
                  aria-current={isActive(route.path, link.path) ? 'page' : undefined}
                  key={link.path}
                  {...linkProps(navigate, link.path)}
                >
                  {link.label}
                </a>
              ))}
              <a
                className="fh-btn fh-btn--primary fh-btn--sm"
                {...linkProps(navigate, '/book/event')}
              >
                Book an event
              </a>
            </nav>

            <button
              type="button"
              className="fh-nav-toggle"
              aria-expanded={menuOpen}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="fh-nav-drawer">
            <div className="fh-container">
              <nav aria-label="Pages">
                {NAV_LINKS.map((link) => (
                  <a
                    className={
                      'fh-nav__link' +
                      (isActive(route.path, link.path) ? ' fh-nav__link--active' : '')
                    }
                    aria-current={isActive(route.path, link.path) ? 'page' : undefined}
                    key={link.path}
                    {...linkProps(navigate, link.path)}
                  >
                    {link.label}
                  </a>
                ))}
              </nav>
              <div className="fh-stack fh-stack--sm">
                <a
                  className="fh-btn fh-btn--primary fh-btn--block"
                  {...linkProps(navigate, '/book/event')}
                >
                  Book an event
                </a>
                <a
                  className="fh-btn fh-btn--secondary fh-btn--block"
                  {...linkProps(navigate, '/book/site')}
                >
                  Book jobsite units
                </a>
              </div>
            </div>
          </div>
        )}
      </header>

      <main id="main" className="fh-main" ref={mainRef} tabIndex={-1}>
        <View route={route} navigate={navigate} />
      </main>

      <footer className="fh-footer">
        <div className="fh-container">
          <div className="fh-footer__cols">
            <div className="fh-footer__col">
              <span className="fh-wordmark__text">Fieldhouse</span>
              <p className="fh-fine">
                Restroom trailers and jobsite units out of a yard in Oakland, priced on the
                page and booked online. Two registers, one operator: Fieldhouse for events,
                Fieldhouse Site Services for the monthly side.
              </p>
            </div>

            {FOOTER_COLS.map((col) => (
              <div className="fh-footer__col" key={col.heading}>
                <span className="fh-eyebrow">{col.heading}</span>
                {col.links.map((link) => (
                  <a key={link.label + link.path} {...linkProps(navigate, link.path)}>
                    {link.label}
                  </a>
                ))}
              </div>
            ))}
          </div>

          <p className="fh-footer__note">
            Fieldhouse Restroom Co. is a working prototype of a business that does not exist
            yet. Bookings made here are not real: nothing is charged, no email or text is
            sent, no contract is created, and there are no trailers in a yard. Every price,
            every capacity figure and every availability check on this site is computed in
            your browser, which is why it answers instantly.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
