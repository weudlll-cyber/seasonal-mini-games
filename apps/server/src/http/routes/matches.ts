/**
 * @file   apps/server/src/http/routes/matches.ts
 * @module server/http
 * @brief  Games and matches over HTTP: list, open, summary, join, leave, team, close, abort.
 *
 * Responsibility: the match routes of 06 §3.1 with their permissions (`match.create` to
 *                 open, `match.join` to join, the host for close and abort), every body
 *                 validated with zod. A summary tells the viewer whether they host or play,
 *                 names the players, and gives the host the next round's defaults (the
 *                 host-chosen keys of the game's document).
 * Depends on:     fastify, zod, @smg/application, ../../match/*, ./adminGuard
 * Used by:        ../app
 * Spec:           docs/spec/06-data-model-api-realtime.md §3.1; docs/spec/02-game-guess-the-number.md §2
 */
import type { SettingsService } from '@smg/application';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import {
  activePlayers,
  displayNames,
  findMatch,
  listMatches,
  myMatches,
  openMatch,
  type MatchRow,
} from '../../match/matches.js';
import { PlayError, type Play } from '../../match/play.js';
import { permitted } from './adminGuard.js';

const TEAMS = ['spring', 'summer', 'autumn', 'winter'] as const;
const openBody = z
  .object({
    gameId: z.string().min(1).max(40),
    title: z.string().trim().min(1).max(80),
    visibility: z.enum(['public', 'unlisted']).default('public'),
    maxPlayers: z.number().int().min(2).max(1_000),
    countsForLeaderboard: z.boolean().default(true),
  })
  .strict();
const listQuery = z.object({
  status: z.enum(['lobby', 'open', 'closed', 'aborted']).optional(),
  game: z.string().max(40).optional(),
});
const teamBody = z.object({ team: z.enum(TEAMS) }).strict();
const abortBody = z.object({ reason: z.string().trim().min(1).max(200) }).strict();

export interface MatchRouteDeps {
  readonly play: Play;
  readonly settings: SettingsService;
  readonly pool: Parameters<typeof findMatch>[0];
}

export function summaryOf(m: MatchRow) {
  return {
    code: m.code,
    gameId: m.gameId,
    title: m.title,
    status: m.status,
    visibility: m.visibility,
    maxPlayers: m.maxPlayers,
    countsForLeaderboard: m.countsForLeaderboard,
    createdAt: m.createdAt,
  };
}

async function matchOr404(deps: MatchRouteDeps, code: string, reply: FastifyReply) {
  const match = await findMatch(deps.pool, code);
  if (match === null) await reply.status(404).send({ code: 'MATCH_NOT_FOUND' });
  return match;
}

export function registerMatchRoutes(app: FastifyInstance, deps: MatchRouteDeps): void {
  app.get('/api/v1/games', () => ({ games: deps.play.rounds.games() }));

  app.get('/api/v1/matches', async (request, reply) => {
    const q = listQuery.safeParse(request.query);
    if (!q.success) return reply.status(400).send({ code: 'VALIDATION_FAILED' });
    return { matches: (await listMatches(deps.pool, q.data)).map(summaryOf) };
  });

  app.post('/api/v1/matches', async (request, reply) => {
    const actor = await permitted(request, reply, 'match.create');
    if (actor === null) return reply;
    const body = openBody.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ code: 'VALIDATION_FAILED' });
    if (!deps.play.rounds.hasGame(body.data.gameId)) {
      return reply.status(422).send({ code: 'GAME_UNKNOWN' });
    }
    const limit = (await deps.settings.values('matchmaking'))['match.maxPlayers'] as number;
    if (body.data.maxPlayers > limit)
      return reply.status(422).send({ code: 'MATCH_TOO_LARGE', limit });
    const match = await openMatch(deps.pool, { ...body.data, hostId: actor.accountId });
    return reply.status(201).send(summaryOf(match));
  });

  app.get('/api/v1/matches/:code', async (request, reply) => {
    const match = await matchOr404(deps, (request.params as { code: string }).code, reply);
    if (match === null) return reply;
    return matchDetails(deps, match, request);
  });

  app.get('/api/v1/me/matches', async (request, reply) => {
    const s = request.session;
    if (s?.accountId == null) return reply.status(401).send({ code: 'SIGN_IN_REQUIRED' });
    return { matches: (await myMatches(deps.pool, s.accountId)).map(summaryOf) };
  });

  registerPlayerRoutes(app, deps);
  registerHostRoutes(app, deps);
}

