/**
 * @file   apps/server/src/http/routes/inactivityBody.ts
 * @module server/http
 * @brief  The inactivity limit and warning in a round-setup request's settings (O71).
 *
 * Responsibility: the two settings a host sets per round, checked in the request: the
 *                 limit 0 (off) or inside its definition's bounds (20–600 s), the warning
 *                 inside its bounds, and with both given and the limit on, the warning below
 *                 the limit; each refusal with its field's sentence (./settingsBody, O74). A
 *                 warning given alone is checked against the admin's limit when the round is
 *                 made (`inactivityIssue` in chooseRoundSettings), as every setting is
 *                 checked again against the bounds in force there.
 * Depends on:     zod, @smg/game-sdk (the cross-key rule), ./settingsBody
 * Used by:        ./rounds, ./quickTest
 * Spec:           docs/spec/02-game-guess-the-number.md §3, §5.3; docs/spec/06-data-model-api-realtime.md §3.1
 */
import { inactivityIssue } from '@smg/game-sdk';
import type { z } from 'zod';

import { settingSchema } from './settingsBody.js';

const LIMIT = 'round.inactivityLimitS';
const WARN = 'round.inactivityWarnS';

// The settings object's two named keys (whole seconds inside the bounds, or the limit's off
// value); the others pass on to the per-setting check.
export const inactivitySettings = { [LIMIT]: settingSchema(LIMIT), [WARN]: settingSchema(WARN) };

// The cross-key rule on the request's own values (the platform's, so the two never differ).
export function warnBelowLimit(settings: Record<string, unknown>, ctx: z.RefinementCtx): void {
  const limit = settings[LIMIT];
  const warn = settings[WARN];
  if (typeof limit !== 'number' || typeof warn !== 'number') return;
  const issue = inactivityIssue({ [LIMIT]: limit, [WARN]: warn });
  if (issue !== null) ctx.addIssue({ code: 'custom', path: [issue.key], message: issue.message });
}
