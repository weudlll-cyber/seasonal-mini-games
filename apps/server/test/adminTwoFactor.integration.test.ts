/**
 * @file   apps/server/test/adminTwoFactor.integration.test.ts
 * @module server/test
 * @brief  Two-factor sign-in against Postgres: enrol, confirm, step-up, expiry, recovery codes,
 *         disable, and the gate of admin writes with the feature on and off.
 *
 * Responsibility: with SMG_FEATURE_TWO_FACTOR=1 an admin write needs a confirmed factor
 *                 (AUTH_2FA_REQUIRED) and a step-up within 10 minutes (AUTH_STEP_UP_REQUIRED),
 *                 reads never; the secret is sealed at rest; the first right code confirms and
 *                 answers ten recovery codes once; a TOTP step and a recovery code work once;
 *                 disabling needs a code; enrol, confirm, recovery-code use and disable are
 *                 audited. With the feature off the same writes pass without any factor.
 * Depends on:     vitest, ../src/auth/totp, ./harness, ./session
 * Spec:           Bingo 03 §2, §3; Bingo 05 §2.1, §3; Bingo 11 §1
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { base32Decode, hotp, stepAt } from '../src/auth/totp.js';
import { buildOn, startHarness, stopHarness, SUITE_TIMEOUT_MS, type Harness } from './harness.js';
import { signIn, type Client } from './session.js';

let h: Harness;
let admin: Client;
const DOC = '/api/v1/admin/settings/matchmaking';

beforeAll(async () => {
  h = await startHarness({ SMG_FEATURE_TWO_FACTOR: '1' });
  admin = await signIn(h.built.fastify, 'admin');
}, SUITE_TIMEOUT_MS);

afterAll(async () => {
  await stopHarness(h);
});

// An admin write that changes no value: the document saved again as it is.
async function write(client: Client) {
  const doc = (await client.get(DOC)).json<{ version: number; overrides: object }>();
  return client.put(DOC, { version: doc.version, overrides: doc.overrides });
}

const codeOf = async (c: Client) => (await write(c)).json<{ code?: string }>().code;

// The step-up of the admin's session ten minutes and a bit ago.
async function expire(c: Client): Promise<void> {
  await h.pool.query(
    "UPDATE smg.sessions SET last_2fa_at = now() - interval '11 minutes' WHERE csrf_token = $1",
    [c.csrf],
  );
}

interface Status {
  enrolled: boolean;
  stepUpNeeded: boolean;
  recoveryCodesLeft: number;
}

const status = async () => (await admin.get('/api/v1/me/2fa')).json<Status>();

const stepUp = (code: string) => admin.post('/api/v1/me/2fa/step-up', { code });

// What the steps share: the secret, the confirming step and the recovery codes.
let secret: Uint8Array;
let s0: number;
let codes: string[];

describe('two-factor enrolment with the feature on', () => {
  it('refuses admin writes without a factor, enrols and confirms with recovery codes', async () => {
    expect(await status()).toMatchObject({ enrolled: false, stepUpNeeded: true });
    expect(await codeOf(admin)).toBe('AUTH_2FA_REQUIRED');
    expect((await admin.get(DOC)).statusCode).toBe(200);

    const setup = (await admin.post('/api/v1/me/2fa/setup', {})).json<{
      otpauthUri: string;
      secret: string;
    }>();
    expect(setup.otpauthUri).toContain(`secret=${setup.secret}`);
    const decoded = base32Decode(setup.secret);
    if (decoded === null) throw new Error('not base32');
    secret = decoded;
    // Sealed at rest: the stored bytes are not the secret.
    const stored = await h.pool.query<{ secret_enc: Buffer }>(
      'SELECT secret_enc FROM smg.totp_factors',
    );
    expect(stored.rows[0]?.secret_enc.includes(Buffer.from(secret))).toBe(false);

    s0 = stepAt(Date.now());
    const wrong = hotp(secret, s0) === '000000' ? '111111' : '000000';
    expect((await admin.post('/api/v1/me/2fa/confirm', { code: wrong })).statusCode).toBe(422);
    const confirmed = await admin.post('/api/v1/me/2fa/confirm', { code: hotp(secret, s0) });
    codes = confirmed.json<{ recoveryCodes: string[] }>().recoveryCodes;
    expect(new Set(codes).size).toBe(10);
    for (const c of codes) expect(c).toMatch(/^[a-z0-9]{4}-[a-z0-9]{4}$/);
    expect((await admin.post('/api/v1/me/2fa/setup', {})).statusCode).toBe(409);
    // Confirming is a check: the next write passes.
    expect((await write(admin)).statusCode).toBe(200);
  });
});

describe('two-factor step-up with the feature on', () => {
  it('asks for a step-up after ten minutes and accepts each TOTP step once', async () => {
    await expire(admin);
    expect(await codeOf(admin)).toBe('AUTH_STEP_UP_REQUIRED');
    // The confirming step was used: the same code does not work again; the next step does.
    expect((await stepUp(hotp(secret, s0))).json()).toMatchObject({ code: 'AUTH_2FA_INVALID' });
    expect((await stepUp(hotp(secret, s0 + 1))).json()).toMatchObject({ stepUpNeeded: false });
    expect((await write(admin)).statusCode).toBe(200);
  });

  it('accepts a recovery code once, disables with a code, and audits it all', async () => {
    await expire(admin);
    const [first = '', second = ''] = codes;
    expect((await stepUp(first)).statusCode).toBe(200);
    expect((await stepUp(first)).statusCode).toBe(422);
    expect(await status()).toMatchObject({ stepUpNeeded: false, recoveryCodesLeft: 9 });

    expect((await admin.post('/api/v1/me/2fa/disable', { code: 'zzzz-zzzz' })).statusCode).toBe(
      422,
    );
    expect((await admin.post('/api/v1/me/2fa/disable', { code: second })).json()).toMatchObject({
      enrolled: false,
      recoveryCodesLeft: 0,
    });
    expect(await codeOf(admin)).toBe('AUTH_2FA_REQUIRED');

    const audit = (await admin.get('/api/v1/admin/audit?action=twoFactor')).json<{
      items: { action: string }[];
    }>().items;
    expect(audit.map((a) => a.action)).toEqual([
      'twoFactor.disable',
      // The code that disabled it was a recovery code too.
      'twoFactor.recoveryCode',
      'twoFactor.recoveryCode',
      'twoFactor.confirm',
      'twoFactor.enrol',
    ]);
  });

  it('refuses a guest and a body that is no code', async () => {
    const guest = await h.built.fastify.inject({ method: 'GET', url: '/api/v1/me/2fa' });
    expect(guest.statusCode).toBe(401);
    expect((await admin.post('/api/v1/me/2fa/step-up', { code: '12345' })).statusCode).toBe(400);
    expect((await admin.post('/api/v1/me/2fa/step-up', { code: '123456' })).json()).toMatchObject({
      code: 'TWO_FACTOR_NOT_ENROLLED',
    });
  });
});

describe('two-factor sign-in with the feature off', () => {
  it('leaves admin writes as they were', async () => {
    const off = await buildOn(h.pool, h.container.getConnectionUri());
    try {
      const other = await signIn(off.fastify, 'admin');
      expect((await write(other)).statusCode).toBe(200);
    } finally {
      await off.fastify.close();
    }
  });
});
