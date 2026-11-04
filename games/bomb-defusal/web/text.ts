/**
 * @file   games/bomb-defusal/web/text.ts
 * @module games/bomb-defusal/web
 * @brief  Every sentence Seasonal Bomb Defusal puts on a screen, in plain English.
 *
 * Responsibility: the game's refusals (02c §4); one line per room event for the round's list
 *                 (the wires Leaf Fall marks harmless and the last fall, O42; the hint shows
 *                 once, in the wire panel) and the banner when a fall strikes (02c §8, O35); the
 *                 list's guess rows from the player or spectator view: the sequence as
 *                 "red → blue → …" where the view shows it, else "cut a sequence", and the
 *                 answer in words ("First 2 cuts right", "Boom!" with the icon,
 *                 "Defused!") with its tone (T119), and the sequence as colour dots with their
 *                 names (`swatches`, T143; the fills are `WIRE_COLORS`, shared with the
 *                 swatches of ./WireChip); the closest miss on the shared result
 *                 (02c §9); the intro's line on the bomb (02c §3); the season special in this
 *                 game's terms (T119). Server codes never reach the screen as codes.
 * Depends on:     @smg/game-sdk (GameText, GuessRow), @smg-game/bomb-defusal (types, wording)
 * Used by:        ./BombBlock, ./WireInput, ./ResultPanel, ./index
 * Spec:           docs/spec/02c-game-bomb-defusal.md §4–§11; docs/spec/04-software-architecture.md §4.6
 */
import {
  sequenceText,
  type BdEvent,
  type Feedback,
  type PlayerView,
  type ResultView,
  type Sequence,
  type SpectatorView,
  type Wire,
} from '@smg-game/bomb-defusal';
import {
  closestLabel,
  type FeedLine,
  type GameText,
  type GuessAnswer,
  type GuessRow,
  type Season,
} from '@smg/game-sdk';

// The explosion icon: meaning by icon and words, never by colour alone (02c §5.2).
export const BOOM_ICON = '💥';

const CODES: Readonly<Record<string, string>> = {
  SEQUENCE_INVALID: 'Choose a different wire of this bomb for every slot.',
  WIRE_HARMLESS: 'That wire is harmless — it is not part of the sequence.',
  ALREADY_GUESSED: 'You already tried that order.',
  INVALID_ACTION: 'Choose wires of this bomb only.',
};

// "Choose 4 different wires of this bomb." where the input knows the number of cuts.
export const chooseText = (cuts: number): string =>
  `Choose ${String(cuts)} different wires of this bomb.`;

// "the orange wire", "the orange and purple wires".
const wiresPhrase = (wires: readonly Wire[]): string =>
  wires.length === 1 ? `the ${wires[0] ?? ''} wire` : `the ${wires.join(' and ')} wires`;

const harmlessText = (wires: readonly Wire[]): string =>
  `Leaf Fall: ${wiresPhrase(wires)} ${wires.length === 1 ? 'is' : 'are'} harmless.`;

export const hintText = (wire: Wire): string => `Free hint: cut ${wire} first.`;

// The hint in a few words for the phone's info line (T150): "Hint: red first".
export const shortHint = (wire: Wire): string => `Hint: ${wire} first`;

// A slot holding a wire marked harmless after it was put there (02c §11).
export const takeOutText = (wire: Wire): string =>
  `The ${wire} wire is harmless now — take it out.`;

const roundLine = (text: string): FeedLine => ({ text, playerId: null });

function eventText(e: BdEvent): FeedLine | null {
  switch (e.type) {
    case 'WiresHarmless':
      return { ...roundLine(harmlessText(e.wires)), special: true };
    case 'HarmlessOver':
      return { ...roundLine('Leaf Fall: every harmless wire is marked.'), special: true };
    // The hint shows once, in the wire panel; the platform's row says that it came (O47).
    case 'HintGiven':
      return null;
    // Sequences are rows of their own, from the view (`guessRows`).
    case 'GuessFed':
    case 'FeedbackGiven':
      return null;
  }
}

// The banner says what the newest row says: a marked wire, or that every one is marked (the
// banner fell back to the older wire's line before; night-5 review).
function banner(event: unknown): string | null {
  const e = event as BdEvent;
  if (e.type === 'WiresHarmless') return harmlessText(e.wires);
  return e.type === 'HarmlessOver' ? 'Leaf Fall: every harmless wire is marked.' : null;
}

