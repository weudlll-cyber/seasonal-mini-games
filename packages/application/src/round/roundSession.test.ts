/**
 * @file   packages/application/src/round/roundSession.test.ts
 * @module application/round
 * @brief  Round settings, a round session from creation to result, recovery and the proof.
 *
 * Responsibility: host choices are taken only for host keys inside their bounds and the
 *                 game's own rule; a session commits to its seed, derives secrets once the
 *                 roster is frozen, shows a result only after the end and reveals the seed
 *                 there; recovery from the log continues where the live session was; the
 *                 fairness proof checks out, and a wrong seed or a round without proof fails.
 * Depends on:     vitest, @smg/game-sdk/crypto, ./fakes, ./roundSession, ./roundSettings, ./verify
 * Spec:           docs/spec/02-game-guess-the-number.md §4, §10; docs/spec/04-software-architecture.md §5.3, §5.4
 */
import type { RoundEvent } from '@smg/domain';
import { commitSeed, SEED_BYTES } from '@smg/game-sdk/crypto';
import { describe, expect, it } from 'vitest';

import { findGame } from './fakes.js';
import { RoundSession } from './roundSession.js';
import { chooseRoundSettings, gameSettingsDefs } from './roundSettings.js';
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

describe('round settings', () => {
  it('take host choices inside the bounds and refuse everything else', () => {
    expect(gameSettingsDefs(findGame).at(-1)?.key).toBe('find.max');
    const chosen = chooseRoundSettings(
      findGame,
      { 'round.cooldownS': { max: 20 } },
      { 'round.cooldownS': 15 },
    );
    expect(chosen.platform.cooldownMs).toBe(15_000);
    expect(chosen.game).toEqual({ max: 10 });
    const refused = [
      [{ 'round.cooldownS': { max: 20 } }, { 'round.cooldownS': 25 }],
      [{}, { 'points.sharedWinner': 5 }],
      [{}, { nope: 1 }],
      [{}, { 'find.max': 13 }],
    ] as const;
    for (const [overrides, choices] of refused) {
      expect(() => chooseRoundSettings(findGame, overrides, choices)).toThrow(
        expect.objectContaining({ code: 'ROUND_SETTINGS_INVALID' }),
      );
    }
  });
});

describe('a round session', () => {
  it('commits to its seed, finds a winner and reveals the seed and secrets at the end', () => {
    const { s, log, run } = session();
    expect(log[0]).toMatchObject({ type: 'RoundCreated', commitment: hex(commitSeed(seed)) });
    expect(s.result()).toBeNull();
    run({ type: 'startCountdown', at: 0, roster: [{ playerId: 'a', team: null }], minPlayers: 1 });
    const verified = verifyRound(findGame, [
      ...log,
      { type: 'RoundEnded', at: 1, reason: 'host', results: [], teams: [], seed: hex(seed) },
    ]);
    const secret = verified.ok ? verified.secrets.a : undefined;
    expect(secret).toBeDefined();
    expect(
      run({ type: 'guess', playerId: 'a', receivedAt: 3_000, action: { value: secret ?? 0 } }),
    ).toMatchObject({ ok: true });
    expect(s.state.winner).toBe('a');
    expect(log.at(-1)).toMatchObject({ type: 'RoundEnded', reason: 'solved', seed: hex(seed) });
    expect(s.result()).toEqual({ a: secret });
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
    const next = { type: 'guess', playerId: 'b', receivedAt: 3_001, action: { value: 0 } } as const;
    expect(back.handle(next)).toEqual(s.handle(next));
  });

  it('refuses a seed of the wrong size', () => {
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
