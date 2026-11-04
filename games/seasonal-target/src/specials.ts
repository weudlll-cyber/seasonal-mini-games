/**
 * @file   games/seasonal-target/src/specials.ts
 * @module games/seasonal-target
 * @brief  What Spring Herald, Leaf Fall and halving do in Seasonal Target.
 *
 * Responsibility: Spring Herald names two map quarters, the target's and a decoy drawn
 *                 uniformly from the other three, in the fixed quarter order (O61): for the
 *                 shared target to the room, or for each player's own target to that player
 *                 with a room line that everyone got one (02d §8.1). Leaf Fall removes cells where the target can still be
 *                 (./leafFall, O37). Halving replaces each target area by one of about half the
 *                 area — the longer side halved, rounded up, the width on a tie — placed
 *                 uniformly among the positions inside the current area that hold the secret,
 *                 while the area is larger than `minCells` (02d §8.4, 03 §4). Every choice comes
 *                 from the round randomness under `spring/<shared|playerId>`,
 *                 `leafFall/<k>` and `halving/<k>/<shared|playerId>` (04 §5.4).
 * Depends on:     @smg/game-sdk (hooks, Drbg), @smg/guess-engine (secretOf), ./geometry,
 *                 ./leafFall, ./secrets, ./state
 * Used by:        ./module
 * Spec:           docs/spec/02d-game-seasonal-target.md §8; docs/spec/03-seasonal-specials.md §2.1, §2.3, §4
 */
import type { Drbg, Emitted, SpecialHooks } from '@smg/game-sdk';
import { secretOf } from '@smg/guess-engine';

import {
  areaCells,
  areaHeight,
  areaWidth,
  type Area,
  type Cell,
  type MapSize,
} from './geometry.js';
import { fallingCells } from './leafFall.js';
import type { Secrets } from './secrets.js';
import {
  QUARTER_NAMES,
  type Quarter,
  type QuarterName,
  type QuarterPair,
  type StEvent,
  type StState,
} from './state.js';

// The quarter of the map that holds `c`: the west half is columns 1 … ⌈W/2⌉, the north half
// rows 1 … ⌈H/2⌉ (02d §8.1).
export function quarterOf(map: MapSize, c: Cell): Quarter {
  const midX = Math.ceil(map.width / 2);
  const midY = Math.ceil(map.height / 2);
  const west = c.x <= midX;
  const north = c.y <= midY;
  return {
    name: `${north ? 'north' : 'south'}-${west ? 'west' : 'east'}`,
    left: west ? 1 : midX + 1,
    right: west ? midX : map.width,
    top: north ? 1 : midY + 1,
    bottom: north ? midY : map.height,
  };
}

// A quarter by name: the one that holds its outer corner tile.
const namedQuarter = (map: MapSize, name: QuarterName): Quarter =>
  quarterOf(map, {
    x: name.endsWith('west') ? 1 : map.width,
    y: name.startsWith('north') ? 1 : map.height,
  });

// The target's quarter and a decoy drawn uniformly from the other three, in the fixed order
// of `QUARTER_NAMES` (O61): the order never tells which one is the target's.
export function quarterPair(map: MapSize, target: Cell, rng: Drbg): QuarterPair {
  const own = quarterOf(map, target);
  const others = QUARTER_NAMES.filter((n) => n !== own.name);
  const decoy = namedQuarter(map, others[rng.intBetween(0, others.length - 1)] ?? own.name);
  return QUARTER_NAMES.indexOf(own.name) < QUARTER_NAMES.indexOf(decoy.name)
    ? [own, decoy]
    : [decoy, own];
}

// The size after one halving: the longer side halved, rounded up; the width on a tie.
export function halvedSize(width: number, height: number): { width: number; height: number } {
  return width >= height
    ? { width: Math.ceil(width / 2), height }
    : { width, height: Math.ceil(height / 2) };
}

// One start of `size` cells inside [low, high] on one axis that keeps `at` inside, uniformly.
const start = (side: readonly [number, number], at: number, size: number, rng: Drbg): number =>
  rng.intBetween(Math.max(side[0], at - size + 1), Math.min(at, side[1] - size + 1));

// A window of the halved size inside `area`, holding `secret`, placed uniformly.
export function windowIn(area: Area, secret: Cell, rng: Drbg): Area {
  const size = halvedSize(areaWidth(area), areaHeight(area));
  const left = start([area.left, area.right], secret.x, size.width, rng);
  const top = start([area.top, area.bottom], secret.y, size.height, rng);
  return { left, right: left + size.width - 1, top, bottom: top + size.height - 1 };
}

function springHerald(
  state: StState,
  secrets: Secrets,
  rng: (who: string) => Drbg,
): Emitted<StEvent>[] {
  if (state.mode === 'shared') {
    const quarters = quarterPair(state.map, secretOf(secrets, ''), rng('shared'));
    return [{ audience: 'room', event: { type: 'HintGiven', playerId: null, quarters } }];
  }
  const own = Object.keys(state.players).map((id): Emitted<StEvent> => ({
    audience: `player:${id}`,
    event: {
      type: 'HintGiven',
      playerId: id,
      quarters: quarterPair(state.map, secretOf(secrets, id), rng(id)),
    },
  }));
  // Spectators and the room learn only that everyone got one (03 §2.1).
  return [
    ...own,
    { audience: 'room', event: { type: 'HintGiven', playerId: null, quarters: null } },
  ];
}

function halving(state: StState, secrets: Secrets, rng: (who: string) => Drbg, index: number) {
  if (state.mode === 'shared') {
    if (areaCells(state.area) <= state.specials.minCells) return [];
    const area = windowIn(state.area, secretOf(secrets, ''), rng('shared'));
    const size = { width: areaWidth(area), height: areaHeight(area) };
    const event = { type: 'AreaHalved', index, playerId: null, area, ...size } as const;
    return [{ audience: 'room', event } as const];
  }
  // Every individual area has the same size at every moment, so one check decides for all.
  const { width, height } = state.areaSize;
  if (width * height <= state.specials.minCells) return [];
  const size = halvedSize(width, height);
  const own = Object.entries(state.players).map(([id, p]): Emitted<StEvent> => ({
    audience: `player:${id}`,
    event: {
      type: 'AreaHalved',
      index,
      playerId: id,
      area: windowIn(p.area, secretOf(secrets, id), rng(id)),
      ...size,
    },
  }));
  // The room learns only the size (02d §8.4).
  const line = { type: 'AreaHalved', index, playerId: null, area: null, ...size } as const;
  return [...own, { audience: 'room', event: line } as const];
}

export const stSpecials: SpecialHooks<StState, StEvent, Secrets> = {
  springHerald: (state, ctx) =>
    springHerald(state, ctx.secrets, (who) => ctx.rng.child('spring', who)),
  leafFall: (state, ctx, fall) => {
    const cells = fallingCells(
      state,
      ctx.secrets,
      fall,
      ctx.rng.child('leafFall', String(fall.index)),
    );
    if (cells.length === 0) return [];
    return [{ audience: 'room', event: { type: 'CellsFell', index: fall.index, cells } }];
  },
  halving: (state, ctx, index) =>
    halving(state, ctx.secrets, (who) => ctx.rng.child('halving', String(index), who), index),
};
