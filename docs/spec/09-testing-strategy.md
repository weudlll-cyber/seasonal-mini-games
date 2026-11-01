# 09 — Testing Strategy

> Part of the Seasonal Mini Games specification. Index: [README](README.md). Bingo references: see [README](README.md) §2.

## 1. Adopted from Bingo

| Topic | Bingo reference | Difference here |
|---|---|---|
| Principles: pure engine tested exhaustively, infrastructure with real Postgres, few E2E journeys plus component tests, path-based CI job selection, a failing test before every fix, short measurements | Bingo 12 §1 | None. |
| Test pyramid and its tools (Vitest, fast-check, Testcontainers, contract tests, Testing Library, Playwright in Chromium, Firefox and WebKit mobile, security tests); coverage targets domain ≥ 95 %, application ≥ 85 % | Bingo 12 §2 | `game-sdk` and every `games/*/src` also have a ≥ 95 % target. Load testing uses a Node.js driver (DECISIONS T9). |
| Security tests (authz matrix generated from the permission table, CSRF, headers, rate limits, fuzzing, JWT, upload, SSRF, ZAP baseline) | Bingo 12 §6 | Additions in §6. |
| Test data and determinism (fixed seeds, failing seeds turned into regression tests, shared builders, tests remove their accounts and abort their matches, timing specs in their own Playwright projects, fixed local ports) | Bingo 12 §7 | Ports from [10](10-repository-structure.md) §4. Builders: `aRound().shared().withPlayers(500)`. |
| Manual acceptance by the owner with a Quick Test seed | Bingo 12 §8 | The Quick Test plays rounds against bots (§5), through the waiting area or started at once (owner decision 24). |

## 2. Levels specific to this platform

| Level | Scope |
|---|---|
| Unit and property | `domain` (lifecycle, cooldown, ordering, placings, teams, special scheduling), `game-sdk` (DRBG helpers, range arithmetic), `games/guess-the-number/src` (feedback, hints, Leaf Fall, halving, the closest miss: ties, none, a hidden range) |
| Unit and property, guess engine | `packages/guess-engine`: secrets per mode and label, the repeat check, the room line per visibility, comment picking without early repeats, Frost-held answers absent from views, the closest miss (ties, none), the public answers of the Leaf Fall rule (owner decision 37) and the uniform distinct draw |
| Golden (Guess The Number on the engine) | `games/guess-the-number/src/golden.test.ts`, recorded on `master` before the move to the engine (DECISIONS T118): for the Quick Test seeds `acorn`, `meadow` and `frost` (round seed `sha256("smg-quicktest:" + text)`), shared and individual, the secrets, a fixed run of guesses with their events (answers and comment lines), two Leaf Fall drops with `full` and with `own`, the Spring Herald hint and three halvings. The move passes it unchanged |
| Unit and property, the new games | `games/safecracker`, `games/bomb-defusal`, `games/seasonal-target`: the feedback rule (properties against a brute-force reference), tiers, validation codes, specials, the Leaf Fall candidates of owner decision 37 and the sentinel test that the secret never reaches a client, as listed in 02b–02d |
| Conformance | One shared suite run against every module in `games/registry` (invariants P1–P6). A new game is green only when it passes. |
| Engine integration | The round actor with real Postgres: group commit, restart recovery, scheduler precision, Frost after restart; the match flow (owner decisions 26–28): `TEAM_LOCKED` over socket and HTTP, the placement in the smallest team, End match with the summary, and the idle close with a fake clock and after a restart |
| Component | Range bar, cooldown ring, guess list, roster, team standing, result screen; the input row keeps typed text across the round opening and while an answer is on its way; the waiting area's team buttons only before the player's first round and its player rows (team, connection); End match's confirm sentence and the match summary |
| E2E | Journeys in §4 |
| Load | §5, release gate |

## 3. Invariants (property tests, 1 000 cases per property in CI; whole-round properties capped at 100)

**Platform conformance (every game module):**

