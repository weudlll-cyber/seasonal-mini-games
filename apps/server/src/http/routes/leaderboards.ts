/**
 * @file   apps/server/src/http/routes/leaderboards.ts
 * @module server/http
 * @brief  The boards over HTTP: periods, a board's pages, the viewer's neighbourhood, the team
 *         board, a player's profile, and the staff's leaderboard adjustment.
 *
 * Responsibility: anyone reads the boards and profiles (Bingo 05 §2.2, §2.4; 06 §1 adds
 *                 `/teams`); `/me` needs a signed-in account. An adjustment (`leaderboard.adjust`,
 *                 a reason of at least 3 characters) is written with the entry it changes in one
 *                 transaction and audited; it is public on the profile (Bingo 03 §11).
 * Depends on:     fastify, zod, @smg/application (audit), @smg/contracts, ../../db/pool,
 *                 ../../league/*, ./adminGuard
 * Used by:        ../app
 * Spec:           docs/spec/06-data-model-api-realtime.md §3.1, §3.2; Bingo 05 §2.4, §3
 */
import type { AuditLog } from '@smg/application';
import { AdjustmentBody, type LeaderboardPageView } from '@smg/contracts';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';

import { inTransaction, type DbPool } from '../../db/pool.js';
import { refreshEntries } from '../../league/awards.js';
import { boardAround, boardPage, period, periods, teamBoard } from '../../league/boards.js';
import { profile } from '../../league/profiles.js';
import { permitted } from './adminGuard.js';

const periodParams = z.object({ periodId: z.uuid() });
const pageQuery = z.object({ offset: z.coerce.number().int().min(0).max(1_000_000).default(0) });
const playerParams = z.object({ displayName: z.string().min(3).max(24) });

interface LeaderboardRouteDeps {
  readonly pool: DbPool;
  readonly audit: AuditLog;
}

// The period of the request, or a 404 answer (an id that is no uuid is no period either).
async function periodOr404(pool: DbPool, params: unknown, reply: FastifyReply) {
  const parsed = periodParams.safeParse(params);
  const found = parsed.success ? await period(pool, parsed.data.periodId) : null;
  if (found === null) await reply.status(404).send({ code: 'NOT_FOUND' });
  return found;
}

export function registerLeaderboardRoutes(app: FastifyInstance, deps: LeaderboardRouteDeps): void {
  const { pool } = deps;
  app.get('/api/v1/leaderboards', async () => ({ periods: await periods(pool) }));

  app.get('/api/v1/leaderboards/:periodId', async (request, reply) => {
    const p = await periodOr404(pool, request.params, reply);
    if (p === null) return reply;
    const q = pageQuery.safeParse(request.query);
    if (!q.success) return reply.status(400).send({ code: 'VALIDATION_FAILED' });
    const viewer = request.session?.accountId ?? null;
    const page = await boardPage(pool, p.id, q.data.offset, viewer);
    const view: LeaderboardPageView = { period: p, ...page };
    return view;
  });

  app.get('/api/v1/leaderboards/:periodId/me', async (request, reply) => {
    const viewer = request.session?.accountId ?? null;
    if (viewer === null) return reply.status(401).send({ code: 'SIGN_IN_REQUIRED' });
    const p = await periodOr404(pool, request.params, reply);
    if (p === null) return reply;
    return { period: p, rows: await boardAround(pool, p.id, viewer) };
  });

  app.get('/api/v1/leaderboards/:periodId/teams', async (request, reply) => {
    const p = await periodOr404(pool, request.params, reply);
    if (p === null) return reply;
    return { period: p, rows: await teamBoard(pool, p.id) };
  });

  app.get('/api/v1/players/:displayName', async (request, reply) => {
    const parsed = playerParams.safeParse(request.params);
    const found = parsed.success ? await profile(pool, parsed.data.displayName) : null;
    if (found === null) return reply.status(404).send({ code: 'NOT_FOUND' });
    return found;
  });

  registerAdjustmentRoute(app, deps);
}

function registerAdjustmentRoute(app: FastifyInstance, deps: LeaderboardRouteDeps): void {
  app.post('/api/v1/admin/leaderboard-adjustments', async (request, reply) => {
    const actor = await permitted(request, reply, 'leaderboard.adjust');
    if (actor === null) return reply;
    const parsed = AdjustmentBody.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ code: 'VALIDATION_FAILED' });
    const body = parsed.data;
    const target = await deps.pool.query<{ id: string }>(
      `SELECT id::text FROM smg.accounts WHERE display_name_key = $1 AND status <> 'deleted'`,
      [body.displayName],
    );
    const accountId = target.rows[0]?.id;
    const p = await period(deps.pool, body.periodId);
    if (accountId === undefined || p === null) return reply.status(404).send({ code: 'NOT_FOUND' });
    const id = await inTransaction(deps.pool, async (c) => {
      const r = await c.query<{ id: string }>(
        `INSERT INTO smg.leaderboard_adjustments (period_id, account_id, delta, reason, actor_account_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING id::text`,
        [p.id, accountId, body.delta, body.reason, actor.accountId],
      );
      await refreshEntries(c, { periods: new Set([p.id]), accounts: new Set([accountId]) });
      return r.rows[0]?.id ?? '';
    });
    await deps.audit.append(actor, {
      action: 'leaderboard.adjust',
      targetType: 'account',
      targetId: accountId,
      diff: { period: p.name, delta: body.delta, reason: body.reason },
    });
    return reply.status(201).send({ id });
  });
}
