/**
 * @file   apps/server/src/http/routes/seasons.ts
 * @module server/http
 * @brief  The season routes: today's In Season answer and halving status; the admin's feed
 *         status, refresh and halving-day list.
 *
 * Responsibility: `GET /seasons/current` for anyone (06 §3.1); for `season.manage` the feed's
 *                 last answer and error, a refresh now, and the halving days with add and
 *                 remove. Every admin change is audited (06 §2.6).
 * Depends on:     fastify, zod, @smg/application (audit), ../../seasons/seasons, ./adminGuard
 * Used by:        ../app
 * Spec:           docs/spec/06-data-model-api-realtime.md §3.1, §3.2; docs/spec/07-integration.md §5
 */
import type { AuditLog } from '@smg/application';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { DbPool } from '../../db/pool.js';
import type { Seasons } from '../../seasons/seasons.js';
import { permitted } from './adminGuard.js';

const dayBody = z.object({ day: z.iso.date(), token: z.string().trim().min(1).max(40) }).strict();

interface SeasonRouteDeps {
  readonly pool: DbPool;
  readonly seasons: Seasons;
  readonly audit: AuditLog;
}

export function registerSeasonRoutes(app: FastifyInstance, deps: SeasonRouteDeps): void {
  registerFeedRoutes(app, deps);
  registerHalvingDayRoutes(app, deps);
}

function registerFeedRoutes(app: FastifyInstance, deps: SeasonRouteDeps): void {
  const { seasons, audit } = deps;

  app.get('/api/v1/seasons/current', async () => ({
    inSeason: await seasons.inSeason(),
    halvingToday: await seasons.halvingToday(),
  }));

  app.get('/api/v1/admin/seasons/feed', async (request, reply) => {
    if ((await permitted(request, reply, 'season.manage')) === null) return reply;
    return seasons.feedState();
  });

  app.post('/api/v1/admin/seasons/feed/refresh', async (request, reply) => {
    const actor = await permitted(request, reply, 'season.manage');
    if (actor === null) return reply;
    const result = await seasons.poll();
    await audit.append(actor, {
      action: 'seasons.feed.refresh',
      targetType: 'seasons',
      targetId: 'feed',
      diff: result,
    });
    return result;
  });
}

function registerHalvingDayRoutes(app: FastifyInstance, deps: SeasonRouteDeps): void {
  const { pool, audit } = deps;

  app.get('/api/v1/admin/halving-days', async (request, reply) => {
    if ((await permitted(request, reply, 'season.manage')) === null) return reply;
    const r = await pool.query<{ day: string; token: string; source: string }>(
      `SELECT to_char(day, 'YYYY-MM-DD') AS day, token, source FROM smg.halving_days ORDER BY day, token`,
    );
    return { days: r.rows };
  });

  app.post('/api/v1/admin/halving-days', async (request, reply) => {
    const actor = await permitted(request, reply, 'season.manage');
    if (actor === null) return reply;
    const body = dayBody.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ code: 'VALIDATION_FAILED' });
    // An admin entry replaces a feed entry for the same day and token (07 §5).
    await pool.query(
      `INSERT INTO smg.halving_days (day, token, source, created_by) VALUES ($1, $2, 'admin', $3)
       ON CONFLICT (day, token) DO UPDATE SET source = 'admin', created_by = $3`,
      [body.data.day, body.data.token, actor.accountId],
    );
    await audit.append(actor, {
      action: 'halvingDay.add',
      targetType: 'halvingDay',
      targetId: `${body.data.day}/${body.data.token}`,
      diff: body.data,
    });
    return reply.status(204).send();
  });

  app.delete('/api/v1/admin/halving-days/:day/:token', async (request, reply) => {
    const actor = await permitted(request, reply, 'season.manage');
    if (actor === null) return reply;
    const params = dayBody.safeParse(request.params);
    if (!params.success) return reply.status(400).send({ code: 'VALIDATION_FAILED' });
    const r = await pool.query('DELETE FROM smg.halving_days WHERE day = $1 AND token = $2', [
      params.data.day,
      params.data.token,
    ]);
    if (r.rowCount === 0) return reply.status(404).send({ code: 'NOT_FOUND' });
    await audit.append(actor, {
      action: 'halvingDay.remove',
      targetType: 'halvingDay',
      targetId: `${params.data.day}/${params.data.token}`,
      diff: params.data,
    });
    return reply.status(204).send();
  });
}
