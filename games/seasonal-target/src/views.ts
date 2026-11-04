/**
 * @file   games/seasonal-target/src/views.ts
 * @module games/seasonal-target
 * @brief  What a player, a spectator and the result page see of a round, with their schemas.
 *
 * Responsibility: the player view (the grid, the answer mode, the player's own target area
 *                 and quarter, the fallen cells inside that area, the own guesses and the
 *                 others' newest ones), the spectator view (the shared area and quarter only;
 *                 in individual mode just the size every area has) and the result (the target
 *                 or every player's, every guess, the fallen cells and the closest miss). The
 *                 guesses at the round's visibility and with Frost's cut are the guess engine's
 *                 (02d §6, 04 §4.7). No view of a running round holds a secret, another
 *                 player's quarter or area, or anything narrowed from the answers (O17, 05 §3).
 *                 `reveal` words the target for the chat's round-end line (O32).
 * Depends on:     zod, @smg/game-sdk (GameViews), @smg/guess-engine (views, closest miss),
 *                 ./geometry, ./secrets, ./state
 * Used by:        ./module, ./index
 * Spec:           docs/spec/02d-game-seasonal-target.md §6, §9, §10; docs/spec/05-security-threat-model.md §3.1
 */
import type { GameViews } from '@smg/game-sdk';
import {
  closestMissBy,
  guessSchemas,
  othersGuesses,
  ownGuesses,
  resultGuesses,
  TIERS,
} from '@smg/guess-engine';
import { z } from 'zod';

import {
  COMPASS,
  FEEDBACK_MODES,
  inArea,
  roundedDistance,
  squared,
  type Area,
  type Cell,
} from './geometry.js';
import { cellOf, type Secrets } from './secrets.js';
import type { StState } from './state.js';

const coord = z.number().int().min(1);
const cell = z.object({ x: coord, y: coord }).strict();
const area = z.object({ left: coord, right: coord, top: coord, bottom: coord }).strict();
const size = z.object({ width: coord, height: coord }).strict();
const quarter = area
  .extend({ name: z.enum(['north-west', 'north-east', 'south-west', 'south-east']) })
  .strict();
// Spring's two quarters, in the fixed order (O61).
const quarters = z.tuple([quarter, quarter]);
// Every wrong answer carries its tier: the colour of the guessed tile (O45).
const tier = z.enum(TIERS).exclude(['correct']);
const feedback = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('correct') }).strict(),
  z
    .object({ kind: z.literal('direction'), distance: coord, direction: z.enum(COMPASS), tier })
    .strict(),
  z.object({ kind: z.literal('distance'), distance: coord, tier }).strict(),
  z.object({ kind: z.literal('closeness'), tier }).strict(),
]);
const guesses = guessSchemas(cell, feedback);
const mode = z.enum(FEEDBACK_MODES);

export const viewSchemas = {
  player: z
    .object({
      map: size,
      feedbackMode: mode,
      repeatRejected: z.boolean(),
      // The player's own target area: the whole grid until a halving.
      area,
      hint: quarters.nullable(),
      fallen: z.array(cell),
      guesses: z.array(guesses.own),
      // The other players' guesses, oldest first.
      log: z.array(guesses.other),
    })
    .strict(),
  spectator: z
    .object({
      map: size,
      feedbackMode: mode,
      // Shared mode only; individual mode names just the size of every area.
      area: area.nullable(),
      areaSize: size,
      hint: quarters.nullable(),
      fallen: z.array(cell),
      log: z.array(guesses.other),
    })
    .strict(),
  result: z
    .object({
      map: size,
      target: cell.nullable(),
      targets: z.record(z.string(), cell).nullable(),
      guesses: guesses.result,
      fallen: z.array(cell),
      // Shared mode with a winner: the best wrong guess of anyone else (O22).
      closestMiss: z
        .object({ playerId: z.string(), value: cell, distance: coord, touching: z.boolean() })
        .strict()
        .nullable(),
    })
    .strict(),
};

export type PlayerView = z.infer<typeof viewSchemas.player>;
export type SpectatorView = z.infer<typeof viewSchemas.spectator>;
export type ResultView = z.infer<typeof viewSchemas.result>;

// Fallen cells outside an area drop out of view (02d §8.4).
const within = (fallen: readonly Cell[], a: Area): Cell[] => fallen.filter((c) => inArea(a, c));

// The best wrong guess of anyone but the winner by squared distance, the earlier on a tie.
export function closestMiss(state: StState, target: Cell): ResultView['closestMiss'] {
  const miss = closestMissBy(
    state,
    (f) => f.kind === 'correct',
    (g) => squared(g.value, target),
  );
  if (miss === null) return null;
  const touching =
    Math.max(Math.abs(miss.value.x - target.x), Math.abs(miss.value.y - target.y)) === 1;
  return {
    playerId: miss.playerId,
    value: miss.value,
    distance: roundedDistance(miss.distance),
    touching,
  };
}

export const views: GameViews<StState, Secrets> = {
  player: (state, playerId, ctx) => {
    const own = state.players[playerId];
    const playerArea = own?.area ?? state.area;
    return {
      map: state.map,
      feedbackMode: state.feedbackMode,
      repeatRejected: state.repeatRejected,
      area: playerArea,
      hint: state.mode === 'shared' ? state.hint : (own?.hint ?? null),
      fallen: within(state.fallen, playerArea),
      guesses: ownGuesses(state, playerId, ctx),
      log: othersGuesses(state, ctx, playerId),
    };
  },
  spectator: (state, ctx) => {
    const shared = state.mode === 'shared';
    return {
      map: state.map,
      feedbackMode: state.feedbackMode,
      // An individual area or quarters are about a player's own target: never a spectator's.
      area: shared ? state.area : null,
      areaSize: state.areaSize,
      hint: shared ? state.hint : null,
      fallen: shared ? within(state.fallen, state.area) : state.fallen,
      log: othersGuesses(state, ctx, null),
    };
  },
  result: (state, secrets) => ({
    map: state.map,
    target: secrets.mode === 'shared' ? cellOf(secrets.value) : null,
    targets:
      secrets.mode === 'individual'
        ? Object.fromEntries(Object.entries(secrets.byPlayer).map(([id, t]) => [id, cellOf(t)]))
        : null,
    guesses: resultGuesses(state),
    fallen: state.fallen,
    closestMiss: secrets.mode === 'shared' ? closestMiss(state, secrets.value) : null,
  }),
};

const short = (c: Cell): string => `(${String(c.x)}, ${String(c.y)})`;

// The chat's round-end clause (O32): the shared target, or in individual mode the winner's own.
export function reveal(result: unknown, winner: string | null): string | null {
  const r = result as Pick<ResultView, 'target' | 'targets'>;
  if (r.target !== null) return `the target was ${short(r.target)}`;
  const own = winner === null ? undefined : r.targets?.[winner];
  return own === undefined ? null : `their target was ${short(own)}`;
}
