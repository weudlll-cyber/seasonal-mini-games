# Game Ideas

Future game candidates for the platform, and the criteria every candidate is checked against before design work starts. Nothing here is designed (decision O2). A candidate becomes a game only after an owner decision on its design, a spec section of its own, and a green conformance suite (spec/04-software-architecture.md §4.5).

## 1. Criteria

### 1.1 The priority order (spec/01-vision.md §3)

A candidate is assessed in this order. A higher criterion outweighs every lower one.

| # | Criterion | Question for the candidate |
|---|---|---|
| 1 | Maintainability | Does it fit the game-module contract as it is, so that no file in `packages/` or `apps/` changes? If not, what is the smallest contract change, and is it worth it? |
| 2 | Security | Can every rule run on the server, with nothing secret on the client before the end? Can cheating (scripts, several accounts, latency) give more than the platform already accepts (spec/05-security-threat-model.md §10)? |
| 3 | Documentation | Can its rules be written as one spec section with numbered, testable rules? |
| 4 | Testability | Is it deterministic from a round seed? Which invariants prove it correct, including the conformance invariants P1–P6? |
| 5 | Simplicity | How many new concepts does it add for players and for the code? |
| 6 | Scalability | Does it work for 500 players in one round without per-player timers or per-player broadcasts at high rates? |
| 7 | Performance | Does its hot path stay one queue step per player action? |
| 8 | Features | What does it add that the existing games do not? |

### 1.2 Platform fit

| Criterion | Source |
|---|---|
| Played together, at the same time; a shared mode is the main use | Decision O5 |
| Timing class: per-player cooldown (fast) or its own timing (long-running) | Decision O3 |
| Winner and placings by server receive order, if it has a race | Decision O4 |
| Each round belongs to a season; the specials that make sense for it apply to everyone at the same moment and equally | Decision O6 |
| No prize of monetary value, no stake | spec/01-vision.md §2 |
| Works standalone and embedded, with every chat provider | spec/07-integration.md |

## 2. Candidates

| Candidate | Status | Note |
|---|---|---|
| Seasonal Target | Vision; not designed | Named in owner question (c) as a possible user of a shared guess engine |
| Seasonal Safecracker | Vision; not designed | Named in owner question (c) |
| Seasonal Bomb Defusal | Vision; not designed | Named in owner question (c) |
| Seasonal Prediction | Vision; not designed | — |
| Seasonal Higher Or Lower | Vision; not designed | — |
| Seasonal Mystery Object | Vision; not designed | — |

New ideas are added to this table with the status "idea" and are assessed against §1 before anyone writes a design.
