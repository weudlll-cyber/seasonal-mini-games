# 04 — Software Architecture

> Part of the Seasonal Mini Games specification. Index: [README](README.md). Bingo references: see [README](README.md) §2.

## 1. Architectural drivers (what is different from Bingo)

| Driver | Consequence |
|---|---|
| Several games on one platform, added one by one | A **game-module contract** (§4) separates platform from games. A new game is a new package plus one registry line, and never a platform change. |
| "First received wins" (owner, decision 4) | Every round has **one ordered queue** on one instance (§5.2). Order is assigned there and nowhere else. |
| Per-player cooldown, no global tick (owner, decision 3) | Cooldown is a **check** on a stored end time, not a timer (§5.5). There is nothing to tick. |
| High-frequency player input | Guesses are the hot path. Every player may send one every 3 s, and with a shared secret every guess must go through the round's order. Persistence uses group commit (§5.3). |
| Secrets must not leak | Views are produced by the game module per viewer. A platform test checks every view of every module for secrets (§4.5, [09](09-testing-strategy.md) §3). |
| Everything else as Bingo | Modular monolith, hexagonal layers, server-authoritative, configurable without code, standalone and embeddable (Bingo 02 §1). |

## 2. Adopted from Bingo

### 2.1 Adopted sections

Each row is built as Bingo specifies, with the names of §2.2. "Difference" lists everything that is not as in Bingo.

| Topic | Bingo reference | Difference here |
|---|---|---|
| Modular monolith, one Node.js process, stateless apart from the database | Bingo 02 §1 | None. |
| System context (Caddy → app → PostgreSQL, optional SMTP and Web Push) | Bingo 02 §2 | The app is `smg-server`. The Seasonal Entertainment website signs in through `jwt-handoff` (Bingo D3), so the diagram's "OIDC" for the website does not apply. The website is also the source of the In Season feed ([07](07-integration.md) §5). |
| Hexagonal layers and the dependency rule, enforced by lint | Bingo 02 §3 | Adds `packages/game-sdk` and `games/*` (§3). |
| Bounded contexts communicating through domain events on an in-process bus | Bingo 02 §4 | "Match" becomes **Match & Round** (§6). "Configuration" holds settings documents and per-game settings instead of rulesets and patterns. |
| Functional core: commands → `decide(state, command, ctx) → events`, `evolve(state, event) → state` | Bingo 02 §5.1 | The command set is in §5.1. Game modules use the same pattern (§4). |
| Event log + snapshots, recovery on restart | Bingo 02 §5.2 | The log is per **round** (`round_events`), with snapshots every 200 events. Acknowledgements wait for group commit (§5.3). |
| DB-backed scheduler (`scheduled_actions`, `FOR UPDATE SKIP LOCKED`, leases) | Bingo 02 §5.3 | Polls every 100 ms while a round is open. Precision target: a special fires within 150 ms of its due time (p95). |
| Per-match command serialization | Bingo 02 §5.4 | It is per **round**, and guesses go **through** the queue. Bingo's off-the-aggregate mark path does not apply (§5.2). |
| Configuration model: typed settings documents, versioned, audited, defaults in `contracts`, min/max per key | Bingo 02 §6 | No rulesets. Per-game settings documents and round settings frozen per round ([08](08-admin-settings.md)). |
| Cross-cutting: zod at every boundary, `Result` errors and RFC 9457, `Clock` port, `SecureRandom` port, Pino logging, English strings files, UUIDv7 IDs and short public codes | Bingo 02 §7 | The per-match `Drbg` becomes a per-round DRBG (§5.4). |
| Scale path (Redis adapter, several instances, Kubernetes) | Bingo 02 §8, Bingo 06 §9 | Step 1 also routes all sockets of a match to the instance that holds its round lease (§5.6). |
| Technology decisions (TypeScript strict, Node.js 22, Fastify 5, Socket.IO 4, PostgreSQL 17, `pg` with parameterized SQL and the own migrator, React 19 + Vite, TanStack Query, Zustand, CSS Modules with tokens, Motion, Pino, prom-client, Vitest, fast-check, Testcontainers, Playwright, pnpm workspaces, GitHub Actions, Docker multi-stage non-root) | Bingo 02 §9 | Load testing uses a Node.js driver as Bingo actually built (`load/drawLatency.mjs`), not k6 (DECISIONS T9). |
| Security architecture | Bingo 03 | See [05](05-security-threat-model.md) §1 for what is adopted and what is new. |
| Database conventions, identity and configuration tables, audit log | Bingo 04 §1, §3.1, §3.2, §3.6 | See [06](06-data-model-api-realtime.md) §1. |
| API conventions, auth and profile routes, admin route layout | Bingo 05 §1, §2.1, §2.2, §3 | See [06](06-data-model-api-realtime.md) §3. |
| Realtime transport, handshake, rooms, envelope, limits, observability | Bingo 06 §1–§4, §8, §10 | See [06](06-data-model-api-realtime.md) §4. |
| Integration: identity adapters, embedding, chat providers, webhooks, public read API | Bingo 07 | See [07](07-integration.md). |
| DevOps: environments, branching, CI jobs, containers, configuration, observability, patch policy, developer experience | Bingo 08 | See [10](10-repository-structure.md) §5. Ports differ (§4 there). |
| Deployment: single VPS with Compose, both install types, `sbr` CLI, backups, hardening | Bingo 09 | See [10](10-repository-structure.md) §6. |
| Repository structure, size rules, file header, naming, commits, review checklist, CLAUDE.md outline | Bingo 10 §1–§6 | See [10](10-repository-structure.md). |
| Admin panel principles (schema-driven forms, versions, confirm and step-up) | Bingo 11 §1 | See [08](08-admin-settings.md) §1. |
| Testing principles, pyramid, security tests, test data rules | Bingo 12 §1, §2, §6, §7 | See [09](09-testing-strategy.md). |
| Threat model method (STRIDE per boundary) and Bingo's threats T1–T28 | Bingo 13 | See [05](05-security-threat-model.md) §8. |

