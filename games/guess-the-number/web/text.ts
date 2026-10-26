/**
 * @file   games/guess-the-number/web/text.ts
 * @module games/guess-the-number/web
 * @brief  Every sentence Guess The Number puts on a screen, in plain English.
 *
 * Responsibility: the answers ("The number is higher than 412."), the game's refusals, the
 *                 Spring Herald hint, and one line per room event for the live feed (02 §6,
 *                 §12; 03 §2): Leaf Fall, the shared hint, halving, and a guess at the round's
 *                 visibility. Server codes never reach the screen as codes.
 * Depends on:     @smg/game-sdk (GameText), ../src (types)
 * Used by:        ./PlayerPanel, ./SpectatorPanel, ./ResultPanel, ./index
 * Spec:           docs/spec/02-game-guess-the-number.md §6, §12; docs/spec/03-seasonal-specials.md §2
 */
import type { Feedback, GtnEvent } from '@smg-game/guess-the-number';
import type { GameText } from '@smg/game-sdk';

export function answerText(value: number, feedback: Feedback): string {
  if (feedback === 'higher') return `The number is higher than ${String(value)}.`;
  if (feedback === 'lower') return `The number is lower than ${String(value)}.`;
  return `${String(value)} is the number!`;
}

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
  INVALID_ACTION: 'Please type a whole number.',
};

function eventText(e: GtnEvent, names: Readonly<Record<string, string>>): string | null {
  const who = (id: string) => names[id] ?? id;
  switch (e.type) {
    case 'NumbersRemoved':
      return `Leaf Fall: ${String(e.numbers.length)} numbers fell.`;
    case 'HintGiven':
      return e.playerId === null ? `Spring Herald: ${hintText(e.hint)}` : null;
    case 'RangeHalved':
      if (e.range === null) return `Halving: every range is now ${String(e.size)} numbers.`;
      return `Halving: the range is now ${String(e.range.low)}–${String(e.range.high)}.`;
    case 'GuessFed': {
      if (e.value === undefined) return `${who(e.playerId)} guessed.`;
      if (e.feedback === undefined) return `${who(e.playerId)} guessed ${String(e.value)}.`;
      return `${who(e.playerId)} guessed ${String(e.value)} — ${e.feedback}.`;
    }
    case 'FeedbackGiven':
      return null;
  }
}

export const gtnText: GameText = {
  code: (code) => CODES[code] ?? null,
  event: (event, names) => eventText(event as GtnEvent, names),
};
