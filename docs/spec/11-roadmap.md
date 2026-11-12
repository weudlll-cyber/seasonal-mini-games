# 11 — Roadmap

> Part of the Seasonal Mini Games specification. Index: [README](README.md).
> Phases are ordered by dependency. Each phase ends with something the owner can see in the browser, except Phase 0. Work packages with acceptance criteria are written per phase when that phase starts, as Bingo's 15 did for Bingo. The owner answered the first draft's questions on 2026-10-24 (DECISIONS O8–O15). New proposals are built as written unless the owner changes them ([OPEN.md](../OPEN.md)).

## 1. Phases

### Phase 0 — Foundation
Monorepo and tooling taken over from Bingo and renamed (pnpm workspaces including `games/*`, ESLint boundaries, Prettier, Vitest, lefthook, Renovate), CI and the container image, the server skeleton with health endpoints and the migrator, the contracts skeleton, empty web and admin shells, the dev compose on this repository's ports ([10](10-repository-structure.md) §4).
**Done when:** `pnpm dev` shows a placeholder lobby on 5410 with the dev badge, CI is green on `master`, and the image builds.

### Phase 1 — One round on one screen
`game-sdk` (contract, DRBG, range helpers, conformance suite), the platform round rules in `domain` (lifecycle, roster, cooldown, receive order, placings), and the Guess The Number module with feedback. A **Quick Test** in development builds: one player against bots in a shared or individual round, with a seed field; it runs through the normal waiting area and host start, or starts at once (owner decision 24, [02](02-game-guess-the-number.md) §2).
**Done when:** the owner plays a shared and an individual round against bots in the browser, the cooldown blocks guesses, and the same seed gives the same round.
### Phase 2 — Real players, together
Accounts and sessions (Bingo's built auth adopted), matches and the lobby, the round actor with group commit and restart recovery, the WebSocket gateway with guess intents, clock offset and per-player rooms, the host console (create, start, end and abort rounds), the result screen, and reconnect.
**Done when:** several browsers play one shared round together; a server restart during a round loses no acknowledged guess and keeps every cooldown.

### Phase 3 — Seasons
Season rounds with all four specials, the halving round with the admin halving-day list, season teams with team standing, token visuals in light and dark, and In Season with a manually configured feed URL.
**Done when:** the owner sees each special in a round, a halving round on a test day, and the team standing after a round.
### Phase 4 — Standings and leaderboards
Match standings, season and all-time boards with team standing, profiles, and the fairness verification page (decision O9).
**Done when:** points from several matches add up on the season board with the team board beside it.

### Phase 5 — Chat and moderation
Chat providers `none`, `builtin` and `hostEmbed` ([07](07-integration.md) §2), with Bingo's chat and moderation adopted.
**Done when:** match chat works and the mute and ban flows work end to end.

### Phase 6 — Admin app
The admin app with 2FA, RBAC and the audit log, schema-driven settings documents with versions ([08](08-admin-settings.md)), the Seasons area (feed status, halving days), and live rounds with staff actions.
**Done when:** the owner changes a special's default, creates a round, and sees the new value in play, without touching code.

### Phase 7 — Integration
JWT handoff with the website (including the optional `links` claim), the embed loader and allowlist, the In Season feed from the website, webhooks, and the public read API.
**Done when:** the game runs embedded on a test host page with single sign-on, and then on the Seasonal Entertainment website once its side is ready.

### Phase 8 — Production readiness
Installer and `smg` CLI (both install types, beside Bingo on one server), backups and restore drill, observability, a security pass (ZAP, authz matrix, secret scan; results in [../security-pass.md](../security-pass.md)), the load gate ([09](09-testing-strategy.md) §5), the operator guide, and the v1.0.0 release.
**Done when:** a fresh VPS goes from nothing to a running, backed-up instance with one script, the load gate passes, and v1.0.0 is tagged.

## 2. After v1 (not scheduled)

Scale step 1 (Redis, match-sticky routing, [04](04-software-architecture.md) §5.6), passkeys, Kubernetes chart, other identity providers, languages other than English, and long-running games with their own timing (owner, decision 3).

## 3. Later games (roadmap only, no design work now: owner, decision 2)

Listed in the order of the vision. Each one starts only after an owner decision on its design, gets its own spec section, and must pass the conformance suite ([04](04-software-architecture.md) §4.5). Candidates and the criteria they are checked against are in [GAME-IDEAS.md](../GAME-IDEAS.md).

1. Seasonal Target
2. Seasonal Safecracker
3. Seasonal Bomb Defusal
4. Seasonal Prediction
5. Seasonal Higher Or Lower
6. Seasonal Mystery Object

Seasonal Target, Seasonal Safecracker and Seasonal Bomb Defusal are the next games (owner, decision 38): their designs are [02d](02d-game-seasonal-target.md), [02b](02b-game-safecracker.md) and [02c](02c-game-bomb-defusal.md), with the architect's rules as proposals to confirm once the owner has played. They and Guess The Number share one guess engine ([04](04-software-architecture.md) §4.7, DECISIONS T117, which closes T21).

Seasonal Mind Games is designed (owner, decisions 76–90, 2026-11-12; [02e](02e-game-mind-games.md)). It is not a guess game: it needs the timing class `phased` ([04](04-software-architecture.md) §4.8), which is built first as a contract change of its own. Its work packages are §4.

## 4. Seasonal Mind Games: work packages

In dependency order; each is one block of work with its own commit, push and report (CLAUDE.md). Sizes: **S** a small block, **M** a normal one, **L** a full one. The three MG-C packages change platform code and nothing in `games/`; the five MG packages change only `games/mind-games/`, the two registry lines and the docs (04 §4.6). Branch `feat/mind-games` for all of them; merged only when a task allows it.

| # | Package | Contents | Needs | Size |
|---|---|---|---|---|
| MG-C1 | Contract: the `phased` class and the round engine | `game-sdk` types (`timing`, `phased`, `PhasePlan`, the outcome rows); the plan in `RoundCreated` and the end scheduled; the check order and codes (`PLAY_OVER`, `JOIN_CLOSED`), `PlayerEntered`; no cooldown, special, inactivity limit or `receiveSeq` in a phased round; `round_results.won` with its migration, standings and boards from `won`; the delayed views (`releasedBefore = now − D`), the release tick with its own sequence for frames and state answers; the `guess` value shape and the codes in `contracts`; P7 in the conformance suite with a small phased fixture module in its tests; 04 §4.8 rules 1–6 and 9 | — | L |
| MG-C2 | Contract: series and joining | A series from the first round's `series(cfg)`; the next round after the pause (`match_autostart`), `matches.next_settings` with `PUT …/next-round`, Start next round now (route and host menu), the result's "Round 3 of 6 · Next round in 12 s"; the close reason `complete` with the summary's sentence; `match.minPlayersPerRound` for the first round only; match players who join during a phased round's entry window play it; rule 7 | MG-C1 | M |
| MG-C3 | Contract: match-level player data and the Quick Test for phased games | `match_player_prefs`, `GET`/`PUT …/prefs`, `match.prefs`, `myPrefs`, deleted on leave and kick, applied at the opening in join order, `prefs.refused`, log redaction; the web half's slot for a game's panel in the waiting area; the Quick Test for a phased game: its settings, the series, seeded bot plans under `quicktest/<round>/<bot>` and the bots' prefs (09 §4.2); rule 8 | MG-C1, MG-C2 | M |
| MG-1 | Rules | `games/mind-games/src`: settings and their rules, the action schema, state, `validate`, `decide`, `evolve`, the events, `plan`, `series`, `prefs.action`, `outcome`, `reveal`, the conformance kit; the registry's `src` line; unit and property tests (MG2–MG5, 09 §4.2) | MG-C1–MG-C3 | M |
| MG-2 | Views and screen | The view schemas and views (delayed feed, own live choice, result); `games/mind-games/web`: phase strip, choice buttons with counts, Hide my switches, lines, empty feed and replay, intro, result, tooltips, the desktop with the Chat panel open and the call view's space, the phone; the registry's `web` line; component tests | MG-1 | L |
| MG-3 | Animation | The round view's flights from the delayed feed only (02e §11.1): first choices, switches with and without a name, waves with their cap, the winners lighting up at the end, reduced motion without flights, the flight band inside the stage; component tests and the checks of 09 §4.2 (owner decision 90) | MG-2 | M |
| MG-4 | Pre-picks | The prefs schema (pre-picks per round and the box), the Your pre-picks panel in the waiting area, the own notice for a refused pre-pick, the box kept through prefs; tests of MG6 | MG-3 | S |
| MG-5 | Quick Test and journeys | The dev bot (its three ways to play from its own view), the game's Quick Test fields, e2e journeys 38–41 once in Chromium, the L5 scenario in the load driver run once on the development machine, at most about 10 screenshots for the owner (O70), one `pnpm verify` | MG-4 | M |

**Night chains:** MG-C1 → MG-C2 → MG-C3 run in one night chain (platform only, each needs the one before); MG-1 → MG-2 → MG-3 → MG-4 → MG-5 run in a second night chain, after the first chain's report has been read, since the game is built on the contract as it then stands. MG-3 is a package of its own so that the animation is built and reviewed apart from the views; MG-5 ends with a Quick Test the owner plays along with (09 §4.2).
