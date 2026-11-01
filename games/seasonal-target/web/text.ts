/**
 * @file   games/seasonal-target/web/text.ts
 * @module games/seasonal-target/web
 * @brief  Every sentence Seasonal Target puts in the platform's list, banner, intro and info note.
 *
 * Responsibility: the game's refusals (02d §4); one line per room event for the round's list:
 *                 Leaf Fall's count as the special's row, the shared quarter or "everyone
 *                 received a hint", halving's area or (individual) its size; the banner when Leaf
 *                 Fall or halving strikes; the list's guess rows from the player or spectator
 *                 view, the cell as `text` and the answer as `answer` (T119), pending while Frost
 *                 holds an own answer; the closest miss on the shared result (02d §9); the intro
 *                 line (02d §2) and the special's sentence for Spring and Autumn (T119).
 * Depends on:     @smg/game-sdk (GameText, GuessRow, FeedLine, formatNumber),
 *                 @smg-game/seasonal-target (types), ./words
 * Used by:        ./index, ./text.test
 * Spec:           docs/spec/02d-game-seasonal-target.md §2, §4, §6, §8, §9
 */
import type { PlayerView, ResultView, SpectatorView, StEvent } from '@smg-game/seasonal-target';
import { formatNumber, type FeedLine, type GameText, type GuessRow } from '@smg/game-sdk';

import { answerOf, areaText, cellText, sizeText } from './words.js';

// The refusals; "outside the target area" is the input row's own, from the view (02d §4).
export const CODES: Readonly<Record<string, string>> = {
  OUT_OF_MAP: 'That cell is not on the map.',
  OUT_OF_AREA: 'That cell is outside the target area.',
  CELL_REMOVED: 'That cell has fallen.',
  ALREADY_GUESSED: 'You already tried that cell.',
  INVALID_ACTION: 'Pick a cell on the map.',
};

const roundLine = (text: string): FeedLine => ({ text, playerId: null });
const cells = (k: number): string => `${formatNumber(k)} ${k === 1 ? 'cell' : 'cells'}`;

function eventText(e: StEvent): FeedLine | null {
  switch (e.type) {
    case 'CellsFell':
      return { ...roundLine(`Leaf Fall: ${cells(e.cells.length)} fell.`), special: true };
    case 'HintGiven':
      if (e.playerId !== null) return null;
      return roundLine(
        e.quarter === null
          ? 'Spring Herald: everyone received a hint.'
          : `Spring Herald: the target is in the ${e.quarter.name} quarter (${areaText(e.quarter)}).`,
      );
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
  if (e.type === 'CellsFell') return `Leaf Fall: ${cells(e.cells.length)} fell.`;
  if (e.type !== 'AreaHalved') return null;
  if (e.area === null) return `Target areas halved: now ${sizeText(e.width, e.height)} each.`;
  return `Target area halved: ${areaText(e.area)}.`;
}

type Seen = PlayerView['log'][number];

// The list's rows of a player view (own guesses and the others') or a spectator view.
function guessRows(view: unknown): readonly GuessRow[] {
  const v = view as Partial<PlayerView> & Pick<SpectatorView, 'log'>;
  const row = (g: Omit<Seen, 'playerId'>, playerId: string | null): GuessRow => ({
    key: String(g.receiveSeq),
    at: g.receivedAt,
    playerId,
    value: null,
    feedback: null,
    text: g.value === null ? null : cellText(g.value),
    answer: g.feedback === null ? null : answerOf(g.feedback),
    comment: g.comment,
    tier: g.tier,
    pending: playerId === null && g.feedback === null,
  });
  return [...(v.guesses ?? []).map((g) => row(g, null)), ...v.log.map((g) => row(g, g.playerId))];
}

// "Anna just missed — the next cell (21, 31)." or "Closest miss: Anna, 3 cells away (17, 30)."
function runnerUp(view: unknown, names: Readonly<Record<string, string>>): string | null {
  const miss = (view as Partial<ResultView>).closestMiss ?? null;
  if (miss === null) return null;
  const name = names[miss.playerId] ?? miss.playerId;
  if (miss.touching) return `${name} just missed — the next cell ${cellText(miss.value)}.`;
  return `Closest miss: ${name}, ${cells(miss.distance)} away ${cellText(miss.value)}.`;
}

function intro(view: unknown, secretMode: 'shared' | 'individual'): string | null {
  const map = (view as Partial<Pick<PlayerView, 'map'>> | null)?.map;
  if (map === undefined) return null;
  const size = `${formatNumber(map.width)} × ${formatNumber(map.height)}`;
  return secretMode === 'shared'
    ? `Shared target on a ${size} map`
    : `Everyone has their own target on a ${size} map`;
}

// The specials that work differently here than the platform's sentence says (T119).
function specialRule(season: string): string | null {
  if (season === 'spring') return 'Everyone learns which quarter of the map hides the target.';
  if (season === 'autumn') return 'Every so often, some cells without a target fall off the map.';
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
