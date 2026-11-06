/**
 * @file   apps/server/src/auth/websiteIdentity.test.ts
 * @module server/auth
 * @brief  Website mode's header reading: trusted peers, the identity, the steps, the roles (O66).
 *
 * Responsibility: a peer counts only inside SMG_TRUSTED_PROXIES (IPv4-mapped too); the identity
 *                 needs a numeric id and a name, makes the name fit (3–24 characters) and reads
 *                 the e-mail and can-host flags; the steps header keeps at most three valid
 *                 steps and drops a foreign icon address, bad JSON or a non-array without
 *                 failing; the roles map admin → game_admin and can-host → organizer only.
 * Depends on:     vitest, ./websiteIdentity, ../config/env
 * Spec:           docs/spec/07-integration.md §7; Bingo 07 §2.3
 */
import { describe, expect, it } from 'vitest';

import { loadEnv } from '../config/env.js';
import {
  identityFrom,
  isWebsiteGuest,
  mappedRoles,
  stepsFrom,
  trustedPeers,
} from './websiteIdentity.js';

const env = loadEnv({ DATABASE_URL: 'postgres://u:p@localhost:5432/db' });
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
const step = (name: string, icon: string | null = '/media/step-icons/ab.webp') => ({
  ladder: 'holder',
  name,
  icon,
});

describe('trusted peers', () => {
  it('trusts the listed addresses and ranges only', () => {
    const trusted = trustedPeers(['127.0.0.1', '172.18.0.0/16', 'uniquelocal']);
    expect(trusted('127.0.0.1')).toBe(true);
    expect(trusted('::ffff:172.18.4.2')).toBe(true);
    expect(trusted('10.0.0.9')).toBe(false);
    expect(trusted(undefined)).toBe(false);
  });
});

describe('the identity headers', () => {
  const base = { 'x-acting-user-id': '42', 'x-acting-user': 'Walter W.' };

  it('needs a numeric id and a name', () => {
    expect(identityFrom({ ...base, 'x-acting-user-id': 'u-1' }, env)).toBeNull();
    expect(identityFrom({ 'x-acting-user-id': '42' }, env)).toBeNull();
    expect(identityFrom({ ...base, 'x-acting-user-id': ['42', '43'] }, env)).toBeNull();
  });

  it('makes the name fit and reads the flags', () => {
    const who = identityFrom(
      {
        ...base,
        'x-acting-user-roles': 'member, Admin',
        'x-acting-user-email-verified': 'true',
        'x-acting-user-can-host': 'TRUE',
      },
      env,
    );
    expect(who).toMatchObject({
      subject: '42',
      displayName: 'Walter_W.',
      roles: ['member', 'admin'],
      emailVerified: true,
      canHost: true,
      steps: [],
    });
    expect(identityFrom({ ...base, 'x-acting-user': '!!' }, env)?.displayName).toMatch(
      /^player-[0-9a-f]{6}$/,
    );
  });

  it('tells a guest from a member', () => {
    expect(isWebsiteGuest({ 'x-acting-guest': 'true' }, env)).toBe(true);
    expect(isWebsiteGuest(base, env)).toBe(false);
  });
});

describe('the steps header', () => {
  it('keeps at most three valid steps, a missing icon as null', () => {
    const four = [step('One'), step('Two', null), step('Three'), step('Four')];
    expect(stepsFrom(encode(four))).toEqual(four.slice(0, 3));
  });

  it('drops a step with a foreign icon or an unknown ladder, never the rest', () => {
    const steps = [
      step('Away', 'https://evil.example/x.webp'),
      step('Relative', '//evil.example/x.webp'),
      step('Back', '/media\\x.webp'),
      { ladder: 'miner', name: 'X', icon: null },
      step('Kept'),
    ];
    expect(stepsFrom(encode(steps)).map((s) => s.name)).toEqual(['Kept']);
  });

  it('drops bad JSON, a non-array and an oversized header without failing', () => {
    expect(stepsFrom('%%%')).toEqual([]);
    expect(stepsFrom(Buffer.from('{not json').toString('base64url'))).toEqual([]);
    expect(stepsFrom(encode({ ladder: 'holder' }))).toEqual([]);
    expect(stepsFrom('a'.repeat(5_000))).toEqual([]);
    expect(stepsFrom(undefined)).toEqual([]);
  });
});

describe('the role mapping (O66)', () => {
  it('maps admin to game_admin and can-host to organizer, nothing else', () => {
    expect(mappedRoles({ roles: ['admin'], canHost: false })).toEqual(['game_admin']);
    expect(mappedRoles({ roles: ['organiser'], canHost: false })).toEqual([]);
    expect(mappedRoles({ roles: ['member'], canHost: true })).toEqual(['organizer']);
    expect(
      mappedRoles({ roles: ['super_admin', 'security_admin', 'moderator'], canHost: false }),
    ).toEqual([]);
  });
});
