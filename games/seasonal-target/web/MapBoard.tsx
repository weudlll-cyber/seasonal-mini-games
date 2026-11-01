/**
 * @file   games/seasonal-target/web/MapBoard.tsx
 * @module games/seasonal-target/web
 * @brief  The map: a square-celled grid of the shown area, scaled to the space it gets.
 *
 * Responsibility: an SVG of the shown area only (the whole map, or the current target area
 *                 scaled up with coordinates staying absolute, 02d §8.4): grid lines, a heavier
 *                 line and an edge tick with its number every 10 cells, fallen cells greyed
 *                 and hatched, Spring's quarter as a dashed outline with its name in a corner,
 *                 the dots (each in its player's colour, own ones ringed, a pending own one
 *                 hollow with "…", the answer's arrow on a direction answer), the selection as a
 *                 thick square with crosshair ticks, and on the result the target with a ring.
 *                 A margin on every edge holds the tick numbers, the last ones ("50") included.
 *                 A click or tap selects the nearest cell; nothing here sends anything (05 §3.1).
 *                 Every dot is focusable and names the player, the cell and the answer as its
 *                 title (hover) and label (focus), beside its row in the list; colour is never
 *                 alone.
 * Depends on:     react, @smg-game/seasonal-target (types), ./dots
 * Used by:        ./TargetInput, ./SpectatorPanel, ./ResultPanel
 * Spec:           docs/spec/02d-game-seasonal-target.md §6, §8, §9, §11
 */
import {
  inArea,
  type Area,
  type Cell,
  type Compass,
  type Quarter,
} from '@smg-game/seasonal-target';
import type { CSSProperties, KeyboardEvent, MouseEvent, ReactElement } from 'react';

import type { Dot } from './dots.js';

export interface MapBoardProps {
  readonly shown: Area;
  readonly dots: readonly Dot[];
  readonly fallen: readonly Cell[];
  readonly quarter?: Quarter | null;
  readonly selection?: Cell | null;
  readonly target?: Cell | null;
  readonly label: string;
  readonly onSelect?: (cell: Cell) => void;
  readonly onKeyDown?: (e: KeyboardEvent<SVGSVGElement>) => void;
}

// Degrees clockwise from north for each answer's arrow.
const ANGLE: Readonly<Record<Compass, number>> = {
  N: 0,
  NE: 45,
  E: 90,
  SE: 135,
  S: 180,
  SW: 225,
  W: 270,
  NW: 315,
};

// The view box: the shown cells and margins for the edge ticks, in a share `m` of the longer
// side: m on the top, 1.4 m on the left (a three-digit row number in a phone's larger type),
// and half of m on the right and bottom, where the last tick's number reaches past the edge.
function frame(a: Area) {
  const w = a.right - a.left + 1;
  const h = a.bottom - a.top + 1;
  const m = Math.max(w, h) * 0.08;
  return { x: a.left - 1 - m * 1.4, y: a.top - 1 - m, w: w + m * 1.9, h: h + m * 1.5, m };
}

// Every line between cells, heavier on multiples of 10.
function Grid({ a }: { readonly a: Area }): ReactElement {
  const cols = Array.from({ length: a.right - a.left + 2 }, (_, i) => a.left - 1 + i);
  const rows = Array.from({ length: a.bottom - a.top + 2 }, (_, i) => a.top - 1 + i);
  const cls = (v: number) => (v % 10 === 0 ? 'st-line st-line--ten' : 'st-line');
  return (
    <g aria-hidden="true">
      {cols.map((x) => (
        <line key={`c${String(x)}`} className={cls(x)} x1={x} x2={x} y1={a.top - 1} y2={a.bottom} />
      ))}
      {rows.map((y) => (
        <line key={`r${String(y)}`} className={cls(y)} y1={y} y2={y} x1={a.left - 1} x2={a.right} />
      ))}
    </g>
  );
}

// The numbers on the top and left edges: the first cell and every tenth.
function Ticks({ a, m }: { readonly a: Area; readonly m: number }): ReactElement {
  const marks = (low: number, high: number) =>
    Array.from({ length: high - low + 1 }, (_, i) => low + i).filter(
      (v) => v === low || v % 10 === 0,
    );
  const size = m * 0.55;
  return (
    <g className="st-ticks" aria-hidden="true" fontSize={size}>
      {marks(a.left, a.right).map((x) => (
        <text key={`x${String(x)}`} x={x - 0.5} y={a.top - 1 - m * 0.25} textAnchor="middle">
          {x}
        </text>
      ))}
      {marks(a.top, a.bottom).map((y) => (
        <text
          key={`y${String(y)}`}
          x={a.left - 1 - m * 0.15}
          y={y - 0.5}
          textAnchor="end"
          dominantBaseline="central"
        >
          {y}
        </text>
      ))}
    </g>
  );
}

