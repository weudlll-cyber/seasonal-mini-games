/**
 * @file   apps/server/src/http/routes/quickTest.ts
 * @module server/http
 * @brief  POST /api/v1/dev/quicktest: start a Quick Test round against bots.
 *
 * Responsibility: validate the body with zod and start the Quick Test of the chosen game
 *                 (O41, with its own settings) for the signed-in player, at once or through the
 *                 waiting area (`lobby`, O24); settings the game refuses answer 422, with the
 *                 setting's key and sentence (ROUND_SETTINGS_INVALID, O74). Registered only
 *                 in development builds (SMG_DEV=1), like every development route. Replaces
 *                 Bingo's in-memory runner of the same name.
 * Depends on:     fastify, zod, ../../dev/quickTest, ../../match/play, ./heatwaveBody,
 *                 ./inactivityBody, ./settingsBody
 * Used by:        ../app
 * Spec:           docs/spec/11-roadmap.md (phase 1 Quick Test); docs/spec/09-testing-strategy.md §1
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { quickTests } from '../../dev/quickTest.js';
import type { Play } from '../../match/play.js';
import { PlayError } from '../../match/playError.js';

import { heatwaveSettings } from './heatwaveBody.js';
import { inactivitySettings, warnBelowLimit } from './inactivityBody.js';
import { settingsRefusal } from './settingsBody.js';

export const quickTestBody = z
  .object({
    gameId: z.string().min(1).max(40).default('guess-the-number'),
    mode: z.enum(['shared', 'individual']).default('shared'),
    bots: z.number().int().min(1).max(50).default(3),
    cooldownS: z.number().int().min(3).max(60).default(3),
    visibility: z.enum(['own', 'numbers', 'full']).default('full'),
    // A short search for a quick look; negative bounds and a hidden range too (O18, O19).
    rangeLow: z.number().int().min(-1_000_000).max(1_000_000).default(1),
    rangeHigh: z.number().int().min(-1_000_000).max(1_000_000).default(1_000),
    rangeVisible: z.boolean().default(true),
    // Closeness comments on every guess (O21), on as for every round.
    comments: z.boolean().default(true),
    // The fast test profile (09 §4): specials every few seconds. On by default here.
    fast: z.boolean().default(true),
    halving: z.boolean().default(false),
    // Through the waiting area, the host starting the round (O24). Off here, so scripted
    // callers keep the direct start; the Quick Test form sends it on by default.
    lobby: z.boolean().default(false),
    // A team match (O34), as matches are by default.
    teamMatch: z.boolean().default(true),
    // Short for scripted callers; the Quick Test form sends the round setting's default, so
    // the intro screen shows as long as in a normal round (O36).
    countdownS: z.number().int().min(3).max(30).default(3),
    // Bots wait this much longer after each guess (T154): a busy round with no early winner.
    botDelayS: z.number().int().min(0).max(120).default(0),
    seedText: z.string().trim().min(1).max(64).optional(),
    season: z.enum(['spring', 'summer', 'autumn', 'winter']).optional(),
    // The chosen game's own round settings (O41); each is checked against the game's
    // definitions when the round is created, an unknown key refused (T121).
    // Heatwave's two in range as in the round form (O63, ./heatwaveBody, T208), and the
    // inactivity limit with its warning (O75, ./inactivityBody).
    settings: z
      .object({ ...heatwaveSettings, ...inactivitySettings })
      .catchall(z.union([z.string().max(60), z.number(), z.boolean()]))
      .refine((s) => Object.keys(s).length <= 40 && Object.keys(s).every((k) => k.length <= 60))
      .superRefine(warnBelowLimit)
      .default({}),
  })
  .strict()
  // At least 10 numbers, as for every round (08 §3).
  .refine((b) => b.rangeHigh >= b.rangeLow + 9);

export function registerQuickTest(
  app: FastifyInstance,
  deps: { readonly play: Play; readonly pool: Parameters<typeof quickTests>[1] },
): void {
  const quick = quickTests(deps.play, deps.pool);
  app.post('/api/v1/dev/quicktest', async (request, reply) => {
    const accountId = request.session?.accountId ?? null;
    if (accountId === null) return reply.status(401).send({ code: 'SIGN_IN_REQUIRED' });
    const parsed = quickTestBody.safeParse(request.body ?? {});
    if (!parsed.success) {
      const refusal = settingsRefusal(parsed.error);
      if (refusal !== null) return reply.status(422).send(refusal);
      return reply.status(400).send({ code: 'VALIDATION_FAILED' });
    }
    if (!deps.play.rounds.hasGame(parsed.data.gameId)) {
      return reply.status(422).send({ code: 'GAME_UNKNOWN' });
    }
    try {
      const started = await quick.start({ ...parsed.data, playerId: accountId });
      return await reply.status(201).send(started);
    } catch (error) {
      // Settings that do not fit the game: refused in its words, like the host's form.
      if (error instanceof PlayError) {
        return reply
          .status(422)
          .send({ code: error.code, detail: error.detail, field: error.field });
      }
      throw error;
    }
  });
}
