import React from 'react';

// Shared shop-drawing primitives for the seven unit drawings.
// CONTRACT §C.2 names the seven unit files plus index.jsx; this private module is
// imported only from inside src/drawings/, so it changes no other file.
//
// Every element carries one of the sanctioned .fh-dwg-* classes and no inline
// fill/stroke. .fh-dwg-dim is fill:none, so arrowheads are stroked "V" paths
// rather than filled triangles — which is the older drafting convention anyway.

const LEG = 4.6; // arrowhead leg length along the dimension line
const HALF = 2.1; // arrowhead half-height across it

export const r = (n) => Math.round(n * 10) / 10;

// The one root element every drawing renders. viewBox is fixed at 400 x 260 for
// both views of every unit (CONTRACT §C.2) so plates line up in a grid.
export function Plate({ title, desc, children }) {
  return (
    <svg
      className="fh-drawing__svg"
      viewBox="0 0 400 260"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={title}
      focusable="false"
    >
      <title>{title}</title>
      <desc>{desc}</desc>
      {children}
    </svg>
  );
}

// Feet (may be .5) -> surveyor form: 12 -> 12'-0", 8.5 -> 8'-6".
export function ft(feet) {
  const whole = Math.floor(feet);
  const inches = Math.round((feet - whole) * 12);
  return whole + "'-" + inches + '"';
}

// Horizontal dimension line. `ext` is the y of the object edge the extension
// lines spring from; omit it for a bare dimension line.
export function DimH({ x1, x2, y, label, ext = null, tick = 4.5, dy = -4 }) {
  const over = ext !== null && y > ext ? tick : -tick;
  return (
    <g>
      {ext !== null && (
        <g>
          <line className="fh-dwg-dim" x1={r(x1)} y1={r(ext)} x2={r(x1)} y2={r(y + over)} />
          <line className="fh-dwg-dim" x1={r(x2)} y1={r(ext)} x2={r(x2)} y2={r(y + over)} />
        </g>
      )}
      <line className="fh-dwg-dim" x1={r(x1)} y1={r(y)} x2={r(x2)} y2={r(y)} />
      <path className="fh-dwg-dim" d={`M${r(x1 + LEG)} ${r(y - HALF)}L${r(x1)} ${r(y)}L${r(x1 + LEG)} ${r(y + HALF)}`} />
      <path className="fh-dwg-dim" d={`M${r(x2 - LEG)} ${r(y - HALF)}L${r(x2)} ${r(y)}L${r(x2 - LEG)} ${r(y + HALF)}`} />
      <text className="fh-dwg-dimtext" x={r((x1 + x2) / 2)} y={r(y + dy)} textAnchor="middle">
        {label}
      </text>
    </g>
  );
}

// Vertical dimension line, text reading bottom-to-top. `dx` is the offset of the
// text from the line: positive puts it to the right, negative to the left.
export function DimV({ y1, y2, x, label, ext = null, tick = 4.5, dx = 12 }) {
  const over = ext !== null && x > ext ? tick : -tick;
  const mid = r((y1 + y2) / 2);
  return (
    <g>
      {ext !== null && (
        <g>
          <line className="fh-dwg-dim" x1={r(ext)} y1={r(y1)} x2={r(x + over)} y2={r(y1)} />
          <line className="fh-dwg-dim" x1={r(ext)} y1={r(y2)} x2={r(x + over)} y2={r(y2)} />
        </g>
      )}
      <line className="fh-dwg-dim" x1={r(x)} y1={r(y1)} x2={r(x)} y2={r(y2)} />
      <path className="fh-dwg-dim" d={`M${r(x - HALF)} ${r(y1 + LEG)}L${r(x)} ${r(y1)}L${r(x + HALF)} ${r(y1 + LEG)}`} />
      <path className="fh-dwg-dim" d={`M${r(x - HALF)} ${r(y2 - LEG)}L${r(x)} ${r(y2)}L${r(x + HALF)} ${r(y2 - LEG)}`} />
      <text
        className="fh-dwg-dimtext"
        x={r(x)}
        y={mid}
        dy={dx}
        textAnchor="middle"
        transform={`rotate(-90 ${r(x)} ${mid})`}
      >
        {label}
      </text>
    </g>
  );
}

// Terse uppercase callout, e.g. STATION 1.
export function Note({ x, y, text, anchor = 'middle' }) {
  return (
    <text className="fh-dwg-callout" x={r(x)} y={r(y)} textAnchor={anchor}>
      {text}
    </text>
  );
}

