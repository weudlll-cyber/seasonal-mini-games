/**
 * @file   packages/application/src/round/roundSession.test.ts
 * @module application/round
 * @brief  A round session from creation to result, recovery and the proof.
 *
 * Responsibility: a session commits to its seed, derives secrets once the
 *                 roster is frozen, shows a result only after the end and reveals the seed
 *                 there, and its results as RoundEnded gave them (T340); recovery from the log
 *                 continues where the live session was; the
 *                 fairness proof checks out, and a wrong seed or a round without proof fails.
 * Depends on:     vitest, @smg/game-sdk/crypto, ./fakes, ./roundSession, ./roundSettings, ./verify
 * Spec:           docs/spec/02-game-guess-the-number.md §4, §10; docs/spec/04-software-architecture.md §5.3, §5.4
 */
import type { RoundEvent } from '@smg/domain';
import { commitSeed, SEED_BYTES } from '@smg/game-sdk/crypto';
import { describe, expect, it } from 'vitest';

import { findGame, pickGame } from './fakes.js';
import { RoundSession } from './roundSession.js';
import { chooseRoundSettings } from './roundSettings.js';
import { verifyRound } from './verify.js';

const seed = new Uint8Array(SEED_BYTES).fill(3);
const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');
type Log = RoundEvent<{ hit: boolean }, { value: number }, { max: number }>[];

function session(choices: Record<string, unknown> = {}) {
  const settings = chooseRoundSettings(findGame, {}, { 'round.countdownS': 3, ...choices });
  const { session: s, event } = RoundSession.create(findGame, {
    roundId: 'r1',
    settings,
    season: 'autumn',
    seed,
  });
  const log: Log = [event];
  const run = (cmd: Parameters<typeof s.handle>[0]) => {
    const r = s.handle(cmd);
    log.push(...r.events);
    return r.reply;
  };
  return { s, log, run };
}

describe('a round session', () => {
  it('commits to its seed, finds a winner and reveals the seed and secrets at the end', () => {
    const { s, log, run } = session();
    expect(log[0]).toMatchObject({ type: 'RoundCreated', commitment: hex(commitSeed(seed)) });
    expect(s.result()).toBeNull();
    expect(s.revealedSeed()).toBeNull();
    expect(s.nextDue()).toBeNull();
    run({ type: 'startCountdown', at: 0, roster: [{ playerId: 'a', team: null }], minPlayers: 1 });
    expect(s.nextDue()).toBe(3_000);
    const verified = verifyRound(findGame, [
      ...log,
      {
        type: 'RoundEnded',
        at: 1,
        reason: 'host',
        results: [],
        teams: [],
        seed: hex(seed),
        deliverAt: null,
      },
    ]);
    const secret = verified.ok ? verified.secrets.a : undefined;
    expect(secret).toBeDefined();
    expect(
      run({ type: 'guess', playerId: 'a', receivedAt: 3_000, action: { value: secret ?? 0 } }),
    ).toMatchObject({ ok: true });
    expect(s.state.winner).toBe('a');
    expect(log.at(-1)).toMatchObject({ type: 'RoundEnded', reason: 'solved', seed: hex(seed) });
    expect(s.result()).toEqual({ a: secret });
    expect(s.revealedSeed()).toBe(hex(seed));
    expect(verifyRound(findGame, log)).toEqual({ ok: true, secrets: { a: secret } });
  });

  it('recovers from its log and continues the same way', () => {
    const { s, log, run } = session({ 'find.max': 100 });
    run({
      type: 'startCountdown',
      at: 0,
      roster: [
        { playerId: 'a', team: null },
        { playerId: 'b', team: null },
      ],
      minPlayers: 1,
    });
    run({ type: 'guess', playerId: 'a', receivedAt: 3_000, action: { value: 0 } });
    const back = RoundSession.recover(findGame, seed, log);
    expect(back.state).toEqual(s.state);
    const resumed = RoundSession.resume(findGame, seed, back.state, []);
    expect(resumed.state).toEqual(s.state);
    const next = { type: 'guess', playerId: 'b', receivedAt: 3_001, action: { value: 0 } } as const;
    expect(back.handle(next)).toEqual(s.handle(next));
  });
});

describe('a round session refuses', () => {
  it('a seed of the wrong size', () => {
    const settings = chooseRoundSettings(findGame, {}, {});
    expect(() =>
      RoundSession.create(findGame, {
        roundId: 'r',
        settings,
        season: 'winter',
        seed: new Uint8Array(8),
      }),
    ).toThrow(/32 bytes/);
  });
});

