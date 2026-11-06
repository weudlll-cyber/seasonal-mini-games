# 08 — Admin Settings Catalogue

> Part of the Seasonal Mini Games specification. Index: [README](README.md). Bingo references: see [README](README.md) §2.

## 1. Principles (adopted)

- The admin app, its navigation model, and forms generated from the same zod schemas the server validates with (defaults, bounds and help text from schema metadata) are as in Bingo 11 §1.
- The host's round form and the development Quick Test show every field's help as one line under the field, in the words of the setting's definition (DECISIONS T64).
- Every change is a new version of its settings document, with history, diff and rollback, and is audited ([05](05-security-threat-model.md) §8). Confirm dialogs and 2FA step-up apply as in Bingo 11 §1.
- Bingo's settings documents `security`, `rate_limits`, `branding`, `theme`, `notifications`, `features` and `chat` are adopted with their keys (Bingo 11 §4). This catalogue lists only the keys that are new or different.
- Definitions with their defaults live in `packages/contracts/src/settings/` (platform) and `games/guess-the-number/src/settings/` (game). The tables below are the specification of those files. A document stores only what an admin changed: per key a new default and, for numbers, narrowed bounds (never wider than the table).
- Navigation differs from Bingo 11 §2: **Game rules** becomes **Games** (per-game settings and bounds), and a new **Seasons** area holds the feed status and halving days.

## 2. How to read the tables

- **Status:** *owner (On)* = decided by the owner on 2026-10-24, with its decision number in [DECISIONS.md](../DECISIONS.md) §1; *proposal* = a value the owner has not given yet, listed as an owner question in [OPEN.md](../OPEN.md); *technical* = a technical choice ([DECISIONS.md](../DECISIONS.md)).
- **Who:** *host* = the match's host chooses it per round, inside the bounds; *game admin* = permission `settings.game.edit` (role `game_admin`) sets the default and may narrow the min/max shown here, never widen them; *security admin* = role `security_admin`; *season admin* = permission `season.manage`.
- **Running rounds:** *frozen* = copied into the round at creation, so a change affects only rounds created afterwards; *immediate* = takes effect at once, also in running rounds; *next* = used the next time the value is read (stated per row).

## 3. Round and game settings (document `game.guess-the-number`)

