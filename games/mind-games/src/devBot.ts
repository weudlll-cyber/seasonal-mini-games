/**
 * @file   games/mind-games/src/devBot.ts
 * @module games/mind-games
 * @brief  The development bot: a first choice, then one of three ways to play, from its own view.
 *
 * Responsibility: from its player view only, which shows the others one delay late like
 *                 everyone's (09 §4.2): without a choice yet it makes its first one; then, by
 *                 its first draw, it stays, or switches at random now and then as its feed
 *                 moves on, or leans to the least chosen option its feed shows. Its box is a
 *                 draw too. Where it has nothing new to choose it sends its current choice,
 *                 which the round refuses at no cost (`SAME_CHOICE`), so it keeps playing until
 *                 play ends; a bot that stays has nothing to do after its first choice. In the
 *                 Quick Test the draws come from its seeded plan for the round, so the same seed
 *                 gives the same way and first choice (09 §4.2). About one bot in four fixes its
 *                 choice for every round in advance and stays away (`mindDevPrefs`): any of the
 *                 five names, so a pre-picked All meets a round without it now and then.
 * Depends on:     @smg/game-sdk (DevBot), ./choices, ./state (types), ./views (types)
 * Used by:        ./index, games/registry
 * Spec:           docs/spec/09-testing-strategy.md §4.2, §5; docs/spec/02e-game-mind-games.md §5
 */
import type { DevBot, DevPrefs } from '@smg/game-sdk';

import { CHOICES, optionsOf, type Choice } from './choices.js';
import type { MindAction } from './state.js';
import type { PlayerView } from './views.js';

const STAYS = 0;
const LEANS = 2;
// A random switcher moves on every third change of its feed.
const EVERY = 3;

// The least chosen option the feed shows, the first in option order among equals.
function leastShown(view: PlayerView, options: readonly Choice[]): Choice {
  let least = options[0] ?? 'spring';
  for (const c of options) if (view.counts[c] < view.counts[least]) least = c;
  return least;
}

const send = (choice: Choice, hide: boolean): MindAction => ({ value: { choice, hide } });

export const mindDevBot: DevBot<MindAction> = (playerView, pick) => {
  const view = playerView as PlayerView;
  const options = optionsOf(view.rules.allOption);
  const way = pick(3);
  const hide = pick(2) === 1;
  const first = options[pick(options.length)] ?? 'spring';
  const own = view.own.choice;
  if (own === null) return send(first, hide);
  if (way === STAYS) return null;
  if (way === LEANS) return send(leastShown(view, options), hide);
  const moved = view.lines.length + view.entrants;
  if (moved % EVERY !== 0) return send(own, hide);
  return send(options[(pick(options.length) + moved) % options.length] ?? own, hide);
};

// A Quick Test bot's pre-picks (09 §4.2): about one in four picks every round in advance, with
// its box; the others play in person.
export const mindDevPrefs: DevPrefs = (pick, rounds) =>
  pick(4) !== 0
    ? null
    : {
        picks: Object.fromEntries(
          Array.from({ length: rounds }, (_, i) => [String(i + 1), CHOICES[pick(5)] ?? 'spring']),
        ),
        hide: pick(2) === 1,
      };
