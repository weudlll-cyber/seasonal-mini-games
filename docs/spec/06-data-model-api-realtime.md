# 06 — Data Model, API and Realtime Events

> Part of the Seasonal Mini Games specification. Index: [README](README.md). Bingo references: see [README](README.md) §2.

## 1. Adopted from Bingo

| Topic | Bingo reference | Difference here |
|---|---|---|
| Conventions: PostgreSQL 17, UUIDv7 keys, `timestamptz` UTC, snake_case, `text` + `CHECK` instead of enums, `jsonb` only for documents and event payloads, **no monetary columns**, DB roles | Bingo 04 §1 | Schema `smg`, roles `smg_*`. |
| Identity and access tables (`accounts`, `sessions`, `identity_providers`, `external_identities`, `roles`, `role_permissions`, `role_assignments`, `totp_factors`, `recovery_codes`, token tables, `player_profiles`, badges) | Bingo 04 §3.1 | `player_profiles` counts `rounds_played`, `wins`, `solves` instead of Bingo's counters. |
| Configuration tables (`settings_documents`, `settings_versions`, `embed_origins`) | Bingo 04 §3.2 | No `rulesets`, `ruleset_versions` or `patterns`. Per-game settings are settings documents with id `game.<gameId>` ([08](08-admin-settings.md)). |
| Leaderboard tables (`leaderboard_periods`, `league_entries`, `league_awards`, `leaderboard_adjustments`) | Bingo 04 §3.4 | `league_entries` counts `wins` and `solves` instead of `season_completes`. Adds `team_league_entries` (§2.6). |
| Chat and moderation tables | Bingo 04 §3.5 | None. |
| Notifications, uploads, `audit_log`, `jwt_replay_cache` | Bingo 04 §3.6 | None. |
| `scheduled_actions` with leases | Bingo 04 §3.3 | The `kind` values differ (§2.5). |
| Integrity rule: event logs, published versions and the audit log are immutable by trigger | Bingo 04 §4 | Applies to `round_events`. |
| Migrations: hand-written SQL, checksummed own migrator, applied on start; seed on first install | Bingo 04 §6 | The seed has no rulesets. It holds the settings documents from defaults and the `game.guess-the-number` document. |
| API conventions: `/api/v1`, zod contracts, OpenAPI generation, RFC 9457 problems, cursor pagination, `Idempotency-Key`, session cookie plus CSRF or bearer embed token, rate-limit headers | Bingo 05 §1 | None. |
| Session, auth and profile routes | Bingo 05 §2.1, §2.2 | `POST /dev/sign-in` as Bingo (development builds only). |
| Leaderboard, chat, notification and misc routes (`/config/public`, `/assets`, `/healthz`, `/readyz`, `/metrics` internal only) | Bingo 05 §2.4, §2.5 | Leaderboards add `GET /leaderboards/:periodId/teams`. |
| Admin route layout, permissions per route, audit on every write, step-up | Bingo 05 §3 | Rulesets, patterns and the simulator are replaced by settings documents and `halving-days` (§3.2). |
| Realtime transport (Socket.IO over WebSocket only, `/ws`, namespaces `/play` and `/admin`, connection state recovery, frame limits) | Bingo 06 §1 | None. |
| Handshake and auth, session revocation push | Bingo 06 §2 | A socket may be in at most 3 match rooms. |
| Message envelope, client `seq` replay protection, server `s` gap detection and resync, acknowledgements | Bingo 06 §4 | The intent and event sets are in §4. |
| Backpressure and limits; observability | Bingo 06 §8, §10 | Guess limits in [05](05-security-threat-model.md) §5. Metrics in §4.6. |

## 2. New tables

### 2.1 `matches`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| code | text UNIQUE | short public code (Bingo 02 §7) |
| game_id | text | a registered game module id, e.g. `guess-the-number`; CHECK against the registry at write time in the use case |
| title | text | |
| status | text | `lobby`, `open` (rounds may run), `closed`, `aborted` |
| visibility | text | `public`, `unlisted` |
| max_players | int | within `match.maxPlayers` bounds |
| counts_for_leaderboard | bool | default true |
| created_by | uuid FK accounts | the host |
| created_at, closed_at | timestamptz | |
| aborted_reason, aborted_by | text NULL | as Bingo D17 (`host` or `system`) |
| version | bigint | optimistic concurrency |

### 2.2 `match_players`

