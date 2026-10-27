/**
 * @file   apps/web/src/boards/boardsText.ts
 * @module web/boards
 * @brief  The boards' words: dates, points, places, and the refusals a board page can meet.
 *
 * Responsibility: one wording for the leaderboard, the profile and the verification page:
 *                 a date in plain English ("27 October 2026"), "1 point" / "5 points", a
 *                 signed adjustment ("+50 points"), the place of a round ("took part" or "not
 *                 solved" without one), and every server code these pages can get, in a plain sentence.
 * Depends on:     ../shell/http (ApiError)
 * Used by:        ./PlayerBoard, ./ProfilePage, ./VerifyPage, ./LeaderboardPage
 * Spec:           docs/spec/02-game-guess-the-number.md §8, §9, §12
 */
import type { ApiError } from '../shell/http.js';

const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

export function dateText(ms: number): string {
  return DATE.format(ms);
}

export function pointsText(points: number): string {
  return `${String(points)} ${Math.abs(points) === 1 ? 'point' : 'points'}`;
}

export function deltaText(delta: number): string {
  return `${delta > 0 ? '+' : ''}${pointsText(delta)}`;
}

// A round without a place: the player took part (shared) or did not solve (individual, 02 §8).
export function placeText(place: number | null, mode: 'shared' | 'individual'): string {
  if (place !== null) return String(place);
  return mode === 'shared' ? 'took part' : 'not solved';
}

const CODES: Readonly<Record<string, string>> = {
  NOT_FOUND: 'Nothing was found here.',
  ROUND_NOT_FOUND: 'No round with that id.',
  NO_PROOF: 'This round was played without a fairness proof, so there is nothing to check.',
  ROUND_NOT_ENDED: 'This round has not ended yet. Its proof is published when it ends.',
  NO_ANSWER: 'No answer from the server. Check your connection and try again.',
};

export function refusalText(error: ApiError): string {
  return CODES[error.code] ?? 'That did not load. Please try again.';
}
