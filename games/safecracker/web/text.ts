/**
 * @file   games/safecracker/web/text.ts
 * @module games/safecracker/web
 * @brief  Every sentence Seasonal Safecracker puts on a screen, in plain English.
 *
 * Responsibility: the code block's line ("4-digit code, digits 0–9"), Spring Herald's hint
 *                 ("Free hint: the 2nd digit is 7."), the game's refusals (02b §4), one line per
 *                 room event (Leaf Fall's fallen digits; the hint shows once, in the code block) and
 *                 Leaf Fall's banner (O35); the list's guess rows from a player or spectator
 *                 view: the code as text, the answer in words with its pegs (one filled per
 *                 right place, one ring per right digit in a wrong place, T119), "tried a code" where the code
 *                 is hidden, own rows pending while Frost holds them; the closest miss on the
 *                 result (02b §8); the intro's secret line (O36) and the special's sentence.
 * Depends on:     @smg/game-sdk (GameText, GuessRow, GuessAnswer, FeedLine),
 *                 @smg-game/safecracker (types)
 * Used by:        ./Board, ./CodeInput, ./ResultPanel, ./index
 * Spec:           docs/spec/02b-game-safecracker.md §2, §4, §5.2, §7, §8, §10
 */
import type {
  Feedback,
  Hint,
  PlayerView,
  ResultView,
  ScEvent,
  SpectatorView,
} from '@smg-game/safecracker';
import type { FeedLine, GameText, GuessAnswer, GuessRow, Season } from '@smg/game-sdk';

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th'];

// "4-digit code, digits 0–9"
export const codeLine = (length: number, digits: number): string =>
  `${String(length)}-digit code, digits 0–${String(digits - 1)}`;

// The code block's highlighted line for the whole round (O35).
export const freeHint = (hint: Hint): string =>
  `Free hint: the ${ORDINALS[hint.position] ?? ''} digit is ${String(hint.digit)}.`;

// Check 4's sentence with the round's numbers (02b §4).
export const invalidCode = (length: number, digits: number): string =>
  `Enter ${String(length)} digits, each from 0 to ${String(digits - 1)}.`;

const CODES: Readonly<Record<string, string>> = {
  // The input row says it with the round's numbers (`invalidCode`); this is the fallback.
  CODE_INVALID: 'Enter every digit of the code, each one of the digits in use.',
  DIGIT_REMOVED: 'That digit has fallen.',
  ALREADY_GUESSED: 'You already tried that code.',
};

// "1 right place, 2 right digits, wrong place": the rows, the result and the closest miss
// (02b §5.2, §8); a near digit is named as what it is, a right digit in a wrong place.
export const counts = (f: { readonly exact: number; readonly near: number }): string =>
  `${String(f.exact)} right place${f.exact === 1 ? '' : 's'}, ${String(f.near)} right digit${f.near === 1 ? '' : 's'}, wrong place`;

// The answer in words with its pegs. One rule for every row, own and others' alike (night 6,
// DECISIONS T139): green ("close") once at least half the digits are in the right place.
export function answerOf(f: Feedback, length: number): GuessAnswer {
  const pegs = [
    ...Array.from({ length: f.exact }, () => 'hit' as const),
    ...Array.from({ length: f.near }, () => 'near' as const),
  ];
  if (f.solved) return { text: 'correct — the safe is open', tone: 'correct', pegs };
  return { text: counts(f), tone: 2 * f.exact >= length ? 'close' : 'far', pegs };
}

// "7", "3 and 7", "1, 3 and 7".
function listOf(digits: readonly number[]): string {
  const all = digits.map(String);
  const last = all.pop() ?? '';
  return all.length === 0 ? last : `${all.join(', ')} and ${last}`;
}

const fallLine = (digits: readonly number[]): string =>
  `Leaf Fall: ${listOf(digits)} ${digits.length === 1 ? 'is' : 'are'} not in the code.`;

function eventText(e: ScEvent): FeedLine | null {
  switch (e.type) {
    case 'DigitsFallen':
      return { text: fallLine(e.digits), playerId: null, special: true };
    // The hint shows once, in the code block; the platform's row says that it came (O47).
    case 'HintGiven':
      return null;
    // Guesses are rows of their own, from the view, so they survive a reload.
    case 'GuessFed':
    case 'FeedbackGiven':
      return null;
  }
}

type Seen = PlayerView['log'][number];

// The list's rows of a player view (own codes and the others') or a spectator view.
function guessRows(view: unknown): readonly GuessRow[] {
  const v = view as Partial<PlayerView> & SpectatorView;
  const row = (g: Omit<Seen, 'playerId'>, playerId: string | null): GuessRow => ({
    key: String(g.receiveSeq),
    at: g.receivedAt,
    playerId,
    value: null,
    feedback: null,
    text: g.value ?? 'tried a code',
    answer: g.feedback === null ? null : answerOf(g.feedback, v.length),
    comment: g.comment,
    tier: g.tier,
    pending: playerId === null && g.feedback === null,
  });
  return [...(v.guesses ?? []).map((g) => row(g, null)), ...v.log.map((g) => row(g, g.playerId))];
}

// "Closest miss besides the winner: Anna, 3 right places, 1 right digit, wrong place (0427)."
// (02b §8)
function runnerUp(view: unknown, names: Readonly<Record<string, string>>): string | null {
  const miss = (view as Partial<ResultView>).closestMiss ?? null;
  if (miss === null) return null;
  const name = names[miss.playerId] ?? miss.playerId;
  return `Closest miss besides the winner: ${name}, ${counts(miss)} (${miss.value}).`;
}

// The intro's line (O36): "Shared 4-digit code, digits 0–9".
function intro(view: unknown, secretMode: 'shared' | 'individual'): string | null {
  const v = view as Partial<SpectatorView> | null;
  if (v?.length === undefined || v.digits === undefined) return null;
  const line = codeLine(v.length, v.digits);
  return secretMode === 'shared' ? `Shared ${line}` : `Everyone has their own ${line}`;
}

const SPECIAL_RULES: Partial<Record<Season, string>> = {
  spring: 'At the start, one digit of the code is revealed for free.',
  autumn: 'Every so often, a digit that is in no code falls out.',
};

export const safecrackerText: GameText = {
  code: (code) => CODES[code] ?? null,
  event: (event) => eventText(event as ScEvent),
  guesses: guessRows,
  runnerUp,
  banner: (event) => {
    const e = event as ScEvent;
    return e.type === 'DigitsFallen' ? fallLine(e.digits) : null;
  },
  intro,
  specialRule: (season) => SPECIAL_RULES[season] ?? null,
};
