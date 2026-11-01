/**
 * @file   apps/server/src/auth/accounts.ts
 * @module server/auth
 * @brief  Accounts: register, linked (handoff) accounts, find for login, change password,
 *         delete, dev accounts.
 *
 * Responsibility: create an account with the `player` role (and any extra roles), or one
 *                 without e-mail and password for a host's identity (Bingo 07 §2.1); look an
 *                 account up by e-mail for login; create-or-reuse the development accounts
 *                 behind the quick sign-in. E-mail and display name are unique case-insensitively;
 *                 a clash is one generic error, so no response reveals which e-mail exists.
 * Depends on:     pg, ../db/pool, ./password
 * Used by:        ../http/routes/auth, ../http/routes/devSignIn, ../integration/handoff, ../cli,
 *                 test/*
 * Spec:           Bingo 03 §2.1; Bingo 04 §3.1; Bingo 07 §2.1
 */
import { randomBytes } from 'node:crypto';

import type pg from 'pg';

import type { DbPool } from '../db/pool.js';
import { hashPassword } from './password.js';

interface NewAccount {
  readonly email: string;
  readonly displayName: string;
  readonly password: string;
  readonly roles?: readonly string[];
}

type RegisterResult = { readonly ok: true; readonly id: string } | { readonly ok: false };

export async function registerAccount(pool: DbPool, input: NewAccount): Promise<RegisterResult> {
  const passwordHash = await hashPassword(input.password);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO smg.accounts (email, password_hash, display_name, display_name_key)
       VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING id`,
      [input.email, passwordHash, input.displayName, input.displayName],
    );
    const id = inserted.rows[0]?.id;
    if (id === undefined) {
      await client.query('ROLLBACK');
      return { ok: false };
    }
    for (const role of ['player', ...(input.roles ?? [])]) {
      await client.query('INSERT INTO smg.role_assignments (account_id, role_id) VALUES ($1, $2)', [
        id,
        role,
      ]);
    }
    await client.query('COMMIT');
    return { ok: true, id };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// A first login through a host's identity: no e-mail, no password, the `player` role, inside
// the caller's transaction. Null when the display name is taken (the caller tries another).
export async function createLinkedAccount(
  c: pg.PoolClient,
  displayName: string,
): Promise<string | null> {
  const inserted = await c.query<{ id: string }>(
    `INSERT INTO smg.accounts (display_name, display_name_key) VALUES ($1, $2)
     ON CONFLICT DO NOTHING RETURNING id::text`,
    [displayName, displayName],
  );
  const id = inserted.rows[0]?.id;
  if (id === undefined) return null;
  await c.query("INSERT INTO smg.role_assignments (account_id, role_id) VALUES ($1, 'player')", [
    id,
  ]);
  return id;
}

interface LoginAccount {
  readonly id: string;
  readonly passwordHash: string | null;
  readonly emailVerified: boolean;
}

export async function findLoginAccount(pool: DbPool, email: string): Promise<LoginAccount | null> {
  const result = await pool.query<{
    id: string;
    password_hash: string | null;
    email_verified_at: Date | null;
  }>(
    `SELECT id, password_hash, email_verified_at FROM smg.accounts WHERE email = $1 AND status = 'active'`,
    [email],
  );
  const row = result.rows[0];
  if (row === undefined) return null;
  return {
    id: row.id,
    passwordHash: row.password_hash,
    emailVerified: row.email_verified_at !== null,
  };
}

export async function passwordHashOf(pool: DbPool, accountId: string): Promise<string | null> {
  const result = await pool.query<{ password_hash: string | null }>(
    'SELECT password_hash FROM smg.accounts WHERE id = $1',
    [accountId],
  );
  return result.rows[0]?.password_hash ?? null;
}

// Deletes an account (Bingo 05 §2.2 DELETE /me): its sessions, roles and abuse signals go with
// it (cascade); matches and round results keep their history without the link to the account
// (their foreign keys are ON DELETE SET NULL).
export async function deleteAccount(pool: DbPool, accountId: string): Promise<void> {
  await pool.query('DELETE FROM smg.accounts WHERE id = $1', [accountId]);
}

// A new password for an account (POST /me/password); the caller has checked the old one.
export async function setPassword(
  pool: DbPool,
  accountId: string,
  password: string,
): Promise<void> {
  const passwordHash = await hashPassword(password);
  await pool.query('UPDATE smg.accounts SET password_hash = $2, updated_at = now() WHERE id = $1', [
    accountId,
    passwordHash,
  ]);
}

export async function recordLogin(pool: DbPool, accountId: string): Promise<void> {
  await pool.query('UPDATE smg.accounts SET last_login_at = now() WHERE id = $1', [accountId]);
}

// Development only: the account behind a quick sign-in button, created on first use.
export async function ensureDevAccount(
  pool: DbPool,
  displayName: string,
  roles: readonly string[],
): Promise<string> {
  const existing = await devAccountId(pool, displayName);
  if (existing !== undefined) return existing;
  const created = await registerAccount(pool, {
    email: `${displayName}@dev.invalid`,
    displayName,
    // Nobody knows it: the quick sign-in is the only way in (audit S2).
    password: randomBytes(32).toString('base64url'),
    roles,
  });
  if (created.ok) return created.id;
  // Several browsers signing in as a new dev account at once: one creates it, the others
  // find it here instead of failing.
  const raced = await devAccountId(pool, displayName);
  if (raced === undefined) throw new Error(`could not create dev account ${displayName}`);
  return raced;
}

async function devAccountId(pool: DbPool, displayName: string): Promise<string | undefined> {
  const found = await pool.query<{ id: string }>(
    'SELECT id FROM smg.accounts WHERE display_name_key = $1',
    [displayName],
  );
  return found.rows[0]?.id;
}
