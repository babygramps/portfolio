import React from 'react';
import { DimH, DimV, Ground, Leader, Note, Plate, ft } from './primitives.jsx';

// Hand-Wash Station — 2'-6" x 2'-0" footprint, 5'-0" tall (fleet: station-handwash).
// No power, no plumbing: two foot-pump basins over a 22-gallon fresh tank.
// Both views at 38 px per foot.

const S = 38;
const L = 2.5;
const W = 2;
const H = 5;
const DECK_FT = 2.75;

const PLAN_DESC =
  'Plan of a free-standing hand-wash station two feet six inches by two feet. Two twelve-inch basins sit side by side in the deck, foot pumps project from the front at floor level, soap and paper-towel dispensers are mounted on the back panel, and the twenty-two gallon fresh tank sits below the deck, shown dashed.';
const ELEV_DESC =
  'Front elevation of the same station: a five foot tall unit with the basin deck at two feet nine inches above grade, a raised back panel carrying the soap and towel dispensers, the twenty-two gallon fresh tank shown dashed inside the body, and the two foot pumps at the base.';

function Plan({ showDims }) {
  const x0 = (400 - L * S) / 2;
  const x1 = x0 + L * S;
  const y0 = 100;
  const y1 = y0 + W * S;
  const bR = 0.5 * S;
  const b1 = x0 + 0.63 * S;
  const b2 = x1 - 0.63 * S;
  return (
    <React.Fragment>
      <rect className="fh-dwg-outline" x={x0} y={y0} width={x1 - x0} height={y1 - y0} />
      <rect className="fh-dwg-interior" x={x0 + 4} y={y0 + 4} width={x1 - x0 - 8} height={y1 - y0 - 8} />
      <rect className="fh-dwg-hidden" x={x0 + 8} y={y0 + 8} width={x1 - x0 - 16} height={y1 - y0 - 16} />

      <circle className="fh-dwg-fill" cx={b1} cy={y0 + 1 * S} r={bR} />
      <circle className="fh-dwg-fill" cx={b2} cy={y0 + 1 * S} r={bR} />
      <rect className="fh-dwg-fill" x={b1 - 6} y={y0 + 4} width={12} height={5} />
      <rect className="fh-dwg-fill" x={b2 - 6} y={y0 + 4} width={12} height={5} />
      <rect className="fh-dwg-fill" x={b1 - 7} y={y1} width={14} height={7} />
      <rect className="fh-dwg-fill" x={b2 - 7} y={y1} width={14} height={7} />

      <Note x={b1} y={y0 + 1 * S + 3} text="1" />
      <Note x={b2} y={y0 + 1 * S + 3} text="2" />
      <Leader points={[[x0 - 6, y0 + 4], [x0 + 6, y0 + 7]]} />
      <Note x={x0 - 8} y={y0 + 6} text="SOAP + TOWEL" anchor="end" />
      <Leader points={[[x0 - 6, y0 + 48], [x0 + 10, y0 + 50]]} />
      <Note x={x0 - 8} y={y0 + 50} text="22-GAL TANK BELOW" anchor="end" />
      <Leader points={[[b1, y1 + 18], [b1, y1 + 8]]} />
      <Leader points={[[b2, y1 + 18], [b2, y1 + 8]]} />
      <Note x={200} y={y1 + 28} text="FOOT PUMPS" />
      <Note x={200} y={248} text="TWO BASINS — NO POWER, NO PLUMBING" />

      {showDims && (
        <React.Fragment>
          <DimH x1={x0} x2={x1} y={64} label={ft(L)} ext={y0} />
          <DimV y1={y0} y2={y1} x={x1 + 20} label={ft(W)} ext={x1} />
        </React.Fragment>
      )}
    </React.Fragment>
  );
}

function Elevation({ showDims }) {
  const x0 = (400 - L * S) / 2;
  const x1 = x0 + L * S;
  const roof = 17;
  const grade = roof + H * S;
  const deck = grade - DECK_FT * S;
  const panelIn = 14;
  const b1 = x0 + 0.63 * S;
  const b2 = x1 - 0.63 * S;
  return (
    <React.Fragment>
      <Ground x1={110} x2={290} y={grade} />
      <rect className="fh-dwg-outline" x={x0 + panelIn} y={roof} width={x1 - x0 - 2 * panelIn} height={deck - 10 - roof} />
      <rect className="fh-dwg-outline" x={x0} y={deck - 10} width={x1 - x0} height={10} />
      <rect className="fh-dwg-outline" x={x0 + 3} y={deck} width={x1 - x0 - 6} height={grade - deck} />
      <rect className="fh-dwg-hidden" x={x0 + 9} y={deck + 8} width={x1 - x0 - 18} height={grade - deck - 16} />
      <rect className="fh-dwg-fill" x={x0 + panelIn + 6} y={roof + 16} width={16} height={22} />
      <rect className="fh-dwg-fill" x={x1 - panelIn - 22} y={roof + 16} width={16} height={22} />
      <rect className="fh-dwg-fill" x={b1 - 7} y={grade - 9} width={14} height={9} />
      <rect className="fh-dwg-fill" x={b2 - 7} y={grade - 9} width={14} height={9} />

      <Leader points={[[x0 + panelIn - 6, roof + 22], [x0 + panelIn + 6, roof + 26]]} />
      <Note x={x0 + panelIn - 8} y={roof + 20} text="SOAP + TOWEL" anchor="end" />
      <Leader points={[[x0 - 28, deck + 30], [x0 + 10, deck + 26]]} />
      <Note x={x0 - 30} y={deck + 32} text="22-GAL FRESH TANK" anchor="end" />
      <Leader points={[[b1, grade + 10], [b1, grade - 2]]} />
      <Leader points={[[b2, grade + 10], [b2, grade - 2]]} />
      <Note x={200} y={grade + 18} text="FOOT PUMPS" />

      {showDims && (
        <React.Fragment>
          <DimV y1={roof} y2={grade} x={x1 + 20} label={ft(H)} ext={x1} />
          <DimV y1={deck - 10} y2={grade} x={x0 - 20} label={ft(DECK_FT)} ext={x0} dx={-3} />
          <DimH x1={x0} x2={x1} y={grade + 40} label={ft(L)} ext={grade} />
        </React.Fragment>
      )}
    </React.Fragment>
  );
}

export function StationHandwashDrawing({ view, showDims = true, title }) {
  const plan = view !== 'elevation';
  return (
    <Plate title={title} desc={plan ? PLAN_DESC : ELEV_DESC}>
      {plan ? <Plan showDims={showDims} /> : <Elevation showDims={showDims} />}
    </Plate>
  );
}

export default StationHandwashDrawing;
