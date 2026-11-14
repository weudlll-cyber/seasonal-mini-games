/**
 * @file   apps/server/tools/database.ts
 * @module server/tools
 * @brief  Development and test only: recreate a database of the local PostgreSQL and migrate it.
 *
 * Responsibility: `recreateDatabase` drops the database a libpq URL names (closing its
 *                 connections) and creates it empty, through the server's maintenance database
 *                 `postgres`, so no row is ever deleted past a trigger or constraint: the whole
 *                 database is replaced (DECISIONS T345); `migrateDatabase` applies the server's
 *                 migrations; `startDevPostgres` starts the PostgreSQL of ops/compose.dev.yml
 *                 (left as it is when it is up). Only for the local machine: a URL whose host is
 *                 not 127.0.0.1 or localhost is refused. Never part of the server bundle.
 * Depends on:     pg, node:child_process, ../src/db/pool, ../src/db/migrator, docker
 * Used by:        ./testServer, ./resetDevDatabase
 * Spec:           docs/spec/09-testing-strategy.md §1.1; docs/operator-guide.md "Development"
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

import { migrate } from '../src/db/migrator.js';
import { createPool } from '../src/db/pool.js';

const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost']);
// A plain identifier, so the name can stand in the DROP and CREATE statements unquoted.
const NAME = /^[a-z_][a-z0-9_]{0,62}$/;

export interface LocalDatabase {
  readonly url: string;
  readonly name: string;
  readonly port: string;
}

// The database a URL names, on this machine only.
export function localDatabase(url: string): LocalDatabase {
  const parsed = new URL(url);
  const name = decodeURIComponent(parsed.pathname.slice(1));
  if (!LOCAL_HOSTS.has(parsed.hostname)) {
    throw new Error(`refused: ${parsed.hostname} is not this machine`);
  }
  if (!NAME.test(name)) throw new Error(`refused: "${name}" is not a plain database name`);
  return { url, name, port: parsed.port };
}

// Drop and create the database (WITH (FORCE) ends the connections still open to it).
export async function recreateDatabase(db: LocalDatabase): Promise<void> {
  const maintenance = new URL(db.url);
  maintenance.pathname = '/postgres';
  const client = new pg.Client({ connectionString: maintenance.toString() });
  await client.connect();
  try {
    await client.query(`DROP DATABASE IF EXISTS ${db.name} WITH (FORCE)`);
    await client.query(`CREATE DATABASE ${db.name}`);
  } finally {
    await client.end();
  }
}

export async function migrateDatabase(db: LocalDatabase): Promise<readonly string[]> {
  const pool = createPool(db.url);
  try {
    return await migrate(pool);
  } finally {
    await pool.end();
  }
}

// The development PostgreSQL container (its databases are separate: the dev server uses `smg`).
export function startDevPostgres(): void {
  execFileSync(
    'docker',
    [
      'compose',
      '--env-file',
      'ops/.env.dev.example',
      '-f',
      'ops/compose.dev.yml',
      'up',
      '-d',
      '--wait',
      'postgres',
    ],
    { cwd: REPO_ROOT, stdio: 'inherit' },
  );
}