// Leader line from a callout to the thing it names.
export function Leader({ points }) {
  return <polyline className="fh-dwg-leader" points={points.map((p) => r(p[0]) + ',' + r(p[1])).join(' ')} />;
}

// Plan-view door: leaf line plus 90-degree swing arc, hinged at (x, y).
// sx = +1 the opening runs to the right, -1 to the left.
// sy = +1 the door swings down the page, -1 up the page.
export function Door({ x, y, w, sx = 1, sy = 1 }) {
  const sweep = sx * sy > 0 ? 1 : 0;
  return (
    <g>
      <line className="fh-dwg-interior" x1={r(x)} y1={r(y)} x2={r(x)} y2={r(y + sy * w)} />
      <path
        className="fh-dwg-hidden"
        d={`M${r(x + sx * w)} ${r(y)}A${r(w)} ${r(w)} 0 0 ${sweep} ${r(x)} ${r(y + sy * w)}`}
      />
    </g>
  );
}

// Elevation door: leaf outline plus a handle tick.
export function DoorElev({ x, y, w, h }) {
  return (
    <g>
      <rect className="fh-dwg-interior" x={r(x)} y={r(y)} width={r(w)} height={r(h)} />
      <line className="fh-dwg-interior" x1={r(x + w - 3.5)} y1={r(y + h * 0.5)} x2={r(x + w - 3.5)} y2={r(y + h * 0.5 + 4)} />
    </g>
  );
}

// Inner face of a wall, broken at door openings. Horizontal run.
export function WallRunH({ x1, x2, y, gaps = [] }) {
  const segs = [];
  let cursor = x1;
  gaps
    .slice()
    .sort((a, b) => a[0] - b[0])
    .forEach(([gx, gw]) => {
      if (gx > cursor) segs.push([cursor, gx]);
      cursor = gx + gw;
    });
  if (x2 > cursor) segs.push([cursor, x2]);
  return (
    <g>
      {segs.map((s, i) => (
        <line className="fh-dwg-interior" key={i} x1={r(s[0])} y1={r(y)} x2={r(s[1])} y2={r(y)} />
      ))}
    </g>
  );
}

// Which way a plan-view fixture faces, away from the wall it sits against.
const FACE = { down: 0, left: 90, up: 180, right: -90 };

const AXLE_NOTE = { 1: 'AXLE', 2: 'TANDEM AXLES', 3: 'TRIPLE AXLES' };

const place = (x, y, dir) => `translate(${r(x)} ${r(y)}) rotate(${FACE[dir]})`;

// Plan-view flushing toilet, drawn to real size: 1'-4" wide, 2'-2" front to back.
// (x, y) is the midpoint of the wall face it sits against; `s` is px per foot.
export function Toilet({ x, y, s, dir = 'down' }) {
  return (
    <g transform={place(x, y, dir)}>
      <rect className="fh-dwg-fill" x={r(-0.67 * s)} y={0} width={r(1.34 * s)} height={r(0.67 * s)} />
      <ellipse className="fh-dwg-fill" cx={0} cy={r(1.42 * s)} rx={r(0.58 * s)} ry={r(0.75 * s)} />
    </g>
  );
}

// Plan-view sink: 1'-8" of counter, 1'-2" deep, with a round basin.
export function Sink({ x, y, s, dir = 'down' }) {
  return (
    <g transform={place(x, y, dir)}>
      <rect className="fh-dwg-fill" x={r(-0.83 * s)} y={0} width={r(1.66 * s)} height={r(1.17 * s)} />
      <circle className="fh-dwg-interior" cx={0} cy={r(0.58 * s)} r={r(0.4 * s)} />
    </g>
  );
}

// Plan-view urinal: 1'-4" wide, 10" deep, on the wall.
export function Urinal({ x, y, s, dir = 'down' }) {
  return (
    <g transform={place(x, y, dir)}>
      <path
        className="fh-dwg-fill"
        d={`M${r(-0.67 * s)} 0L${r(0.67 * s)} 0L${r(0.5 * s)} ${r(0.83 * s)}L${r(-0.5 * s)} ${r(0.83 * s)}Z`}
      />
    </g>
  );
}

// Road wheel in elevation: tyre and hub.
export function Wheel({ cx, cy, rad }) {
  return (
    <g>
      <circle className="fh-dwg-fill" cx={r(cx)} cy={r(cy)} r={r(rad)} />
      <circle className="fh-dwg-interior" cx={r(cx)} cy={r(cy)} r={r(rad * 0.36)} />
    </g>
  );
}

