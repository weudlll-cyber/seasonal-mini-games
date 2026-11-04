/**
 * @file   games/seasonal-target/web/text.ts
 * @module games/seasonal-target/web
 * @brief  Every sentence Seasonal Target puts in the platform's list, banner, intro and info note.
 *
 * Responsibility: the game's refusals (02d §4); one line per room event for the round's list:
 *                 Leaf Fall's count as the special's row (the hint shows once, as the grid's
 *                 hint quarter), halving's area or (individual) its size; the banner when Leaf
 *                 Fall or halving strikes; the list's guess rows from the player or spectator
 *                 view, the tile as `text`, the answer as `answer` (T119) and its tier as `tier`
 *                 (the answer's colour, O51), pending while Frost holds an own answer; the
 *                 closest miss besides the winner on the shared result (02d §9); the intro
 *                 line (02d §2) and the special's sentence for Spring and Autumn (T119).
 * Depends on:     @smg/game-sdk (GameText, GuessRow, FeedLine, formatNumber),
 *                 @smg-game/seasonal-target (types), ./words
 * Used by:        ./index, ./text.test
 * Spec:           docs/spec/02d-game-seasonal-target.md §2, §4, §6, §8, §9
 */
import type { PlayerView, ResultView, SpectatorView, StEvent } from '@smg-game/seasonal-target';
import {
  closestLabel,
  type FeedLine,
  formatNumber,
  type GameText,
  type GuessRow,
} from '@smg/game-sdk';

import { answerOf, areaText, cellText, rowTier, sizeText, tiles } from './words.js';

// The refusals; "outside the target area" is the input row's own, from the view (02d §4).
export const CODES: Readonly<Record<string, string>> = {
  OUT_OF_MAP: 'That tile is not on the grid.',
  OUT_OF_AREA: 'That tile is outside the target area.',
  CELL_REMOVED: 'That tile has fallen.',
  ALREADY_GUESSED: 'You already tried that tile.',
  INVALID_ACTION: 'Pick a tile on the grid.',
};

const roundLine = (text: string): FeedLine => ({ text, playerId: null });

function eventText(e: StEvent): FeedLine | null {
  switch (e.type) {
    // Each fall's row names which fall it is, so a round's rows are not all alike (night 6).
    case 'CellsFell': {
      const text =
        e.index <= 1
          ? `Leaf Fall: ${tiles(e.cells.length)} fell.`
          : `Leaf Fall: ${tiles(e.cells.length)} fell (fall ${String(e.index)}).`;
      return { ...roundLine(text), special: true };
    }
    // The hint shows once, as the grid's hint quarter; the platform's row says that it came.
    case 'HintGiven':
      return null;
    case 'AreaHalved':
      if (e.area === null) {
        return roundLine(`Halving: every target area is now ${sizeText(e.width, e.height)}.`);
      }
      return roundLine(
        `Halving: ${e.playerId === null ? 'the' : 'your'} target area is now ${areaText(e.area)}.`,
      );
    // Guesses are rows of their own, from the view (`guessRows`).
    case 'GuessFed':
    case 'FeedbackGiven':
      return null;
  }
}

function banner(event: unknown): string | null {
  const e = event as StEvent;
  if (e.type === 'CellsFell') return `Leaf Fall: ${tiles(e.cells.length)} fell.`;
  if (e.type !== 'AreaHalved') return null;
  if (e.area === null) return `Target areas halved: now ${sizeText(e.width, e.height)} each.`;
  return `Target area halved: ${areaText(e.area)}.`;
}

type Seen = PlayerView['log'][number];

// The list's rows of a player view (own guesses and the others') or a spectator view.
function guessRows(view: unknown): readonly GuessRow[] {
  const v = view as Partial<PlayerView> & Pick<SpectatorView, 'log'>;
  const row = (
    g: Omit<Seen, 'playerId' | 'held'>,
    playerId: string | null,
    held: boolean,
  ): GuessRow => ({
    key: String(g.receiveSeq),
    at: g.receivedAt,
    playerId,
    value: null,
    feedback: null,
    text: g.value === null ? null : cellText(g.value),
    answer: g.feedback === null ? null : answerOf(g.feedback),
    comment: g.comment,
    // The answer's own tier, not the comment's (null with comments off): the game's styles
    // colour the answer by it like the tile (./st.css).
    tier: g.feedback === null ? null : rowTier(g.feedback),
    // Frost's held answer, the viewer's own or another player's (T150).
    pending: held,
  });
  return [
    ...(v.guesses ?? []).map((g) => row(g, null, g.feedback === null)),
    ...v.log.map((g) => row(g, g.playerId, g.held)),
  ];
}

// The best guess of anyone but the winner: "Closest miss besides the winner: Anna, 3 tiles
// away (17, 30)." or, touching, "…: Anna, right next to the target (21, 31)."
function runnerUp(
  view: unknown,
  names: Readonly<Record<string, string>>,
  won: boolean,
): string | null {
  const miss = (view as Partial<ResultView>).closestMiss ?? null;
  if (miss === null) return null;
  const name = names[miss.playerId] ?? miss.playerId;
  const how = miss.touching ? 'right next to the target' : `${tiles(miss.distance)} away`;
  return `${closestLabel(won)}: ${name}, ${how} ${cellText(miss.value)}.`;
}

function intro(view: unknown, secretMode: 'shared' | 'individual'): string | null {
  const map = (view as Partial<Pick<PlayerView, 'map'>> | null)?.map;
  if (map === undefined) return null;
  const size = `${formatNumber(map.width)} × ${formatNumber(map.height)}`;
  return secretMode === 'shared'
    ? `Shared target on a ${size} grid`
    : `Everyone has their own target on a ${size} grid`;
}

// The specials that work differently here than the platform's sentence says (T119).
function specialRule(season: string): string | null {
  if (season === 'spring') return 'Everyone learns which quarter of the grid hides the target.';
  if (season === 'autumn') return 'Every so often, some tiles without a target fall off the grid.';
  return null;
}

export const stText: GameText = {
  code: (code) => CODES[code] ?? null,
  event: (event) => eventText(event as StEvent),
  guesses: guessRows,
  runnerUp,
  banner,
  intro,
  specialRule,
};
