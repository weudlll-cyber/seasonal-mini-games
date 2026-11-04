/**
 * @file   packages/game-sdk/src/marks.ts
 * @module game-sdk
 * @brief  Each player's tag, colour and marker shape, for rounds with 20 players or more.
 *
 * Responsibility: a player is told apart by a short tag, "you" for the viewer, else their
 *                 number as public views show it ("p3"; a Quick Test bot "bot-07" as "b7"),
 *                 with a colour and a marker shape only to support it (O62): eight colours
 *                 (the `--mark-1` … `--mark-8` tokens, whose hues the heat scale does not use)
 *                 times three shapes (filled dot, ring, square) give 24 combinations, handed
 *                 out in the roster's (join) order, the colour first, so none repeats before
 *                 the 25th player. The platform's list and Players panel and a game's board
 *                 use the same marks.
 * Depends on:     -
 * Used by:        ./index, apps/web/src/round, games/seasonal-target/web
 * Spec:           docs/spec/02d-game-seasonal-target.md §11 (owner decision 62)
 */

export type MarkShape = 'dot' | 'ring' | 'square';

export interface PlayerMark {
  readonly tag: string;
  readonly color: string;
  readonly shape: MarkShape;
}

export const MARK_COLORS: readonly string[] = Array.from(
  { length: 8 },
  (_, i) => `var(--mark-${String(i + 1)})`,
);

export const MARK_SHAPES: readonly MarkShape[] = ['dot', 'ring', 'square'];

// The tag of a player key as public views name them: "p3", a bot "b7"; "you" for the viewer.
export function tagOf(key: string, viewerKey: string | null): string {
  if (key === viewerKey) return 'you';
  // A Quick Test bot's number without its leading zeros: "bot-07" is "b7".
  return /^bot-\d+$/.test(key) ? `b${String(Number(key.slice(4)))}` : key;
}

// The colour and shape of the i-th player in join order: colours first, then the next shape.
export function markAt(i: number): Omit<PlayerMark, 'tag'> {
  const turn = Math.floor(i / MARK_COLORS.length) % MARK_SHAPES.length;
  return {
    color: `var(--mark-${String((i % MARK_COLORS.length) + 1)})`,
    shape: turn === 0 ? 'dot' : turn === 1 ? 'ring' : 'square',
  };
}

// Every player's mark by key, from the keys in join order.
export function marksOf(
  keys: readonly string[],
  viewerKey: string | null,
): Readonly<Record<string, PlayerMark>> {
  return Object.fromEntries(keys.map((k, i) => [k, { tag: tagOf(k, viewerKey), ...markAt(i) }]));
}