| Key | Default | Min | Max | Status | Who | Running rounds |
|---|---|---|---|---|---|---|
| `round.secretMode` | `shared` | — | — (`shared`, `individual`) | modes: owner; default: owner (O15) | host | frozen |
| `round.cooldownS` | 10 | 3 | 60 | bounds: owner; default: owner (O15) | host | frozen (changed only by Heatwave) |
| `round.rangeLow` | 1 | −1 000 000 | 1 000 000 | owner (O18); `rangeHigh` ≥ `rangeLow` + 9 | host | frozen |
| `round.rangeHigh` | 1 000 | −1 000 000 | 1 000 000 | owner (O18); `rangeHigh` ≥ `rangeLow` + 9 | host | frozen |
| `round.rangeVisible` | true | — | — | owner (O19): off hides the range until the end (02 §3) | host | frozen |
| `round.countdownS` | 10 | 3 | 30 | *proposal* (OPEN (ab)): long enough to read the round's intro screen (owner decision 36); was 5 (O15) | host | frozen |
| `round.maxDurationMin` | 10 | 1 | 60 | owner (O15) | host | frozen |
| `round.feedbackVisibility` | `full` | — | — (`own`, `numbers`, `full`) | owner (O8) | host (shared mode) | frozen |
| `round.comments` | true | — | — | owner (O21): a closeness comment on every guess, seen exactly where its answer is seen (02 §6.3) | host | frozen |
| `comments.wayOffAbove` | 50 % | 20 | 90 | proposal: a guess farther from the secret than this share of the range's width is "way off" (02 §6.3) | game admin | frozen |
| `comments.coldAbove` | 25 % | 10 | 60 | proposal: "cold" above this share | game admin | frozen |
| `comments.coolAbove` | 10 % | 3 | 40 | proposal: "cool" above this share | game admin | frozen |
| `comments.warmAbove` | 3 % | 1 | 20 | proposal: "warm" above this share | game admin | frozen |
| `comments.hotAbove` | 1 % | 0.5 | 10 | proposal: "hot" above this share; at or under it "burning" (more than 2 away). The five thresholds must fall from way off to hot | game admin | frozen |
| `comments.trendPercent` | 33 % | 0 | 100 | proposal: how often a guess in another tier than the player's last one gets a trend line ("getting warmer") instead of a tier line (DECISIONS T71) | game admin | frozen |
| `round.marginWindowS` | 2 | 0.5 | 10 | owner (O33): how long after the winning guess a correct guess still counts for the winning margin (02 §9) | game admin | frozen |
| `round.seasonSource` | `inSeason` | — | — (`inSeason`, `manual`) | owner (default: O15) | host | frozen |
| `round.specialOn` | true | — | — | owner (O15) | host | frozen |
| `round.teamsOn` | true | — | — | owner (O15) | host (shared mode) | frozen |
| `round.halving` | false | — | — | owner (only on a halving day) | host | frozen |
| `round.repeatGuessRejected` | true | — | — | owner (O15) | game admin | frozen |
| `spring.hintType` | `lastDigit` | — | — (`lastDigit`, `half`) | owner (O56) | game admin | frozen |
| `summer.stepS` | 1 | 1 | 10 | owner (O57, O63) | host ("Heatwave step", a summer round); default: game admin | frozen |
| `summer.stepIntervalS` | 10 | 5 | 300 | owner (O57, O63) | host ("Heatwave every", a summer round); default: game admin | frozen |
| Heatwave floor | 3 s | — | — | owner (not a setting) | — | — |
| `autumn.intervalS` | 20 | 5 | 120 | owner (O15) | game admin | frozen |
| `autumn.count` | 10 | 1 | 100 | owner (O15) | game admin | frozen |
| `autumn.minRemaining` | 10 | 2 | 1 000 | owner (O15) | game admin | frozen |
| `winter.delayS` | 3 | 1 | 10 | owner (O15) | game admin | frozen |
| `halving.intervalS` | 60 | 15 | 600 | owner (O15) | game admin | frozen |
| `halving.minRangeSize` | 8 | 2 | 100 | owner (O15) | game admin | frozen |
| `points.sharedWinner` | 10 | 0 | 1 000 | owner (O11) | game admin | frozen |
| `points.individualPlaces` | `[10, 7, 5, 3]` | each 0 | each 1 000, at most 20 entries | owner (O11) | game admin | frozen |
| `points.individualOtherSolver` | 1 | 0 | 1 000 | owner (O11) | game admin | frozen |
| `fairness.commitReveal` | true | — | — | owner (O9) | game admin | frozen |
| Team points per round win | 1 | — | — | owner (O12, not a setting) | — | — |

The host form shows each host-chosen value with its default preselected and refuses values outside the bounds with a plain sentence. The server validates again (`ROUND_SETTINGS_INVALID`).

### 3.1 Seasonal Safecracker (document `game.safecracker`, [02b](02b-game-safecracker.md))

Platform round keys (`round.secretMode`, `round.cooldownS`, `round.countdownS`, `round.maxDurationMin`, `round.marginWindowS`, `round.seasonSource`, `round.specialOn`, `round.teamsOn`, `points.*`, `fairness.commitReveal`) and the special timings (`summer.*`, `autumn.intervalS`, `winter.delayS`) as in §3. Shared guess keys as in 08 §3 (`round.feedbackVisibility`, `round.comments`, `comments.trendPercent`, `round.repeatGuessRejected`). Not used by this game: `round.rangeLow`, `round.rangeHigh`, `round.rangeVisible`, `comments.*Above`, `spring.hintType`, `autumn.count`, `autumn.minRemaining`, `round.halving` and `halving.*` (`halvingAllowed` off, 02b §7.4).

| Key | Default | Min | Max | Status | Who | Running rounds |
|---|---|---|---|---|---|---|
| `code.length` | 4 | 3 | 6 | *proposal*: digits in the secret code (02b §3) | host | frozen |
| `code.digits` | 10 | 4 | 10 | *proposal*: the digits 0 … digits − 1 are in use; repeats allowed (02b §3) | host | frozen |
| `autumn.digitsPerFall` | 1 | 1 | 3 | *proposal*: digits that fall per Leaf Fall; replaces `autumn.count` for this game (02b §7.3) | game admin | frozen |
| Tier score bounds | 0.25 / 0.45 / 0.60 / 0.75 | — | — | *proposal* (not a setting): fixed table of 02b §6 | — | — |

### 3.2 Seasonal Bomb Defusal (document `game.bomb-defusal`, [02c](02c-game-bomb-defusal.md))

