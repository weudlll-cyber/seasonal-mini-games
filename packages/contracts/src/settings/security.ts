/**
 * @file   packages/contracts/src/settings/security.ts
 * @module contracts/settings
 * @brief  The security and rate-limit settings documents (08 §6).
 *
 * Responsibility: the anti-multi-account rules (owner decision O10), the abuse-signal
 *                 thresholds and every rate limit, with their bounds; changed only by a
 *                 security admin, effective at once.
 * Depends on:     @smg/game-sdk (SettingDef)
 * Used by:        ./platform
 * Spec:           docs/spec/08-admin-settings.md §6; docs/spec/05-security-threat-model.md §5, §6
 */
import type { SettingDef } from '@smg/game-sdk';

const SECURITY_ADMIN = 'settings.security.edit';

export const security: readonly SettingDef[] = [
  {
    key: 'antiMulti.minAccountAgeH',
    kind: 'int',
    label: 'Account age for shared rounds',
    help: 'Hours an account must exist before it may join a shared round. 0 = off.',
    default: 0,
    min: 0,
    max: 720,
    unit: 'h',
    status: 'owner',
    decision: 'O10',
    editPermission: SECURITY_ADMIN,
    hostChooses: false,
    running: 'next',
    spec: '08 §6',
  },
  {
    key: 'antiMulti.requireLinkedChat',
    kind: 'bool',
    label: 'Require a linked Telegram or Discord',
    help: 'Website installs only: shared rounds need a linked chat account on the website.',
    default: false,
    status: 'owner',
    decision: 'O10',
    editPermission: SECURITY_ADMIN,
    hostChooses: false,
    running: 'next',
    spec: '08 §6',
  },
  {
    key: 'abuse.cooldownRejectsPerMin',
    kind: 'int',
    label: 'Cooldown refusals before a flag',
    help: 'More refused guesses than this in a minute raise the account’s abuse score.',
    default: 20,
    min: 5,
    max: 200,
    unit: '/min',
    status: 'technical',
    editPermission: SECURITY_ADMIN,
    hostChooses: false,
    running: 'immediate',
    spec: '08 §6',
  },
  {
    key: 'abuse.botTimingWindowMs',
    kind: 'int',
    label: 'Bot-like timing window',
    help: 'Guesses this close to the end of the cooldown, again and again, raise the abuse score.',
    default: 30,
    min: 5,
    max: 200,
    unit: 'ms',
    status: 'technical',
    editPermission: SECURITY_ADMIN,
    hostChooses: false,
    running: 'immediate',
    spec: '08 §6',
  },
];

interface Limit {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly unit: string;
}

// Rate limits share everything but their numbers (08 §6, 05 §5).
function limit(l: Limit): SettingDef {
  return {
    key: l.key,
    kind: 'int',
    label: l.label,
    help: 'Requests beyond this are refused with "too many requests".',
    default: l.value,
    min: l.min,
    max: l.max,
    unit: l.unit,
    status: 'technical',
    editPermission: SECURITY_ADMIN,
    hostChooses: false,
    running: 'immediate',
    spec: '08 §6',
  };
}

export const rateLimits: readonly SettingDef[] = [
  limit({
    key: 'rate.guessPerAccountPerS',
    label: 'Guesses per account',
    value: 4,
    min: 1,
    max: 10,
    unit: '/s',
  }),
  limit({
    key: 'rate.httpGuessPerSessionPerMin',
    label: 'Guesses without a socket',
    value: 60,
    min: 12,
    max: 240,
    unit: '/min',
  }),
  limit({
    key: 'rate.teamChoosePerMin',
    label: 'Team changes',
    value: 12,
    min: 1,
    max: 60,
    unit: '/min',
  }),
  limit({
    key: 'rate.hostRoundCommandsPerMin',
    label: 'Host round commands',
    value: 30,
    min: 6,
    max: 120,
    unit: '/min',
  }),
  limit({
    key: 'rate.roundQueueBound',
    label: 'Round queue length',
    value: 5_000,
    min: 1_000,
    max: 20_000,
    unit: '',
  }),
];
