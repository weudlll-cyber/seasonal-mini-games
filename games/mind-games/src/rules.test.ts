/**
 * @file   games/mind-games/src/rules.test.ts
 * @module games/mind-games
 * @brief  Choosing: the game's checks in order, the events of a first choice and a switch,
 *         the feed's counts and lines per visibility, the outcome rows and the pre-picks.
 *
 * Responsibility: 09 §4.2's unit cases of the rules: `validate` order and codes; first choice
 *                 and switch events with their audiences and `hide`; the feed's counts and
 *                 entrants per event; the lines per visibility value; points 1 and 2; the
 *                 outcome rows (no choice, no row); the pre-pick action per round index, All
 *                 with All off refused.
 * Depends on:     vitest, ./fakes, ./module, ./rules
 * Spec:           docs/spec/09-testing-strategy.md §4.2; docs/spec/02e-game-mind-games.md §5–§8
 */
import { describe, expect, it } from 'vitest';

import { choose, playAll, roundWith } from './fakes.js';
import { mindGames } from './module.js';
import { prefsSchema } from './rules.js';

const pick = (choice: string, hide = false) => ({ value: { choice, hide } });

describe('Mind Games checks (02e §5.2, checks 5–7)', () => {
  it('refuses an unknown name, All where it is off, and the current choice, in that order', () => {
    const s = playAll(roundWith(), [['anna', 'winter']]);
    expect(mindGames.validate(s, 'anna', pick('snow'))).toBe('CHOICE_INVALID');
    expect(mindGames.validate(s, 'anna', pick('all'))).toBe('CHOICE_UNAVAILABLE');
    expect(mindGames.validate(s, 'anna', pick('winter'))).toBe('SAME_CHOICE');
    expect(mindGames.validate(s, 'anna', pick('summer'))).toBeNull();
    expect(mindGames.validate(roundWith({ allOption: true }), 'bo', pick('all'))).toBeNull();
  });

  it('takes the wire value with its box only', () => {
    const schema = mindGames.actionSchema;
    expect(schema.safeParse(pick('winter', true)).success).toBe(true);
    expect(schema.safeParse({ choice: 'winter' }).success).toBe(false);
    expect(schema.safeParse({ ...pick('winter'), extra: 1 }).success).toBe(false);
    expect(schema.safeParse(pick('x'.repeat(17))).success).toBe(false);
  });
});

describe('Mind Games choices and the feed (02e §5.3, §6)', () => {
  it('tells a first choice to the chooser and the room with its name and the counts', () => {
    const step = choose(roundWith(), 'anna', pick('summer', true).value, 5_000);
    expect('events' in step && step.events).toEqual([
      {
        audience: 'player:anna',
        event: {
          type: 'ChoiceMade',
          playerKey: 'anna',
          receivedAt: 5_000,
          choice: 'summer',
          from: null,
          hidden: false,
          hide: true,
        },
      },
      {
        audience: 'room',
        event: {
          type: 'ChoiceFed',
          kind: 'first',
          player: 'anna',
          choice: 'summer',
          counts: { spring: 0, summer: 1, autumn: 0, winter: 0, all: 0 },
          entrants: 1,
        },
      },
    ]);
  });
});

describe('Mind Games switches in the feed (02e §6.3)', () => {
  const switchFed = (visibility: 'hidden' | 'visible' | 'perPlayer', hide: boolean) => {
    const s = playAll(roundWith({ switchVisibility: visibility }), [
      ['anna', 'summer'],
      ['bo', 'summer'],
    ]);
    const step = choose(s, 'anna', pick('winter', hide).value, 9_000);
    return 'events' in step ? step.events.map((e) => e.event) : [];
  };

  it('names a switch where switches are visible, or per player with the box clear', () => {
    const counts = { spring: 0, summer: 1, autumn: 0, winter: 1, all: 0 };
    const named = { type: 'ChoiceFed', kind: 'switch', player: 'anna', from: 'summer' };
    expect(switchFed('visible', true)[1]).toEqual({
      ...named,
      choice: 'winter',
      counts,
      entrants: 2,
    });
    expect(switchFed('perPlayer', false)[1]).toMatchObject({ kind: 'switch', player: 'anna' });
    for (const [v, hide] of [
      ['hidden', false],
      ['perPlayer', true],
    ] as const) {
      const [made, fed] = switchFed(v, hide);
      expect(made).toMatchObject({ type: 'ChoiceMade', from: 'summer', hidden: true, hide });
      expect(fed).toEqual({ type: 'ChoiceFed', kind: 'counts', counts, entrants: 2 });
    }
  });

  it('folds only the chooser’s event', () => {
    const s = roundWith();
    const fed = { type: 'ChoiceFed', kind: 'counts', counts: {}, entrants: 0 } as never;
    expect(mindGames.evolve(s, fed)).toBe(s);
  });
});

describe('Mind Games outcome (02e §8)', () => {
  it('scores the winning final choices 1, a winning All 2, and nobody else', () => {
    const s = playAll(roundWith({ allOption: true }), [
      ['anna', 'spring'],
      ['bo', 'spring'],
      ['cy', 'all'],
      ['dee', 'winter'],
      ['dee', 'spring'],
      ['ed', 'summer'],
      ['ed', 'summer'],
    ]);
    // Final counts: spring 3, summer 1, all 1: the least chosen place holds Summer and All.
    expect(mindGames.phased?.outcome(s)).toEqual([
      { playerId: 'anna', won: false, points: 0 },
      { playerId: 'bo', won: false, points: 0 },
      { playerId: 'cy', won: true, points: 2 },
      { playerId: 'dee', won: false, points: 0 },
      { playerId: 'ed', won: true, points: 1 },
    ]);
  });

  it('has no row for a round nobody chose in, and none at a place that does not exist', () => {
    expect(mindGames.phased?.outcome(roundWith())).toEqual([]);
    const s = playAll(roundWith({ winnerPlace: 3 }), [
      ['anna', 'spring'],
      ['bo', 'summer'],
    ]);
    expect(mindGames.phased?.outcome(s).map((r) => r.won)).toEqual([false, false]);
  });
});

describe('Mind Games pre-picks (02e §7)', () => {
  const prefs = { picks: { '1': 'winter', '3': 'all' }, hide: true };
  const action = mindGames.phased?.prefs?.action;

  it('gives the pick of each round with the box, none for a round without one', () => {
    const cfg = roundWith().cfg;
    expect(action?.(prefs, 1, cfg)).toEqual(pick('winter', true));
    expect(action?.(prefs, 2, cfg)).toBeNull();
    expect(action?.({ picks: { '2': 'spring' } }, 2, cfg)).toEqual(pick('spring'));
  });

  it('refuses a pre-picked All in a round without All like any choice', () => {
    const a = action?.(prefs, 3, roundWith().cfg);
    expect(a).toEqual(pick('all', true));
    expect(mindGames.validate(roundWith(), 'anna', pick('all', true))).toBe('CHOICE_UNAVAILABLE');
  });

  it('takes rounds 1–20 and the five names only', () => {
    expect(prefsSchema.safeParse(prefs).success).toBe(true);
    expect(prefsSchema.safeParse({ picks: { '20': 'spring' } }).success).toBe(true);
    for (const bad of [
      { picks: { '21': 'spring' } },
      { picks: { '0': 'spring' } },
      { picks: { '1': 'snow' } },
      { picks: {}, extra: true },
    ]) {
      expect(prefsSchema.safeParse(bad).success).toBe(false);
    }
  });
});
