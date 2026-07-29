import React from 'react';
import { FLEET, unitById } from '../data/fleet.js';
import { GUESTS_PER_STATION, COMPETITOR_PER_STATION } from '../lib/capacity.js';
import { FREE_MILES } from '../data/rates.js';
import { money } from '../lib/format.js';
import { buildHash } from '../lib/store.js';

// Local link helper: a real href so the link is copyable and cmd-clickable, plus a
// click handler so navigate() can reset scroll on the way to the new route.
function linkProps(navigate, path, params = {}) {
  return {
    href: buildHash(path, params),
    onClick(event) {
      if (event.defaultPrevented) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      navigate(path, params);
    },
  };
}

function num(value) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Reserved fictional range, on purpose: nothing rings yet, and the page says so
// rather than printing a number that belongs to somebody else.
const PHONE_DISPLAY = '(510) 555-0117';
const PHONE_TEL = '+15105550117';

export function About({ navigate }) {
  const trailer4 = unitById('trailer-4');
  const trailer8 = unitById('trailer-8');
  const standard = unitById('unit-standard');
  const trailerCount = FLEET.filter((unit) => unit.kind === 'trailer').length;

  return (
    <div className="fh-page">
      <div className="fh-container">
        <header className="fh-page__head">
          <span className="fh-eyebrow fh-eyebrow--accent">About</span>
          <h1 className="fh-display">One operator, named, who answers the phone</h1>
          <p className="fh-lede">
            The single thing this business is built around is that you can find out who is
            responsible for your Saturday, and reach him, without going through a queue. So
            here he is, along with an honest account of what does and does not exist yet.
          </p>
        </header>

        <section className="fh-section fh-section--first">
          <div className="fh-row fh-row--top fh-row--wrap">
            <div className="fh-about__portrait" aria-hidden="true">
              RR
            </div>
            <div className="fh-stack">
              <div>
                <h2 className="fh-h2">Rick Rothbart</h2>
                <p className="fh-text-muted">
                  Mechanical and thermal engineer. Fieldhouse Restroom Co., Oakland,
                  California.
                </p>
              </div>
              <dl className="fh-kv">
                <dt className="fh-kv__k">Based</dt>
                <dd className="fh-kv__v">Oakland — the yard everything is measured from</dd>
                <dt className="fh-kv__k">Trained as</dt>
                <dd className="fh-kv__v">
                  Mechanical engineer: heat transfer, fluids, off-grid water and power
                </dd>
                <dt className="fh-kv__k">Answers the phone</dt>
                <dd className="fh-kv__v">Rick. There is nobody else to be transferred to</dd>
                <dt className="fh-kv__k">Fleet</dt>
                <dd className="fh-kv__v">
                  {trailerCount} trailers, the standard unit, the hand-wash station
                </dd>
              </dl>
            </div>
          </div>
        </section>

        <section className="fh-section">
          <div className="fh-section__head">
            <span className="fh-eyebrow fh-eyebrow--accent">Why this exists</span>
            <h2 className="fh-h2">
              You can book a flight in ninety seconds. A restroom trailer takes three days and
              a phone call.
            </h2>
          </div>
          <div className="fh-prose">
            <p>
              I went looking for what it costs to put a decent restroom trailer on a ranch in
              Sonoma, and I could not find out. Every operator I checked hid the number behind
              a form, and the forms wanted the date, the headcount, the venue and my phone
              number before they would tell me anything at all. The pages that did publish
              prices were aggregators who do not own a single trailer.
            </p>
            <p>
              At the wedding end that friction is annoying. At the low end it is absurd: you
              should not need a phone call and a callback to rent a{' '}
              {money(standard.rateMonthly)}-a-month jobsite unit. So: a business that publishes
              its rates and lets people book. Everything else here — the drawings, the printed
              arithmetic, the map with its awkward Zone 5 caveat — is downstream of deciding to
              tell you things instead of collecting your details first.
            </p>
          </div>
        </section>

        <section className="fh-section">
          <div className="fh-section__head">
            <span className="fh-eyebrow fh-eyebrow--accent">The engineering</span>
            <h2 className="fh-h2">What an engineer actually brings to a restroom trailer</h2>
            <p className="fh-lede">
              Not much, if you only rent them out in cities. Quite a lot, if the site has no
              water, no power and a driveway that was not built for a truck — which describes
              most of the venues worth working at.
            </p>
          </div>
          <div className="fh-grid-2">
            <div className="fh-stack fh-stack--lg">
              <div>
                <h3 className="fh-h3">Water and waste as a budget</h3>
                <p className="fh-prose">
                  A trailer is a tank problem wearing a trailer. Fresh water in, waste water
                  out, and a fixed amount of each. Work out the flushes per guest, the sink
                  draw, the length of the evening, and you get a number — which is why our
                  sizing is one station per {GUESTS_PER_STATION} guests rather than the{' '}
                  {COMPETITOR_PER_STATION} per station one operator advertises. Same
                  equipment, different arithmetic, and only one of the two is printed where
                  you can check it. Demand is spiky, too: guests do not go at an even rate
                  across six hours, they go in the fifteen minutes after the toast and again
                  when the band takes a break. A capacity number built on the average is built
                  on the wrong hour.
                </p>
              </div>
              <div>
                <h3 className="fh-h3">Power, sized properly</h3>
                <p className="fh-prose">
                  Air conditioning on a 20-amp circuit is a real load, and the thing that
                  usually fails is not the generator — it is a hundred feet of thin extension
                  cord dropping enough voltage that the compressor stalls in the afternoon
                  heat. So we size the cord as well as the generator, and we tell you what the
                  trailer wants before you find out at four o&rsquo;clock.
                </p>
              </div>
              <div>
                <h3 className="fh-h3">Heat, in both directions</h3>
                <p className="fh-prose">
                  A metal box in a Healdsburg September is a solar-gain problem. The same box
                  in a January valley is a freeze problem, and what splits is the pump and the
                  supply line, not the tank. Both of those are heat-transfer arithmetic, which
                  happens to be what I do for a living. It is the reason the winter answers on
                  the{' '}
                  <a className="fh-link" {...linkProps(navigate, '/faq')}>
                    questions page
                  </a>{' '}
                  are specific rather than reassuring.
                </p>
              </div>
            </div>
            <div className="fh-stack fh-stack--lg">
              <div>
                <h3 className="fh-h3">Load, ground and levelling</h3>
                <p className="fh-prose">
                  A {trailer4.name.toLowerCase()} is {num(trailer4.weightLb)} pounds dry on two
                  axles, and the {trailer8.name.toLowerCase()} is {num(trailer8.weightLb)}.
                  That is a bearing-capacity question on wet turf, a tongue-weight question on
                  a steep driveway, and a door-swing question on anything more than about three
                  degrees off level. Blocking and mats are not an upsell, they are the job.
                </p>
              </div>
              <div>
                <h3 className="fh-h3">Drawings instead of photographs</h3>
                <p className="fh-prose">
                  Every unit on the{' '}
                  <a className="fh-link" {...linkProps(navigate, '/fleet')}>
                    fleet page
                  </a>{' '}
                  is a dimensioned plan and elevation. Partly because we do not own the fleet
                  yet and stock photography would be a lie. Mostly because a drawing is what a
                  venue&rsquo;s events director actually needs: they are deciding whether a box
                  this long fits between the caterer&rsquo;s tent and the fence.
                </p>
              </div>
              <div>
                <h3 className="fh-h3">And the honest limit</h3>
                <p className="fh-prose">
                  None of that matters if the truck is late. Engineering is not what makes a
                  restroom rental good — showing up is. A coordinator&rsquo;s real question is
                  never how many stations; it is when exactly the truck will be in the way and
                  who to call when it is. Which is why the calendar is conservative, why one
                  operator takes one long delivery a weekend, and why Zone 5 comes with a phone
                  call instead of a promise.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="fh-section">
          <div className="fh-section__head">
            <span className="fh-eyebrow fh-eyebrow--accent">Commitments</span>
            <h2 className="fh-h2">What you will get from me</h2>
          </div>
          <div className="fh-grid-2">
            <ul className="fh-list fh-list--check">
              <li>The price before you give me your name, on screen, itemised</li>
              <li>
                A date I can actually do, or the nearest one I can — never a maybe held open
                while I work out whether it is possible
              </li>
              <li>The mileage on its own line, one way, free inside {FREE_MILES} miles</li>
              <li>The arithmetic behind the number of stations, printed, so you can argue with it</li>
              <li>
                A straight no when the answer is no — said the day you ask, not the week
                before your event
              </li>
              <li>
                If a date ever has to go to another operator, you hear it from me first, with
                their name
              </li>
            </ul>
            <div className="fh-note fh-note--info">
              <span className="fh-note__title">What I am not claiming</span>
              <div className="fh-note__body">
                <p>
                  There are no awards on this page, no review count, no years-in-business
                  badge and no client list, because Fieldhouse has not earned any of those
                  yet. When it has, they will be specific and checkable.
                </p>
                <p>
                  A vendor page full of unverifiable trust signals is the same move as a
                  hidden price: it asks you to take something on faith that could simply have
                  been shown to you.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="fh-section">
          <div className="fh-section__head">
            <span className="fh-eyebrow fh-eyebrow--accent">Where this is today</span>
            <h2 className="fh-h2">A prototype, said plainly</h2>
            <p className="fh-lede">
              This site is a working demonstration of how the business would run, not the
              business running. It is the thing I would show a venue&rsquo;s events director,
              and the blueprint for the real one.
            </p>
          </div>
          <div className="fh-included">
            <div className="fh-included__col">
              <h3 className="fh-h4">Real today</h3>
              <ul className="fh-list fh-list--check">
                <li>The rates, researched against what Bay Area operators actually charge</li>
                <li>The sizing method, the capacity arithmetic and the honest comparison behind it</li>
                <li>
                  The fleet specification — dimensions, weights, tank sizes and power draw for
                  all {FLEET.length} units
                </li>
                <li>The mileage table and the zone bands, town by town</li>
                <li>The constraints: one truck, one long delivery a weekend, Zone 5 by callback</li>
                <li>The booking engine, which prices every change instantly and locally</li>
              </ul>
            </div>
            <div className="fh-included__col">
              <h3 className="fh-h4">Not yet, and needed before it is</h3>
              <ul className="fh-list fh-list--cross">
                <li>A legal entity to stand behind a contract</li>
                <li>
                  Pollution liability and commercial auto insurance, and the certificate a
                  venue will ask for
                </li>
                <li>A truck rated to tow, and a first trailer on the ground</li>
                <li>A yard with a wash pad and somewhere legal to park it all</li>
                <li>A disposal agreement with a treatment plant that will take the load</li>
                <li>
                  Payments, deposits and real confirmations — right now a booking is held in
                  your browser and nothing is sent anywhere
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className="fh-section">
          <div className="fh-grid-2">
            <div className="fh-card">
              <div className="fh-card__head">
                <h2 className="fh-h3">Getting hold of me</h2>
                <span className="fh-eyebrow">Oakland</span>
              </div>
              <div className="fh-card__body">
                <dl className="fh-kv">
                  <dt className="fh-kv__k">Phone</dt>
                  <dd className="fh-kv__v">
                    <a className="fh-link" href={`tel:${PHONE_TEL}`}>
                      {PHONE_DISPLAY}
                    </a>
                  </dd>
                  <dt className="fh-kv__k">Best route</dt>
                  <dd className="fh-kv__v">
                    The booking flow — two minutes, and it tells me everything I would have
                    asked
                  </dd>
                  <dt className="fh-kv__k">Hours</dt>
                  <dd className="fh-kv__v">
                    The app is open all night. The phone would be a person, so it would not be
                  </dd>
                </dl>
                <p className="fh-fine">
                  That number is in the 555-01 range that exists for fiction, because there is
                  nothing to ring yet. It is a placeholder in exactly the same way the fleet is
                  a drawing: a real one goes here when there is a real one to print.
                </p>
              </div>
              <div className="fh-card__foot">
                <div className="fh-row fh-row--wrap">
                  <a className="fh-btn fh-btn--primary fh-btn--sm" {...linkProps(navigate, '/book/event')}>
                    Book an event
                  </a>
                  <a className="fh-btn fh-btn--ghost fh-btn--sm" {...linkProps(navigate, '/book/site')}>
                    Book jobsite service
                  </a>
                </div>
              </div>
            </div>
            <div className="fh-stack">
              <div className="fh-prose">
                <p>
                  If you are a venue, a planner or a caterer and you want to pull this apart,
                  please do. Tell me the number that is wrong, the promise that will not
                  survive a real September, or the thing your current vendor does that this
                  would break. That feedback is worth more to me right now than a booking
                  would be.
                </p>
                <p>
                  And if you are here because a search for restroom trailer prices sent you
                  through six quote forms: sorry about those. The whole rate card is{' '}
                  <a className="fh-link" {...linkProps(navigate, '/pricing')}>
                    one page over
                  </a>
                  , no details required.
                </p>
              </div>
              <p className="fh-signature">Rick Rothbart</p>
              <p className="fh-fine">Fieldhouse Restroom Co. — Oakland, California</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default About;
