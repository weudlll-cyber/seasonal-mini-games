/**
 * @file   packages/domain/src/round/phased.test.ts
 * @module domain/round
 * @brief  The platform rules of a `phased` round, with a small phased game of its own.
 *
 * Responsibility: 04 §4.8 rules 1–4 and 6 on the pure round rules: the plan's end as the
 *                 round's end, the check order and the windows to the millisecond, no
 *                 cooldown and a reply without a receive number, PlayerEntered once, match
 *                 players joining and leaving while it runs, the results from the game's own
 *                 rule (nobody placed, winners with `won`), "no players left" for an empty
 *                 round, and replaying the log giving the live state.
 * Depends on:     vitest, zod, @smg/game-sdk, ./*
 * Spec:           docs/spec/04-software-architecture.md §4.8; docs/spec/09-testing-strategy.md §4.2
 */
import type { GameModule, PhasePlan } from '@smg/game-sdk';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { replayRound } from './evolve.js';
import { config, fixedRng } from './fakes.js';
import { createRound } from './lifecycle.js';
import { stepRound } from './step.js';
import type { RoundCommand, RoundEvent, RoundState } from './types.js';

// A vote: each player's last value counts; a 1 wins a point.
type Votes = Readonly<Record<string, number>>;
interface Vote {
  readonly value: number;
}
interface Voted {
  readonly playerId: string;
  readonly value: number;
}

const PLAN: PhasePlan = {
  entryEndMs: 10_000,
  actionsEndMs: 20_000,
  endMs: 30_000,
  viewDelayMs: 5_000,
};

const voteGame: GameModule<Votes, Vote, Voted, null, null> = {
  meta: {
    id: 'vote',
    name: 'Vote',
    contractVersion: 1,
    timing: 'phased',
    secretModes: [],
    teams: false,
  },
  settings: { defs: [], read: () => null, problem: () => null },
  actionSchema: z.object({ value: z.number() }),
  deriveSecrets: () => null,
  createRound: () => ({}),
  validate: (s, p, a) => (s[p] === a.value ? 'SAME_CHOICE' : null),
  decide: (_s, act) => ({
    ok: true,
    events: [{ audience: 'room', event: { playerId: act.playerId, value: act.action.value } }],
    signals: [],
  }),
  evolve: (s, e) => ({ ...s, [e.playerId]: e.value }),
  views: { player: (s) => s, spectator: (s) => s, result: (s) => s },
  viewSchemas: { player: z.unknown(), spectator: z.unknown(), result: z.unknown() },
  phased: {
    plan: () => PLAN,
    outcome: (s) =>
      Object.entries(s).map(([playerId, v]) => ({
        playerId,
        won: v === 1,
        points: v === 1 ? 1 : 0,
        actions: 1,
      })),
  },
};

type VoteRound = RoundState<Votes, null>;

class VoteDriver {
  state: VoteRound;
  readonly log: RoundEvent<Voted, Vote, null>[];

  constructor() {
    const created = createRound<Votes, Vote, Voted, null>({
      roundId: 'r1',
      config: config({
        secretMode: 'shared',
        specialOn: false,
        inactivityLimitMs: 0,
        maxDurationMs: PLAN.endMs,
      }),
      gameConfig: null,
      season: 'summer',
      commitment: null,
      plan: PLAN,
    });
    this.state = created.state;
    this.log = [created.event];
  }

  run(cmd: RoundCommand<Vote>) {
    const result = stepRound(this.state, cmd, {
      module: voteGame,
      secrets: null,
      rng: fixedRng(1),
      seed: null,
    });
    this.state = result.state;
    this.log.push(...result.events);
    return result;
  }

  // Countdown at 0 with these match players; the round opens at 10 000 (the default countdown).
  start(players: readonly string[]): number {
    this.run({
      type: 'startCountdown',
      at: 0,
      roster: players.map((playerId) => ({ playerId, team: null })),
      minPlayers: 1,
    });
    const opensAt = this.state.opensAt ?? 0;
    this.run({ type: 'open', at: opensAt });
    return opensAt;
  }

  vote(playerId: string, at: number, value: number) {
    return this.run({ type: 'guess', playerId, receivedAt: at, action: { value } }).reply;
  }
}

