/**
 * @file   packages/game-sdk/src/sentinel.ts
 * @module game-sdk
 * @brief  A running round with a game's sentinel secrets, for the screens' sentinel tests.
 *
 * Responsibility: from a game's module and conformance kit (04 §4.5), a round in the given
 *                 secret mode with the kit's sentinel secrets, played for a few of the kit's
 *                 actions (refused ones skipped), and its player and spectator views with the
 *                 marks no screen of a running round may show; a game's web tests draw their
 *                 screens from these views and look for the marks (T141). The views
 *                 themselves are the registry's conformance suite's to check (P2).
 * Depends on:     ./module, ./random (types)
 * Used by:        games/<game>/web (sentinel tests)
 * Spec:           docs/spec/09-testing-strategy.md §2, §3 (P2)
 */
import type { ConformanceKit, GameModule, SecretMode } from './module.js';
import type { Drbg, RoundRng } from './random.js';

const PLAYERS = ['p1', 'p2', 'p3'];

// A plain counter in place of the DRBG: the sentinel round needs draws, not unpredictable ones,
// and browser-side tests have no node:crypto (the DRBG is @smg/game-sdk/crypto).
function counter(): Drbg {
  let n = 0;
  const nextUint32 = (): number => (n = (n * 1_103_515_245 + 12_345) >>> 0);
  const nextInt = (max: number): number => nextUint32() % Math.max(1, max);
  return { nextUint32, nextInt, intBetween: (low, high) => low + nextInt(high - low + 1) };
}

const RNG: RoundRng = { child: () => counter() };

export function sentinelViews<S, A, E, Cfg, Sec>(
  entry: {
    readonly module: GameModule<S, A, E, Cfg, Sec>;
    readonly conformance: ConformanceKit<A, Cfg, Sec>;
  },
  mode: SecretMode,
): { readonly player: unknown; readonly spectator: unknown; readonly marks: readonly string[] } {
  const { module, conformance: kit } = entry;
  const input = kit.input(mode, PLAYERS);
  const { secrets, marks } = kit.sentinels(input);
  let state = module.createRound(input);
  for (let k = 0; k < 6; k += 1) {
    const playerId = PLAYERS[k % PLAYERS.length] ?? 'p1';
    const action = kit.action(k * 7_919 + 13);
    if (module.validate(state, playerId, action) !== null) continue;
    const act = { playerId, receiveSeq: k + 1, receivedAt: k * 1_000, action };
    const decision = module.decide(state, act, {
      now: act.receivedAt,
      cooldownMs: 0,
      secrets,
      rng: RNG,
    });
    if (decision.ok) for (const e of decision.events) state = module.evolve(state, e.event);
  }
  const ctx = { releasedBefore: Infinity };
  return {
    player: module.views.player(state, 'p1', ctx),
    spectator: module.views.spectator(state, ctx),
    marks,
  };
}
