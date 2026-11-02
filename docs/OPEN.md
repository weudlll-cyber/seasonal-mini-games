# Open — short view

Full list: [BACKLOG.md](BACKLOG.md). Decisions: [DECISIONS.md](DECISIONS.md).

- Specification v1 (01–11) merged into `master` on 2026-10-24, with the owner's answers (DECISIONS O8–O15).
- Merged into `master` on 2026-11-01 (merge `fd8ef34`): the foundation, Guess The Number with its server, client, admin app, e2e journeys 1–19 and a first load check, built on `feat/guess-the-number` and `night/2026-10-27` ([NIGHT-RUN.md](NIGHT-RUN.md)); both branches are deleted.
- E2E journey 8 (embedded handoff) runs against a local test host page (night run 2, N7); the real website side is a website task.
- From the website repository: the In Season feed (with halving days), the handoff endpoint for `seasonal-mini-games` with the optional `links` claim, the chat room `mini-games`, and the route import into its Caddy.

## Owner questions

The first draft's questions (a)–(p) were answered on 2026-10-24 (DECISIONS O8–O15, T21). Questions (q), (s), (t) and (u) and most of (w) were answered on 2026-11-01 (O29–O33). New proposals are listed here, and each one is built as written unless the owner decides otherwise.

**(r) Load gate at 1 000 players.** One plain shared round each, on the development machine (Windows laptop, server under `tsx` in development mode, driver on the same machine), not the reference VPS of 09 §5. 500 players + 100 spectators: acknowledgement p95 133 ms / p99 190 ms, feedback p95 133 ms, nothing lost, duplicated or reordered, one winner, memory 357 MiB; event-loop lag p99 peaked at 87 ms (limit 50 ms). 1 000 players: the fairness checks all hold, but acknowledgement p95 is 4.6 s (limit 300 ms): the server's one thread is saturated, and the profile shows socket writes as the main cost (DECISIONS T49 already merges room frames). Proposal: measure L1 and L4 on the reference VPS before changing the design; if L4 still fails there, raise `SMG_ROOM_FRAME_MS` for large rounds or move the socket fan-out off the round's thread (04 §5.6). Numbers: `reports/night-1/load-500.json`, `load-1000.json`.

**(w) The chat on screen (builtin).** 07 §2 names the providers but not where the chat sits. Built as proposed: in the round view the match chat in the right column under the team tiles (its list scrolls inside itself, the round view stays one screen), on a phone behind a "Chat" button that opens it over the round with the guess input still in view; before and between rounds the match chat as a panel of its own under the waiting area (on a phone behind its "Chat" button, DECISIONS T116), and the lobby chat at the foot of the lobby, each in a box whose list scrolls inside itself (DECISIONS T101); "Report" on every line, and for moderators Delete, Mute 5 min / 1 h / 24 h and Ban, each with a reason and a confirm sentence; an inline mute or ban applies to the whole chat (a ban from the admin API may be kept to one room). Owner decision 32 (2026-11-01) answered two of its questions: a mute covers the whole chat, and the round-end line names the number (T90). Still built as proposed: staff see no mark on flagged messages in the room; flagged messages go to the moderation queue.

**(x) Staff actions as players see them.** Built as proposed: a staff abort reads "The round was aborted: by staff (reason)"; a kicked player who tries to join again is refused with KICKED, "You were removed from this match by the host." (night run 3, the wording given in the task, although staff do the kicking); a removed result still appears in that round's result view, only the standings and boards leave it out (T93).

**(y) The game embedded.** Built as proposed: inside the host's frame the view shows no top bar, only a small "Signed in as <name>" line; a match opened from the embedded lobby opens inside the frame; a page that is not allowlisted, if it ever loads the frame, shows "This site may not show Seasonal Mini Games." The former open points are built (night run 3): an account made by the handoff deletes itself with its display name typed (DECISIONS T105; the player client has no deletion screen yet); in a standalone install `antiMulti.requireLinkedChat` cannot be switched on, the admin form says why, and the server refuses it (T103); `antiMulti.minAccountAgeH` is applied to shared rosters (T103).

