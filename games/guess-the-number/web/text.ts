/**
 * @file   games/guess-the-number/web/text.ts
 * @module games/guess-the-number/web
 * @brief  Every sentence Guess The Number puts on a screen, in plain English.
 *
 * Responsibility: the answers ("The number is higher than 412."), the game's refusals, the
 *                 Spring Herald hint, and one line per room event for the live feed (02 §6,
 *                 §12; 03 §2): Leaf Fall with the fallen numbers named, the shared hint,
 *                 halving, and a guess at the round's visibility. Server codes never reach the
 *                 screen as codes.
 * Depends on:     @smg/game-sdk (GameText), ../src (types)
 * Used by:        ./PlayerPanel, ./SpectatorPanel, ./ResultPanel, ./index
 * Spec:           docs/spec/02-game-guess-the-number.md §6, §12; docs/spec/03-seasonal-specials.md §2
 */
import type { Feedback, GtnEvent } from '@smg-game/guess-the-number';
import type { FeedLine, GameText } from '@smg/game-sdk';

export function answerText(value: number, feedback: Feedback): string {
  if (feedback === 'higher') return `The number is higher than ${String(value)}.`;
  if (feedback === 'lower') return `The number is lower than ${String(value)}.`;
  return `${String(value)} is the number!`;
}

// An answer on a chip: ↑ the number is higher, ↓ lower, ✓ found (02 §12).
export const ARROWS: Readonly<Record<Feedback, string>> = { higher: '↑', lower: '↓', correct: '✓' };

export type HintView =
  | { readonly kind: 'parity'; readonly odd: boolean }
  | { readonly kind: 'half'; readonly low: number; readonly high: number };

export function hintText(hint: HintView): string {
  if (hint.kind === 'parity') return `The number is ${hint.odd ? 'odd' : 'even'}.`;
  return `The number is between ${String(hint.low)} and ${String(hint.high)}.`;
}

const CODES: Readonly<Record<string, string>> = {
  OUT_OF_RANGE: 'That number is outside the range.',
  NUMBER_REMOVED: 'That number fell in Leaf Fall. Try another one.',
  ALREADY_GUESSED: 'You guessed that number already. It costs nothing — try another one.',
  INVALID_ACTION: 'Please type a whole number between −1 000 000 000 and 1 000 000 000.',
};

// "3", "3 and 9", "3, 9 and 12".
function listOf(numbers: readonly number[]): string {
  const all = numbers.map(String);
  const last = all.pop() ?? '';
  return all.length === 0 ? last : `${all.join(', ')} and ${last}`;
}

// A line about the round as a whole.
const roundLine = (text: string): FeedLine => ({ text, playerId: null, feedback: null });

function eventText(e: GtnEvent, names: Readonly<Record<string, string>>): FeedLine | null {
  const who = (id: string) => names[id] ?? id;
  switch (e.type) {
    // The fallen numbers by name: with a hidden range this line is the only place (T54).
    case 'NumbersRemoved':
      return roundLine(`Leaf Fall: ${listOf(e.numbers)} fell.`);
    case 'HintGiven':
      return e.playerId === null ? roundLine(`Spring Herald: ${hintText(e.hint)}`) : null;
    case 'RangeHalved':
      if (e.range === null)
        return roundLine(`Halving: every range is now ${String(e.size)} numbers.`);
      return roundLine(`Halving: the range is now ${String(e.range.low)}–${String(e.range.high)}.`);
    // The number and the answer only as far as the round's visibility lets the room see.
    case 'GuessFed':
      return {
        text: `${who(e.playerId)} guessed${e.value === undefined ? '.' : ` ${String(e.value)}`}`,
        playerId: e.playerId,
        feedback: e.feedback ?? null,
      };
    case 'FeedbackGiven':
      return null;
  }
}

export const gtnText: GameText = {
  code: (code) => CODES[code] ?? null,
  event: (event, names) => eventText(event as GtnEvent, names),
};