Shared guess keys as in 08 §3 (`round.secretMode`, `round.cooldownS`, `round.countdownS`, `round.maxDurationMin`, `round.feedbackVisibility`, `round.comments`, `comments.trendPercent`, `round.marginWindowS`, `round.seasonSource`, `round.specialOn`, `round.teamsOn`, `round.repeatGuessRejected`, `summer.*`, `autumn.intervalS`, `winter.delayS`, `points.*`, `fairness.commitReveal`). Not used by this game: `round.rangeLow`, `round.rangeHigh`, `round.rangeVisible`, `round.halving`, `halving.*`, `spring.hintType`, `autumn.count`, `autumn.minRemaining`, the `comments.*Above` thresholds.

| Key | Default | Min | Max | Status | Who | Running rounds |
|---|---|---|---|---|---|---|
| `bomb.wires` | 6 | 4 | 8 | proposal: the first N colours of red, blue, yellow, green, white, black, orange, purple (02c §3) | host | frozen |
| `bomb.cuts` | 4 | 3 | 6 | proposal; at most `bomb.wires` | host | frozen |
| `bomb.explosionPenaltyS` | 5 | 0 | 30 | owner (O40): host chooses, 0 allowed; default and max: proposal. Added to the cooldown on a wrong first cut (02c §5.2) | host (per match) | frozen (copied from the match into each round) |
| `autumn.wiresPerFall` | — | — | — | removed by owner decision 42 (2026-11-02): each Leaf Fall marks one wire (02c §8.3) | — | — |
| Tier rule | fixed | — | — | proposal, not a setting: k = 1 … cuts − 2 spread evenly over cold … burning (02c §7) | — | — |

### 3.3 Seasonal Target (document `game.seasonal-target`, [02d](02d-game-seasonal-target.md))

Shared guess keys as in 08 §3 (`round.secretMode`, `round.cooldownS`, `round.countdownS`, `round.maxDurationMin`, `round.feedbackVisibility`, `round.comments`, `comments.trendPercent`, `round.marginWindowS`, `round.seasonSource`, `round.specialOn`, `round.teamsOn`, `round.halving`, `round.repeatGuessRejected`, `summer.*`, `autumn.intervalS`, `autumn.count`, `winter.delayS`, `halving.intervalS`, `points.*`, `fairness.commitReveal`). Not used: `round.rangeLow`, `round.rangeHigh`, `round.rangeVisible`, `comments.*Above`, `spring.hintType`, `halving.minRangeSize`.

| Key | Default | Min | Max | Status | Who | Running rounds |
|---|---|---|---|---|---|---|
| `target.size` | 20 | 8 | 30 | owner (O45, amends the map of O38 and O43): the square tile grid's side in tiles; row 1 is north (02d §3). Replaced `map.width` and `map.height` (50, 20–100); migration 0013 wrote a version without their stored overrides | host | frozen |
| `target.feedback` | `closeness` | — | — (`direction`, `distance`, `closeness`) | owner (O43, amends O39; default O53): distance and direction, distance only, warm/cold only (default since O53; a stored explicit value keeps its value); the host's round setting, chosen in the round form; the next round's form keeps the last choice (02d §3, §5) | host | frozen |
| `autumn.minCellsLeft` | 10 | 2 | 50 | proposal: Leaf Fall stops when fewer candidate tiles would remain (02d §8.3); at most 50, so tiles can fall on an 8 × 8 grid (O45) | game admin | frozen |
| `halving.minCells` | 16 | 4 | 32 | proposal: halving stops once the target area has this many tiles or fewer (02d §8.4); at most 32, so an 8 × 8 grid is halved at least once (O45) | game admin | frozen |
| Closeness tier table (40 / 25 / 12 / 6 / 3 % of the diagonal, touching = just missed) | — | — | — | proposal, not a setting: Leaf Fall's `closeness` candidates depend on it (02d §7) | — | — |

## 4. Match settings (document `matchmaking`)

| Key | Default | Min | Max | Status | Who | Running rounds |
|---|---|---|---|---|---|---|
| `match.minPlayersPerRound` | 2 | 1 | 50 | owner (O15) | game admin | next: read when a countdown starts |
| `match.maxPlayers` | 500 | 2 | 1 000 | owner (O15) | game admin (host picks up to it) | next: read on join |
| `match.lobbyIdleCloseMin` | 60 | 10 | 1 440 | owner (O15, O28): a match with no round for this long closes itself, counted from the later of its creation and its last round's creation or end; checked every minute and on server start ([02](02-game-guess-the-number.md) §2) | game admin | immediate |
| `match.maxConcurrentRounds` | 20 | 1 | 100 | technical (per server) | game admin | next: read at round creation |
| `leaderboard.minPlayersForPoints` | 4 | 2 | 50 | owner (O11) | game admin | next: read at round end |
| `leaderboard.periodLength` | meteorological season | — | — | owner (O30): spring March–May, summer June–August, autumn September–November, winter December–February, in UTC; not a stored setting (DECISIONS T107) | — | — |
| `leaderboard.abortedMatchesCount` | off | — | — | owner (O31): off, aborting a match takes back its league points; a match ended normally keeps them | game admin | immediate |