**(z) Closeness comments (owner decisions 20 and 21, 2026-10-31).** Built as proposals and adjustable in the admin app: the tier thresholds in percent of the range's width — way off above 50 %, cold above 25 %, cool above 10 %, warm above 3 %, hot above 1 %, burning at or under 1 % (`comments.*Above`); and how often a change of tier gets a trend line instead of a tier line, 33 % (`comments.trendPercent`) (02 §6.3, 08 §3). Lettered (z) because the night branch uses (t)–(y).

**(aa) The fairness proof and player numbers (2026-11-01).** Public answers now name players by their number in the match, never by account id (DECISIONS T104, closing the former question (v)). In an individual round each player's secret is derived from the seed with the label `secret/<account id>`, so an outsider holding only the published proof can check the commitment and the shared secret, but cannot recompute an individual player's secret without that player's account id; the server's own check (`/rounds/:id/verify`) recomputes and shows them all. Proposal: keep it so; a new seed version could derive individual secrets from the match number instead, which would change nothing for rounds already played (their stored seeds keep the old labels).

**(ab) The countdown before a round (2026-11-01).** The countdown is now the round's intro screen (owner decision 36): the season, its special and what it does, the secret and its range, the cooldown and the seconds left. Proposal: `round.countdownS` 10 s instead of 5 s, so the screen can be read; the range stays 3–30 s (02 §3, 08 §3; DECISIONS T109).

## To confirm after the owner has played (night 4)

The architect's rules of 2026-11-01 for the three new games (owner decision 38), built as written; each is a proposal until the owner has played. Engine: DECISIONS T117–T120.

**Seasonal Safecracker**

- Safecracker's rules as a whole (02b): Mastermind feedback `{ exact, near }` with repeats, code length 3–6 (default 4), digits 4–10 (default 10), repeats allowed.
- Safecracker validation codes `CODE_INVALID` and `DIGIT_REMOVED`, checked in the order of 02b §4.
- Safecracker tier table (fixed): score (2·exact + near) / (2·length) with cold < 0.25, cool < 0.45, warm < 0.60, hot < 0.75, burning otherwise; way off at score 0; just missed at length − 1 exact; a fixed proposal table, not settings.
- Safecracker Spring Herald: one position's digit revealed (shared to all, individual each their own).
- Safecracker Leaf Fall: `autumn.digitsPerFall` digits per fall (default 1, 1–3), candidates per 02b §7.3 (0/0 answers prove absence under shared `full`), falls end when no candidate is left; `autumn.count` and `autumn.minRemaining` unused.
- Safecracker has no halving; a halving day runs a normal season round.
- Safecracker closest miss: most exact, then most near, then earlier ("Closest: Anna, 3 right place, 1 wrong place (0427).").
- Safecracker screen: per-digit boxes with auto-advance, filled/hollow pegs plus text, the digit strip as the Leaf Fall panel, input row on two lines on a phone.

**Seasonal Bomb Defusal**

- Bomb Defusal: wires 6 (4–8), cuts 4 (3–6), palette order red, blue, yellow, green, white, black, orange, purple.
- Bomb Defusal: feedback is the length of the correct start; a wrong first cut explodes.
- Bomb Defusal: explosion penalty default 5 s, maximum 30 s, chosen per match (O40 decides only that the host chooses and 0 is allowed).
- Bomb Defusal (residual risk): the explosion penalty is part of the cooldown at once (T120), so under Frost the guesser's ring shows a wrong first cut up to `winter.delayS` early, and another player's longer cooldown may be noticed where the platform shows cooldown state.
- Bomb Defusal: tier rule: 0 wayOff, cuts − 1 justMissed, k = 1 … cuts − 2 spread evenly over cold … burning.
- Bomb Defusal: Spring Herald names the first wire to cut.
- Bomb Defusal: no halving; a halving day runs a normal season round.
- Bomb Defusal: closest miss is the longest correct start, no line when it is 0.
- Bomb Defusal: keyboard 1–8 for wires, Backspace Undo, Escape Clear, Enter Cut; the explosion animation (about 1 s, static flash with reduced motion).

