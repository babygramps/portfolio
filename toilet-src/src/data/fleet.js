// The Fieldhouse fleet: five restroom trailers, the standard unit and the
// hand-wash station. Seven records, always, in this order.
//
// capacityGuests is deliberately conservative: stations x 60 guests, which is our
// published baseline for an event with no bar service running five hours or less.
// The common industry rule of thumb is one station per 75 guests, and at least one
// Bay Area operator advertises a 6-station trailer at 550 guests, about 92 per
// station. We size on 60 and show the arithmetic. See lib/capacity.js.
//
// rateWeekend is whole-weekend dollars: delivery Friday, service Saturday, pickup
// Monday. rateMonthly is dollars per month and is null for the trailers, which we
// do not rent by the month. The standard unit and the hand-wash station carry
// both rates: their rateWeekend is the event price for a single unit.

export const FLEET = [
  {
    id: 'trailer-2',
    name: '2-Station Trailer',
    kind: 'trailer',
    stations: 2,
    dimensions: { lengthFt: 12, widthFt: 7, heightFt: 8.5 },
    weightLb: 2600,
    capacityGuests: 120,
    rateWeekend: 1450,
    rateMonthly: null,
    ada: false,
    powerNeed: '120 V / 20 A for climate control and interior lighting',
    waterNeed: 'Arrives with a full 60-gallon fresh tank; 200-gallon waste tank',
    features: [
      'Two private rooms, each with a flushing china toilet',
      'Stainless sink with running hot water',
      'Climate control and interior lighting',
      'Fits down a single-lane driveway',
    ],
    blurb:
      'Two private rooms with flushing toilets and hot-water sinks in a 12-foot box that will clear a single-lane service road and park on a 20-foot pad. Take it for a ceremony of about a hundred, where two doors keep the line moving in a way that two standard units never will.',
    drawing: 'trailer-2',
  },
  {
    id: 'trailer-3',
    name: '3-Station Trailer',
    kind: 'trailer',
    stations: 3,
    dimensions: { lengthFt: 16, widthFt: 7, heightFt: 8.5 },
    weightLb: 3400,
    capacityGuests: 180,
    rateWeekend: 1950,
    rateMonthly: null,
    ada: false,
    powerNeed: '120 V / 20 A for climate control and interior lighting',
    waterNeed: 'Arrives with a full 90-gallon fresh tank; 300-gallon waste tank',
    features: [
      'Three private rooms with separate entries',
      'Flushing china toilets and hot-water sinks',
      'Climate control, mirrors and vanity lighting',
      'Interior finish suitable for a wedding',
    ],
    blurb:
      'Three rooms in a 16-foot trailer with mirrors, vanity lighting and an interior finish that belongs at a wedding, on one household circuit and a full fresh tank. It still fits down a vineyard row, and it is what we book most often for a reception of 150 to 180.',
    drawing: 'trailer-3',
  },
  {
    id: 'trailer-4',
    name: '4-Station Trailer',
    kind: 'trailer',
    stations: 4,
    dimensions: { lengthFt: 20, widthFt: 8, heightFt: 9 },
    weightLb: 4600,
    capacityGuests: 240,
    rateWeekend: 2350,
    rateMonthly: null,
    ada: false,
    powerNeed: '120 V / 20 A per HVAC circuit',
    waterNeed: 'Arrives with a full 105-gallon fresh tank; 350-gallon waste tank',
    features: [
      'Four private rooms with separate entries',
      'Flushing china toilets and hot-water sinks',
      'Climate control, mirrors and vanity lighting',
      'Handles a 200-guest reception without a queue',
    ],
    blurb:
      'Four separate entries, so nobody waits behind a family with a toddler, and 350 gallons of waste capacity for a full evening of service. Pick it for a 200-guest reception that runs past dark; it wants a level pad about 25 feet long and one 120 V circuit per HVAC unit.',
    drawing: 'trailer-4',
  },
  {
    id: 'trailer-8',
    name: '8-Station Trailer',
    kind: 'trailer',
    stations: 8,
    dimensions: { lengthFt: 28, widthFt: 8.5, heightFt: 9.5 },
    weightLb: 7200,
    capacityGuests: 480,
    rateWeekend: 2900,
    rateMonthly: null,
    ada: false,
    powerNeed: '120 V / 20 A per HVAC circuit, two circuits',
    waterNeed: 'Arrives with a full 200-gallon fresh tank; 650-gallon waste tank',
    features: [
      'Eight private rooms and two entry stairs',
      'Flushing china toilets and hot-water sinks',
      'Two independent HVAC circuits',
      'Built for festival and large-reception load',
    ],
    blurb:
      'Eight rooms and two stair sets, with two independent HVAC circuits so a single compressor failure does not close the trailer. Book it for festivals and receptions above 300, and give us a level pad about 35 feet long with a straight pull in: at 28 feet and 7,200 pounds dry it does not turn on a narrow apron.',
    drawing: 'trailer-8',
  },
  {
    id: 'trailer-ada',
    name: 'ADA Trailer',
    kind: 'trailer',
    stations: 2,
    dimensions: { lengthFt: 14, widthFt: 8.5, heightFt: 9 },
    weightLb: 3900,
    capacityGuests: 120,
    rateWeekend: 1650,
    rateMonthly: null,
    ada: true,
    powerNeed: '120 V / 20 A for climate control and interior lighting',
    waterNeed: 'Arrives with a full 75-gallon fresh tank; 250-gallon waste tank',
    features: [
      'Wheelchair-accessible room with a 60-inch turning circle',
      'Aluminium ramp with handrails and a 36-inch doorway',
      'Grab bars and a lowered sink',
      'Second standard room in the same trailer',
    ],
    blurb:
      'A wheelchair-accessible room with a 60-inch turning circle, a railed aluminium ramp, grab bars and a lowered sink, plus a second standard room in the same trailer. It needs firm level ground for the ramp run, and most venues and county permits require one, so plan it alongside a larger trailer rather than in place of one.',
    drawing: 'trailer-ada',
  },
  {
    id: 'unit-standard',
    name: 'Standard Unit',
    kind: 'standard',
    stations: 1,
    dimensions: { lengthFt: 4, widthFt: 4, heightFt: 7.5 },
    weightLb: 180,
    capacityGuests: 60,
    rateWeekend: 165,
    rateMonthly: 145,
    ada: false,
    powerNeed: 'None',
    waterNeed: 'None — self-contained 60-gallon waste tank',
    features: [
      'Single self-contained unit',
      'Non-flush, 60-gallon waste tank',
      'Hand-sanitiser dispenser and vent stack',
      'Weekly pump, restock and sanitise included',
    ],
    blurb:
      'A self-contained single unit with a 60-gallon waste tank, a vent stack and a sanitiser dispenser, needing no power and no water hookup. Weekly pump, restock and sanitise are in the monthly rate, which makes it the default for a jobsite, a crew area, or the far corner of a large event site.',
    drawing: 'unit-standard',
  },
  {
    id: 'station-handwash',
    name: 'Hand-Wash Station',
    kind: 'handwash',
    stations: 0,
    dimensions: { lengthFt: 2.5, widthFt: 2, heightFt: 5 },
    weightLb: 120,
    capacityGuests: 0,
    rateWeekend: 95,
    rateMonthly: 75,
    ada: false,
    powerNeed: 'None',
    waterNeed: 'Arrives with a full 22-gallon fresh tank',
    features: [
      'Two foot-pump basins',
      '22-gallon fresh-water tank',
      'Soap and paper-towel dispensers',
      'No power or plumbing needed',
    ],
    blurb:
      'Two foot-pump basins with 22 gallons of fresh water on board, soap and paper towels, and no power or plumbing to arrange. Counties generally require hand-washing wherever food is served, so put one beside each restroom group and one at the catering tent.',
    drawing: 'station-handwash',
  },
];

// Returns the fleet record for an id, or null. Never throws, whatever it is given.
export function unitById(id) {
  if (typeof id !== 'string' || id === '') return null;
  for (let i = 0; i < FLEET.length; i += 1) {
    if (FLEET[i].id === id) return FLEET[i];
  }
  return null;
}
