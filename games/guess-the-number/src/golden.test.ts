/**
 * @file   games/guess-the-number/src/golden.test.ts
 * @module games/guess-the-number
 * @brief  The golden run: Guess The Number's draws and events for fixed Quick Test seeds.
 *
 * Responsibility: recorded on `master` before the game moved onto the guess engine
 *                 (DECISIONS T118) and compared after it: for the Quick Test seeds `acorn`,
 *                 `meadow` and `frost` (round seed `sha256("smg-quicktest:" + text)`), shared and
 *                 individual, with `full` and `own` visibility, the secrets, the Spring Herald
 *                 hint, a fixed run of guesses with every rejection code and every event
 *                 (answers and comment lines), two Leaf Fall drops, three halvings, and the
 *                 player, spectator and result views. Only the module's public surface is used,
 *                 so the recording holds whatever the code behind it looks like.
 * Depends on:     node:crypto, vitest, @smg/game-sdk (crypto entry), ./fakes, ./module
 * Spec:           docs/spec/09-testing-strategy.md §2 (golden); docs/spec/04-software-architecture.md §4.7
 */
import { createHash } from 'node:crypto';

import type { GameCtx, SecretMode } from '@smg/game-sdk';
import { roundRng } from '@smg/game-sdk/crypto';
import { describe, expect, it } from 'vitest';

import { input } from './fakes.js';
import { guessTheNumber as gtn } from './module.js';
import type { Secrets } from './secrets.js';
import type { Visibility } from './settings.js';
import type { GtnEvent, GtnState } from './state.js';

const SEEDS = ['acorn', 'meadow', 'frost'] as const;
const PLAYERS = ['p1', 'p2', 'p3'];
// Spread over 1–1 000; 500 comes twice so a repeat is refused.
const GUESSES = [500, 250, 750, 120, 880, 370, 630, 60, 940, 440, 500, 310, 560, 990, 15];

const seedOf = (text: string) =>
  new Uint8Array(createHash('sha256').update(`smg-quicktest:${text}`).digest());

interface Run {
  state: GtnState;
  readonly record: unknown[];
}

function fold(run: Run, label: string, emitted: readonly { readonly event: GtnEvent }[]): void {
  run.record.push({ [label]: emitted });
  for (const e of emitted) run.state = gtn.evolve(run.state, e.event);
}

// One recorded round: hint, guesses, falls, halvings and the views, in that order.
function play(text: string, mode: SecretMode, visibility: Visibility): unknown[] {
  const rng = roundRng(seedOf(text));
  const roundInput = { ...input(mode, PLAYERS, { feedbackVisibility: visibility }) };
  const secrets = gtn.deriveSecrets(roundInput, rng);
  const run: Run = { state: gtn.createRound({ ...roundInput, season: 'autumn' }), record: [] };
  run.record.push({ secrets });
  const ctx = (now: number): GameCtx<Secrets> => ({ now, cooldownMs: 3_000, secrets, rng });
  const specials = gtn.specials ?? {};
  fold(run, 'hint', specials.springHerald?.(run.state, ctx(0)) ?? []);
  GUESSES.forEach((value, i) => {
    const playerId = PLAYERS[i % PLAYERS.length] ?? 'p1';
    const code = gtn.validate(run.state, playerId, { value });
    if (code !== null) {
      run.record.push({ refused: { playerId, value, code } });
      return;
    }
    const act = { playerId, receiveSeq: i + 1, receivedAt: (i + 1) * 1_000, action: { value } };
    const decision = gtn.decide(run.state, act, ctx(act.receivedAt));
    if (!decision.ok) throw new Error(decision.code);
    run.record.push({ signals: decision.signals });
    fold(run, `guess ${String(i + 1)}`, decision.events);
  });
  for (const index of [1, 2]) {
    const fall = { index, count: 10, releasedBefore: 9_000 };
    fold(run, `fall ${String(index)}`, specials.leafFall?.(run.state, ctx(20_000), fall) ?? []);
  }
  for (const index of [1, 2, 3]) {
    fold(run, `halving ${String(index)}`, specials.halving?.(run.state, ctx(30_000), index) ?? []);
  }
  const at = { releasedBefore: 9_000 };
  run.record.push({
    player: gtn.views.player(run.state, 'p1', at),
    spectator: gtn.views.spectator(run.state, at),
    result: gtn.views.result(run.state, secrets),
  });
  return run.record;
}

describe('the golden run (DECISIONS T118)', () => {
  it('gives the recorded secrets, answers, comments, falls, halvings and views', async () => {
    const all = SEEDS.flatMap((seed) =>
      (['shared', 'individual'] as const).flatMap((mode) =>
        (['full', 'own'] as const).map((visibility) => ({
          seed,
          mode,
          visibility,
          record: play(seed, mode, visibility),
        })),
      ),
    );
    await expect(JSON.stringify(all, null, 1)).toMatchFileSnapshot('./golden.recorded.txt');
  });
});
