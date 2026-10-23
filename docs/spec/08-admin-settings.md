# 08 — Admin Settings Catalogue

> Part of the Seasonal Mini Games specification. Index: [README](README.md). Bingo references: see [README](README.md) §2.

## 1. Principles (adopted)

- The admin app, its navigation model, and forms generated from the same zod schemas the server validates with (defaults, bounds and help text from schema metadata) are as in Bingo 11 §1.
- Every change is a new version of its settings document, with history, diff and rollback, and is audited ([05](05-security-threat-model.md) §8). Confirm dialogs and 2FA step-up apply as in Bingo 11 §1.
- Bingo's settings documents `security`, `rate_limits`, `branding`, `theme`, `notifications`, `features` and `chat` are adopted with their keys (Bingo 11 §4). This catalogue lists only the keys that are new or different.
- Defaults live in `packages/contracts/src/settings/defaults/` (platform) and `games/guess-the-number/src/settings/defaults.ts` (game). The tables below are the specification of those files.
- Navigation differs from Bingo 11 §2: **Game rules** becomes **Games** (per-game settings and bounds), and a new **Seasons** area holds the feed status and halving days.

## 2. How to read the tables

- **Status:** *owner* = decided by the owner (2026-10-24); *proposal* = a value the owner did not give, listed as an owner question in [OPEN.md](../OPEN.md); *technical* = a technical choice ([DECISIONS.md](../DECISIONS.md)).
- **Who:** *host* = the match's host chooses it per round, inside the bounds; *game admin* = permission `settings.game.edit` (role `game_admin`) sets the default and may narrow the min/max shown here, never widen them; *security admin* = role `security_admin`; *season admin* = permission `season.manage`.
- **Running rounds:** *frozen* = copied into the round at creation, so a change affects only rounds created afterwards; *immediate* = takes effect at once, also in running rounds; *next* = used the next time the value is read (stated per row).

## 3. Round and game settings (document `game.guess-the-number`)

| Key | Default | Min | Max | Status | Who | Running rounds |
|---|---|---|---|---|---|---|
| `round.secretMode` | `shared` | — | — (`shared`, `individual`) | modes: owner; default: proposal | host | frozen |
| `round.cooldownS` | 10 | 3 | 60 | bounds: owner; default: proposal | host | frozen (changed only by Heatwave) |
| `round.rangeLow` | 1 | 0 | 999 990 | proposal | host | frozen |
| `round.rangeHigh` | 1 000 | `rangeLow` + 9 | 1 000 000 | proposal | host | frozen |
| `round.countdownS` | 5 | 3 | 30 | proposal | host | frozen |
| `round.maxDurationMin` | 10 | 1 | 60 | proposal | host | frozen |
| `round.feedbackVisibility` | `own` | — | — (`own`, `numbers`, `full`) | proposal | host (shared mode) | frozen |
| `round.seasonSource` | `inSeason` | — | — (`inSeason`, `manual`) | owner (default: proposal) | host | frozen |
| `round.specialOn` | true | — | — | proposal | host | frozen |
| `round.teamsOn` | true | — | — | proposal | host (shared mode) | frozen |
| `round.halving` | false | — | — | owner (only on a halving day) | host | frozen |
| `round.repeatGuessRejected` | true | — | — | proposal | game admin | frozen |
| `spring.hintType` | `parity` | — | — (`parity`, `half`) | proposal | game admin | frozen |
| `summer.stepS` | 1 | 1 | 10 | proposal | game admin | frozen |
| `summer.stepIntervalS` | 30 | 5 | 300 | proposal | game admin | frozen |
| Heatwave floor | 3 s | — | — | owner (not a setting) | — | — |
| `autumn.intervalS` | 20 | 5 | 120 | proposal | game admin | frozen |
| `autumn.count` | 10 | 1 | 100 | proposal | game admin | frozen |
| `autumn.minRemaining` | 10 | 2 | 1 000 | proposal | game admin | frozen |
| `winter.delayS` | 3 | 1 | 10 | proposal | game admin | frozen |
| `halving.intervalS` | 60 | 15 | 600 | proposal | game admin | frozen |
| `halving.minRangeSize` | 8 | 2 | 100 | proposal | game admin | frozen |
| `teams.scoring` | `wins` | — | — (`wins`, `perMember`) | proposal (owner question (d)) | game admin | frozen |
| `teams.pointsPerWin` | 1 | 1 | 100 | proposal | game admin | frozen |
| `points.sharedWinner` | 10 | 0 | 1 000 | proposal | game admin | frozen |
| `points.individualPlaces` | `[10, 7, 5, 3]` | each 0 | each 1 000, at most 20 entries | proposal | game admin | frozen |
| `points.individualOtherSolver` | 1 | 0 | 1 000 | proposal | game admin | frozen |
| `fairness.commitReveal` | true | — | — | proposal (owner question (a)) | game admin | frozen |

