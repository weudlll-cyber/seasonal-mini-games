/**
 * @file   apps/server/test/authzTable.ts
 * @module server/test
 * @brief  The authorization matrix as data: every HTTP route and WS intent with the callers
 *         that may use it.
 *
 * Responsibility: the kinds of caller (anonymous, guest, a player, a player of the match,
 *                 another host, the match's host, the super admin, a moderator, a game admin
 *                 and a staff-only security admin) and, for each route the server registers
 *                 and each intent of the gateway, the callers that get through. Every body is
 *                 chosen so a call that gets through changes as little as possible: invalid
 *                 after the permission check, a round that has ended, a match kept for
 *                 closing, a target that does not exist. Adapted from Bingo's matrix tables.
 * Depends on:     nothing
 * Used by:        ./authzMatrix.integration.test
 * Spec:           docs/spec/05-security-threat-model.md §1; docs/spec/09-testing-strategy.md §6;
 *                 docs/spec/06-data-model-api-realtime.md §3, §4.3; docs/DECISIONS.md S10
 */

export type Role =
  | 'anonymous'
  | 'guest'
  | 'player'
  | 'matchPlayer'
  | 'otherHost'
  | 'host'
  | 'admin'
  | 'moderator'
  | 'gameAdmin'
  | 'securityAdmin';

export const ROLES: readonly Role[] = [
  'anonymous',
  'guest',
  'player',
  'matchPlayer',
  'otherHost',
  'host',
  'admin',
  'moderator',
  'gameAdmin',
  'securityAdmin',
];
const not = (...out: Role[]) => ROLES.filter((r) => !out.includes(r));
const ALL = ROLES;
export const SESSION = not('anonymous');
const ACCOUNTS = not('anonymous', 'guest');
// The security admin is staff only (no player role): it holds neither match.join nor match.watch.
const JOINERS = not('anonymous', 'guest', 'securityAdmin');
const WATCHERS = not('anonymous', 'securityAdmin');
const CREATORS: readonly Role[] = ['otherHost', 'host', 'admin', 'gameAdmin'];
const HOST: readonly Role[] = ['host'];
// The roster of the running round: the host plays along (O16, S10) with the match's player.
const ROSTER: readonly Role[] = ['host', 'matchPlayer'];
const ADMIN_VIEW: readonly Role[] = ['admin', 'moderator', 'gameAdmin', 'securityAdmin'];
const AUDIT: readonly Role[] = ['admin', 'securityAdmin'];
const ABUSE: readonly Role[] = ['admin', 'moderator', 'securityAdmin'];
const SUSPEND: readonly Role[] = ['admin', 'securityAdmin'];
const ROLE_ASSIGN: readonly Role[] = ['admin'];
const SEASONS: readonly Role[] = ['admin', 'gameAdmin'];
const ADJUST: readonly Role[] = ['admin', 'moderator'];
const ABORT: readonly Role[] = ['admin', 'moderator', 'gameAdmin'];
// match.manage: organizers (in their own match only, checked after the match is found) and staff.
const MANAGE: readonly Role[] = ['otherHost', 'host', 'admin', 'gameAdmin'];
const MODERATE: readonly Role[] = ['admin', 'moderator', 'gameAdmin'];

// Which match or round a path names: `:code` is the host's match with the running round
// (`spare`: a second match of the host, kept for closing, joining and leaving); `:id` of a
// round is the ended round of that match (`live`: the running round).
export interface RouteCase {
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  readonly path: string;
  readonly body?: object;
  readonly allow: readonly Role[];
  readonly on?: 'spare' | 'live';
  // Only when the server serves the built client (SMG_WEB_DIR, as in the image).
  readonly web?: true;
  // Only in a development build (SMG_DEV=1).
  readonly dev?: true;
}

const NO_ONE = '00000000-0000-4000-8000-000000000000';
export const PERIOD = ':periodId';

