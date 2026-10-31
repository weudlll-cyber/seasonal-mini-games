/**
 * @file   games/guess-the-number/src/views.test.ts
 * @module games/guess-the-number
 * @brief  Views: what each viewer sees, Frost-held answers hidden, results with secrets.
 *
 * Responsibility: the player sees their own guesses with answers and comments, no narrowed
 *                 range (O17), and the others' guesses in the log; an answer and its comment
 *                 received at or after `releasedBefore` are shown as pending; the log follows
 *                 the visibility and the mode, with a comment exactly where an answer is shown
 *                 (O21, T73), and keeps the newest LOG_LIMIT guesses (T74); with a hidden range
 *                 no view holds the range, and the result reveals it with the secret (T52);
 *                 the result names the secret (shared) or every player's (individual); every
 *                 view validates against its schema; the settings read and check the range,
 *                 negative ends included, and the comment thresholds; a hidden range rules
 *                 halving out (T55).
 * Depends on:     vitest, ./fakes, ./module
 * Spec:           docs/spec/02-game-guess-the-number.md §6.2, §9, §11; docs/spec/09-testing-strategy.md §6
 */
import { PLATFORM_ROUND_SETTINGS, resolveSettings } from '@smg/game-sdk';
import { describe, expect, it } from 'vitest';

import { defaultConfig, input, Table } from './fakes.js';
import { guessTheNumber } from './module.js';
import { LOG_LIMIT } from './views.js';

const all = { releasedBefore: Infinity };
// Any line of the catalogue (which one depends on the DRBG).
const someLine: unknown = expect.any(String);
const { views, viewSchemas } = guessTheNumber;

function played(
  visibility: 'own' | 'numbers' | 'full',
  mode: 'shared' | 'individual' = 'shared',
  rangeVisible = true,
) {
  const secrets =
    mode === 'shared'
      ? ({ mode, value: 412 } as const)
      : ({ mode, byPlayer: { a: 412, b: 77 } } as const);
  const config = { feedbackVisibility: visibility, rangeVisible };
  const t = new Table(secrets, input(mode, ['a', 'b'], config));
  t.play('a', 300, 1_000);
  t.play('b', 500, 2_000);
  return t;
}

describe('player view', () => {
  it('shows own guesses with comments, nothing narrowed, and holds back what Frost holds', () => {
    const t = played('full');
    const open = views.player(t.state, 'a', all);
    expect(open).toEqual({
      range: { low: 1, high: 1_000 },
      removed: [],
      guesses: [
        {
          receiveSeq: 1,
          receivedAt: 1_000,
          value: 300,
          feedback: 'higher',
          tier: 'cool',
          comment: someLine,
        },
      ],
      log: [
        {
          receiveSeq: 2,
          receivedAt: 2_000,
          playerId: 'b',
          value: 500,
          feedback: 'lower',
          // 88 away: 8.8 %.
          tier: 'warm',
          comment: someLine,
        },
      ],
      hint: null,
    });
    const frosted = views.player(t.state, 'a', { releasedBefore: 1_000 });
    expect(frosted).toMatchObject({
      guesses: [{ feedback: null, tier: null, comment: null }],
      log: [{ value: 500, feedback: null, tier: null, comment: null }],
    });
    expect(viewSchemas.player.safeParse(frosted).success).toBe(true);
    expect(views.player(t.state, 'nobody', all)).toMatchObject({ guesses: [] });
  });
});

describe('the guess log', () => {
  // Comment and answer together, or neither: a viewer sees a comment exactly with the answer.
  const hidden = { feedback: null, tier: null, comment: null };

  it('follows the visibility in shared mode', () => {
    const own = views.spectator(played('own').state, all);
    expect(own).toMatchObject({ log: [{ playerId: 'a', value: null, ...hidden }, {}] });
    const numbers = views.spectator(played('numbers').state, all);
    expect(numbers).toMatchObject({
      log: [
        { value: 300, ...hidden },
        { value: 500, ...hidden },
      ],
    });
    const full = views.spectator(played('full').state, all);
    expect(full).toMatchObject({
      range: { low: 1, high: 1_000 },
      log: [
        { value: 300, feedback: 'higher', tier: 'cool', comment: someLine },
        { value: 500, feedback: 'lower', tier: 'warm', comment: someLine },
      ],
    });
    for (const v of [own, numbers, full])
      expect(viewSchemas.spectator.safeParse(v).success).toBe(true);
  });

  it('holds back what Frost holds and shows only that someone guessed in individual mode', () => {
    const frosted = views.spectator(played('full').state, { releasedBefore: 2_000 });
    expect(frosted).toMatchObject({ log: [{ feedback: 'higher' }, { value: 500, ...hidden }] });
    const ind = views.spectator(played('full', 'individual').state, all);
    expect(ind).toMatchObject({
      log: [
        { value: null, ...hidden },
        { value: null, ...hidden },
      ],
    });
    // A player's own answers and comments stay theirs in individual mode.
    expect(views.player(played('full', 'individual').state, 'a', all)).toMatchObject({
      guesses: [{ feedback: 'higher', tier: 'cool' }],
      log: [{ playerId: 'b', value: null, ...hidden }],
    });
  });

  it('keeps the newest guesses of others only', () => {
    const t = new Table({ mode: 'shared', value: 999 }, input('shared', ['a', 'b']));
    for (let k = 1; k <= LOG_LIMIT + 5; k += 1) t.play('b', k, k);
    const log = views.player(t.state, 'a', all) as { log: { value: number }[] };
    expect(log.log).toHaveLength(LOG_LIMIT);
    expect(log.log[0]?.value).toBe(6);
    expect(log.log.at(-1)?.value).toBe(LOG_LIMIT + 5);
  });
});

describe('a hidden range', () => {
  it('is in no player or spectator view, and the result reveals it', () => {
    for (const mode of ['shared', 'individual'] as const) {
      const t = played('full', mode, false);
      const player = views.player(t.state, 'a', all);
      const spectator = views.spectator(t.state, all);
      expect(player).toMatchObject({ range: null });
      expect(spectator).toMatchObject({ range: null });
      expect(viewSchemas.player.safeParse(player).success).toBe(true);
      expect(viewSchemas.spectator.safeParse(spectator).success).toBe(true);
      expect(views.result(t.state, t.secrets)).toMatchObject({ range: { low: 1, high: 1_000 } });
    }
  });
});

describe('result view', () => {
  it('reveals the shared secret or every player secret, with all guesses', () => {
    const shared = played('full');
    const r = views.result(shared.state, shared.secrets);
    expect(r).toEqual({
      range: { low: 1, high: 1_000 },
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
    expect(guessTheNumber.settings.problem({ ...cfg, rangeLow: -500, rangeHigh: 500 })).toBeNull();
    const steps = { ...cfg.thresholds, warm: 1 };
    expect(guessTheNumber.settings.problem({ ...cfg, thresholds: steps })).toMatch(/must fall/);
    expect(guessTheNumber.settings.halvingAllowed?.(cfg)).toBe(true);
    expect(guessTheNumber.settings.halvingAllowed?.({ ...cfg, rangeVisible: false })).toBe(false);
    const takes = (value: unknown) => guessTheNumber.actionSchema.safeParse({ value }).success;
    expect([3, -1_000_000_000, 1_000_000_000].every(takes)).toBe(true);
    expect([2.5, 1_000_000_001, 'x'].some(takes)).toBe(false);
  });
});
