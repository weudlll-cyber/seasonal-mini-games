/**
 * @file   games/mind-games/web/phases.ts
 * @module games/mind-games/web
 * @brief  The round's phases at a moment, and their words: what changes next, what the feed
 *         says, what a screen reader hears.
 *
 * Responsibility: from the round's public timing (its opening, its plan and the server's time,
 *                 04 §4.8) the phase now, Join, Play, Reveal or over (02e §4, O97); the next
 *                 change in words ("Joining closes in 0:24 · Choices close in 0:54", "Choices
 *                 close in 0:12", "Reveal · result in 0:18", and in the hold before the result
 *                 "Choices closed · result in 0:04", 02e §11, T384); the feed's own sentences
 *                 (the first choices' countdown, "every change now is a switch" once the feed has
 *                 passed the join time, the reveal and the hold, 02e §6); the one sentence a
 *                 screen reader hears when the phase changes. The result comes at the round's
 *                 time-up (`endsAt`: the plan's end and the host's hold). Every countdown here
 *                 rounds as the platform's round bar, whole seconds down, so both show the same
 *                 seconds (O107); the bar counts to the plan's end and in the hold says
 *                 "Result in 0:04" (T386). The server enforces every phase; these only
 *                 show them.
 * Depends on:     @seasonal/kit (clockText), @smg/game-sdk (PhasedTiming)
 * Used by:        ./PhaseStrip, ./FeedPanels, ./MindInput
 * Spec:           docs/spec/02e-game-mind-games.md §4, §6, §11
 */
import { clockText } from '@seasonal/kit';
import type { PhasedTiming } from '@smg/game-sdk';

export type Phase = 'join' | 'play' | 'reveal' | 'over';

// Milliseconds since the opening.
export const sinceOpening = (t: PhasedTiming): number => t.now() - t.opensAt;

export function phaseOf(t: PhasedTiming): Phase {
  const at = sinceOpening(t);
  if (at < t.plan.entryEndMs) return 'join';
  if (at < t.plan.actionsEndMs) return 'play';
  return at < t.plan.endMs ? 'reveal' : 'over';
}

// What is left until `to`, rounded as the platform's round bar (whole seconds down, `clockText`),
// so the two clocks on the round's screen always show the same seconds (owner, O107).
const left = (to: number, at: number) => clockText(Math.max(0, to - at));
const secondsLeft = (to: number, at: number) => String(Math.floor(Math.max(0, to - at) / 1_000));

// Milliseconds since the opening at which the result comes (the plan's end and the hold).
const resultMs = (t: PhasedTiming): number => t.endsAt - t.opensAt;

// The next change in words (02e §11).
export function nextChange(t: PhasedTiming): string {
  const at = sinceOpening(t);
  const { entryEndMs, actionsEndMs } = t.plan;
  switch (phaseOf(t)) {
    case 'join':
      return `Joining closes in ${left(entryEndMs, at)} · Choices close in ${left(actionsEndMs, at)}`;
    case 'play':
      return `Choices close in ${left(actionsEndMs, at)}`;
    case 'reveal':
      return `Reveal · result in ${left(resultMs(t), at)}`;
    default:
      // The hold: the stage stands with the last moves until the result (T384).
      return at < resultMs(t)
        ? `Choices closed · result in ${left(resultMs(t), at)}`
        : 'The round is over.';
  }
}

// What the feed says beside its head, or null (02e §6.1, §6.2).
export function feedNote(t: PhasedTiming, entrants: number, empty: boolean): string | null {
  const at = sinceOpening(t);
  const { entryEndMs, actionsEndMs, endMs, viewDelayMs } = t.plan;
  const delay = String(Math.round(viewDelayMs / 1_000));
  if (empty && at < viewDelayMs) {
    return `The first choices show in ${secondsLeft(viewDelayMs, at)} s.`;
  }
  const result = `the result follows in ${secondsLeft(resultMs(t), at)} s.`;
  if (at >= endMs) return `Choices are closed — ${result}`;
  if (at >= actionsEndMs)
    return `Choices are closed. Revealing the last ${delay} s of play — ${result}`;
  if (at - viewDelayMs >= entryEndMs) {
    return `All ${String(entrants)} ${entrants === 1 ? 'player is' : 'players are'} in. Every change now is a switch.`;
  }
  return null;
}

// The sentence a screen reader hears once when the phase changes; none while joining.
export const announcement = (phase: Phase): string =>
  ({ join: '', play: 'Joining has closed.', reveal: 'Choices are closed.', over: '' })[phase];
