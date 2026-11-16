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
| Integrated mode: header trust, roles from the website, what website mode switches off (owner decision 66) | Bingo 03 §2.2 (D37, D41–D43, D46) | The identity headers (`X-Acting-User-Id`, `X-Acting-User`, `X-Acting-User-Roles`, `X-Acting-User-Email-Verified`, `X-Acting-User-Can-Host`, `X-Acting-User-Steps`, and `X-Acting-Guest`; names configurable) are read on `GET <base>auth/website` only, only in website mode, only from a TCP peer in `SMG_TRUSTED_PROXIES` and only with the proxy secret in `X-Smg-Proxy-Secret` (constant-time compare); anything else is 403 with nobody signed in, and every other route ignores them. The route file the installer writes (0600) clears client-sent `X-Acting-User*`, `X-Acting-Guest` and `X-Smg-Proxy-Secret`, asks the website for that route only and adds the secret after that call; the website's session cookie goes to that call only, never to the app. Roles: `admin` → `game_admin`, can-host → `organizer`, never `super_admin` or `security_admin`. Registration, password sign-in, password change and the dev sign-in answer 404. A deleted, locked or changed website account loses its game sessions through the account-changes feed, whose token is never logged ([07](07-integration.md) §7). |
| RBAC roles and permissions, privilege separation, break-glass CLI | Bingo 03 §5 | `organizer` hosts matches. New permissions: `round.manage` (create, start, end and abort rounds in one's own match), `season.manage` (feed URL, halving days). |
| Input handling (parameterized SQL, no HTML from users, strict DTOs, JSON limits) | Bingo 03 §6 | None. |
| Browser security headers, CSP, separate admin CSP | Bingo 03 §7 | None. |
| CSRF (SameSite plus synchronizer token, WS `Origin` check) | Bingo 03 §8 | None. |
| Cryptography in transit and at rest, secrets handling | Bingo 03 §9 | Round seeds are encrypted with `SMG_ROUND_KEY` (§3). Bingo's built server uses one `SBR_SEED_KEY` for match seeds, while Bingo 03 §9 and 08 §5 name `SBR_MASTER_KEY`; this repo follows the built pattern for round seeds and adds `SMG_MASTER_KEY` only when TOTP or OIDC secrets are built. |
| SSRF prevention (`SafeHttpClient`) | Bingo 03 §10 | Also used for the In Season feed ([07](07-integration.md) §5). The website's account-changes feed is read from the operator's local address in the env file, not through it ([07](07-integration.md) §7.3, DECISIONS T217). |
| Anti-cheat principles | Bingo 03 §11 | Replaced for this game by §2–§7. The leaderboard write rules are kept. |
| Chat safety | Bingo 03 §12 | None. |
| Rate limiting layers 1–3, soft lockout, abuse score | Bingo 03 §13 | WS intent limits in §5. |
| Uploads (admin branding only) | Bingo 03 §14 | None. |
| Backup and disaster recovery | Bingo 03 §15 | A host failure aborts running rounds. Rounds in `countdown` or `open` resume after a plain process restart (§2). |
| Audit log (append-only, hash chain) | Bingo 03 §16 | More actions are logged (§8). |
| OWASP Top 10 mapping, supply chain, privacy | Bingo 03 §17, §18, §19 | Account deletion (`DELETE /me`): the account goes with its sessions, roles, league points and website link; matches, rounds and chat messages keep their history without the link to it. An account made by the website's handoff confirms with its display name typed (DECISIONS T105); the player client's form is on the account page (T170). |

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
- **No other path.** The admin API, the host console, logs (Pino redaction of `seed`, `secret*`), error messages, metrics labels and webhooks never carry a secret or seed of a running round. When a round runs, the host gets the same player view as every player and plays along (owner decision 16, DECISIONS S10); admins who are not playing get the spectator view. Neither view holds a secret (Bingo 01 §9 principle).
- **No timing side channel.** The work done for a guess does not depend on how close it is to the secret: one comparison and constant-size answers. With Frost, every answer is held for exactly the same delay.
- **A hidden range is a secret too.** With the range hidden ([02](02-game-guess-the-number.md) §3, owner decision 19), its bounds reach no client while the round runs: the views carry `range: null`, no guess is refused as out of range, Spring Herald gives no half hint and no halving runs (DECISIONS T52–T56). P2 searches for the bounds as for the secrets.
- **Leaf Fall hints by design (owner decision 37).** In autumn rounds with visibility `full` the fallen numbers are drawn only from the numbers still possible given the public answers, so they reveal the candidate region around the shared number. This is accepted as an exception to owner decision 17; the candidates use no answer a player could not see (a Frost-held answer counts once delivered), never contain a secret, and no view carries a narrowed range (DECISIONS T111). With `own`, `numbers` and in individual mode no answer is used. As before, fallen numbers lie inside a hidden range.
- **The other guess games ([02b](02b-game-safecracker.md), [02c](02c-game-bomb-defusal.md), [02d](02d-game-seasonal-target.md)).** Every rule above holds for each of them: the code, the wire sequence and the target cell are derived through the guess engine ([04](04-software-architecture.md) §4.7), never stored, and appear in no view, frame or event of a running round; P2 covers each game through its conformance kit with sentinel secrets that no test guess can hit or neighbour. Their Leaf Fall analogues (fallen digits, harmless wires, fallen cells) follow owner decision 37 exactly as above: with a shared secret and `full`, candidates only from what every delivered public answer still allows; otherwise only values nobody has guessed; never a secret, and in individual mode never any player's secret, so a fall cannot tell one player about another's code. Spring Herald's reveal (a digit, the first cut's colour, two map quarters) and Seasonal Target's halving window are about the viewer's own secret in individual mode and go to that player alone. Seasonal Target's two quarters are the target's and a decoy from the round's randomness, always sent in the fixed quarter order, so nothing a client receives tells which one holds the target (owner decision 61). Game-specific threats are listed in each game's section.
- **After the end:** the secret or secrets are public (shown on the result), and so is the range. With the fairness proof on, so is the seed ([02](02-game-guess-the-number.md) §10).