- **P1 Determinism.** Same seed, same settings and the same ordered inputs ⇒ identical event list.
- **P2 No secret leaks.** With unique sentinel secrets, no serialized player view, spectator view, room frame or rejection answer of a running round contains a sentinel. Result views contain them only after the end. With a hidden range, its bounds count as sentinels too (DECISIONS T52). Nothing about an answer travels without it: a closeness comment sits only beside its feedback, and while Frost holds every answer no view shows either (owner decision 21, DECISIONS T73). In individual mode a player who solved their own secret sees that one mark in their view and no other, their solve tells no one else their mark, and no other view holds it (owner decision 25; the kit's `solve` action).
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
- **S3 Leaf Fall.** No fall removes any secret of the round. All players see the same removed set. Each fall removes `count` numbers, or fewer only at the `minRemaining` stop, which counts candidates. Every fallen number is a candidate (owner decision 37): inside the intersection of the delivered public answers under `full`, never a guessed number; a Frost-held answer does not count yet; the same seed and guesses give the same drops (`leafFall.test.ts`).
- **S4 Frost.** Each answer is delivered `delay` after its receive time. Metamorphic: the same inputs with and without Frost give the same order, winner and placings.
- **S5 Halving.** Every range always contains its secret. Sizes halve (rounded up) at each due time until the minimum. All players have the same size at the same time.
- **S6 Teams.** Teams never change during a round. The winner's team gets exactly 1 point per round, and no other team gets any. Team standings are a total order.
- **S7 Simultaneity.** Specials due at the same instant run in the order halving → Leaf Fall → Heatwave, in one step.
- **S8 In Season.** A feed answer older than `staleAfterH` is never used for a round.

## 4. E2E journeys

1. Two players and a host: shared round, cooldown 3 s, the host starts it, both guess, one wins, both see the result and the revealed secret; the cooldown ring blocks the button. Also at 390 × 844.
2. Individual round with three players: placings in solve order; a solved player keeps their own rows, with a notice and their place instead of the input row (owner decision 25); time-up ends the round with "not solved" rows.
3. Each season special once (fast test profile): Spring's free hint shown, Heatwave value drops, Leaf Fall strikes numbers, Frost shows "answer arriving…".
4. Halving round on a test halving day: the range halves, and a guess outside it is refused without cost.
5. Teams: four players pick teams in the waiting area, the team standing updates after the round, a team change is refused with `TEAM_LOCKED` once the round started, and the waiting area for the next round follows the result with each player's team and no team buttons, with no player box on the result itself (owner decisions 23, 26).
6. Reconnect mid-round: the cooldown is unchanged after reconnect, there are no duplicate guesses, and Frost answers arrive after reconnect.
7. Spectator (guest): sees the feed at the round's visibility and never a number or feedback under `own`.
8. Embedded: JWT handoff from a test host page (`e2e/host-page`, port 5420) signs the player in inside the iframe; the same page from an origin that is not on the allowlist cannot frame the game and its handoff is refused (Bingo journey 7).
9. Accessibility: axe checks on lobby, round and result; keyboard-only guessing.
10. Hidden range (owner decision 19), 1280 × 720: the round view says "Any whole number", no bound is on the page, a guess far outside the range is answered, and the result reveals the range.
11. Negative bounds (owner decision 18), 390 × 844: the Quick Test form takes "-500" typed key by key into Lowest number and, with "Start from the lobby" off, starts a round from −500 to 500 at once (T69); the range is shown, the ± button makes a typed number negative, the guess is answered, and the round plays to its result.
12. Quick Test through the lobby (owner decisions 22–24, 26, 27): the form with "Start from the lobby" on opens the waiting area; the bots appear one after another, online, with their teams; the player ("no team yet") picks a team, which shows pressed; the host menu's Start starts the round; the round runs with the bots playing; the result names the closest miss (or the margin, when a second correct guess came within its window); the waiting area for the next round follows with the team kept and no team buttons; a second round from the host menu; then End match with its confirm sentence, and the match summary with two rounds, the four players and the link back to Play, also after a reload. Beside the result the chat is a panel of its own, apart from "Next round"; the summary fits one screen at 1280 × 720 and 390 × 844 (DECISIONS T116).
13. Boards (roadmap phase 4): four players play two counting matches; the points add up on the season board with the team board beside it, the profile shows them, the round's verification page confirms the seed against the commitment, and aborting the matches takes the points back.
14. Chat (roadmap phase 5, `builtin`): two players chat in a match; a moderator mutes one, whose next message is refused, lifts the mute and bans; with `integrations.chatProvider` = `none` the chat panel is gone.
15. Admin (roadmap phase 6): the admin changes a special's default, sees the change in the document's history, rolls it back through the confirm dialog, and aborts a running round with a reason, which the player sees as aborted by staff.
16. Each season in view (owner decisions 35, 36), one test per season with the range shown and the fast test profile: the countdown is the intro screen with the season, its special and its sentence, the secret line and the cooldown, one screen at 1280 × 720 and 390 × 844; once open, the chip names the special and its info note gives the sentence; the special's banner appears above the guess list (Frost after the player's guess, with "answer arriving…"); Spring's free hint stays highlighted; the round view fits both sizes.
17. A match without teams (owner decision 34): a Quick Test with Team match off shows no team text, buttons or column in the waiting area, no team tiles in the round and no team result.
18. Leaf Fall (owner decision 37): an autumn Quick Test with `full` visibility; for two falls every newly fallen number lies inside the candidate set the public answers left before it and is no guessed number; the Fallen numbers panel lists exactly the fallen numbers, ascending with separators; the Leaf Fall row stands out; a fallen number typed in gets "Already fallen."; the view fits 1280 × 720 and 390 × 844, the panel opening as a sheet on the phone (`e2e/leafFall.spec.ts`).
19. A 12-player match summary (DECISIONS T116): a Quick Test with 11 bots, the round and the match ended by the host; the summary's 12 standings rows, its last row and "Back to Play" are in view with no page scrollbar at 1280 × 720 and 390 × 844.
20. Seasonal Safecracker ([02b](02b-game-safecracker.md)): a Quick Test through the lobby, shared and individual; the digit boxes take a code key by key with the focus moving on, a row shows its pegs and the counts in words; Spring's revealed digit and Autumn's fallen digits (a guess with a fallen digit refused at no cost); no page scrollbar at 1280 × 720 and 390 × 844 (`e2e/safecracker.spec.ts`).
21. Seasonal Bomb Defusal ([02c](02c-game-bomb-defusal.md)): a Quick Test through the lobby, shared and individual; tapping wires builds the sequence, Undo and Clear work, Cut sends; a wrong first cut shows the explosion and a cooldown longer by the explosion setting; Spring's first colour and Autumn's harmless wire; no page scrollbar at both sizes (`e2e/bombDefusal.spec.ts`).
22. Seasonal Target ([02d](02d-game-seasonal-target.md)): a Quick Test through the lobby, shared and individual, with distance only (the default) and with closeness only (owner decision 43); a click selects a cell, the arrow buttons and keys move it, the coordinates show as text, Guess sends and the dot appears; Spring's quarter, Autumn's fallen cells, a halving window; no page scrollbar at both sizes (`e2e/target.spec.ts`).
23. Game choice (owner decision 41): the create-match form and the Quick Test form offer the four games with a help line and only the chosen game's settings; the lobby, the Play list and the match summary name the match's game (`e2e/gameChoice.spec.ts`).

