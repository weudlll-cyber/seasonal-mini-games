/**
 * @file   apps/server/src/integration/jwt.test.ts
 * @module server/integration
 * @brief  The handoff token's verification, and the account rules of the handoff.
 *
 * Responsibility: a good token in each algorithm passes; a wrong signature, `alg: none`, an
 *                 algorithm the provider does not allow or a key of the wrong type, a wrong
 *                 audience or issuer, an expired, future or too long-lived token, missing claims
 *                 are refused; `links` keeps facts only; role mapping never grants an admin role;
 *                 display names are made valid and unique. The replayed `jti` is the integration test's.
 * Depends on:     vitest, node:crypto, ./jwt, ./handoff
 * Spec:           docs/spec/07-integration.md §1, §4; Bingo 07 §2.1, §2.2; Bingo 03 §4;
 *                 docs/spec/09-testing-strategy.md §2
 */
import { generateKeyPairSync, sign, type KeyObject } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { mappedRoles, nameCandidates } from './handoff.js';
import { HandoffRefused, issuerOf, verifyHandoff, type JwtAlg, type VerifyPolicy } from './jwt.js';

const ISS = 'https://host.example';
const AUD = 'seasonal-mini-games';
const NOW = 1_800_000_000;

const ed = generateKeyPairSync('ed25519');
const ec = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
const other = generateKeyPairSync('ed25519');

const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');

function token(
  claims: Record<string, unknown>,
  options: { alg?: string; key?: KeyObject; header?: Record<string, unknown> } = {},
): string {
  const alg = options.alg ?? 'EdDSA';
  const head = b64({ alg, typ: 'JWT', ...options.header });
  const body = b64({
    iss: ISS,
    aud: AUD,
    sub: 'user-123',
    jti: 'j-1',
    iat: NOW,
    exp: NOW + 60,
    ...claims,
  });
  const data = Buffer.from(`${head}.${body}`);
  const key = options.key ?? ed.privateKey;
  const sig =
    alg === 'EdDSA'
      ? sign(null, data, key)
      : alg === 'ES256'
        ? sign('sha256', data, { key, dsaEncoding: 'ieee-p1363' })
        : alg === 'RS256'
          ? sign('sha256', data, key)
          : Buffer.alloc(0);
  return `${head}.${body}.${sig.toString('base64url')}`;
}

function policy(over: Partial<VerifyPolicy> = {}, publicKey = ed.publicKey): VerifyPolicy {
  return {
    issuer: ISS,
    audience: AUD,
    allowedAlgs: ['EdDSA', 'ES256', 'RS256'],
    now: NOW + 5,
    keyFor: () => Promise.resolve(publicKey),
    ...over,
  };
}

const refused = (t: string, p: VerifyPolicy = policy()) =>
  expect(verifyHandoff(t, p)).rejects.toBeInstanceOf(HandoffRefused);

describe('a good handoff token', () => {
  it('passes in each allowed algorithm and gives the claims the platform uses', async () => {
    const claims = await verifyHandoff(
      token({ name: 'Walter', roles: ['member'], links: ['telegram'] }),
      policy(),
    );
    expect(claims).toEqual({
      sub: 'user-123',
      jti: 'j-1',
      exp: NOW + 60,
      name: 'Walter',
      roles: ['member'],
      links: ['telegram'],
    });
    const pairs: [JwtAlg, { privateKey: KeyObject; publicKey: KeyObject }][] = [
      ['ES256', ec],
      ['RS256', rsa],
    ];
    for (const [alg, pair] of pairs) {
      const t = token({}, { alg, key: pair.privateKey });
      await expect(verifyHandoff(t, policy({}, pair.publicKey))).resolves.toMatchObject({
        sub: 'user-123',
      });
    }
  });

  it('keeps only the facts of `links`, never a handle (S8)', async () => {
    const t = token({ links: ['discord', 'telegram:@walter', 'telegram', 42] });
    expect((await verifyHandoff(t, policy())).links).toEqual(['telegram', 'discord']);
  });

  it('names its issuer before it is verified', () => {
    expect(issuerOf(token({}))).toBe(ISS);
    expect(issuerOf('not.a.token')).toBeNull();
  });
});

describe('a refused handoff token', () => {
  it('has a wrong signature or another key', async () => {
    const t = token({});
    await refused(`${t.slice(0, -4)}AAAA`);
    await refused(token({}, { key: other.privateKey }));
  });

  it('says alg none, or an algorithm the provider does not allow, or one its key cannot check', async () => {
    await refused(token({}, { alg: 'none' }));
    await refused(token({}, { alg: 'HS256' }));
    await refused(token({}), policy({ allowedAlgs: ['RS256'] }));
    // An RS256 token checked against the provider's Ed25519 key.
    await refused(token({}, { alg: 'RS256', key: rsa.privateKey }));
    await refused(token({}, { header: { crit: ['exp'] } }));
  });

  it('is for another audience or from another issuer', async () => {
    await refused(token({ aud: 'seasonal-bingo-royale' }));
    await refused(token({ iss: 'https://evil.example' }));
    await expect(verifyHandoff(token({ aud: ['x', AUD] }), policy())).resolves.toBeDefined();
  });

  it('has expired, is not yet valid, or lives longer than 60 s', async () => {
    await refused(token({ iat: NOW - 200, exp: NOW - 140 }));
    await refused(token({ iat: NOW + 120, exp: NOW + 180 }));
    await refused(token({ nbf: NOW + 120 }));
    await refused(token({ exp: NOW + 61 }));
    // Within the 30 s skew: a token that just expired still passes.
    await expect(
      verifyHandoff(token({ iat: NOW - 70, exp: NOW - 10 }), policy()),
    ).resolves.toBeDefined();
  });

  it('lacks sub, jti or its times, or is no token at all', async () => {
    await refused(token({ sub: '' }));
    await refused(token({ jti: undefined }));
    await refused(token({ exp: undefined }));
    await refused('a.b');
    await refused(`${b64({ alg: 'EdDSA' })}.bm90IGpzb24.AAAA`);
  });

  it('has no key the provider holds', async () => {
    await refused(token({}), policy({ keyFor: () => Promise.resolve(null) }));
  });
});

describe('the handoff account rules', () => {
  it('maps host roles to player, organizer or moderator only, never an admin role', () => {
    const mapping = {
      member: 'player',
      organizers: 'organizer',
      admins: 'super_admin',
      security: 'security_admin',
      staff: 'game_admin',
    };
    expect(mappedRoles(mapping, ['member', 'organizers', 'admins', 'security', 'staff'])).toEqual([
      'player',
      'organizer',
    ]);
    expect(mappedRoles(mapping, ['constructor', '__proto__', 'toString'])).toEqual([]);
  });

  it('makes a valid display name from `name`, then unique ones', () => {
    const first = (name: string | null, n: number) => {
      const out: string[] = [];
      for (const c of nameCandidates(name)) {
        out.push(c);
        if (out.length === n) break;
      }
      return out;
    };
    expect(first('Walter White', 3)).toEqual(['Walter_White', 'Walter_White-2', 'Walter_White-3']);
    expect(first('<b>', 1)).toEqual(['player']);
    expect(first(null, 1)).toEqual(['player']);
    const long = first('x'.repeat(40), 22);
    expect(long.every((c) => /^[\p{L}\p{N}_.-]{3,24}$/u.test(c))).toBe(true);
    expect(new Set(long).size).toBe(22);
  });
});
