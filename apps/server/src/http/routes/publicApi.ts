/**
 * @file   apps/server/src/http/routes/publicApi.ts
 * @module server/http
 * @brief  The public read API for host widgets: open matches, a match's current round, the
 *         season board with the team board, a round's result.
 *
 * Responsibility: the four routes of 07 §1, unauthenticated, `Cache-Control: public,
 *                 max-age=60`, with CORS (no credentials) for every allowlisted embed origin;
 *                 display names only, never an account id; a result only once the round's end
 *                 is announced (under Frost after its delay, 03 §2.4), as `/rounds/:id/result`.
 * Depends on:     fastify, zod, @smg/contracts (views), ../../db/pool, ../../integration/*,
 *                 ../../league/boards, ../../round/rounds, ./cors
 * Used by:        ../app
 * Spec:           docs/spec/07-integration.md §1; Bingo 07 §7
 */
import type { PublicLeaderboardView, PublicRoundResultView } from '@smg/contracts';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import type { DbPool } from '../../db/pool.js';
import type { EmbedAllowlist } from '../../integration/embedOrigins.js';
import { currentRound, openMatches, placings } from '../../integration/publicQueries.js';
import { boardPage, periods, teamBoard } from '../../league/boards.js';
import type { Rounds } from '../../round/rounds.js';
import { allowCors } from './cors.js';

interface PublicApiDeps {
  readonly pool: DbPool;
  readonly embeds: EmbedAllowlist;
  readonly rounds: Rounds;
}

const matchQuery = z.object({ match: z.string().regex(/^[A-Z0-9]{6}$/) });
const limitQuery = z.object({ limit: z.coerce.number().int().min(1).max(50).default(10) });
const roundParams = z.object({ id: z.uuid() });

export function registerPublicApi(app: FastifyInstance, deps: PublicApiDeps): void {
  const { pool } = deps;
  // Every answer: cacheable for a minute, readable by the allowlisted sites.
  const shared = (request: FastifyRequest, reply: FastifyReply): void => {
    allowCors(request, reply, (o) => deps.embeds.allows(o), false);
    void reply.header('cache-control', 'public, max-age=60');
  };

  app.get('/api/v1/public/matches/open', async (request, reply) => {
    shared(request, reply);
    return { matches: await openMatches(pool) };
  });

  app.get('/api/v1/public/rounds/current', async (request, reply) => {
    shared(request, reply);
    const q = matchQuery.safeParse(request.query);
    const round = q.success ? await currentRound(pool, q.data.match) : null;
    if (round === null) return reply.status(404).send({ code: 'NOT_FOUND' });
    return round;
  });

  app.get('/api/v1/public/leaderboards/current', async (request, reply) => {
    shared(request, reply);
    const q = limitQuery.safeParse(request.query);
    if (!q.success) return reply.status(400).send({ code: 'VALIDATION_FAILED' });
    const season = (await periods(pool)).find((p) => p.kind === 'season' && p.status === 'active');
    if (season === undefined) return reply.status(404).send({ code: 'NOT_FOUND' });
    const page = await boardPage(pool, season.id, 0, null);
    const view: PublicLeaderboardView = {
      periodName: season.name,
      rows: page.rows.slice(0, q.data.limit).map(({ you: _you, ...row }) => row),
      teams: await teamBoard(pool, season.id),
    };
    return view;
  });

  app.get('/api/v1/public/rounds/:id/result', async (request, reply) => {
    shared(request, reply);
    const params = roundParams.safeParse(request.params);
    const round = params.success ? await deps.rounds.get(params.data.id) : null;
    if (round === null) return reply.status(404).send({ code: 'NOT_FOUND' });
    // Ended and announced, as the round's own result route (03 §2.4).
    if ((round.view(null) as { role: string }).role !== 'result') {
      return reply.status(409).send({ code: 'ROUND_NOT_ENDED' });
    }
    return resultOf(pool, round.id);
  });
}

async function resultOf(pool: DbPool, roundId: string): Promise<PublicRoundResultView> {
  const r = await pool.query<{ code: string; end_reason: string | null; status: string }>(
    `SELECT m.code, r.end_reason, r.status FROM smg.rounds r
     JOIN smg.matches m ON m.id = r.match_id WHERE r.id = $1`,
    [roundId],
  );
  const row = r.rows[0];
  const placed = await placings(pool, roundId);
  return {
    roundId,
    matchCode: row?.code ?? '',
    endReason: row?.end_reason ?? (row?.status === 'aborted' ? 'aborted' : null),
    winner: placed[0]?.name ?? null,
    placings: placed,
  };
}
