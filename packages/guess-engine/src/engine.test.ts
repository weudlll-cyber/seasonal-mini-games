/**
 * @file   packages/guess-engine/src/engine.test.ts
 * @module guess-engine
 * @brief  The engine as a game sees it: checks, decision, room lines, folding and views.
 *
 * Responsibility: through the toy game (./fakes): the check order (unknown player, the game's
 *                 own check, the repeat rule on and off), the answer to the guesser held for
 *                 Frost, the room's line per visibility and mode with the comment exactly
 *                 beside the answer, `Solved`, the extra cooldown only when the game gives
 *                 one, comments off, the game's own events folded by the game, and views with
 *                 Frost's cut, the visibility and the newest 60 of others.
 * Depends on:     vitest, ./fakes, ./index
 * Spec:           docs/spec/04-software-architecture.md §4.7; docs/spec/02-game-guess-the-number.md §5.1, §6
 */
import { describe, expect, it } from 'vitest';

import { toy, toyInput, ToyTable } from './fakes.js';
import { LOG_LIMIT, type Secrets } from './index.js';

const shared = (value: number): Secrets<number> => ({ mode: 'shared', value });

describe('the checks', () => {
  it('refuse an unknown player, then the game’s own code, then a repeat', () => {
    const t = new ToyTable(toyInput('shared'), shared(10));
    expect(toy.validate(t.state, 'zed', { value: 5 })).toBe('NOT_HERE');
    expect(t.play('a', 13)).toEqual({ ok: false, code: 'UNLUCKY' });
    expect(t.play('a', 5).ok).toBe(true);
    expect(t.play('a', 5)).toEqual({ ok: false, code: 'ALREADY_GUESSED' });
    // Another player's same guess is no repeat of theirs.
    expect(t.play('b', 5).ok).toBe(true);
  });

  it('let a repeat through when the round allows it', () => {
    const t = new ToyTable(toyInput('shared', { repeatGuessRejected: false }), shared(10));
    expect(t.play('a', 5).ok).toBe(true);
    expect(t.play('a', 5).ok).toBe(true);
  });

  it('refuse an unknown player in the decision too', () => {
    const t = new ToyTable(toyInput('shared'), shared(10));
    const act = { playerId: 'zed', receiveSeq: 1, receivedAt: 0, action: { value: 3 } };
    const ctx = { now: 0, cooldownMs: 3_000, secrets: t.secrets, rng: t.rng };
    expect(toy.decide(t.state, act, ctx)).toEqual({ ok: false, code: 'NOT_HERE' });
  });
});

describe('the decision', () => {
  it('answers the guesser under Frost and tells the room per visibility', () => {
    for (const visibility of ['own', 'numbers', 'full'] as const) {
      const t = new ToyTable(toyInput('shared', { feedbackVisibility: visibility }), shared(10));
      const d = t.play('a', 4);
      if (!d.ok) throw new Error(d.code);
      expect(d.events[0]).toMatchObject({
        audience: 'player:a',
        feedback: true,
        event: { type: 'FeedbackGiven', value: 4, feedback: 'up', comment: { tier: 'cold' } },
      });
      const room = d.events[1];
      expect(room?.audience).toBe('room');
      const line = room?.event as Record<string, unknown>;
      expect(line).toMatchObject({ type: 'GuessFed', playerId: 'a', guesses: 1 });
      expect('value' in line).toBe(visibility !== 'own');
      expect('feedback' in line).toBe(visibility === 'full');
      expect('comment' in line).toBe(visibility === 'full');
      // Only the line carrying the answer is held for Frost.
      expect(room?.feedback === true).toBe(visibility === 'full');
    }
  });

  it('tells the room only that a guess happened in individual mode', () => {
    const t = new ToyTable(toyInput('individual'), {
      mode: 'individual',
      byPlayer: { a: 3, b: 4, c: 5 },
    });
    const d = t.play('a', 9);
    expect(d.ok && d.events[1]?.event).toEqual({ type: 'GuessFed', playerId: 'a', guesses: 1 });
  });

  it('signals a solve and adds the game’s extra cooldown only when it gives one', () => {
    const t = new ToyTable(toyInput('shared'), shared(10));
    const up = t.play('a', 4);
    expect(up.ok && 'extraCooldownMs' in up).toBe(false);
    const down = t.play('b', 15);
    expect(down.ok && down.extraCooldownMs).toBe(500);
    const hit = t.play('c', 10);
    expect(hit.ok && hit.signals).toEqual([{ type: 'Solved', playerId: 'c' }]);
  });

  it('gives no comment with the comments off', () => {
    const t = new ToyTable(toyInput('shared', { comments: false }), shared(10));
    const d = t.play('a', 4);
    expect(d.ok && d.events[0]?.event).toMatchObject({ comment: null });
    expect(d.ok && 'comment' in (d.events[1]?.event ?? {})).toBe(false);
    expect(t.state.comments.used).toEqual({});
  });
});