// Fender skirt over one axle or a tandem pair: an angled-shoulder bulge that
// interrupts the frame band, which is how it reads on a real side elevation.
export function FenderRun({ x1, x2, y, top }) {
  return (
    <path
      className="fh-dwg-outline"
      d={`M${r(x1)} ${r(y)}L${r(x1 + 7)} ${r(top)}L${r(x2 - 7)} ${r(top)}L${r(x2)} ${r(y)}`}
    />
  );
}

// Ground line with 45-degree hatch ticks under it.
export function Ground({ x1, x2, y, step = 13, len = 5 }) {
  const ticks = [];
  for (let x = x1 + step; x < x2; x += step) ticks.push(r(x));
  return (
    <g>
      <line className="fh-dwg-outline" x1={r(x1)} y1={r(y)} x2={r(x2)} y2={r(y)} />
      {ticks.map((x) => (
        <line className="fh-dwg-hatch" key={x} x1={x} y1={r(y)} x2={r(x - len)} y2={r(y + len)} />
      ))}
    </g>
  );
}

// 45-degree hatching inside a rectangle, drawn as discrete lines because
// .fh-dwg-hatch is a stroke class with no fill.
export function Hatch({ x, y, w, h, step = 7 }) {
  const lines = [];
  for (let i = -h; i < w; i += step) {
    const t0 = Math.max(0, -i);
    const t1 = Math.min(h, w - i);
    if (t1 - t0 > 0.8) lines.push([x + i + t0, y + h - t0, x + i + t1, y + h - t1]);
  }
  return (
    <g>
      {lines.map((l, i) => (
        <line className="fh-dwg-hatch" key={i} x1={r(l[0])} y1={r(l[1])} x2={r(l[2])} y2={r(l[3])} />
      ))}
    </g>
  );
}

// Plan-view shell: outer skin, inner wall faces broken at the door openings, and
// any interior partition lines. Every plan view starts with one of these.
export function PlanShell({ x0, y0, x1, y1, wall = 4, gapsTop = [], gapsBottom = [], vLines = [], hLines = [] }) {
  const xi0 = x0 + wall;
  const xi1 = x1 - wall;
  const yi0 = y0 + wall;
  const yi1 = y1 - wall;
  return (
    <g>
      <rect className="fh-dwg-outline" x={r(x0)} y={r(y0)} width={r(x1 - x0)} height={r(y1 - y0)} />
      <WallRunH x1={xi0} x2={xi1} y={yi0} gaps={gapsTop} />
      <WallRunH x1={xi0} x2={xi1} y={yi1} gaps={gapsBottom} />
      <line className="fh-dwg-interior" x1={r(xi0)} y1={r(yi0)} x2={r(xi0)} y2={r(yi1)} />
      <line className="fh-dwg-interior" x1={r(xi1)} y1={r(yi0)} x2={r(xi1)} y2={r(yi1)} />
      {vLines.map((x) => (
        <line className="fh-dwg-interior" key={'v' + x} x1={r(x)} y1={r(yi0)} x2={r(x)} y2={r(yi1)} />
      ))}
      {hLines.map((h) => (
        <line className="fh-dwg-interior" key={'h' + h[0]} x1={r(h[1])} y1={r(h[0])} x2={r(h[2])} y2={r(h[0])} />
      ))}
    </g>
  );
}