### 3.1 The guess games, per game

**Seasonal Safecracker**

- **The code never leaves the engine in a running round:** derived from the round seed (`secret/shared`, `secret/<playerId>`), absent from every player and spectator view schema, room frame, rejection, log line and admin answer; the result view carries it after the end (05 §3). A rejection never depends on the secret (`CODE_INVALID`, `DIGIT_REMOVED`, `ALREADY_GUESSED` are decided from settings, fallen digits and the guesser's own list only).
- **Spring Herald in individual mode:** each player's hint (position and digit of their own code) goes only to `player:<id>`; spectators and other players get only "everyone got a free hint".
- **Leaf Fall candidate leakage (O37):** a fall reveals only that a digit is absent from every secret of the round. Under shared `full` the candidates use only answers every player saw (the 0/0 rule, Frost cut `releasedBefore`); under `own`, `numbers` and in individual mode no answer is used, only accepted guesses. Accepted residual: under `own` a fall shows that no one has guessed that digit yet, and in individual mode it shows that the digit is in no player's code (the same kind of hint as Guess The Number's Leaf Fall, DECISIONS T111). With many individual players nearly every digit is in some code, so falls stop early; that ends the falls and leaks nothing more.
- **No timing side channel:** the feedback is a fixed-size count over at most 6 positions; work does not depend on closeness.
- **Input validation:** the action schema is zod `{ value: string }` with `^[0-9]{3,6}$` and length ≤ 6 before `validate`; anything else is `CODE_INVALID` (or a schema rejection at the boundary), never an exception. Guesses are the existing `guess` intent with its rate limit (05 §5); typing into the boxes sends nothing.

**Seasonal Bomb Defusal**

