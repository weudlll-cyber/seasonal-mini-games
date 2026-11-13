/**
 * @file   games/mind-games/src/rules.ts
 * @module games/mind-games
 * @brief  Choosing (checks 5–7, first choice and switch), folding, the outcome and pre-picks.
 *
 * Responsibility: the game's own checks after the platform's (02e §5.2: a name of the five,
 *                 All only where offered, not the current choice); an accepted choice as the
 *                 chooser's `ChoiceMade` and the room's `ChoiceFed`, a switch shown with its
 *                 name or only in the counts as the round's switches and the chooser's box say
 *                 (02e §6.3; a first choice is always named, owner decision 81); folding the
 *                 chooser's event; at the end the winning options of the final choices and one
 *                 result row per player in the round, in entry order (02e §8); a player's
 *                 pre-pick for a round as that player's first action (02e §7).
 * Depends on:     zod, @smg/game-sdk (types), ./choices, ./settings (types), ./state
 * Used by:        ./module, ./views
 * Spec:           docs/spec/02e-game-mind-games.md §5–§8; docs/spec/04-software-architecture.md §4.8
 */
import type { Decision, Emitted, OutcomeRow, PlayerAction } from '@smg/game-sdk';
import { z } from 'zod';

import { CHOICES, countsOf, isChoice, pointsOf, winnersOf, type Choice } from './choices.js';
import type { MindConfig } from './settings.js';
import {
  finalsBefore,
  type MindAction,
  type MindEvent,
  type MindState,
  type Move,
} from './state.js';

// Any short name: an unknown one is the game's CHOICE_INVALID, not a malformed action.
export const actionSchema: z.ZodType<MindAction> = z
  .object({ value: z.object({ choice: z.string().max(16), hide: z.boolean() }).strict() })
  .strict();

// A player's pre-picks, one choice or none per round number, and their box (02e §7, §6.3).
export const prefsSchema = z
  .object({
    picks: z.record(z.string().regex(/^(?:[1-9]|1[0-9]|20)$/), z.enum(CHOICES)),
    hide: z.boolean().optional(),
  })
  .strict();
type MindPrefs = z.infer<typeof prefsSchema>;

const current = (s: MindState, playerKey: string): Choice | null =>
  finalsBefore(s.moves, Infinity).get(playerKey) ?? null;

export function validate(s: MindState, playerKey: string, action: MindAction): string | null {
  const a = action.value;
  if (!isChoice(a.choice)) return 'CHOICE_INVALID';
  if (a.choice === 'all' && !s.cfg.allOption) return 'CHOICE_UNAVAILABLE';
  return current(s, playerKey) === a.choice ? 'SAME_CHOICE' : null;
}

// A switch the feed names: switches visible, or per player with the box clear (02e §6.3).
const named = (cfg: MindConfig, hide: boolean): boolean =>
  cfg.switchVisibility === 'visible' || (cfg.switchVisibility === 'perPlayer' && !hide);

function fed(move: Omit<Move, 'hide' | 'at'>, after: ReadonlyMap<string, Choice>): MindEvent {
  const { playerKey: player, choice, from, hidden } = move;
  const base = {
    type: 'ChoiceFed',
    counts: countsOf(after.values()),
    entrants: after.size,
  } as const;
  if (from === null) return { ...base, kind: 'first', player, choice };
  if (hidden) return { ...base, kind: 'counts' };
  return { ...base, kind: 'switch', player, from, choice };
}

export function decide(s: MindState, act: PlayerAction<MindAction>): Decision<MindEvent> {
  const { playerId: playerKey, receivedAt } = act;
  const choice = act.action.value.choice as Choice;
  const hide = act.action.value.hide;
  const from = current(s, playerKey);
  const hidden = from !== null && !named(s.cfg, hide);
  const after = finalsBefore(s.moves, Infinity).set(playerKey, choice);
  const events: Emitted<MindEvent>[] = [
    {
      audience: `player:${playerKey}`,
      event: { type: 'ChoiceMade', playerKey, receivedAt, choice, from, hidden, hide },
    },
    { audience: 'room', event: fed({ playerKey, choice, from, hidden }, after) },
  ];
  return { ok: true, events, signals: [] };
}

// The chooser's event is the one folded; the room's is a copy of what it says.
export function evolve(s: MindState, e: MindEvent): MindState {
  if (e.type !== 'ChoiceMade') return s;
  const { playerKey, choice, from, hidden, hide, receivedAt: at } = e;
  return { ...s, moves: [...s.moves, { playerKey, choice, from, hidden, hide, at }] };
}

// The final choices, their counts and the winning options at the host's place.
export function finalOf(s: MindState) {
  const finals = finalsBefore(s.moves, Infinity);
  const counts = countsOf(finals.values());
  return { finals, counts, winners: winnersOf(counts, s.cfg.winnerPlace) };
}

// One row per player in the round, in entry order; a player without a choice has none.
export function outcome(s: MindState): readonly OutcomeRow[] {
  const { finals, winners } = finalOf(s);
  return [...finals].map(([playerId, choice]) => {
    const points = pointsOf(choice, winners);
    return { playerId, won: points > 0, points };
  });
}

// The pre-pick for round `roundIndex` as the player's action, with their box; a pick of All in
// a round without it is refused by `validate` like any choice (02e §7).
export function prePick(prefs: unknown, roundIndex: number): MindAction | null {
  const p = prefs as MindPrefs;
  const choice = p.picks[String(roundIndex)];
  return choice === undefined ? null : { value: { choice, hide: p.hide ?? false } };
}
