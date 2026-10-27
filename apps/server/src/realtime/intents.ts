/**
 * @file   apps/server/src/realtime/intents.ts
 * @module server/realtime
 * @brief  Client → server intents with replay protection and limits (06 §4.3).
 *
 * Responsibility: every intent is `{ t, seq, data }`, answered `{ ok, data? }` or
 *                 `{ ok: false, code }`. `seq` must grow strictly per socket (REPLAYED) and a
 *                 socket sends at most 10 intents a second; both are checked when the intent
 *                 is read. `guessIntent` is synchronous up to the queue: shape, account, the
 *                 per-account limit and the round's queue, nothing awaited. The others:
 *                 match.watch / match.unwatch (at most 3 matches, a match player also joins
 *                 their own room and counts as connected, the host joins the host room),
 *                 time.sync, team.choose (an account with match.join, as over HTTP),
 *                 round.start / round.end / round.abort for the host.
 *                 Adapted from Bingo's intents.ts.
 * Depends on:     zod, socket.io (types), ../auth/rateLimit, ../match/*, ./gateway (types)
 * Used by:        ./gateway
 * Spec:           docs/spec/06-data-model-api-realtime.md §4.1–§4.3; docs/spec/05-security-threat-model.md §5
 */
import type { Reply } from '@smg/domain';
import type { Socket } from 'socket.io';
import { z } from 'zod';

import { RateLimiter } from '../auth/rateLimit.js';
import { activePlayers, findMatch, matchById, type MatchRow } from '../match/matches.js';
import { PlayError } from '../match/play.js';
import type { GatewayDeps, SocketData } from './gateway.js';

export interface IntentContext {
  readonly socket: Socket;
  readonly data: SocketData;
  readonly deps: GatewayDeps;
}

type Answer =
  | { readonly ok: true; readonly data?: unknown }
  | Reply
  | { readonly ok: false; readonly code: string };

const envelope = z.object({
  t: z.string().max(40),
  seq: z.number().int().nonnegative(),
  data: z.unknown(),
});
const codeData = z.object({ code: z.string().min(1).max(16) });
const guessData = z.object({ roundId: z.uuid(), value: z.number() }).strict();
const teamData = codeData.extend({ team: z.enum(['spring', 'summer', 'autumn', 'winter']) });
const roundData = z.object({
  roundId: z.uuid(),
  reason: z.string().trim().min(1).max(200).optional(),
});

// Every intent the gateway takes; the authorization tests cover each of them.
export const INTENT_TYPES = [
  'match.watch',
  'match.unwatch',
  'time.sync',
  'guess',
  'team.choose',
  'round.start',
  'round.end',
  'round.abort',
] as const;
export type IntentType = (typeof INTENT_TYPES)[number];
const isIntentType = (t: string): t is IntentType =>
  (INTENT_TYPES as readonly string[]).includes(t);

const MAX_ROOMS = 3;
const perSocket = new WeakMap<Socket, RateLimiter>();

export function envelopeOf(
  ctx: IntentContext,
  raw: unknown,
): { ok: true; t: IntentType; data: unknown } | { ok: false; code: string } {
  const parsed = envelope.safeParse(raw);
  if (!parsed.success) return { ok: false, code: 'VALIDATION_FAILED' };
  const { t, seq, data } = parsed.data;
  if (seq <= ctx.data.lastSeq) return { ok: false, code: 'REPLAYED' };
  ctx.data.lastSeq = seq;
  let limiter = perSocket.get(ctx.socket);
  if (limiter === undefined) {
    limiter = new RateLimiter({ limit: 10, windowMs: 1_000 });
    perSocket.set(ctx.socket, limiter);
  }
  if (!limiter.take('all').allowed) return { ok: false, code: 'RATE_LIMITED' };
  if (!isIntentType(t)) return { ok: false, code: 'UNKNOWN_INTENT' };
  return { ok: true, t, data };
}

export function guessIntent(ctx: IntentContext, raw: unknown): Promise<Answer> {
  const body = guessData.safeParse(raw);
  if (!body.success) return Promise.resolve({ ok: false, code: 'VALIDATION_FAILED' });
  const accountId = ctx.data.session.accountId;
  if (accountId === null) return Promise.resolve({ ok: false, code: 'NOT_IN_ROUND' });
  const round = ctx.deps.play.rounds.peek(body.data.roundId);
  if (round === null) return Promise.resolve({ ok: false, code: 'ROUND_NOT_OPEN' });
  const { limits } = ctx.deps;
  if (!limits.allow(accountId, accountId))
    return Promise.resolve({ ok: false, code: 'RATE_LIMITED' });
  return round.guess(accountId, { value: body.data.value }).then((answer) => {
    limits.noteReply(accountId, answer.ok ? undefined : answer.code);
    return answer;
  });
}