- The secret sequence never in any view, frame, event or rejection of a running round; the result alone reveals it (P2 with sentinel sequences).
- Explosion as a side channel (residual risk, proposal, OPEN): the penalty is part of the one platform cooldown end (T120), so under Frost the guesser's own ring shows a wrong first cut up to `winter.delayS` early (that player only), and where the platform shows others' cooldown state (02 §11) a longer cooldown of another player may be noticed. No game-specific special case.
- Leaf Fall candidate leakage (O37): candidates use only delivered public answers (shared `full`), never a private answer, never any secret wire; outside shared `full` no wire that appears in a guess; individual mode one set for all.
- Input: the action is the existing guess intent with a zod schema (array of exactly `cuts` palette names, at most 6 entries, strings from the enum only); nothing is sent per tap; per-intent rate limits as 05 §5.
- Penalty bounds: `bomb.explosionPenaltyS` validated 0–30 on the match form and again on the server (`ROUND_SETTINGS_INVALID`); a client cannot shorten its own `cooldownEndsAt` (05 §2).

**Seasonal Target**

- **Map clicks are local:** selecting, tapping, the arrow buttons, keyboard arrows and typed coordinates never send anything; only Guess sends the existing guess intent with its rate limit and cooldown, so no new intent or per-click traffic exists and hover/selection never leaks where a player is aiming.
- **Coordinates validated:** zod accepts only integers inside the round's map; floats, huge numbers, strings and extra fields are refused before the game sees them; the window check is server-side (`OUT_OF_MAP`).
- **Candidate leakage (O37):** only answers delivered before `releasedBefore` and only with shared + `full` cut the Leaf Fall candidates; under `own`, `numbers` and individual mode the candidates use no answer. With `full`, fallen cells lie where the target can still be — accepted as with Guess The Number (03 §2.3). Fallen cells never include a secret, so the remaining cells hold every secret; the `autumn.minCellsLeft` stop keeps at least that many non-secret candidates.
- **Per-player parts:** individual quarter pairs, windows and the own guesses' cells reach only their player; spectators and the room line get only counts and sizes. Under `own` and in individual mode no view carries other players' cells.
- **Triangulation is by design:** `direction` answers under `full` let everyone locate the target from a few public answers; that is the game, not a leak. No server-computed candidate area exists in any view (O17).
- **Cost of the candidate rule:** up to 10 000 cells × every delivered public answer; computed incrementally (each new answer cuts the remaining set once), never re-scanning all answers per fall, so a fall stays within the queue's processing budget at 500 players and a 100 × 100 map (load test L1 with Seasonal Target).
- **View size:** others' dots come only from the engine's newest-60 guesses; the own guesses are capped by the cooldown and round length; the result's full dot list is sent once at the end.

### 3.2 Seasonal Mind Games: the live state is the secret (DECISIONS S11)