### 2.2 Names

| Bingo | Here |
|---|---|
| Package scope `@sbr/*` | `@smg/*` |
| Env prefix `SBR_` | `SMG_` |
| DB schema `sbr`, roles `sbr_app` / `sbr_migrator` / `sbr_readonly` | `smg`, `smg_app` / `smg_migrator` / `smg_readonly` |
| Cookies `__Host-sbr_session` / `__Secure-sbr_session` | `__Host-smg_session` / `__Secure-smg_session` |
| CLI `sbr`, install root `/opt/sbr`, config `/etc/sbr`, backups `/var/backups/sbr` | `smg`, `/opt/smg`, `/etc/smg`, `/var/backups/smg` |
| Compose projects `sbr-prod`, `sbr-staging`, `sbr-dev` | `smg-prod`, `smg-staging`, `smg-dev` |
| Base path on the website `/games/bingo` | `/games/mini-games` (DECISIONS T2) |
| Embed markup `data-sbr-embed`, postMessage `source: "sbr"`, types `sbr:*` | `data-smg-embed`, `source: "smg"`, `smg:*` |
| Website chat room slug `bingo` | `mini-games` |
| Metrics prefix `sbr_` | `smg_` |
| JWT audience `seasonal-bingo-royale` | `seasonal-mini-games` |

## 3. Layers

```
packages/game-sdk     The game-module contract (types) and pure helpers every game may use:
                      setting definitions, range arithmetic, view helpers. Free of node:crypto.
                      Its second entry @smg/game-sdk/crypto holds the DRBG and the commitment
                      for the platform (a game only receives a RoundRng). Depends only on zod.
packages/domain       Platform rules: match and round lifecycle, roster, cooldown, receive order,
                      placings, season and special scheduling, teams, standings. Pure.
packages/application  Use cases and ports (Clock, SecureRandom, RoundStore, Scheduler, EventBus,
                      SeasonFeed). Hosts the round engine (§5). No framework imports.
packages/contracts    Zod schemas for every platform wire shape and settings document.
packages/ui           Shared React components and design tokens.
games/<game>/src      One game's rules, settings schema and views. Pure. Implements game-sdk.
games/<game>/web      That game's screen (React). Depends on game-sdk, ui and its own src.
games/registry        The list of installed game modules (package @smg-game/registry; src/ for
                      the server, web/ for the player client): the only place that names them.
                      Game packages are named @smg-game/<game> (DECISIONS T22).
apps/server           Adapters (Fastify, Socket.IO, Postgres, identity, scheduler, feed client) and
                      the composition root. Imports games/registry, never a game directly.
apps/web              Player client. Renders a game through games/registry (web entries).
apps/admin            Admin client (as Bingo). apps/embed-loader: embed.js (as Bingo).
```

