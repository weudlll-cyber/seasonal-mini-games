/**
 * @file   packages/game-sdk/src/web.ts
 * @module game-sdk
 * @brief  What a game's screens get from the player client, and the words it gives back.
 *
 * Responsibility: the props of a game's player, spectator and result panels and its text
 *                 hooks, as plain types (no UI library is named here; the registry's web half
 *                 binds them to components). The platform client draws everything common —
 *                 banner, cooldown ring, roster, the round's one list, results, proof — and
 *                 hands the game only its own view, a way to act, and the clock. The game
 *                 turns its view into the list's guess rows (`GuessRow`, O20) and words its
 *                 event rows (`FeedLine`); the client draws both, in one list. On the result
 *                 page the game words the line about the best of the rest (`runnerUp`, O22).
 *                 A game whose guesses are not numbers gives them and their answers in words
 *                 (`text`, `answer`) or as colour dots (`swatches`, T143), and words its own special
 *                 (`specialRule`, T119). A phased game's panels also get the round's timing and
 *                 the viewer's own part of the match (T327). The
 *                 panels learn the cooldown's seconds left and the players' names and colours,
 *                 and `buttonText` words every send button during the cooldown (T125).
 * Depends on:     ./module
 * Used by:        ./index, games/<game>/web, games/registry/web, apps/web
 * Spec:           docs/spec/04-software-architecture.md §4.6; docs/spec/02-game-guess-the-number.md §12
 */
import type { Season } from './module.js';
import type { PhasePlan } from './phased.js';
import type { PlayerMark } from './marks.js';

export interface ActReply {
  readonly ok: boolean;
  readonly code?: string;
  readonly until?: number;
  readonly cooldownEndsAt?: number;
}

// A phased round's public timing (04 §4.8): when it opened and its plan, so the game shows its
// phases and counts down to them, and the server's time (corrected by the measured offset, 06
// §4.1); the server enforces the phases. Absent for the guess games.
export interface PhasedTiming {
  readonly opensAt: number;
  readonly plan: PhasePlan;
  readonly now: () => number;
}

// The viewer's own part of a phased game's match (04 §4.8 rule 8), on their own page only: the
// running round's number in the match, their match value with a way to save it, and the code of
// their pre-pick refused at this round's opening as it arrived (`prefs.refused`), else null.
export interface OwnMatchPart {
  readonly roundIndex: number;
  readonly prefs: unknown;
  readonly save: (prefs: unknown) => Promise<{ readonly ok: boolean; readonly code?: string }>;
  readonly refusedPrePick: string | null;
}

export interface PlayerPanelProps {
  // The game's player view from the server; the panel only renders it.
  readonly view: unknown;
  readonly act: (action: unknown) => Promise<ActReply>;
  // False while the cooldown runs or the round is not open: the panel disables its input.
  readonly canAct: boolean;
  // Frost's delay when this round has Frost, for "answer arriving in 2 s".
  readonly frostDelayMs: number | null;
  // Server time, corrected by the measured clock offset (06 §4.1).
  readonly now: () => number;
  readonly season: Season;
  // Whether the round's season special is on: a game shows a special's own parts (Guess The
  // Number's fallen numbers in autumn) only then.
  readonly specialOn: boolean;
  // Whole seconds left of the viewer's cooldown while the round is open, else null: the
  // send button then reads "Wait 6 s" (`buttonText`), not as broken (T125).
  readonly waitS: number | null;
  // The round's players by key: display names and the one colour each has in the list, for
  // a game that draws players elsewhere too (Seasonal Target's dots, T125).
  readonly names: Readonly<Record<string, string>>;
  readonly colors: Readonly<Record<string, string>>;
  // A game with player tags (O62): every player's tag and marker, as the list shows them, and
  // the viewer's own key; absent for the other games.
  readonly marks?: Readonly<Record<string, PlayerMark>> | undefined;
  readonly viewerKey?: string | null | undefined;
  // A phased round's timing and the viewer's own part of its match (DECISIONS T327).
  readonly timing?: PhasedTiming | undefined;
  readonly own?: OwnMatchPart | undefined;
}

export interface SpectatorPanelProps {
  readonly view: unknown;
  // A phased round's timing (DECISIONS T327).
  readonly timing?: PhasedTiming | undefined;
  readonly names: Readonly<Record<string, string>>;
  readonly colors: Readonly<Record<string, string>>;
  readonly marks?: Readonly<Record<string, PlayerMark>> | undefined;
  readonly viewerKey?: string | null | undefined;
  readonly season: Season;
  readonly specialOn: boolean;
}

// The result panel draws one of its two parts (T150): `reveal`, the secret (a board game's
// grid with it), in the result's first screen; `history`, every player's guesses in full,
// below it.
export interface ResultPanelProps {
  readonly view: unknown;
  readonly names: Readonly<Record<string, string>>;
  readonly colors: Readonly<Record<string, string>>;
  readonly viewerKey: string | null;
  readonly marks?: Readonly<Record<string, PlayerMark>> | undefined;
  readonly part: 'reveal' | 'history';
}