// Every route the server registers. Order matters where a call changes something: the spare
// match is closed (by its host) before players join and leave it.
export const ROUTES: readonly RouteCase[] = [
  { method: 'GET', path: '/', allow: ALL },
  { method: 'GET', path: '/admin', allow: ALL, web: true },
  { method: 'GET', path: '/admin/', allow: ALL, web: true },
  { method: 'GET', path: '/admin/*', allow: ALL, web: true },
  { method: 'GET', path: '/*', allow: ALL, web: true },
  { method: 'GET', path: '/healthz', allow: ALL },
  { method: 'GET', path: '/readyz', allow: ALL },
  { method: 'GET', path: '/metrics', allow: ALL },
  { method: 'GET', path: '/api/v1/session', allow: ALL },
  // Session starters take no CSRF token; the bodies are refused before anything is made.
  { method: 'POST', path: '/api/v1/auth/register', body: {}, allow: ALL },
  {
    method: 'POST',
    path: '/api/v1/auth/login',
    body: { email: 'x@example.com', password: 'x' },
    allow: ALL,
  },
  { method: 'POST', path: '/api/v1/auth/guest', body: {}, allow: ALL },
  { method: 'POST', path: '/api/v1/auth/logout', body: {}, allow: SESSION },
  { method: 'DELETE', path: '/api/v1/me', body: { password: 'not the password' }, allow: ACCOUNTS },
  {
    method: 'POST',
    path: '/api/v1/me/password',
    body: { current: 'x', next: 'y' },
    allow: ACCOUNTS,
  },
  { method: 'GET', path: '/api/v1/me/matches', allow: ACCOUNTS },
  { method: 'POST', path: '/api/v1/dev/sign-in', body: { as: 'nobody' }, allow: ALL, dev: true },
  // Development only and outside any session: the load check's cleanup (no load account here).
  { method: 'DELETE', path: '/api/v1/dev/load-accounts', allow: ALL, dev: true },
  { method: 'POST', path: '/api/v1/dev/quicktest', body: { bots: 0 }, allow: ACCOUNTS, dev: true },
  { method: 'GET', path: '/api/v1/admin/settings', allow: ADMIN_VIEW },
  { method: 'GET', path: '/api/v1/admin/settings/:id', allow: ADMIN_VIEW },
  { method: 'PUT', path: '/api/v1/admin/settings/:id', body: {}, allow: ADMIN_VIEW },
  { method: 'GET', path: '/api/v1/admin/settings/:id/versions', allow: ADMIN_VIEW },
  { method: 'POST', path: '/api/v1/admin/settings/:id/rollback', body: {}, allow: ADMIN_VIEW },
  { method: 'GET', path: '/api/v1/admin/rounds/live', allow: ADMIN_VIEW },
  { method: 'GET', path: '/api/v1/admin/rounds/:id', allow: ADMIN_VIEW },
  { method: 'POST', path: '/api/v1/admin/rounds/:id/abort', body: {}, allow: ABORT },
  { method: 'POST', path: '/api/v1/admin/matches/:id/kick', body: {}, allow: MANAGE },
  {
    method: 'POST',
    path: '/api/v1/admin/rounds/:id/results/:playerKey/remove',
    body: {},
    allow: ADJUST,
  },
  { method: 'GET', path: '/api/v1/me/2fa', allow: ACCOUNTS },
  // Setup draws an unconfirmed factor only; the code routes refuse the empty body.
  { method: 'POST', path: '/api/v1/me/2fa/setup', body: {}, allow: ACCOUNTS },
  { method: 'POST', path: '/api/v1/me/2fa/confirm', body: {}, allow: ACCOUNTS },
  { method: 'POST', path: '/api/v1/me/2fa/step-up', body: {}, allow: ACCOUNTS },
  { method: 'POST', path: '/api/v1/me/2fa/disable', body: {}, allow: ACCOUNTS },
  { method: 'GET', path: '/api/v1/admin/audit', allow: AUDIT },
  { method: 'GET', path: '/api/v1/admin/audit/verify', allow: AUDIT },
  { method: 'GET', path: '/api/v1/admin/accounts', allow: ADMIN_VIEW },
  { method: 'GET', path: '/api/v1/admin/abuse', allow: ABUSE },
  { method: 'POST', path: '/api/v1/admin/accounts/:id/suspend', body: {}, allow: SUSPEND },
  { method: 'POST', path: '/api/v1/admin/accounts/:id/unsuspend', body: {}, allow: SUSPEND },
  { method: 'POST', path: '/api/v1/admin/accounts/:id/roles', body: {}, allow: ROLE_ASSIGN },
  { method: 'POST', path: '/api/v1/admin/accounts/:id/roles/remove', body: {}, allow: ROLE_ASSIGN },
  { method: 'GET', path: '/api/v1/games', allow: ALL },
  { method: 'GET', path: '/api/v1/matches', allow: ALL },
  { method: 'POST', path: '/api/v1/matches', body: {}, allow: CREATORS },
  { method: 'GET', path: '/api/v1/matches/:code', allow: ALL },
  // A round runs in the match: the host's call is answered ROUND_RUNNING.
  { method: 'POST', path: '/api/v1/matches/:code/rounds', body: { season: 'spring' }, allow: HOST },
  { method: 'POST', path: '/api/v1/matches/:code/close', body: {}, allow: HOST, on: 'spare' },
  {
    method: 'POST',
    path: '/api/v1/matches/:code/abort',
    body: { reason: 'authz' },
    allow: HOST,
    on: 'spare',
  },
  { method: 'POST', path: '/api/v1/matches/:code/join', body: {}, allow: JOINERS, on: 'spare' },
  { method: 'POST', path: '/api/v1/matches/:code/leave', body: {}, allow: JOINERS, on: 'spare' },
  // Teams are locked while the round runs.
  { method: 'POST', path: '/api/v1/matches/:code/team', body: { team: 'spring' }, allow: JOINERS },
  { method: 'POST', path: '/api/v1/rounds/:id/start', body: {}, allow: HOST },
  { method: 'POST', path: '/api/v1/rounds/:id/end', body: {}, allow: HOST },
  { method: 'POST', path: '/api/v1/rounds/:id/abort', body: {}, allow: HOST },
  { method: 'GET', path: '/api/v1/rounds/:id/state', allow: WATCHERS },
  // Out of range: refused for a roster player without a cooldown, NOT_IN_ROUND for the rest.
  {
    method: 'POST',
    path: '/api/v1/rounds/:id/guesses',
    body: { value: 1_000_001 },
    allow: ROSTER,
    on: 'live',
  },
  { method: 'GET', path: '/api/v1/rounds/:id/result', allow: ALL },
  { method: 'GET', path: '/api/v1/rounds/:id/verify', allow: ALL },
  { method: 'GET', path: '/api/v1/seasons/current', allow: ALL },
  { method: 'GET', path: '/api/v1/admin/seasons/feed', allow: SEASONS },
  { method: 'POST', path: '/api/v1/admin/seasons/feed/refresh', body: {}, allow: SEASONS },
  { method: 'GET', path: '/api/v1/admin/halving-days', allow: SEASONS },
  { method: 'POST', path: '/api/v1/admin/halving-days', body: {}, allow: SEASONS },
  { method: 'DELETE', path: '/api/v1/admin/halving-days/:day/:token', allow: SEASONS },
  { method: 'GET', path: '/api/v1/leaderboards', allow: ALL },
  { method: 'GET', path: `/api/v1/leaderboards/${PERIOD}`, allow: ALL },
  { method: 'GET', path: `/api/v1/leaderboards/${PERIOD}/me`, allow: ACCOUNTS },
  { method: 'GET', path: `/api/v1/leaderboards/${PERIOD}/teams`, allow: ALL },
  { method: 'GET', path: '/api/v1/players/:displayName', allow: ALL },
  {
    method: 'POST',
    path: '/api/v1/admin/leaderboard-adjustments',
    body: { periodId: NO_ONE, displayName: 'nobody-here', delta: 1, reason: 'authz matrix' },
    allow: ADJUST,
  },
  // The chat (builtin provider): watchers read, chat.send reports, chat.moderate moderates.
  // Every target is missing (NO_ONE) or every body invalid, so nothing changes.
  { method: 'GET', path: '/api/v1/chat/config', allow: ALL },
  { method: 'GET', path: '/api/v1/chat/rooms/lobby', allow: WATCHERS },
  { method: 'GET', path: '/api/v1/chat/rooms/match/:code', allow: WATCHERS },
  { method: 'GET', path: '/api/v1/chat/rooms/:roomId/messages', allow: WATCHERS },
  {
    method: 'POST',
    path: '/api/v1/chat/messages/:id/report',
    body: { reason: 'authz' },
    allow: JOINERS,
  },
  { method: 'GET', path: '/api/v1/admin/moderation/reports', allow: MODERATE },
  {
    method: 'POST',
    path: '/api/v1/admin/moderation/reports/:id/resolve',
    body: {},
    allow: MODERATE,
  },
  { method: 'POST', path: '/api/v1/admin/chat/messages/:id/delete', body: {}, allow: MODERATE },
  { method: 'GET', path: '/api/v1/admin/chat/sanctions', allow: MODERATE },
  { method: 'POST', path: '/api/v1/admin/chat/sanctions', body: {}, allow: MODERATE },
  { method: 'POST', path: '/api/v1/admin/chat/sanctions/:id/lift', body: {}, allow: MODERATE },
  { method: 'PATCH', path: '/api/v1/admin/chat/rooms/:id', body: {}, allow: MODERATE },
  { method: 'GET', path: '/api/v1/admin/profanity-lists', allow: MODERATE },
  { method: 'PUT', path: '/api/v1/admin/profanity-lists/:id', body: {}, allow: MODERATE },
];

