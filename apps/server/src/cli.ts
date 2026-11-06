/**
 * @file   apps/server/src/cli.ts
 * @module server
 * @brief  Operator commands run inside the app container: the first admin account.
 *
 * Responsibility: `create-super --email <e-mail> --name <display name>` (standalone) asks for
 *                 the password (not echoed on a terminal; read from standard input otherwise),
 *                 checks it against the password rules and creates an account with the roles
 *                 super_admin and organizer (every host permission). On a website install
 *                 (SMG_AUTH_MODE=website) it refuses before asking anything: a local account
 *                 could never sign in there. `promote-super --website-id <id> | --name <name>`
 *                 (website installs only) makes the website member's game account, made at its
 *                 first sign-in, the super admin instead (./auth/superPromotion, DECISIONS T243).
 *                 Called by `smg admin create-super` / `smg admin promote-super`. The password
 *                 is never printed or logged.
 * Depends on:     ./config/env, ./db/pool, ./auth/accounts, ./auth/password,
 *                 ./auth/superPromotion, node:readline
 * Used by:        ops/smg (docker compose exec app node dist/cli.js …)
 * Spec:           Bingo 09 §4, §5; Bingo 03 §2.1; docs/spec/07-integration.md §7
 */
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';

import { registerAccount } from './auth/accounts.js';
import { passwordProblem } from './auth/password.js';
import { promoteWebsiteSuper, type PromoteResult } from './auth/superPromotion.js';
import { loadEnv, type Env } from './config/env.js';
import { createPool, type DbPool } from './db/pool.js';

const PROMOTE_USAGE = 'promote-super --website-id <website user id> | --name <display name>';

function flag(args: readonly string[], name: string): string | null {
  const at = args.indexOf(name);
  return at >= 0 ? (args[at + 1] ?? null) : null;
}

// One line from standard input; on a terminal the typed characters are not shown.
async function readSecret(prompt: string): Promise<string> {
  let muted = false;
  const output = new Writable({
    write(chunk: Buffer, _encoding, done) {
      if (!muted) process.stdout.write(chunk);
      done();
    },
  });
  const rl = createInterface({ input: process.stdin, output, terminal: process.stdin.isTTY });
  process.stdout.write(prompt);
  muted = true;
  const line = await new Promise<string>((resolve) => rl.once('line', resolve));
  rl.close();
  process.stdout.write('\n');
  return line;
}

async function withPool<T>(env: Env, work: (pool: DbPool) => Promise<T>): Promise<T> {
  const pool = createPool(env.DATABASE_URL);
  try {
    return await work(pool);
  } finally {
    await pool.end();
  }
}

async function createSuper(env: Env, args: readonly string[]): Promise<number> {
  if (env.SMG_AUTH_MODE === 'website') {
    console.error(
      'This is a website install (SMG_AUTH_MODE=website): players sign in only through the ' +
        'website, so a local admin account could never sign in. Sign in once through the ' +
        'website, then run: smg admin promote-super --website-id <your website user id> ' +
        '(or --name <your display name>).',
    );
    return 1;
  }
  const email = flag(args, '--email');
  const displayName = flag(args, '--name');
  if (email === null || displayName === null) {
    console.error('usage: create-super --email <e-mail> --name <display name>');
    return 2;
  }
  const password = await readSecret('Password (at least 12 characters): ');
  const problem = passwordProblem(password);
  if (problem !== null) {
    console.error(`The password is not accepted (${problem}).`);
    return 1;
  }
  const created = await withPool(env, (pool) =>
    registerAccount(pool, { email, displayName, password, roles: ['super_admin', 'organizer'] }),
  );
  if (!created.ok) {
    console.error('An account with this e-mail or display name exists already.');
    return 1;
  }
  console.log(`Created the admin account ${displayName} <${email}> (super_admin, organizer).`);
  return 0;
}

// What the operator reads for each outcome; the exit code is 0 only when the member is admin.
function reportPromotion(result: PromoteResult, asked: string): number {
  const who = (m: { displayName: string; websiteId: string }) =>
    `${m.displayName} (website user id ${m.websiteId})`;
  switch (result.kind) {
    case 'promoted':
      console.log(
        `${who(result.member)} is now super admin. Reload the games page to sign in again.`,
      );
      return 0;
    case 'already':
      console.log(`${who(result.member)} is super admin already.`);
      return 0;
    case 'suspended':
      console.error(`${who(result.member)} is suspended: lift the suspension first.`);
      return 1;
    case 'ambiguous':
      console.error(
        `Several website members match ${asked}: ${result.members.map(who).join(', ')}.`,
      );
      console.error('Run the command again with --website-id <id>.');
      return 1;
    case 'unknown':
      console.error(
        `No website member ${asked} has signed in to the games yet. Sign in once through the ` +
          'website (open the games page), then run the command again.',
      );
      return 1;
  }
}

async function promoteSuper(env: Env, args: readonly string[]): Promise<number> {
  if (env.SMG_AUTH_MODE !== 'website') {
    console.error('promote-super is for website installs; a standalone install uses create-super.');
    return 1;
  }
  const websiteId = flag(args, '--website-id');
  const name = flag(args, '--name');
  if (
    (websiteId === null) === (name === null) ||
    (websiteId !== null && !/^\d{1,20}$/.test(websiteId))
  ) {
    console.error(`usage: ${PROMOTE_USAGE}`);
    return 2;
  }
  const issuer = new URL(env.SMG_PUBLIC_URL ?? '').origin;
  const target = websiteId !== null ? { websiteId } : { name: name ?? '' };
  const asked = websiteId !== null ? `with website user id ${websiteId}` : `named "${name ?? ''}"`;
  const result = await withPool(env, (pool) => promoteWebsiteSuper(pool, issuer, target));
  return reportPromotion(result, asked);
}

const COMMANDS: Record<string, (env: Env, args: readonly string[]) => Promise<number>> = {
  'create-super': createSuper,
  'promote-super': promoteSuper,
};

const [command = '', ...rest] = process.argv.slice(2);
const chosen = Object.hasOwn(COMMANDS, command) ? COMMANDS[command] : undefined;
// loadEnv inside the promise: an invalid environment ends as a fatal error, like any other.
const run =
  chosen === undefined
    ? Promise.resolve(-1)
    : Promise.resolve().then(() => chosen(loadEnv(), rest));
run.then(
  (code) => {
    if (code === -1) {
      console.error(`commands: create-super --email <e-mail> --name <name>; ${PROMOTE_USAGE}`);
    }
    process.exit(code === -1 ? 2 : code);
  },
  (error: unknown) => {
    console.error('[smg] fatal:', error);
    process.exit(1);
  },
);
