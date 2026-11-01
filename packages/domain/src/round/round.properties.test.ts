/**
 * @file   packages/domain/src/round/round.properties.test.ts
 * @module domain/round
 * @brief  Property tests of the platform round rules over random rounds of the pick game.
 *
 * Responsibility: for random rosters, modes, cooldowns, seeds and guess streams:
 *                 G1 accepted guesses are numbered 1, 2, 3 … in queue order; G2 a shared
 *                 round has at most one winner, the first correct accepted guess, and accepts
 *                 nothing after it; G3 a player's accepted guesses are at least the cooldown
 *                 apart and a cooldown refusal is never wrong; G4 individual places are 1..k
 *                 in solve order; P1 the same inputs give the same log; P4 a rejection leaves
 *                 the state untouched (apart from opening, time-up and the margin note); P5 replaying the log gives the live state.
 * Depends on:     vitest, fast-check, @smg/game-sdk/crypto (roundRng), ./evolve, ./fakes
 * Spec:           docs/spec/09-testing-strategy.md §3 (P1, P4, P5, G1–G4)
 */
import { roundRng } from '@smg/game-sdk/crypto';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { replayRound } from './evolve.js';
import { pickGame, PickDriver } from './fakes.js';

interface Input {
  readonly mode: 'shared' | 'individual';
  readonly players: number;
  readonly cooldownMs: number;
  readonly seed: Uint8Array;
  readonly guesses: readonly { p: number; value: number; dt: number }[];
}

const input: fc.Arbitrary<Input> = fc.record({
  mode: fc.constantFrom('shared' as const, 'individual' as const),
  players: fc.integer({ min: 1, max: 5 }),
  cooldownMs: fc.integer({ min: 3_000, max: 6_000 }),
  seed: fc.uint8Array({ minLength: 32, maxLength: 32 }),
  guesses: fc.array(
    fc.record({
      p: fc.integer({ min: 0, max: 5 }),
      value: fc.integer({ min: 0, max: 21 }),
      dt: fc.integer({ min: 0, max: 2_500 }),
    }),
    { maxLength: 60 },
  ),
});

// Runs one round to the end of its guess stream, checking P4 on every rejection.
function play(i: Input) {
  const d = new PickDriver({ secretMode: i.mode, cooldownMs: i.cooldownMs }, roundRng(i.seed));
  const ids = Array.from({ length: i.players }, (_, k) => `p${String(k)}`);
  let t = d.start(ids);
  const replies = [];
  for (const g of i.guesses) {
    t += g.dt;
    const before = { state: d.state, logged: d.log.length };
    const playerId = g.p < i.players ? (ids[g.p] ?? 'x') : 'stranger';
    const reply = d.guess(playerId, g.value, t);
    // A refused guess changes nothing, unless it opens a round that is due, ends one whose
    // time is up or notes the winning margin (platform events, never the game's).
    const caused = d.log.slice(before.logged).map((e) => e.type);
    if (!reply.ok && caused.length === 0) expect(d.state).toBe(before.state);
    if (!reply.ok)
      expect(caused.every((c) => ['RoundOpened', 'RoundEnded', 'MarginNoted'].includes(c))).toBe(
        true,
      );
    replies.push({ playerId, at: t, reply });
  }
  return { d, replies };
}

const accepted = (d: PickDriver) => d.log.filter((e) => e.type === 'GuessAccepted');

describe('round invariants', () => {
  it('G1: accepted guesses are numbered 1, 2, 3 … in order', () => {
    fc.assert(
      fc.property(input, (i) => {
        const seqs = accepted(play(i).d).map((e) => e.receiveSeq);
        expect(seqs).toEqual(seqs.map((_, k) => k + 1));
      }),
      { numRuns: 100 },
    );
  });

  it('G2: a shared round has at most one winner, the first correct guess, and nothing after', () => {
    fc.assert(
      fc.property(input, (i) => {
        const { d } = play({ ...i, mode: 'shared' });
        const solves = d.log.filter((e) => e.type === 'PlayerSolved');
        expect(solves.length).toBeLessThanOrEqual(1);
        const secret = d.secrets?.p0;
        const firstHit = accepted(d).find((e) => e.action.value === secret);
        expect(solves[0]?.receiveSeq).toBe(firstHit?.receiveSeq);
        if (firstHit !== undefined) expect(accepted(d).at(-1)).toEqual(firstHit);
      }),
      { numRuns: 100 },
    );
  });
});

describe('round invariants over time and replay', () => {
  it('G3: accepted guesses of a player are at least the cooldown apart; refusals are right', () => {
    fc.assert(
      fc.property(input, (i) => {
        const { d, replies } = play(i);
        const last = new Map<string, number>();
        for (const r of replies) {
          const prev = last.get(r.playerId);
          if (r.reply.ok) {
            if (prev !== undefined) expect(r.at - prev).toBeGreaterThanOrEqual(i.cooldownMs);
            last.set(r.playerId, r.at);
          } else if (r.reply.code === 'COOLDOWN_ACTIVE') {
            expect(prev).toBeDefined();
            expect(r.at).toBeLessThan((prev ?? 0) + i.cooldownMs);
            expect(r.reply.until).toBe((prev ?? 0) + i.cooldownMs);
          }
        }
        expect(accepted(d).every((e) => e.cooldownEndsAt === e.receivedAt + i.cooldownMs)).toBe(
          true,
        );
      }),
      { numRuns: 100 },
    );
  });

  it('G4: individual places are 1..k without gaps, in solve order', () => {
    fc.assert(
      fc.property(input, (i) => {
        const { d } = play({ ...i, mode: 'individual' });
        const solves = d.log.filter((e) => e.type === 'PlayerSolved');
        expect(solves.map((e) => e.place)).toEqual(solves.map((_, k) => k + 1));
        const seqs = solves.map((e) => e.receiveSeq);
        expect([...seqs].sort((a, b) => a - b)).toEqual(seqs);
        expect(new Set(solves.map((e) => e.playerId)).size).toBe(solves.length);
      }),
      { numRuns: 100 },
    );
  });

  it('P1 and P5: the same inputs give the same log, and replaying it gives the live state', () => {
    fc.assert(
      fc.property(input, (i) => {
        const a = play(i).d;
        expect(play(i).d.log).toEqual(a.log);
        expect(replayRound(pickGame, a.log)).toEqual(a.state);
      }),
      { numRuns: 100 },
    );
  });
});