`match_id`, `player_key text` (the account id, or `bot-NN` for bots of the development Quick Test), `account_id uuid NULL` (NULL for bots), `joined_at`, `left_at NULL`, `state` (`active`, `left`, `kicked`), `team text NULL` (`spring`/`summer`/`autumn`/`winter`), `team_chosen_at NULL`. PK `(match_id, player_key)`. Index `(account_id, match_id)`. This follows Bingo's built pattern (`player_id` as the key in Bingo's migration 0003), not the `(match_id, account_id)` key that Bingo 04 §3.3 states.

### 2.3 `rounds`, `round_events`, `round_snapshots`

**rounds**

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| match_id | uuid FK | |
| round_index | int | 1, 2, 3 … per match; UNIQUE `(match_id, round_index)` |
| game_id | text | copied from the match |
| status | text | `created`, `countdown`, `open`, `ended`, `aborted` |
| secret_mode | text | `shared` / `individual` |
| season | text | `spring` / `summer` / `autumn` / `winter` |
| season_source | text | `inSeason` / `manual` |
| special_on | bool | season special switched on |
| halving | bool | halving round |
| teams_on | bool | shared mode only (CHECK `teams_on → secret_mode = 'shared'`) |
| cooldown_ms | int | CHECK 3000–60000 (owner); the starting value |
| settings | jsonb | all frozen round settings, platform and game, validated by the contracts |
| seed_commitment | bytea NULL | `sha256(seed)` when the fairness proof is on |
| seed_enc | bytea | AES-256-GCM with `SMG_ROUND_KEY`; returned only for `ended` / `aborted` rounds |
| opens_at, ended_at | timestamptz NULL | |
| end_reason | text NULL | `solved`, `allSolved`, `timeUp`, `host`, `noPlayers` |
| aborted_reason, aborted_by | text NULL | |
| created_by | uuid FK | |

**round_events** — `round_id`, `seq bigint`, `type text`, `payload jsonb`, `occurred_at`, `actor_account_id NULL`. PK `(round_id, seq)`. **Append-only** by trigger: UPDATE and DELETE are rejected for every role. Payload schemas per type live in `packages/contracts/src/events/` (platform) and `games/<game>/src/events.ts` (game). Matches and rounds made by tests are aborted, never deleted.

**round_snapshots** — `round_id`, `seq`, `state jsonb` (contains no secret: secrets are derived again on load), `created_at`. Every 200 events. Keep the last 2 while a round runs and only the last after the end.

### 2.4 `round_results`

`round_id`, `player_key` (account id, or `bot-NN` in development), `place int NULL` (NULL = took part / not solved), `solved bool`, `solve_receive_seq bigint NULL`, `solve_at timestamptz NULL`, `guesses int`, `team text NULL`, `points int`, `secret int NULL` (individual mode, written at the end only). PK `(round_id, player_key)`. UNIQUE `(round_id, place)` WHERE `place IS NOT NULL`, so two players can never share a place. Written in the transaction that appends `RoundEnded`.

**round_team_results** — `round_id`, `team`, `members int`, `points int`, `won bool`. PK `(round_id, team)`.

### 2.5 Projections and scheduling

- **match_standings** — `match_id`, `player_key`, `points`, `wins`, `first_win_at NULL`, `rank`. PK `(match_id, player_key)`. Updated with `RoundEnded`.
- **match_team_standings** — `match_id`, `team`, `points int`, `wins`, `first_win_at NULL`, `rank`. PK `(match_id, team)`.
- **scheduled_actions** (Bingo 04 §3.3) — `kind` values: `round_open`, `special` (payload: special and index), `round_time_up`, `match_autostart`.

### 2.6 Seasons and leaderboard additions

- **season_feed_state** — single row: `season text NULL`, `token text NULL`, `since timestamptz NULL`, `fetched_at timestamptz NULL`, `last_error text NULL`.
- **halving_days** — `day date`, `token text`, `source` (`feed` / `admin`), `created_by NULL`, `created_at`. PK `(day, token)`. Edits are audited.
- **team_league_entries** — `period_id`, `team`, `points int`, `wins int`, `updated_at`. PK `(period_id, team)`.

### 2.7 Round event types (platform)

`RoundCreated` (settings, commitment), `CountdownStarted` (roster, teams, `opensAt`), `RoundOpened`, `GuessAccepted` (`playerKey`, `receiveSeq`, `receivedAt`, `value`, `cooldownEndsAt`), `SpecialFired` (special, index, effect summary), `CooldownChanged` (new value), `PlayerSolved` (`playerKey`, `receiveSeq`, `place`), `HeldDelivered` (Frost: `upTo`, the last log seq delivered; written by the round actor, DECISIONS T41), `RoundEnded` (reason, placings, team results, seed when revealed), `RoundAborted` (reason, by), `MarginNoted` (`playerKey`, `ms`: the first would-be correct guess after a shared win inside `round.marginWindowS`, [02](02-game-guess-the-number.md) §9). A game event is logged as `Game` (`audience`, `feedback`, `event`).

