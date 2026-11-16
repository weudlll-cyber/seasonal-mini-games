/**
 * @file   games/mind-games/web/flights.ts
 * @module games/mind-games/web
 * @brief  One wave of flights from two released feed steps, and nothing earlier.
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
 * Depends on:     @smg-game/mind-games (options, views)
 * Used by:        ./FlightBand
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