## 5. Seasons (documents `seasons`, `integrations`)

| Key | Default | Min | Max | Status | Who | Running rounds |
|---|---|---|---|---|---|---|
| `seasons.feedUrl` | empty (In Season off) | — | — (HTTPS; its host is the one the feed may reach, every address public, 07 §5) | technical | security admin | next poll |
| `inSeason.pollS` | 300 | 60 | 3 600 | technical | season admin | immediate |
| `inSeason.staleAfterH` | 24 | 1 | 168 | owner (O15) | season admin | next: read at round creation |
| `halving.timeZone` | `UTC` | — | — (IANA zone) | owner (O15) | season admin | next: read at round creation |
| `halving.days` | empty | — | — (list of date + token) | owner (real halving days) | season admin | next: read at round creation |
| `integrations.chatProvider` | `builtin` | — | — (`none`, `builtin`, `hostEmbed`) | technical ([07](07-integration.md) §2) | security admin | immediate (clients reload the panel) |
| `integrations.hostChatUrl` | empty | — | — | adopted | security admin | immediate |

## 6. Security and limits (documents `security`, `rate_limits`)

| Key | Default | Min | Max | Status | Who | Running rounds |
|---|---|---|---|---|---|---|
| `antiMulti.minAccountAgeH` | 0 (off) | 0 | 720 | owner (O10); a younger account is left off a shared roster (DECISIONS T103) | security admin | next: read when a roster freezes |
| `antiMulti.requireLinkedChat` | false | — | — | owner (O10); website installs only: without a JWT handoff provider the form disables it with its reason and the server refuses it (DECISIONS T103) | security admin | next: read when a roster freezes |
| `rate.guessPerAccountPerS` | 4 / s | 1 / s | 10 / s | technical | security admin | immediate |
| `rate.httpGuessPerSessionPerMin` | 60 / min | 12 / min | 240 / min | technical | security admin | immediate |
| `rate.teamChoosePerMin` | 12 / min | 1 / min | 60 / min | technical | security admin | immediate |
| `rate.hostRoundCommandsPerMin` | 30 / min | 6 / min | 120 / min | technical | security admin | immediate |
| `rate.roundQueueBound` | 5 000 | 1 000 | 20 000 | technical | security admin | immediate |
| `abuse.cooldownRejectsPerMin` | 20 | 5 | 200 | technical | security admin | immediate |
| `abuse.botTimingWindowMs` | 30 | 5 | 200 | technical: guesses this close to `cooldownEndsAt`, repeatedly, raise the abuse score | security admin | immediate |

All Bingo security and rate-limit keys (Bingo 03 §13, Bingo 11 §3.10) keep their defaults and bounds. Loosening beyond a shipped default shows a warning, as in Bingo.

## 7. Server configuration (environment, not admin-editable)

These are operator settings in `/etc/smg/<env>.env`, validated at start ([10](10-repository-structure.md) §5). They are listed here so that the catalogue is complete.

| Variable | Default | Min | Max | Status |
|---|---|---|---|---|
| `SMG_ROUND_KEY` | generated at install (32 bytes) | — | — | technical |
| `SMG_ENGINE_BATCH_MS` | 20 | 5 | 100 | technical: group-commit window ([04](04-software-architecture.md) §5.3) |
| `SMG_ENGINE_BATCH_MAX` | 200 | 50 | 1 000 | technical |
| `SMG_SCHEDULER_POLL_MS` | 100 | 50 | 1 000 | technical |
| `SMG_ROOM_FRAME_MS` | 100 | 0 | 250 | technical: a round's room frames are merged over this window, the first sent at once (DECISIONS T49) |
| `SMG_DEV_FEED_URL` | unset | — | — | technical: development builds only, a local In Season feed (DECISIONS T42) |
| Others (`SMG_PUBLIC_URL`, `SMG_BASE_PATH`, `SMG_TRUSTED_PROXIES`, `DATABASE_URL`, …) | as Bingo's `SBR_*` counterparts | | | adopted (Bingo 08 §5, 09 §1) |
