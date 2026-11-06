/**
 * @file   apps/server/src/http/routes/heatwaveBody.ts
 * @module server/http
 * @brief  Heatwave's step and interval in a round-setup request's settings, within bounds.
 *
 * Responsibility: the two settings a host sets per round for summer (O63), checked in the
 *                 request against their definitions' bounds (1–10 s, 5–300 s), for every
 *                 request that sets up a round: the host's round form and the Quick Test
 *                 (DECISIONS T208), a value out of bounds refused with its field's sentence
 *                 (./settingsBody, O74). Every setting, these too, is checked again against
 *                 the bounds in force when the round is made; the 3 s floor is the domain's.
 * Depends on:     ./settingsBody
 * Used by:        ./rounds, ./quickTest
 * Spec:           docs/spec/03-seasonal-specials.md §2.2; docs/spec/06-data-model-api-realtime.md §3.1
 */
import { settingSchema } from './settingsBody.js';

// The settings object's two named keys; the others pass on to the per-setting check.
export const heatwaveSettings = {
  'summer.stepS': settingSchema('summer.stepS'),
  'summer.stepIntervalS': settingSchema('summer.stepIntervalS'),
};
