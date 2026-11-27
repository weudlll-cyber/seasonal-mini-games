/**
 * @file   apps/server/test/containers.test.ts
 * @module server/test
 * @brief  Every service of the production stack carries the kit's container hardening (K89).
 *
 * Responsibility: what Docker Compose itself reads from ops/compose.yml, alone and with the two
 *                 website files on top, has no finding of the kit's `findWeakContainers`: a
 *                 read-only root, no new privileges, every capability dropped, and only those
 *                 added that a role is shown to need. Nothing is started.
 * Depends on:     vitest, node:child_process, docker compose, @seasonal/kit/testing, ops/compose*
 * Spec:           docs/spec/10-repository-structure.md §6; kit docs/OPERATIONS.md "Container
 *                 hardening"; DECISIONS T437
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { findWeakContainers, type HardeningOptions } from '@seasonal/kit/testing';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

// Stand-ins for what the installer writes into the env file.
const VALUES = {
  SMG_IMAGE: 'smg-app:test',
  SMG_ENV: 'prod',
  SMG_ENV_FILE: path.join(ROOT, 'ops/.env.dev.example'),
  POSTGRES_PASSWORD: 'not-a-password',
  SMG_DB_OWNER_PASSWORD: 'not-a-password-either',
  SMG_WEBSITE_NETWORK: 'seasonal-site_default',
  SMG_APP_PORT: '3920',
  SMG_EDGE_SUBNET: '172.30.250.0/24',
};

const SERVICES: HardeningOptions = {
  services: { migrate: 'app', app: 'app', postgres: 'database', caddy: 'app' },
  // The standalone proxy listens on 80 and 443.
  capabilities: { caddy: ['NET_BIND_SERVICE'] },
};

// The merged file as Compose reads it; the standalone profile brings the proxy.
function composed(files: readonly string[]): { services: Record<string, unknown> } {
  const args = ['compose', ...files.flatMap((f) => ['-f', path.join(ROOT, 'ops', f)])];
  const out = execFileSync(
    'docker',
    [...args, '--profile', 'standalone', 'config', '--format', 'json'],
    { env: { ...process.env, ...VALUES }, encoding: 'utf8' },
  );
  return JSON.parse(out) as { services: Record<string, unknown> };
}

describe('the production containers', () => {
  it.each([
    ['standalone', ['compose.yml']],
    ['in the website, its own Caddy', ['compose.yml', 'compose.website.yml']],
    [
      'in the website, behind nginx',
      ['compose.yml', 'compose.website.yml', 'compose.website-nginx.yml'],
    ],
  ])(
    'are hardened: %s',
    (_name, files) => {
      const stack = composed(files);
      expect(Object.keys(stack.services).sort()).toEqual(['app', 'caddy', 'migrate', 'postgres']);
      expect(findWeakContainers(stack, SERVICES)).toEqual([]);
    },
    60_000,
  );
});
