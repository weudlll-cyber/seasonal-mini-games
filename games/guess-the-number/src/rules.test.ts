/**
 * @file   games/guess-the-number/src/rules.test.ts
 * @module games/guess-the-number
 * @brief  The game's checks, its answers, the room's line per visibility, and solving.
 *
 * Responsibility: OUT_OF_RANGE for values outside the player's range or not whole while the
 *                 range is shown, and none at all while it is hidden (T53); NUMBER_REMOVED,
 *                 ALREADY_GUESSED only when repeats are refused; the answer goes to the
 *                 guesser and is marked for Frost, without any narrowed range (O17); the room
 *                 line carries what the visibility allows (02 §6.2); a correct guess signals
 *                 Solved.
 * Depends on:     vitest, ./fakes, ./module
 * Spec:           docs/spec/02-game-guess-the-number.md §5.1, §6, §8
 */
import { describe, expect, it } from 'vitest';

import { input, Table } from './fakes.js';
import { guessTheNumber } from './module.js';

const shared = (value: number) => ({ mode: 'shared', value }) as const;

describe('checks', () => {
  it('refuse values outside the range, fractions, removed numbers and repeats', () => {
    const t = new Table(shared(500), input('shared', ['a']));
    expect(t.play('a', 0)).toEqual({ ok: false, code: 'OUT_OF_RANGE' });
    expect(t.play('a', 1_001)).toEqual({ ok: false, code: 'OUT_OF_RANGE' });
    expect(t.play('a', 2.5)).toEqual({ ok: false, code: 'OUT_OF_RANGE' });
    expect(t.play('x', 5)).toEqual({ ok: false, code: 'OUT_OF_RANGE' });
    t.state = { ...t.state, removed: [17] };
    expect(t.play('a', 17)).toEqual({ ok: false, code: 'NUMBER_REMOVED' });
    expect(t.play('a', 1).ok).toBe(true);
    expect(t.play('a', 1)).toEqual({ ok: false, code: 'ALREADY_GUESSED' });
  });

  it('accept and answer any whole number while the range is hidden', () => {
    const hidden = { rangeLow: -500, rangeHigh: 500, rangeVisible: false };
    const t = new Table(shared(-40), input('shared', ['a'], hidden));
    const far = t.play('a', -900_000_000);
    expect(far.ok && far.events[0]?.event).toMatchObject({
      value: -900_000_000,
      feedback: 'higher',
    });
    expect(t.play('a', 700).ok).toBe(true);
    t.state = { ...t.state, removed: [17] };
    expect(t.play('a', 17)).toEqual({ ok: false, code: 'NUMBER_REMOVED' });
    expect(t.play('a', 700)).toEqual({ ok: false, code: 'ALREADY_GUESSED' });
  });

  it('take negative numbers in a range that reaches below zero', () => {
    const t = new Table(shared(-40), input('shared', ['a'], { rangeLow: -500, rangeHigh: 500 }));
    expect(t.play('a', -501)).toEqual({ ok: false, code: 'OUT_OF_RANGE' });
    expect(t.play('a', -500).ok).toBe(true);
    expect(t.play('a', -40).ok && t.state.players.a?.guesses.at(-1)?.feedback).toBe('correct');
  });

  it('allow a repeat when repeats are not refused', () => {
    const t = new Table(shared(500), input('shared', ['a'], { repeatGuessRejected: false }));
    expect(t.play('a', 1).ok).toBe(true);
    expect(t.play('a', 1).ok).toBe(true);
  });
});

describe('answers', () => {
  it('tell the guesser higher, lower or correct and nothing narrowed, held for Frost', () => {
    const t = new Table(shared(412), input('shared', ['a']));
    const first = t.play('a', 300, 1_000);
    expect(first.ok && first.events[0]).toEqual({
      audience: 'player:a',
      feedback: true,
      event: {
        type: 'FeedbackGiven',
        playerId: 'a',
        receiveSeq: 1,
        receivedAt: 1_000,
        value: 300,
        feedback: 'higher',
      },
    });
    const second = t.play('a', 500);
    expect(second.ok && second.events[0]?.event).toMatchObject({ feedback: 'lower' });
    const hit = t.play('a', 412);
    expect(hit.ok && hit.signals).toEqual([{ type: 'Solved', playerId: 'a' }]);
    expect(second.ok && second.signals).toEqual([]);
  });
});

describe('the room line', () => {
  it('show the room what the visibility allows', () => {
    const line = (
      visibility: 'own' | 'numbers' | 'full',
      mode: 'shared' | 'individual' = 'shared',
    ) => {
      const secrets =
        mode === 'shared' ? shared(412) : ({ mode, byPlayer: { a: 412, b: 9 } } as const);
      const t = new Table(secrets, input(mode, ['a', 'b'], { feedbackVisibility: visibility }));
      const d = t.play('a', 300);
      return d.ok ? d.events[1] : undefined;
    };
    expect(line('own')).toEqual({
      audience: 'room',
      event: { type: 'GuessFed', playerId: 'a', guesses: 1 },
    });
    expect(line('numbers')?.event).toEqual({
      type: 'GuessFed',
      playerId: 'a',
      guesses: 1,
      value: 300,
    });
    expect(line('full')).toEqual({
      audience: 'room',
      feedback: true,
      event: {
        type: 'GuessFed',
        playerId: 'a',
        guesses: 1,
        value: 300,
        feedback: 'higher',
      },
    });
    expect(line('full', 'individual')?.event).toEqual({
      type: 'GuessFed',
      playerId: 'a',
      guesses: 1,
    });
  });
});

describe('unknown players', () => {
  it('refuse a guess from a player the game does not know', () => {
    const t = new Table(shared(412), input('shared', ['a']));
    const act = { playerId: 'x', receiveSeq: 1, receivedAt: 0, action: { value: 5 } };
    const ctx = {
      now: 0,
      cooldownMs: 3_000,
      secrets: t.secrets,
      rng: {
        child: () => {
          throw new Error();
        },
      },
    };
    expect(guessTheNumber.decide(t.state, act, ctx)).toEqual({ ok: false, code: 'OUT_OF_RANGE' });
    expect(
      guessTheNumber.evolve(t.state, {
        type: 'FeedbackGiven',
        playerId: 'x',
        receiveSeq: 1,
        receivedAt: 0,
        value: 5,
        feedback: 'higher',
      }),
    ).toBe(t.state);
  });
});
