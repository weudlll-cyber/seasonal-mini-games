/**
 * @file   apps/server/test/authzRoles.ts
 * @module server/test
 * @brief  The kinds of caller of the authorization matrix and the groups the tables allow.
 *
 * Responsibility: the ten kinds of caller (anonymous, guest, a player, a player of the match,
 *                 another host, the match's host, the super admin, a moderator, a game admin and
 *                 a staff-only security admin) and, per permission, the kinds that hold it.
 * Depends on:     nothing
 * Used by:        ./authzTable, ./authzSetup, ./authzMatrix.integration.test
 * Spec:           docs/spec/05-security-threat-model.md §1; docs/spec/09-testing-strategy.md §6
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
export const ALL = ROLES;
export const SESSION = not('anonymous');
export const ACCOUNTS = not('anonymous', 'guest');
// The security admin is staff only (no player role): it holds neither match.join nor match.watch.
export const JOINERS = not('anonymous', 'guest', 'securityAdmin');
export const WATCHERS = not('anonymous', 'securityAdmin');
export const CREATORS: readonly Role[] = ['otherHost', 'host', 'admin', 'gameAdmin'];
export const HOST: readonly Role[] = ['host'];
// The roster of the running round: the host plays along (O16, S10) with the match's player.
export const ROSTER: readonly Role[] = ['host', 'matchPlayer'];
export const ADMIN_VIEW: readonly Role[] = ['admin', 'moderator', 'gameAdmin', 'securityAdmin'];
export const AUDIT: readonly Role[] = ['admin', 'securityAdmin'];
export const ABUSE: readonly Role[] = ['admin', 'moderator', 'securityAdmin'];
export const SUSPEND: readonly Role[] = ['admin', 'securityAdmin'];
export const ROLE_ASSIGN: readonly Role[] = ['admin'];
export const SEASONS: readonly Role[] = ['admin', 'gameAdmin'];
export const ADJUST: readonly Role[] = ['admin', 'moderator'];
export const ABORT: readonly Role[] = ['admin', 'moderator', 'gameAdmin'];
// match.manage: organizers (in their own match only, checked after the match is found) and staff.
export const MANAGE: readonly Role[] = ['otherHost', 'host', 'admin', 'gameAdmin'];
export const MODERATE: readonly Role[] = ['admin', 'moderator', 'gameAdmin'];
// integration.manage: the embed allowlist, identity providers and webhooks (0010).
export const INTEGRATION: readonly Role[] = ['admin', 'securityAdmin'];
