/**
 * @file   apps/server/src/http/routes/roundBody.test.ts
 * @module server/http
 * @brief  The round-setup requests' contract: Heatwave's numbers (O63), the inactivity limit (O71).
 *
 * Responsibility: `createRoundBody` takes Heatwave's step 1–10 s and interval 5–300 s as whole
 *                 seconds, refuses values outside or not whole, keeps the other settings for
 *                 the per-setting check, and stays strict at its top level; the inactivity
 *                 limit 0 (off) or 20–600 s with the warning below it (O71); the Quick Test's
 *                 request, which sets up a first round, the same (T208).
 * Depends on:     vitest, ./rounds (with ./inactivityBody), ./quickTest
 * Spec:           docs/spec/06-data-model-api-realtime.md §3.1; docs/spec/03-seasonal-specials.md §2.2
 */
import { describe, expect, it } from 'vitest';

import { quickTestBody } from './quickTest.js';
import { createRoundBody } from './rounds.js';

const ok = (settings: Record<string, unknown>) =>
  createRoundBody.safeParse({ settings, season: 'summer' }).success;

describe('the round-setup contract (O63)', () => {
  it("takes Heatwave's step and interval inside their ranges", () => {
    for (const s of [
      { 'summer.stepS': 1 },
      { 'summer.stepS': 10 },
      { 'summer.stepIntervalS': 5 },
      { 'summer.stepIntervalS': 300 },
      { 'summer.stepS': 2, 'summer.stepIntervalS': 15, 'round.cooldownS': 12 },
    ]) {
      expect(ok(s), JSON.stringify(s)).toBe(true);
    }
  });

  it('refuses them outside their ranges or not whole', () => {
    for (const s of [
      { 'summer.stepS': 0 },
      { 'summer.stepS': 11 },
      { 'summer.stepS': 1.5 },
      { 'summer.stepIntervalS': 4 },
      { 'summer.stepIntervalS': 301 },
      { 'summer.stepIntervalS': '10' },
    ]) {
      expect(ok(s), JSON.stringify(s)).toBe(false);
    }
    expect(createRoundBody.safeParse({ settings: {}, extra: 1 }).success).toBe(false);
  });
});

describe('the inactivity limit and warning in the round-setup contract (O71)', () => {
  it('takes the limit 0 (off) or 20–600 s and a warning below it', () => {
    for (const s of [
      { 'round.inactivityLimitS': 0 },
      { 'round.inactivityLimitS': 20, 'round.inactivityWarnS': 5 },
      { 'round.inactivityLimitS': 600, 'round.inactivityWarnS': 590 },
      { 'round.inactivityLimitS': 0, 'round.inactivityWarnS': 590 },
      { 'round.inactivityWarnS': 45 },
    ]) {
      expect(ok(s), JSON.stringify(s)).toBe(true);
    }
  });

  it('refuses a limit between off and 20 s, out of range, or a warning not below it', () => {
    for (const s of [
      { 'round.inactivityLimitS': 19 },
      { 'round.inactivityLimitS': 601 },
      { 'round.inactivityLimitS': 30.5 },
      { 'round.inactivityWarnS': 4 },
      { 'round.inactivityLimitS': 60, 'round.inactivityWarnS': 60 },
      { 'round.inactivityLimitS': 30, 'round.inactivityWarnS': 45 },
    ]) {
      expect(ok(s), JSON.stringify(s)).toBe(false);
    }
  });
});

describe("the Quick Test's contract (T208)", () => {
  const quick = (settings: Record<string, unknown>) =>
    quickTestBody.safeParse({ gameId: 'seasonal-target', season: 'summer', settings }).success;

  it("takes Heatwave's step and interval in range and refuses them outside", () => {
    expect(quick({ 'summer.stepS': 10, 'summer.stepIntervalS': 5, 'target.size': 20 })).toBe(true);
    for (const s of [
      { 'summer.stepS': 11 },
      { 'summer.stepIntervalS': 4 },
      { 'summer.stepS': 1.5 },
    ]) {
      expect(quick(s), JSON.stringify(s)).toBe(false);
    }
  });
});
