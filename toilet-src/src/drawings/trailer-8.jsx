import React from 'react';
import {
  DimH,
  DimV,
  Door,
  Hatch,
  Note,
  PlanShell,
  Plate,
  Sink,
  Toilet,
  TrailerElevation,
  ft,
} from './primitives.jsx';

// 8-Station Trailer — 28'-0" x 8'-6" box, 9'-6" overall (fleet record: trailer-8).
// Four rooms per side off a centre spine, so both views run at 11 px per foot.

const S = 11;
const L = 28;
const W = 8.5;
const H = 9.5;
const BAYS = 4;
const BAY = L / BAYS;
const DOOR_FT = 2.5;
const bays = [0, 1, 2, 3];

const PLAN_DESC =
  'Floor plan of a twenty-eight foot by eight foot six inch restroom trailer. A centre spine wall runs the length of the box with four private rooms on each side, eight in total, each with its own outswing door, a flushing china toilet and a hot-water sink. Bays are seven feet on centre.';
const ELEV_DESC =
  'Side elevation of the same trailer: A-frame tongue and coupler, four entry doors on this side with step blocks where they clear the running gear, triple road wheels with the leading axle centreline thirteen feet seven inches behind the front wall, and nine feet six inches from grade to roof.';

function Plan({ showDims }) {
  const x0 = (400 - L * S) / 2;
  const x1 = x0 + L * S;
  const y0 = 96;
  const y1 = y0 + W * S;
  const spine = (y0 + y1) / 2;
  const dw = DOOR_FT * S;
  const parts = [1, 2, 3].map((i) => x0 + i * BAY * S);
  const centres = bays.map((i) => x0 + (i + 0.5) * BAY * S);
  const doorX = centres.map((c) => c - dw / 2);
  const walls = bays.map((i) => (i === 0 ? x0 + 4 : parts[i - 1] + 2));
  const rights = bays.map((i) => (i === BAYS - 1 ? x1 - 4 : parts[i] - 2));
  return (
    <React.Fragment>
      <PlanShell
        x0={x0}
        y0={y0}
        x1={x1}
        y1={y1}
        gapsTop={doorX.map((x) => [x, dw])}
        gapsBottom={doorX.map((x) => [x, dw])}
        vLines={parts}
        hLines={[[spine, x0 + 4, x1 - 4]]}
      />

      {bays.map((i) => (
        <React.Fragment key={i}>
          <Toilet x={walls[i]} y={spine + 22} s={S} dir="right" />
          <Sink x={centres[i] + 18} y={spine + 1} s={S} dir="down" />
          <Door x={doorX[i]} y={y1} w={dw} sx={1} sy={1} />
          <Hatch x={doorX[i]} y={y1 - 4} w={dw} h={4} />
          <Note x={centres[i]} y={y1 - 8} text={'STATION ' + (i + 1)} />

          <Toilet x={rights[i]} y={spine - 22} s={S} dir="left" />
          <Sink x={centres[i] - 18} y={spine - 1} s={S} dir="up" />
          <Door x={doorX[i]} y={y0} w={dw} sx={1} sy={-1} />
          <Hatch x={doorX[i]} y={y0} w={dw} h={4} />
          <Note x={centres[i]} y={y0 + 12} text={'STATION ' + (i + 5)} />
        </React.Fragment>
      ))}

      <Note x={200} y={252} text="EIGHT STATIONS — DOORS BOTH SIDES" />

      {showDims && (
        <React.Fragment>
          <DimH x1={x0} x2={x1} y={44} label={ft(L)} ext={y0} />
          <DimH x1={x0} x2={parts[0]} y={238} label={ft(BAY)} ext={y1} />
          <DimV y1={y0} y2={y1} x={x1 + 20} label={ft(W)} ext={x1} />
        </React.Fragment>
      )}
    </React.Fragment>
  );
}

export function Trailer8Drawing({ view, showDims = true, title }) {
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
          doors={bays.map((i) => ({ at: (i + 0.5) * BAY - DOOR_FT / 2, w: DOOR_FT }))}
          axleFt={13.6}
          axles={3}
          showDims={showDims}
        />
      )}
    </Plate>
  );
}

export default Trailer8Drawing;
