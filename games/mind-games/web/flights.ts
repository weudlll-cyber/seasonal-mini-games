/**
 * @file   games/mind-games/web/flights.ts
 * @module games/mind-games/web
 * @brief  One wave of flights from two released feed steps, and where each flight flies.
 *
 * Responsibility: the animation's data (02e §11.1), from the delayed view only: the screens
 *                 get each released step as a new view, never an event of their own, so a
 *                 wave is the difference between the view shown and the next one. Each new
 *                 line is one player's move the feed names: a first choice from the band's edge
 *                 or a visible switch from the old season, both with the player's name. A
 *                 switch the feed shows only in its counts (02e §6.3) is the change of the
 *                 counts no new line explains: each option that lost a player sends a nameless
 *                 icon to one that gained one, in option order. One step's moves with the same
 *                 from → to fly as one icon, "×N" from two on and without a name (DECISIONS
 *                 T377); at most 12 icons in a wave, the players of the rest as "+8". Nothing is
 *                 counted for display: the counts shown are always the step's own. Each icon
 *                 gets its points (`placeWave`): the icons landing in one card spread
 *                 symmetrically around the card's measured middle, a lone one on it, one icon's
 *                 room apart where the card has it (named ones as far apart as their names
 *                 need), closer down to a fifth's overlap, smaller where even that does not
 *                 fit; the icons leaving one card the same way; never a point an icon of
 *                 another wave still holds there.
 * Depends on:     @smg-game/mind-games (options, views)
 * Used by:        ./FlightBand, ./landing.test
 * Spec:           docs/spec/02e-game-mind-games.md §11.1; docs/spec/09-testing-strategy.md §4.2
 */
import {
  optionsOf,
  type Choice,
  type FeedLineView,
  type SpectatorView,
} from '@smg-game/mind-games';

export const WAVE_CAP = 12;

export interface Flight {
  readonly key: string;
  // Null: a first choice, flying in from the band's edge.
  readonly from: Choice | null;
  readonly to: Choice;
  // The player's key when one player flies and the feed names them (a first choice or a
  // visible switch); null on a hidden switch and on a group.
  readonly player: string | null;
  // The players flying as this one icon ("×3" from two on).
  readonly count: number;
}

export interface Wave {
  readonly flights: readonly Flight[];
  // The players of the icons beyond the cap ("+8").
  readonly more: number;
}

const lineKey = (l: FeedLineView) => `${String(l.at)}:${l.playerKey}`;

// The lines of `next` that `prev` did not hold, oldest first.
function newLines(prev: SpectatorView, next: SpectatorView): FeedLineView[] {
  const seen = new Set(prev.lines.map(lineKey));
  const newest = prev.lines[0]?.at ?? -Infinity;
  return next.lines.filter((l) => !seen.has(lineKey(l)) && l.at >= newest).reverse();
}

// The nameless moves the counts show beyond the new lines: losses paired with gains.
function hiddenMoves(
  prev: SpectatorView,
  next: SpectatorView,
  lines: readonly FeedLineView[],
): { from: Choice; to: Choice }[] {
  const options = optionsOf(next.rules.allOption);
  const rest = new Map(options.map((c) => [c, next.counts[c] - prev.counts[c]]));
  for (const l of lines) {
    rest.set(l.choice, (rest.get(l.choice) ?? 0) - 1);
    if (l.from !== null) rest.set(l.from, (rest.get(l.from) ?? 0) + 1);
  }
  const losses = options.flatMap((c) => Array<Choice>(Math.max(0, -(rest.get(c) ?? 0))).fill(c));
  const gains = options.flatMap((c) => Array<Choice>(Math.max(0, rest.get(c) ?? 0)).fill(c));
  return losses.slice(0, gains.length).map((from, i) => ({ from, to: gains[i] ?? from }));
}

// One icon per from → to, in the order each first appears; a group of two or more is nameless.
function grouped(moves: readonly Flight[]): Flight[] {
  const groups = new Map<string, Flight>();
  for (const m of moves) {
    const id = `${m.from ?? 'edge'}>${m.to}`;
    const g = groups.get(id);
    groups.set(id, g === undefined ? m : { ...g, player: null, count: g.count + 1 });
  }
  return [...groups.values()];
}

// The wave from the view shown to the next released one; none on the first view.
export function waveOf(prev: SpectatorView | null, next: SpectatorView): Wave {
  if (prev === null) return { flights: [], more: 0 };
  const lines = newLines(prev, next);
  const named: Flight[] = lines.map((l) => ({
    key: `l:${lineKey(l)}`,
    from: l.from,
    to: l.choice,
    player: l.playerKey,
    count: 1,
  }));
  const hidden: Flight[] = hiddenMoves(prev, next, lines).map((m, i) => ({
    key: `h:${String(next.lines[0]?.at ?? 0)}:${String(i)}:${m.from}:${m.to}`,
    from: m.from,
    to: m.to,
    player: null,
    count: 1,
  }));
  const all = grouped([...named, ...hidden]);
  const rest = all.slice(WAVE_CAP).reduce((n, f) => n + f.count, 0);
  return { flights: all.slice(0, WAVE_CAP), more: rest };
}

