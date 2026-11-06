/**
 * @file   apps/server/src/http/routes/settingsBody.ts
 * @module server/http
 * @brief  One platform round setting in a round-setup request, and the refusal it gives.
 *
 * Responsibility: the zod schema of a named setting in a request's `settings`, checked with
 *                 its definition's own check (`settingIssue`), so a refused value carries the
 *                 field's sentence from the one source every form and refusal uses (O74);
 *                 and the 422 ROUND_SETTINGS_INVALID answer for a request whose settings
 *                 failed, with the setting's key in `field` and the sentence in `detail`.
 *                 Used by every request that sets up a round: the host's round form and the
 *                 Quick Test (DECISIONS T208).
 * Depends on:     zod, @smg/contracts (SettingRefusalView), @smg/game-sdk (definitions, check)
 * Used by:        ./heatwaveBody, ./inactivityBody, ./rounds, ./quickTest
 * Spec:           docs/spec/06-data-model-api-realtime.md §3.1; docs/spec/08-admin-settings.md §3
 */
import type { SettingRefusalView } from '@smg/contracts';
import { PLATFORM_ROUND_SETTINGS, settingIssue } from '@smg/game-sdk';
import { z } from 'zod';

// A platform round setting by key: inside its definition (bounds, off value), else a zod
// issue with the field's sentence. Whole seconds are numbers, so the value passes on as one.
export function settingSchema(key: string) {
  const def = PLATFORM_ROUND_SETTINGS.find((d) => d.key === key);
  if (def === undefined) throw new Error(`${key} is no platform round setting`);
  return z
    .unknown()
    .superRefine((value, ctx) => {
      const issue = settingIssue(def, value);
      if (issue !== null) ctx.addIssue({ code: 'custom', message: issue.message });
    })
    .transform((value) => value as number)
    .optional();
}

// The answer for a request whose `settings` failed their check: the first such issue's
// setting and sentence; null when the problem lies elsewhere in the body (a plain 400).
export function settingsRefusal(error: z.ZodError): SettingRefusalView | null {
  const issue = error.issues.find((i) => i.path[0] === 'settings' && i.path.length === 2);
  if (issue === undefined) return null;
  return { code: 'ROUND_SETTINGS_INVALID', detail: issue.message, field: String(issue.path[1]) };
}
