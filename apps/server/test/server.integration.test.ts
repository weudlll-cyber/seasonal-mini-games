/**
 * @file   apps/server/test/server.integration.test.ts
 * @module server
 * @brief  End-to-end integration test: Fastify app wired to a Testcontainers Postgres.
 *
 * Responsibility: start a real PostgreSQL 17 in Docker, run every migration, boot the
 *                 Fastify app, and check that /healthz, /readyz, /metrics, the placeholder
 *                 page and a 404 all behave as the specification says — including the
 *                 security headers (03 §13, 12 §6) and the problem+json content type.
 * Depends on:     vitest, ./harness, ../src/index, fastify
 * Spec:           docs/spec/09-testing-strategy.md §1; Bingo 12 §2
 */
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { migrate, type DbPool } from '../src/index.js';
import { startHarness, stopHarness, SUITE_TIMEOUT_MS, type Harness } from './harness.js';

let harness: Harness;
const app = (): FastifyInstance => harness.built.fastify;
const pool = (): DbPool => harness.pool;

beforeAll(async () => {
  harness = await startHarness();
  expect(harness.applied).toContain('0001_initial.sql');
}, SUITE_TIMEOUT_MS);

afterAll(async () => {
  await stopHarness(harness);
}, SUITE_TIMEOUT_MS);

const METRICS = [
  'smg_guess_total',
  'smg_guess_ack_seconds',
  'smg_round_queue_depth',
  'smg_round_batch_seconds',
  'smg_special_lag_seconds',
  'smg_frost_delivery_lag_seconds',
  'smg_ws_rtt_seconds',
  'smg_rounds',
  'smg_season_feed_age_seconds',
  'smg_ws_connections',
  'smg_ws_intents_total',
];

describe('server integration', () => {
  it('answers /healthz with status ok', async () => {
    const response = await app().inject({ method: 'GET', url: '/healthz' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('answers /readyz with status ready once the database is reachable', async () => {
    const response = await app().inject({ method: 'GET', url: '/readyz' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ready' });
  });

  it('exposes Prometheus-formatted metrics', async () => {
    const response = await app().inject({ method: 'GET', url: '/metrics' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    // The catalogue of 06 §4.6 and Bingo 08 §6; the readyz above counts as an HTTP request.
    for (const name of METRICS) {
      expect(response.body, name).toContain(`# TYPE ${name} `);
    }
    expect(response.body).toMatch(
      /smg_http_requests_total\{method="GET",route="\/readyz",status="200"\} \d+/,
    );
  });

  it('renders the placeholder page with the dev badge in non-production', async () => {
    const response = await app().inject({ method: 'GET', url: '/' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.body).toContain('Seasonal Mini Games');
    expect(response.body).toMatch(/Mini Games.*dev.*0/);
  });

  it('ships baseline security headers', async () => {
    const response = await app().inject({ method: 'GET', url: '/' });
    expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBeDefined();
    expect(response.headers['referrer-policy']).toBe('no-referrer');
  });

  it('returns problem+json on 404', async () => {
    const response = await app().inject({ method: 'GET', url: '/does-not-exist' });
    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toContain('application/problem+json');
    const body = response.json<{ code: string; status: number; title: string; type: string }>();
    expect(body.code).toBe('NOT_FOUND');
    expect(body.status).toBe(404);
  });
});

describe('database bootstrap', () => {
  it('records the migration in smg.schema_migrations and is idempotent', async () => {
    const second = await migrate(pool());
    expect(second).toEqual([]);
    const result = await pool().query<{ id: string }>('SELECT id FROM smg.schema_migrations');
    expect(result.rows.map((row) => row.id)).toContain('0001_initial.sql');
  });

  it('seeds the roles of the role catalogue, guest included', async () => {
    const result = await pool().query<{ id: string }>('SELECT id FROM smg.roles ORDER BY id');
    expect(result.rows.map((row) => row.id)).toEqual([
      'game_admin',
      'guest',
      'moderator',
      'organizer',
      'player',
      'security_admin',
      'super_admin',
    ]);
  });
});