// What a path's parameters are filled with, besides the match and round.
export const PARAMS: Readonly<Record<string, string>> = {
  ':displayName': 'dev-host',
  ':day': 'x',
  ':token': 'y',
  ':roomId': NO_ONE,
  ':playerKey': 'nobody-here',
  '*': 'index.html',
};
export const ACCOUNT_PARAM = NO_ONE;
export const SETTINGS_DOCUMENT = 'matchmaking';

// Every intent of the gateway (INTENT_TYPES); anonymous sockets are refused at the handshake.
// `round` is the ended round, `live` the running one, `code` the host's match.
interface Ids {
  readonly code: string;
  readonly round: string;
  readonly live: string;
}
export const INTENTS: Readonly<
  Record<string, { readonly data: (ids: Ids) => object; readonly allow: readonly Role[] }>
> = {
  'match.watch': { data: ({ code }) => ({ code }), allow: WATCHERS },
  'match.unwatch': { data: ({ code }) => ({ code }), allow: SESSION },
  'time.sync': { data: () => ({}), allow: SESSION },
  guess: { data: ({ live }) => ({ roundId: live, value: 1_000_001 }), allow: ROSTER },
  'team.choose': { data: ({ code }) => ({ code, team: 'spring' }), allow: JOINERS },
  'round.start': { data: ({ round }) => ({ roundId: round }), allow: HOST },
  'round.end': { data: ({ round }) => ({ roundId: round }), allow: HOST },
  // Without a reason: the host's call is answered VALIDATION_FAILED.
  'round.abort': { data: ({ round }) => ({ roundId: round }), allow: HOST },
  // A room that does not exist: allowed callers are answered NOT_FOUND.
  'chat.join': { data: () => ({ roomId: NO_ONE }), allow: WATCHERS },
  'chat.leave': { data: () => ({ roomId: NO_ONE }), allow: SESSION },
  'chat.send': { data: () => ({ roomId: NO_ONE, text: 'authz' }), allow: JOINERS },
};

// The refusals: HTTP status with its code; an intent answers the code alone.
export const REFUSALS: Readonly<Record<string, number>> = {
  SIGN_IN_REQUIRED: 401,
  FORBIDDEN: 403,
  NOT_THE_HOST: 403,
  CSRF_INVALID: 403,
  NOT_IN_ROUND: 409,
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
  ].includes(`${r.method} ${r.path}`),
);
