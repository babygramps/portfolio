import React from 'react';
import { Plate, RowTrailerPlan, TrailerElevation } from './primitives.jsx';

// 2-Station Trailer — 12'-0" x 7'-0" box, 8'-6" overall (fleet record: trailer-2).
// Both views are drawn at 18 px per foot so the pair reads as one sheet.

const S = 18;
const L = 12;
const W = 7;
const H = 8.5;
const N = 2;
const DOOR_FT = 2.5;

const PLAN_DESC =
  'Floor plan of a twelve foot by seven foot restroom trailer split down the middle into two private rooms of six feet each. Each room holds a flushing china toilet against the street-side wall, a hot-water sink, and its own outswing door on the curb side. Overall dimensions twelve feet by seven feet.';
const ELEV_DESC =
  'Side elevation of the same trailer: A-frame tongue and coupler with a drop-leg jack at the front, two entry doors with a step block at the forward door, a single road wheel on a marked axle centreline six feet behind the front wall, and eight feet six inches from grade to roof.';

export function Trailer2Drawing({ view, showDims = true, title }) {
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
          bottomNote="TWO OUTSWING DOORS — CURB SIDE"
          showDims={showDims}
        />
      ) : (
        <TrailerElevation
          L={L}
          H={H}
          S={S}
          doors={[0, 1].map((i) => ({ at: (i + 0.5) * (L / N) - DOOR_FT / 2, w: DOOR_FT }))}
          axleFt={6}
          showDims={showDims}
        />
      )}
    </Plate>
  );
}

export default Trailer2Drawing;