**Dependency rule** (enforced with `eslint-plugin-boundaries`, as Bingo 02 §3):

- `game-sdk` ← `domain` ← `application` ← `apps/server`. `contracts` may be imported by `application`, `apps/*` and `games/*/web`.
- `games/<game>/src` may import `game-sdk` and zod only. `games/<game>/web` may import `game-sdk`, `ui`, React and its own `src`.
- No platform package imports `games/<game>` directly. Only `apps/server` and `apps/web` import `games/registry` (its `src` and its `web` half respectively).
- No game imports another game. Shared code between games goes into `game-sdk` (decided per case; whether there is one shared guess engine is decided when the second game that could use it starts, DECISIONS T21).

## 4. The game-module contract

A game is one object that implements `GameModule` from `packages/game-sdk` (`packages/game-sdk/src/module.ts`). The shape below is the one built in the first work package (night run P3, DECISIONS T29). Any change to it is a spec change.

```ts
interface GameModule<S, A, E, Cfg, Sec> {
  meta: {
    id: string;                 // 'guess-the-number' — URL- and DB-safe, never reused
    name: string;               // 'Guess The Number'
    contractVersion: 1;         // the game-sdk contract version it implements
    timing: 'cooldown';         // §4.3 ('own' joins with the first long-running game)
    secretModes: ReadonlyArray<'shared' | 'individual'>;
    teams: boolean;             // supports season teams (shared mode)
  };
  settings: {
    defs: SettingDef[];         // the game's own keys of document game.<id> (08 §3)
    read(values): Cfg;          // frozen values → the game's config
    problem(cfg: Cfg): string | null;  // a rule across keys
  };
  actionSchema: ZodType<A>;     // the payload of one player action (a guess)
  deriveSecrets(input: RoundInput<Cfg>, rng: RoundRng): Sec;  // secrets are made here, never stored
  createRound(input: RoundInput<Cfg>): S;                     // state holds no secret
  validate(state: S, playerId: string, action: A): string | null; // the game's own checks
  decide(state: S, act: PlayerAction<A>, ctx: GameCtx<Sec>): Decision<E>;
  evolve(state: S, event: E): S;
  views: {
    player(state: S, playerId: string, ctx: ViewCtx): unknown; // zod-validated by viewSchemas.player
    spectator(state: S, ctx: ViewCtx): unknown;
    result(state: S, secrets: Sec): unknown;   // only after the round has ended
  };
  viewSchemas: { player: ZodType; spectator: ZodType; result: ZodType };
  specials?: Partial<SpecialHooks<S, E>>;      // §4.4, joins with the seasonal specials
}
```

The registry lists each game as one entry `{ module, conformance, devBot }`, where `conformance` is the game's kit for the shared suite (§4.5): a round input, sentinel secrets and actions that never hit a secret; `devBot` picks a development bot's next action from that bot's own player view (Quick Test, DECISIONS T36).

### 4.1 What the platform gives a game

