/**
 * @file   apps/server/src/http/routes/devSignIn.ts
 * @module server/http
 * @brief  Development-only quick sign-in: host and three players without a password.
 *
 * Responsibility: POST /api/v1/dev/sign-in { as: 'host' | 'admin' | 'player-1' | 'player-2' |
 *                 'player-3' } creates on first use, or reuses, the account `dev-host`
 *                 (role organizer), `dev-admin` (super_admin) or `dev-player-N` and starts a
 *                 session for it, so the
 *                 owner can try host and players alone in several browser windows. The load
 *                 check signs in `load-0001` … `load-1100` the same way (`dev-load-NNNN`,
 *                 players) and removes them with DELETE /api/v1/dev/load-accounts. The app
 *                 registers this route only with SMG_DEV=1; a test proves a production build
 *                 answers 404. Which account a request names is the kit's check
 *                 (`devSignInAccount`: the body's own `as`, one of the accounts or a whole load
 *                 name); the accounts and the sessions are the game's.
 * Depends on:     fastify, @seasonal/kit/devtools (devSignInAccount), ../../auth/*,
 *                 ../../db/pool
 * Used by:        ../app
 * Spec:           Bingo 15 WP-09 (draft), Bingo 12 §8
 */
import { devSignInAccount } from '@seasonal/kit/devtools';
import type { FastifyInstance } from 'fastify';

import { deleteAccount, ensureDevAccount } from '../../auth/accounts.js';
import { setSessionCookie, type CookieConfig } from '../../auth/sessionPlugin.js';
import type { SessionEnds } from '../../auth/sessionEnds.js';
import { accountSessionIds, createSession, revokeSession } from '../../auth/sessions.js';
import type { DbPool } from '../../db/pool.js';

const DEV_ACCOUNTS = {
  host: { displayName: 'dev-host', roles: ['organizer'] },
  // The admin app (08) in development: every admin permission.
  admin: { displayName: 'dev-admin', roles: ['super_admin'] },
  'player-1': { displayName: 'dev-player-1', roles: [] },
  'player-2': { displayName: 'dev-player-2', roles: [] },
  'player-3': { displayName: 'dev-player-3', roles: [] },
} as const;

// The load check (load/) signs in numbered players: `load-0001` … `load-1100`.
const LOAD = /^load-\d{3,4}$/;

export function registerDevSignIn(
  app: FastifyInstance,
  deps: { readonly pool: DbPool; readonly cookie: CookieConfig; readonly sessionEnds: SessionEnds },
): void {
  app.post('/api/v1/dev/sign-in', async (request, reply) => {
    const who = devSignInAccount(request.body, { accounts: DEV_ACCOUNTS, load: LOAD });
    if (who === null) return reply.status(400).send({ code: 'VALIDATION_FAILED' });
    const accountId = await ensureDevAccount(deps.pool, who.displayName, who.roles);
    if (request.session !== null) {
      await revokeSession(deps.pool, request.session.id);
      deps.sessionEnds.end([request.session.id]);
    }
    const { token } = await createSession(deps.pool, accountId, 'dev quick sign-in');
    setSessionCookie(reply, deps.cookie, token);
    return reply.status(200).send({ accountId, displayName: who.displayName });
  });
  // The load check removes its accounts afterwards (their sessions and roles go with them).
  app.delete('/api/v1/dev/load-accounts', async (_request, reply) => {
    const rows = await deps.pool.query<{ id: string }>(
      `SELECT id FROM smg.accounts WHERE display_name LIKE 'dev-load-%'`,
    );
    for (const { id } of rows.rows) {
      const sessions = await accountSessionIds(deps.pool, id);
      await deleteAccount(deps.pool, id);
      deps.sessionEnds.end(sessions);
    }
    return reply.status(200).send({ deleted: rows.rows.length });
  });
}