describe('folding', () => {
  it('keeps answers per player, notes used lines, and leaves the game’s events to the game', () => {
    const t = new ToyTable(toyInput('shared'), shared(10));
    t.play('a', 4);
    t.play('a', 6);
    expect(t.state.players.a?.guesses.map((g) => g.value)).toEqual([4, 6]);
    const used = Object.values(t.state.comments.used).flat();
    expect(used).toHaveLength(2);
    const fed = { type: 'GuessFed', playerId: 'a', guesses: 3 } as const;
    expect(toy.evolve(t.state, fed)).toBe(t.state);
    expect(toy.evolve(t.state, { type: 'Bonus' }).bonus).toBe(1);
    // An answer for a player the round does not know changes nothing.
    const stray = {
      type: 'FeedbackGiven',
      playerId: 'zed',
      receiveSeq: 9,
      receivedAt: 0,
      value: 1,
      feedback: 'up',
      comment: null,
    } as const;
    expect(toy.evolve(t.state, stray)).toBe(t.state);
  });

  it('replays an answer stored without a comment as one without (T86)', () => {
    const t = new ToyTable(toyInput('shared'), shared(10));
    const old = {
      type: 'FeedbackGiven',
      playerId: 'a',
      receiveSeq: 1,
      receivedAt: 0,
      value: 2,
      feedback: 'up',
    };
    const next = toy.evolve(t.state, old as never);
    expect(next.players.a?.guesses[0]?.comment).toBeNull();
  });
});

describe('the views', () => {
  it('hide answers Frost still holds, and others’ guesses by visibility', () => {
    for (const visibility of ['own', 'numbers', 'full'] as const) {
      const t = new ToyTable(toyInput('shared', { feedbackVisibility: visibility }), shared(10));
      t.play('a', 4, 1_000);
      t.play('b', 6, 5_000);
      const view = toy.views.player(t.state, 'a', { releasedBefore: 3_000 }) as {
        guesses: { feedback: unknown }[];
        log: { value: unknown; feedback: unknown; comment: unknown }[];
      };
      expect(view.guesses[0]?.feedback).toBe('up');
      expect(view.log[0]?.value).toBe(visibility === 'own' ? null : 6);
      // b's answer is held by Frost for everyone.
      expect(view.log[0]?.feedback).toBeNull();
      expect(toy.viewSchemas.player.safeParse(view).success).toBe(true);
      const later = toy.views.spectator(t.state, { releasedBefore: 9_000 }) as {
        log: { feedback: unknown; comment: unknown }[];
      };
      expect(later.log.map((g) => g.feedback !== null)).toEqual(
        visibility === 'full' ? [true, true] : [false, false],
      );
    }
  });

  it('keep the newest guesses of others only, oldest first', () => {
    const t = new ToyTable(toyInput('shared', { repeatGuessRejected: false }), shared(20));
    for (let i = 0; i < LOG_LIMIT + 5; i += 1) t.play(i % 2 === 0 ? 'a' : 'b', 1 + (i % 12));
    const log = (
      toy.views.spectator(t.state, { releasedBefore: 0 }) as { log: { receiveSeq: number }[] }
    ).log;
    expect(log).toHaveLength(LOG_LIMIT);
    expect(log[0]?.receiveSeq).toBe(6);
  });

  it('show every guess with its answer on the result', () => {
    const t = new ToyTable(toyInput('shared'), shared(10));
    t.play('a', 4);
    t.play('b', 10);
    expect(toy.views.result(t.state, t.secrets)).toEqual({
      guesses: { a: [{ value: 4, feedback: 'up' }], b: [{ value: 10, feedback: 'hit' }], c: [] },
    });
  });
});
