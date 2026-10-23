# Decisions

Owner decisions, technical decisions with their reasons, security decisions, and rejected approaches. A decision is changed only by a task that says so. When it is changed, the old entry stays and is marked as superseded.

## 1. Owner decisions (2026-10-24)

| # | Decision | Applied in |
|---|---|---|
| O1 | The platform foundation is adopted from seasonal-bingo-royale. | 04 §2, 05 §1, 06 §1, 07 §1, 09 §1, 10 |
| O2 | The first game is Guess The Number. The other games of the vision (Seasonal Target, Seasonal Safecracker, Seasonal Bomb Defusal, Seasonal Prediction, Seasonal Higher Or Lower, Seasonal Mystery Object) are listed in the roadmap only, with no design work now. | 02, 11 §3, GAME-IDEAS.md |
| O3 | Fast guessing games use a per-player cooldown: a player may guess whenever they want, and then a waiting time applies to that player. The waiting time is the same for every player in a round. Host-configurable range 3 s to 60 s. No global tick. Games designed as long-running keep their own timing. | 02 §7, 04 §4.3, §5.5 |
| O4 | The winner is the player whose correct guess the server receives first. The server's receive order is authoritative. Ties are impossible by construction (single ordered processing per round). | 02 §5.2, §8.1, 04 §5.2 |
| O5 | Two secret modes, chosen by the host per round: shared secret (all players search the same number; the main purpose of the platform is playing together) and individual secret (each player has their own number). In individual mode, placings follow the order in which players solve their own number. | 02 §3, §8 |
| O6 | Seasonal specials, all applying to every player at the same moment and equally. Season rounds: each round belongs to one of the four seasons. Spring "Spring Herald": every player receives one free hint at round start (e.g. odd/even). Summer "Heatwave": the cooldown shrinks step by step for everyone, never below 3 s. Autumn "Leaf Fall": at intervals, some wrong numbers are removed from the range, visible to all. Winter "Frost": hints are delivered with a delay of a few seconds. In Season: the active season can follow the token currently in season (fed from the Seasonal Entertainment website); otherwise the host picks the season manually. Halving round: on a real halving day, a special round in which the number range halves at intervals. Season teams: in shared mode players join one of four season teams; the leaderboard also shows a team standing. Visuals: each round uses its token's original colours and icon (assets as in the Bingo repo). | 03 |
| O7 | Specification first, code afterwards (architect decision). | 01 §2, 10 §5 |

## 2. Technical decisions

| # | Decision | Reason |
|---|---|---|
| T1 | Names: package scope `@smg/*`, env prefix `SMG_`, DB schema `smg`, CLI `smg`, install root `/opt/smg` (full list in 04 §2.2). | Parallel to Bingo's names, but distinct, so both can run on one server and one development machine without any shared name. |
| T2 | One base path for the whole platform on the website: `/games/mini-games`. | The website's rule is that games live at `/games/<name>` (Bingo D6). The games here are modules of one app with one login and one lobby, so they get one path, not one per game. |
| T3 | Local ports 3910 (server), 5410 (player client), 5411 (admin client), 5510 (PostgreSQL), 1110 / 8510 (Mailpit). Container-internal ports 3100 (app) and 9465 (metrics). | Every one differs from every Bingo port and from the off-limits list (10 §4). The container ports differ too, so that logs, snippets and network configs on a shared website network never mix the two apps up. |
| T4 | One round actor per open round, on one instance, with a FIFO queue. Intents are appended synchronously in socket read order. `receiveSeq` is assigned when the actor takes an item. | Gives O4 exactly one ordering point. No `await` between read and append means no reordering inside the process. |
| T5 | Group commit: events are written in batches (20 ms or 200 events). Acknowledgements and broadcasts are sent only after commit. | One transaction per guess would cost a round trip per guess at about 170 guesses a second. Batching keeps that low, while sending after commit means a crash can never undo an announced winner. |
| T6 | Cooldown is a stored end time per player, checked in the queue. There is no timer per player. | O3's "no global tick" in code. Constant work per guess, nothing to schedule, trivially restart-safe. |
| T7 | Per-round 256-bit seed from the CSPRNG. Bingo's HMAC-SHA256 counter DRBG with labels. Secrets derived and never stored. Seed encrypted with `SMG_ROUND_KEY`. | Reproducible and verifiable (the fairness proposal needs it), nothing secret in a dump, one proven generator reused from Bingo. One key for seeds follows Bingo's built `SBR_SEED_KEY`. |
| T8 | Game-module contract in `packages/game-sdk`. Games live in `games/<game>`. `games/registry.ts` is the only place that names a game. Winning and placings stay in the platform. | Maintainability (priority 1): adding a game touches no platform code. O4 and O5 are inherited by every later game unchanged. |
| T9 | Load tests use a Node.js driver with `socket.io-client` (`load/guessStorm.mjs`), not k6. | Bingo specified k6 but built a Node.js driver (`load/drawLatency.mjs`), which worked. k6 needs an extension for the Socket.IO protocol. One language for all code. |
| T10 | The event log is per round (`round_events`), with snapshots every 200 events and compaction of guess events after 90 days. | Rounds are the unit of play and of recovery. Matches can run for hours, and a per-match log would grow without bound. |
| T11 | Heatwave and Frost are platform features. Spring Herald, Leaf Fall and halving are optional game hooks. | Heatwave and Frost act on cooldown and delivery, which the platform owns, so every cooldown game gets them for free. The others need knowledge of the game's secret. |
| T12 | Rejected guesses are not events: they are counted in metrics and the abuse score only. | They change nothing (P4), and storing them would let a flood fill the log. |
| T13 | Scale-out keeps a round on one instance. A misrouted intent is refused with `RESYNC`, never forwarded. | Forwarding would add a second ordering point and break O4. |
| T14 | The In Season feed is polled server to server through `SafeHttpClient`, cached in `season_feed_state`, and never taken from the embedding page. | SSRF safety, and no page can choose a round's season. |
| T15 | The chat provider gets a third value, `none`. | Embeds on sites that have their own chat should not show a second one. |
| T16 | Client clock offset from `time.sync`, for display only. | Cooldown rings and countdowns look right on devices with a wrong clock. The server never uses it. |
| T17 | `match_players` and `round_results` use a text `player_key` (account id, or `bot-NN` in development). | Bingo's built tables use this pattern (`player_id`) so that bots fit. Bingo 04 §3.3 states an `account_id` key, which cannot hold bots. The built version is the one that works. |
| T18 | A match is a lobby in which the host runs rounds one after another, with settings frozen per round. | O5 and O6 set mode and season per round. A fixed tournament structure, as in Bingo, would add rules nobody asked for. |
| T19 | Sizing target 500 per round and 1 000 per server, as a load gate (09 §5); the target itself is a proposal (OPEN.md). | A shared round is the main use, so it must hold a large crowd. The numbers set what is tested. |
| T20 | Round seeds use their own key `SMG_ROUND_KEY`. `SMG_MASTER_KEY` comes only when TOTP or OIDC secrets are built. | Same as Bingo's built server, and no unused secret. |

