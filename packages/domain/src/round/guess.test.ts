/**
 * @file   packages/domain/src/round/guess.test.ts
 * @module domain/round
 * @brief  The guess path: check order, cooldown from receive time, winning, placings, margin.
 *
 * Responsibility: rejection codes come in the order of 02 §5.1 (a game check beats the
 *                 cooldown); a guess at exactly `cooldownEndsAt` passes; rejections cost
 *                 nothing; the shared winner ends the round and later guesses are ROUND_OVER;
 *                 a correct guess inside the margin window sets the margin; individual
 *                 solvers are placed in solve order and cannot guess again; the game can
 *                 end the round and can refuse late.
 * Depends on:     vitest, ./fakes
 * Spec:           docs/spec/02-game-guess-the-number.md §5, §7, §8, §9
 */
import { describe, expect, it } from 'vitest';

import { PickDriver } from './fakes.js';

function lastResults(d: PickDriver) {
  const ended = d.log.at(-1);
  if (ended?.type !== 'RoundEnded') throw new Error('the round has not ended');
  return ended;
}

describe('acceptance checks', () => {
  it('answers in the order of 02 §5.1', () => {
    const d = new PickDriver({ secretMode: 'individual', cooldownMs: 3_000 });
    const t = d.start(['a', 'b']);
    expect(d.guess('x', 1, t)).toEqual({ ok: false, code: 'NOT_IN_ROUND' });
    expect(d.guess('a', 1, t)).toEqual({ ok: true, receiveSeq: 1, cooldownEndsAt: t + 3_000 });
    // Out of range during the cooldown: the game's check comes first.
    expect(d.guess('a', 99, t + 1)).toEqual({ ok: false, code: 'OUT_OF_RANGE' });
    expect(d.guess('a', 2, t + 2_999)).toEqual({
      ok: false,
      code: 'COOLDOWN_ACTIVE',
      until: t + 3_000,
    });
    expect(d.guess('a', 7, t + 3_000)).toMatchObject({ ok: true, receiveSeq: 2 });
    expect(d.guess('a', 3, t + 9_000)).toEqual({ ok: false, code: 'ALREADY_SOLVED' });
  });

  it('leaves state and log alone on a rejection, and gives no receive number', () => {
    const d = new PickDriver();
    const t = d.start(['a', 'b']);
    d.guess('a', 1, t);
    const before = { state: d.state, length: d.log.length };
    expect(d.guess('a', 2, t + 1).ok).toBe(false);
    expect(d.guess('b', 13, t + 2)).toEqual({ ok: false, code: 'UNLUCKY' });
    expect(d.state).toBe(before.state);
    expect(d.log).toHaveLength(before.length);
    expect(d.guess('b', 2, t + 3)).toMatchObject({ receiveSeq: 2 });
  });

  it('lets the first guess through without a cooldown before it', () => {
    const d = new PickDriver({ cooldownMs: 60_000 });
    const t = d.start(['a', 'b']);
    expect(d.guess('a', 1, t).ok).toBe(true);
    expect(d.guess('b', 1, t).ok).toBe(true);
  });
});

describe('shared rounds', () => {
  it('end at the first correct guess; the winner is 1st and the rest took part', () => {
    const d = new PickDriver();
    const t = d.start(['a', 'b', 'c']);
    d.guess('b', 1, t);
    expect(d.guess('a', 7, t + 100)).toMatchObject({ ok: true, receiveSeq: 2 });
    expect(d.state).toMatchObject({
      status: 'ended',
      endReason: 'solved',
      winner: 'a',
      winnerAt: t + 100,
    });
    expect(lastResults(d).results.map((r) => [r.playerId, r.place, r.points])).toEqual([
      ['a', 1, 10],
      ['b', null, 0],
      ['c', null, 0],
    ]);
    expect(d.guess('c', 1, t + 200)).toEqual({ ok: false, code: 'ROUND_OVER' });
  });

  it('note the first would-be correct guess inside the margin window', () => {
    const d = new PickDriver({ marginWindowMs: 2_000 });
    const t = d.start(['a', 'b', 'c']);
    d.guess('a', 7, t);
    d.guess('a', 7, t + 100);
    d.guess('b', 3, t + 200);
    expect(d.state.margin).toBeNull();
    expect(d.guess('c', 7, t + 400)).toEqual({ ok: false, code: 'ROUND_OVER' });
    expect(d.state.margin).toEqual({ playerId: 'c', ms: 400 });
    d.guess('b', 7, t + 500);
    expect(d.state.margin).toEqual({ playerId: 'c', ms: 400 });
  });

  it('ignore correct guesses after the window and from outside the roster', () => {
    const d = new PickDriver({ marginWindowMs: 500 });
    const t = d.start(['a', 'b']);
    d.guess('a', 7, t);
    d.guess('x', 7, t + 100);
    d.guess('b', 7, t + 501);
    expect(d.state.margin).toBeNull();
  });

  it('give the winner team its point', () => {
    const d = new PickDriver();
    const t = d.start(['a', 'b', 'c'], ['spring', 'summer', 'spring']);
    d.guess('b', 7, t);
    expect(lastResults(d).teams).toEqual([
      { team: 'spring', members: 2, points: 0, won: false },
      { team: 'summer', members: 1, points: 1, won: true },
    ]);
  });
});

describe('individual rounds', () => {
  it('place solvers in solve order and end when everyone solved', () => {
    const d = new PickDriver({ secretMode: 'individual', cooldownMs: 3_000 });
    const t = d.start(['a', 'b', 'c']);
    d.guess('b', 7, t);
    d.guess('c', 1, t + 1);
    d.guess('a', 7, t + 2);
    expect(d.state.status).toBe('open');
    d.guess('c', 7, t + 3_001);
    expect(d.state).toMatchObject({ status: 'ended', endReason: 'allSolved' });
    const ended = lastResults(d);
    expect(ended.results.map((r) => [r.playerId, r.place, r.points])).toEqual([
      ['b', 1, 10],
      ['a', 2, 7],
      ['c', 3, 5],
    ]);
    expect(ended.teams).toEqual([]);
  });
});

describe('game signals', () => {
  it('end the round when the game asks', () => {
    const d = new PickDriver();
    const t = d.start(['a']);
    expect(d.guess('a', 20, t)).toMatchObject({ ok: true });
    expect(d.state).toMatchObject({ status: 'ended', endReason: 'game' });
  });
});
