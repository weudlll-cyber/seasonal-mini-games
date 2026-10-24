# Backlog

The authoritative list. `OPEN.md` is the short page over it and is aligned after every change here.

## Part one — open

### Specification

- Owner question (q), winning-margin window: listed in [OPEN.md](OPEN.md); a proposal in the spec until answered
- Work packages with acceptance criteria, written per phase when the phase starts (spec/11-roadmap.md)

### Implementation (roadmap phases, spec/11-roadmap.md)

- Phase 1 — One round on one screen: Quick Test against bots (the game-sdk contract with the conformance suite, the platform round rules and the Guess The Number module are built, see part two)
- Phase 2 — Real players: accounts, matches, lobby, round actor with group commit, gateway, host console, result, reconnect
- Phase 3 — Seasons: the four specials, halving round and halving-day list, season teams, token visuals, In Season with a configured feed; copy `assets/` from Bingo with its manifest and licence note
- Phase 4 — Standings and leaderboards (with team standing), profiles, verification page
- Phase 5 — Chat providers `none` / `builtin` / `hostEmbed` and moderation
- Phase 6 — Admin app: settings catalogue UI (the settings API, audit log and account moderation API exist since Phase 0), Seasons area, live rounds, audit log
- Phase 7 — Integration: handoff, embed loader and allowlist, website feed, webhooks, public read API
- Phase 8 — Production readiness: installer and `smg` CLI, backups, observability, security pass, load gate, operator guide, v1.0.0

### Needed from the website repository

For Phase 3 and Phase 7:

- The In Season feed: a public endpoint with the token currently in season and, if possible, the halving days (contract proposed in spec/07-integration.md §5)

For Phase 7:

- Handoff endpoint for this platform (planned `POST /api/games/mini-games/handoff`, audience `seasonal-mini-games`), signing a 60-second token for the logged-in user, with the optional `links` claim (telegram, discord) of spec/07-integration.md §4
- Chat room `mini-games` created by a website admin (spec/07-integration.md §2)
- For website installs: the route import into the website's Caddy, as Bingo's backlog describes for `bingo` (the installer writes `website-mini-games.caddy`)

### Later games (roadmap only, decision O2)

- Seasonal Target, Seasonal Safecracker, Seasonal Bomb Defusal, Seasonal Prediction, Seasonal Higher Or Lower, Seasonal Mystery Object: no design until the owner decides one (GAME-IDEAS.md)

### Optional inputs

- App icon (PNG 512×512) and sounds, as in Bingo's assets manifest

## Part two — closed

| Item                                                                                                                                                                                                                                                                                                                                         | Closed by                                                                             | Date       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------- |
| Repository `weudlll-cyber/seasonal-mini-games` created (public, AGPL-3.0-or-later); initial commit with LICENSE, README and .gitignore                                                                                                                                                                                                       | master, initial commit                                                                | 2026-10-24 |
| Owner decisions O1–O7 recorded                                                                                                                                                                                                                                                                                                               | docs/DECISIONS.md §1                                                                  | 2026-10-24 |
| CLAUDE.md working rules adapted from Bingo                                                                                                                                                                                                                                                                                                   | Branch spec/v1                                                                        | 2026-10-24 |
| Specification v1, sections 01–11, with DECISIONS, OPEN, BACKLOG and GAME-IDEAS                                                                                                                                                                                                                                                               | Branch spec/v1                                                                        | 2026-10-24 |
| Owner questions (a) fairness proof, (b) anti-multi-account, (d) team scoring, (e) feedback rule, (f) shared-mode visibility, (g) shared placings, (h) unsolved players, (i) points and leaderboard, (j) repeated guesses, (k) roster and limits, (l) special details, (m) default numbers, (n) sizing, (o) product facts, (p) winning margin | Owner answers, DECISIONS O8–O15; spec 01, 02, 03, 05, 08 updated                      | 2026-10-24 |
| Owner question (c) shared guess engine                                                                                                                                                                                                                                                                                                       | Architect decision DECISIONS T21 (decided when the second such game starts; R7 stays) | 2026-10-24 |
| Review of branch spec/v1 and merge into master                                                                                                                                                                                                                                                                                               | Merge commit on master (no-ff)                                                        | 2026-10-24 |
| Phase 0 — Foundation: monorepo and tooling from Bingo (renamed), CI, image, server skeleton, migrator, contracts skeleton, web and admin shells, dev compose on ports 3910 / 5410 / 5411 / 5510 / 1110 / 8510; local identity, settings system, audit log and moderation basics (spec 04 §2.1)                                               | Branch feat/guess-the-number (night run P2, not merged)                               | 2026-10-24 |
| Phase 1, first part: game-module contract in `game-sdk`, conformance suite (P1–P5), platform round rules (lifecycle, receive order, cooldown, winning, placings, points, margin, standings), Guess The Number module, round session with commit-reveal and verification                                                                      | Branch feat/guess-the-number (night run P3, not merged)                               | 2026-10-24 |
