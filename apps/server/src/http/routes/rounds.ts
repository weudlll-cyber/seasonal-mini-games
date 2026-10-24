/**
 * @file   apps/server/src/http/routes/rounds.ts
 * @module server/http
 * @brief  Rounds over HTTP: create, start, end, abort, state, the guess fallback, result, verify.
 *
 * Responsibility: the round routes of 06 §3.1. The host (`round.manage`, and the match's
 *                 host) creates, starts, ends and aborts; anyone allowed to watch reads the
 *                 state (their own view, 02 §11); a roster player guesses through the same
 *                 queue and checks as the socket (the HTTP fallback, with its own rate limit);
 *                 the result and the proof only after the end. Codes map to 409 / 422 / 429.
 * Depends on:     fastify, zod, ../../match/*, ../../round/*, ./adminGuard
 * Used by:        ../app
 * Spec:           docs/spec/06-data-model-api-realtime.md §3.1, §4.3; docs/spec/02-game-guess-the-number.md §4, §10, §11
 */
import type { Reply } from '@smg/domain';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { displayNames, findMatch, matchById, type MatchRow } from '../../match/matches.js';
import { PlayError, type Play } from '../../match/play.js';
import type { GuessLimits } from '../../round/guessLimits.js';
import type { LiveRound } from '../../round/liveRound.js';
import type { PgRoundStore } from '../../round/pgRoundStore.js';
import { permitted } from './adminGuard.js';

const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
const createBody = z
  .object({
    settings: z.record(z.string(), z.unknown()).default({}),
    season: z.enum(SEASONS).optional(),
    startNow: z.boolean().default(false),
  })
  .strict();
const abortBody = z.object({ reason: z.string().trim().min(1).max(200) }).strict();

export interface RoundRouteDeps {
  readonly play: Play;
  readonly limits: GuessLimits;
  readonly store: PgRoundStore;
  readonly pool: Parameters<typeof findMatch>[0];
}

const STATUS: Record<string, number> = {
  ROUND_RUNNING: 409,
  NOT_A_HALVING_DAY: 409,
  IN_SEASON_UNAVAILABLE: 409,
  MATCH_CLOSED: 409,
  ROUND_SETTINGS_INVALID: 422,
  RATE_LIMITED: 429,
  ROUND_BUSY: 503,
  INTERNAL: 500,
};

export function sendReply(reply: FastifyReply, answer: Reply) {
  if (answer.ok) return reply.send(answer);
  return reply.status(STATUS[answer.code] ?? 409).send(answer);
}

async function roundOr404(deps: RoundRouteDeps, request: FastifyRequest, reply: FastifyReply) {
  const round = await deps.play.rounds.get((request.params as { id: string }).id).catch(() => null);
  if (round === null) await reply.status(404).send({ code: 'ROUND_NOT_FOUND' });
  return round;
}

// The match's host with round.manage, for the round's match.
async function hostOf(request: FastifyRequest, reply: FastifyReply, match: MatchRow | null) {
  const actor = await permitted(request, reply, 'round.manage');
  if (actor === null) return null;
  if (match === null) {
    await reply.status(404).send({ code: 'MATCH_NOT_FOUND' });
    return null;
  }
  if (match.hostId !== actor.accountId) {
    await reply.status(403).send({ code: 'NOT_THE_HOST' });
    return null;
  }
  return actor;
}

const announced = (round: LiveRound) => (round.view(null) as { role: string }).role === 'result';

export function registerRoundRoutes(app: FastifyInstance, deps: RoundRouteDeps): void {
  registerHostRoutes(app, deps);
  registerReadRoutes(app, deps);
}

