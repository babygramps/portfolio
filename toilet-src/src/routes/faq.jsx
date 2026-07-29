import React from 'react';
import { FLEET, unitById } from '../data/fleet.js';
import {
  GUESTS_PER_STATION,
  ALCOHOL_FACTOR,
  INDUSTRY_PER_STATION,
  COMPETITOR_PER_STATION,
  durationFactor,
} from '../lib/capacity.js';
import { PEAK_UPLIFT, FREE_MILES, MIN_TERM_WEEKS, ADD_ONS } from '../data/rates.js';
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

function addOnById(id) {
  return ADD_ONS.find((addOn) => addOn.id === id) || { label: id, detail: '', amount: 0 };
}

// A real disclosure widget: keyboard-operable, findable by the browser's own
// in-page search, and no JavaScript state to get out of sync.
function Item({ q, startOpen = false, children }) {
  return (
    <details className="fh-faq__item" open={startOpen || undefined}>
      <summary className="fh-faq__q">{q}</summary>
      <div className="fh-faq__a">{children}</div>
    </details>
  );
}

export function Faq({ navigate }) {
  const pct = (value) => `${Math.round(value * 100)}%`;
  const trailers = FLEET.filter((unit) => unit.kind === 'trailer');
  const generator = addOnById('generator');
  const buffalo = addOnById('waterBuffalo');
  const trailer3 = unitById('trailer-3');
  const trailer4 = unitById('trailer-4');
  const trailer8 = unitById('trailer-8');
  const ada = unitById('trailer-ada');

  return (
    <div className="fh-page">
      <div className="fh-container">
        <header className="fh-page__head">
          <span className="fh-eyebrow fh-eyebrow--accent">Questions</span>
          <h1 className="fh-display">The answers that matter on a site with nothing on it</h1>
          <p className="fh-lede">
            Most of what people need to know about a restroom trailer is water, power, tanks
            and access — and most of it is normally answered on the phone by whoever picks up.
            Here it is written down, including the parts that are inconvenient for us.
          </p>
        </header>

        <section className="fh-section fh-section--first">
          <div className="fh-section__head">
            <span className="fh-eyebrow fh-eyebrow--accent">Off-grid sites</span>
            <h2 className="fh-h2">Water, power and what arrives on the trailer</h2>
            <p className="fh-lede">
              Ranch and winery weddings are the flagship case: no hose bib, no outlet, and a
              driveway that was not built for a truck. Every trailer is specified to work
              there.
            </p>
          </div>

          <div className="fh-table-wrap">
            <table className="fh-table">
              <caption>What each trailer carries when it leaves the yard</caption>
              <thead>
                <tr>
                  <th scope="col">Unit</th>
                  <th scope="col" className="fh-table__num">
                    Stations
                  </th>
                  <th scope="col" className="fh-table__num">
                    Guests
                  </th>
                  <th scope="col">Tanks aboard</th>
                  <th scope="col">Power wanted</th>
                </tr>
              </thead>
              <tbody>
                {trailers.map((unit) => (
                  <tr key={unit.id}>
                    <td>{unit.name}</td>
                    <td className="fh-table__num">{unit.stations}</td>
                    <td className="fh-table__num">{unit.capacityGuests}</td>
                    <td>{unit.waterNeed}</td>
                    <td>{unit.powerNeed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="fh-faq">
            <Item q="Do the trailers need water on site, and how long does a tank last?" startOpen>
              <p>
                No water needed. Every trailer leaves the yard with its fresh tank full and its
                waste tank empty and treated. The {trailer3.name.toLowerCase()} carries ninety
                gallons, which is more than a six-hour reception at its rated headcount will use.
              </p>
              <p>
                The arithmetic: about a third of a gallon per visit — flush and hand-wash
                together — and one to one and a half visits per guest over five hours. A
                120-guest ceremony lands near fifty gallons, which is what a two-station trailer
                carries, and which is where the one-station-per-{GUESTS_PER_STATION}-guest ratio
                comes from. A bar raises both halves, and that is what the {ALCOHOL_FACTOR}{' '}
                multiplier is. Every waste tank is at least three times the fresh tank, because
                the failure nobody plans for is a full waste tank with fresh water still aboard.
              </p>
              <p>
                Water on site only matters if you want us to refill without the truck leaving,
                which is what the fresh-water buffalo is for: a 265-gallon towable tank,{' '}
                {money(buffalo.amount)}. Worth it for two-day events, festivals and anything
                running past midnight. For one afternoon and evening, the tanks that arrive are
                the tanks you need.
              </p>
            </Item>

            <Item q="Do they need power?">
              <p>
                Yes, but only for comfort. A single 120 V, 20 A household circuit runs the
                climate control and the interior lighting. The toilets flush and the sinks pump
                from the trailer&rsquo;s own 12 V system, so losing power does not stop the
                trailer working — it stops it being pleasant.
              </p>
              <p>
                In February you can go without the heat. In September in Healdsburg you cannot
                go without the air conditioning, and that is where &ldquo;no power on site&rdquo;
                becomes &ldquo;add the generator&rdquo;. Ours is a {generator.detail}, quiet
                enough to stand behind the trailer, {money(generator.amount)} as a published
                add-on rather than a phone call.
              </p>
              <p>
                Running a cord instead: 12-gauge or heavier, under about a hundred feet. A long
                thin cord starves the compressor and it trips on the hottest hour of the day,
                which is the hour you needed it. The {trailer8.name.toLowerCase()} wants two
                circuits, because it has two independent air-conditioning systems.
              </p>
            </Item>

            <Item q="What if the site is at the end of a dirt road, or on a slope?">
              <p>
                We need ten feet of width, twelve feet of clearance, somewhere to turn around
                or pull through, and ground that will hold a loaded trailer. A{' '}
                {trailer3.dimensions.lengthFt}-foot trailer fits down a vineyard row; the
                {' '}{trailer8.dimensions.lengthFt}-foot one does not, and we will say so
                before we come.
              </p>
              <p>
                On a slope the constraint is the door, not the wheels. More than about three
                degrees off level and doors start swinging shut on their own and the waste tank
                drains to one end. We level with blocking under the frame and put a mat at the
                stairs, and if the only firm ground is a hundred feet from the party we would
                rather stage it there and light the path than sink {num(trailer4.weightLb)}{' '}
                pounds of trailer into wet turf in February.
              </p>
            </Item>
          </div>
        </section>

        <section className="fh-section">
          <div className="fh-section__head">
            <span className="fh-eyebrow fh-eyebrow--accent">Sizing</span>
            <h2 className="fh-h2">How many stations, and who decides</h2>
          </div>
          <div className="fh-faq">
            <Item q="How many stations do I actually need?">
              <p>
                One station per {GUESTS_PER_STATION} guests. Multiply by {ALCOHOL_FACTOR} if
                there is a bar. Multiply by {durationFactor(6)} for an event over five hours,
                or {durationFactor(12)} over eight. Round up, with a floor of two stations on
                any booking. The sizing step prints that sum on screen and re-does it as you
                change the inputs.
              </p>
              <p>
                The common trade rule of thumb is one station per {INDUSTRY_PER_STATION}. At
                least one Bay Area operator advertises a six-station trailer as serving 550
                guests, which is about {COMPETITOR_PER_STATION} per station. Neither number is a
                lie — they describe an event with a queue at the peak hour, and the peak is not
                spread evenly across the evening. Ours describes an event without one.
              </p>
            </Item>

            <Item q="Can I book fewer stations than you recommend?">
              <p>
                Yes. The recommendation is a default, not a gate. Choose a smaller unit and the
                quote adds a plain note saying you have taken fewer stations than we advise and
                that it will work with a queue at the busiest hour. Better a trade made
                knowingly than a form that refuses you.
              </p>
              <p>
                The one place we do not bend is the two-station minimum. One door means one
                queue and no redundancy, and a single failed flush valve at a wedding is not a
                situation we will put a customer in.
              </p>
            </Item>
          </div>
        </section>

        <section className="fh-section">
          <div className="fh-section__head">
            <span className="fh-eyebrow fh-eyebrow--accent">Dates</span>
            <h2 className="fh-h2">Lead times and why a Saturday costs three days</h2>
          </div>
          <div className="fh-faq">
            <Item q="How far ahead should I book?">
              <p>
                For a Saturday between May and October, as far ahead as you are willing.
                September and October Saturdays go first, across every trailer, and the calendar
                shows you which ones are already gone rather than making you ask. Outside those
                months a week or two is usually plenty. Nothing here needs a phone call to
                check: the availability you see is the availability there is.
              </p>
            </Item>

            <Item q="Why does booking one Saturday block the Friday and the Sunday?">
              <p>
                Because one truck delivers on Friday, services on Saturday and collects on
                Monday. A trailer committed to a Saturday wedding is standing at that site for
                three days, so it cannot be at a second one. Rather than hide that behind a
                &ldquo;let me check&rdquo;, the calendar holds Friday through Sunday for that
                unit and strikes the dates through where you can see them.
              </p>
              <p>
                Standard units and hand-wash stations are stocked in quantity, so they are
                never blocked this way.
              </p>
            </Item>

            <Item q="My date is taken. Now what?">
              <p>
                The screen offers the nearest open date for that unit, the next unit up, or the
                {' '}{trailer8.name.toLowerCase()} paired with standard units — as buttons, on
                the same screen, with the price already recalculated. No screen in this app ends
                in &ldquo;call us for a quote&rdquo;. If we genuinely cannot do a date, you find
                out in two minutes at midnight rather than in two days by voicemail.
              </p>
            </Item>
          </div>
        </section>

        <section className="fh-section">
          <div className="fh-section__head">
            <span className="fh-eyebrow fh-eyebrow--accent">Money</span>
            <h2 className="fh-h2">Season, deposits and the monthly minimum</h2>
          </div>
          <div className="fh-faq">
            <Item q="What is peak season, and why is it its own line?">
              <p>
                May through October, {pct(PEAK_UPLIFT)} on the unit rate and on any extra days.
                It is a separate line, named for the month, because folding a seasonal premium
                into one quoted number is how a March enquiry and a September enquiry come back
                looking like two different businesses. It never touches delivery, the generator,
                the water buffalo or the attendant — those are flat all year.
              </p>
            </Item>

            <Item q="Do you take a deposit? What about a contract?">
              <p>
                Not here. This site is a prototype and takes no payment of any kind: no card
                field, no deposit, no contract, no invoice. What you get is a held date, a
                confirmation number and a fully itemised receipt you can share as a link.
              </p>
              <p>
                The real business would take a deposit at booking and the balance before
                delivery, and would say so on the same screen where you commit — not in a
                document that arrives afterwards.
              </p>
            </Item>

            <Item q="What is the minimum on a jobsite rental?">
              <p>
                {MIN_TERM_WEEKS} weeks, then monthly for as long as you like. Weekly service —
                pump, restock, sanitise — is inside the monthly rate, and a second weekly visit
                is a published per-unit amount rather than a renegotiation.
              </p>
              <p>
                There is no seasonal premium on a jobsite rental at all. Charging a framing crew
                more in July because weddings are busy would be indefensible, so that line
                simply never appears on a monthly quote.
              </p>
            </Item>
          </div>
        </section>

        <section className="fh-section">
          <div className="fh-section__head">
            <span className="fh-eyebrow fh-eyebrow--accent">Winter</span>
            <h2 className="fh-h2">Freeze, rain and the November booking</h2>
          </div>
          <div className="fh-faq">
            <Item q="Do you rent in winter? What happens in a freeze?">
              <p>
                Yes, and winter is the easiest time to get a good trailer at short notice. Bay
                Area freezes are shallow and brief, but Napa, Sonoma, the Livermore hills and
                the inland valleys do go below freezing overnight — and what splits is not the
                tank. It is the pump, the supply line and the exposed traps.
              </p>
              <p>
                So: heat tape on the fresh line, antifreeze in the traps, interior heat left
                running overnight, and the fresh side drained if the trailer will sit unused.
                That heat is the same 120 V circuit that runs the air conditioning in September,
                which makes power the one thing worth sorting out on an off-grid site in either
                season. If lows are forecast below about 25&nbsp;°F on a site with no power, we
                will say plainly that we would rather bring units with no plumbing in them than
                hand you a cracked pump at eight in the morning.
              </p>
            </Item>

            <Item q="What about rain and soft ground?">
              <p>
                The problem with rain is not the trailer, it is getting the trailer out again.
                Mats at the stairs are standard. Over turf, ground protection and a gravel or
                paved staging spot are worth asking your venue about between November and March.
                If the forecast turns in the week before, expect a call about moving the
                placement rather than a tow truck on the Monday.
              </p>
            </Item>
          </div>
        </section>

        <section className="fh-section">
          <div className="fh-section__head">
            <span className="fh-eyebrow fh-eyebrow--accent">Accessibility and placement</span>
            <h2 className="fh-h2">The accessible unit, and where the trailer stands</h2>
          </div>
          <div className="fh-faq">
            <Item q="Do we need an accessible unit?">
              <p>
                Almost certainly, and most venues make it a condition of their contract. We are
                not lawyers, so take this as practical advice rather than a compliance opinion:
                an event open to the public generally needs at least one accessible restroom,
                and the number of venues that will let a vendor skip it is close to zero.
              </p>
              <p>
                The {ada.name} has a ramp with handrails, a 36-inch doorway, a 60-inch turning
                circle inside, grab bars and a lowered sink, plus a second standard room in the
                same trailer. It is {money(ada.rateWeekend)} for the weekend, and we never
                recommend it automatically: accessibility is a decision you make on purpose, so
                it is a unit you choose, not a box we tick for you.
              </p>
            </Item>

            <Item q="Where should the trailer actually stand?">
              <p>
                Close enough that guests find it without asking, far enough that it is not in a
                photograph. In practice: fifty to a hundred and fifty feet from the reception,
                downwind, on level ground, with three feet of clear space on the door side and a
                path people can walk in the dark in the shoes they arrived in. We also need the
                pump-out route thought through, because the truck has to get back to the trailer
                at the end. If you have a coordinator they will have an opinion on all of this,
                and it is usually the right one.
              </p>
            </Item>
          </div>
        </section>

        <section className="fh-section">
          <div className="fh-section__head">
            <span className="fh-eyebrow fh-eyebrow--accent">Venues and vendors</span>
            <h2 className="fh-h2">What a venue asks a restroom vendor for</h2>
          </div>
          <div className="fh-faq">
            <Item q="What paperwork will my venue want from you?">
              <p>The list, more or less every time:</p>
              <ul className="fh-list fh-list--check">
                <li>A certificate of insurance naming the venue as additional insured</li>
                <li>A W-9</li>
                <li>Delivery and pickup windows, with the vehicle and driver</li>
                <li>Sometimes a site plan showing placement and the pump-out route</li>
                <li>Proof that waste goes to a licensed treatment facility</li>
                <li>A phone number a human answers on the day</li>
              </ul>
              <p>
                Being straight with you: Fieldhouse does not carry that insurance today,
                because it is not operating yet. The{' '}
                <a className="fh-link" {...linkProps(navigate, '/about')}>
                  about page
                </a>{' '}
                lists exactly what has to exist before it does.
              </p>
            </Item>

            <Item q="Will you deal with the coordinator directly?">
              <p>
                Yes, gladly — a coordinator who knows the timeline saves everyone a bad hour.
                Send them the link: a booking here is a shareable URL carrying the whole quote,
                so the planner, the couple and the venue read the same itemised numbers instead
                of forwarding a PDF that may be two revisions old. Contact details are never in
                that link.
              </p>
            </Item>
          </div>
        </section>

        <section className="fh-section">
          <div className="fh-section__head">
            <span className="fh-eyebrow fh-eyebrow--accent">This site</span>
            <h2 className="fh-h2">One more, and it is the awkward one</h2>
          </div>
          <div className="fh-faq">
            <Item q="Is Fieldhouse a real company?">
              <p>
                Not yet, and we are not going to pretend otherwise on a page whose whole
                argument is that this trade should be straighter with people. Fieldhouse is a
                working prototype: real market rates, real arithmetic, real operating
                constraints, simulated bookings. Nothing here charges a card, sends an email or
                creates a contract, and the footer says so on every page. What is genuinely
                finished is the thinking — the fleet specification, the sizing method, the
                published rate card, the service map, and the honest answer about Zone 5.
              </p>
            </Item>
          </div>
        </section>

        <section className="fh-section">
          <div className="fh-row fh-row--between fh-row--wrap">
            <div className="fh-stack fh-stack--sm">
              <h2 className="fh-h3">Still unanswered?</h2>
              <p className="fh-text-muted">
                Delivery is free inside {FREE_MILES} miles and every other number is on the
                rate card. The rest is on the about page, including who picks up the phone.
              </p>
            </div>
            <div className="fh-row fh-row--wrap">
              <a className="fh-btn fh-btn--primary" {...linkProps(navigate, '/book/event')}>
                Book an event
              </a>
              <a className="fh-btn fh-btn--secondary" {...linkProps(navigate, '/pricing')}>
                Rate card
              </a>
              <a className="fh-link" {...linkProps(navigate, '/about')}>
                Who you are dealing with
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Faq;
