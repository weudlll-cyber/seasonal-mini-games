/**
 * @file   apps/server/src/http/routes/heatwaveBody.ts
 * @module server/http
 * @brief  Heatwave's step and interval in a round-setup request's settings, within bounds.
 *
 * Responsibility: the two settings a host sets per round for summer (O63), checked in the
 *                 request against their definitions' bounds (1–10 s, 5–300 s), for every
 *                 request that sets up a round: the host's round form and the Quick Test
 *                 (DECISIONS T208). Every setting, these too, is checked again against the
 *                 bounds in force when the round is made; the 3 s floor is the domain's.
 * Depends on:     zod, @smg/game-sdk (setting definitions)
 * Used by:        ./rounds, ./quickTest
 * Spec:           docs/spec/03-seasonal-specials.md §2.2; docs/spec/06-data-model-api-realtime.md §3.1
 */
import { PLATFORM_ROUND_SETTINGS, type IntDef } from '@smg/game-sdk';
import { z } from 'zod';

const seconds = (key: string) => {
  const def = PLATFORM_ROUND_SETTINGS.find((d): d is IntDef => d.key === key && d.kind === 'int');
  return z
    .number()
    .int()
    .min(def?.min ?? 1)
    .max(def?.max ?? 1)
    .optional();
};

// The settings object's two named keys; the others pass on to the per-setting check.
export const heatwaveSettings = {
  'summer.stepS': seconds('summer.stepS'),
  'summer.stepIntervalS': seconds('summer.stepIntervalS'),
};
