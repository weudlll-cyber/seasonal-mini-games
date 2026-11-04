/**
 * @file   apps/server/src/http/routes/roundBody.test.ts
 * @module server/http
 * @brief  The round-setup request's contract: Heatwave's step and interval in range (O63).
 *
 * Responsibility: `createRoundBody` takes Heatwave's step 1–10 s and interval 5–300 s as whole
 *                 seconds, refuses values outside or not whole, keeps the other settings for
 *                 the per-setting check, and stays strict at its top level.
 * Depends on:     vitest, ./rounds
 * Spec:           docs/spec/06-data-model-api-realtime.md §3.1; docs/spec/03-seasonal-specials.md §2.2
 */
import { describe, expect, it } from 'vitest';

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