function registerHostRoutes(app: FastifyInstance, deps: RoundRouteDeps): void {
  app.post('/api/v1/matches/:code/rounds', async (request, reply) => {
    const body = createBody.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ code: 'VALIDATION_FAILED' });
    const match = await findMatch(deps.pool, (request.params as { code: string }).code);
    const actor = await hostOf(request, reply, match);
    if (actor === null || match === null) return reply;
    try {
      const round = await deps.play.createRound(match, actor.accountId, {
        choices: body.data.settings,
        season: body.data.season,
      });
      if (body.data.startNow) await deps.play.startRound(match, round);
      return await reply.status(201).send({ id: round.id, status: round.status() });
    } catch (error) {
      if (!(error instanceof PlayError)) throw error;
      return reply
        .status(STATUS[error.code] ?? 409)
        .send({ code: error.code, detail: error.detail });
    }
  });

  const hostCommand = (
    path: string,
    run: (round: LiveRound, match: MatchRow, body: unknown) => Promise<Reply>,
  ) => {
    app.post(`/api/v1/rounds/:id/${path}`, async (request, reply) => {
      const round = await roundOr404(deps, request, reply);
      if (round === null) return reply;
      const match = await matchById(deps.pool, round.matchId);
      if ((await hostOf(request, reply, match)) === null || match === null) return reply;
      return sendReply(reply, await run(round, match, request.body));
    });
  };
  hostCommand('start', (round, match) => deps.play.startRound(match, round));
  hostCommand('end', (round) => round.run({ type: 'end', reason: 'host' }));
  hostCommand('abort', (round, _m, body) => {
    const parsed = abortBody.safeParse(body);
    if (!parsed.success) return Promise.resolve({ ok: false, code: 'VALIDATION_FAILED' });
    return round.run({ type: 'abort', reason: parsed.data.reason, by: 'host' });
  });
}

function registerReadRoutes(app: FastifyInstance, deps: RoundRouteDeps): void {
  app.get('/api/v1/rounds/:id/state', async (request, reply) => {
    // Guests watch too: a session with match.watch, with or without an account.
    if (request.session?.permissions.includes('match.watch') !== true) {
      return reply.status(401).send({ code: 'SIGN_IN_REQUIRED' });
    }
    const round = await roundOr404(deps, request, reply);
    if (round === null) return reply;
    const view = round.view(request.session.accountId) as {
      roster: { playerKey: string }[];
    };
    const names = await displayNames(
      deps.pool,
      view.roster.map((r) => r.playerKey),
    );
    return { ...view, names };
  });

  app.post('/api/v1/rounds/:id/guesses', async (request, reply) => {
    const s = request.session;
    if (s?.accountId == null) return reply.status(401).send({ code: 'SIGN_IN_REQUIRED' });
    const round = await roundOr404(deps, request, reply);
    if (round === null) return reply;
    if (!deps.limits.allow(s.accountId, s.accountId, s.id)) {
      return sendReply(reply, { ok: false, code: 'RATE_LIMITED' });
    }
    const answer = await round.guess(s.accountId, request.body);
    deps.limits.noteReply(s.accountId, answer.ok ? undefined : answer.code);
    return sendReply(reply, answer);
  });

  app.get('/api/v1/rounds/:id/result', async (request, reply) => {
    const round = await roundOr404(deps, request, reply);
    if (round === null) return reply;
    // Ended and announced: under Frost a win is shown only after the delay (03 §2.4).
    if (!announced(round)) return reply.status(409).send({ code: 'ROUND_NOT_ENDED' });
    return round.view(null);
  });

  app.get('/api/v1/rounds/:id/verify', async (request, reply) => {
    const round = await roundOr404(deps, request, reply);
    if (round === null) return reply;
    // Ended and announced: under Frost a win is shown only after the delay (03 §2.4).
    if (!announced(round)) return reply.status(409).send({ code: 'ROUND_NOT_ENDED' });
    const log = await deps.store.log(round.id);
    const verified = round.verify(log);
    if (!verified.ok) return reply.status(409).send({ code: 'NO_PROOF', detail: verified.problem });
    // Seed, settings, roster and the accepted guesses in receive order (06 §3.1).
    const shown = log.filter((e) =>
      ['RoundCreated', 'CountdownStarted', 'GuessAccepted', 'RoundEnded'].includes(e.type),
    );
    return { ok: true, secrets: verified.secrets, events: shown.map((e) => e.event) };
  });
}