function DotMark({ d }: { readonly d: Dot }): ReactElement {
  const cx = d.cell.x - 0.5;
  const cy = d.cell.y - 0.5;
  return (
    <g
      className="st-dot"
      data-own={d.own}
      data-pending={d.pending}
      data-testid="map-dot"
      tabIndex={0}
      role="img"
      aria-label={d.label}
    >
      <title>{d.label}</title>
      <circle
        cx={cx}
        cy={cy}
        r={d.own ? 0.42 : 0.34}
        style={{ fill: d.pending ? 'none' : d.color }}
      />
      {d.pending ? (
        <text x={cx} y={cy} fontSize={0.6} textAnchor="middle" dominantBaseline="central">
          …
        </text>
      ) : null}
      {d.arrow === null ? null : (
        <line
          className="st-arrow"
          x1={cx}
          y1={cy}
          x2={cx}
          y2={cy - 0.5}
          transform={`rotate(${String(ANGLE[d.arrow])} ${String(cx)} ${String(cy)})`}
        />
      )}
    </g>
  );
}

// The selection: a thick square with crosshair ticks, unlike any dot.
function Marker({ c }: { readonly c: Cell }): ReactElement {
  const x = c.x - 1;
  const y = c.y - 1;
  return (
    <g className="st-selection" aria-hidden="true" data-testid="map-selection">
      <rect x={x + 0.05} y={y + 0.05} width={0.9} height={0.9} />
      <line x1={x + 0.5} x2={x + 0.5} y1={y - 0.35} y2={y + 0.1} />
      <line x1={x + 0.5} x2={x + 0.5} y1={y + 0.9} y2={y + 1.35} />
      <line y1={y + 0.5} y2={y + 0.5} x1={x - 0.35} x2={x + 0.1} />
      <line y1={y + 0.5} y2={y + 0.5} x1={x + 0.9} x2={x + 1.35} />
    </g>
  );
}

function QuarterMark({ q, m }: { readonly q: Quarter; readonly m: number }): ReactElement {
  return (
    <g className="st-quarter" data-testid="map-quarter">
      <rect
        x={q.left - 1}
        y={q.top - 1}
        width={q.right - q.left + 1}
        height={q.bottom - q.top + 1}
      />
      <text x={q.left - 0.6} y={q.top - 0.6 + m * 0.45} fontSize={m * 0.5}>
        {q.name}
      </text>
    </g>
  );
}

// The drawn ground: the hatch pattern, the shown cells and the fallen ones among them.
function Ground({ a, fallen }: { readonly a: Area; readonly fallen: readonly Cell[] }) {
  return (
    <>
      <defs>
        <pattern
          id="st-hatch"
          width={0.5}
          height={0.5}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line className="st-hatch-line" x1={0} y1={0} x2={0} y2={0.5} />
        </pattern>
      </defs>
      <rect
        className="st-ground"
        x={a.left - 1}
        y={a.top - 1}
        width={a.right - a.left + 1}
        height={a.bottom - a.top + 1}
      />
      {fallen
        .filter((c) => inArea(a, c))
        .map((c) => (
          <rect
            key={`${String(c.x)}-${String(c.y)}`}
            className="st-fallen"
            x={c.x - 1}
            y={c.y - 1}
            width={1}
            height={1}
            data-testid="map-fallen"
          />
        ))}
    </>
  );
}

// The result's target: a ring in the season colour around a dark centre.
function TargetMark({ c }: { readonly c: Cell }): ReactElement {
  return (
    <g className="st-target" data-testid="map-target">
      <circle cx={c.x - 0.5} cy={c.y - 0.5} r={0.9} />
      <circle cx={c.x - 0.5} cy={c.y - 0.5} r={0.3} />
    </g>
  );
}

// The cell nearest to a click: the drawing is centred and scaled to fit the box; null in a box
// without a size.
function cellAt(e: MouseEvent<SVGSVGElement>, a: Area): Cell | null {
  const f = frame(a);
  const r = e.currentTarget.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return null;
  const s = Math.min(r.width / f.w, r.height / f.h);
  const left = r.left + (r.width - f.w * s) / 2;
  const top = r.top + (r.height - f.h * s) / 2;
  const x = Math.floor(f.x + (e.clientX - left) / s) + 1;
  const y = Math.floor(f.y + (e.clientY - top) / s) + 1;
  return { x: Math.min(a.right, Math.max(a.left, x)), y: Math.min(a.bottom, Math.max(a.top, y)) };
}

export function MapBoard(p: MapBoardProps): ReactElement {
  const a = p.shown;
  const f = frame(a);
  const click = (e: MouseEvent<SVGSVGElement>): void => {
    const c = cellAt(e, a);
    if (c !== null) p.onSelect?.(c);
  };
  return (
    <svg
      className="st-map"
      viewBox={`${String(f.x)} ${String(f.y)} ${String(f.w)} ${String(f.h)}`}
      style={{ '--st-ratio': String(f.w / f.h), '--st-m': String(f.m) } as CSSProperties}
      role="group"
      aria-label={p.label}
      tabIndex={p.onKeyDown === undefined ? undefined : 0}
      onClick={click}
      onKeyDown={p.onKeyDown}
      data-testid="map"
    >
      <Ground a={a} fallen={p.fallen} />
      <Grid a={a} />
      <Ticks a={a} m={f.m} />
      {p.quarter == null ? null : <QuarterMark q={p.quarter} m={f.m} />}
      {p.dots
        .filter((d) => inArea(a, d.cell))
        .map((d) => (
          <DotMark key={d.key} d={d} />
        ))}
      {p.target == null ? null : <TargetMark c={p.target} />}
      {p.selection == null ? null : <Marker c={p.selection} />}
    </svg>
  );
}
