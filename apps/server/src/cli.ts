/**
 * @file   apps/server/src/cli.ts
 * @module server
 * @brief  Operator commands run inside the app container: the first admin account.
 *
 * Responsibility: the entry of `smg admin create-super` / `smg admin promote-super`: runs the
 *                 command named on the command line (./cliCommands, where both are described)
 *                 with the process's environment, prints the usage for an unknown one, and
 *                 ends the process with the command's exit code (2 for a usage error, 1 for a
 *                 fatal error).
 * Depends on:     ./config/env, ./cliCommands
 * Used by:        ops/smg (docker compose exec app node dist/cli.js …)
 * Spec:           Bingo 09 §4, §5; Bingo 03 §2.1; docs/spec/07-integration.md §7
 */
import { runCommand, USAGE } from './cliCommands.js';
import { loadEnv } from './config/env.js';

const [command = '', ...rest] = process.argv.slice(2);
// loadEnv inside the promise: an invalid environment ends as a fatal error, like any other.
runCommand(command, rest, () => loadEnv()).then(
  (code) => {
    if (code === -1) console.error(USAGE);
    process.exit(code === -1 ? 2 : code);
  },
  (error: unknown) => {
    console.error('[smg] fatal:', error);
    process.exit(1);
  },
);
