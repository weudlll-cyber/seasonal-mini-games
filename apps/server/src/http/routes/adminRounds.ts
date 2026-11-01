/**
 * @file   apps/server/src/http/routes/adminRounds.ts
 * @module server/http
 * @brief  Staff routes of live rounds: the live list, the staff view, abort, kick, result removal.
 *
 * Responsibility: GET /api/v1/admin/rounds/live (`admin.view`: counts only, no secret); GET
 *                 …/rounds/:id (`admin.view`: the view of a viewer off the roster, as the
 *                 round state route gives it, with names, the match, its active players and
 *                 the removed results); POST …/rounds/:id/abort (`match.abort`, a reason: the
 *                 round's own abort path with `by: staff`, and players read "by staff (reason)");
 *                 POST …/matches/:id/kick (`match.manage`, player and reason: the player leaves
 *                 as `kicked`; an organizer without `admin.view` only in their own match); POST
 *                 …/rounds/:id/results/:playerKey/remove (`leaderboard.adjust`, a reason, after
 *                 the end: standings and league awards without that result). Every action is
 *                 audited with its reason.
 * Depends on:     fastify, @smg/application, @smg/contracts, ../../admin/liveRounds,
 *                 ../../league/rules, ../../match/*, ../../db/pool, ./adminGuard, ./rounds
 * Used by:        ../app
 * Spec:           docs/spec/06-data-model-api-realtime.md §3.2; Bingo 11 §1, §3.2; Bingo 05 §3
 */
import type { AuditLog, SettingsService } from '@smg/application';
import { KickBody, ReasonBody } from '@smg/contracts';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { liveRounds, removedKeys, removeResult } from '../../admin/liveRounds.js';
import type { DbPool } from '../../db/pool.js';
import { leagueRules } from '../../league/rules.js';
import { activePlayers, displayNames, matchById } from '../../match/matches.js';
import type { Play } from '../../match/play.js';
import { permitted } from './adminGuard.js';
import { sendReply } from './rounds.js';

interface Deps {
  readonly play: Play;
  readonly pool: DbPool;
  readonly audit: AuditLog;
  readonly settings: SettingsService;
}

const REMOVAL_STATUS = { RESULT_NOT_FOUND: 404, ALREADY_REMOVED: 409 } as const;

// What players read when staff abort their round (the player client shows the reason).
const staffReason = (reason: string) => `by staff (${reason})`;

async function roundOf(deps: Deps, request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const round = await deps.play.rounds.get(id).catch(() => null);
  if (round === null) await reply.status(404).send({ code: 'ROUND_NOT_FOUND' });
  return round;
}

export function registerAdminRounds(app: FastifyInstance, deps: Deps): void {
  app.get('/api/v1/admin/rounds/live', async (request, reply) => {
    if ((await permitted(request, reply, 'admin.view')) === null) return reply;
    return { items: await liveRounds(deps.pool, deps.play) };
  });
  app.get('/api/v1/admin/rounds/:id', async (request, reply) => {
    if ((await permitted(request, reply, 'admin.view')) === null) return reply;
    const round = await roundOf(deps, request, reply);
    if (round === null) return reply;
    const match = await matchById(deps.pool, round.matchId);
    const view = round.view(null) as { roster: { playerKey: string }[] };
    const players = (await activePlayers(deps.pool, round.matchId)).map((p) => p.playerKey);
    const keys = [...new Set([...view.roster.map((r) => r.playerKey), ...players])];
    return {
      ...view,
      names: await displayNames(deps.pool, keys),
      match: { id: round.matchId, code: match?.code ?? '', title: match?.title ?? '' },
      players,
      removed: await removedKeys(deps.pool, round.id),
    };
  });
  app.post('/api/v1/admin/rounds/:id/abort', async (request, reply) => {
    const actor = await permitted(request, reply, 'match.abort');
    if (actor === null) return reply;
    const parsed = ReasonBody.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ code: 'VALIDATION_FAILED' });
    const round = await roundOf(deps, request, reply);
    if (round === null) return reply;
    const { reason } = parsed.data;
    const answer = await round.run({ type: 'abort', reason: staffReason(reason), by: 'staff' });
    if (answer.ok) {
      await deps.audit.append(actor, {
        action: 'round.abort',
        targetType: 'round',
        targetId: round.id,
        diff: { reason, matchId: round.matchId },
      });
    }
    return sendReply(reply, answer);
  });
  registerKick(app, deps);
  registerRemoval(app, deps);
}

function registerKick(app: FastifyInstance, deps: Deps): void {
  app.post('/api/v1/admin/matches/:id/kick', async (request, reply) => {
    const actor = await permitted(request, reply, 'match.manage');
    if (actor === null) return reply;
    const parsed = KickBody.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ code: 'VALIDATION_FAILED' });
    const { id } = request.params as { id: string };
    const match = await matchById(deps.pool, id).catch(() => null);
    if (match === null) return reply.status(404).send({ code: 'MATCH_NOT_FOUND' });
    // An organizer holds match.manage for their own matches; staff (admin.view) for any.
    if (!actor.permissions.includes('admin.view') && match.hostId !== actor.accountId) {
      return reply.status(403).send({ code: 'NOT_THE_HOST' });
    }
    const { playerKey, reason } = parsed.data;
    if (!(await deps.play.kick(match, playerKey))) {
      return reply.status(404).send({ code: 'PLAYER_NOT_FOUND' });
    }
    await deps.audit.append(actor, {
      action: 'match.kick',
      targetType: 'match',
      targetId: match.id,
      diff: { playerKey, reason },
    });
    return { kicked: playerKey };
  });
}

function registerRemoval(app: FastifyInstance, deps: Deps): void {
  app.post('/api/v1/admin/rounds/:id/results/:playerKey/remove', async (request, reply) => {
    const actor = await permitted(request, reply, 'leaderboard.adjust');
    if (actor === null) return reply;
    const parsed = ReasonBody.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ code: 'VALIDATION_FAILED' });
    const round = await roundOf(deps, request, reply);
    if (round === null) return reply;
    if (round.status() !== 'ended') return reply.status(409).send({ code: 'ROUND_NOT_ENDED' });
    const { playerKey } = request.params as { playerKey: string };
    const { reason } = parsed.data;
    const result = await removeResult(deps.pool, {
      roundId: round.id,
      playerKey,
      reason,
      by: actor.accountId,
      rules: await leagueRules(deps.settings),
    });
    if (result !== 'removed') return reply.status(REMOVAL_STATUS[result]).send({ code: result });
    await deps.audit.append(actor, {
      action: 'round.result.remove',
      targetType: 'round',
      targetId: round.id,
      diff: { playerKey, reason },
    });
    // The match room reloads its standings.
    deps.play.changed(round.matchId);
    return { removed: await removedKeys(deps.pool, round.id) };
  });
}
