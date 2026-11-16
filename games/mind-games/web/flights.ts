/**
 * @file   games/mind-games/web/flights.ts
 * @module games/mind-games/web
 * @brief  One wave of flights from two released feed steps, and where each flight flies.
 *
 * Responsibility: the animation's data (02e §11.1), from the delayed view only: the screens
 *                 get each released step as a new view, never an event of their own, so a
 *                 wave is the difference between the view shown and the next one. Each new
 *                 line is a flight: a first choice flies in with the player's name to its
 *                 season, a named switch from the old season to the new one. A switch the feed
 *                 shows only in its counts (02e §6.3) is the change of the counts no new line
 *                 explains: each option that lost a player sends a nameless icon to one that
 *                 gained one, in option order. Nothing is counted for display: the counts shown
 *                 are always the step's own. At most 12 icons fly at once, the rest is "+8".
 *                 Each flight gets a slot of its own where it starts and where it lands
 *                 (`placeWave`, DECISIONS T376): slots spread across the column one icon's
 *                 room apart, the middle first; where a column has more flights than slots,
 *                 rows 4 px lower, every second a quarter slot aside; never a slot a flight
 *                 still in the air holds, starts and landings counted apart.
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
  // The player's key on a first choice's flight; null on a switch, named or hidden.
  readonly player: string | null;
}

export interface Wave {
  readonly flights: readonly Flight[];
  // The flights beyond the cap ("+8").
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

// The wave from the view shown to the next released one; none on the first view.
export function waveOf(prev: SpectatorView | null, next: SpectatorView): Wave {
  if (prev === null) return { flights: [], more: 0 };
  const lines = newLines(prev, next);
  const named: Flight[] = lines.map((l) => ({
    key: `l:${lineKey(l)}`,
    from: l.from,
    to: l.choice,
    player: l.from === null ? l.playerKey : null,
  }));
  const hidden: Flight[] = hiddenMoves(prev, next, lines).map((m, i) => ({
    key: `h:${String(next.lines[0]?.at ?? 0)}:${String(i)}:${m.from}:${m.to}`,
    from: m.from,
    to: m.to,
    player: null,
  }));
  const all = [...named, ...hidden];
  return { flights: all.slice(0, WAVE_CAP), more: Math.max(0, all.length - WAVE_CAP) };
}

// The room an icon (26 px) needs beside the next one in a column, and the rows' vertical
// steps where a column has more flights than slots (DECISIONS T376).
export const SLOT_PX = 30;
const ROW_PX = 4;
const ROWS = 3;

// Where a flight's icon starts or lands: its centre as a share of the band's width, and its
// step down from the icons' line in px.
export interface Spot {
  readonly x: number;
  readonly y: number;
}

// A column's slots, the middle first: [2, 1, 3, 0, 4] for five, so a lone flight lands in the
// middle and the next ones spread out to both sides.
const middleOut = (per: number): number[] =>
  Array.from({ length: per }, (_, i) => i).sort(
    (a, b) => Math.abs(a - (per - 1) / 2) - Math.abs(b - (per - 1) / 2) || a - b,
  );

// Slot j of a column: `column` of `columns` across a band `bandPx` wide (`columns` itself is
// the strip just past the band's right edge, where a first choice comes from). As many slots
// as fit one SLOT_PX apart; past them more rows, each one 4 px lower than the last (three
// steps) and every second one a quarter of a slot to the right, so six rows meet on no point.
export function spotOf(column: number, columns: number, bandPx: number, j: number): Spot {
  const per = Math.max(1, Math.floor(bandPx / columns / SLOT_PX));
  const row = Math.floor(j / per);
  const slot = middleOut(per)[j % per] ?? 0;
  const within = (slot + (row % 2 === 1 ? 0.75 : 0.5)) / per;
  return { x: (column + within) / columns, y: (row % ROWS) * ROW_PX };
}

export interface Placed {
  readonly flight: Flight;
  readonly start: Spot;
  readonly end: Spot;
}

// A slot held by a flight in the air: ['to:winter', 2] where it lands, ['from:summer', 0] or
// ['from:edge', 0] (a first choice) where it starts. Starts and landings are counted apart: a
// flight leaves its start at once and reaches its landing only at the end.
export type Claim = readonly [string, number];

// The slots in use, by the flights still in the air.
export type Taken = ReadonlyMap<string, ReadonlySet<number>>;

// A wave's flights placed, each in a slot of its own where it starts and where it lands, in
// wave order and around every slot still held by an earlier wave; the slots it takes.
export function placeWave(
  wave: Wave,
  options: readonly Choice[],
  bandPx: number,
  taken: Taken,
): { readonly placed: Placed[]; readonly claims: Claim[] } {
  const used = new Map([...taken].map(([c, s]) => [c, new Set(s)]));
  const claims: Claim[] = [];
  const claim = (end: 'from' | 'to', column: Choice | null): Spot => {
    const name = `${end}:${column ?? 'edge'}`;
    const held = used.get(name) ?? new Set<number>();
    used.set(name, held);
    let j = 0;
    while (held.has(j)) j += 1;
    held.add(j);
    claims.push([name, j]);
    const index = column === null ? options.length : options.indexOf(column);
    return spotOf(index, options.length, bandPx, j);
  };
  const placed = wave.flights.map((flight) => ({
    flight,
    start: claim('from', flight.from),
    end: claim('to', flight.to),
  }));
  return { placed, claims };
}
