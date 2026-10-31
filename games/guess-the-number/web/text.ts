/**
 * @file   games/guess-the-number/web/text.ts
 * @module games/guess-the-number/web
 * @brief  Every sentence Guess The Number puts on a screen, in plain English.
 *
 * Responsibility: the game's refusals, the Spring Herald hint, one line per room event for
 *                 the round's list (02 §12; 03 §2): Leaf Fall with the fallen numbers named,
 *                 the shared hint and halving; and the list's guess rows from the player or
 *                 spectator view, own guesses and the others' at the round's visibility, with
 *                 answers and comments as far as the view carries them (O20, O21). Server codes
 *                 never reach the screen as codes.
 * Depends on:     @smg/game-sdk (GameText, GuessRow), ../src (types)
 * Used by:        ./PlayerPanel, ./SpectatorPanel, ./ResultPanel, ./index
 * Spec:           docs/spec/02-game-guess-the-number.md §6, §12; docs/spec/03-seasonal-specials.md §2
 */
import type { GtnEvent, PlayerView, SpectatorView } from '@smg-game/guess-the-number';
import type { FeedLine, GameText, GuessRow } from '@smg/game-sdk';

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
const roundLine = (text: string): FeedLine => ({ text, playerId: null });

function eventText(e: GtnEvent): FeedLine | null {
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
    // Guesses are rows of their own, from the view (`guessRows`), so they survive a reload.
    case 'GuessFed':
    case 'FeedbackGiven':
      return null;
  }
}

type Seen = PlayerView['log'][number];

// The list's rows of a player view (own guesses and the others') or a spectator view.
function guessRows(view: unknown): readonly GuessRow[] {
  const v = view as Partial<PlayerView> & Pick<SpectatorView, 'log'>;
  const row = (g: Omit<Seen, 'playerId'>, playerId: string | null): GuessRow => ({
    key: String(g.receiveSeq),
    at: g.receivedAt,
    playerId,
    value: g.value,
    feedback: g.feedback,
    comment: g.comment,
    tier: g.tier,
    pending: playerId === null && g.feedback === null,
  });
  return [...(v.guesses ?? []).map((g) => row(g, null)), ...v.log.map((g) => row(g, g.playerId))];
}

export const gtnText: GameText = {
  code: (code) => CODES[code] ?? null,
  event: (event) => eventText(event as GtnEvent),
  guesses: guessRows,
};
