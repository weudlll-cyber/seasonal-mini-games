/**
 * @file   games/seasonal-target/web/words.ts
 * @module games/seasonal-target/web
 * @brief  How Seasonal Target words a tile, an area, a quarter and an answer.
 *
 * Responsibility: "(12, 34)" and "column 12, row 34", "columns 13–37, rows 1–50", the quarter
 *                 hint, a count of tiles, and an answer long ("9 tiles away, to the north-east",
 *                 "9 tiles away") and short ("9 away, NE ↗", "9 away"), the tier words of
 *                 `closeness` mode, the grid's size in tiles; the answer's tone and tier for the
 *                 list: only a found target takes the platform's colour, a miss is coloured by
 *                 its server tier like its tile (./st.css, O51). Every number through
 *                 `formatNumber` (T114).
 * Depends on:     @smg/game-sdk (formatNumber, GuessAnswer), @smg-game/seasonal-target (types)
 * Used by:        ./text, ./heat, ./TileGrid, ./TargetInput, ./PlayerPanel, ./SpectatorPanel,
 *                 ./ResultPanel, ./FallenCells
 * Spec:           docs/spec/02d-game-seasonal-target.md §4, §5, §7, §8.1, §8.4
 */
import type { Area, Cell, Compass, Feedback, Quarter } from '@smg-game/seasonal-target';
import { formatNumber, type GuessAnswer } from '@smg/game-sdk';

const n = formatNumber;

export const cellText = (c: Cell): string => `(${n(c.x)}, ${n(c.y)})`;
export const cellWords = (c: Cell): string => `column ${n(c.x)}, row ${n(c.y)}`;

const span = (low: number, high: number): string =>
  low === high ? n(low) : `${n(low)}–${n(high)}`;

export const areaText = (a: Area): string =>
  `columns ${span(a.left, a.right)}, rows ${span(a.top, a.bottom)}`;

// "1 tile", "9 tiles".
export const tiles = (k: number): string => `${n(k)} ${k === 1 ? 'tile' : 'tiles'}`;

export const sizeText = (width: number, height: number): string =>
  `${n(width)} × ${n(height)} tiles`;

// The highlighted line for the whole round (02d §8.1).
export const freeHint = (q: Quarter): string =>
  `Free hint: the target is in the ${q.name} quarter (${areaText(q)}).`;

export const areaLine = (a: Area): string => `Target area: ${areaText(a)}`;

const WORDS: Readonly<Record<Compass, string>> = {
  N: 'north',
  NE: 'north-east',
  E: 'east',
  SE: 'south-east',
  S: 'south',
  SW: 'south-west',
  W: 'west',
  NW: 'north-west',
};

export const ARROWS: Readonly<Record<Compass, string>> = {
  N: '↑',
  NE: '↗',
  E: '→',
  SE: '↘',
  S: '↓',
  SW: '↙',
  W: '←',
  NW: '↖',
};

// The tier as the answer of `closeness` mode (02d §5).
export const TIER_WORDS: Readonly<Record<string, string>> = {
  wayOff: 'Way off',
  cold: 'Cold',
  cool: 'Cool',
  warm: 'Warm',
  hot: 'Hot',
  burning: 'Burning',
  justMissed: 'Just missed — right next to it',
};

const FOUND = 'Target found!';

// "9 tiles away, to the north-east", "9 tiles away", "Warm".
export function longAnswer(f: Feedback): string {
  if (f.kind === 'correct') return FOUND;
  if (f.kind === 'closeness') return TIER_WORDS[f.tier] ?? f.tier;
  const away = `${tiles(f.distance)} away`;
  return f.kind === 'direction' ? `${away}, to the ${WORDS[f.direction]}` : away;
}

// "9 away, NE ↗" or "9 away" for the list.
export function shortAnswer(f: Feedback): string {
  if (f.kind === 'direction') return `${n(f.distance)} away, ${f.direction} ${ARROWS[f.direction]}`;
  if (f.kind === 'distance') return `${n(f.distance)} away`;
  return longAnswer(f);
}

// The row's tone: found in the platform's colour; every miss `far`, which the platform leaves
// plain, so the game's styles colour it by the row's tier like the tile, never a green "hot".
export const toneOf = (f: Feedback): GuessAnswer['tone'] =>
  f.kind === 'correct' ? 'correct' : 'far';

// The row's tier for the list's styles: the server's (`correct` for a found target), prefixed,
// because the game's styles apply to the platform's list and other games' tiers share names.
export const rowTier = (f: Feedback): string => `st-${f.kind === 'correct' ? 'correct' : f.tier}`;

export const answerOf = (f: Feedback): GuessAnswer => ({ text: shortAnswer(f), tone: toneOf(f) });