Game events of Guess The Number: `FeedbackGiven` (`playerKey`, `receiveSeq`, `receivedAt`, `value`, `feedback`; to the guesser, marked `feedback: true`), `GuessFed` (`playerKey`, `guesses`, plus `value` and `feedback` as the visibility allows; to the room, marked `feedback: true` when it carries an answer). No event carries a narrowed range (owner decision 17), `HintGiven` (Spring Herald: `playerKey` or null for the shared hint, `hint`), `NumbersRemoved` (Leaf Fall: `index`, `numbers`), `RangeHalved` (`index`, `playerKey` or null, `range` or null, `size`: the shared window, a player's own range, or the room's line with the size).

Rejected guesses are **not** events. They are counted in metrics and in the abuse score only.

### 2.8 Sizing

A shared round with 500 players, 10 s cooldown, lasting 5 minutes: at most 15 000 accepted guesses, about 45 000 events (`GuessAccepted`, `FeedbackGiven`, `GuessFed` per guess), about 9 MB. At 50 such rounds a day that is under 10 GB a month before compaction. The events of rounds older than 90 days are compacted: `round_results` stay, `round_events` of type `GuessAccepted`, `FeedbackGiven` and `GuessFed` move to a compressed archive table, and the hash of the moved rows stays in place so that the log remains verifiable.

## 3. HTTP API

### 3.1 Player and host routes (base `/api/v1`)

