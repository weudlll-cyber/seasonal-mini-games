/**
 * @file   games/registry/src/phasedFixture.ts
 * @module games/registry
 * @brief  A small `phased` game for the platform's tests: three sides, the least taken wins.
 *
 * Responsibility: the fixture module 11 §4 names for P7 (09 §3), and for the server's tests
 *                 of the phased class (04 §4.8), until a real phased game is registered. Each
 *                 player picks side a, b or c and may switch; the player's own pick is live in
 *                 their own view, everything about the others (the counts, the lines) only as
 *                 it was at the view's `releasedBefore`. Its room event carries the counts right
 *                 after it, so no client counts. The least taken side wins a point. Its plan is
 *                 short and fixed (join 6 s, play until 8 s, end at 10 s, everyone sees 2 s late),
 *                 so a test round runs in seconds. Not part of the registry's list.
 * Depends on:     zod, @smg/game-sdk
 * Used by:        ./testing, ./phased.conformance.test, apps/server/test (phased rounds)
 * Spec:           docs/spec/04-software-architecture.md §4.8; docs/spec/09-testing-strategy.md §3 (P7)
 */
import type { ConformanceKit, DevBot, GameEntry, GameModule, PhasePlan } from '@smg/game-sdk';
import { z } from 'zod';

export const SIDES = ['a', 'b', 'c'] as const;
export type Side = (typeof SIDES)[number];

// The wire's guess value is the side itself (06 §4.3).
export interface SidePick {
  readonly value: Side;
}

// Every accepted pick in receive order; a player's side is their last one.
export interface SidesState {
  readonly picks: readonly {
    readonly playerId: string;
    readonly side: Side;
    readonly at: number;
  }[];
}

export type SidesEvent =
  | { readonly type: 'Picked'; readonly playerId: string; readonly side: Side; readonly at: number }
  | {
      readonly type: 'SideFed';
      readonly playerId: string;
      readonly side: Side;
      readonly at: number;
      readonly counts: Readonly<Record<Side, number>>;
    };

export const SIDES_PLAN: PhasePlan = {
  entryEndMs: 6_000,
  actionsEndMs: 8_000,
  endMs: 10_000,
  viewDelayMs: 2_000,
};

// Each player's last side among the picks received before `before`.
function sidesBefore(state: SidesState, before: number): Map<string, Side> {
  const last = new Map<string, Side>();
  for (const p of state.picks) if (p.at < before) last.set(p.playerId, p.side);
  return last;
}

function countsOf(sides: ReadonlyMap<string, Side>): Record<Side, number> {
  const counts = { a: 0, b: 0, c: 0 };
  for (const side of sides.values()) counts[side] += 1;
  return counts;
}

// What anyone may see at a cut: the counts and the lines of the picks before it.
function publicAt(state: SidesState, before: number) {
  const lines = state.picks.filter((p) => p.at < before).slice(-60);
  return { counts: countsOf(sidesBefore(state, before)), lines };
}

const pickLine = z.object({ playerId: z.string(), side: z.enum(SIDES), at: z.number() });
const shown = z.object({
  counts: z.object({ a: z.number(), b: z.number(), c: z.number() }),
  lines: z.array(pickLine),
});

export const sidesGame: GameModule<SidesState, SidePick, SidesEvent, null, null> = {
  meta: {
    id: 'sides-fixture',
    name: 'Sides (test fixture)',
    contractVersion: 1,
    timing: 'phased',
    secretModes: [],
    teams: false,
  },
  settings: { defs: [], read: () => null, problem: () => null },
  actionSchema: z.object({ value: z.enum(SIDES) }).strict(),
  deriveSecrets: () => null,
  createRound: () => ({ picks: [] }),
  validate: (s, playerId, a) =>
    sidesBefore(s, Infinity).get(playerId) === a.value ? 'SAME_CHOICE' : null,
  decide: (s, act) => {
    const { playerId, receivedAt: at } = act;
    const side = act.action.value;
    const after = sidesBefore(s, Infinity).set(playerId, side);
    return {
      ok: true,
      events: [
        { audience: `player:${playerId}`, event: { type: 'Picked', playerId, side, at } },
        {
          audience: 'room',
          event: { type: 'SideFed', playerId, side, at, counts: countsOf(after) },
        },
      ],
      signals: [],
    };
  },
  // Both events tell the same pick; the player's own one is folded, the room line is a copy.
  evolve: (s, e) =>
    e.type === 'Picked'
      ? { picks: [...s.picks, { playerId: e.playerId, side: e.side, at: e.at }] }
      : s,
  views: {
    player: (s, playerId, ctx) => ({
      own: sidesBefore(s, Infinity).get(playerId) ?? null,
      ...publicAt(s, ctx.releasedBefore),
    }),
    spectator: (s, ctx) => publicAt(s, ctx.releasedBefore),
    result: (s) => publicAt(s, Infinity),
  },
  viewSchemas: {
    player: shown.extend({ own: z.enum(SIDES).nullable() }),
    spectator: shown,
    result: shown,
  },
  phased: {
    plan: () => SIDES_PLAN,
    outcome: (s) => {
      const sides = sidesBefore(s, Infinity);
      const counts = countsOf(sides);
      const taken = SIDES.filter((x) => counts[x] > 0);
      const least = Math.min(...taken.map((x) => counts[x]));
      return [...sides].map(([playerId, side]) => {
        const won = counts[side] === least;
        const actions = s.picks.filter((p) => p.playerId === playerId).length;
        return { playerId, won, points: won ? 1 : 0, actions };
      });
    },
  },
};

export const sidesConformance: ConformanceKit<SidePick, null, null> = {
  input: (_mode, playerIds) => ({
    roundId: 'r-sides',
    roster: playerIds.map((playerId) => ({ playerId, team: null })),
    secretMode: 'shared',
    season: 'spring',
    halving: false,
    config: null,
  }),
  sentinels: () => ({ secrets: null, marks: [] }),
  action: (n) => ({ value: SIDES[Math.abs(n) % 3] ?? 'a' }),
};

// A bot picks a side at random now and then; a pick it already holds is refused at no cost.
export const sidesDevBot: DevBot<SidePick> = (_view, pick) => ({ value: SIDES[pick(3)] ?? 'a' });

export const sidesEntry: GameEntry<SidesState, SidePick, SidesEvent, null, null> = {
  module: sidesGame,
  conformance: sidesConformance,
  devBot: sidesDevBot,
};
