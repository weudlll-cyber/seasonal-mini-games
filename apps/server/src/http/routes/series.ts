/**
 * @file   apps/server/src/http/routes/series.ts
 * @module server/http
 * @brief  A series' host routes: the next round's settings, and Start next round now.
 *
 * Responsibility: 06 §3.1, 04 §4.8 rule 7. Only the match's host; a match that is no series is
 *                 409 NOT_A_SERIES. `PUT …/next-round` takes settings as `POST …/rounds` does
 *                 (the same body without `startNow`, the same per-setting check, 422
 *                 ROUND_SETTINGS_INVALID with the field and its sentence) and keeps them for
 *                 the next round. `POST …/next-round/start` runs the pending next step at once;
 *                 outside a pause it is 409 ROUND_RUNNING.
 * Depends on:     fastify, @smg/application (settings), ../../match/*, ./rounds (body, host check), ./settingsBody
 * Used by:        ./matches
 * Spec:           docs/spec/06-data-model-api-realtime.md §3.1; docs/spec/04-software-architecture.md §4.8 rule 7
 */
import { RoundSettingsError, type SettingsService } from '@smg/application';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { findMatch, type MatchRow } from '../../match/matches.js';
import type { Play } from '../../match/play.js';
import { rememberNext, type SeriesRunner } from '../../match/series.js';
import { createRoundBody, hostOf } from './rounds.js';
import { settingsRefusal } from './settingsBody.js';

export interface SeriesRouteDeps {
  readonly play: Play;
  readonly series: SeriesRunner;
  readonly settings: SettingsService;
  readonly pool: Parameters<typeof findMatch>[0];
}

const nextBody = createRoundBody.omit({ startNow: true });

// The match of the route, for its host only; null once the answer is sent.
async function hostMatch(
  deps: SeriesRouteDeps,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<MatchRow | null> {
  const match = await findMatch(deps.pool, (request.params as { code: string }).code);
  if ((await hostOf(request, reply, match)) === null || match === null) return null;
  if ((await deps.series.seriesOf(match)) === null) {
    await reply.status(409).send({ code: 'NOT_A_SERIES' });
    return null;
  }
  return match;
}

export function registerSeriesRoutes(app: FastifyInstance, deps: SeriesRouteDeps): void {
  app.put('/api/v1/matches/:code/next-round', async (request, reply) => {
    const body = nextBody.safeParse(request.body);
    if (!body.success) {
      const refusal = settingsRefusal(body.error);
      return refusal === null
        ? reply.status(400).send({ code: 'VALIDATION_FAILED' })
        : reply.status(422).send(refusal);
    }
    const match = await hostMatch(deps, request, reply);
    if (match === null) return reply;
    const doc = await deps.settings.view(`game.${match.gameId}`, []);
    try {
      deps.play.rounds.checkSettings(match.gameId, doc.overrides, body.data.settings);
    } catch (error) {
      if (!(error instanceof RoundSettingsError)) throw error;
      return reply
        .status(422)
        .send({ code: error.code, detail: error.message, field: error.field });
    }
    const season = body.data.season ?? null;
    await rememberNext(deps.pool, match.id, { choices: body.data.settings, season });
    return reply.status(204).send();
  });

  app.post('/api/v1/matches/:code/next-round/start', async (request, reply) => {
    const match = await hostMatch(deps, request, reply);
    if (match === null) return reply;
    const started = await deps.series.startNow(match);
    if (started === 'started') return reply.status(204).send();
    return reply
      .status(409)
      .send({ code: started === 'notInPause' ? 'ROUND_RUNNING' : 'NOT_A_SERIES' });
  });
}
