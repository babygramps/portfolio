// Service-area lookup table.
//
// `miles` is ONE-WAY DRIVING distance from the Fieldhouse yard in Oakland, near
// 880 and the Embarcadero — not straight-line distance. Bridges, the Caldecott,
// and the fact that the only way to the Marin coast is over the Golden Gate are
// all already in the numbers, which is why Stinson Beach (36 mi) reads farther
// than Fairfax (28 mi) despite being closer as the gull flies.
//
// Two things consume this table:
//   1. `lib/zones.js` → `lookup()` / `suggest()`, matching on city name or ZIP.
//   2. The mileage surcharge: free inside 25 miles, then $3.50 on each mile
//      beyond, charged one way because the return trip is already inside the
//      base rate. Round trip is never double-counted.
//
// Zone bands (CONTRACT §B.2): Z1 <= 25, Z2 26-50, Z3 51-80, Z4 81-110, Z5 > 110.
// The boundary entries — Pleasanton 25, Fremont 26, Napa 50, Petaluma 51,
// Windsor 80, Healdsburg 81, Sea Ranch 110, Gualala 111 — are fixed by the
// CONTRACT and asserted by zones.test.js. Do not tune them.
//
// Sorted by county, then by name, because that is what keeps the table
// maintainable. Array order carries no meaning: `lookup()` resolves an ambiguous
// name prefix on the smallest `miles`, not on position, so adding a far-away town
// above a near one cannot hijack a nearer town's quote.

