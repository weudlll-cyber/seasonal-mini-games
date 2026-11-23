/**
 * @file   apps/server/src/round/guessLimits.test.ts
 * @module server/round
 * @brief  The play limits of 05 §5 and the bot-timing signal of 05 §7, against a moved clock.
 *
 * Responsibility: a team change and a host's round command each refuse the second call inside
 *                 their interval and allow it after, per account; a changed setting takes
 *                 effect at the next read (08 §6: immediate); accepted guesses that arrive
 *                 within `abuse.botTimingWindowMs` after the previous cooldown's end raise the
 *                 abuse score once more than BOT_TIMED_PER_MIN come in a minute, guesses outside
 *                 the window and refused guesses do not.
 * Depends on:     vitest, ./guessLimits
 * Spec:           docs/spec/05-security-threat-model.md §5, §7; docs/spec/08-admin-settings.md §6
 */
import type { SettingsService } from '@smg/application';
import { describe, expect, it } from 'vitest';

import type { DbPool } from '../db/pool.js';
import { BOT_TIMED_PER_MIN, GuessLimits } from './guessLimits.js';

// Settings by document, changed by the test; the signals the pool was asked to insert.
function setup(rates: Record<string, unknown> = {}, security: Record<string, unknown> = {}) {
  const docs: Record<string, Record<string, unknown>> = {
    rate_limits: { 'rate.teamChoosePerMin': 12, 'rate.hostRoundCommandsPerMin': 30, ...rates },
    security: { 'abuse.botTimingWindowMs': 30, 'abuse.cooldownRejectsPerMin': 20, ...security },
  };
  const settings = { values: (id: string) => Promise.resolve(docs[id] ?? {}) };
  const signals: unknown[][] = [];
  const pool = {
    query: (_sql: string, params: unknown[]) => {
      signals.push(params);
      return Promise.resolve({ rows: [] });
    },
  };
  let t = 1_000_000;
  const clock = { now: () => t, move: (ms: number) => (t += ms) };
  const limits = new GuessLimits(
    settings as unknown as SettingsService,
    pool as unknown as DbPool,
    clock.now,
  );
  return { limits, docs, signals, clock };
}

describe('the play limits (05 §5)', () => {
  it('lets one team change through every 5 s per account', () => {
    const { limits, clock } = setup();
    expect(limits.allowTeam('anna')).toBe(true);
    expect(limits.allowTeam('anna')).toBe(false);
    expect(limits.allowTeam('ben')).toBe(true);
    clock.move(4_900);
    expect(limits.allowTeam('anna')).toBe(false);
    clock.move(100);
    expect(limits.allowTeam('anna')).toBe(true);
  });

  it('lets one host round command through every 2 s per host', () => {
    const { limits, clock } = setup();
    expect(limits.allowHost('host')).toBe(true);
    clock.move(1_900);
    expect(limits.allowHost('host')).toBe(false);
    clock.move(100);
    expect(limits.allowHost('host')).toBe(true);
  });

  it('takes a changed setting at the next read', async () => {
    const { limits, docs, clock } = setup();
    await limits.refresh();
    docs['rate_limits'] = { ...docs['rate_limits'], 'rate.hostRoundCommandsPerMin': 6 };
    await limits.refresh();
    expect(limits.allowHost('host')).toBe(true);
    clock.move(9_900);
    expect(limits.allowHost('host')).toBe(false);
    clock.move(100);
    expect(limits.allowHost('host')).toBe(true);
  });
});

describe('the bot-timing signal (05 §7)', () => {
  // `n` accepted guesses within one minute, each `late` ms after the previous cooldown's end
  // (3 s); the first has no cooldown before it, so n - 1 of them are timed.
  function guesses(limits: GuessLimits, n: number, late: number): void {
    let at = 0;
    for (let i = 0; i < n; i += 1) {
      limits.noteReply('anna', { ok: true, cooldownEndsAt: at + 3_000 }, at);
      at += 3_000 + late;
    }
  }

  it('raises the score once a minute, when more than the threshold come within the window', async () => {
    const quiet = setup();
    await quiet.limits.refresh();
    guesses(quiet.limits, BOT_TIMED_PER_MIN + 1, 10);
    expect(quiet.signals).toHaveLength(0);
    const timed = setup();
    await timed.limits.refresh();
    guesses(timed.limits, BOT_TIMED_PER_MIN + 2, 10);
    expect(timed.signals.map((p) => p[1])).toEqual(['botTiming']);
    const many = setup();
    await many.limits.refresh();
    guesses(many.limits, 15, 10);
    expect(many.signals).toHaveLength(1);
  });

  it('counts no guess outside the window, and no refused guess', async () => {
    const { limits, signals } = setup({}, { 'abuse.botTimingWindowMs': 30 });
    await limits.refresh();
    guesses(limits, 15, 31);
    for (let i = 0; i < 5; i += 1) limits.noteReply('anna', { ok: false, code: 'ROUND_OVER' }, 0);
    expect(signals).toHaveLength(0);
  });
});
