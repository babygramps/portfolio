# Fieldhouse — instant-booking restroom rental prototype (`/toilet`)

**Date:** 2026-07-29
**Status:** approved design, not yet implemented
**Deploys to:** `rickrothbart.com/toilet`

---

## 1. Purpose

A working prototype of a portable-restroom and restroom-trailer rental site whose
single differentiator is that **you can book it online in under two minutes**, with
the price on screen, without talking to anyone.

Market research on Bay Area operators found that essentially every competitor hides
pricing behind a "request a quote" form, and that the aggregator pages which *do*
publish prices rank well organically. That friction is the gap this prototype fills.
Instant booking matters most at the low end — nobody minds a form for a $2,500
wedding trailer, but needing a phone call to rent a $145/month jobsite unit is
absurd — so the app serves both ends through one engine.

**This is a prototype, not a live business.** No payments, no real notifications, no
contracts, no legal entity behind it. Bookings are simulated. Its job is to be the
thing you show a venue's events director, and the blueprint for the real site.

### Non-goals

- Payments, deposits, contracts, real email or SMS.
- SEO location pages. Research established that the geo-modified head terms are
  owned by programmatic multi-market incumbents and that SEO is not the entry
  channel for this business. This also lives on a portfolio domain, so it has no
  SEO job to do.
- An operator-side dashboard (fleet calendar, dispatch routing, margin per job).
- User accounts or authentication. There is never a login.

### Brand

**Fieldhouse** — "Fieldhouse Restroom Co." formally, "Fieldhouse" as the wordmark.
A fieldhouse is a real building type: a structure placed in a field to provide
facilities, which is literally what is being rented, with no pun and no use of the
word "luxury." Two customer-facing registers off one brand: **Fieldhouse** for
events, **Fieldhouse Site Services** for the jobsite and monthly side.

The deploy slug stays `/toilet` as requested. A `/fieldhouse` alias is a one-line
addition later if wanted.

---

## 2. Build and deploy architecture

### Source layout

Mirrors the existing `colorku-src/` pattern in this repo, which is the established
convention for a bundled sub-app.

```
toilet-src/                  # source, not deployed
  package.json               # react, react-dom, esbuild, vitest
  build.mjs                  # bundles → ../toilet/index.html
  src/
    main.jsx                 # mount + hash router
    app.jsx                  # shell: header, nav, route switch
    routes/
      home.jsx               # the two-door split
      fleet.jsx              # unit list + detail
      pricing.jsx            # the published rate card
      service-area.jsx       # zone map
      faq.jsx
      about.jsx
      book-event.jsx         # 4-step events wizard
      book-site.jsx          # 3-step jobsite wizard
      confirmation.jsx       # receipt + confirmation number
    booking/
      wizard.jsx             # shared step chrome, progress, transitions
      summary-sheet.jsx      # collapsible order summary
      calendar.jsx           # month grid, availability, peak marks
      stepper.jsx            # quantity control
      segmented.jsx          # segmented control
      sheet.jsx              # bottom-sheet primitive
    lib/
      capacity.js            # guests → stations, with shown reasoning
      zones.js               # location → drive miles + zone
      pricing.js             # line items + totals
      availability.js        # season ledger + collisions
      store.js               # localStorage bookings, URL-hash state
      format.js              # money, dates
    data/
      fleet.js               # units, dimensions, rates, capacity
      rates.js               # add-ons, mileage, peak multiplier
      locations.js           # ~150 cities/ZIPs → drive miles from Oakland
      season.js              # seeded pre-booked dates
    drawings/
      *.jsx                  # inline SVG plan + elevation per unit
    styles.css               # inlined into the bundle
  test/
    capacity.test.js
    pricing.test.js
    zones.test.js
    availability.test.js

toilet/
  index.html                 # BUILD OUTPUT — committed, this is what deploys
```

### Build

`npm run build` in `toilet-src/` runs esbuild and writes a **single self-contained
`../toilet/index.html`** with CSS and JS inlined, exactly as `colorku-src/build.mjs`
does. CI does not run this build; the committed HTML is the deployed artifact.
Build and commit are therefore one action, and a stale commit means a stale site.

Two deliberate consequences:

1. **The single-file output is immune to the Cloudflare cache failure that hit
   `/rockfire`.** Cloudflare caches `.js`/`.css` by URL for hours and a CloudFront
   invalidation cannot reach it; a raced deploy left it serving HTML under asset
   URLs with `max-age=14400`. With no separate asset URLs, that failure mode does
   not exist here.
