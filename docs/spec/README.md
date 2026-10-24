# Seasonal Mini Games — Specification v1

Blueprint for implementation by Claude Code. The code follows it. What is decided is in [docs/DECISIONS.md](../DECISIONS.md); what is open is in [docs/OPEN.md](../OPEN.md) and [docs/BACKLOG.md](../BACKLOG.md).

## 1. Documents

| # | Document | Covers |
|---|---|---|
| 01 | [Vision and priorities](01-vision.md) | What the platform is, fixed product facts, the priority order every trade-off follows, glossary |
| 02 | [Game design: Guess The Number](02-game-guess-the-number.md) | Fast mode: round lifecycle, cooldown, shared and individual secret, feedback and hints, winning, placings, spectator view, round end |
| 03 | [Seasonal specials](03-seasonal-specials.md) | Season rounds (Spring Herald, Heatwave, Leaf Fall, Frost), In Season, halving round, season teams, visuals |
| 04 | [Software architecture](04-software-architecture.md) | What is adopted from Bingo, the game-module contract, the round engine, ordering and timing |
| 05 | [Security and threat model](05-security-threat-model.md) | Cooldown enforcement, secret handling, randomness, rate limits, multi-accounts, latency and "first received wins", audit log, threats |
| 06 | [Data model, API and realtime events](06-data-model-api-realtime.md) | Tables, HTTP routes, WebSocket intents and events |
| 07 | [Integration](07-integration.md) | Standalone and embedded modes, identity, chat providers, notifications, the In Season feed: differences from Bingo only |
| 08 | [Admin settings catalogue](08-admin-settings.md) | Every setting: default, min, max, who may change it, whether it applies to running rounds |
| 09 | [Testing strategy](09-testing-strategy.md) | Pyramid, invariants, journeys, load test for many concurrent players |
| 10 | [Repository structure, ports and deployment](10-repository-structure.md) | Layout, file header, local ports (with Bingo's), deployment differences |
| 11 | [Roadmap](11-roadmap.md) | Phases with visible outcomes; later games |

## 2. Reading references to Bingo

This platform reuses the foundation of **Seasonal Bingo Royale** (repository `weudlll-cyber/seasonal-bingo-royale`, read at master `d294585`). A reference such as **Bingo 02 §5.3** means section 5.3 of `docs/spec/02-software-architecture.md` in that repository at that commit:

`https://github.com/weudlll-cyber/seasonal-bingo-royale/blob/d294585a319c37b18cad405f52c4165c4d0b07fe/docs/spec/<file>`

Bingo spec files: 01 game design, 02 software architecture, 03 security architecture, 04 database design, 05 API design, 06 realtime architecture, 07 integration architecture, 08 DevOps architecture, 09 deployment architecture, 10 repository structure, 11 admin panel, 12 testing strategy, 13 threat model, 14 roadmap, 15 implementation plan.

"Adopted" means: build it as Bingo specifies, with the names changed as listed in [04](04-software-architecture.md) §2.2. The text is not copied here. Each section restates only what a reader needs to work without opening Bingo, and writes out in full what differs or is new. If an adopted Bingo section changes after `d294585`, this spec does not follow it automatically. A task has to adopt the change explicitly.

## 3. Owner decisions, proposals and open questions

- Owner decisions (2026-10-24) are recorded in [DECISIONS.md](../DECISIONS.md) §1 (O1–O15) and applied throughout. In this spec they are marked **(owner)** or "owner, decision N". With O15 the owner accepted every proposal of the first draft, so those details are now rules.
- Anything new that changes what players experience and was not decided by the owner is marked **proposal**. A proposal is built as written unless the owner changes it. Each one is listed as an owner question in [OPEN.md](../OPEN.md).
- Every number the owner did not give is an admin setting with a default, a minimum and a maximum, marked *proposal* in [08](08-admin-settings.md).
- Purely technical choices are recorded with their reasons in [DECISIONS.md](../DECISIONS.md): technical decisions T1–T28 (§2), security decisions S1–S9 (§3), rejected approaches R1–R13 (§4).
