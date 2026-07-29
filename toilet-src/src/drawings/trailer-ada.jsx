import React from 'react';
import {
  DimH,
  DimV,
  Door,
  Leader,
  Note,
  PlanShell,
  Plate,
  Sink,
  Toilet,
  TrailerElevation,
  ft,
} from './primitives.jsx';

// ADA Trailer — 14'-0" x 8'-6" box, 9'-0" overall (fleet record: trailer-ada).
// The accessible room is the rear nine feet, so its ramp runs off the back of the
// curb side and never crosses the standard room's door. A low 1'-6" deck keeps the
// ramp run to ten feet. Both views at 15 px per foot.

const S = 15;
const L = 14;
const W = 8.5;
const H = 9;
const STD_FT = 5;
const ADA_DOOR = 3;
const STD_DOOR = 2.5;
const LANDING_FT = 3;
const SLOPE_FT = 7;
const DECK_FT = 1.5;
const DOOR_AT = 10;

const PLAN_DESC =
  'Floor plan of a fourteen foot by eight foot six inch trailer holding a standard room at the front and a wheelchair-accessible room across the rear nine feet. The accessible room shows a five foot turning circle dimensioned on the clear floor, grab bars on two walls, a lowered sink and a three foot door. A ten foot aluminium ramp with handrails runs off the curb side to that door.';
const ELEV_DESC =
  'Curb-side elevation of the same trailer: the standard room door and its step block at the front, the three foot accessible door at the rear with the ten foot ramp falling away behind it, tandem wheels on an axle centreline five feet six inches back, and nine feet from grade to roof.';

function Plan({ showDims }) {
  const x0 = 70; // shifted left of centre to leave room for the ramp off the rear
  const x1 = x0 + L * S;
  const y0 = 66;
  const y1 = y0 + W * S;
  const part = x0 + STD_FT * S;
  const stdDoor = x0 + 1.25 * S;
  const stdW = STD_DOOR * S;
  const adaDoor = x0 + DOOR_AT * S;
  const adaW = ADA_DOOR * S;
  const ring = { cx: part + 4.5 * S, cy: y0 + 5.5 * S, r: 2.5 * S };
  const ry0 = y1;
  const ry1 = y1 + ADA_DOOR * S;
  const rampEnd = adaDoor + adaW + SLOPE_FT * S;
  return (
    <React.Fragment>
      <PlanShell
        x0={x0}
        y0={y0}
        x1={x1}
        y1={y1}
        gapsBottom={[
          [stdDoor, stdW],
          [adaDoor, adaW],
        ]}
        vLines={[part]}
      />

      <Toilet x={x0 + 2.5 * S} y={y0 + 4} s={S} dir="down" />
      <Sink x={x0 + 4} y={y0 + 5.6 * S} s={S} dir="right" />
      <Note x={x0 + 2.5 * S} y={y1 - 14} text="STATION 2" />

      <Toilet x={part + 2.3 * S} y={y0 + 4} s={S} dir="down" />
      <line className="fh-dwg-fill" x1={part + 0.9 * S} y1={y0 + 9} x2={part + 3.9 * S} y2={y0 + 9} />
      <line className="fh-dwg-fill" x1={part + 9} y1={y0 + 0.9 * S} x2={part + 9} y2={y0 + 3.9 * S} />
      <Sink x={x1 - 4} y={y0 + 4 * S} s={S} dir="left" />

      <circle className="fh-dwg-hidden" cx={ring.cx} cy={ring.cy} r={ring.r} />
      <Note x={ring.cx} y={ring.cy - 20} text="STATION 1 (ADA)" />
      <Note x={ring.cx} y={ring.cy + 24} text="TURNING CIRCLE" />

      <Leader points={[[part + 53, y0 + 19], [part + 43, y0 + 11]]} />
      <Note x={part + 55} y={y0 + 22} text="GRAB BARS" anchor="start" />
      <Leader points={[[x1 - 15, y0 + 41], [x1 - 12, y0 + 47]]} />
      <Note x={x1 - 6} y={y0 + 38} text="LOWERED SINK" anchor="end" />

      <Door x={stdDoor} y={y1} w={stdW} sx={1} sy={1} />
      <Door x={adaDoor} y={y1} w={adaW} sx={1} sy={1} />

      <rect className="fh-dwg-outline" x={adaDoor} y={ry0} width={rampEnd - adaDoor} height={ry1 - ry0} />
      <line className="fh-dwg-fill" x1={adaDoor} y1={ry0 + 3.5} x2={rampEnd} y2={ry0 + 3.5} />
      <line className="fh-dwg-fill" x1={adaDoor} y1={ry1 - 3.5} x2={rampEnd} y2={ry1 - 3.5} />
      <line className="fh-dwg-interior" x1={adaDoor + adaW} y1={ry0} x2={adaDoor + adaW} y2={ry1} />
      <Note x={(adaDoor + adaW + rampEnd) / 2} y={(ry0 + ry1) / 2 + 3} text="ALUMINIUM RAMP" />
      <Leader points={[[adaDoor - 3, ry0 + 6], [adaDoor + 10, ry0 + 3.5]]} />
      <Note x={adaDoor - 5} y={ry0 + 9} text="HANDRAILS" anchor="end" />

      {showDims && (
        <React.Fragment>
          <DimH x1={x0} x2={part} y={52} label={ft(STD_FT)} ext={y0} />
          <DimH x1={part} x2={x1} y={52} label={ft(L - STD_FT)} ext={y0} />
          <DimH x1={x0} x2={x1} y={30} label={ft(L)} ext={y0} />
          <DimV y1={y0} y2={y1} x={x0 - 20} label={ft(W)} ext={x0} dx={-3} />
          <DimH x1={ring.cx - ring.r} x2={ring.cx + ring.r} y={ring.cy} label={ft(5)} />
          <DimH x1={adaDoor} x2={rampEnd} y={ry1 + 14} label={ft(LANDING_FT + SLOPE_FT)} ext={ry1} />
        </React.Fragment>
      )}
    </React.Fragment>
  );
}