2. **Bundle budget: no binary assets, and no third-party library beyond React.**
   Stated originally as "under 400 KB", which was a proxy for "no photography".
   The built page is **425 KB raw / 117 KB gzip**: React and ReactDOM are an
   immovable 137 KB, the stylesheet 47 KB, and the remaining ~240 KB is almost
   entirely page prose — the published rate card, the off-grid FAQ answers and the
   per-zone coverage statements, all of which §6 requires and which are the
   product. Measured: build-flag tuning recovers about 1 KB, so the only lever is
   deleting copy. The budget is therefore expressed as the rule it was always
   standing in for: zero image bytes, zero fonts, no map or charting library, and
   nothing fetched at runtime. `build.mjs` still prints the KB size on every build
   so a regression is visible.

### Deploy

One new step in `.github/workflows/deploy.yml`, copied from the `makeitrain` step:

```yaml
- name: Deploy Fieldhouse app to /toilet/
  run: |
    if [ -d toilet ]; then
      aws s3 sync toilet/ s3://${{ env.S3_BUCKET }}/toilet/ --delete
      aws s3 cp toilet/index.html s3://${{ env.S3_BUCKET }}/toilet \
        --content-type "text/html"
      echo "✅ Fieldhouse deployed to /toilet/"
    else
      echo "No toilet/ directory found, skipping"
    fi
```

The extensionless `cp` makes `rickrothbart.com/toilet` work without a trailing
slash, matching every other sub-app.

Pushing to `master` of `babygramps/portfolio` triggers the live deploy and requires
`gh auth switch --user babygramps`, because the usual active `rick-orbital` account
has pull-only access. Switch back afterwards. **Do not push without asking.**

### Routing

Hash routing: `/toilet/#/fleet`, `/toilet/#/book/event`. Hand-rolled in
`main.jsx` against `hashchange`; no router dependency.

Clean paths are not an option. A request for `/toilet/fleet` misses in S3 and is
answered with the bucket's error document — **the portfolio homepage, at HTTP
200**. That is a broken deep link that looks healthy to every status check. Hash
routing sidesteps it with no bucket configuration.

The hash also carries wizard state, so a partially filled booking is a shareable
link — a planner can send a couple a pre-filled quote. See §5.4.

### Visual approach: drawings, not photographs

Every fleet unit is rendered as an **inline SVG plan and elevation with real
dimensions and station callouts**, not a photograph. Three reasons:

1. These trailers are not owned yet. Stock photography would misrepresent the
   fleet, and this page is going to be shown to venue staff.
2. It holds the single-file bundle under budget with no image assets, which is
   what keeps the Cloudflare asset trap inapplicable.
3. A dimensioned drawing signals the mechanical-engineering competence that the
   research identifies as the real durable advantage in off-grid event work. It
   also looks nothing like the competition, all of whom use the same soft-focus
   interior shots.

---

## 3. The pricing engine

Four pure modules. **No network calls anywhere in the app.** Every number is
computed locally and synchronously, which is what allows the interface to feel
instant (§5.1).

### 3.1 `capacity.js` — the transparency differentiator

```
stations = max(2, ceil(guests / 60 × alcoholFactor × durationFactor))

alcoholFactor  = 1.25 if bar service, else 1.0
durationFactor = 1.0  for ≤ 5 h
                 1.15 for 5–8 h
                 1.3   for > 8 h
```

`recommend({guests, hours, alcohol})` returns `{stations, steps[]}` where `steps`
is the human-readable arithmetic.

**The app shows this math to the customer.** On the sizing step it prints the
calculation, states that we round up, and notes for comparison that the common
industry rule of thumb is one station per 75 guests and that at least one Bay Area
competitor advertises a 6-station trailer as serving 550 guests — about 92 per
station. No competitor publishes their capacity logic. Publishing a conservative,
defensible number and explaining it is the product.

### 3.2 `zones.js` — distance without a network call

`data/locations.js` holds roughly 150 entries covering the nine Bay Area counties
plus Napa, Sonoma, Solano and the Santa Cruz coast. Each entry is
`{name, county, zips[], miles}` where `miles` is **driving** miles from an Oakland
yard, not straight-line.

`lookup(query)` matches on city name or ZIP and returns `{name, miles, zone}`, or
`null` for no match. On `null` the field offers the three nearest string matches as
tappable suggestions and never blocks progress. Zones are drive-time bands:
Z1 ≤ 25 mi, Z2 26–50, Z3 51–80, Z4 81–110, Z5 > 110.

