/**
 * @file   load/guessStorm.mjs
 * @module load
 * @brief  Load scenarios L1, L2 and L4: shared rounds with N players guessing as fast as allowed.
 *
 * Responsibility: on its own server (./stack: port 3950, a fresh database): raise the match size
 *                 limit for the check, sign in N numbered load players and 100 spectators, let
 *                 the players join one match, and spread every client's socket over worker
 *                 threads so the driver keeps up with the frames (./storm). Then it plays the
 *                 scenario's rounds (./scenarios) one after another in that match, each until
 *                 someone solves it, and measures each (./storm, ./measure); in L2's `burst`
 *                 round every player's first guess goes out within 50 ms of the open.
 *                 Afterwards, whatever happened, it aborts the match, deletes the load accounts,
 *                 puts the setting back and removes a halving day it added.
 *                 Usage: node load/guessStorm.mjs [players=500] [out.json] [scenario=plain]
 *                 with scenario one of plain, spring, summer, autumn, winter, halving, burst,
 *                 specials, l1.
 * Depends on:     node:fs, ./http, ./scenarios, ./stack, ./storm
 * Spec:           docs/spec/09-testing-strategy.md §5 (L1 shared-500, L2 open-burst, L4 headroom-1000)
 */
import { writeFileSync } from 'node:fs';

import { call, problems, signIn } from './http.mjs';
import { OPEN_BURST, ROUNDS, SCENARIOS, ensureHalvingDay, removeHalvingDay } from './scenarios.mjs';
import { withLoadStack } from './stack.mjs';
import * as storm from './storm.mjs';

const PLAYERS = Number(process.argv[2] ?? 500);
const OUT = process.argv[3] || null;
const SCENARIO = process.argv[4] ?? 'plain';
const SPECTATORS = 100;
const WORKERS = 6;

async function cleanUp(ctx) {
  const { host, admin, match, workers, matchmaking, halvingDay } = ctx;
  for (const w of workers ?? []) await w.worker.terminate();
  if (match !== undefined)
    await call(host, 'POST', `/matches/${match.code}/abort`, { reason: 'load check done' });
  await storm.deleteLoadAccounts();
  if (matchmaking !== undefined) await storm.restoreLimit(admin, matchmaking);
  if (halvingDay !== undefined) await removeHalvingDay(admin, halvingDay);
}

async function main() {
  const rounds = SCENARIOS[SCENARIO];
  if (rounds === undefined) throw new Error(`unknown scenario ${SCENARIO}`);
  const ctx = { host: await signIn('host'), admin: await signIn('admin') };
  ctx.matchmaking = await storm.raiseLimit(ctx.admin);
  try {
    if (rounds.includes('halving')) ctx.halvingDay = await ensureHalvingDay(ctx.admin);
    const clients = await storm.signInLoad(0, PLAYERS + SPECTATORS);
    const [players, spectators] = [clients.slice(0, PLAYERS), clients.slice(PLAYERS)];
    ctx.match = await storm.joinedMatch(ctx.host, players, `load ${SCENARIO} ${String(PLAYERS)}`);
    ctx.workers = storm.startWorkers(players, spectators, ctx.match.code, WORKERS);
    await storm.connectWorkers(ctx.workers);
    const startedAt = Date.now();
    const played = [];
    for (const name of rounds) {
      played.push(await storm.playRound(ctx, name, ROUNDS[name], { burst: OPEN_BURST.has(name) }));
    }
    const summary = {
      scenario: SCENARIO,
      players: PLAYERS,
      spectators: SPECTATORS,
      runS: Math.round((Date.now() - startedAt) / 1000),
      rounds: played,
      problems: { http: problems.http, examples: problems.examples.slice(0, 10) },
    };
    const text = JSON.stringify(summary, null, 2);
    console.log(text);
    if (OUT !== null) writeFileSync(OUT, `${text}\n`);
  } finally {
    await cleanUp(ctx);
  }
}

withLoadStack(main).catch((error) => {
  console.error(error);
  process.exit(1);
});
