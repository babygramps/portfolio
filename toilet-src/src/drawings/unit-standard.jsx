import React from 'react';
import { DimH, DimV, Door, Ground, Hatch, Leader, Note, PlanShell, Plate, Urinal, ft } from './primitives.jsx';

// Standard Unit — 4'-0" x 4'-0" footprint, 7'-6" tall (fleet record: unit-standard).
// Skid-mounted, self-contained, no tongue and no axle. Both views at 24 px per foot.

const S = 24;
const L = 4;
const W = 4;
const H = 7.5;
const DOOR_FT = 2.17;

const PLAN_DESC =
  'Floor plan of a four foot square single-occupant restroom unit. A moulded bench with a toilet seat runs across the back wall, a urinal stands on the left wall, a hand-sanitiser dispenser is on the right wall beside the outswing door, and the vent stack rises through the back right corner.';
const ELEV_DESC =
  'Front elevation of the same unit: a four foot wide skid-mounted cabin seven feet six inches tall, tapered translucent roof, full-height door with louvre vents at the head, concealed vent stack shown dashed, and a skid base bearing directly on grade.';

function Plan({ showDims }) {
  const x0 = (400 - L * S) / 2;
  const x1 = x0 + L * S;
  const y0 = 76;
  const y1 = y0 + W * S;
  const dw = DOOR_FT * S;
  const dx = x0 + (L * S - dw) / 2;
  const bench = y0 + 4 + 1.5 * S;
  return (
    <React.Fragment>
      <PlanShell x0={x0} y0={y0} x1={x1} y1={y1} gapsBottom={[[dx, dw]]} />

      <rect className="fh-dwg-fill" x={x0 + 4} y={y0 + 4} width={x1 - x0 - 8} height={bench - y0 - 4} />
      <ellipse className="fh-dwg-fill" cx={200} cy={y0 + 22} rx={11} ry={8} />
      <circle className="fh-dwg-fill" cx={x1 - 12} cy={y0 + 22} r={6} />
      <Urinal x={x0 + 4} y={y0 + 62} s={S} dir="right" />
      <rect className="fh-dwg-fill" x={x1 - 10} y={y0 + 52} width={6} height={14} />

      <Door x={dx} y={y1} w={dw} sx={1} sy={1} />
      <Hatch x={dx} y={y1 - 4} w={dw} h={4} />

      <Note x={172} y={y0 + 25} text="SEAT" />
      <Note x={x0 + 30} y={y0 + 64} text="URINAL" anchor="start" />
      <Note x={200} y={y1 - 8} text="STATION 1" />
      <Leader points={[[x1 + 2, y0 + 23], [x1 - 6, y0 + 22]]} />
      <Note x={x1 + 4} y={y0 + 20} text="VENT" anchor="start" />
      <Leader points={[[x1 + 2, y0 + 57], [x1 - 7, y0 + 59]]} />
      <Note x={x1 + 4} y={y0 + 56} text="SANITISER" anchor="start" />
      <Note x={200} y={244} text="SKID-MOUNTED — NO POWER, NO PLUMBING" />

      {showDims && (
        <React.Fragment>
          <DimH x1={x0} x2={x1} y={44} label={ft(L)} ext={y0} />
          <DimV y1={y0} y2={y1} x={x0 - 20} label={ft(W)} ext={x0} dx={-3} />
        </React.Fragment>
      )}
    </React.Fragment>
  );
}

function Elevation({ showDims }) {
  const x0 = (400 - L * S) / 2;
  const x1 = x0 + L * S;
  const roof = 22;
  const grade = roof + H * S;
  const floor = grade - 6;
  const dw = DOOR_FT * S;
  const dx = x0 + (L * S - dw) / 2;
  const doorTop = floor - 6.17 * S;
  return (
    <React.Fragment>
      <Ground x1={100} x2={300} y={grade} />
      <path
        className="fh-dwg-outline"
        d={`M${x0} ${roof + 8}L${x0 + 10} ${roof}L${x1 - 10} ${roof}L${x1} ${roof + 8}Z`}
      />
      <rect className="fh-dwg-outline" x={x0} y={roof + 8} width={x1 - x0} height={floor - roof - 8} />
      <rect className="fh-dwg-outline" x={x0 - 2} y={floor} width={x1 - x0 + 4} height={6} />
      <rect className="fh-dwg-interior" x={dx} y={doorTop} width={dw} height={floor - doorTop} />
      <line className="fh-dwg-interior" x1={dx + 8} y1={doorTop + 8} x2={dx + dw - 8} y2={doorTop + 8} />
      <line className="fh-dwg-interior" x1={dx + 8} y1={doorTop + 13} x2={dx + dw - 8} y2={doorTop + 13} />
      <line className="fh-dwg-interior" x1={dx + 8} y1={doorTop + 18} x2={dx + dw - 8} y2={doorTop + 18} />
      <line className="fh-dwg-interior" x1={dx + dw - 6} y1={doorTop + 74} x2={dx + dw - 6} y2={doorTop + 82} />
      <rect className="fh-dwg-hidden" x={x1 - 14} y={roof + 10} width={9} height={70} />

      <Leader points={[[x1 + 6, roof + 26], [x1 - 6, roof + 30]]} />
      <Note x={x1 + 8} y={roof + 24} text="VENT STACK" anchor="start" />
      <Leader points={[[x0 - 8, grade - 13], [x0 - 1, floor + 3]]} />
      <Note x={x0 - 10} y={grade - 10} text="SKID BASE" anchor="end" />
      <Leader points={[[x0 - 8, doorTop + 9], [dx + 10, doorTop + 13]]} />
      <Note x={x0 - 10} y={doorTop + 12} text="LOUVRE VENTS" anchor="end" />

      {showDims && (
        <React.Fragment>
          <DimV y1={roof} y2={grade} x={x1 + 20} label={ft(H)} ext={x1} />
          <DimH x1={x0} x2={x1} y={grade + 28} label={ft(L)} ext={grade} />
        </React.Fragment>
      )}
    </React.Fragment>
  );
}

export function UnitStandardDrawing({ view, showDims = true, title }) {
  const plan = view !== 'elevation';
  return (
    <Plate title={title} desc={plan ? PLAN_DESC : ELEV_DESC}>
      {plan ? <Plan showDims={showDims} /> : <Elevation showDims={showDims} />}
    </Plate>
  );
}

export default UnitStandardDrawing;