// A player without a guess in a result's history (T150), the same words for every game.
export const NO_GUESSES = 'did not guess';

// A send button's words: its own while the player may act, "Wait 6 s" during the cooldown
// (T125), the same for every game.
export const buttonText = (label: string, waitS: number | null): string =>
  waitS === null ? label : `Wait ${String(waitS)} s`;

// An event row of the round's list: the line and the player it is about (for the colour
// dot), or null for the round as a whole. `special`: the row of the season special striking
// (Leaf Fall), drawn on the season's tint with its icon in bold instead of a quiet line.
export interface FeedLine {
  readonly text: string;
  readonly playerId: string | null;
  readonly special?: boolean;
}

// The answer of a game that is not about higher or lower (T119): "2 right place, 1 wrong
// place" with its pegs, "The first 2 cuts were right", "12 away, NE".
export interface GuessAnswer {
  readonly text: string;
  readonly tone: 'correct' | 'close' | 'far' | 'boom';
  readonly pegs?: readonly ('hit' | 'near' | 'miss')[];
}

// One colour dot of a guess: its name (read out and shown on hover) and its CSS colour.
export interface GuessSwatch {
  readonly name: string;
  readonly color: string;
}

// One guess in the round's list, as far as this viewer's view shows it (O20, O21).
export interface GuessRow {
  readonly key: string;
  // When the server received the guess: the list's order with the event rows.
  readonly at: number;
  // Null: the viewer's own guess.
  readonly playerId: string | null;
  // Null where the viewer may not see the number.
  readonly value: number | null;
  readonly feedback: 'higher' | 'lower' | 'correct' | null;
  // A guess that is not a number, in words ("0427", "red, blue, green", "(12, 34)"); null or
  // absent where the viewer may not see it (DECISIONS T119).
  readonly text?: string | null;
  // A guess drawn as colour dots in order (Bomb Defusal's cut sequence, T143), each with its
  // name as accessible text and tooltip; the platform draws them in place of `text`.
  readonly swatches?: readonly GuessSwatch[] | null;
  // An answer other than higher/lower, used when `feedback` is null: its words, a tone the
  // platform colours by, and optional pegs drawn before the words (never colour alone).
  readonly answer?: GuessAnswer | null;
  // The closeness comment, exactly when the answer is shown; its tier for styling.
  readonly comment: string | null;
  readonly tier: string | null;
  // An answer Frost still holds ("answer arriving… 2 s"): the viewer's own, or another
  // player's where the round shows the others' answers (T150).
  readonly pending: boolean;
}

// The closest-miss line's start (O22, T145): with a winner the best of the rest, on a time-up
// result the closest guess of the round.
export const closestLabel = (won: boolean): string =>
  won ? 'Closest miss besides the winner' : 'Closest guess';

// Plain English for the game's own rejection codes and room events (02 §12); null when the
// text is not the game's. `guesses` turns the game's player or spectator view into rows.
// `runnerUp` words the best of the rest from the result view (`won`: the round has a winner;
// without one, the closest guess, T145), shown where the winning margin goes when the round
// has none (O22), or null.
export interface GameText {
  readonly code: (code: string) => string | null;
  readonly event: (event: unknown, names: Readonly<Record<string, string>>) => FeedLine | null;
  readonly guesses: (view: unknown) => readonly GuessRow[];
  readonly runnerUp: (
    resultView: unknown,
    names: Readonly<Record<string, string>>,
    won: boolean,
  ) => string | null;
  // The banner above the round's list when one of the game's special events happens, short
  // and in the season colour ("Leaf Fall: 10 numbers fell.", O35); null, or no hook, shows
  // none. The event still gets its list row from `event`.
  readonly banner?: (event: unknown) => string | null;
  // The round intro's line on the secret ("Shared number between 1 and 100", "Hidden range"),
  // from a player's or spectator's view during the countdown; null, or no hook, shows none.
  readonly intro?: (view: unknown, secretMode: 'shared' | 'individual') => string | null;
  // The season special's one plain sentence in the game's terms ("Every so often, a digit
  // that is not in the code falls out."), for the intro screen and the top bar's note; null,
  // or no hook, keeps the platform's sentence (T119).
  readonly specialRule?: (season: Season) => string | null;
}

// A phased game's panel in the waiting area (04 §4.8 rule 8; Mind Games' pre-picks): the
// viewer's own value (null before the first save), the series' rounds and those played, and a
// way to save a new value, which the server checks against the game's schema.
export interface PrefsPanelProps {
  readonly prefs: unknown;
  // The series' rounds, or null before its first round (the game's form knows its default).
  readonly rounds: number | null;
  readonly played: number;
  readonly save: (prefs: unknown) => Promise<{ readonly ok: boolean; readonly code?: string }>;
}
