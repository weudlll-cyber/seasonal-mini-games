# 05 — Security and Threat Model

> Part of the Seasonal Mini Games specification. Index: [README](README.md). Bingo references: see [README](README.md) §2.

## 1. Adopted from Bingo

The whole of Bingo's security architecture applies, with the names of [04](04-software-architecture.md) §2.2:

| Topic | Bingo reference | Difference here |
|---|---|---|
| Principles: server authoritative, zero trust, least privilege, secure by default, defense in depth, nothing of value; ASVS 5.0 L2 (L3 for auth, sessions, admin) | Bingo 03 §1 | None. |
| Local accounts, argon2id, uniform login answers, password reset, TOTP (mandatory for admin roles), guests | Bingo 03 §2 | Guests may watch rounds; they never appear on a roster. |
| Sessions, cookies, lifetimes, rotation, step-up | Bingo 03 §3 | Cookie names `__Host-smg_session` / `__Secure-smg_session`. |
| JWT use (embed token, inbound handoff), `jose` rules, key rotation | Bingo 03 §4 | Audience `seasonal-mini-games`. |
| RBAC roles and permissions, privilege separation, break-glass CLI | Bingo 03 §5 | `organizer` hosts matches. New permissions: `round.manage` (create, start, end and abort rounds in one's own match), `season.manage` (feed URL, halving days). |
| Input handling (parameterized SQL, no HTML from users, strict DTOs, JSON limits) | Bingo 03 §6 | None. |
| Browser security headers, CSP, separate admin CSP | Bingo 03 §7 | None. |
| CSRF (SameSite plus synchronizer token, WS `Origin` check) | Bingo 03 §8 | None. |
| Cryptography in transit and at rest, secrets handling | Bingo 03 §9 | Round seeds are encrypted with `SMG_ROUND_KEY` (§3). Bingo's built server uses one `SBR_SEED_KEY` for match seeds, while Bingo 03 §9 and 08 §5 name `SBR_MASTER_KEY`; this repo follows the built pattern for round seeds and adds `SMG_MASTER_KEY` only when TOTP or OIDC secrets are built. |
| SSRF prevention (`SafeHttpClient`) | Bingo 03 §10 | Also used for the In Season feed ([07](07-integration.md) §5). |
| Anti-cheat principles | Bingo 03 §11 | Replaced for this game by §2–§7. The leaderboard write rules are kept. |
| Chat safety | Bingo 03 §12 | None. |
| Rate limiting layers 1–3, soft lockout, abuse score | Bingo 03 §13 | WS intent limits in §5. |
| Uploads (admin branding only) | Bingo 03 §14 | None. |
| Backup and disaster recovery | Bingo 03 §15 | A host failure aborts running rounds. Rounds in `countdown` or `open` resume after a plain process restart (§2). |
| Audit log (append-only, hash chain) | Bingo 03 §16 | More actions are logged (§8). |
| OWASP Top 10 mapping, supply chain, privacy | Bingo 03 §17, §18, §19 | None. |

## 2. Cooldown enforcement on the server

The cooldown (owner, decision 3) exists **only** on the server. The client's cooldown ring is a display.

- **Stored per player per round:** the round actor keeps `cooldownEndsAt` for each roster player, keyed by **account**, not by socket, tab or device. Two tabs, a phone and the HTTP fallback all share one cooldown.
- **Checked in the queue:** check 7 of [02](02-game-guess-the-number.md) §5.1 runs inside the round actor at processing time, against the server's `receivedAt`. Nothing the client sends (timestamps, counters) takes part in it.
- **Not resettable:** reconnecting, re-joining the match, switching team or switching device does not touch `cooldownEndsAt`. After a server restart it is rebuilt from the event log (the accepted guess and the cooldown value in force at that time).
- **Rejections are cheap and visible:** a guess during the cooldown is rejected with `COOLDOWN_ACTIVE` and the end time. Nothing is stored except a counter. More than 20 such rejections a minute from one account raise its abuse score (Bingo 03 §13) and show in the admin dashboard. A normal client never sends them, because its button is disabled.
- **Tested:** invariant G3 and the security tests in [09](09-testing-strategy.md) §6.

## 3. The secret never reaches a client

- **Derived, not stored.** Secrets are derived from the encrypted round seed inside the round engine ([04](04-software-architecture.md) §5.4). No table has a secret column. A database dump without `SMG_ROUND_KEY` reveals no secret of a running round.
- **Views per viewer.** Every frame and every HTTP state answer is built from the game module's `views.player`, `views.spectator` or (after the end) `views.result`, and is validated against its zod schema before sending. The player and spectator schemas have no field that can hold a secret. The conformance test P2 ([09](09-testing-strategy.md) §3) fills rounds with unique sentinel secrets and searches every serialized view and room frame for them.
- **Audience routing.** Events addressed to `player:<id>` never go to the room. Frost-held events are not part of any state answer until they are delivered (no early read through `GET …/state`).
- **No other path.** The admin API, the host console, logs (Pino redaction of `seed`, `secret*`), error messages, metrics labels and webhooks never carry a secret or seed of a running round. The host and admins see what a spectator sees (Bingo 01 §9 principle).
- **No timing side channel.** The work done for a guess does not depend on how close it is to the secret: one comparison and constant-size answers. With Frost, every answer is held for exactly the same delay.
- **After the end:** the secret or secrets are public (shown on the result). With the fairness proof on, so is the seed ([02](02-game-guess-the-number.md) §10).

## 4. Cryptographic randomness

- Round seeds: 256 bits from `crypto.randomBytes` through the `SecureRandom` port. Never from `Math.random`, the time or anything a player can influence.
- Everything random in a round (secrets, hint choice where relevant, Leaf Fall removals, halving windows, team tie-breaks) is drawn from the seed's HMAC-SHA256 DRBG with domain separation ([04](04-software-architecture.md) §5.4), with uniform integers by rejection sampling.
- Lint forbids `Math.random` in `packages/` and `games/*/src`. A statistical smoke test (chi-square over 100 000 draws) guards the integer helper in `game-sdk`.
- A secret cannot be predicted from public data: the seed is fresh per round, and before the end only `sha256(seed)` is public.

## 5. Rate limits

Bingo's layers apply (Bingo 03 §13). The intent limits differ:

| Intent or route | Limit | On excess |
|---|---|---|
| `guess` (WS), per account across all sockets | 4 / s, burst 4 (the cooldown already allows at most one accepted guess per 3 s; this caps the rejected ones) | `RATE_LIMITED`; counts towards the abuse score |
| `POST …/guesses` (HTTP fallback) per session | 1 / s | 429 |
| `team.choose` | 1 / 5 s | `RATE_LIMITED` |
| Host round commands (create, start, end, abort) | 1 / 2 s per host | `RATE_LIMITED` |
| Other intents | 10 / s per socket overall | as Bingo 06 §8 |
| Sockets per account / per IP | 5 / 10 | as Bingo 06 §8 |

The round queue is bounded at 5 000 items. Beyond that, new guesses are refused with `ROUND_BUSY`, are not queued, and do not start a cooldown. With the limits above, the bound is reached only in an attack. The load gate checks that it is never reached in normal play ([09](09-testing-strategy.md) §5).

## 6. Multi-account risk in shared mode

**The risk.** With a shared secret, one person with several accounts has several cooldowns, and therefore several times the guess rate of an honest player, on the same number. They can also fill a team. This is a real advantage, larger than in Bingo, where a second card gave little.

**Baseline controls (adopted):** e-mail verification before ranked play, sign-up limits per IP, heuristics that flag accounts sharing an IP prefix or device when they join one match (flag only, never an automatic ban), and league points only from matches with enough distinct verified players (Bingo 03 §11). Moderators can remove a round's result for an account.

**Optional rules (owner, decision 10: both built, both off by default):** in shared mode, a player may join a round's roster only if:

- the account is at least `antiMulti.minAccountAgeH` hours old (default 0 = off, max 720), and/or
- in website installs, the account is linked to Telegram or Discord on the website, as reported in the handoff token's claims (`antiMulti.requireLinkedChat`, default off).

Both can only be checked on a fact the server holds. Standalone installs have no Telegram or Discord link, so there the second rule cannot be switched on.

**Residual:** a determined person with several verified, aged, linked accounts can still multiply their rate. That is accepted and stated in §10.

## 7. Network latency and "first received wins"

The owner's rule is that the server's receive order decides (decision 4). This is fair in the sense that the rule is the same for everyone and cannot be manipulated by a client. It is **not** fair in the sense that every player has the same chance when two of them send the right number at nearly the same moment:

- A guess travels from the player's device to the server. A player 20 ms away beats a player 200 ms away if both press Guess within about 180 ms of each other. Wi-Fi, mobile networks, VPNs and distance all add to this, and so does the HTTP fallback, which is slower than the WebSocket.
- **When it matters:** only when two correct guesses arrive within a fraction of a second of each other. With `feedbackVisibility = full`, which is the default (owner, decision 8), every player sees every answer. Once the shared band has shrunk to one number, many players know the secret at the same moment, and **the last step is then a pure latency race**. Players closer to the server win those races more often. With `own` this is rare, because players narrow down separately. The host can pick `own` or `numbers` per round when a crowd with very different connections plays.
- **What is not done:** there is no latency compensation. Any compensation would trust client-reported times or measured round trips that a client can inflate, which would turn a physical disadvantage into a manipulable one (DECISIONS R3).
- **What is done:** receive time is taken at the server's process. The path is the same for everyone (Caddy → app, no queue in front of the round actor). The receive gap to the next correct guess, if one arrives within `round.marginWindowS`, is stored with the result and shown as the winning margin (owner, decision 13: "found it 0.4 s before Anna", 02 §9). The latency of each socket is measured (Socket.IO ping) and exported as a metric, so the operator can see how large the spread actually is.
- **Bots:** a script can binary-search perfectly and send each guess the instant its cooldown ends. The cooldown limits its rate exactly like a human's, so its edge is reaction time and accuracy. Guesses that repeatedly arrive within a few milliseconds of `cooldownEndsAt` raise the abuse score for moderator review (no automatic sanction).

## 8. Admin audit log

Bingo 03 §16 applies unchanged (append-only table, trigger against UPDATE and DELETE, hash chain, retention, export). Logged in addition to Bingo's list:

- Round created (its full settings), started, ended by the host, aborted (with reason): these are also shown publicly on the round's result ("ended by the host").
- Match opened, closed or aborted; a player kicked from a match (reason required).
- Changes to the halving-day list, the In Season feed URL and every settings document (before/after diff).
- Removal of a round result for an account (moderation, §6), and any team reassignment by staff.
- Every read of a finished round's seed through the admin API (not needed for players: the public result already has it when the fairness proof is on).

## 9. Threat model

Method and Bingo's threats T1–T28 are adopted (Bingo 13 §1–§4; trust boundaries unchanged, plus the outbound feed at boundary 5). Threat T6 (multi-accounting) is rated higher here (L3, I2) because of §6. New threats:

| # | Boundary | STRIDE | Threat | L | I | Controls |
|---|---|---|---|---|---|---|
| M1 | 1 | T | Bypassing the cooldown with several sockets, tabs or the HTTP fallback | 3 | 3 | Per-account cooldown in the round actor (§2) |
| M2 | 1 | T | Manipulating the client timer or clock | 3 | 1 | Server ignores client time; check at `receivedAt` (§2) |
| M3 | 1 | I | Reading the secret from a view, frame, error, log or state answer | 2 | 3 | Derived secrets, per-viewer views with schemas, sentinel conformance test, redaction (§3) |
| M4 | 1 | I | Predicting the secret | 1 | 3 | CSPRNG seed per round, DRBG, commitment only (§4) |
| M5 | 1 | E | Several accounts in one shared round | 3 | 2 | Baseline controls; optional account-age and linked-chat rules (§6) |
| M6 | 1 | T | Winning by low latency or by a bot | 3 | 1 | Stated rule, no compensation, metrics, abuse score (§7) |
| M7 | 1 | D | Guess flood against one round's queue | 2 | 3 | Per-account and per-socket limits, bounded queue, Caddy limits (§5) |
| M8 | 1 | T | Replayed or duplicated guess intents | 2 | 1 | Per-socket `seq` (Bingo 06 §4); `ALREADY_GUESSED` (02 §5.1) |
| M9 | 1 | I | Learning Frost-held answers early | 2 | 2 | Held events excluded from state answers until delivered (§3) |
| M10 | 1/6 | I | Host or admin learns the secret and plays with another account | 1 | 3 | Host and admin views equal spectator views; seed encrypted; operator with shell and key remains trusted (§10) |
| M11 | 5 | S | Spoofed or wrong In Season feed | 1 | 1 | HTTPS allowlist through `SafeHttpClient`; worst case a wrong season, equal for all; host can always pick by hand |
| M12 | 1 | T | Fake halving day to run a halving round | 1 | 1 | Server checks the calendar at round creation; list edits audited (§8) |
| M13 | 1 | E | A spectator or another player receives a player's private frames | 2 | 2 | Per-player rooms, audience routing, authz matrix test ([09](09-testing-strategy.md) §6) |

## 10. Residual risks (accepted)

- Several real, verified accounts in the hands of one person still multiply their guess rate in shared mode (§6).
- Latency decides between correct guesses that arrive close together (§7). This follows from owner decision 4.
- An operator with shell access and `SMG_ROUND_KEY` can decrypt seeds of running rounds. The operator is trusted, as in Bingo.
- Bingo 13 §5's residual risks (DDoS beyond the uplink, lost backup key) apply unchanged.