Delivery fee: free within 25 miles, then **$3.50/mile** on the excess, mirroring
the $3–4/mile industry surcharge. Round trip is already priced into the base rate,
so mileage is charged one way to avoid double-counting.

Zone 5 stays **bookable at a real price**, with a disclosed condition attached to
the quote: beyond about 110 miles a single operator cannot promise a Friday slot
sight-unseen, so the confirmation states that the date is held pending a callback
within one business day. It is a held booking with a caveat, not a quote wall —
see §5.6.

### 3.3 `pricing.js`

`quote(selection)` → `{lineItems[], subtotal, total, notes[]}`. Line items are
always itemized and always labelled; there is no line called "fees."

Rates in `data/rates.js`, taken from the research:

| Item | Rate |
|---|---|
| 2-station trailer, weekend | $1,450 |
| 3-station trailer, weekend | $1,950 |
| 4-station trailer, weekend | $2,350 |
| 8-station trailer, weekend | $2,900 |
| ADA trailer, weekend | $1,650 |
| Standard unit, monthly | $145 |
| ADA standard unit, monthly | $185 |
| Hand-wash station, monthly | $75 |
| Standard unit, weekend event | $165 |
| Hand-wash station, event | $95 |
| Generator, per event | $125 |
| Fresh-water buffalo, per event | $175 |
| Attendant, per event | $350 |
| Extra day beyond weekend | 35% of base |
| Mileage beyond 25 mi | $3.50/mi |
| Peak season (May–Oct) | +20% on base |
| Extra weekly service visit | $45/visit/month |

Order of operations is fixed and must be tested: **base rate → add extra days at
35% of base each → apply the peak multiplier to that sum → then add mileage and
add-ons, neither of which is ever multiplied.** Peak season is shown as its own
line item reading e.g. "Peak season (September) +20%". Hiding a seasonal premium
inside a base rate is the behaviour this whole site is positioned against.

### 3.4 `availability.js`

`data/season.js` holds a seeded ledger of pre-booked dates for the 2026 and 2027
seasons, generated once by hand rather than randomly at runtime so the site is
deterministic and testable. Shape: peak September and October Saturdays largely
taken, August moderately booked, shoulder and off-season mostly open, some
Fridays and Sundays taken as part of adjacent weekend blocks.

`isAvailable(unitId, dateRange)` checks the seeded ledger **and** the user's own
localStorage bookings. A trailer booked for a Saturday is unavailable Friday
through Sunday, because delivery and pickup consume those days — a real
single-operator constraint, and it makes the scarcity legible.

Visible scarcity is the conversion mechanism. Unavailable dates are struck
through, not hidden, so the customer sees that peak Saturdays go early.

---

## 4. The two doors

The homepage asks one question and branches. Everything downstream shares the
pricing engine, the calendar, and the summary sheet; only the steps and the copy
register differ.

### 4.1 Events wizard — 4 steps

1. **Date.** Month calendar. Unavailable struck, peak dates dot-marked with the
   premium disclosed on tap. Optional multi-day extension.
2. **Size.** Guest count stepper, event duration segmented control, bar-service
   toggle. Returns a recommended unit with the capacity arithmetic printed, and
   the recommendation is freely overridable up or down — with a plain warning, not
   a block, if the customer sizes below the recommendation.
3. **Location.** City or ZIP type-ahead → zone, miles, delivery fee, live. An
   "off-grid — no water or power on site" toggle that surfaces the generator and
   fresh-water-buffalo add-ons with an explanation of why they are needed, since
   remote winery and ranch sites are the flagship niche.
4. **Finish.** Remaining add-ons, then name / email / phone, then confirm.

### 4.2 Jobsite wizard — 3 steps

1. **Units.** Quantity steppers for standard, ADA, and hand-wash.
2. **Term.** Start date, duration in weeks or months, service frequency (once or
   twice weekly).
3. **Location and confirm.** Zone lookup, monthly total, contact, confirm.

### 4.3 Confirmation

Confirmation number (`FH-2026-0143` format, sequential from localStorage), full
itemized receipt, what happens next, and a share link. The booking is written to
localStorage so it appears as a blocked date on the calendar afterwards — the site
accumulates state and feels alive on a second visit.

---

## 5. Interaction design

The flow should feel like a modern commerce checkout — Shopify's checkout, or the
momentum of a well-built mobile app — and not like a form wizard. Concretely:

### 5.1 Instant, never pending