// An icon's size in flight (All's square of four is larger, DECISIONS T377), its room beside
// the next one where the card has it, and the least: two icons overlap by less than a fifth
// of their width (82 % of it apart). A card with more icons than fit that close shrinks
// them until they do.
export const ICON_PX = 26;
const ALL_PX = 36;
const sizeOf = (c: Choice | null): number => (c === 'all' ? ALL_PX : ICON_PX);
const LEAST = 0.82;

// Where an icon starts or lands: its centre in px from the band's left, and its scale there
// (1 but in a crowded card).
export interface Spot {
  readonly x: number;
  readonly scale: number;
}

// A card as measured: its middle in px from the band's left, and the room its icons may
// spread over (the card's width inside its frame).
interface Column {
  readonly middle: number;
  readonly room: number;
}

// The band's measure: its width, a column per option (in option order), and the strip past
// the band's right edge a first choice comes from.
export interface Layout {
  readonly width: number;
  readonly columns: readonly Column[];
  readonly edge: Column;
  // A player's name label's width in px, as near as known before it is drawn.
  readonly labelPx: (player: string) => number;
}

// `k` icons of `size` around a column's middle, symmetric, one icon's room apart (its size
// and 4 px, or `apart` where names above them need more) where the column allows, closer
// down to a fifth's overlap, and smaller where even that does not fit (never under 0.3);
// `shift` moves them all aside. A lone icon sits on the middle.
export function spread(
  column: Column,
  k: number,
  size: number,
  more: { readonly shift?: number; readonly apart?: number } = {},
): Spot[] {
  const { shift = 0, apart = 0 } = more;
  const scale =
    k < 2 ? 1 : Math.min(1, Math.max(0.3, column.room / (size * (1 + LEAST * (k - 1)))));
  const s = size * scale;
  const step = k < 2 ? 0 : Math.min(Math.max(s + 4, apart), (column.room - s) / (k - 1));
  return Array.from({ length: k }, (_, j) => ({
    x: column.middle + shift + (j - (k - 1) / 2) * step,
    scale,
  }));
}

// The first spread, centred if it can be, clear of the points other waves hold: shifted by
// half an icon's room at a time, to the right first; centred anyway if none is clear.
function clearOf(
  column: Column,
  want: { readonly k: number; readonly size: number; readonly apart: number },
  held: readonly Spot[],
): Spot[] {
  const { k, size, apart } = want;
  const clear = (a: Spot, b: Spot) =>
    Math.abs(a.x - b.x) >= LEAST * size * Math.min(a.scale, b.scale);
  const half = (size + 4) / 2;
  for (let i = 0; i <= 2 * Math.ceil(column.room / half); i += 1) {
    const shift = (i % 2 === 1 ? 1 : -1) * Math.ceil(i / 2) * half;
    const spots = spread(column, k, size, { shift, apart });
    if (spots.every((p) => held.every((h) => clear(p, h)))) return spots;
  }
  return spread(column, k, size, { apart });
}

export interface Placed {
  readonly flight: Flight;
  readonly start: Spot;
  readonly end: Spot;
}

// A point held by an icon of a wave in the air: ['to:winter', spot] where it lands,
// ['from:summer', spot] or ['from:edge', spot] (a first choice) where it starts.
export type Claim = readonly [string, Spot];

// The points in use, by the icons of the waves still near them.
export type Taken = ReadonlyMap<string, readonly Spot[]>;

// A wave's icons placed: those landing in one card spread around its middle, those leaving
// one card around its middle, clear of the points other waves hold; the points it takes.
export function placeWave(
  wave: Wave,
  options: readonly Choice[],
  layout: Layout,
  taken: Taken,
): { readonly placed: Placed[]; readonly claims: Claim[] } {
  const columnOf = (c: Choice | null) =>
    (c === null ? layout.edge : layout.columns[options.indexOf(c)]) ?? layout.edge;
  const claims: Claim[] = [];
  // Each end's points, per column, in wave order.
  const points = (end: 'from' | 'to', choiceOf: (f: Flight) => Choice | null) => {
    const by = new Map<string, Flight[]>();
    for (const f of wave.flights) {
      const c = choiceOf(f);
      const name = `${end}:${c ?? 'edge'}`;
      by.set(name, [...(by.get(name) ?? []), f]);
    }
    const at = new Map<Flight, Spot>();
    for (const [name, flights] of by) {
      const c = choiceOf(flights[0] as Flight);
      // Two names or more above one card's icons: as far apart as the widest name needs.
      const named = flights.flatMap((f) => (f.player === null ? [] : [layout.labelPx(f.player)]));
      const apart = named.length < 2 ? 0 : Math.max(...named) + 4;
      const want = { k: flights.length, size: sizeOf(c), apart };
      const spots = clearOf(columnOf(c), want, taken.get(name) ?? []);
      flights.forEach((f, i) => {
        const s = spots[i] ?? { x: 0, scale: 1 };
        at.set(f, s);
        claims.push([name, s]);
      });
    }
    return at;
  };
  const starts = points('from', (f) => f.from);
  const ends = points('to', (f) => f.to);
  const placed = wave.flights.map((flight) => ({
    flight,
    start: starts.get(flight) ?? { x: 0, scale: 1 },
    end: ends.get(flight) ?? { x: 0, scale: 1 },
  }));
  return { placed, claims };
}