export const LOCATIONS = [
  // Alameda
  { name: 'Alameda', county: 'Alameda', zips: ['94501', '94502'], miles: 5 },
  { name: 'Albany', county: 'Alameda', zips: ['94706'], miles: 10 },
  { name: 'Berkeley', county: 'Alameda', zips: ['94702', '94703', '94709', '94710'], miles: 8 },
  { name: 'Castro Valley', county: 'Alameda', zips: ['94546', '94552'], miles: 15 },
  { name: 'Dublin', county: 'Alameda', zips: ['94568'], miles: 27 },
  { name: 'Emeryville', county: 'Alameda', zips: ['94608'], miles: 5 },
  { name: 'Fremont', county: 'Alameda', zips: ['94536', '94538', '94539', '94555'], miles: 26 },
  { name: 'Hayward', county: 'Alameda', zips: ['94541', '94544', '94545'], miles: 17 },
  { name: 'Livermore', county: 'Alameda', zips: ['94550', '94551'], miles: 32 },
  { name: 'Newark', county: 'Alameda', zips: ['94560'], miles: 24 },
  { name: 'Oakland', county: 'Alameda', zips: ['94601', '94607', '94612', '94619'], miles: 3 },
  { name: 'Piedmont', county: 'Alameda', zips: ['94611'], miles: 6 },
  { name: 'Pleasanton', county: 'Alameda', zips: ['94566', '94588'], miles: 25 },
  { name: 'San Leandro', county: 'Alameda', zips: ['94577', '94578', '94579'], miles: 9 },
  { name: 'Sunol', county: 'Alameda', zips: ['94586'], miles: 28 },
  { name: 'Union City', county: 'Alameda', zips: ['94587'], miles: 21 },

  // Contra Costa
  { name: 'Alamo', county: 'Contra Costa', zips: ['94507'], miles: 23 },
  { name: 'Antioch', county: 'Contra Costa', zips: ['94509', '94531'], miles: 38 },
  { name: 'Brentwood', county: 'Contra Costa', zips: ['94513'], miles: 45 },
  { name: 'Clayton', county: 'Contra Costa', zips: ['94517'], miles: 30 },
  { name: 'Concord', county: 'Contra Costa', zips: ['94518', '94519', '94520', '94521'], miles: 25 },
  { name: 'Danville', county: 'Contra Costa', zips: ['94506', '94526'], miles: 25 },
  { name: 'El Cerrito', county: 'Contra Costa', zips: ['94530'], miles: 12 },
  { name: 'Hercules', county: 'Contra Costa', zips: ['94547'], miles: 19 },
  { name: 'Lafayette', county: 'Contra Costa', zips: ['94549'], miles: 15 },
  { name: 'Martinez', county: 'Contra Costa', zips: ['94553'], miles: 27 },
  { name: 'Moraga', county: 'Contra Costa', zips: ['94556'], miles: 14 },
  { name: 'Oakley', county: 'Contra Costa', zips: ['94561'], miles: 43 },
  { name: 'Orinda', county: 'Contra Costa', zips: ['94563'], miles: 12 },
  { name: 'Pinole', county: 'Contra Costa', zips: ['94564'], miles: 18 },
  { name: 'Pittsburg', county: 'Contra Costa', zips: ['94565'], miles: 33 },
  { name: 'Pleasant Hill', county: 'Contra Costa', zips: ['94523'], miles: 22 },
  { name: 'Richmond', county: 'Contra Costa', zips: ['94801', '94804', '94805'], miles: 14 },
  { name: 'San Pablo', county: 'Contra Costa', zips: ['94806'], miles: 15 },
  { name: 'San Ramon', county: 'Contra Costa', zips: ['94582', '94583'], miles: 24 },
  { name: 'Walnut Creek', county: 'Contra Costa', zips: ['94596', '94597', '94598'], miles: 20 },

  // Marin
  { name: 'Bolinas', county: 'Marin', zips: ['94924'], miles: 40 },
  { name: 'Corte Madera', county: 'Marin', zips: ['94925'], miles: 22 },
  { name: 'Fairfax', county: 'Marin', zips: ['94930'], miles: 28 },
  { name: 'Inverness', county: 'Marin', zips: ['94937'], miles: 50 },
  { name: 'Larkspur', county: 'Marin', zips: ['94939'], miles: 22 },
  { name: 'Marshall', county: 'Marin', zips: ['94940'], miles: 52 },
  { name: 'Mill Valley', county: 'Marin', zips: ['94941'], miles: 19 },
  { name: 'Nicasio', county: 'Marin', zips: ['94946'], miles: 38 },
  { name: 'Novato', county: 'Marin', zips: ['94945', '94947', '94949'], miles: 33 },
  { name: 'Olema', county: 'Marin', zips: ['94950'], miles: 44 },
  { name: 'Point Reyes Station', county: 'Marin', zips: ['94956'], miles: 46 },
  { name: 'Ross', county: 'Marin', zips: ['94957'], miles: 24 },
  { name: 'San Anselmo', county: 'Marin', zips: ['94960'], miles: 26 },
  { name: 'San Rafael', county: 'Marin', zips: ['94901', '94903'], miles: 25 },
  { name: 'Sausalito', county: 'Marin', zips: ['94965'], miles: 16 },
  { name: 'Stinson Beach', county: 'Marin', zips: ['94970'], miles: 36 },
  { name: 'Tiburon', county: 'Marin', zips: ['94920'], miles: 21 },
  { name: 'Tomales', county: 'Marin', zips: ['94971'], miles: 55 },

  // Mendocino
  { name: 'Gualala', county: 'Mendocino', zips: ['95445'], miles: 111 },
  { name: 'Point Arena', county: 'Mendocino', zips: ['95468'], miles: 122 },

  // Monterey
  { name: 'Big Sur', county: 'Monterey', zips: ['93920'], miles: 135 },
  { name: 'Carmel', county: 'Monterey', zips: ['93921', '93923'], miles: 115 },
  { name: 'Carmel Valley', county: 'Monterey', zips: ['93924'], miles: 120 },
  { name: 'Monterey', county: 'Monterey', zips: ['93940'], miles: 110 },
  { name: 'Moss Landing', county: 'Monterey', zips: ['95039'], miles: 95 },
  { name: 'Pacific Grove', county: 'Monterey', zips: ['93950'], miles: 113 },
  { name: 'Pebble Beach', county: 'Monterey', zips: ['93953'], miles: 116 },
  { name: 'Salinas', county: 'Monterey', zips: ['93901', '93905', '93907'], miles: 100 },

  // Napa
  { name: 'American Canyon', county: 'Napa', zips: ['94503'], miles: 36 },
  { name: 'Angwin', county: 'Napa', zips: ['94508'], miles: 68 },
  { name: 'Calistoga', county: 'Napa', zips: ['94515'], miles: 75 },
  { name: 'Napa', county: 'Napa', zips: ['94558', '94559'], miles: 50 },
  { name: 'Oakville', county: 'Napa', zips: ['94562'], miles: 58 },
  { name: 'Pope Valley', county: 'Napa', zips: ['94567'], miles: 72 },
  { name: 'Rutherford', county: 'Napa', zips: ['94573'], miles: 60 },
  { name: 'St. Helena', county: 'Napa', zips: ['94574'], miles: 65 },
  { name: 'Yountville', county: 'Napa', zips: ['94599'], miles: 55 },

  // San Francisco
  { name: 'San Francisco', county: 'San Francisco', zips: ['94102', '94110', '94114', '94123'], miles: 12 },
  { name: 'Treasure Island', county: 'San Francisco', zips: ['94130'], miles: 8 },

  // San Mateo
  { name: 'Atherton', county: 'San Mateo', zips: ['94027'], miles: 30 },
  { name: 'Belmont', county: 'San Mateo', zips: ['94002'], miles: 27 },
  { name: 'Burlingame', county: 'San Mateo', zips: ['94010'], miles: 23 },
  { name: 'Daly City', county: 'San Mateo', zips: ['94014', '94015'], miles: 19 },
  { name: 'East Palo Alto', county: 'San Mateo', zips: ['94303'], miles: 31 },
  { name: 'El Granada', county: 'San Mateo', zips: ['94018'], miles: 38 },
  { name: 'Foster City', county: 'San Mateo', zips: ['94404'], miles: 26 },
  { name: 'Half Moon Bay', county: 'San Mateo', zips: ['94019'], miles: 42 },
  { name: 'Menlo Park', county: 'San Mateo', zips: ['94025'], miles: 31 },
  { name: 'Millbrae', county: 'San Mateo', zips: ['94030'], miles: 21 },
  { name: 'Montara', county: 'San Mateo', zips: ['94037'], miles: 35 },
  { name: 'Pacifica', county: 'San Mateo', zips: ['94044'], miles: 27 },
  { name: 'Pescadero', county: 'San Mateo', zips: ['94060'], miles: 55 },
  { name: 'Portola Valley', county: 'San Mateo', zips: ['94028'], miles: 34 },
  { name: 'Redwood City', county: 'San Mateo', zips: ['94061', '94063', '94065'], miles: 28 },
  { name: 'San Bruno', county: 'San Mateo', zips: ['94066'], miles: 21 },
  { name: 'San Carlos', county: 'San Mateo', zips: ['94070'], miles: 27 },
  { name: 'San Mateo', county: 'San Mateo', zips: ['94401', '94402', '94403'], miles: 24 },
  { name: 'South San Francisco', county: 'San Mateo', zips: ['94080'], miles: 20 },
  { name: 'Woodside', county: 'San Mateo', zips: ['94062'], miles: 32 },

  // Santa Clara
  { name: 'Campbell', county: 'Santa Clara', zips: ['95008'], miles: 46 },
  { name: 'Cupertino', county: 'Santa Clara', zips: ['95014'], miles: 42 },
  { name: 'Gilroy', county: 'Santa Clara', zips: ['95020'], miles: 70 },
  { name: 'Los Altos', county: 'Santa Clara', zips: ['94022', '94024'], miles: 35 },
  { name: 'Los Gatos', county: 'Santa Clara', zips: ['95030', '95032'], miles: 50 },
  { name: 'Milpitas', county: 'Santa Clara', zips: ['95035'], miles: 31 },
  { name: 'Morgan Hill', county: 'Santa Clara', zips: ['95037'], miles: 60 },
  { name: 'Mountain View', county: 'Santa Clara', zips: ['94040', '94041', '94043'], miles: 34 },
  { name: 'Palo Alto', county: 'Santa Clara', zips: ['94301', '94304', '94306'], miles: 32 },
  { name: 'San Jose', county: 'Santa Clara', zips: ['95110', '95112', '95125', '95128'], miles: 41 },
  { name: 'San Martin', county: 'Santa Clara', zips: ['95046'], miles: 65 },
  { name: 'Santa Clara', county: 'Santa Clara', zips: ['95050', '95051', '95054'], miles: 38 },
  { name: 'Saratoga', county: 'Santa Clara', zips: ['95070'], miles: 48 },
  { name: 'Stanford', county: 'Santa Clara', zips: ['94305'], miles: 33 },
  { name: 'Sunnyvale', county: 'Santa Clara', zips: ['94085', '94086', '94087'], miles: 37 },

  // Santa Cruz
  { name: 'Aptos', county: 'Santa Cruz', zips: ['95003'], miles: 85 },
  { name: 'Ben Lomond', county: 'Santa Cruz', zips: ['95005'], miles: 78 },
  { name: 'Boulder Creek', county: 'Santa Cruz', zips: ['95006'], miles: 81 },
  { name: 'Capitola', county: 'Santa Cruz', zips: ['95010'], miles: 82 },
  { name: 'Davenport', county: 'Santa Cruz', zips: ['95017'], miles: 88 },
  { name: 'Felton', county: 'Santa Cruz', zips: ['95018'], miles: 75 },
  { name: 'Santa Cruz', county: 'Santa Cruz', zips: ['95060', '95062', '95065'], miles: 78 },
  { name: 'Scotts Valley', county: 'Santa Cruz', zips: ['95066'], miles: 72 },
  { name: 'Watsonville', county: 'Santa Cruz', zips: ['95076'], miles: 91 },

  // Solano
  { name: 'Benicia', county: 'Solano', zips: ['94510'], miles: 26 },
  { name: 'Dixon', county: 'Solano', zips: ['95620'], miles: 55 },
  { name: 'Fairfield', county: 'Solano', zips: ['94533', '94534'], miles: 42 },
  { name: 'Rio Vista', county: 'Solano', zips: ['94571'], miles: 52 },
  { name: 'Suisun City', county: 'Solano', zips: ['94585'], miles: 44 },
  { name: 'Vacaville', county: 'Solano', zips: ['95687', '95688'], miles: 50 },
  { name: 'Vallejo', county: 'Solano', zips: ['94589', '94590', '94591'], miles: 30 },

  // Sonoma
  { name: 'Annapolis', county: 'Sonoma', zips: ['95412'], miles: 108 },
  { name: 'Bodega', county: 'Sonoma', zips: ['94922'], miles: 68 },
  { name: 'Bodega Bay', county: 'Sonoma', zips: ['94923'], miles: 70 },
  { name: 'Boyes Hot Springs', county: 'Sonoma', zips: ['95416'], miles: 47 },
  { name: 'Cazadero', county: 'Sonoma', zips: ['95421'], miles: 86 },
  { name: 'Cloverdale', county: 'Sonoma', zips: ['95425'], miles: 95 },
  { name: 'Cotati', county: 'Sonoma', zips: ['94931'], miles: 56 },
  { name: 'Duncans Mills', county: 'Sonoma', zips: ['95430'], miles: 80 },
  { name: 'Forestville', county: 'Sonoma', zips: ['95436'], miles: 73 },
  { name: 'Fulton', county: 'Sonoma', zips: ['95439'], miles: 74 },
  { name: 'Geyserville', county: 'Sonoma', zips: ['95441'], miles: 87 },
  { name: 'Glen Ellen', county: 'Sonoma', zips: ['95442'], miles: 52 },
  { name: 'Graton', county: 'Sonoma', zips: ['95444'], miles: 70 },
  { name: 'Guerneville', county: 'Sonoma', zips: ['95446'], miles: 76 },
  { name: 'Healdsburg', county: 'Sonoma', zips: ['95448'], miles: 81 },
  { name: 'Jenner', county: 'Sonoma', zips: ['95450'], miles: 84 },
  { name: 'Kenwood', county: 'Sonoma', zips: ['95452'], miles: 57 },
  { name: 'Monte Rio', county: 'Sonoma', zips: ['95462'], miles: 78 },
  { name: 'Occidental', county: 'Sonoma', zips: ['95465'], miles: 72 },
  { name: 'Petaluma', county: 'Sonoma', zips: ['94952', '94954'], miles: 51 },
  { name: 'Rohnert Park', county: 'Sonoma', zips: ['94928'], miles: 58 },
  { name: 'Santa Rosa', county: 'Sonoma', zips: ['95401', '95403', '95404', '95405'], miles: 64 },
  { name: 'Sea Ranch', county: 'Sonoma', zips: ['95497'], miles: 110 },
  { name: 'Sebastopol', county: 'Sonoma', zips: ['95472'], miles: 66 },
  { name: 'Sonoma', county: 'Sonoma', zips: ['95476'], miles: 45 },
  { name: 'Stewarts Point', county: 'Sonoma', zips: ['95480'], miles: 104 },
  { name: 'Valley Ford', county: 'Sonoma', zips: ['94972'], miles: 64 },
  { name: 'Windsor', county: 'Sonoma', zips: ['95492'], miles: 80 },
];
