/**
 * @file   load/parallelStorm.mjs
 * @module load
 * @brief  Load scenario L3 `parallel`: several matches whose rounds run at the same time.
 *
 * Responsibility: on its own server (./stack): sign in the load accounts, give each match its
 *                 players and 10 spectators, one worker thread per match (./storm), then start
 *                 one plain round in every match at once, shared and individual taking turns,
 *                 each played until it ends; measure each round as L1 does (./storm: the
 *                 acknowledgements, the own answers, the log's integrity) and every
 *                 acknowledgement of all rounds together, with the server's CPU, memory and
 *                 event-loop lag sampled once for them all (./measure). Afterwards, whatever
 *                 happened, it aborts the matches and deletes the load accounts.
 *                 Usage: node load/parallelStorm.mjs [matches=10] [players=50] [out.json]
 * Depends on:     node:fs, ./http, ./measure, ./scenarios, ./stack, ./storm
 * Spec:           docs/spec/09-testing-strategy.md §5 (L3 parallel)
 */
import { writeFileSync } from 'node:fs';

import { call, problems, signIn } from './http.mjs';
import { metricsSampler, spread } from './measure.mjs';
import { ROUNDS } from './scenarios.mjs';
import { withLoadStack } from './stack.mjs';
import * as storm from './storm.mjs';

const MATCHES = Number(process.argv[2] ?? 10);
const PLAYERS = Number(process.argv[3] ?? 50);
const OUT = process.argv[4] || null;
const SPECTATORS = 10;

// Shared and individual take turns over the matches (09 §5: "individual and shared mixed").
const roundOf = (i) => {
  const mode = i % 2 === 0 ? 'shared' : 'individual';
  const round = {
    ...ROUNDS.plain,
    settings: { ...ROUNDS.plain.settings, 'round.secretMode': mode },
  };
  return { mode, round };
};

// Each match with its players, spectators and one worker thread.
async function setUp(host) {
  const per = PLAYERS + SPECTATORS;
  const clients = await storm.signInLoad(0, MATCHES * per);
  const games = [];
  for (let i = 0; i < MATCHES; i += 1) {
    const mine = clients.slice(i * per, (i + 1) * per);
    const [players, spectators] = [mine.slice(0, PLAYERS), mine.slice(PLAYERS)];
    const match = await storm.joinedMatch(host, players, `load parallel ${String(i + 1)}`);
    const workers = storm.startWorkers(players, spectators, match.code, 1);
    games.push({ host, match, workers, ...roundOf(i) });
  }
  await Promise.all(games.map((g) => storm.connectWorkers(g.workers)));
  return games;
}

async function main() {
  const host = await signIn('host');
  let games = [];
  try {
    games = await setUp(host);
    const sampler = metricsSampler();
    await sampler.read();
    const startedAt = Date.now();
    const played = await Promise.all(
      games.map((g) =>
        storm.playRound(g, g.mode, g.round, { sampler: false, acks: true, pollMs: 5_000 }),
      ),
    );
    const server = sampler.stop();
    const summary = {
      scenario: 'parallel',
      matches: MATCHES,
      players: PLAYERS,
      spectators: SPECTATORS,
      runS: Math.round((Date.now() - startedAt) / 1000),
      ackMs: spread(played.flatMap((r) => r.acks)),
      server,
      rounds: played.map(({ acks, ...round }) => ({ ...round, acks: acks.length })),
      problems: { http: problems.http, examples: problems.examples.slice(0, 10) },
    };
    const text = JSON.stringify(summary, null, 2);
    console.log(text);
    if (OUT !== null) writeFileSync(OUT, `${text}\n`);
  } finally {
    for (const g of games) for (const w of g.workers) await w.worker.terminate();
    for (const g of games)
      await call(host, 'POST', `/matches/${g.match.code}/abort`, { reason: 'load check done' });
    await storm.deleteLoadAccounts();
  }
}

withLoadStack(main).catch((error) => {
  console.error(error);
  process.exit(1);
});
