import React from 'react';
import { Plate, RowTrailerPlan, TrailerElevation } from './primitives.jsx';

// 4-Station Trailer — 20'-0" x 8'-0" box, 9'-0" overall (fleet record: trailer-4).
// Both views at 15 px per foot.

const S = 15;
const L = 20;
const W = 8;
const H = 9;
const N = 4;
const DOOR_FT = 2.5;

const PLAN_DESC =
  'Floor plan of a twenty foot by eight foot restroom trailer divided into four private rooms of five feet each. Each room has a separate outswing door on the curb side, a flushing china toilet on the street-side wall and a hot-water sink, so four guests are served at once with no shared vestibule. Overall dimensions twenty feet by eight feet.';
const ELEV_DESC =
  'Side elevation of the same trailer: A-frame tongue and coupler with a drop-leg jack, four entry doors with step blocks where they clear the wheels, tandem road wheels with the leading axle centreline ten feet five inches behind the front wall, and nine feet from grade to roof.';

export function Trailer4Drawing({ view, showDims = true, title }) {
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
          bottomNote="FOUR OUTSWING DOORS — CURB SIDE"
          showDims={showDims}
        />
      ) : (
        <TrailerElevation
          L={L}
          H={H}
          S={S}
          doors={[0, 1, 2, 3].map((i) => ({ at: (i + 0.5) * (L / N) - DOOR_FT / 2, w: DOOR_FT }))}
          axleFt={10.4}
          axles={2}
          showDims={showDims}
        />
      )}
    </Plate>
  );
}

export default Trailer4Drawing;