## 3. Security decisions

| # | Decision | Reason |
|---|---|---|
| S1 | The cooldown is enforced only on the server, per account (not per socket), at server receive time. | Clients can be changed. Several sockets or the HTTP fallback must not multiply the rate (05 §2). |
| S2 | Secrets are never stored and never put into a view or a room frame. Views are validated against schemas without secret fields, and a sentinel test runs over every view and frame. | A leak is the worst failure of this game (05 §3). |
| S3 | All round randomness comes from the seeded DRBG. `Math.random` is banned by lint in `packages/` and `games/*/src`. | Predictability and verifiability (05 §4). |
| S4 | No latency compensation. | It would trust client-reported or inflatable times (05 §7). See R3. |
| S5 | Abuse signals (cooldown rejections, guesses at bot-like timing, shared IP or device in one match) only raise a score for moderators. There are no automatic sanctions. | False positives must not remove honest players. This is Bingo's principle (Bingo 03 §13). |
| S6 | The host and admins see only the spectator view of a running round. | Nobody inside the app can learn a running secret (M10). |
| S7 | Frost-held answers are not part of any state answer until they are delivered. | Otherwise a state request would skip the delay (M9). |
| S8 | The handoff claim `links` carries only the facts "telegram" and "discord", never handles. | Data minimisation (Bingo 03 §19). |
| S9 | Each round queue has a bound (5 000). Beyond it, guesses are refused with `ROUND_BUSY` and start no cooldown. | A flood against one round cannot exhaust memory (M7). |

## 4. Rejected approaches

| # | Approach | Why rejected |
|---|---|---|
| R1 | A global tick or turn-based rounds in which all players guess at once | Excluded by O3. |
| R2 | Holding a guess sent during the cooldown and firing it when the cooldown ends | It would make server timers part of the receive order, and it hides the cost from the player. A refused guess is sent again by the player. |
| R3 | Latency compensation (ordering by client send time or measured round trip) | Client times and round trips can be faked or inflated, which would turn a physical disadvantage into a cheat (05 §7). |
| R4 | Storing secrets in a column, even encrypted | Deriving them from the encrypted seed leaves nothing extra to leak or keep in sync. |
| R5 | Bingo's off-the-aggregate path for high-frequency input (marks recorded outside the match queue) | A shared-secret win needs one total order over all guesses (O4). |
| R6 | Forwarding intents between instances | A second ordering point (T13). |
| R7 | Building a general guess engine now | It depends on owner question (c). Simplicity until a second game needs it (01 §3). |
| R8 | k6 for load tests | See T9. |
| R9 | Client-side cooldown or feedback computation | Server authority (S1, Bingo 03 §1). |
| R10 | One service per game | A modular monolith is enough and is simpler to run (Bingo 02 §1). |
| R11 | Redis from day one | No benefit at the launch size (Bingo 02 §9). |
| R12 | Bingo's live-call link (`host_call_ref`) in v1 | Not part of the owner's decisions for this platform. It can return as its own task. |
