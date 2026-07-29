import React from 'react';
import { Plate, RowTrailerPlan, TrailerElevation } from './primitives.jsx';

// 3-Station Trailer — 16'-0" x 7'-0" box, 8'-6" overall (fleet record: trailer-3).
// Both views at 18 px per foot.

const S = 18;
const L = 16;
const W = 7;
const H = 8.5;
const N = 3;
const DOOR_FT = 2.5;

const PLAN_DESC =
  'Floor plan of a sixteen foot by seven foot restroom trailer divided into three private rooms of five feet four inches each. Every room has its own outswing door on the curb side, a flushing china toilet on the street-side wall and a hot-water sink beside the partition. Overall dimensions sixteen feet by seven feet.';
const ELEV_DESC =
  'Side elevation of the same trailer: A-frame tongue and coupler with a drop-leg jack, three entry doors with a step block at the forward door, tandem road wheels with the leading axle centreline eight feet behind the front wall, and eight feet six inches from grade to roof.';

export function Trailer3Drawing({ view, showDims = true, title }) {
  const plan = view !== 'elevation';
  return (
    <Plate title={title} desc={plan ? PLAN_DESC : ELEV_DESC}>
      {plan ? (
        <RowTrailerPlan
          L={L}
          W={W}
          S={S}
          N={N}
          doorFt={DOOR_FT}
          bottomNote="THREE OUTSWING DOORS — CURB SIDE"
          showDims={showDims}
        />
      ) : (
        <TrailerElevation
          L={L}
          H={H}
          S={S}
          doors={[0, 1, 2].map((i) => ({ at: (i + 0.5) * (L / N) - DOOR_FT / 2, w: DOOR_FT }))}
          axleFt={8}
          axles={2}
          showDims={showDims}
        />
      )}
    </Plate>
  );
}

export default Trailer3Drawing;