The host form shows each host-chosen value with its default preselected and refuses values outside the bounds with a plain sentence. The server validates again (`ROUND_SETTINGS_INVALID`).

## 4. Match settings (document `matchmaking`)

| Key | Default | Min | Max | Status | Who | Running rounds |
|---|---|---|---|---|---|---|
| `match.minPlayersPerRound` | 2 | 1 | 50 | proposal | game admin | next: read when a countdown starts |
| `match.maxPlayers` | 500 | 2 | 1 000 | proposal | game admin (host picks up to it) | next: read on join |
| `match.lobbyIdleCloseMin` | 60 | 10 | 1 440 | proposal: a match with no round for this long closes itself | game admin | immediate |
| `match.maxConcurrentRounds` | 20 | 1 | 100 | technical (per server) | game admin | next: read at round creation |
| `leaderboard.minPlayersForPoints` | 4 | 2 | 50 | proposal (Bingo uses 8 for 200-player matches) | game admin | next: read at round end |
| `leaderboard.periodLength` | quarter, named after the season | — | — | adopted (Bingo 01 §10) | game admin | next period |

## 5. Seasons (documents `seasons`, `integrations`)

| Key | Default | Min | Max | Status | Who | Running rounds |
|---|---|---|---|---|---|---|
| `seasons.feedUrl` | empty (In Season off) | — | — (HTTPS, host on the allowlist) | technical | security admin | next poll |
| `inSeason.pollS` | 300 | 60 | 3 600 | technical | season admin | immediate |
| `inSeason.staleAfterH` | 24 | 1 | 168 | proposal | season admin | next: read at round creation |
| `halving.timeZone` | `UTC` | — | — (IANA zone) | proposal | season admin | next: read at round creation |
| `halving.days` | empty | — | — (list of date + token) | owner (real halving days) | season admin | next: read at round creation |
| `integrations.chatProvider` | `builtin` | — | — (`none`, `builtin`, `hostEmbed`) | technical ([07](07-integration.md) §2) | security admin | immediate (clients reload the panel) |
| `integrations.hostChatUrl` | empty | — | — | adopted | security admin | immediate |

## 6. Security and limits (documents `security`, `rate_limits`)

| Key | Default | Min | Max | Status | Who | Running rounds |
|---|---|---|---|---|---|---|
| `antiMulti.minAccountAgeH` | 0 (off) | 0 | 720 | proposal (owner question (b)) | security admin | next: read when a roster freezes |
| `antiMulti.requireLinkedChat` | false | — | — | proposal (owner question (b)); website installs only | security admin | next: read when a roster freezes |
| `rate_limits.ws.guessPerAccount` | 4 / s, burst 4 | 1 / s | 10 / s | technical | security admin | immediate |
| `rate_limits.http.guessPerSession` | 1 / s | 1 / 5 s | 4 / s | technical | security admin | immediate |
| `rate_limits.ws.teamChoose` | 1 / 5 s | 1 / 60 s | 1 / s | technical | security admin | immediate |
| `rate_limits.host.roundCommands` | 1 / 2 s | 1 / 10 s | 2 / s | technical | security admin | immediate |
| `rate_limits.round.queueBound` | 5 000 | 1 000 | 20 000 | technical | security admin | immediate |
| `security.abuse.cooldownRejectsPerMin` | 20 | 5 | 200 | technical | security admin | immediate |
| `security.abuse.botTimingWindowMs` | 30 | 5 | 200 | technical: guesses this close to `cooldownEndsAt`, repeatedly, raise the abuse score | security admin | immediate |

All Bingo security and rate-limit keys (Bingo 03 §13, Bingo 11 §3.10) keep their defaults and bounds. Loosening beyond a shipped default shows a warning, as in Bingo.

## 7. Server configuration (environment, not admin-editable)

These are operator settings in `/etc/smg/<env>.env`, validated at start ([10](10-repository-structure.md) §5). They are listed here so that the catalogue is complete.

| Variable | Default | Min | Max | Status |
|---|---|---|---|---|
| `SMG_ROUND_KEY` | generated at install (32 bytes) | — | — | technical |
| `SMG_ENGINE_BATCH_MS` | 20 | 5 | 100 | technical: group-commit window ([04](04-software-architecture.md) §5.3) |
| `SMG_ENGINE_BATCH_MAX` | 200 | 50 | 1 000 | technical |
| `SMG_SCHEDULER_POLL_MS` | 100 | 50 | 1 000 | technical |
| Others (`SMG_PUBLIC_URL`, `SMG_BASE_PATH`, `SMG_TRUSTED_PROXIES`, `DATABASE_URL`, …) | as Bingo's `SBR_*` counterparts | | | adopted (Bingo 08 §5, 09 §1) |