There is no network, so nothing can spin. Lean into it: the total re-computes and
counts to its new value on every change, with no loading state anywhere in the
app. Instant recalculation is itself the demo.

### 5.2 One decision per screen, thumb-first

Mobile-first layout. One question per screen, large type, generous spacing. The
primary action is a **full-width fixed button at the bottom of the viewport**,
inside the thumb zone. Back is a chevron in the header, never a button competing
with forward.

A **slim progress bar** at the top of the wizard, not numbered stepper dots —
dots read as bureaucracy, a filling bar reads as momentum.

### 5.3 Collapsible order summary

The Shopify pattern, precisely. On mobile the summary is a single tappable line
pinned above the primary button — `$2,340 · 4 stations · Sat Sep 19` — that expands
into a **bottom sheet** with the full itemization. On desktop it is a sticky
right-hand column, always expanded. Same component, one breakpoint.

### 5.4 Native inputs, real autofill

What actually makes a modern checkout fast is that the browser fills it in.
Correct `autocomplete` tokens (`name`, `email`, `tel`, `street-address`,
`postal-code`), `type="tel"`, `inputmode="numeric"` on quantities. Segmented
controls and steppers instead of dropdowns and free-text wherever the option set
is small. **No account, ever** — contact details are collected once, at the end.

State lives in the URL hash, so a half-filled booking is shareable and a refresh
never loses work.

### 5.5 Motion

Horizontal slide between steps, sheets that rise from the bottom, `transform` and
`opacity` only so it holds 60 fps. Nothing longer than 250 ms. All of it inside a
`prefers-reduced-motion` guard that degrades to instant cuts.

### 5.6 Never a dead end

A date with no available unit, or a guest count above the 8-station unit's
capacity, resolves to the nearest bookable alternative offered inline — the closest
open date, a larger unit, or two units paired. Zone 5 books at a real price with
the callback condition disclosed (§3.2). Nothing in the app terminates in a "call
us for a quote" wall; every screen has a forward move.

---

## 6. Surrounding pages

- **Home** — the promise in one line, the two doors, and the contrast the research
  identified: online booking, published prices, and a named accountable human,
  against an industry of quote forms and a freshly-bankrupt national call centre.
  Make the contrast without naming the competitor.
- **Fleet** — seven units, each with its SVG drawing, dimensions, station count,
  conservative capacity, and rate: the 2-, 3-, 4- and 8-station trailers, the ADA
  trailer, the standard unit, and the hand-wash station. Individually linkable.
- **Pricing** — the complete published rate card, mileage, peak premium, and an
  explicit what's-included / what's-not. The single most differentiating page.
- **Service area** — inline SVG map of the nine counties plus wine country with
  the zone rings drawn from Oakland, and the honest statement of where a single
  operator can and cannot promise a Friday delivery.
- **FAQ** — the off-grid answers (tanks arrive full, 120 V needed only for A/C),
  lead times, ADA requirements, what a venue typically requires.
- **About** — a named human who answers the phone. This is the entire positioning
  thesis, so it is a real page, not a footer line.

---

## 7. Testing

Vitest, on the pure functions only:

- `capacity.test.js` — the ratio table, alcohol and duration factors, the
  minimum-2 floor, ceiling rounding at boundaries.
- `pricing.test.js` — line-item composition, peak multiplier applied to base only,
  mileage charged only beyond 25 miles, extra-day percentage, monthly service
  frequency.
- `zones.test.js` — city and ZIP lookup, zone boundary values, unknown input.
- `availability.test.js` — seeded ledger reads, Friday-through-Sunday blocking,
  collision with a localStorage booking.

Nothing tests the React components. The visual layer is verified by looking at it;
arithmetic is what can be quietly wrong. Manual check before any push: build,
open `toilet/index.html` from the filesystem, complete both wizards end to end,
confirm the bundle size, and confirm nothing in the page issues a network request.

---

## 8. Upgrade path, if it ever goes real

Worth recording: this repo **already** runs DynamoDB plus Lambda for the BBQ and
Colorku leaderboards, wired up inside `deploy.yml`. Turning this prototype into a
real booking system means one more table, one more function, and swapping
`store.js` from localStorage to `fetch` — no new infrastructure, no Railway
service, no separate backend to operate. Payments would need Stripe Checkout and,
before any of it, a legal entity, pollution liability insurance, and actual
trailers.

---

## 9. Note on this document

The portfolio repo is public. This spec deliberately covers the product and
technical design and cites only the market figures needed to justify specific
design decisions. The full competitive analysis and feasibility study stay out of
it.
