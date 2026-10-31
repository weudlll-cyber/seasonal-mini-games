# Open — short view

Full list: [BACKLOG.md](BACKLOG.md). Decisions: [DECISIONS.md](DECISIONS.md).

- Specification v1 (01–11) merged into `master` on 2026-10-24, with the owner's answers (DECISIONS O8–O15).
- Built on branch `feat/guess-the-number`, not merged: the foundation, Guess The Number with its server, client, admin app, e2e journeys and a first load check (night run 1, [NIGHT-RUN.md](NIGHT-RUN.md)). Next: the owner's review of that branch.
- E2E journey 8 (embedded handoff) waits for the handoff itself (roadmap phase 7).
- From the website repository: the In Season feed (with halving days), the handoff endpoint for `seasonal-mini-games` with the optional `links` claim, the chat room `mini-games`, and the route import into its Caddy.

## Owner questions

The first draft's questions (a)–(p) were answered on 2026-10-24 (DECISIONS O8–O15, T21). New proposals are listed here, and each one is built as written unless the owner decides otherwise.

**(q) Winning-margin window.** The round closes at the winning guess, so "the next correct guess" has to arrive within a window to count for the margin. Proposal: `round.marginWindowS` 2 s (0.5–10 s); without a correct guess in that window, the result says "nobody else was close" (02 §9).

**(r) Load gate at 1 000 players.** One plain shared round each, on the development machine (Windows laptop, server under `tsx` in development mode, driver on the same machine), not the reference VPS of 09 §5. 500 players + 100 spectators: acknowledgement p95 133 ms / p99 190 ms, feedback p95 133 ms, nothing lost, duplicated or reordered, one winner, memory 357 MiB; event-loop lag p99 peaked at 87 ms (limit 50 ms). 1 000 players: the fairness checks all hold, but acknowledgement p95 is 4.6 s (limit 300 ms): the server's one thread is saturated, and the profile shows socket writes as the main cost (DECISIONS T49 already merges room frames). Proposal: measure L1 and L4 on the reference VPS before changing the design; if L4 still fails there, raise `SMG_ROOM_FRAME_MS` for large rounds or move the socket fan-out off the round's thread (04 §5.6). Numbers: `reports/night-1/load-500.json`, `load-1000.json`.

**(s) Halving round with a hidden range.** A halving window tells where the range is, so with the range hidden (O19) a halving round runs as a normal season round of that season: the season and its special stay, halving is off (DECISIONS T55). With it, Spring Herald gives the odd-or-even hint instead of "which half" (T56). Proposal: keep it so; the host form says it beside the halving switch.

**(z) Closeness comments (owner decisions 20 and 21, 2026-10-31).** Built as proposals and adjustable in the admin app: the tier thresholds in percent of the range's width — way off above 50 %, cold above 25 %, cool above 10 %, warm above 3 %, hot above 1 %, burning at or under 1 % (`comments.*Above`); and how often a change of tier gets a trend line instead of a tier line, 33 % (`comments.trendPercent`) (02 §6.3, 08 §3). Lettered (z) because the night branch uses (t)–(y).

## Spec conflicts

Resolved by the decision rules (owner decisions first, then the more specific section) and listed here for the owner to confirm.

1. **Check order of a guess.** 04 §4.1–§4.2 said the platform checks the cooldown before a game sees an action; 02 §5.1 puts the cooldown last, after range, removed numbers and repeats, and 06 §4.5 agrees. Built as 02 §5.1 (the more specific section): a game's own checks are a pure `validate` before the cooldown check (DECISIONS T29); 04 §4 now says so. Effect: a guess out of range during a cooldown is answered `OUT_OF_RANGE`, not `COOLDOWN_ACTIVE`.

## Spec gaps

1. **`round_results.secret`.** 06 §2.4 has a column for an individual player's secret, written at the end. The server is game-agnostic and the game-module contract has no way to name "the secret of this player", so the column stays NULL; the result view and `/rounds/:id/verify` show every secret. Proposal: drop the column in the next spec change, or add a contract hook if a report needs it.
2. **The feed's host allowlist.** 07 §5 asks for "host on the allowlist", but no setting holds such a list. Built: the feed address itself (`seasons.feedUrl`, security admin, https only) is the one host allowed, and every address it resolves to must be public. Proposal: keep it so; add a list only if a second outside source comes.
