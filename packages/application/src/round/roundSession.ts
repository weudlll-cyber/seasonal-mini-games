/**
 * @file   packages/application/src/round/roundSession.ts
 * @module application/round
 * @brief  One round's engine state beside its seed: create, run commands, recover, reveal.
 *
 * Responsibility: the round seed's commitment at creation (fairness proof on), the secrets
 *                 derived from the seed as soon as the roster is frozen and kept only in
 *                 memory (05 §3), every command through the pure round rules, recovery by
 *                 replaying the log or from a snapshot and the log's tail, and the result view once the round has ended. The round
 *                 actor (queue, group commit, delivery) wraps one session.
 * Depends on:     @smg/domain (round rules), @smg/game-sdk (module, crypto entry)
 * Used by:        ../index, apps/server (round actor)
 * Spec:           docs/spec/04-software-architecture.md §5.2–§5.4; docs/spec/02-game-guess-the-number.md §10
 */
import {
  createRound,
  evolveRound,
  nextDue,
  replayRound,
  roundInput,
  rosterPlayers,
  stepRound,
  type RoundCommand,
  type RoundEvent,
  type RoundState,
  type StepResult,
} from '@smg/domain';
import type { GameModule, Season } from '@smg/game-sdk';
import { commitSeed, roundRng, SEED_BYTES } from '@smg/game-sdk/crypto';

import type { RoundSettings } from './roundSettings.js';

const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');

export interface NewSession<Cfg> {
  readonly roundId: string;
  readonly settings: RoundSettings<Cfg>;
  readonly season: Season;
  // 32 bytes from a CSPRNG (the SecureRandom port, 04 §5.4).
  readonly seed: Uint8Array;
}

export class RoundSession<S, A, E, Cfg, Sec> {
  private secrets: Sec | null = null;

  private constructor(
    private readonly module: GameModule<S, A, E, Cfg, Sec>,
    private readonly seed: Uint8Array,
    private current: RoundState<S, Cfg>,
  ) {
    if (seed.byteLength !== SEED_BYTES) {
      throw new Error(`a round seed has ${String(SEED_BYTES)} bytes`);
    }
    this.derive();
  }

  static create<S, A, E, Cfg, Sec>(
    module: GameModule<S, A, E, Cfg, Sec>,
    round: NewSession<Cfg>,
  ): { session: RoundSession<S, A, E, Cfg, Sec>; event: RoundEvent<E, A, Cfg> } {
    const { state, event } = createRound<S, A, E, Cfg>({
      roundId: round.roundId,
      config: round.settings.platform,
      gameConfig: round.settings.game,
      season: round.season,
      commitment: round.settings.platform.commitReveal ? hex(commitSeed(round.seed)) : null,
    });
    return { session: new RoundSession(module, round.seed, state), event };
  }

  // After a restart: the state the committed log describes, secrets derived again.
  static recover<S, A, E, Cfg, Sec>(
    module: GameModule<S, A, E, Cfg, Sec>,
    seed: Uint8Array,
    log: readonly RoundEvent<E, A, Cfg>[],
  ): RoundSession<S, A, E, Cfg, Sec> {
    return new RoundSession(module, seed, replayRound(module, log));
  }

  // After a restart with a snapshot: the snapshot's state with the log's tail folded on.
  static resume<S, A, E, Cfg, Sec>(
    module: GameModule<S, A, E, Cfg, Sec>,
    seed: Uint8Array,
    snapshot: RoundState<S, Cfg>,
    tail: readonly RoundEvent<E, A, Cfg>[],
  ): RoundSession<S, A, E, Cfg, Sec> {
    const state = tail.reduce((s, e) => evolveRound(module, s, e), snapshot);
    return new RoundSession(module, seed, state);
  }

  get state(): RoundState<S, Cfg> {
    return this.current;
  }

  handle(cmd: RoundCommand<A>): StepResult<S, A, E, Cfg> {
    const result = stepRound(this.current, cmd, {
      module: this.module,
      secrets: this.secrets,
      rng: roundRng(this.seed),
      seed: hex(this.seed),
    });
    this.current = result.state;
    this.derive();
    return result;
  }

  // The result view, only once the round has ended (never while it runs, 02 §11).
  result(): unknown {
    const { status, game } = this.current;
    if (status !== 'ended' || game === null || this.secrets === null) return null;
    return this.module.views.result(game, this.secrets);
  }

  // When the round next has to run without any player action (open, special, end).
  nextDue(): number | null {
    return nextDue(this.current, this.module);
  }

  // The seed (hex) once the round has ended with the fairness proof on (02 §10).
  revealedSeed(): string | null {
    const { status, config } = this.current;
    return status === 'ended' && config.commitReveal ? hex(this.seed) : null;
  }

  // Secrets exist from the moment the roster is frozen.
  private derive(): void {
    if (this.secrets !== null || this.current.game === null) return;
    const input = roundInput(this.current, rosterPlayers(this.current));
    this.secrets = this.module.deriveSecrets(input, roundRng(this.seed));
  }
}
