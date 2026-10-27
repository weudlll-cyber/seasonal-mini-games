# 09 — Testing Strategy

> Part of the Seasonal Mini Games specification. Index: [README](README.md). Bingo references: see [README](README.md) §2.

## 1. Adopted from Bingo

| Topic | Bingo reference | Difference here |
|---|---|---|
| Principles: pure engine tested exhaustively, infrastructure with real Postgres, few E2E journeys plus component tests, path-based CI job selection, a failing test before every fix, short measurements | Bingo 12 §1 | None. |
| Test pyramid and its tools (Vitest, fast-check, Testcontainers, contract tests, Testing Library, Playwright in Chromium, Firefox and WebKit mobile, security tests); coverage targets domain ≥ 95 %, application ≥ 85 % | Bingo 12 §2 | `game-sdk` and every `games/*/src` also have a ≥ 95 % target. Load testing uses a Node.js driver (DECISIONS T9). |
| Security tests (authz matrix generated from the permission table, CSRF, headers, rate limits, fuzzing, JWT, upload, SSRF, ZAP baseline) | Bingo 12 §6 | Additions in §6. |
| Test data and determinism (fixed seeds, failing seeds turned into regression tests, shared builders, tests remove their accounts and abort their matches, timing specs in their own Playwright projects, fixed local ports) | Bingo 12 §7 | Ports from [10](10-repository-structure.md) §4. Builders: `aRound().shared().withPlayers(500)`. |
| Manual acceptance by the owner with a Quick Test seed | Bingo 12 §8 | The Quick Test plays one round against bots (§5). |

## 2. Levels specific to this platform

| Level | Scope |
|---|---|
| Unit and property | `domain` (lifecycle, cooldown, ordering, placings, teams, special scheduling), `game-sdk` (DRBG helpers, range arithmetic), `games/guess-the-number/src` (feedback, hints, Leaf Fall, halving) |
| Conformance | One shared suite run against every module in `games/registry` (invariants P1–P6). A new game is green only when it passes. |
| Engine integration | The round actor with real Postgres: group commit, restart recovery, scheduler precision, Frost after restart |
| Component | Range bar, cooldown ring, guess list, roster, team standing, result screen |
| E2E | Journeys in §4 |
| Load | §5, release gate |

## 3. Invariants (property tests, 1 000 cases per property in CI; whole-round properties capped at 100)

**Platform conformance (every game module):**

- **P1 Determinism.** Same seed, same settings and the same ordered inputs ⇒ identical event list.
- **P2 No secret leaks.** With unique sentinel secrets, no serialized player view, spectator view, room frame or rejection answer of a running round contains a sentinel. Result views contain them only after the end. With a hidden range, its bounds count as sentinels too (DECISIONS T52).
- **P3 Valid views.** Every view validates against the module's `viewSchemas`.
- **P4 Rejections are free.** A rejected action produces no event and leaves state equal (deep equality).
- **P5 Replay equals live.** Folding the round's event log with `evolve` gives the actor's state.
- **P6 Specials are equal.** A special hook's effect is identical for every player (shared mode), or has the same size and count for every player (individual mode).

**Guess The Number and the platform rules:**

- **G1 Order.** Accepted guesses have strictly increasing, unique, gap-free `receiveSeq` in queue order.
- **G2 One winner.** In shared mode at most one winner exists: the correct guess with the lowest `receiveSeq`. No guess is accepted after it.
- **G3 Cooldown.** For every player, two consecutive accepted guesses are at least the cooldown in force at the earlier one's receive time apart. A guess is never accepted earlier than that, from any socket or route.
- **G4 Placings.** In individual mode, places are 1..k without gaps, in the `receiveSeq` order of the solves. Unsolved players have no place. No two players share a place.
- **G5 Feedback.** Feedback is `higher`, `lower` or `correct` as defined in [02](02-game-guess-the-number.md) §6.1. No answer, view or frame carries a narrowed range (owner decision 17).
- **G6 Valid guesses.** Every accepted guess is a whole number inside the current range (any whole number from −1 000 000 000 to 1 000 000 000 while the range is hidden), was not removed, and was not guessed before by that player.
- **G7 Uniform secrets.** Secrets are uniform over the range (chi-square smoke test, not a property).

**Seasonal specials:**

- **S1 Spring Herald.** Every roster player gets exactly one hint, which is true and arrives before any guess is accepted.
- **S2 Heatwave.** The cooldown never goes below 3 s, never rises, and drops by exactly the step at each due time until the floor.
- **S3 Leaf Fall.** No fall removes any secret of the round. All players see the same removed set. Each fall removes `count` numbers, or fewer only at the `minRemaining` stop.
- **S4 Frost.** Each answer is delivered `delay` after its receive time. Metamorphic: the same inputs with and without Frost give the same order, winner and placings.
- **S5 Halving.** Every range always contains its secret. Sizes halve (rounded up) at each due time until the minimum. All players have the same size at the same time.
- **S6 Teams.** Teams never change during a round. The winner's team gets exactly 1 point per round, and no other team gets any. Team standings are a total order.
- **S7 Simultaneity.** Specials due at the same instant run in the order halving → Leaf Fall → Heatwave, in one step.
- **S8 In Season.** A feed answer older than `staleAfterH` is never used for a round.

