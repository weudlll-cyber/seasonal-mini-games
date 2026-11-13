/**
 * @file   games/mind-games/web/text.ts
 * @module games/mind-games/web
 * @brief  The game's words: refusals, the feed's lines as list rows, the head, the intro.
 *
 * Responsibility: every refusal a choice can meet in the words of 02e §5.2, the platform's
 *                 phased codes included (`PLAY_OVER`, `JOIN_CLOSED`, `NOT_IN_ROUND`), so the
 *                 player reads the game's sentence; the feed's lines as the rows of the round's
 *                 one list, which the platform draws with the name ("You" for the viewer's own):
 *                 "chose Summer", "switched Summer → Winter" (02e §6.1); the feed's head ("The
 *                 round 30 s ago: 23 players") and the empty feed's sentence; times after the
 *                 opening as "1:30"; the intro's rule and timing (02e §2); the result's headline
 *                 where the platform puts the line about the best of the rest (O22). Room events
 *                 make no row of their own: the lines come from the view, so a reload shows the
 *                 same list.
 * Depends on:     @smg-game/mind-games (views, words), @smg/game-sdk (GameText, GuessRow)
 * Used by:        ./index, ./MindInput, ./FeedHead, ./ResultPanel, ./ChoiceButtons
 * Spec:           docs/spec/02e-game-mind-games.md §2, §5.2, §6, §9
 */
import {
  CHOICE_NAMES,
  headline,
  placeWords,
  type FeedLineView,
  type ResultView,
  type SpectatorView,
} from '@smg-game/mind-games';
import type { GameText, GuessRow } from '@smg/game-sdk';

const CODES: Readonly<Record<string, string>> = {
  NOT_IN_ROUND: 'Join the match to play.',
  PLAY_OVER: 'Choices are closed for this round.',
  JOIN_CLOSED: 'Joining this round has closed. You can play the next round.',
  CHOICE_INVALID: 'Pick one of the seasons.',
  INVALID_ACTION: 'Pick one of the seasons.',
  CHOICE_UNAVAILABLE: 'All is not offered in this round.',
  SAME_CHOICE: 'That is already your choice.',
};

// Milliseconds after the opening as "1:30".
export function clock(ms: number): string {
  const s = Math.floor(ms / 1_000);
  return `${String(Math.floor(s / 60))}:${String(s % 60).padStart(2, '0')}`;
}

export const delayS = (v: SpectatorView): number => Math.round(v.rules.plan.viewDelayMs / 1_000);

const playersWord = (n: number) => `${String(n)} ${n === 1 ? 'player' : 'players'}`;

// The feed's head: the time it shows and how many were in the round then (02e §6.1).
export const headText = (v: SpectatorView): string =>
  `The round ${String(delayS(v))} s ago: ${playersWord(v.entrants)}`;

// Before the first choice reaches the feed (02e §6.1; the countdown needs the opening, OPEN).
export const emptyText = (v: SpectatorView): string =>
  `The first choices show ${String(delayS(v))} s after they are made.`;

export function lineText(l: FeedLineView): string {
  const to = CHOICE_NAMES[l.choice];
  return l.from === null ? `chose ${to}` : `switched ${CHOICE_NAMES[l.from]} → ${to}`;
}

// One list row per feed line; the viewer's own come without a player, so they read "You".
function guesses(view: unknown): readonly GuessRow[] {
  const lines = (view as { lines?: readonly FeedLineView[] } | null)?.lines ?? [];
  return lines.map((l) => ({
    key: `${String(l.at)}:${l.playerKey}`,
    at: l.at,
    playerId: l.own ? null : l.playerKey,
    value: null,
    feedback: null,
    text: lineText(l),
    comment: null,
    tier: null,
    pending: false,
  }));
}

// "Pick a season. The least chosen wins." with All and the timing in one more line (02e §2).
function intro(view: unknown): string {
  const v = view as SpectatorView;
  const place = placeWords(v.rules.winnerPlace);
  const rule = `Pick a season. The ${place} wins.`;
  const all = v.rules.allOption ? ' All counts as a fifth choice and scores 2.' : '';
  const p = v.rules.plan;
  const timing = `Join within ${clock(p.entryEndMs)} · choices close at ${clock(p.actionsEndMs)} · everyone sees the round ${String(delayS(v))} s late`;
  return `${rule}${all} ${timing}`;
}

export const mindText: GameText = {
  code: (code) => CODES[code] ?? null,
  event: () => null,
  guesses,
  // Null where the round has no result view (morning sheet G11): the platform's line stays alone.
  runnerUp: (result) => (result === null ? null : headline(result as ResultView)),
  intro,
};
