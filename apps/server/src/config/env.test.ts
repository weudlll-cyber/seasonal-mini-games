/**
 * @file   apps/server/src/config/env.test.ts
 * @module server/config
 * @brief  Fail closed: production by default, development features only with SMG_DEV=1 on localhost.
 *
 * Responsibility: without NODE_ENV and SMG_DEV the settings say production and no
 *                 development features; SMG_DEV=1 is refused for a public address and
 *                 accepted for localhost; the round key is required in production.
 * Depends on:     vitest, ./env, ./roundKey
 * Spec:           Bingo 03 §3; Bingo 09 §1
 */
import { describe, expect, it } from 'vitest';

import { loadEnv } from './env.js';
import { roundKeyFrom } from './roundKey.js';

const DB = { DATABASE_URL: 'postgres://u:p@localhost:5432/db' };

describe('the settings (audit S1)', () => {
  it('run as production without development features by default', () => {
    const env = loadEnv(DB);
    expect([env.NODE_ENV, env.SMG_DEV]).toEqual(['production', false]);
  });

  it('refuse SMG_DEV=1 for a public address and accept it on localhost', () => {
    expect(() =>
      loadEnv({ ...DB, SMG_DEV: '1', SMG_PUBLIC_URL: 'https://games.example.org/' }),
    ).toThrow(/SMG_DEV=1 is refused for the public address games.example.org/);
    const local = loadEnv({ ...DB, SMG_DEV: '1', SMG_PUBLIC_URL: 'http://localhost:5410/' });
    expect(local.SMG_DEV).toBe(true);
  });
});

describe('the round key', () => {
  it('is required in production and fixed only for development and tests', () => {
    expect(() => roundKeyFrom(loadEnv(DB))).toThrow(/SMG_ROUND_KEY is required/);
    const key = 'ab'.repeat(32);
    expect(roundKeyFrom(loadEnv({ ...DB, SMG_ROUND_KEY: key })).toString('hex')).toBe(key);
    expect(roundKeyFrom(loadEnv({ ...DB, SMG_DEV: '1' }))).toHaveLength(32);
    expect(() => loadEnv({ ...DB, SMG_ROUND_KEY: 'short' })).toThrow(/64 hex characters/);
  });
});