## 4. E2E journeys

1. Two players and a host: shared round, cooldown 3 s, the host starts it, both guess, one wins, both see the result and the revealed secret; the cooldown ring blocks the button. Also at 390 × 844.
2. Individual round with three players: placings in solve order; a solved player becomes a spectator; time-up ends the round with "not solved" rows.
3. Each season special once (fast test profile): Spring hint shown, Heatwave value drops, Leaf Fall strikes numbers, Frost shows "answer arriving".
4. Halving round on a test halving day: the range halves, and a guess outside it is refused without cost.
5. Teams: four players pick teams, the team standing updates after the round, and teams lock during the countdown.
6. Reconnect mid-round: the cooldown is unchanged after reconnect, there are no duplicate guesses, and Frost answers arrive after reconnect.
7. Spectator (guest): sees the feed at the round's visibility and never a number or feedback under `own`.
8. Embedded: JWT handoff from a test host page signs the player in; an origin that is not on the allowlist is refused (Bingo journey 7).
9. Accessibility: axe checks on lobby, round and result; keyboard-only guessing.
10. Hidden range (owner decision 19), 1280 × 720: the round view says "Any whole number", no bound is on the page, a guess far outside the range is answered, and the result reveals the range.
11. Negative bounds (owner decision 18), 390 × 844: a range from −500 to 500 is shown, the ± button makes a typed number negative, the guess is answered, and the round plays to its result.
12. Boards (roadmap phase 4): four players play two counting matches; the points add up on the season board with the team board beside it, the profile shows them, the round's verification page confirms the seed against the commitment, and aborting the matches takes the points back.

Journeys 1, 10 and 11 also check that the round view fits the screen: `document.scrollingElement.scrollHeight` is at most `window.innerHeight` ([02](02-game-guess-the-number.md) §12).

The **fast test profile** exists only in development builds (as Bingo 12 §4): shorter countdown, special intervals of a few seconds, and a 3 s cooldown. Published defaults are unchanged, and a test proves it.

## 5. Load test (release gate)

Driver: `load/guessStorm.mjs`, Node.js with `socket.io-client`. It signs in load accounts through the development-only route, as Bingo's `load/drawLatency.mjs` does. Bots binary-search their own feedback and guess when their cooldown ends, plus a human-like delay (uniform 200–1 500 ms).

| Scenario | Shape |
|---|---|
| L1 `shared-500` | One shared round, 500 players, cooldown 3 s, plus 100 spectators. Ten rounds one after another: plain, then each special, then a halving round. |
| L2 `open-burst` | 500 players send their first guess within 50 ms of `opensAt`. |
| L3 `parallel` | 10 matches × 50 players, rounds running at the same time, individual and shared mixed. |
| L4 `headroom-1000` | L1 with 1 000 players. |

Pass criteria on the reference VPS (4 vCPU / 8 GB, as Bingo 12 §5):

- Guess acknowledgement (send → ack) p95 < 150 ms, p99 < 300 ms. Feedback without Frost p95 < 200 ms.
- Frost delivery later than `receivedAt + delay` by p95 < 100 ms. Special fired later than its due time by p95 < 150 ms.
- **Zero** lost, duplicated or reordered accepted guesses. Every acknowledged guess is in `round_events`, `receiveSeq` is gap-free, and per socket, acknowledged guesses keep their send order.
- Exactly one winner per shared round, and placings consistent with `round_events`.
- The round queue never reaches its bound. Event-loop lag p99 < 50 ms. App CPU < 60 %, memory < 768 MiB, error rate < 0.1 %.
- L4: guess acknowledgement p95 < 300 ms.

Short and direct: each scenario runs for minutes, not hours (Bingo 12 §1).

## 6. Security tests (in addition to Bingo 12 §6)

- **Cooldown bypass:** one account guesses from two sockets, from a socket plus the HTTP fallback, and across a reconnect. Exactly one guess per cooldown is accepted.
- **Secret scan:** P2 also runs as an integration test over real frames and every HTTP answer of a running round, the admin API included.
- **Frost early read:** `GET …/state` during the delay never contains the held answer.
- **Audience:** a spectator socket and a second player's socket never receive another player's `guess.result`, `hint` (individual) or `range.changed`.
- **Rate limits:** a guess flood above the per-account limit is refused with `RATE_LIMITED` and raises the abuse score. The queue bound answers `ROUND_BUSY`.
- **Authz matrix:** every new route and intent (rounds, teams, seasons, halving days) for anonymous, guest, player, roster player, another host, the host and staff.
- **Feed:** a feed URL pointing to a private range, a redirect to one, an oversized answer or an invalid schema are all refused, and the last good answer stays.
