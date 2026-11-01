/**
 * @file   games/seasonal-target/web/words.ts
 * @module games/seasonal-target/web
 * @brief  How Seasonal Target words a cell, an area, a quarter and an answer.
 *
 * Responsibility: "(12, 34)" and "column 12, row 34", "columns 13–37, rows 1–50", the quarter
 *                 hint, and an answer long ("9 cells away, to the north-east", "9 cells away")
 *                 and short ("9 away, NE ↗", "9 away"), the tier words of `closeness` mode, and the tone the
 *                 platform colours a row by. Every number through `formatNumber` (T114).
 * Depends on:     @smg/game-sdk (formatNumber, GuessAnswer), @smg-game/seasonal-target (types)
 * Used by:        ./text, ./MapBoard, ./TargetInput, ./PlayerPanel, ./SpectatorPanel, ./ResultPanel
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

export const sizeText = (width: number, height: number): string =>
  `${n(width)} × ${n(height)} cells`;

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

// "9 cells away, to the north-east", "9 cells away", "Warm".
export function longAnswer(f: Feedback): string {
  if (f.kind === 'correct') return FOUND;
  if (f.kind === 'closeness') return TIER_WORDS[f.tier] ?? f.tier;
  const away = `${n(f.distance)} ${f.distance === 1 ? 'cell' : 'cells'} away`;
  return f.kind === 'direction' ? `${away}, to the ${WORDS[f.direction]}` : away;
}

// "9 away, NE ↗" or "9 away" for the list.
export function shortAnswer(f: Feedback): string {
  if (f.kind === 'direction') return `${n(f.distance)} away, ${f.direction} ${ARROWS[f.direction]}`;
  if (f.kind === 'distance') return `${n(f.distance)} away`;
  return longAnswer(f);
}

const NEAR = new Set(['justMissed', 'burning', 'hot']);

// The row's colour: found, near (hot, burning, touching, or within 3 cells), or far.
export function toneOf(f: Feedback): GuessAnswer['tone'] {
  if (f.kind === 'correct') return 'correct';
  const near = f.kind === 'closeness' ? NEAR.has(f.tier) : f.distance <= 3;
  return near ? 'close' : 'far';
}

export const answerOf = (f: Feedback): GuessAnswer => ({ text: shortAnswer(f), tone: toneOf(f) });
