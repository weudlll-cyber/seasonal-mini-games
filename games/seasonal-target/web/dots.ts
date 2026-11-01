/**
 * @file   games/seasonal-target/web/dots.ts
 * @module games/seasonal-target/web
 * @brief  The map's dots from a view: each player's in their one colour, own ones ringed.
 *
 * Responsibility: one dot per guess whose cell the view carries (own always; others' from
 *                 `numbers` on in shared mode, the engine's newest 60, 02d §6), each with the
 *                 player's one colour from the platform's list (`colors`, the colour of their
 *                 list row, T125), the answer's arrow where the answer is a direction,
 *                 "pending" while Frost holds an own answer, and a label naming the player (by
 *                 `names`), the cell and the answer for hover, focus and screen readers (never
 *                 colour alone); the legend's entries: every player with a dot, own first.
 * Depends on:     @smg-game/seasonal-target (types), ./words
 * Used by:        ./TargetInput, ./SpectatorPanel, ./ResultPanel, ./MapBoard
 * Spec:           docs/spec/02d-game-seasonal-target.md §6
 */
import type { Cell, Compass, Feedback, PlayerView } from '@smg-game/seasonal-target';

import { cellText, longAnswer } from './words.js';

export interface Dot {
  readonly key: string;
  readonly cell: Cell;
  readonly own: boolean;
  readonly name: string;
  readonly color: string;
  readonly arrow: Compass | null;
  readonly pending: boolean;
  readonly label: string;
}

// The players a map draws: names and list colours by player key; the viewer's own colour
// where the panel knows the viewer, else the season colour own list rows are highlighted in.
export interface Players {
  readonly names: Readonly<Record<string, string>>;
  readonly colors: Readonly<Record<string, string>>;
  readonly ownColor?: string | undefined;
}

const SEASON = 'var(--season, var(--color-accent))';
// A player the list has no colour for (none expected): a neutral mark, still named.
const NEUTRAL = 'var(--color-text-muted)';

interface Seen {
  readonly receiveSeq: number;
  readonly value: Cell | null;
  readonly feedback: Feedback | null;
}

function dot(
  key: string,
  cell: Cell,
  feedback: Feedback | null,
  who: { own: boolean; name: string; color: string },
): Dot {
  const answer = feedback === null ? (who.own ? 'answer arriving' : null) : longAnswer(feedback);
  return {
    key,
    cell,
    own: who.own,
    name: who.name,
    color: who.color,
    arrow: feedback?.kind === 'direction' ? feedback.direction : null,
    pending: who.own && feedback === null,
    label: `${who.name} ${cellText(cell)}${answer === null ? '' : ` — ${answer}`}`,
  };
}

// Every dot a view carries, others first so the own ones are drawn on top.
export function dotsOf(
  own: readonly Seen[],
  log: readonly (Seen & { readonly playerId: string })[],
  players: Players,
): Dot[] {
  const others = log.flatMap((g) => {
    if (g.value === null) return [];
    const who = {
      own: false,
      name: players.names[g.playerId] ?? g.playerId,
      color: players.colors[g.playerId] ?? NEUTRAL,
    };
    return [dot(`o${String(g.receiveSeq)}`, g.value, g.feedback, who)];
  });
  const me = { own: true, name: 'You', color: players.ownColor ?? SEASON };
  const mine = own.flatMap((g) =>
    g.value === null ? [] : [dot(`m${String(g.receiveSeq)}`, g.value, g.feedback, me)],
  );
  return [...others, ...mine];
}

export const playerDots = (v: PlayerView, players: Players): Dot[] =>
  dotsOf(v.guesses, v.log, players);

export type LegendEntry = Pick<Dot, 'name' | 'color' | 'own'>;

// One entry per player with a dot on the map, own first, then in the order their dots come.
export function legendOf(dots: readonly Dot[]): LegendEntry[] {
  const seen = new Map<string, LegendEntry>();
  for (const d of dots) {
    if (!seen.has(d.name)) seen.set(d.name, { name: d.name, color: d.color, own: d.own });
  }
  return [...seen.values()].sort((a, b) => Number(b.own) - Number(a.own));
}
