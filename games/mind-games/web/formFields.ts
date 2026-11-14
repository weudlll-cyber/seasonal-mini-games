/**
 * @file   games/mind-games/web/formFields.ts
 * @module games/mind-games/web
 * @brief  How the host form shows the game's settings now (02e §3).
 *
 * Responsibility: while "Join time follows the total" is on, the join time shows half the total,
 *                 rounded down, with the field off and its help line saying it follows the total
 *                 (typing a value means turning the box off first); the rounds and the pause hold
 *                 for the match, so from its second round they show the match's values, off; the
 *                 countdown's help names no season, which the game does not show (O93). The
 *                 host form and the Quick Test ask this for each field (DECISIONS T335, T344).
 * Depends on:     @smg/game-sdk (FieldState, SettingValue), @smg-game/mind-games (joinOf)
 * Used by:        ./index
 * Spec:           docs/spec/02e-game-mind-games.md §2, §3
 */
import { joinOf } from '@smg-game/mind-games';
import type { FieldState, SettingValue } from '@smg/game-sdk';

const HELD = 'Chosen in the match’s first round; it holds for the whole match.';
const COUNTDOWN = 'The intro screen with the round’s rule and times, before it opens.';

export function mindFieldState(
  key: string,
  values: Readonly<Record<string, SettingValue>>,
  firstRound: boolean,
): FieldState | null {
  if (key === 'mind.joinS' && values['mind.joinAuto'] === true) {
    const totalS = Number(values['mind.totalS']);
    return {
      value: joinOf({ joinAuto: true, totalS, joinS: 0 }),
      disabled: true,
      help: 'Follows the total: half of it. Turn "Join time follows the total" off to set it.',
    };
  }
  if ((key === 'mind.rounds' || key === 'mind.pauseS') && !firstRound) {
    return { disabled: true, help: HELD };
  }
  // The intro shows no season in this game (O93): the countdown's help says what it shows.
  if (key === 'round.countdownS') return { help: COUNTDOWN };
  return null;
}