describe('the checks of a phased round (04 §4.8 rules 1, 2 and 4)', () => {
  it('ends at its plan end, refuses before the open and after the end', () => {
    const d = new VoteDriver();
    d.run({
      type: 'startCountdown',
      at: 0,
      roster: [{ playerId: 'p1', team: null }],
      minPlayers: 1,
    });
    const opensAt = d.state.opensAt ?? 0;
    expect(d.state.endsAt).toBe(opensAt + PLAN.endMs);
    expect(d.vote('p1', opensAt - 1, 1)).toEqual({ ok: false, code: 'ROUND_NOT_OPEN' });
    d.run({ type: 'tick', at: opensAt + PLAN.endMs });
    expect(d.state.status).toBe('ended');
    expect(d.vote('p1', opensAt + PLAN.endMs + 1, 1)).toEqual({ ok: false, code: 'ROUND_OVER' });
  });

  it('applies the windows to the millisecond, in the order of rule 2', () => {
    const d = new VoteDriver();
    const t = d.start(['p1', 'p2', 'p3']);
    expect(d.vote('p1', t + PLAN.entryEndMs - 1, 1)).toEqual({ ok: true });
    expect(d.vote('p2', t + PLAN.entryEndMs, 1)).toEqual({ ok: false, code: 'JOIN_CLOSED' });
    // Someone already in may still switch after the entry window.
    expect(d.vote('p1', t + PLAN.actionsEndMs - 1, 2)).toEqual({ ok: true });
    expect(d.vote('p1', t + PLAN.actionsEndMs, 1)).toEqual({ ok: false, code: 'PLAY_OVER' });
    // PLAY_OVER comes before JOIN_CLOSED, NOT_IN_ROUND before both.
    expect(d.vote('p3', t + PLAN.actionsEndMs, 1)).toEqual({ ok: false, code: 'PLAY_OVER' });
    expect(d.vote('px', t + PLAN.actionsEndMs, 1)).toEqual({ ok: false, code: 'NOT_IN_ROUND' });
  });

  it('has no cooldown, replies without a receive number, logs PlayerEntered once', () => {
    const d = new VoteDriver();
    const t = d.start(['p1']);
    expect(d.vote('p1', t + 100, 1)).toEqual({ ok: true });
    expect(d.vote('p1', t + 100, 2)).toEqual({ ok: true });
    expect(d.vote('p1', t + 100, 2)).toEqual({ ok: false, code: 'SAME_CHOICE' });
    const types = d.log.map((e) => e.type);
    expect(types.filter((x) => x === 'PlayerEntered')).toHaveLength(1);
    expect(types.indexOf('PlayerEntered')).toBe(types.indexOf('GuessAccepted') - 1);
    expect(d.state.roster['p1']?.enteredAt).toBe(t + 100);
    // A refusal changes nothing (P4).
    const before = d.state;
    d.vote('p1', t + 200, 2);
    expect(d.state).toEqual(before);
  });
});

describe('players and the end of a phased round (04 §4.8 rules 3 and 6)', () => {
  it('lets a match player who joins while it runs enter, and refuses one who left', () => {
    const d = new VoteDriver();
    const t = d.start(['p1']);
    expect(d.vote('p9', t + 1_000, 1)).toEqual({ ok: false, code: 'NOT_IN_ROUND' });
    d.run({ type: 'member', at: t + 2_000, playerId: 'p9', active: true });
    expect(d.vote('p9', t + 3_000, 1)).toEqual({ ok: true });
    d.run({ type: 'member', at: t + 4_000, playerId: 'p9', active: false });
    expect(d.vote('p9', t + 5_000, 2)).toEqual({ ok: false, code: 'NOT_IN_ROUND' });
    // An unchanged membership logs nothing.
    const n = d.log.length;
    d.run({ type: 'member', at: t + 6_000, playerId: 'p9', active: false });
    expect(d.log).toHaveLength(n);
  });

  it("ends with the game's results: nobody placed, winners with won, no teams", () => {
    const d = new VoteDriver();
    const t = d.start(['p1', 'p2', 'p3']);
    d.vote('p1', t + 1_000, 1);
    d.vote('p2', t + 2_000, 2);
    d.run({ type: 'tick', at: t + PLAN.endMs });
    const ended = d.log.at(-1);
    expect(ended?.type).toBe('RoundEnded');
    if (ended?.type !== 'RoundEnded') return;
    expect(ended.reason).toBe('timeUp');
    expect(ended.teams).toEqual([]);
    expect(ended.results.map((r) => [r.playerId, r.place, r.won, r.points, r.guesses])).toEqual([
      ['p1', null, true, 1, 1],
      ['p2', null, false, 0, 1],
    ]);
    expect(ended.results[0]?.solveAt).toBe(t + PLAN.endMs);
    expect(replayRound(voteGame, d.log)).toEqual(d.state);
  });

  it('ends "no players left" when nobody entered, and "host" when the host ends it', () => {
    const empty = new VoteDriver();
    const t = empty.start(['p1']);
    empty.run({ type: 'tick', at: t + PLAN.endMs });
    expect(empty.state.endReason).toBe('noPlayers');
    const ended = new VoteDriver();
    const u = ended.start(['p1']);
    ended.vote('p1', u + 1_000, 1);
    ended.run({ type: 'end', at: u + 2_000, reason: 'host' });
    expect(ended.state.endReason).toBe('host');
  });
});
