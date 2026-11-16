/**
 * @file   apps/server/test/authzChecks.ts
 * @module server/test
 * @brief  How the authorization matrix reads an answer, and the writes its CSRF test sends.
 *
 * Responsibility: the refusals (an HTTP status with its code; an intent answers the code
 *                 alone) and one write of each route group for the CSRF check, picked from
 *                 the route table (./authzTable).
 * Depends on:     ./authzTable
 * Used by:        ./authzMatrix.integration.test
 * Spec:           docs/spec/09-testing-strategy.md §6
 */
import { ROUTES, type RouteCase } from './authzTable.js';

// The refusals: HTTP status with its code; an intent answers the code alone.
export const REFUSALS: Readonly<Record<string, number>> = {
  SIGN_IN_REQUIRED: 401,
  FORBIDDEN: 403,
  NOT_THE_HOST: 403,
  CSRF_INVALID: 403,
  NOT_IN_ROUND: 409,
  UNTRUSTED_PROXY: 403,
};

// One write of each route group, refused without the session's CSRF token or with another's.
export const CSRF_WRITES: readonly RouteCase[] = ROUTES.filter((r) =>
  [
    'POST /api/v1/auth/logout',
    'DELETE /api/v1/me',
    'POST /api/v1/me/password',
    'POST /api/v1/dev/quicktest',
    'PUT /api/v1/admin/settings/:id',
    'POST /api/v1/admin/accounts/:id/suspend',
    'POST /api/v1/matches',
    'POST /api/v1/matches/:code/rounds',
    'POST /api/v1/matches/:code/team',
    'POST /api/v1/rounds/:id/start',
    'POST /api/v1/rounds/:id/guesses',
    'POST /api/v1/admin/halving-days',
    'POST /api/v1/admin/leaderboard-adjustments',
    'POST /api/v1/chat/messages/:id/report',
    'POST /api/v1/admin/chat/sanctions',
    'POST /api/v1/admin/embed-origins',
    'POST /api/v1/admin/webhooks',
  ].includes(`${r.method} ${r.path}`),
);