- `RoundInput`: round id, the frozen roster (player ids and teams), secret mode, the season, whether a halving round runs, and the game's own frozen config. The platform's round values (cooldown, countdown, points, …) are keys of every game's document as well, defined once in `packages/game-sdk/src/roundSettings.ts`.
- `RoundRng`: the round's deterministic generator (§5.4), separated by label. A game asks `rng.child('secret', playerId).intBetween(lo, hi)`, so it never sees the seed.
- `PlayerAction { playerId, receiveSeq, receivedAt, action: A }`: an ordered player action that passed every check (round open, on roster, not solved, the game's `validate`, cooldown over).
- `GameCtx`: `now` (the processing time), the cooldown in force, the round's `secrets` and `rng`.
- `ViewCtx`: `releasedBefore`. Answers to guesses received at or after it are still held by Frost and appear in no view.

### 4.2 What a game gives back

`Decision<E>` is `{ ok: true, events: Emitted<E>[], signals: Signal[] } | { ok: false, code: string }`.

- `events` are the game's own domain events, each with its `audience` (`room`, `player:<id>` or `host`) and optionally `feedback: true`, which makes the platform hold it back for Frost (§4.4). The platform appends them to the round's log, folds them with `evolve` and routes each to its audience.
- `signals` tell the platform about outcomes without the platform knowing the game:
  - `Solved { playerId }`: this action solved the player's secret.
  - `RoundShouldEnd { reason }`: for game-specific end conditions.
- Rejections come in the order of [02](02-game-guess-the-number.md) §5.1: the platform's codes for state, roster and solved (`ROUND_NOT_OPEN`, `ROUND_OVER`, `NOT_IN_ROUND`, `ALREADY_SOLVED`), then the game's `validate` (for example `OUT_OF_RANGE`, `NUMBER_REMOVED`), then the platform's `COOLDOWN_ACTIVE`. `validate` is pure and gives no event. `decide` runs only for an action that passed all of them.

**Winning stays in the platform.** From the `Solved` signals and their receive order, the platform applies the owner's rules: in shared mode the first `Solved` wins and ends the round, and in individual mode solve order is placing order (owner, decisions 4 and 5). Every later game with these modes inherits the rules unchanged.

### 4.3 Timing classes

- `cooldown`: the platform enforces the per-player cooldown of owner decision 3 (range 3–60 s, the same for all, no global tick) before a `PlayerAction` reaches the game. Heatwave and Frost apply automatically.
- `own`: for games designed as long-running (owner, decision 3). The game will declare its timers (`ownTimers`), and the platform schedules them. There is no cooldown, Heatwave or Frost. No v1 game uses this class, so it joins the contract with the first long-running game, as a contract change of its own (§4.6).

### 4.4 Specials

| Special | Implemented by | Contract |
|---|---|---|
| Heatwave | Platform | Changes the round's cooldown value. The game sees it only through `ctx`. |
| Frost | Platform | Delays delivery of events marked `feedback: true` by `winter.delayS`. Signals and order are not delayed ([03](03-seasonal-specials.md) §2.4). |
| Spring Herald | Game hook `springHerald(state, ctx) → E[]` | Returns one hint event per player (or one room event in shared mode). |
| Leaf Fall | Game hook `leafFall(state, ctx, count) → E[]` | Removes `count` values that are no one's secret. |
| Halving | Game hook `halving(state, ctx) → E[]` | Halves the range around each secret. |

A season whose special the game does not implement still runs as a season round without a special. The host form says "This game has no Autumn special". The halving option is offered only for games that implement `halving`.

### 4.5 Rules every game module must pass

The platform runs one shared conformance test suite against every module in `games/registry` ([09](09-testing-strategy.md) §3, invariants P1–P6): determinism from the seed, no secret in any player or spectator view, views valid against `viewSchemas`, rejections free of side effects, `evolve` replay equal to live state, and special hooks that change the same things for every player.

### 4.6 Adding a game

1. Create `games/<game>/` with `src/` (module, settings defaults, tests) and `web/` (screen, strings).
2. Add one line to each half of `games/registry` (`src/index.ts` and `web/index.ts`).
3. Add its settings to [08](08-admin-settings.md) and its rules to a new spec section.

No file in `packages/` or `apps/` changes. If a game needs something the contract does not offer, the contract is changed first in its own task with its own spec change, and is never worked around inside the game.

## 5. The round engine

### 5.1 Commands

Platform commands on a round: `createRound`, `startCountdown`, `openRound`, `submitAction` (a guess), `fireSpecial`, `deliverHeld` (Frost), `endRound`, `abortRound`. Platform commands on a match: `openMatch`, `joinMatch`, `leaveMatch`, `chooseTeam`, `closeMatch`, `abortMatch`. All of them follow `decide`/`evolve` (Bingo 02 §5.1).

### 5.2 One ordered queue per round

- Every round in `countdown` or `open` has one **round actor** on exactly one server instance. The actor holds the round state in memory and a FIFO queue.
- The WebSocket gateway validates the message shape and rate limit, then appends the intent to the round's queue **synchronously, in the order the process reads it from the sockets**. No `await` comes between reading and appending, so no reordering can happen inside the process. Scheduler firings (specials, round end) enter the same queue.
- The actor takes one item at a time. It assigns `receiveSeq` and `receivedAt` when it takes an item, runs the platform checks and then the game's `decide`, and folds the events. Because the queue is FIFO and the actor is single, the receive order is the queue order, and two guesses can never share a position (owner, decision 4).
- HTTP fallback guesses (`POST …/guesses`) enter the same queue.

### 5.3 Persistence: group commit

- Processing results (events) are appended to `round_events` in **batches**: a batch closes after 20 ms or 200 events, whichever comes first, and is written in one transaction.
- Acknowledgements, feedback and broadcasts for a batch are sent **only after its transaction commits**. A crash can therefore lose at most guesses that were never answered. It can never undo a winner who has already been announced.
- While a batch is being written, the actor keeps processing into the next batch. Order is preserved because batches commit in sequence.
- Recovery: the round actor is rebuilt from the latest snapshot plus the tail of `round_events` (Bingo 02 §5.2). Guesses whose batch did not commit never happened; their senders get no acknowledgement and resend.

### 5.4 Randomness and the round seed

- At `createRound` the platform draws a 256-bit **round seed** from the `SecureRandom` port (`crypto.randomBytes`, a CSPRNG).
- All round randomness comes from an HMAC-SHA256 counter DRBG keyed by that seed with domain-separation labels, as Bingo's per-match DRBG (Bingo 01 §9, Bingo `packages/domain/src/draw/drbg.ts`). The labels are `secret/shared`, `secret/<playerId>`, `spring`, `leafFall/<k>`, `halving/<k>/<playerId|shared>` and `teams/tiebreak`.
- Uniform integers use rejection sampling, never a modulo.
- The seed is stored encrypted (AES-256-GCM, key from `SMG_ROUND_KEY`) and decrypted only inside the round engine. Secrets are **derived** from the seed when needed and are never stored as a column ([05](05-security-threat-model.md) §3).
- With the fairness proof on, `sha256(seed)` is published at creation and the seed at the end ([02](02-game-guess-the-number.md) §10).

### 5.5 Time

- **Cooldown has no timer.** The actor stores `cooldownEndsAt` per player and compares it with `receivedAt` (§5.1 check 7 of [02](02-game-guess-the-number.md)). With 500 players there are no 500 timers. That is the "no global tick" of owner decision 3 in code.
- **Scheduled:** round open (`opensAt`), each special's due times, longest round time. These are `scheduled_actions` rows, so they are restart-safe.
- **Frost deliveries** are in-memory timers on the actor (due `receivedAt + delay`). After a restart, every held event that was not delivered is recomputed from the log and sent at its due time, or at once if that time has passed.
- All times are server-clock milliseconds from the `Clock` port. The client shows times corrected by its measured offset ([06](06-data-model-api-realtime.md) §4.1).

### 5.6 Scale-out (documented, not built in v1)

One round runs on one instance under a lease (the `scheduled_actions` lease pattern, Bingo 02 §8). At scale step 1, Caddy routes every socket of a match to the instance holding the lease (sticky by match code). Room broadcasts go through the Socket.IO Redis adapter. An intent that arrives at the wrong instance is refused with `RESYNC` and the client reconnects. It is never forwarded, because forwarding would add a second ordering point.

## 6. Bounded contexts (differences from Bingo 02 §4)

| Context | Responsibility here |
|---|---|
| **Match & Round** | Matches, roster, teams, rounds, round actor, cooldowns, receive order, placings, standings, specials scheduling. Hosts game modules. |
| **Seasons** | The In Season feed, halving calendar, season of a round. New. |
| **Configuration** | Versioned settings documents, per-game settings ([08](08-admin-settings.md)). No rulesets or patterns. |
| **Leaderboard** | As Bingo, plus the team standing ([03](03-seasonal-specials.md) §5). |
| Identity & Access, Chat & Moderation, Notification, Audit | As Bingo 02 §4. |

Events between contexts: `RoundEnded` → Leaderboard (match points, team points), Notification and Chat (system line). `SeasonFeedChanged` → admin dashboard.