describe('the fairness proof', () => {
  it('fails for a wrong seed, a round without proof and a running round', () => {
    const { log, run } = session();
    run({ type: 'startCountdown', at: 0, roster: [{ playerId: 'a', team: null }], minPlayers: 1 });
    expect(verifyRound(findGame, log)).toEqual({ ok: false, problem: 'the round has not ended' });
    run({ type: 'end', at: 4_000, reason: 'host' });
    const forged = log.map((e) => (e.type === 'RoundEnded' ? { ...e, seed: '00'.repeat(32) } : e));
    expect(verifyRound(findGame, forged)).toMatchObject({ ok: false, problem: /does not match/ });
    const off = session({});
    const noProof = off.log.map((e) =>
      e.type === 'RoundCreated' ? { ...e, commitment: null } : e,
    );
    off.run({
      type: 'startCountdown',
      at: 0,
      roster: [{ playerId: 'a', team: null }],
      minPlayers: 1,
    });
    off.run({ type: 'end', at: 1, reason: 'host' });
    expect(verifyRound(findGame, [...noProof, ...off.log.slice(1)])).toMatchObject({
      problem: /no fairness proof/,
    });
  });
});

describe('the result view (DECISIONS T324)', () => {
  it("builds a phased game's result without a secret, and only once it has ended", () => {
    const settings = chooseRoundSettings(pickGame, {}, { 'round.countdownS': 3 });
    const { session: s } = RoundSession.create(pickGame, {
      roundId: 'r2',
      settings,
      season: 'winter',
      seed,
    });
    s.handle({
      type: 'startCountdown',
      at: 0,
      roster: [{ playerId: 'a', team: null }],
      minPlayers: 1,
    });
    s.handle({ type: 'open', at: 3_000 });
    s.handle({ type: 'guess', playerId: 'a', receivedAt: 3_100, action: { value: 'x' } });
    expect(s.result()).toBeNull();
    s.handle({ type: 'end', at: 4_000, reason: 'host' });
    expect(s.state.status).toBe('ended');
    expect(s.result()).toEqual({ picks: { a: 'x' } });
  });

  it("keeps a guess game's rule: no result view while it runs or before its secrets exist", () => {
    const { s, run } = session();
    expect(s.result()).toBeNull();
    run({ type: 'startCountdown', at: 0, roster: [{ playerId: 'a', team: null }], minPlayers: 1 });
    run({ type: 'end', at: 1_000, reason: 'host' });
    expect(s.result()).not.toBeNull();
  });
});

describe('the results of an ended round (DECISIONS T340)', () => {
  const endedOf = (events: readonly { type: string }[]) =>
    events.find((e) => e.type === 'RoundEnded') as { results: unknown; teams: unknown } | undefined;

  it("are a guess round's RoundEnded results, and none before the end", () => {
    const { s, log, run } = session();
    run({ type: 'startCountdown', at: 0, roster: [{ playerId: 'a', team: null }], minPlayers: 1 });
    expect(s.results()).toBeNull();
    run({ type: 'end', at: 4_000, reason: 'host' });
    const ended = endedOf(log);
    expect(s.results()).toEqual({ results: ended?.results, teams: ended?.teams });
  });

  it("are a phased round's results from the game's rule, with its points", () => {
    const settings = chooseRoundSettings(pickGame, {}, { 'round.countdownS': 3 });
    const { session: s } = RoundSession.create(pickGame, {
      roundId: 'r3',
      settings,
      season: 'winter',
      seed,
    });
    s.handle({
      type: 'startCountdown',
      at: 0,
      roster: [{ playerId: 'a', team: null }],
      minPlayers: 1,
    });
    s.handle({ type: 'open', at: 3_000 });
    s.handle({ type: 'guess', playerId: 'a', receivedAt: 3_100, action: { value: 'x' } });
    expect(s.results()).toBeNull();
    const ended = endedOf(s.handle({ type: 'end', at: 4_000, reason: 'host' }).events);
    // The roster places nobody: rebuilt from it, the points were 0 (the defect T340 fixes).
    expect(s.results()).toEqual({ results: ended?.results, teams: [] });
    expect(s.results()?.results.map((r) => [r.playerId, r.points, r.won])).toEqual([
      ['a', 1, true],
    ]);
  });
});
