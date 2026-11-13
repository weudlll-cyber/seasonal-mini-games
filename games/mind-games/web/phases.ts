/**
 * @file   games/mind-games/web/phases.ts
 * @module games/mind-games/web
 * @brief  The round's phases at a moment, and their words: what changes next, what the feed
 *         says, what a screen reader hears.
 *
 * Responsibility: from the round's public timing (its opening, its plan and the server's time,
 *                 04 §4.8) the phase now, Join, Play, Replay or over (02e §4); the next change in
 *                 words ("Joining closes in 0:24 · choices close in 0:54", "Choices close in
 *                 0:12", "Replay · result in 0:18", 02e §11); the feed's own sentences (the first
 *                 choices' countdown, "every change now is a switch" once the feed has passed the
 *                 join time, the replay, 02e §6); the one sentence a screen reader hears when the
 *                 phase changes. The server enforces every phase; these only show them.
 * Depends on:     @smg/game-sdk (PhasedTiming), ./text
 * Used by:        ./PhaseStrip, ./FeedPanels, ./MindInput
 * Spec:           docs/spec/02e-game-mind-games.md §4, §6, §11
 */
import type { PhasedTiming } from '@smg/game-sdk';

import { clock } from './text.js';

export type Phase = 'join' | 'play' | 'replay' | 'over';

// Milliseconds since the opening.
export const sinceOpening = (t: PhasedTiming): number => t.now() - t.opensAt;

export function phaseOf(t: PhasedTiming): Phase {
  const at = sinceOpening(t);
  if (at < t.plan.entryEndMs) return 'join';
  if (at < t.plan.actionsEndMs) return 'play';
  return at < t.plan.endMs ? 'replay' : 'over';
}

const left = (to: number, at: number) => clock(Math.max(0, to - at) + 999);

// The next change in words (02e §11).
export function nextChange(t: PhasedTiming): string {
  const at = sinceOpening(t);
  const { entryEndMs, actionsEndMs, endMs } = t.plan;
  switch (phaseOf(t)) {
    case 'join':
      return `Joining closes in ${left(entryEndMs, at)} · choices close in ${left(actionsEndMs, at)}`;
    case 'play':
      return `Choices close in ${left(actionsEndMs, at)}`;
    case 'replay':
      return `Replay · result in ${left(endMs, at)}`;
    default:
      return 'The round is over.';
  }
}

// What the feed says beside its head, or null (02e §6.1, §6.2).
export function feedNote(t: PhasedTiming, entrants: number, empty: boolean): string | null {
  const at = sinceOpening(t);
  const { entryEndMs, actionsEndMs, endMs, viewDelayMs } = t.plan;
  const delay = String(Math.round(viewDelayMs / 1_000));
  if (empty && at < viewDelayMs) {
    return `The first choices show in ${String(Math.ceil((viewDelayMs - at) / 1_000))} s.`;
  }
  if (at >= actionsEndMs) {
    return `Choices are closed. Replay of the last ${delay} s of play — the result follows in ${String(Math.ceil(Math.max(0, endMs - at) / 1_000))} s.`;
  }
  if (at - viewDelayMs >= entryEndMs) {
    return `All ${String(entrants)} ${entrants === 1 ? 'player is' : 'players are'} in. Every change now is a switch.`;
  }
  return null;
}

// The sentence a screen reader hears once when the phase changes; none while joining.
export const announcement = (phase: Phase): string =>
  ({ join: '', play: 'Joining has closed.', replay: 'Choices are closed.', over: '' })[phase];
