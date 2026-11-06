/**
 * @file   packages/domain/src/round/inactivity.test.ts
 * @module domain/round
 * @brief  The inactivity limit (O71): the clock, the timeout, the refusal, placings and ends.
 *
 * Responsibility: the clock starts at the open and starts again once the next guess may be
 *                 sent: after the cooldown, after a Frost-held answer, after a Bomb-style
 *                 penalty (`extraCooldownMs`), never while a guess waits for its answer; at the
 *                 limit a PlayerTimedOut stamped with the deadline, the same however late the
 *                 timer, and the same state again from the log; TIMED_OUT for a late guess;
 *                 "timed out" in the results without place or points; individual rounds end
 *                 once everyone still in has solved, shared rounds once nobody is left;
 *                 the limit off (0) times nobody out; the round's next due time names the
 *                 next timeout.
 * Depends on:     vitest, ./evolve, ./fakes, ./inactivity, ./lifecycle
 * Spec:           docs/spec/02-game-guess-the-number.md §5.3, §8; docs/spec/04-software-architecture.md §5.1
 */
import { describe, expect, it } from 'vitest';

import { replayRound } from './evolve.js';
import { config, pickGame, PickDriver } from './fakes.js';
import { inactivityDeadline } from './inactivity.js';
import { nextDue } from './lifecycle.js';

// Out after 60 s, warned after 30 s (the defaults); cooldown 10 s.
const LIMIT = { inactivityLimitMs: 60_000, inactivityWarnMs: 30_000 };

const tick = (d: PickDriver, at: number) => d.run({ type: 'tick', at });
const timeouts = (d: PickDriver) => d.log.filter((e) => e.type === 'PlayerTimedOut');
const deadline = (d: PickDriver, id: string) => {
  const entry = d.state.roster[id];
  return entry === undefined ? null : inactivityDeadline(d.state, entry);
};
const ended = (d: PickDriver) => d.log.find((e) => e.type === 'RoundEnded');

describe('the inactivity clock (O71)', () => {
  it('starts at the open and times an idle player out at the limit', () => {
    const d = new PickDriver(LIMIT);
    const t = d.start(['a', 'b']);
    tick(d, t);
    expect(deadline(d, 'a')).toEqual({ warnAt: t + 30_000, outAt: t + 60_000 });
    expect(nextDue(d.state, pickGame)).toBe(t + 60_000);
    tick(d, t + 59_999);
    expect(timeouts(d)).toEqual([]);
    tick(d, t + 60_000);
    expect(timeouts(d)).toEqual([
      { type: 'PlayerTimedOut', playerId: 'a', at: t + 60_000 },
      { type: 'PlayerTimedOut', playerId: 'b', at: t + 60_000 },
    ]);
    expect(deadline(d, 'a')).toBeNull();
  });

  it('starts again when the cooldown is over, not at the guess', () => {
    const d = new PickDriver(LIMIT);
    const t = d.start(['a', 'b']);
    d.guess('a', 1, t + 50_000);
    // Cooldown 10 s: the clock runs again from t + 60 s.
    expect(deadline(d, 'a')).toEqual({ warnAt: t + 90_000, outAt: t + 120_000 });
    tick(d, t + 119_999);
    expect(timeouts(d).map((e) => e.playerId)).toEqual(['b']);
    tick(d, t + 120_000);
    expect(timeouts(d).map((e) => e.playerId)).toEqual(['b', 'a']);
  });

  it('does not count a Frost-held answer against the player', () => {
    const frost = { ...config().specials, frostDelayMs: 8_000 };
    const d = new PickDriver(
      { ...LIMIT, cooldownMs: 3_000, specialOn: true, specials: frost },
      undefined,
      'winter',
    );
    const t = d.start(['a']);
    d.guess('a', 1, t + 1_000);
    // The answer arrives at t + 9 s, after the 3 s cooldown: the clock starts then.
    expect(deadline(d, 'a')?.outAt).toBe(t + 69_000);
  });

  it('does not count a penalty (extraCooldownMs) against the player', () => {
    const penalty: typeof pickGame = {
      ...pickGame,
      decide: (s, act, ctx) => {
        const d = pickGame.decide(s, act, ctx);
        return d.ok ? { ...d, extraCooldownMs: 5_000 } : d;
      },
    };
    const d = new PickDriver(LIMIT, undefined, undefined, penalty);
    const t = d.start(['a']);
    d.guess('a', 1, t);
    expect(deadline(d, 'a')?.outAt).toBe(t + 10_000 + 5_000 + 60_000);
  });
});