export async function handleIntent(
  ctx: IntentContext,
  t: Exclude<IntentType, 'guess'>,
  data: unknown,
): Promise<Answer> {
  try {
    return await dispatch(ctx, t, data);
  } catch (error) {
    if (error instanceof PlayError) return { ok: false, code: error.code };
    if (error instanceof z.ZodError) return { ok: false, code: 'VALIDATION_FAILED' };
    throw error;
  }
}

async function dispatch(
  ctx: IntentContext,
  t: Exclude<IntentType, 'guess'>,
  data: unknown,
): Promise<Answer> {
  switch (t) {
    case 'match.watch':
      return watch(ctx, codeData.parse(data).code);
    case 'match.unwatch':
      return unwatch(ctx, codeData.parse(data).code);
    case 'time.sync':
      return { ok: true, data: { serverTime: Date.now() } };
    case 'team.choose':
      return chooseTeam(ctx, teamData.parse(data));
    case 'round.start':
    case 'round.end':
    case 'round.abort':
      return hostRound(ctx, t, roundData.parse(data));
  }
}

// As over HTTP (POST /matches/:code/team): a signed-in account with match.join (05 §1).
async function chooseTeam(ctx: IntentContext, body: z.infer<typeof teamData>): Promise<Answer> {
  const { accountId, permissions } = ctx.data.session;
  if (accountId === null) return { ok: false, code: 'SIGN_IN_REQUIRED' };
  if (!permissions.includes('match.join')) return { ok: false, code: 'FORBIDDEN' };
  const match = await matchOr(ctx, body.code);
  if (match === null) return { ok: false, code: 'NOT_FOUND' };
  const ok = await ctx.deps.play.chooseTeam(match, accountId, body.team);
  return ok ? { ok: true } : { ok: false, code: 'NOT_IN_MATCH' };
}

async function matchOr(ctx: IntentContext, code: string): Promise<MatchRow | null> {
  return findMatch(ctx.deps.pool, code);
}

async function watch(ctx: IntentContext, code: string): Promise<Answer> {
  const session = ctx.data.session;
  if (!session.permissions.includes('match.watch')) return { ok: false, code: 'FORBIDDEN' };
  const match = await matchOr(ctx, code);
  if (match === null) return { ok: false, code: 'NOT_FOUND' };
  if (!ctx.data.rooms.has(match.id) && ctx.data.rooms.size >= MAX_ROOMS) {
    return { ok: false, code: 'TOO_MANY_ROOMS' };
  }
  if (ctx.data.rooms.has(match.id)) return { ok: true };
  await ctx.socket.join(`match:${match.id}`);
  const key = session.accountId;
  const isPlayer =
    key !== null && (await activePlayers(ctx.deps.pool, match.id)).some((p) => p.playerKey === key);
  if (key !== null && isPlayer) {
    await ctx.socket.join(`match:${match.id}:player:${key}`);
    ctx.deps.play.presence.enter(match.id, key);
    ctx.deps.play.changed(match.id);
  }
  if (key !== null && key === match.hostId) await ctx.socket.join(`match:${match.id}:host`);
  ctx.data.rooms.set(match.id, isPlayer ? key : null);
  return { ok: true, data: { matchId: match.id } };
}

async function unwatch(ctx: IntentContext, code: string): Promise<Answer> {
  const match = await matchOr(ctx, code);
  if (match === null || !ctx.data.rooms.has(match.id)) return { ok: true };
  const key = ctx.data.rooms.get(match.id) ?? null;
  if (key !== null) {
    ctx.deps.play.presence.leave(match.id, key);
    ctx.deps.play.changed(match.id);
  }
  ctx.data.rooms.delete(match.id);
  for (const room of [
    `match:${match.id}`,
    `match:${match.id}:player:${key ?? ''}`,
    `match:${match.id}:host`,
  ]) {
    await ctx.socket.leave(room);
  }
  return { ok: true };
}

async function hostRound(
  ctx: IntentContext,
  t: 'round.start' | 'round.end' | 'round.abort',
  body: z.infer<typeof roundData>,
): Promise<Answer> {
  // The match's host runs its rounds (DECISIONS T48).
  const round = await ctx.deps.play.rounds.get(body.roundId);
  const match = round === null ? null : await matchById(ctx.deps.pool, round.matchId);
  if (round === null || match === null) return { ok: false, code: 'NOT_FOUND' };
  if (match.hostId !== ctx.data.session.accountId) return { ok: false, code: 'NOT_THE_HOST' };
  if (t === 'round.start') return ctx.deps.play.startRound(match, round);
  if (t === 'round.end') return round.run({ type: 'end', reason: 'host' });
  if (body.reason === undefined) return { ok: false, code: 'VALIDATION_FAILED' };
  return round.run({ type: 'abort', reason: body.reason, by: 'host' });
}
