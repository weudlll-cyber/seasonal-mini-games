# Backlog

The authoritative list. `OPEN.md` is the short page over it and is aligned after every change here.

## Part one — open

### Specification

- Owner question (q), winning-margin window: listed in [OPEN.md](OPEN.md); a proposal in the spec until answered
- Work packages with acceptance criteria, written per phase when the phase starts (spec/11-roadmap.md)

### Implementation (roadmap phases, spec/11-roadmap.md)

- Phase 2 — Real players: the authorization matrix and security suites of Bingo adapted to the new routes and intents, and the e2e journeys of spec/09 §4 (server and client are built, see part two)
- Phase 3 — Seasons: the Seasons area of the admin app (rules, server, and the season visuals of the player client are built, see part two)
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

| Item                                                                                                                                                                                                                                                                                                                                                                                                                                | Closed by                                                                             | Date       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------- |
| Repository `weudlll-cyber/seasonal-mini-games` created (public, AGPL-3.0-or-later); initial commit with LICENSE, README and .gitignore                                                                                                                                                                                                                                                                                              | master, initial commit                                                                | 2026-10-24 |
| Owner decisions O1–O7 recorded                                                                                                                                                                                                                                                                                                                                                                                                      | docs/DECISIONS.md §1                                                                  | 2026-10-24 |
| CLAUDE.md working rules adapted from Bingo                                                                                                                                                                                                                                                                                                                                                                                          | Branch spec/v1                                                                        | 2026-10-24 |
| Specification v1, sections 01–11, with DECISIONS, OPEN, BACKLOG and GAME-IDEAS                                                                                                                                                                                                                                                                                                                                                      | Branch spec/v1                                                                        | 2026-10-24 |
| Owner questions (a) fairness proof, (b) anti-multi-account, (d) team scoring, (e) feedback rule, (f) shared-mode visibility, (g) shared placings, (h) unsolved players, (i) points and leaderboard, (j) repeated guesses, (k) roster and limits, (l) special details, (m) default numbers, (n) sizing, (o) product facts, (p) winning margin                                                                                        | Owner answers, DECISIONS O8–O15; spec 01, 02, 03, 05, 08 updated                      | 2026-10-24 |
| Owner question (c) shared guess engine                                                                                                                                                                                                                                                                                                                                                                                              | Architect decision DECISIONS T21 (decided when the second such game starts; R7 stays) | 2026-10-24 |
| Review of branch spec/v1 and merge into master                                                                                                                                                                                                                                                                                                                                                                                      | Merge commit on master (no-ff)                                                        | 2026-10-24 |
| Phase 0 — Foundation: monorepo and tooling from Bingo (renamed), CI, image, server skeleton, migrator, contracts skeleton, web and admin shells, dev compose on ports 3910 / 5410 / 5411 / 5510 / 1110 / 8510; local identity, settings system, audit log and moderation basics (spec 04 §2.1)                                                                                                                                      | Branch feat/guess-the-number (night run P2, not merged)                               | 2026-10-24 |
| Phase 1, first part: game-module contract in `game-sdk`, conformance suite (P1–P5), platform round rules (lifecycle, receive order, cooldown, winning, placings, points, margin, standings), Guess The Number module, round session with commit-reveal and verification                                                                                                                                                             | Branch feat/guess-the-number (night run P3, not merged)                               | 2026-10-24 |
| Phase 2, server: matches and players, rounds with the sealed seed, the round actor with FIFO queue and group commit, append-only event log with snapshots, results and standings, restart recovery, scheduler, match and round HTTP routes, realtime gateway with rooms, intents and frames, guess limits and abuse signals, the development Quick Test with bots, the secret scan (S2)                                             | Branch feat/guess-the-number (night run P4, not merged)                               | 2026-10-24 |
| Phase 3, rules and server: the four specials (Spring Herald, Heatwave, Leaf Fall, Frost) with their timing and the order of 03 §1, halving rounds and halving days, season teams with automatic places and team standings, In Season from a polled feed with a safe fetch, the fast test profile                                                                                                                                    | Branch feat/guess-the-number (night run P5, not merged)                               | 2026-10-24 |
| Phase 1 and 2, client: lobby, match page with joining, teams and players, host console with every host setting inside its bounds, round screen (season banner, countdown, cooldown ring, range bar, guess field, own guesses, Frost "answer arriving", roster, live feed), spectator view, result page (secret, margin, placings, team result, fairness proof), the development Quick Test page; light and dark, 390 px and desktop | Branch feat/guess-the-number (night run P6, not merged)                               | 2026-10-26 |