// Elevation ramp: the same ramp the plan shows, in profile as a closed wedge off
// the rear of the deck. Handrails are called out on the plan and left off here —
// at this scale a 34-inch rail would cross the whole body silhouette.
function RampElev({ bx, frame, gradeY }) {
  const hi = bx + DOOR_AT * S;
  const land = hi + LANDING_FT * S;
  const foot = land + SLOPE_FT * S;
  return (
    <g>
      <path className="fh-dwg-fill" d={`M${hi} ${frame}L${land} ${frame}L${foot} ${gradeY}L${hi} ${gradeY}Z`} />
      <line className="fh-dwg-interior" x1={land} y1={frame} x2={land} y2={gradeY} />
      <Note x={land + 26} y={gradeY - 6} text="RAMP" anchor="start" />
    </g>
  );
}

export function TrailerAdaDrawing({ view, showDims = true, title }) {
  const plan = view !== 'elevation';
  return (
    <Plate title={title} desc={plan ? PLAN_DESC : ELEV_DESC}>
      {plan ? (
        <Plan showDims={showDims} />
      ) : (
        <TrailerElevation
          L={L}
          H={H}
          S={S}
          doors={[
            { at: 1.25, w: STD_DOOR },
            { at: DOOR_AT, w: ADA_DOOR, steps: false },
          ]}
          axleFt={5.5}
          axles={2}
          deckFt={DECK_FT}
          tyreFt={1.4}
          doorFt={6.4}
          ports={[]}
          rightMargin={70}
          dimSide="left"
          showDims={showDims}
          extras={RampElev}
        />
      )}
    </Plate>
  );
}

export default TrailerAdaDrawing;
