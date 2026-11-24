/**
 * @file   apps/server/src/http/routes/openRounds.ts
 * @module server/http
 * @brief  GET /api/public/open-rounds: the open sign-ups the hosts show on the website (O124).
 *
 * Responsibility: public, no sign-in, JSON, `Cache-Control: public, max-age=30`: version 1 of
 *                 the contract the website reads from every embedded game (its
 *                 docs/OPEN-ROUNDS.md), checked and capped by the kit's `openRoundsPage` (a
 *                 round the website would drop is left out), at the stable path the
 *                 website derives for Mini Games, `/games/mini-games/api/public/open-rounds` on
 *                 its own origin. At most 20 matches open for joining now that their host shows
 *                 on the website, never a Quick Test (../../match/website): id the match code,
 *                 the title, kind "Seasonal Mini Games · <game>" (the game's name without its
 *                 leading "Seasonal ", so every entry stays within the contract's 40 characters),
 *                 the next round's opening or null, no sign-up deadline (null), the player
 *                 counts, and the join URL: the match's page under the configured public address
 *                 (SMG_PUBLIC_URL), in development the request's own host. No player names.
 * Depends on:     fastify, @seasonal/kit/server (openRoundsPage), ../../db/pool, ../../match/website,
 *                 ../../round/rounds
 * Used by:        ../app
 * Spec:           docs/spec/07-integration.md §8
 */
import {
  OPEN_ROUNDS_CACHE_CONTROL,
  openRoundsPage,
  type OpenRoundInput,
  type OpenRoundsPage,
} from '@seasonal/kit/server';
import type { FastifyInstance } from 'fastify';

import type { DbPool } from '../../db/pool.js';
import { listedMatches, type ListedMatch } from '../../match/website.js';
import type { Rounds } from '../../round/rounds.js';

interface OpenRoundsDeps {
  readonly pool: DbPool;
  readonly rounds: Rounds;
  // The game's public address, e.g. https://example.org/games/mini-games/; undefined in
  // development (the request's own host is used).
  readonly publicUrl: string | undefined;
}

// The game's name in the kind, within the contract's 40 characters (O124).
const kindOf = (name: string): string => `Seasonal Mini Games · ${name.replace(/^Seasonal /, '')}`;

const withSlash = (url: string): string => (url.endsWith('/') ? url : `${url}/`);

function entryOf(m: ListedMatch, page: string, name: string): OpenRoundInput {
  return {
    id: m.code,
    title: m.title,
    kind: kindOf(name),
    startsAt: m.startsAt,
    signupClosesAt: null,
    players: m.players,
    maxPlayers: m.maxPlayers,
    joinUrl: `${page}#/match/${encodeURIComponent(m.code)}`,
  };
}

export function registerOpenRounds(app: FastifyInstance, deps: OpenRoundsDeps): void {
  app.get('/api/public/open-rounds', async (request, reply): Promise<OpenRoundsPage> => {
    const page = withSlash(deps.publicUrl ?? `https://${request.hostname}/`);
    const names = new Map(deps.rounds.games().map((g) => [g.id, g.name]));
    const listed = await listedMatches(deps.pool);
    void reply.header('cache-control', OPEN_ROUNDS_CACHE_CONTROL);
    const rounds = listed.map((m) => entryOf(m, page, names.get(m.gameId) ?? m.gameId));
    return openRoundsPage(rounds, { origin: page });
  });
}