**Seasonal Target**

To confirm after the owner has played:

- 02d §6: others' dots on the map are only their newest 60 guesses (engine view limit, T74).
- 02d §3: map size 50 × 50 (each 20–100) as host settings.
- 02d §4: rejection sentences "That cell is not on the map.", "That cell is outside the target area.", "That cell has fallen.", "You already tried that cell."
- 02d §5: distance rounded to the nearest whole cell, 8 compass sectors of 45°, shown as "9 cells away, to the north-east ↗".
- 02d §5: in `closeness` mode the tier word is shown even with comments off.
- 02d §6: dots per player colour, own dots ringed and all shown, others' only the engine's newest 60, with an arrow restating a `direction` answer.
- 02d §7: closeness tiers by share of the map diagonal (40 / 25 / 12 / 6 / 3 %, touching = just missed) as a fixed table, not admin settings.
- 02d §8.1: Spring Herald names the map quarter (west/north halves rounded up).
- 02d §8.3: Leaf Fall candidates for both feedback modes; `autumn.minCellsLeft` default 10; individual-mode candidates within any player's window.
- 02d §8.4: halving halves the longer side (width on a tie); `halving.minCells` default 16; the map zooms to the target area.
- 02d §9: closest miss by smallest distance, wording "just missed — the next cell" when touching.
- 02d §11: map layout (map left, list right on desktop; map full width on a phone), no zoom, arrow cross, typed coordinates on desktop only.

**All games (game choice, owner decision 41)**

- Owner decision 40 says the host chooses the explosion's waiting time "per match"; like Seasonal Target's feedback mode (O39) it is built as the host's round setting, which the round form keeps from round to round (spec conflict, as for O39).
- To look at (found in CI, night 4; once locally in night 5): a round's intro could stay at "Opens in 0 s" because the client missed the frame of the opening, while the server opened the round on time (night-5 probe). Since T127 the client loads the state again after the opening time, so a player is no longer stuck; why the frame was missed is not found yet (it happened right after a second Quick Test of the same player).

## Spec conflicts

Resolved by the decision rules (owner decisions first, then the more specific section) and listed here for the owner to confirm.

1. **Check order of a guess.** 04 §4.1–§4.2 said the platform checks the cooldown before a game sees an action; 02 §5.1 puts the cooldown last, after range, removed numbers and repeats, and 06 §4.5 agrees. Built as 02 §5.1 (the more specific section): a game's own checks are a pure `validate` before the cooldown check (DECISIONS T29); 04 §4 now says so. Effect: a guess out of range during a cooldown is answered `OUT_OF_RANGE`, not `COOLDOWN_ACTIVE`.
2. **Switching teams and the tie-break (2026-11-01).** 03 §5 let a player switch teams between rounds and broke ties between the smallest teams with the round seed; owner decision 26 fixes the team for the whole match. Built as O26 (owner decisions first): the team is chosen once and locked from the player's first round (`TEAM_LOCKED`), and a player without one is placed in the match's smallest team when their first round starts; the tie-break uses a hash of the round id and the player key, because the match layer does not hold the sealed seed (DECISIONS T82). 03 §5 now says so.

## Spec gaps

1. **`round_results.secret`.** 06 §2.4 has a column for an individual player's secret, written at the end. The server is game-agnostic and the game-module contract has no way to name "the secret of this player", so the column stays NULL; the result view and `/rounds/:id/verify` show every secret. Proposal: drop the column in the next spec change, or add a contract hook if a report needs it.
2. **The feed's host allowlist.** 07 §5 asks for "host on the allowlist", but no setting holds such a list. Built: the feed address itself (`seasons.feedUrl`, security admin, https only) is the one host allowed, and every address it resolves to must be public. Proposal: keep it so; add a list only if a second outside source comes.
