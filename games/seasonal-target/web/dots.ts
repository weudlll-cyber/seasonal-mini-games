/**
 * @file   games/seasonal-target/web/dots.ts
 * @module games/seasonal-target/web
 * @brief  The map's dots from a view: own guesses with a ring, others' in their colours.
 *
 * Responsibility: one dot per guess whose cell the view carries (own always; others' from
 *                 `numbers` on in shared mode, the engine's newest 60, 02d §6), each with a
 *                 colour, the answer's arrow where the answer is a direction, "pending" while
 *                 Frost holds an own answer, and a label naming the player, the cell and the
 *                 answer for hover and screen readers (never colour alone). Others' colours
 *                 come from the four season tokens in the order players first appear.
 * Depends on:     @smg-game/seasonal-target (types), ./words
 * Used by:        ./TargetInput, ./SpectatorPanel, ./ResultPanel
 * Spec:           docs/spec/02d-game-seasonal-target.md §6
 */
import type { Cell, Compass, Feedback, PlayerView } from '@smg-game/seasonal-target';

import { cellText, longAnswer } from './words.js';

export interface Dot {
  readonly key: string;
  readonly cell: Cell;
  readonly own: boolean;
  readonly color: string;
  readonly arrow: Compass | null;
  readonly pending: boolean;
  readonly label: string;
}

const PALETTE = [
  'var(--color-spring)',
  'var(--color-summer)',
  'var(--color-autumn)',
  'var(--color-winter)',
];

// The viewer's own dots: the season colour, with a ring (./st.css).
export const OWN_COLOR = 'var(--season, var(--color-accent))';

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
  names: Readonly<Record<string, string>> = {},
): Dot[] {
  const order: string[] = [];
  const others = log.flatMap((g) => {
    if (g.value === null) return [];
    if (!order.includes(g.playerId)) order.push(g.playerId);
    const color = PALETTE[order.indexOf(g.playerId) % PALETTE.length] ?? OWN_COLOR;
    const name = names[g.playerId] ?? 'Another player';
    return [dot(`o${String(g.receiveSeq)}`, g.value, g.feedback, { own: false, name, color })];
  });
  const mine = own.flatMap((g) =>
    g.value === null
      ? []
      : [
          dot(`m${String(g.receiveSeq)}`, g.value, g.feedback, {
            own: true,
            name: 'You',
            color: OWN_COLOR,
          }),
        ],
  );
  return [...others, ...mine];
}

export const playerDots = (v: PlayerView): Dot[] => dotsOf(v.guesses, v.log);
