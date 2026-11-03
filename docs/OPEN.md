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

- 02d §6: others' tiles come from their newest 60 guesses only (engine view limit, T74).
- 02d §5: distance rounded to the nearest whole tile, 8 compass sectors of 45°, shown as "9 tiles away, to the north-east ↗"; on the tile the distance and a small arrow. Every player-visible text says "tile" (night 6).
- 02d §5: in `closeness` mode the tier word is shown even with comments off.
- 02d §6 (O45): the 5-step heat scale (way off and cold share step 1, burning and just missed step 5, the found tile its own mark); a tile several players guessed shows the closest answer and one corner mark for the first other player, its title and label every guess; numbers left out on tiles under 20 px (the loupe and the title still give them; T137); tiles outside the target area dimmed to 30 % opacity, below the 3:1 of the scale on purpose.
- 02d §7 (O45): closeness tiers by share of the grid's diagonal **and** a minimum distance, so every tier occurs on every grid from 8 to 30: way off over 48 % and over 7.81 cells, cold over 32 % and 6.32, cool over 20 % and 4.47, warm over 12 % and 3.61, hot over 6 % and 2.83, burning two tiles away, just missed touching; a fixed table, not admin settings. Reachable distances: 8 × 8 burning 2–2.83, hot 3–3.61, warm 4–4.47, cool 5–6.32, cold 6.40–7.81, way off 8.06–9.90; 20 × 20 burning 2–2.83, hot 3–3.61, warm 4–5.10, cool 5.39–8.54, cold 8.60–12.81, way off 13–26.87; 30 × 30 burning 2–2.83, hot 3–4.47, warm 5–8.06, cool 8.25–13.04, cold 13.15–19.65, way off 19.70–41.01. The tier travels with every answer now (the tile's colour), so Leaf Fall's candidates keep the same tier as well as the same distance.
- 02d §8.1: Spring Herald names the grid's quarter (west/north halves rounded up) and tints its tiles.
- 02d §8.3: Leaf Fall candidates for every feedback mode; `autumn.minCellsLeft` default 10, at most 50 (an 8 × 8 grid has 64 tiles); individual-mode candidates within any player's window.
- 02d §8.4: halving halves the longer side (width on a tie); `halving.minCells` default 16, at most 32 (an 8 × 8 grid is halved at least once); the whole grid stays shown, the tiles outside the target area dimmed.
- 02d §9: closest miss by smallest distance, worded "Closest miss besides the winner: Anna, 3 tiles away (9, 10)." or "…, right next to the target (13, 11)." when touching; in individual mode the result's grid shows only the viewer's own guesses (the others' answers are about their own targets), every player in text.
- 02d §11 (O45, O51): the grid takes the stage at full height under the bar (about 30 px tiles at 20 × 20 on 1280 × 720, 47 px at 1920 × 1080); the legend, the hint and fallen tiles, the list, then the selection with the ring and Guess in the right column; the Column and Row fields and the arrows behind "Type coordinates" (closed by default); the hint quarter in a fixed green (#7cc46a) with a "Hint" tag in both themes; on a phone (narrow or a coarse pointer, tiles under 44 px) the first tap opens a loupe of 5 × 5 tiles of at least 44 px over the grid, with the fields, the arrows and Close; Guess sends and closes it; with tiles of 44 px or more a tap selects at once. The loupe does not take the focus when it opens (it is made for touch).

**All games: focus mode (owner decision 46)**

Built as described in 02 §12 and DECISIONS T128–T132 and T134–T136 (O47–O52); to confirm after the owner has played:

- The result page reached at the end of a round comes with the normal header at once, because it shows beside the next round's waiting area (T128).
- The round bar (O47): on a phone the season pill is the special's button (a desktop has the special's line in its info column since T141); "9:50 left"; Chat, Players, Host and Full screen as icons with their words on a desktop, icons only on a phone; 14 px text, 44 px high on a desktop, 52 px on a phone.
- A panel on a desktop is a 360 px column that pushes the game aside (O48): at 1280 × 720 that narrows Seasonal Target's stage to about 520 px while it is open (tiles about 25 px at 20 × 20).
- The result page on a desktop is one screen (night 6): the headline across, the game's result left and the tables right; with many players the tables scroll inside their part. A phone scrolls the page, the result first.
- The light/dark toggle lives in the app header, which focus mode hides; the theme chosen before the round stays, and O46's bar lists no toggle, so none was added. A sixth button would not fit the phone's bar beside Host and Full screen; inside the Players panel it could.
- Guess The Number's Fallen numbers open from their "Fallen (N)" button as a sheet on a desktop too (T132); since O50 the list is in the main area, so they could stand open in the right column again.

**Night-7 layout, to confirm** (proposals T141–T142, owner decision 54; built on `feat/guess-games`):

- One layout for every game: a desktop (landscape, 900 px wide or more) has the stage on the left and a 340 px info column on the right; anything narrower or in portrait, a tablet held upright included, gets the phone layout (T141).
- The desktop's info column: the special's line (one line, all of it on a click; the desktop's pill no longer opens a note), the game's panel, then "Your guesses" for the three list games in shared mode; in individual mode it is left out, because the stage then holds exactly the viewer's guesses (T141).
- The phone's info line: one line per game, its tap opening the game's panel as a sheet; Guess The Number's Fallen numbers are a button inside that sheet (T141).
- The list's head: the number of guesses or, in individual mode, the others' counts instead of their rows; the banner takes the head's place for 5 s; events (Leaf Fall, Heatwave, solves) are only in "All (N)", which counts guesses and events (T142).
- One-line rows: a desktop cuts the comment with an ellipsis (the tooltip has it all); a phone shows the newest row's comment and a tap shows or hides any other's (T142).
- Bomb Defusal's sequences as colour dots with their names in the tooltip; "First 2 cuts right" for a right start. Safecracker's answers without zero parts ("2 right · 1 wrong place", "no digit right") and the legend line in its panel (T143).
- Seasonal Target: the "Hint" tag moves to the quarter's first tile inside a halved area; on a phone the grid is the full width minus 8 px a side (T144).
- Result pages: the slim result bar instead of the app header, the first part on one screen (top three placings, "All placings", one team line), standings below; a time-up result's "Closest guess"; the summary's teams one line each (T145).

**Night-6 small items (T139), to confirm:**

- Safecracker: a row turns green once at least half the digits are in the right place, for every row; the counts read "1 right place, 2 right digits, wrong place".
- Own rows and Seasonal Target's own tiles use the viewer's dot colour (their team's when teams play), no longer the round's season colour.

**Night-6 screenshot review, for the owner** (the list with its places is in NIGHT-RUN.md, Night 6):

- A list game's right column holds only its panel (O50), so below it the column stays empty; with a panel on demand open on a desktop that empty column sits in the middle.
- A result with many guesses: on a desktop the game's part (each player's guesses) scrolls inside itself rather than growing the page; with four players or more the tables part can too.
- The result page reached at a round's end keeps the full app header on a phone (T128), the match summary has the compact one; the summary's team list on a phone is numbered and wraps ("Team Autumn: 1 / point").
- Team points (one per round won) beside player points (10 for a win) read as a contradiction on the result ("Team Spring: 1 point — the winner's team" beside its player's 10 points); the placings list the viewer first, also with 0 guesses.
- A time-up result has no closest-miss line: O22's closest miss excludes the winner, so it is defined only when someone won.
- Safecracker's counts keep their zero parts ("0 right places, 3 right digits, wrong place").
- Seasonal Target: the "Hint" tag sits in the quarter's corner tile and is dimmed with it when a halving leaves that tile outside the area; on a desktop the grid is centred in the stage, leaving strips beside it at 1280 and 1920; in dark mode the own-row tint of an olive (Team Spring) dot reads greyish.
- Seasonal Target on a phone in a halving round: the panel above the list is capped and scrolls, so the hint's text is cut at the fold (the quarter stays tinted with its "Hint" tag on the grid); while the halving's banner stands, the list shows about one and a half rows.
- Safecracker's and Bomb Defusal's input row is a centred box of up to 46 rem whose controls sit at its left, so they do not line up under the list's start.

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
