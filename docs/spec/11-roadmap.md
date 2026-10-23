# 11 — Roadmap

> Part of the Seasonal Mini Games specification. Index: [README](README.md).
> Phases are ordered by dependency. Each phase ends with something the owner can see in the browser, except Phase 0. Work packages with acceptance criteria are written per phase when that phase starts, as Bingo's 15 did for Bingo. The owner answered the first draft's questions on 2026-10-24 (DECISIONS O8–O15). New proposals are built as written unless the owner changes them ([OPEN.md](../OPEN.md)).

## 1. Phases

### Phase 0 — Foundation
Monorepo and tooling taken over from Bingo and renamed (pnpm workspaces including `games/*`, ESLint boundaries, Prettier, Vitest, lefthook, Renovate), CI and the container image, the server skeleton with health endpoints and the migrator, the contracts skeleton, empty web and admin shells, the dev compose on this repository's ports ([10](10-repository-structure.md) §4).
**Done when:** `pnpm dev` shows a placeholder lobby on 5410 with the dev badge, CI is green on `master`, and the image builds.

### Phase 1 — One round on one screen
`game-sdk` (contract, DRBG, range helpers, conformance suite), the platform round rules in `domain` (lifecycle, roster, cooldown, receive order, placings), and the Guess The Number module with feedback. A **Quick Test** in development builds: one player against bots in a shared or individual round, with a seed field.
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
Installer and `smg` CLI (both install types, beside Bingo on one server), backups and restore drill, observability, a security pass (ZAP, authz matrix, secret scan), the load gate ([09](09-testing-strategy.md) §5), the operator guide, and the v1.0.0 release.
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

Whether Guess The Number, Safecracker, Bomb Defusal and Seasonal Target share one guess engine is an architect decision, taken when the second of these games starts (DECISIONS T21). Until then, Guess The Number is built without that generalisation (simplicity, [01](01-vision.md) §3), but it does not rule it out: secret, guess and feedback live in their own files of the game module.