// The complete plan view of a row-layout trailer: N equal rooms side by side, one
// outswing door per room on the curb side, a toilet on the street-side wall and a
// sink against the room's left wall. The 2-, 3- and 4-station trailers are all
// this drawing at different lengths.
export function RowTrailerPlan({ L, W, S, N, doorFt = 2.5, bottomNote, showDims = true, top = 66 }) {
  const x0 = r((400 - L * S) / 2);
  const x1 = r(x0 + L * S);
  const y0 = top;
  const y1 = r(y0 + W * S);
  const bay = L / N;
  const dw = r(doorFt * S);
  const idx = [];
  for (let i = 0; i < N; i += 1) idx.push(i);
  const parts = idx.slice(1).map((i) => r(x0 + i * bay * S));
  const centres = idx.map((i) => r(x0 + (i + 0.5) * bay * S));
  const doorX = centres.map((c) => r(c - dw / 2));
  const walls = idx.map((i) => (i === 0 ? r(x0 + 4) : r(parts[i - 1] + 2)));
  const sinkMid = r(y0 + 0.62 * W * S);
  return (
    <g>
      <PlanShell x0={x0} y0={y0} x1={x1} y1={y1} gapsBottom={doorX.map((x) => [x, dw])} vLines={parts} />
      {idx.map((i) => (
        <g key={i}>
          <Toilet x={r(centres[i] + 0.75 * S)} y={r(y0 + 4)} s={S} dir="down" />
          <Sink x={walls[i]} y={sinkMid} s={S} dir="right" />
          <Door x={doorX[i]} y={y1} w={dw} sx={1} sy={1} />
          <Hatch x={doorX[i]} y={r(y1 - 4)} w={dw} h={4} />
          <Note x={centres[i]} y={r(y1 - 14)} text={'STATION ' + (i + 1)} />
        </g>
      ))}
      <Leader points={[[x0 + 22, sinkMid - 0.83 * S - 5], [x0 + 14, sinkMid - 0.83 * S + 2]]} />
      <Note x={r(x0 + 14)} y={r(sinkMid - 0.83 * S - 8)} text="SINK (TYP.)" anchor="start" />
      <Note x={200} y={r(y1 + dw + 16)} text={bottomNote} />
      {showDims && (
        <g>
          {idx.map((i) => (
            <DimH
              key={i}
              x1={i === 0 ? x0 : parts[i - 1]}
              x2={i === N - 1 ? x1 : parts[i]}
              y={52}
              label={ft(bay)}
              ext={y0}
            />
          ))}
          <DimH x1={x0} x2={x1} y={30} label={ft(L)} ext={y0} />
          <DimV y1={y0} y2={y1} x={r(x1 + 20)} label={ft(W)} ext={x1} />
        </g>
      )}
    </g>
  );
}

// The complete side elevation of a trailer. All five trailers are the same
// machine at different lengths, so the whole plate is generated from feet:
// ground, box, roof cap, skirt broken at the fender, wheels on a marked axle
// centreline, tongue and jack, doors with step blocks, and the dimension set.
export function TrailerElevation({
  L,
  H,
  S,
  doors,
  axleFt,
  axles = 1,
  tongueFt = 3,
  deckFt = 2.4,
  tyreFt = 2.1,
  doorFt = 5.7,
  grade = null,
  rightMargin = 40,
  ports = ['120 V INLET', 'FRESH FILL'],
  showDims = true,
  dimSide = 'right',
  extras = null,
}) {
  const tw = tongueFt * S;
  const bw = L * S;
  // Vertically centre the object plus its two dimension lines in the 260-unit plate.
  const roofY = r((260 - H * S - 52) / 2);
  const gradeY = grade === null ? r(roofY + H * S) : grade;
  const bx = r(Math.max((400 - rightMargin - bw - tw) / 2 + tw, 8 + tw));
  const bx2 = r(bx + bw);
  const nx = r(bx - tw);
  const roof = grade === null ? roofY : r(grade - H * S);
  const floor = r(gradeY - deckFt * S);
  const frame = r(floor + 9);
  const tyreR = r((tyreFt * S) / 2);
  const cy = r(gradeY - tyreR);
  const cxs = [];
  for (let i = 0; i < axles; i += 1) cxs.push(r(bx + axleFt * S + i * 2.67 * S));
  const fx1 = r(cxs[0] - tyreR - 4);
  const fx2 = r(cxs[cxs.length - 1] + tyreR + 4);
  const fTop = r(floor);
  const doorTop = r(floor - doorFt * S);
  const dimX = dimSide === 'left' ? r(nx - 20) : r(Math.min(bx2 + 20, 370));
  const labelPorts = ports.length > 0 && bx >= 70;
  return (
    <g>
      <Ground x1={r(Math.min(nx - 14, 20))} x2={380} y={gradeY} />
      <rect className="fh-dwg-outline" x={bx} y={r(roof + 3)} width={r(bw)} height={r(floor - roof - 3)} />
      <rect className="fh-dwg-outline" x={r(bx - 4)} y={roof} width={r(bw + 8)} height={4} />
      <rect className="fh-dwg-outline" x={bx} y={floor} width={r(fx1 - bx)} height={9} />
      <rect className="fh-dwg-outline" x={fx2} y={floor} width={r(bx2 - fx2)} height={9} />
      <FenderRun x1={fx1} x2={fx2} y={frame} top={fTop} />
      {cxs.map((cx) => (
        <Wheel key={cx} cx={cx} cy={cy} rad={tyreR} />
      ))}
      <line className="fh-dwg-center" x1={cxs[0]} y1={r(roof + 20)} x2={cxs[0]} y2={r(gradeY + 48)} />
      <Tongue bx={bx} nx={nx} frameY={floor} groundY={gradeY} />
      {doors.map((d) => {
        const dx = r(bx + d.at * S);
        const dwPx = r(d.w * S);
        const clear = d.steps !== false && (dx + dwPx + 3 <= fx1 || dx - 3 >= fx2);
        return (
          <g key={d.at}>
            <DoorElev x={dx} y={doorTop} w={dwPx} h={r(floor - doorTop)} />
            {clear && <Steps x={dx} w={dwPx} doorY={frame} groundY={gradeY} />}
          </g>
        );
      })}
      {labelPorts && (
        <g>
          <rect className="fh-dwg-fill" x={r(bx + 4)} y={r(floor - 34)} width={9} height={8} />
          <rect className="fh-dwg-fill" x={r(bx + 4)} y={r(floor - 22)} width={9} height={8} />
          <Leader points={[[bx - 6, floor - 47], [bx + 4, floor - 30]]} />
          <Leader points={[[bx - 6, floor - 33], [bx + 4, floor - 18]]} />
          <Note x={r(bx - 8)} y={r(floor - 44)} text={ports[0]} anchor="end" />
          <Note x={r(bx - 8)} y={r(floor - 30)} text={ports[1]} anchor="end" />
        </g>
      )}
      {tw >= 40 ? (
        <g>
          <Note x={r(nx + 2)} y={r(floor - 9)} text="TONGUE" anchor="start" />
          <Leader points={[[nx + 16, floor - 6], [nx + 22, floor + 3]]} />
        </g>
      ) : (
        <g>
          <Note x={r(nx)} y={r(roof - 10)} text="TONGUE" anchor="start" />
          <Leader points={[[nx + 14, roof - 7], [nx + 16, floor + 2]]} />
        </g>
      )}
      <Note x={r(fx1 - 22)} y={r(gradeY + 16)} text={AXLE_NOTE[Math.min(axles, 3)]} anchor="end" />
      {typeof extras === 'function' ? extras({ bx, bx2, roof, floor, frame, gradeY, S }) : extras}
      {showDims && (
        <g>
          <DimH x1={nx} x2={bx} y={r(gradeY + 28)} label={ft(tongueFt)} ext={gradeY} />
          <DimH x1={bx} x2={bx2} y={r(gradeY + 28)} label={ft(L)} ext={gradeY} />
          <DimH x1={bx} x2={cxs[0]} y={r(gradeY + 48)} label={ft(axleFt)} />
          <DimV y1={roof} y2={gradeY} x={dimX} label={ft(H)} ext={dimSide === 'left' ? bx : bx2} dx={dimSide === 'left' ? -3 : 12} />
        </g>
      )}
    </g>
  );
}