async function matchDetails(deps: MatchRouteDeps, match: MatchRow, request: FastifyRequest) {
  const viewer = request.session?.accountId ?? null;
  const players = await activePlayers(deps.pool, match.id);
  const names = await displayNames(deps.pool, [
    ...players.map((p) => p.playerKey),
    match.hostId ?? '',
  ]);
  const round = await deps.play.runningRound(match);
  const youHost = viewer !== null && viewer === match.hostId;
  return {
    ...summaryOf(match),
    youHost,
    youPlayer: players.some((p) => p.playerKey === viewer),
    host: match.hostId === null ? null : (names[match.hostId] ?? null),
    players: players.map((p) => ({
      playerKey: p.playerKey,
      name: names[p.playerKey] ?? p.playerKey,
      team: p.team,
    })),
    connected: [...deps.play.presence.connected(match.id)],
    round: round === null ? null : { id: round.id, status: round.status() },
    nextRoundDefaults: youHost ? await deps.settings.view(`game.${match.gameId}`, []) : null,
  };
}

function registerPlayerRoutes(app: FastifyInstance, deps: MatchRouteDeps): void {
  app.post('/api/v1/matches/:code/join', async (request, reply) => {
    const actor = await permitted(request, reply, 'match.join');
    if (actor === null) return reply;
    const match = await matchOr404(deps, (request.params as { code: string }).code, reply);
    if (match === null) return reply;
    const joined = await deps.play.join(match, {
      key: actor.accountId,
      accountId: actor.accountId,
    });
    if (joined !== 'joined') return reply.status(409).send({ code: joined });
    return reply.status(204).send();
  });

  app.post('/api/v1/matches/:code/leave', async (request, reply) => {
    const actor = await permitted(request, reply, 'match.join');
    if (actor === null) return reply;
    const match = await matchOr404(deps, (request.params as { code: string }).code, reply);
    if (match === null) return reply;
    await deps.play.leave(match, actor.accountId);
    return reply.status(204).send();
  });

  app.post('/api/v1/matches/:code/team', async (request, reply) => {
    const actor = await permitted(request, reply, 'match.join');
    if (actor === null) return reply;
    const body = teamBody.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ code: 'VALIDATION_FAILED' });
    const match = await matchOr404(deps, (request.params as { code: string }).code, reply);
    if (match === null) return reply;
    try {
      const ok = await deps.play.chooseTeam(match, actor.accountId, body.data.team);
      if (ok) return await reply.status(204).send();
      return await reply.status(409).send({ code: 'NOT_IN_MATCH' });
    } catch (error) {
      if (error instanceof PlayError) return reply.status(409).send({ code: error.code });
      throw error;
    }
  });
}

function registerHostRoutes(app: FastifyInstance, deps: MatchRouteDeps): void {
  const hostOnly = async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = await permitted(request, reply, 'match.manage');
    if (actor === null) return null;
    const match = await matchOr404(deps, (request.params as { code: string }).code, reply);
    if (match === null) return null;
    if (match.hostId !== actor.accountId) {
      await reply.status(403).send({ code: 'NOT_THE_HOST' });
      return null;
    }
    return match;
  };

  app.post('/api/v1/matches/:code/close', async (request, reply) => {
    const match = await hostOnly(request, reply);
    if (match === null) return reply;
    await deps.play.close(match);
    return reply.status(204).send();
  });

  app.post('/api/v1/matches/:code/abort', async (request, reply) => {
    const body = abortBody.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ code: 'VALIDATION_FAILED' });
    const match = await hostOnly(request, reply);
    if (match === null) return reply;
    await deps.play.close(match, { reason: body.data.reason, by: 'host' });
    return reply.status(204).send();
  });
}
