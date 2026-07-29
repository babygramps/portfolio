import React from 'react';
import Trailer2Drawing from './trailer-2.jsx';
import Trailer3Drawing from './trailer-3.jsx';
import Trailer4Drawing from './trailer-4.jsx';
import Trailer8Drawing from './trailer-8.jsx';
import TrailerAdaDrawing from './trailer-ada.jsx';
import UnitStandardDrawing from './unit-standard.jsx';
import StationHandwashDrawing from './station-handwash.jsx';

// Drawing registry (CONTRACT §C.2). Keys are fleet ids, which are also the
// `drawing` field on every fleet record.
export const DRAWINGS = {
  'trailer-2': Trailer2Drawing,
  'trailer-3': Trailer3Drawing,
  'trailer-4': Trailer4Drawing,
  'trailer-8': Trailer8Drawing,
  'trailer-ada': TrailerAdaDrawing,
  'unit-standard': UnitStandardDrawing,
  'station-handwash': StationHandwashDrawing,
};

// Rendered when an id is not in the registry: a real plate saying so, never null.
function MissingDrawing({ title }) {
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
      <desc>No drawing is on file for this unit.</desc>
      <rect className="fh-dwg-hidden" x={60} y={70} width={280} height={120} />
      <text className="fh-dwg-callout" x={200} y={135} textAnchor="middle">
        DRAWING NOT ON FILE
      </text>
    </svg>
  );
}

export function Drawing({ id, view, showDims = true, title }) {
  const Component = DRAWINGS[id];
  if (!Component) return <MissingDrawing title={title} />;
  return <Component view={view} showDims={showDims} title={title} />;
}

export function DrawingPlate({ id, view, showDims = true, title, label, caption }) {
  return (
    <figure className="fh-drawing">
      <div className="fh-drawing__frame">
        <Drawing id={id} view={view} showDims={showDims} title={title} />
      </div>
      <figcaption className="fh-drawing__caption">
        <span className="fh-drawing__label">{label}</span>
        <span>{caption}</span>
      </figcaption>
    </figure>
  );
}
