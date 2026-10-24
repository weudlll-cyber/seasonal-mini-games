/**
 * @file   games/guess-the-number/src/views.test.ts
 * @module games/guess-the-number
 * @brief  Views: what each viewer sees, Frost-held answers hidden, results with secrets.
 *
 * Responsibility: the player sees their own guesses and band; an answer received at or
 *                 after `releasedBefore` is shown as pending and leaves the band alone; the
 *                 spectator sees counts, numbers or answers by visibility and mode; the
 *                 result names the secret (shared) or every player's (individual); every
 *                 view validates against its schema; the settings read and check the range.
 * Depends on:     vitest, ./fakes, ./module
 * Spec:           docs/spec/02-game-guess-the-number.md §6.2, §9, §11; docs/spec/09-testing-strategy.md §6
 */
import { PLATFORM_ROUND_SETTINGS, resolveSettings } from '@smg/game-sdk';
import { describe, expect, it } from 'vitest';

import { defaultConfig, input, Table } from './fakes.js';
import { guessTheNumber } from './module.js';

const all = { releasedBefore: Infinity };
const { views, viewSchemas } = guessTheNumber;

function played(visibility: 'own' | 'numbers' | 'full', mode: 'shared' | 'individual' = 'shared') {
  const secrets =
    mode === 'shared'
      ? ({ mode, value: 412 } as const)
      : ({ mode, byPlayer: { a: 412, b: 77 } } as const);
  const t = new Table(secrets, input(mode, ['a', 'b'], { feedbackVisibility: visibility }));
  t.play('a', 300, 1_000);
  t.play('b', 500, 2_000);
  return t;
}

describe('player view', () => {
  it('shows own guesses and the band, and holds back answers Frost still holds', () => {
    const t = played('full');
    const open = views.player(t.state, 'a', all);
    expect(open).toEqual({
      range: { low: 1, high: 1_000 },
      removed: [],
      band: { low: 301, high: 1_000 },
      guesses: [{ receiveSeq: 1, value: 300, feedback: 'higher' }],
      hint: null,
    });
    const frosted = views.player(t.state, 'a', { releasedBefore: 1_000 });
    expect(frosted).toMatchObject({ band: { low: 1, high: 1_000 }, guesses: [{ feedback: null }] });
    expect(viewSchemas.player.safeParse(frosted).success).toBe(true);
    expect(views.player(t.state, 'nobody', all)).toMatchObject({ guesses: [] });
  });
});

describe('spectator view', () => {
  it('follows the visibility in shared mode', () => {
    const own = views.spectator(played('own').state, all);
    expect(own).toMatchObject({
      sharedBand: null,
      players: [{ guesses: 1, values: null, answers: null }, {}],
    });
    const numbers = views.spectator(played('numbers').state, all);
    expect(numbers).toMatchObject({
      players: [{ values: [300], answers: null }, { values: [500] }],
    });
    const full = views.spectator(played('full').state, all);
    expect(full).toMatchObject({
      sharedBand: { low: 301, high: 499 },
      players: [
        { answers: [{ value: 300, feedback: 'higher' }] },
        { answers: [{ value: 500, feedback: 'lower' }] },
      ],
    });
    for (const v of [own, numbers, full])
      expect(viewSchemas.spectator.safeParse(v).success).toBe(true);
  });

  it('holds back Frost answers and shows only counts in individual mode', () => {
    const frosted = views.spectator(played('full').state, { releasedBefore: 2_000 });
    expect(frosted).toMatchObject({
      sharedBand: { low: 301, high: 1_000 },
      players: [{ answers: [{}] }, { answers: [] }],
    });
    const ind = views.spectator(played('full', 'individual').state, all);
    expect(ind).toMatchObject({
      sharedBand: null,
      players: [{ guesses: 1, values: null, answers: null }, {}],
    });
  });
});

describe('result view', () => {
  it('reveals the shared secret or every player secret, with all guesses', () => {
    const shared = played('full');
    const r = views.result(shared.state, shared.secrets);
    expect(r).toEqual({
      secret: 412,
      secrets: null,
      guesses: { a: [{ value: 300, feedback: 'higher' }], b: [{ value: 500, feedback: 'lower' }] },
    });
    const ind = played('full', 'individual');
    expect(views.result(ind.state, ind.secrets)).toMatchObject({
      secret: null,
      secrets: { a: 412, b: 77 },
    });
    expect(viewSchemas.result.safeParse(r).success).toBe(true);
  });
});

describe('settings', () => {
  it('read the defaults and refuse a range under 10 numbers', () => {
    const values = resolveSettings(
      [...PLATFORM_ROUND_SETTINGS, ...guessTheNumber.settings.defs],
      {},
    );
    const cfg = guessTheNumber.settings.read(values);
    expect(cfg).toEqual(defaultConfig);
    expect(guessTheNumber.settings.problem(cfg)).toBeNull();
    expect(guessTheNumber.settings.problem({ ...cfg, rangeLow: 5, rangeHigh: 13 })).toMatch(
      /at least 9/,
    );
    expect(guessTheNumber.actionSchema.safeParse({ value: 3 }).success).toBe(true);
    expect(guessTheNumber.actionSchema.safeParse({ value: 'x' }).success).toBe(false);
  });
});
