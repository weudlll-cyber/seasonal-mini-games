/**
 * @file   games/seasonal-target/web/heat.ts
 * @module games/seasonal-target/web
 * @brief  What each tile of the grid shows: its heat step, its marks and its words, from a view.
 *
 * Responsibility: every guess a view carries (own always; others' from `numbers` on in shared
 *                 mode, the engine's newest 60, 02d §6) gathered per tile: the closest answer on
 *                 it (found first, then the nearer tier, then the smaller distance) gives the
 *                 tile its colour step from the server's tier (cold 1 … hot 5, or `correct`,
 *                 O45; nothing is computed here), the viewer's own guess its frame, a pending own
 *                 answer under Frost the "…", another player's guess the corner mark in their
 *                 list colour (`colors`, T125), and every guess on the tile its words for the
 *                 tooltip and the screen reader: player (by `names`, "You" for the viewer),
 *                 coordinates and answer. Never colour alone: the words name every guess.
 * Depends on:     @smg-game/seasonal-target (types), ./words
 * Used by:        ./TileGrid, ./TargetInput, ./SpectatorPanel, ./ResultPanel
 * Spec:           docs/spec/02d-game-seasonal-target.md §6
 */
import type { Cell, Feedback, MissTier } from '@smg-game/seasonal-target';

import { cellWords, longAnswer } from './words.js';

// The five colour steps, cold to hot, and the found target's own mark.
type Step = 1 | 2 | 3 | 4 | 5 | 'correct';

const STEPS: Readonly<Record<MissTier, Step>> = {
  wayOff: 1,
  cold: 1,
  cool: 2,
  warm: 3,
  hot: 4,
  burning: 5,
  justMissed: 5,
};

// Nearness of a tier, far to near, for the closest answer on a shared tile.
const NEARNESS: readonly MissTier[] = [
  'wayOff',
  'cold',
  'cool',
  'warm',
  'hot',
  'burning',
  'justMissed',
];

export const stepOf = (f: Feedback): Step => (f.kind === 'correct' ? 'correct' : STEPS[f.tier]);

// One guess on the grid: whose, where, and its answer once delivered.
export interface Shot {
  readonly cell: Cell;
  readonly own: boolean;
  readonly playerId: string | null;
  readonly feedback: Feedback | null;
}

export interface Tile {
  // The closest delivered answer on the tile, which colours it; null while none is.
  readonly best: Feedback | null;
  readonly own: boolean;
  // An own answer is on its way (Frost): with no answer to colour the tile, it shows "…".
  readonly pending: boolean;
  // Another player's list colour for the corner mark, or null.
  readonly mark: string | null;
  // Every guess on the tile in words, for the tooltip and the screen reader.
  readonly words: readonly string[];
}

interface Players {
  readonly names: Readonly<Record<string, string>>;
  readonly colors: Readonly<Record<string, string>>;
}

// A player the list has no colour for (none expected): a neutral mark, still named.
const NEUTRAL = 'var(--color-text-muted)';

export const tileKey = (c: Cell): string => `${String(c.x)},${String(c.y)}`;

// Whether answer `a` is closer than `b`: found first, then the nearer tier, then the distance.
function closer(a: Feedback, b: Feedback): boolean {
  if (b.kind === 'correct') return false;
  if (a.kind === 'correct') return true;
  const rank = NEARNESS.indexOf(a.tier) - NEARNESS.indexOf(b.tier);
  if (rank !== 0) return rank > 0;
  return 'distance' in a && 'distance' in b && a.distance < b.distance;
}

function shotWords(s: Shot, players: Players): string {
  const who = s.own ? 'You' : (players.names[s.playerId ?? ''] ?? String(s.playerId));
  if (s.feedback !== null) return `${who} — ${longAnswer(s.feedback)}`;
  return s.own ? `${who} — answer arriving` : `${who} guessed`;
}

// A tile no guess is on.
export const NO_TILE: Tile = { best: null, own: false, pending: false, mark: null, words: [] };

// The closer of the tile's answer so far and a new one (null: not delivered yet).
const better = (best: Feedback | null, f: Feedback | null): Feedback | null =>
  f === null || (best !== null && !closer(f, best)) ? best : f;

// The tile's corner mark: the first other player's list colour.
const markOf = (tile: Tile, s: Shot, players: Players): string | null =>
  tile.mark ?? (s.own ? null : (players.colors[s.playerId ?? ''] ?? NEUTRAL));

function add(tile: Tile, s: Shot, players: Players): Tile {
  return {
    best: better(tile.best, s.feedback),
    own: tile.own || s.own,
    pending: tile.pending || (s.own && s.feedback === null),
    mark: markOf(tile, s, players),
    words: [...tile.words, shotWords(s, players)],
  };
}

// Every tile with at least one guess, by `tileKey`, its words in the order of the shots.
export function tilesOf(shots: readonly Shot[], players: Players): ReadonlyMap<string, Tile> {
  const tiles = new Map<string, Tile>();
  for (const s of shots) {
    const key = tileKey(s.cell);
    tiles.set(key, add(tiles.get(key) ?? NO_TILE, s, players));
  }
  return tiles;
}

// The tooltip and label of one tile: "column 12, row 7: You — 9 tiles away; Anna — Warm",
// after the notes about the tile itself (fallen, outside the target area).
export function tileLabel(c: Cell, tile: Tile, notes: readonly string[]): string {
  const parts = [...notes, ...tile.words];
  return parts.length === 0 ? cellWords(c) : `${cellWords(c)}: ${parts.join('; ')}`;
}

interface Seen {
  readonly value: Cell | null;
  readonly feedback: Feedback | null;
}

// The shots of a view: own guesses, then the others' whose tile the view carries.
export function shotsOf(
  own: readonly Seen[],
  others: readonly (Seen & { readonly playerId: string })[],
): Shot[] {
  const mine = own.flatMap((g) =>
    g.value === null ? [] : [{ cell: g.value, own: true, playerId: null, feedback: g.feedback }],
  );
  const theirs = others.flatMap((g) =>
    g.value === null
      ? []
      : [{ cell: g.value, own: false, playerId: g.playerId, feedback: g.feedback }],
  );
  return [...mine, ...theirs];
}
