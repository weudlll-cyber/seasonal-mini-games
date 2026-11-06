/**
 * @file   apps/server/src/http/routes/inactivityBody.ts
 * @module server/http
 * @brief  The inactivity limit and warning in a round-setup request's settings (O71).
 *
 * Responsibility: the two settings a host sets per round, checked in the request: the
 *                 limit 0 (off) or inside its definition's bounds (20–600 s), the warning
 *                 inside its bounds, and with both given and the limit on, the warning below
 *                 the limit. A warning given alone is checked against the admin's limit when
 *                 the round is made (`inactivityProblem` in chooseRoundSettings), as every
 *                 setting is checked again against the bounds in force there.
 * Depends on:     zod, @smg/game-sdk (setting definitions, the cross-key rule)
 * Used by:        ./rounds
 * Spec:           docs/spec/02-game-guess-the-number.md §3, §5.3; docs/spec/06-data-model-api-realtime.md §3.1
 */
import { inactivityProblem, PLATFORM_ROUND_SETTINGS, type IntDef } from '@smg/game-sdk';
import { z } from 'zod';

const LIMIT = 'round.inactivityLimitS';
const WARN = 'round.inactivityWarnS';

const intDef = (key: string) =>
  PLATFORM_ROUND_SETTINGS.find((d): d is IntDef => d.key === key && d.kind === 'int');

// Whole seconds inside the definition's bounds, or its off value.
const seconds = (key: string) => {
  const def = intDef(key);
  const inBounds = z
    .number()
    .int()
    .min(def?.min ?? 1)
    .max(def?.max ?? 1);
  return (def?.off === undefined ? inBounds : z.union([z.literal(def.off), inBounds])).optional();
};

// The settings object's two named keys; the others pass on to the per-setting check.
export const inactivitySettings = { [LIMIT]: seconds(LIMIT), [WARN]: seconds(WARN) };

// The cross-key rule on the request's own values (the platform's, so the two never differ).
export function warnBelowLimit(settings: Record<string, unknown>, ctx: z.RefinementCtx): void {
  const limit = settings[LIMIT];
  const warn = settings[WARN];
  if (typeof limit !== 'number' || typeof warn !== 'number') return;
  const problem = inactivityProblem({ [LIMIT]: limit, [WARN]: warn });
  if (problem !== null) ctx.addIssue({ code: 'custom', path: [WARN], message: problem });
}