describe('the inactivity limit (O71)', () => {
  it('stops while a guess is on its way: one received just before the limit counts', () => {
    const d = new PickDriver(LIMIT);
    const t = d.start(['a']);
    expect(d.guess('a', 1, t + 59_999)).toMatchObject({ ok: true });
    tick(d, t + 60_000);
    expect(timeouts(d)).toEqual([]);
  });

  it('times nobody out with the limit off', () => {
    const d = new PickDriver({ inactivityLimitMs: 0 });
    const t = d.start(['a']);
    tick(d, t + 599_999);
    expect(timeouts(d)).toEqual([]);
    expect(deadline(d, 'a')).toBeNull();
    expect(nextDue(d.state, pickGame)).toBe(d.state.endsAt);
  });

  it('leaves a limit at or after the round end to the time-up', () => {
    const d = new PickDriver({ ...LIMIT, maxDurationMs: 60_000 });
    const t = d.start(['a']);
    tick(d, t + 60_000);
    expect(timeouts(d)).toEqual([]);
    expect(ended(d)).toMatchObject({ reason: 'timeUp' });
  });
});

describe('a timed-out player (O71)', () => {
  it('is refused with TIMED_OUT, also for a guess that arrives after the limit', () => {
    const d = new PickDriver(LIMIT);
    const t = d.start(['a', 'b']);
    d.guess('b', 1, t + 55_000);
    // No timer ran: the guess itself finds the limit passed and times the player out first.
    expect(d.guess('a', 7, t + 60_000)).toEqual({ ok: false, code: 'TIMED_OUT' });
    expect(timeouts(d)).toEqual([{ type: 'PlayerTimedOut', playerId: 'a', at: t + 60_000 }]);
    expect(d.guess('a', 7, t + 90_000)).toEqual({ ok: false, code: 'TIMED_OUT' });
  });

  it('is listed as timed out without a place and without points', () => {
    const d = new PickDriver({ ...LIMIT, secretMode: 'individual' });
    const t = d.start(['a', 'b', 'c']);
    d.guess('a', 7, t + 1_000);
    d.guess('c', 1, t + 50_000);
    tick(d, t + 60_000);
    d.guess('c', 7, t + 100_000);
    const end = ended(d);
    if (end?.type !== 'RoundEnded') throw new Error('the round ended');
    expect(end.results.map((r) => [r.playerId, r.place, r.points, r.timedOut])).toEqual([
      ['a', 1, 10, false],
      ['c', 2, 7, false],
      ['b', null, 0, true],
    ]);
  });
});

describe('the round end with timeouts (O71)', () => {
  it('individual: ends once every player still in has solved, at the timeout', () => {
    const d = new PickDriver({ ...LIMIT, secretMode: 'individual' });
    const t = d.start(['a', 'b']);
    d.guess('a', 7, t + 1_000);
    tick(d, t + 70_000);
    expect(ended(d)).toMatchObject({ reason: 'allSolved', at: t + 60_000 });
    expect(d.state.status).toBe('ended');
  });

  it('individual: ends at the last solve once the others are out', () => {
    const d = new PickDriver({ ...LIMIT, secretMode: 'individual' });
    const t = d.start(['a', 'b']);
    d.guess('a', 1, t + 55_000);
    tick(d, t + 60_000);
    expect(d.state.status).toBe('open');
    d.guess('a', 7, t + 70_000);
    expect(ended(d)).toMatchObject({ reason: 'allSolved', at: t + 70_000 });
  });

  it('individual: ends with nobody left when everyone timed out', () => {
    const d = new PickDriver({ ...LIMIT, secretMode: 'individual' });
    const t = d.start(['a', 'b']);
    tick(d, t + 60_000);
    expect(ended(d)).toMatchObject({ reason: 'noPlayers', at: t + 60_000 });
  });

  it('shared: plays on while someone is in, ends without a winner when nobody is', () => {
    const d = new PickDriver(LIMIT);
    const t = d.start(['a', 'b']);
    d.guess('b', 1, t + 30_000);
    tick(d, t + 60_000);
    expect(d.state.status).toBe('open');
    tick(d, t + 100_000);
    expect(ended(d)).toMatchObject({ reason: 'noPlayers', at: t + 100_000 });
    expect(d.state.winner).toBeNull();
  });
});

describe('the timeout in the log (O71)', () => {
  it('is the same however late the timer, and the log replays to the same state', () => {
    const run = (ticks: readonly number[]) => {
      const d = new PickDriver({ ...LIMIT, secretMode: 'individual' });
      const t = d.start(['a', 'b', 'c']);
      d.guess('a', 1, t + 20_000);
      d.guess('b', 7, t + 25_000);
      for (const at of ticks) tick(d, t + at);
      return d;
    };
    const onTime = run([60_000, 90_000]);
    const late = run([200_000]);
    expect(late.log).toEqual(onTime.log);
    const t = onTime.state.opensAt ?? 0;
    expect(timeouts(onTime).map((e) => [e.playerId, e.at])).toEqual([
      ['c', t + 60_000],
      ['a', t + 90_000],
    ]);
    expect(ended(onTime)).toMatchObject({ reason: 'allSolved', at: t + 90_000 });
    expect(replayRound(pickGame, late.log)).toEqual(late.state);
  });
});