Journeys 1–19 are Guess The Number's and stay unchanged by the guess engine (DECISIONS T117).

Journeys 1, 10, 11, 16 and 20–22 also check that the round view fits the screen: `document.scrollingElement.scrollHeight` is at most `window.innerHeight` ([02](02-game-guess-the-number.md) §12).

The **fast test profile** exists only in development builds (as Bingo 12 §4): special intervals of a few seconds; the countdown stays as chosen, because it is the round's intro screen (owner decision 36), and scripted Quick Test calls choose 3 s. Published defaults are unchanged, and a test proves it.

### 4.1 The guess games' tests

**Seasonal Safecracker**

- **Unit (`games/safecracker/src`):** the feedback rule against the worked example of 02b §5.1 (1123 vs 1312, 1111, 2211, 1123) and edge cases (all digits equal, a code with every digit different, length 3 and 6, digits 4); `validate` order and codes (`CODE_INVALID` for wrong length, a non-digit, a digit ≥ `code.digits`, an empty string; `DIGIT_REMOVED`; `ALREADY_GUESSED`), leading zeros kept; the tier table at every boundary, including that 2 exact + 2 near at length 4 is burning; Spring Herald's position and digit (shared one, individual one per player); Leaf Fall's candidate steps 1–4 for each visibility and mode, the empty-candidate end, fewer candidates than `digitsPerFall`; closest miss (exact then near then earlier, the winner excluded, none, margin instead).
- **Property:** `exact + near ≤ L`; `exact = L` iff the codes are equal; feedback is symmetric (`f(g, s) = f(s, g)`); `near` equals the multiset-intersection size minus `exact`; secrets lie in the code space and are uniform per position (chi-square smoke test, as G7); no fallen digit is in any secret of the round; under shared `full` every fallen digit was a candidate given the answers delivered before `releasedBefore` (a Frost-held 0/0 answer does not count), and otherwise no fallen digit is in any accepted guess; same seed and guesses give the same falls.
- **Conformance:** the module passes P1–P6 from `games/registry`, with the kit's actions `guess`, `solve`, a 0/0 guess and a repeat.
- **Sentinel (P2):** short digit strings collide with times and ids in serialized JSON, so the kit uses `code.length` 6 with distinct per-player sentinel codes that no guess of the run uses, and searches for each as a JSON string token (`"482915"`) and as its digit sequence in any array; no player or spectator view, room frame or rejection of a running round contains one, nor another player's Spring Herald hint, nor a `{ exact, near }` while Frost holds it; the closest miss appears only in the result view.
- **E2E journey (Safecracker):** Quick Test with "Start from the lobby" on and game `safecracker`; bots join with teams, the owner picks a team and starts the round from the host menu; the intro shows "Shared 4-digit code, digits 0–9"; a shared round: boxes advance on typing, Backspace goes back, an invalid digit and a repeated code are refused with their sentences, a guess shows pegs and "N right place, M wrong place", the round reaches its result with the code revealed and the closest miss line; then an individual round in the same match (intro "Everyone has their own …", others' rows show only "tried a code", a solved player sees their place); then one round per season special with the fast test profile: Spring's "Free hint: the Nth digit is D" stays highlighted, Heatwave's banner, Leaf Fall strikes a digit in the strip and a code with it is refused with "That digit has fallen.", Frost's "answer arriving…"; every round view, the intro and the result checked with `document.scrollingElement.scrollHeight ≤ window.innerHeight` at 1280 × 720 and 390 × 844 (six boxes at 390 × 844 included, `code.length` 6) (`e2e/safecracker.spec.ts`).

**Seasonal Bomb Defusal**

- Unit (`games/bomb-defusal/src`): feedback = longest correct prefix (a right wire after a wrong one counts nothing); `solved` at `k = cuts`; the tier rule for cuts 3–6 exactly as 02c §7 (k = 1 cold, k = cuts − 2 burning, every tier reachable); validation order and codes (`SEQUENCE_INVALID` for wrong length, unknown wire, a wire beyond `bomb.wires`, a wire twice; `WIRE_HARMLESS`; `ALREADY_GUESSED` only for the identical order); closest miss: longest start, earlier on a tie, no line when the best is 0, none without another player's wrong sequence.
- Property: secrets are `cuts` distinct wires of the round, uniform over the orders (chi-square smoke); the explosion penalty is applied exactly on a wrong first cut (`k = 0`) and never otherwise, and equals `bomb.explosionPenaltyS` for every player (`extraCooldownMs` on the accepted decision); with penalty 0 no extra wait; G3 holds with the penalty included (cooldown in force at receive time + penalty); Heatwave never shortens the penalty.
- Property (Leaf Fall, owner decision 42): each fall marks exactly one wire outside every secret sequence, whatever the guesses; the same for everyone; when the last such wire is marked the row "Leaf Fall: every harmless wire is marked." appears once and the falls stop; in individual mode only wires outside every player's sequence count; same seed, same marks.
- Property (Spring Herald): the hint is the true first wire (shared one for all; individual each their own).
- Conformance: the shared suite P1–P6; the kit's dev bot only sends valid sequences and solves a round with a 3 s cooldown.
- Sentinel (P2): with sentinel sequences, no player view, spectator view, room frame or rejection of a running round contains a secret sequence; under Frost neither the explosion nor its comment appears in any view before the answer's delivery (the guesser's `cooldownEndsAt` with the penalty is the accepted residual, DECISIONS T120); under `own`/`numbers` and individual mode no other player's or spectator's view shows an explosion row or answer.
- E2E journey "Bomb Defusal through the lobby": Quick Test for `bomb-defusal` with "Start from the lobby" on; bots join; the player builds a sequence with taps (Undo, Clear, Cut enabled only when full), a wrong first cut shows the explosion and a cooldown longer by the penalty (and the static flash with reduced motion emulated); one shared round played to its result with the revealed sequence and the closest-miss line; one individual round with placings; then one round per season special in the fast test profile: Spring's first-wire hint in slot 1, Heatwave's lower cooldown with the penalty on top, Leaf Fall's harmless wire struck and its button disabled ("That wire is harmless …" without sending), Frost's "answer arriving…" with the explosion only after it; at 1280 × 720 and 390 × 844 `document.scrollingElement.scrollHeight` ≤ `window.innerHeight` in every round view, all wire buttons ≥ 44 px.

