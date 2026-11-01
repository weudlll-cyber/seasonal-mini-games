/**
 * @file   games/guess-the-number/web/text.ts
 * @module games/guess-the-number/web
 * @brief  Every sentence Guess The Number puts on a screen, in plain English.
 *
 * Responsibility: the game's refusals, the Spring Herald hint (and its highlighted "Free
 *                 hint: the number is even." in the range block, O35), one line per room event for
 *                 the round's list (02 §12; 03 §2): Leaf Fall with the fallen numbers named,
 *                 the shared hint and halving, and the shorter banner when Leaf Fall or
 *                 halving strikes ("Leaf Fall: 10 numbers fell.", O35); the list's guess rows from the player or
 *                 spectator view, own guesses and the others' at the round's visibility, with
 *                 answers and comments as far as the view carries them (O20, O21); and the
 *                 closest miss on the shared result (O22); the round intro's line on the
 *                 number and its range (O36). Server codes never reach the screen
 *                 as codes.
 * Depends on:     @smg/game-sdk (GameText, GuessRow), ../src (types)
 * Used by:        ./PlayerPanel, ./SpectatorPanel, ./ResultPanel, ./index
 * Spec:           docs/spec/02-game-guess-the-number.md §6, §9, §12; docs/spec/03-seasonal-specials.md §2
 */
import type { GtnEvent, PlayerView, ResultView, SpectatorView } from '@smg-game/guess-the-number';
import type { FeedLine, GameText, GuessRow } from '@smg/game-sdk';

export type HintView =
  | { readonly kind: 'parity'; readonly odd: boolean }
  | { readonly kind: 'half'; readonly low: number; readonly high: number };

// The hint's words after a lead-in: "the number is even."
function hintBody(hint: HintView): string {
  if (hint.kind === 'parity') return `the number is ${hint.odd ? 'odd' : 'even'}.`;
  return `the number is between ${String(hint.low)} and ${String(hint.high)}.`;
}

function hintText(hint: HintView): string {
  const body = hintBody(hint);
  return `${body.charAt(0).toUpperCase()}${body.slice(1)}`;
}

// The range block's highlighted line for the whole round (O35).
export const freeHint = (hint: HintView): string => `Free hint: ${hintBody(hint)}`;

const CODES: Readonly<Record<string, string>> = {
  OUT_OF_RANGE: 'That number is outside the range.',
  NUMBER_REMOVED: 'Already fallen.',
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

// The banner when Leaf Fall or halving strikes (O35); the list row keeps the details.
function banner(event: unknown): string | null {
  const e = event as GtnEvent;
  if (e.type === 'NumbersRemoved') {
    const n = e.numbers.length;
    return `Leaf Fall: ${String(n)} ${n === 1 ? 'number' : 'numbers'} fell.`;
  }
  if (e.type !== 'RangeHalved') return null;
  if (e.range === null) return `Range halved: every range is now ${String(e.size)} numbers.`;
  const whose = e.playerId === null ? 'the number is' : 'your number is';
  return `Range halved: ${whose} between ${String(e.range.low)} and ${String(e.range.high)}.`;
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

// The closest miss on the shared result (O22): "bot-01 missed by just 1 (92)." up to 2 away.
function runnerUp(view: unknown, names: Readonly<Record<string, string>>): string | null {
  const miss = (view as Partial<ResultView>).closestMiss ?? null;
  if (miss === null) return null;
  const name = names[miss.playerId] ?? miss.playerId;
  const n = String(miss.distance);
  const guess = String(miss.value);
  return miss.distance <= 2
    ? `${name} missed by just ${n} (${guess}).`
    : `Closest miss: ${name}, ${n} away (${guess}).`;
}

// The intro's line (O36): the mode and the range, or that the range is hidden (O19).
function intro(view: unknown, secretMode: 'shared' | 'individual'): string | null {
  const v = view as Partial<Pick<PlayerView, 'range'>> | null;
  if (v?.range === undefined) return null;
  if (v.range === null) return 'Hidden range';
  const between = `between ${String(v.range.low)} and ${String(v.range.high)}`;
  return secretMode === 'shared'
    ? `Shared number ${between}`
    : `Everyone has their own number ${between}`;
}

export const gtnText: GameText = {
  code: (code) => CODES[code] ?? null,
  event: (event) => eventText(event as GtnEvent),
  guesses: guessRows,
  runnerUp,
  banner,
  intro,
};