| Method | Path | Body | Who |
|---|---|---|---|
| GET | `/games` | — | anyone: registered games with name and supported modes |
| GET | `/matches?status=&game=` | — | anyone: public matches in the lobby or open, and those ended in the last day |
| POST | `/matches` | `{ gameId, title, visibility, maxPlayers, countsForLeaderboard? }` | `match.create` |
| GET | `/matches/:code` | — | anyone: summary (`youHost`, player count, current round summary, `nextRoundDefaults` for the host) |
| POST | `/matches/:code/join` · `/leave` | `{}` | `match.join` |
| POST | `/matches/:code/team` | `{ team }` | a match player; refused with `TEAMS_LOCKED` during a countdown or open round |
| POST | `/matches/:code/rounds` | `{ settings, startNow? }` (platform round settings of [02](02-game-guess-the-number.md) §3 and the game's settings) | the host (`round.manage`); 422 `ROUND_SETTINGS_INVALID`, 409 `ROUND_RUNNING`, 409 `NOT_A_HALVING_DAY`, 409 `IN_SEASON_UNAVAILABLE` |
| POST | `/rounds/:id/start` · `/end` · `/abort` | `{}` · `{}` · `{ reason }` | the host |
| GET | `/rounds/:id/state?since=` | — | anyone allowed to watch: the caller's view (player, spectator or result) and the event seq; `since` gives a delta |
| POST | `/rounds/:id/guesses` | `{ value }` | a roster player: the HTTP fallback, same queue and checks |
| GET | `/rounds/:id/result` | — | anyone, after the end: placings, team results, secret(s), seed if revealed |
| GET | `/rounds/:id/verify` | — | anyone, after the end with the fairness proof on: seed, settings, roster, the accepted guesses in receive order |
| POST | `/matches/:code/close` · `/abort` | `{}` · `{ reason }` | the host |
| GET | `/seasons/current` | — | anyone: the In Season answer if usable, today's halving status |
| GET | `/me/matches` | — | the signed-in account |

### 3.2 Admin routes (`/api/v1/admin`)

As Bingo 05 §3 for dashboard, settings, integrations, accounts, moderation, uploads, audit and abuse. Additionally:

| Area | Routes | Permission |
|---|---|---|
| Matches and rounds | `GET /matches`, `GET /rounds/:id`, `POST /rounds/:id/abort`, `POST /matches/:id/kick`, `POST /rounds/:id/results/:playerKey/remove` (reason required) | `match.abort` / `match.manage` / `leaderboard.adjust` |
| Seasons | `GET /seasons/feed`, `POST /seasons/feed/refresh`, `GET/POST/DELETE /halving-days` | `season.manage` |
| Game settings | `GET/PUT /settings/game.<gameId>` with versions and rollback as Bingo | `settings.game.edit` |

## 4. Realtime

### 4.1 Connection and clock offset

- Handshake as Bingo 06 §2.
- After connecting, the client sends `time.sync` three times. The server answers with its clock each time. The client keeps the offset of the reply with the shortest round trip. Every server time (`opensAt`, `cooldownEndsAt`, special due times) is shown corrected by it. The offset is used for display only and never sent back.

### 4.2 Rooms

| Room | Members | Receives |
|---|---|---|
| `match:<id>` | everyone watching the match | match lifecycle, roster and team changes, round room events, standings |
| `match:<id>:player:<accountId>` | that player's sockets | own guess results, feedback, hints, own range changes |
| `match:<id>:host` | the host's sockets | host-only notices (e.g. "In Season not available") |
| `chat:<roomId>`, `lobby`, `admin:dashboard` | as Bingo 06 §3 | as Bingo |

### 4.3 Client → server intents

| `t` | Data | Notes |
|---|---|---|
| `match.watch` / `match.unwatch` | `{ code }` | As Bingo |
| `time.sync` | `{}` | Answers `{ serverTime }` |
| `guess` | `{ roundId, value }` | Acknowledged with `{ ok: true, receiveSeq, cooldownEndsAt }` or `{ ok: false, code, until? }`. Codes: `ROUND_NOT_OPEN`, `ROUND_OVER`, `NOT_IN_ROUND`, `ALREADY_SOLVED`, `OUT_OF_RANGE`, `NUMBER_REMOVED`, `ALREADY_GUESSED`, `COOLDOWN_ACTIVE` (with `until`), `RATE_LIMITED`, `ROUND_BUSY`, `RESYNC`. The ack comes after group commit ([04](04-software-architecture.md) §5.3). |
| `team.choose` | `{ code, team }` | Same rule as `POST …/team` |
| `round.start` / `round.end` / `round.abort` | `{ roundId, reason? }` | Host; same as the HTTP routes |
| `chat.send`, `chat.typing`, `presence.ping` | as Bingo 06 §4.1 | |

### 4.4 Server → client events

On the wire, committed events arrive as `events` frames (Bingo 06 §4, as built; DECISIONS T35). The match room gets `{ roundId, s, events: [{ s, at, event }] }` with every seq of the batch, so a gap means a missed frame; an event not meant for the room is `null` there. A player's room gets `{ roundId, events }` with only that player's own events, the host room likewise. The `event` values are the projected public or per-player forms below:

| Event | Room | Data |
|---|---|---|
| `match.updated` | match | status, player count, teams |
| `round.created` | match | round summary: season, special, halving, mode, cooldown, range (none while the range is hidden, DECISIONS T52), commitment |
| `round.countdown` | match | `opensAt`, roster size, teams |
| `round.opened` | match | — |
| `guess.feed` | match | per `feedbackVisibility` ([02](02-game-guess-the-number.md) §6.2): `{ player, guesses }`, plus `value` and/or `feedback` when allowed |
| `guess.result` | player | `{ receiveSeq, value, feedback }`; under Frost sent at `receivedAt + delay` |
| `hint` | player (individual) / match (shared) | Spring Herald text and type |
| `special.fired` | match | `{ special, index, summary }`, e.g. Leaf Fall's removed numbers, Heatwave's new cooldown, a shared halving window |
| `range.changed` | player | individual-mode halving: the player's own new range |
| `player.solved` | match | `{ player, place }` (individual) |
| `round.ended` | match | reason, placings, team results, secret(s), seed when revealed |
| `round.aborted` | match | reason, by |
| `standings.updated` | match | match standings and team standings (deltas, at most 2/s) |
| `resync` | any | reload state |

### 4.5 Flow of one guess

```
client `guess` ─► gateway: schema, socket seq, rate limit ─► append to round queue (synchronous)
   round actor (one at a time): assign receiveSeq + receivedAt
     ─► platform checks (02 §5.1, cooldown last) ─► game.decide ─► events + signals
     ─► platform: Solved? → placing / winner / end; cooldownEndsAt = receivedAt + cooldown
     ─► add events to current batch
   batch commit (≤ 20 ms) ─► ack to sender ─► `guess.result` to player room (or held for Frost)
                          ─► `guess.feed` / `player.solved` / `round.ended` to match room
```

Budget at 500 players and a 3 s cooldown: about 170 accepted guesses a second for one round, each one queue step of well under 1 ms. Targets are in [09](09-testing-strategy.md) §5.

### 4.6 Metrics (in addition to Bingo 06 §10)

`smg_guess_total{result}`, `smg_guess_ack_seconds`, `smg_round_queue_depth`, `smg_round_batch_seconds`, `smg_special_lag_seconds`, `smg_frost_delivery_lag_seconds`, `smg_ws_rtt_seconds`, `smg_rounds{status}`, `smg_season_feed_age_seconds`.
