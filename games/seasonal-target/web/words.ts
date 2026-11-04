/**
 * @file   games/seasonal-target/web/words.ts
 * @module games/seasonal-target/web
 * @brief  How Seasonal Target words a tile, an area, a quarter and an answer.
 *
 * Responsibility: "(12, 34)" and "column 12, row 34", "columns 13–37, rows 1–50", the two
 *                 quarters' hint (O61), a count of tiles, and an answer long ("9 tiles away, to the north-east",
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
import type { Area, Cell, Compass, Feedback, QuarterPair } from '@smg-game/seasonal-target';
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

// The highlighted line for the whole round: the two quarters in their fixed order, which
// never tells which one holds the target (O61, 02d §8.1).
export const freeHint = ([a, b]: QuarterPair): string =>
  `Free hint: the target is in one of the two green quarters, ${a.name} (${areaText(a)}) or ${b.name} (${areaText(b)}).`;

const SHORT: Readonly<Record<string, string>> = {
  'north-west': 'NW',
  'north-east': 'NE',
  'south-west': 'SW',
  'south-east': 'SE',
};

// The hint in a few words for the phone's info line: "Hint: NW or SE".
export const shortHint = ([a, b]: QuarterPair): string =>
  `Hint: ${SHORT[a.name] ?? ''} or ${SHORT[b.name] ?? ''}`;

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
  // Short, never cut on a row (T151); the tile's label has the whole sentence.
  justMissed: 'Just missed',
};

const FOUND = 'Target found!';

// "9 tiles away, to the north-east", "9 tiles away", "Warm", "Just missed — right next to it".
export function longAnswer(f: Feedback): string {
  if (f.kind === 'correct') return FOUND;
  if (f.kind === 'closeness') {
    return f.tier === 'justMissed'
      ? 'Just missed — right next to it'
      : (TIER_WORDS[f.tier] ?? f.tier);
  }
  const away = `${tiles(f.distance)} away`;
  return f.kind === 'direction' ? `${away}, to the ${WORDS[f.direction]}` : away;
}

// "9 away, NE ↗", "9 away" or the tier's word ("Just missed") for the list.
export function shortAnswer(f: Feedback): string {
  if (f.kind === 'direction') return `${n(f.distance)} away, ${f.direction} ${ARROWS[f.direction]}`;
  if (f.kind === 'distance') return `${n(f.distance)} away`;
  if (f.kind === 'closeness') return TIER_WORDS[f.tier] ?? f.tier;
  return FOUND;
}

// The row's tone: found in the platform's colour; every miss `far`, which the platform leaves
// plain, so the game's styles colour it by the row's tier like the tile, never a green "hot".
export const toneOf = (f: Feedback): GuessAnswer['tone'] =>
  f.kind === 'correct' ? 'correct' : 'far';

// The row's tier for the list's styles: the server's (`correct` for a found target), prefixed,
// because the game's styles apply to the platform's list and other games' tiers share names;
// `closeness` mode's own (`st-k-…`), coloured like its tile's step of its own (T151).
export function rowTier(f: Feedback): string {
  if (f.kind === 'correct') return 'st-correct';
  return f.kind === 'closeness' ? `st-k-${f.tier}` : `st-${f.tier}`;
}

export const answerOf = (f: Feedback): GuessAnswer => ({ text: shortAnswer(f), tone: toneOf(f) });