**Seasonal Target**

- **Unit (`games/seasonal-target/src`):** distance rounding by the integer rule equals `Math.round(Math.hypot(dx, dy))` for every `n` up to 99² + 99²; the 8-sector test against an `atan2` reference for every `(dx, dy)` in −99…99 (no cell on a boundary); the worked examples of 02d §5 as fixed cases; the tier table at both sides of each threshold and for touching cells, on 20 × 20, 50 × 50, 100 × 20 maps; the quarter hint for even and odd sizes; `OUT_OF_MAP` (map and window), `CELL_REMOVED`, `ALREADY_GUESSED` in the 02d §4 order; the closest miss by `n` with a tie to the earlier guess, touching wording, none without another player's wrong guess.
- **Property, Leaf Fall (`direction`):** with a shared secret and `full`, every fallen cell gets from every delivered public guess the same rounded distance and direction as the secret; no fallen cell was guessed or is a secret; an answer held by Frost (`receivedAt ≥ releasedBefore`) does not cut the set; the secret is always a candidate-consistent cell.
- **Property, Leaf Fall (`closeness`):** the same with "the same tier by the fixed table" in place of distance and direction.
- **Property, Leaf Fall (other modes):** under `own`, `numbers` and in individual mode the candidates are exactly the cells in the window(s) not fallen, not guessed and no secret, independent of any answer; falls stop exactly at `autumn.minCellsLeft`; same seed and guesses give the same cells.
- **Property, halving:** every window always holds its secret (shared and each player's own), lies inside the previous one, has the longer side halved rounded up (width on a tie), the same size for every player at the same time, and stops once the area ≤ `halving.minCells`; positions are uniform among the legal ones (chi-square smoke test); with Leaf Fall at the same instant, halving runs first and candidates count only inside the window.
- **Conformance:** the shared P1–P6 suite with the game's kit (actions over the whole map, the `solve` action, both feedback modes, both secret modes, every season, halving).
- **Sentinel (P2):** secret cells as sentinel pairs: no view, frame or rejection of a running round carries a secret cell, an individual quarter or an individual window of another player; under `own` and in individual mode no other player's guessed cell is in any view; the map selection is never sent.
- **E2E journey (`e2e/seasonalTarget.spec.ts`):** Quick Test through the lobby with Seasonal Target, shared, `full`, `direction`: the intro says "Shared target on a 50 × 50 map"; the player selects a cell by click, moves it with the arrow buttons and the keyboard arrows, types coordinates on desktop, sees "Selected: column …, row …", guesses and gets "N cells away, to the …"; bot dots appear with their colours and the own dots with a ring; the result marks the target cell with its coordinates. Then an individual round with `closeness`: the answer is a tier word, others' rows say only "guessed" and their dots are absent. One round per season special (fast test profile): Spring's quarter outlined with its hint line, Heatwave's step, Leaf Fall's hatched cells with a fallen cell refused as "That cell has fallen.", Frost's hollow own dot with "answer arriving…"; a halving round on a test halving day shrinks the map to the target area and refuses a guess outside it. Every round view at 1280 × 720 and 390 × 844 with no page scrollbar (`scrollHeight ≤ innerHeight`).

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

The results of each security pass (secret scan of the history, dependency audits, ZAP baseline) are kept in [../security-pass.md](../security-pass.md), newest first, with the raw reports in `reports/` (DECISIONS T106).

- **Cooldown bypass:** one account guesses from two sockets, from a socket plus the HTTP fallback, and across a reconnect. Exactly one guess per cooldown is accepted.
- **Secret scan:** P2 also runs as an integration test over real frames and every HTTP answer of a running round, the admin API included. The same test finds no account id in any public answer or frame, during the round or after it (result and proof included): players are named by their number in the match (DECISIONS T104).
- **Frost early read:** `GET …/state` during the delay never contains the held answer.
- **Audience:** a spectator socket and a second player's socket never receive another player's `guess.result`, `hint` (individual) or `range.changed`.
- **Rate limits:** a guess flood above the per-account limit is refused with `RATE_LIMITED` and raises the abuse score. The queue bound answers `ROUND_BUSY`.
- **Authz matrix:** every new route and intent (rounds, teams, seasons, halving days) for anonymous, guest, player, roster player, another host, the host and staff; and rows beyond permissions: a kicked player joining again (`KICKED`), the linked-chat rule in a standalone install (`SETTING_UNAVAILABLE`), and the minimum account age on a shared roster.
- **Feed:** a feed URL pointing to a private range, a redirect to one, an oversized answer or an invalid schema are all refused, and the last good answer stays.
