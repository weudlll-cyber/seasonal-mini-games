/**
 * @file   packages/domain/src/round/lifecycle.test.ts
 * @module domain/round
 * @brief  Round lifecycle: roster freeze, opening on time, time-up, host end and abort.
 *
 * Responsibility: the countdown freezes each connected player once (teams only where they
 *                 play) and refuses too few players; the round opens exactly at `opensAt`
 *                 and ends at `opensAt + longest round`, however late the firing comes;
 *                 host end and abort work only while a round runs; the seed is revealed
 *                 at the end only with the fairness proof on.
 * Depends on:     vitest, ./fakes
 * Spec:           docs/spec/02-game-guess-the-number.md §4, §8.3; docs/spec/04-software-architecture.md §5.5
 */
import { describe, expect, it } from 'vitest';

import { fixedRng, PickDriver } from './fakes.js';

describe('the countdown', () => {
  it('freezes each player once, in order, with teams only in shared rounds with teams on', () => {
    const shared = new PickDriver();
    shared.start(['a', 'b', 'a'], ['winter', 'summer', 'autumn']);
    expect(shared.state.status).toBe('countdown');
    expect(Object.keys(shared.state.roster)).toEqual(['a', 'b']);
    expect(shared.state.roster.a?.team).toBe('winter');
    const individual = new PickDriver({ secretMode: 'individual' });
    individual.start(['a'], ['winter']);
    expect(individual.state.roster.a?.team).toBeNull();
  });

  it('puts players without a team into the smallest team, ties broken by the seed (03 §5)', () => {
    const teams = (seed: number) => {
      const d = new PickDriver({}, fixedRng(seed));
      d.start(['a', 'b', 'c', 'd', 'e'], ['spring', 'spring', 'summer', null, null]);
      return Object.values(d.state.roster).map((e) => e.team);
    };
    // Autumn and winter are empty: the two without a team fill them, one each.
    const [first, second] = teams(0).slice(3);
    expect(new Set([first, second])).toEqual(new Set(['autumn', 'winter']));
    expect(teams(0)).toEqual(teams(0));
  });

  it('refuses too few players and a second start', () => {
    const d = new PickDriver();
    const few = d.run({
      type: 'startCountdown',
      at: 0,
      roster: [{ playerId: 'a', team: null }],
      minPlayers: 2,
    });
    expect(few.reply).toEqual({ ok: false, code: 'NOT_ENOUGH_PLAYERS' });
    expect(few.events).toEqual([]);
    d.start(['a', 'b']);
    const again = d.run({ type: 'startCountdown', at: 1, roster: [], minPlayers: 1 });
    expect(again.reply).toMatchObject({ code: 'ROUND_STATE_INVALID' });
  });

  it('sets opensAt and endsAt from the frozen config', () => {
    const d = new PickDriver({ countdownMs: 5_000, maxDurationMs: 60_000 });
    expect(d.start(['a'])).toBe(5_000);
    expect(d.state.endsAt).toBe(65_000);
  });
});

describe('opening and time-up', () => {
  it('opens at opensAt even when the firing is late, and not before', () => {
    const d = new PickDriver();
    const opensAt = d.start(['a']);
    d.run({ type: 'open', at: opensAt - 1 });
    expect(d.state.status).toBe('countdown');
    d.run({ type: 'open', at: opensAt + 250 });
    expect(d.log.at(-1)).toEqual({ type: 'RoundOpened', at: opensAt });
  });

  it('lets a guess at opensAt in before the open firing, and refuses one a moment earlier', () => {
    const d = new PickDriver();
    const opensAt = d.start(['a']);
    expect(d.guess('a', 1, opensAt - 1)).toEqual({ ok: false, code: 'ROUND_NOT_OPEN' });
    expect(d.guess('a', 1, opensAt)).toMatchObject({ ok: true, receiveSeq: 1 });
  });

  it('ends with time up at endsAt, and refuses a guess received after it', () => {
    const d = new PickDriver({ maxDurationMs: 60_000 });
    const opensAt = d.start(['a', 'b']);
    expect(d.guess('a', 1, opensAt + 60_000)).toEqual({ ok: false, code: 'ROUND_OVER' });
    expect(d.state).toMatchObject({
      status: 'ended',
      endReason: 'timeUp',
      endedAt: opensAt + 60_000,
    });
    d.run({ type: 'timeUp', at: opensAt + 60_100 });
    expect(d.log.filter((e) => e.type === 'RoundEnded')).toHaveLength(1);
  });
});

describe('host end and abort', () => {
  it('ends a running round with placings so far and reveals the seed with the proof on', () => {
    const d = new PickDriver({ secretMode: 'individual' });
    const opensAt = d.start(['a', 'b']);
    d.guess('a', 7, opensAt);
    d.run({ type: 'end', at: opensAt + 10, reason: 'host' });
    const ended = d.log.at(-1);
    expect(ended).toMatchObject({ type: 'RoundEnded', reason: 'host', seed: '5eed' });
    expect(ended?.type === 'RoundEnded' && ended.results.map((r) => r.place)).toEqual([1, null]);
    const again = d.run({ type: 'end', at: opensAt + 20, reason: 'host' });
    expect(again.reply).toMatchObject({ code: 'ROUND_STATE_INVALID' });
  });

  it('keeps the seed back without the fairness proof', () => {
    const d = new PickDriver({ commitReveal: false });
    d.start(['a']);
    d.run({ type: 'end', at: 1, reason: 'noPlayers' });
    expect(d.log.at(-1)).toMatchObject({ type: 'RoundEnded', reason: 'noPlayers', seed: null });
  });

  it('aborts a created or running round without results, never an ended one', () => {
    const created = new PickDriver();
    created.run({ type: 'abort', at: 1, reason: 'test', by: 'host' });
    expect(created.state).toMatchObject({ status: 'aborted', abortReason: 'test' });
    expect(created.run({ type: 'end', at: 2, reason: 'host' }).reply.ok).toBe(false);
    const d = new PickDriver();
    d.start(['a']);
    d.run({ type: 'end', at: 1, reason: 'host' });
    const late = d.run({ type: 'abort', at: 2, reason: 'late', by: 'host' });
    expect(late.reply).toMatchObject({ code: 'ROUND_STATE_INVALID' });
  });
});