// "First cut right", "First 2 cuts right" (02c §5.1): short, so the row keeps one line (T143).
const rightText = (k: number): string =>
  k === 1 ? 'First cut right' : `First ${String(k)} cuts right`;

// A wire's fill, the one source for the swatches (./swatch.css draws the ring) and the list's
// colour dots (T143).
export const WIRE_COLORS: Readonly<Record<Wire, string>> = {
  red: '#d32f2f',
  blue: '#1e5bd6',
  yellow: '#f5c518',
  green: '#2e9e48',
  white: '#ffffff',
  black: '#111111',
  orange: '#f57c00',
  purple: '#7b3fbf',
};

// The answer in words with its tone (T119): the explosion, the right start, or defused.
export function answerText(f: Feedback, cuts: number): GuessAnswer {
  if (f.defused) return { text: 'Defused!', tone: 'correct' };
  if (f.correct === 0) return { text: `${BOOM_ICON} Boom!`, tone: 'boom' };
  return { text: rightText(f.correct), tone: 2 * f.correct >= cuts ? 'close' : 'far' };
}

interface Seen {
  readonly receiveSeq: number;
  readonly receivedAt: number;
  readonly value: Sequence | null;
  readonly feedback: Feedback | null;
  readonly tier: string | null;
  readonly comment: string | null;
}

// The list's rows of a player view (own sequences and the others') or a spectator view.
function guessRows(view: unknown): readonly GuessRow[] {
  const v = view as Partial<PlayerView> & Pick<SpectatorView, 'log' | 'cuts'>;
  const row = (g: Seen, playerId: string | null, held: boolean): GuessRow => ({
    key: String(g.receiveSeq),
    at: g.receivedAt,
    playerId,
    value: null,
    feedback: null,
    text: g.value === null ? 'cut a sequence' : sequenceText(g.value),
    // The sequence as colour dots in order, each named (T143).
    swatches: g.value === null ? null : g.value.map((w) => ({ name: w, color: WIRE_COLORS[w] })),
    answer: g.feedback === null ? null : answerText(g.feedback, v.cuts),
    comment: g.comment,
    tier: g.tier,
    // Frost's held answer, the viewer's own or another player's (T150).
    pending: held,
  });
  return [
    ...(v.guesses ?? []).map((g) => row(g, null, g.feedback === null)),
    ...v.log.map((g) => row(g, g.playerId, g.held)),
  ];
}

// 02c §9: "Closest: Anna, the first 3 cuts right (red → blue → yellow → black)."
function runnerUp(
  view: unknown,
  names: Readonly<Record<string, string>>,
  won: boolean,
): string | null {
  const miss = (view as Partial<ResultView>).closestMiss ?? null;
  if (miss === null) return null;
  const name = names[miss.playerId] ?? miss.playerId;
  const right =
    miss.correct === 1 ? 'the first cut right' : `the first ${String(miss.correct)} cuts right`;
  return `${closestLabel(won)}: ${name}, ${right} (${sequenceText(miss.value)}).`;
}

// The intro's line (02c §3): "Shared bomb: 6 wires, 4 cuts".
function intro(view: unknown, secretMode: 'shared' | 'individual'): string | null {
  const v = view as Partial<Pick<PlayerView, 'wires' | 'cuts'>> | null;
  if (v?.wires === undefined || v.cuts === undefined) return null;
  const size = `${String(v.wires.length)} wires, ${String(v.cuts)} cuts`;
  return secretMode === 'shared'
    ? `Shared bomb: ${size}`
    : `Everyone defuses their own bomb: ${size}`;
}

// The specials in this game's terms; Heatwave and Frost keep the platform's sentence.
function specialRule(season: Season): string | null {
  if (season === 'spring') return 'At the start, a free hint names the colour of the first cut.';
  if (season === 'autumn')
    return 'Every so often, a wire that is in no sequence is marked harmless.';
  return null;
}

export const bdText: GameText = {
  code: (code) => CODES[code] ?? null,
  event: (event) => eventText(event as BdEvent),
  guesses: guessRows,
  runnerUp,
  banner,
  intro,
  specialRule,
};