// A-frame tongue with coupler and drop-leg jack, drawn front-of-body in elevation.
// The body's front wall is at bx; the coupler nose lands at nx.
export function Tongue({ bx, nx, frameY, groundY }) {
  const midY = frameY + 4;
  return (
    <g>
      <path
        className="fh-dwg-outline"
        d={`M${r(bx)} ${r(frameY)}L${r(nx + 9)} ${r(midY)}L${r(nx + 9)} ${r(midY + 3.4)}L${r(bx)} ${r(frameY + 7)}Z`}
      />
      <rect className="fh-dwg-fill" x={r(nx)} y={r(midY - 2.6)} width={r(9)} height={r(8.6)} />
      <line className="fh-dwg-interior" x1={r(nx + 13)} y1={r(midY + 6)} x2={r(nx + 13)} y2={r(groundY - 3)} />
      <line className="fh-dwg-outline" x1={r(nx + 8)} y1={r(groundY - 3)} x2={r(nx + 18)} y2={r(groundY - 3)} />
    </g>
  );
}

// Step set under an elevation doorway, seen head-on: the treads run toward the
// viewer, so what shows is a block a little wider than the door with tread nosings.
export function Steps({ x, w, doorY, groundY, treads = 2 }) {
  const rise = (groundY - doorY) / (treads + 1);
  const lines = [];
  for (let i = 1; i <= treads; i += 1) lines.push(r(doorY + rise * i));
  return (
    <g>
      <rect className="fh-dwg-outline" x={r(x - 3)} y={r(doorY)} width={r(w + 6)} height={r(groundY - doorY)} />
      {lines.map((y) => (
        <line className="fh-dwg-interior" key={y} x1={r(x - 3)} y1={y} x2={r(x + w + 3)} y2={y} />
      ))}
    </g>
  );
}