Seasonal Mind Games ([02e](02e-game-mind-games.md)) has no secret value, but its **live state** is worth as much: who chose what in the last `D` seconds (the round's delay), how the counts stand now, who is in the round now, and every player's pre-picks. The server alone holds it. Before the round ends, nothing younger than the delay reaches anyone by any path, and pre-picks reach nobody but their owner, ever ([04](04-software-architecture.md) §4.8 rules 5 and 8):

- **Views and state answers:** every player and spectator view and every `GET /rounds/:id/state` answer is built with `releasedBefore = now − D`. Another player's action, a count, a total and a player's place in the round's list appear only once they are `D` old. Only the viewer's own current choice, own box and own pre-picks are live in their own view.
- **WebSocket frames:** room and host events are released by the round actor once `D` old; the room's frames and the state's `since` use a release sequence of their own, so no number in a frame counts unreleased actions. The acknowledgement of a choice is `{ ok: true }` or `{ ok: false, code }` and carries no `receiveSeq`, time or count. `match.updated` and the waiting area name match players and their connection, never whether or what they chose.
- **The host:** once a round has started the host has the player view like everyone (owner, decision 88; S10). The host menu holds controls and settings, no count, choice or pre-pick.
- **Admin and public routes:** the admin API's round view of a running Mind Games round is the spectator view (§3), so it is delayed too; no admin route returns a running round's events, a player's current choice or anyone's pre-picks. The public read API ([07](07-integration.md) §1) gives a running round's status and phase times only. Webhooks, the chat's round-end line and `standings.updated` come after the end.
- **Logs and metrics:** a choice's value, a count, a total and a pre-pick are never logged (Pino redaction of `choice`, `prefs`, `counts`) and never a metric label; metrics count actions by result code only (06 §4.6).
- **Server-side windows:** the platform refuses every action at or after the play's end (`PLAY_OVER`) and every first action at or after the join time's end (`JOIN_CLOSED`) at the server's receive time, whatever the client shows or sends (02e §5.2). Pre-picks enter only at the opening and pass the same checks.
- **After the end:** the final choices, the counts and the winners are public in the result; switch histories and pre-picks stay private (02e §9).
- **Tested** as invariant P7 and MG1–MG7 ([09](09-testing-strategy.md) §3, §4.2) and by the security test "Mind Games early read" ([09](09-testing-strategy.md) §6).

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
| `GET <base>auth/website` (website mode) per address | 30 / min | 429 |
| `GET <base>auth/website/login` (website mode) per address | 600 / min | 429 |
| Sockets per account / per IP | 5 / 10 | as Bingo 06 §8 |

The guess games of [02b](02b-game-safecracker.md)–[02d](02d-game-seasonal-target.md) add no intent: a Safecracker code, a Bomb Defusal sequence and a Seasonal Target cell are each one `guess` with the limits above, validated with the game's zod schema before the round queue. Typing a digit, tapping a wire, and clicking, tapping or arrow-moving the selection on the map change only the client's own selection and send nothing; only "Guess" (the full code, "Cut", the selected cell) sends, so a burst of map clicks costs the server nothing (map-click rate limits).

Seasonal Mind Games' choice is the same `guess` intent with the same limits: at most 4 accepted switches a second per account, so a player cannot flood the feed; the release once a second merges every switch of that second into one room frame ([04](04-software-architecture.md) §4.8). Its pre-picks travel by `match.prefs`, at most 1 every 2 s per account (*proposal*), at most 2 KiB.

The round queue is bounded at 5 000 items. Beyond that, new guesses are refused with `ROUND_BUSY`, are not queued, and do not start a cooldown. With the limits above, the bound is reached only in an attack. The load gate checks that it is never reached in normal play ([09](09-testing-strategy.md) §5).

## 6. Multi-account risk in shared mode

**The risk.** With a shared secret, one person with several accounts has several cooldowns, and therefore several times the guess rate of an honest player, on the same number. They can also fill a team. This is a real advantage, larger than in Bingo, where a second card gave little.

**Baseline controls (adopted):** e-mail verification before ranked play, sign-up limits per IP, heuristics that flag accounts sharing an IP prefix or device when they join one match (flag only, never an automatic ban), and league points only from matches with enough distinct verified players (Bingo 03 §11). Moderators can remove a round's result for an account.

**Optional rules (owner, decision 10: both built, both off by default):** in shared mode, a player may join a round's roster only if:

- the account is at least `antiMulti.minAccountAgeH` hours old (default 0 = off, max 720), and/or
- in website installs, the account is linked to Telegram or Discord on the website, as reported in the handoff token's claims (`antiMulti.requireLinkedChat`, default off).

Both can only be checked on a fact the server holds. Standalone installs have no Telegram or Discord link, so there the second rule cannot be switched on. Built (DECISIONS T103): the account age is checked when a shared roster freezes; an install is a website install when it has an enabled JWT handoff provider, and without one the admin form disables the second rule with its reason and the server refuses it.

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
| M10 | 1/6 | I | Host or admin learns the secret and plays with another account | 1 | 3 | The host's view is the same player view as everyone's (O16), an admin who is not playing gets the spectator view, and no view or host control holds a secret; with a hidden range the host knows the bounds they chose, which every host of such a round does; seed encrypted; operator with shell and key remains trusted (§10) |
| M11 | 5 | S | Spoofed or wrong In Season feed | 1 | 1 | HTTPS to the one host a security admin set (`seasons.feedUrl`), public addresses only, no redirects, through `SafeHttpClient` (07 §5); worst case a wrong season, equal for all; host can always pick by hand |
| M12 | 1 | T | Fake halving day to run a halving round | 1 | 1 | Server checks the calendar at round creation; list edits audited (§8) |
| M13 | 1 | E | A spectator or another player receives a player's private frames | 2 | 2 | Per-player rooms, audience routing, authz matrix test ([09](09-testing-strategy.md) §6) |
| M15 | 1/2 | S | Forged website identity headers: a browser or another local process names a member or an admin | 2 | 3 | Headers read on one route only, only from a trusted proxy peer with the proxy secret (constant time), cleared by the proxy before it adds the website's answer; roles capped at `game_admin`; tests for untrusted peers, a missing or wrong secret and the headers on other routes ([07](07-integration.md) §7.1) |
| M16 | 1 | S | An open redirect through the sign-in's `next` | 2 | 1 | Only a printable path under the base path without scheme, host, `//` or backslash; anything else goes to the lobby |
| M17 | 1 | I | Mind Games: learning choices, counts, entries or pre-picks younger than the delay (state answer, frame sequence, acknowledgement, admin or public route, log) | 2 | 3 | Delayed views and release sequence, `{ ok }` acknowledgement, pre-picks only to their owner, redaction (§3.2); P7 and the early-read test ([09](09-testing-strategy.md) §3, §6) |
| M18 | 1 | T | Mind Games: a choice or first choice after the play or join time ends (a changed client, a slow network) | 2 | 2 | `PLAY_OVER` and `JOIN_CLOSED` at the server's receive time; pre-picks only at the opening (§3.2) |
| M19 | 1 | E | Mind Games: several accounts of one person steer the counts (one account makes an option look crowded, another takes the least chosen) | 3 | 2 | Baseline controls and the league minimum of distinct players (§6); accepted residual (§10) |
| M14 | 1 | I | Learning more from closeness comments than from higher or lower | 3 | 1 | Accepted by the owner (O21, 2026-10-31); see §10. The tier is computed on the server; the client never gets the secret; the comment rides on the events that carry the answer, so Frost and the visibility rules hide it exactly as they hide the answer (DECISIONS T73); no line holds a digit or names the range; a guess outside a hidden range gets the farthest tier |

## 10. Residual risks (accepted)

- Several real, verified accounts in the hands of one person still multiply their guess rate in shared mode (§6).
- Latency decides between correct guesses that arrive close together (§7). This follows from owner decision 4.
- An operator with shell access and `SMG_ROUND_KEY` can decrypt seeds of running rounds. The operator is trusted, as in Bingo.
- Closeness comments (owner decision 21, chosen on 2026-10-31) tell more than higher or lower: a tier says how far a guess was from the secret as a share of the range, so two or three tiers narrow the search much faster than the answers alone, and under `full` visibility everyone reads them. With a hidden range many tiers together hint at the range's size (a guess that is "cold" at a known distance bounds the width), even though no line states the bounds. The host can switch the comments off per round (`round.comments`).
- In Seasonal Mind Games several accounts of one person count as several players and can steer the counts (M19); players may also tell each other their choices in the chat, which is part of the game. The host's End round fixes the final choices at a moment the host picks, seeing only the delayed feed like everyone.
- Bingo 13 §5's residual risks (DDoS beyond the uplink, lost backup key) apply unchanged.
