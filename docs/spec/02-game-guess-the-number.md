# 02 — Game Design: Guess The Number (fast mode)

> Part of the Seasonal Mini Games specification. Index: [README](README.md).
> Every number in this document that the owner did not give is a setting with a default, a minimum and a maximum ([08](08-admin-settings.md)). The value shown here is the default.

## 1. The game in one paragraph

The server picks a secret whole number in a range (default 1–1 000). Players type guesses. After each guess the server answers whether the secret is higher or lower (§6). A player may guess whenever they want, and after each accepted guess a waiting time, the **cooldown**, applies to that player (owner, decision 3). With a **shared secret** everyone searches the same number, and the first correct guess the server receives wins. With an **individual secret** every player has their own number, and placings follow the order in which players solve them (owner, decisions 4 and 5).

**Fast mode** is the timing class of this game: per-player cooldown, no global tick. The platform enforces cooldowns for every game that declares this timing class ([04](04-software-architecture.md) §4.3). Long-running games keep their own timing (owner, decision 3) and are not part of v1.

## 2. Matches and rounds

- A host (permission `match.create`) opens a **match** for one game, chosen when creating it (owner, decision 41): here `guess-the-number`; the other games ([02b](02b-game-safecracker.md)–[02d](02d-game-seasonal-target.md)) run their matches by this section too. Every round of a match is of the match's game; the lobby, the Play list and the match summary name it. The match lifecycle is Bingo's (Bingo 01 §7.6 start rules, Bingo 01 §13 cancelled-match page), with one difference: a match is not a fixed tournament. It is a lobby in which the host runs **rounds**, one after another, until the host ends it or it closes itself.
- **End of a match** (owner, decisions 27 and 28): the host ends the match from the host menu ("End match", confirmed with "End this match for everyone? A running round is aborted."); a round only set up or running is aborted, the ended rounds keep their results and points. A match with no round for `match.lobbyIdleCloseMin` minutes (default 60, [08](08-admin-settings.md) §4) closes itself the same way, counted from the later of its creation and its last round's creation or end; a round counting down or open is never closed, and a server that starts closes overdue matches at once (DECISIONS T83, T84). Afterwards every player and spectator sees the **match summary** at the match's address: how it ended ("The host ended the match.", "The match closed after 60 minutes without a round."), the rounds played, each player's total points and wins in standings order, the team standing over the match (a team match only, owner decision 34), and a link back to Play (DECISIONS T85). The summary fits one screen without a page scrollbar at 1280 × 720 and 390 × 844 for up to 12 players: on a desktop the standings on the left and the rounds played, the teams and the link on the right, in compact rows; on a phone one column; with more players than fit, only the standings table scrolls, inside its own box (DECISIONS T116).
- Players join the match from the lobby. Joining the match does not put a player into a round that is already running. They watch it and play from the next round.
- **Waiting area** (owner, decision 23): before a round, and between rounds under or beside the last result, the match page shows whether the next round is set up and who starts it, every player with their team (icon and name, or "no team yet"; in a match without teams no team at all, owner decision 34) and, apart from it, their connection (a dot and "online" or "away"; filled or hollow, so not by colour alone). A player chooses their season team once and keeps it for the whole match (owner, decision 26): until their first round the area says what the teams are for (in shared rounds the winner's team gets a point; the team is kept for the whole match; without a choice the player joins the smallest team when their first round starts) and shows the four team buttons with the viewer's team clearly marked (pressed, in its season colour, its icon in the button's text colour, with a check). From the player's first round on there are no team buttons, a change is refused with `TEAM_LOCKED`, and beside a result the area holds only the next-round status line and the player list (DECISIONS T82, T85). A round the host has set up but not started waits here too; the round view takes over from its countdown. On a wide screen the waiting area sits beside the result, on a phone under it (DECISIONS T79). The match chat is not part of it: a panel of its own with its own heading under the waiting area (beside a result: "Next round" first, then "Chat"), and on a phone behind its "Chat" button as in the round view; the same before the first round (DECISIONS T116).
- **Quick Test** (development builds, owner decision 24): with "Start from the lobby" (on by default) it creates the match and its round with the form's settings and opens this waiting area with the owner as host and player; the bots join one after another over about 2 s, each with a random season team; the owner picks a team and starts the round from the host menu, and countdown and round run as in any match. With it off, the round starts at once. The seed decides the secret and the season either way, and the bots play every round of the match (DECISIONS T80).
- Before each round the host sets the round's settings (§3). They are frozen when the round is created and never change while it runs. The only exceptions are changes made by a special, which apply to everyone at once ([03](03-seasonal-specials.md)).
- Players needed to start a round: 2 (`match.minPlayersPerRound`). Players per match: at most 500 (`match.maxPlayers`).

## 3. Round settings (chosen by the host per round)

| Setting | Values | Default | Source |
|---|---|---|---|
| Secret mode | `shared` or `individual` | `shared` | Owner, decision 5: chosen per round |
| Cooldown | 3 s – 60 s, whole seconds, the same for every player | 10 s | Owner, decision 3: range 3–60 s |
| Range | lowest and highest number, both inclusive, each from −1 000 000 to 1 000 000, at least 10 numbers; negative numbers are allowed | 1–1 000 | Owner, decision 18 |
| Show range | shown or hidden: a hidden range reaches no client until the end (§5.1, §12) | shown | Owner, decision 19 |
| Season | `inSeason` (follow the website) or one of the four seasons | `inSeason` when the feed is available, otherwise the host must pick | Owner, decision 6 ([03](03-seasonal-specials.md) §3) |
| Season special | on or off | on | [03](03-seasonal-specials.md) §2 |
| Halving round | on or off; offered only on a halving day | off | [03](03-seasonal-specials.md) §4 |
| Season teams | on or off; shared mode only | on | [03](03-seasonal-specials.md) §5 |
| Feedback visibility | `own`, `numbers` or `full`; shared mode only | `full` (§6.2) | Owner, decision 8: default `full`, host may change it per round |
| Closeness comments | on or off (§6.3) | on | Owner, decision 21 |
| Countdown before opening | 3 s – 30 s | 10 s (*proposal*, so the intro screen can be read, [OPEN](../OPEN.md) (ab)) | Setting |
| Longest round | 1 min – 60 min | 10 min | Setting |

The host's form offers only values inside the bounds an admin set ([08](08-admin-settings.md)). The server checks them again.

## 4. Round lifecycle

```
 created ──► countdown ──► open ──► ended
    │            │           │
    └────────────┴───────────┴──► aborted   (host or system ends it without a result)
```

| State | Entered when | What happens |
|---|---|---|
| `created` | The host submits the round form. | Settings are frozen. The server generates the round seed and derives the secret or secrets from it ([04](04-software-architecture.md) §5.4). If the fairness proof is on, it publishes the commitment (§10). |
| `countdown` | The host presses **Start round**, or immediately after creation if the host chose "start now". | The **roster** is frozen: every match player who has an open connection to the match at that moment, the host included (owner, decision 16: the host plays along; a player who drops later stays on the roster), each with their match team (one without is placed now, decision 26). The host joins their own match as a player when opening it. The server announces `opensAt` as an absolute server time = now + countdown. Spring Herald's free hint is delivered at `opensAt` ([03](03-seasonal-specials.md) §2.1). |
| `open` | The server clock reaches `opensAt`. | Guesses are accepted (§5). Special timers start counting from `opensAt`. |
| `ended` | An end condition is met (§8). | No more guesses are accepted. The secret is revealed, placings are fixed and standings are updated (§9). |
| `aborted` | The host aborts, or the system does (for example a shutdown that could not resume the round). | No placings, no points. The round shows its own end page with the reason and who ended it (Bingo D17 wording). |

A round is recovered from its event log after a server restart, as Bingo matches are (Bingo 02 §5.2). Time that passed while the server was down counts as round time. Cooldowns that ran out in the meantime are over.

## 5. Guessing

### 5.1 Who may guess

A guess is accepted only if all of these hold, checked in this order. The first one that fails decides the rejection code ([06](06-data-model-api-realtime.md) §4.3):

1. The round is `open` (`ROUND_NOT_OPEN` before `opensAt`, `ROUND_OVER` after the end).
2. The guesser is on the round's roster (`NOT_IN_ROUND`).
3. In individual mode, the guesser has not solved their number yet (`ALREADY_SOLVED`).
4. The value is a whole number inside the round's **current** range ([03](03-seasonal-specials.md) §4 can shrink it) (`OUT_OF_RANGE`). With the range hidden (owner, decision 19) this check does not apply: any whole number from −1 000 000 000 to 1 000 000 000 is accepted and answered `higher` or `lower`, and starts the cooldown, because `OUT_OF_RANGE` would tell where the range is (DECISIONS T53). The input takes whole numbers in that span in both cases.
5. The value has not been removed by Leaf Fall (`NUMBER_REMOVED`).
6. The guesser has not guessed this value before in this round (`ALREADY_GUESSED`) (a repeat costs nothing and tells nothing).
7. The guesser's cooldown has ended (`COOLDOWN_ACTIVE`, with the time it ends).

A rejected guess does not start a cooldown, is not counted, and is not shown to anyone but the guesser. A guess that fails a check is never held back and retried later. The client sends it again if the player wants.

### 5.2 Receive order

The server puts every guess of a round into **one queue for that round**, in the order it takes the messages in. It processes them one at a time in that order ([04](04-software-architecture.md) §5.2). Each accepted guess gets the next **receive number** (`receiveSeq`, 1, 2, 3 …) and its **receive time** from the server clock. The client's clock and any time the client sends are ignored.

## 6. Feedback

### 6.1 The feedback rule

For an accepted guess `g` and the guesser's secret `s`:

| Case | Feedback |
|---|---|
| `g < s` | `higher` — "The number is higher than 412." |
| `g > s` | `lower` — "The number is lower than 412." |
| `g = s` | `correct` |

Feedback goes to the guesser. Without Frost it is sent as soon as the guess is processed. With Frost it is sent after the Frost delay ([03](03-seasonal-specials.md) §2.4). No narrowed range is shown, neither the player's own nor a shared one (owner, decision 17): the server computes none and no view, frame or contract carries one. Each player sees their own past guesses with their answers in the round's one list, highlighted as their own (owner, decision 20; §12).

### 6.2 What other players learn in shared mode

Setting `feedbackVisibility`, chosen by the host per round. The default is `full` (owner, decision 8):

| Value | Every other player sees for each accepted guess |
|---|---|
| `own` | That a player guessed, and that it was not correct. Not the number. |
| `numbers` | The player and the number guessed. Not the feedback. |
| `full` (default) | The player, the number, the feedback and its closeness comment (§6.3). The search becomes a fully shared one: everyone reads every answer in the round's list (no narrowed range is computed, decision 17). |

In individual mode other players always see only that a player guessed, plus their solve and placing. Their numbers and feedback mean nothing for anyone else.

All of it is shown in one list: every guess the viewer may see and the round's events, with the viewer's own guesses highlighted (owner, decision 20, §12).

### 6.3 Closeness comments (owner, decision 21)

Every accepted guess gets a short English comment on how close it came, when the host has the comments on for the round (`round.comments`, default on).

- **Tier.** The server computes a tier for each accepted guess from the distance relative to the round's range, `d = |guess − secret| / (high − low)`, so a tier means the same in a 1–100 and in a −1 000 000–1 000 000 round (DECISIONS T70). The tiers: **way off** (`d` > 50 %), **cold** (25–50 %), **cool** (10–25 %), **warm** (3–10 %), **hot** (1–3 %), **burning** (under 1 %, more than 2 away), **just missed** (1 or 2 away), and a correct guess. The thresholds are admin settings, proposals ([08](08-admin-settings.md) §3). With a hidden range the same formula uses the hidden bounds; a guess outside them gets **way off**, and no comment states the bounds or the range's size. The client never computes a tier and never receives the secret.
- **Who sees it.** The tier and its comment travel with the feedback: to the guesser with their answer, held by Frost exactly as long ([03](03-seasonal-specials.md) §2.4), and to others exactly where §6.2 shows them the answer. A viewer sees a comment exactly when they see that guess's higher or lower (DECISIONS T73).
- **Lines.** A catalogue in the game module holds at least 25 lines per tier, 15 for a correct guess and 10 per trend direction, plus a few that only a round of their season uses. They are friendly and playful, teasing at the far end ("Well, that wasn't it."), never insulting, never about a name, without profanity and without digits, and they keep to the seasonal theme (weather, nature, the seasons; no sea, ships, islands, captains or space). Lines within a tier are drawn at random, so two guesses of one tier may get lines that sound a little nearer or farther than each other; only the tier says how close a guess is.
- **Trend.** When the player's previous guess in the round is in another tier, the comment may react to the change instead ("Getting warmer!", "That went the wrong way."), in `comments.trendPercent` % of such guesses. The trend compares the two tiers, so it says nothing beyond them (DECISIONS T71).
- **Choice.** The line is chosen with the round's randomness (seeded rounds and the Quick Test replay the same lines), and no line of a pool comes back in a round until every line of that pool was used (DECISIONS T72).
- **What it tells.** Tiers tell more than higher or lower, and with a hidden range many tiers together hint at its size; the owner chose this on 2026-10-31 ([05](05-security-threat-model.md) §10).

## 7. Cooldown (owner, decision 3)

- After a guess is accepted, the guesser's cooldown runs from its receive time: `cooldownEndsAt = receivedAt + cooldown`. A guess received at or after `cooldownEndsAt` passes check 7.
- The cooldown value is the same for every player of the round. Only Heatwave changes it, for everyone at the same moment ([03](03-seasonal-specials.md) §2.2). The value that applies to a guess is the one in force at that guess's receive time.
- There is no global tick. Players are never made to wait for each other or for a shared clock, only for their own cooldown.
- The server sends `cooldownEndsAt` (absolute server time) with every accepted guess. The client shows a countdown ring from it, corrected by the clock offset it measured at connect ([06](06-data-model-api-realtime.md) §4.1). The ring is only a display. The server enforces the cooldown (§5.1 check 7, [05](05-security-threat-model.md) §2).
- A player's first guess in a round has no cooldown before it.

## 8. Winning and round end

### 8.1 Shared secret (owner, decision 4)

- The winner is the player whose correct guess has the lowest receive number. Ties cannot happen: receive numbers are unique per round.
- The round ends at that guess. Guesses behind it in the queue are answered `ROUND_OVER`, as are guesses received later.
- **Placings:** the winner is 1st. Everyone else on the roster is listed below as "took part", with their number of guesses and without a place. A round without a correct guess has no winner.

### 8.2 Individual secret (owner, decision 5)

- A player who guesses their own number has **solved** it. Their placing is the order of their correct guess in the round's receive order: the first solver is 1st, the next 2nd, and so on. Ties cannot happen.
- A solved player cannot guess again in the round. For the rest of the round they keep the player view with their own guesses, answers and comments; the input row is replaced by a short notice with their place ("You found your number — place 2."). Other players' guesses still follow the visibility setting (§6.2), so a solved player learns nothing new about anyone else's number (owner, decision 25).
- The round ends when every roster player has solved, when the longest round time is reached, or when the host ends it.
- **Players who did not solve:** listed after the placed players as "not solved", without a place.

### 8.3 Other end conditions (both modes)

| Condition | Result |
|---|---|
| Longest round time reached (`opensAt` + `roundMaxDuration`) | `ended`, reason "time is up". Placings as above; shared mode then has no winner. |
| Host presses **End round** | `ended`, reason "ended by the host". Placings as far as reached. |
| Host presses **Abort round** (with a reason) | `aborted`: no placings, no points (§4). |
| Every roster player left the match | `ended`, reason "no players left". |

## 9. After the round

- **Reveal:** shared mode shows the secret to everyone. Individual mode shows every player their own number and lists every player's number in the result. The result names the round's range, which reveals a hidden one (DECISIONS T52). If the fairness proof is on (§10), the round seed is published as well.
- **Result screen:** the end reason in plain words ("Walter found 731 first — after 9 guesses"), placings (§8), in shared mode the **winning margin** (owner, decision 13: how much earlier the winning guess arrived than the next correct one, "found it 0.4 s before Anna"; the round closes at the winning guess, so the server keeps noting correct guesses that it answers `ROUND_OVER` for `round.marginWindowS` (owner, decision 33: default 2 s, 0.5–10 s) after it; the first one sets the margin). Without a second correct guess in that window the result shows the **closest miss** instead (owner, decision 22): the wrong guess of another player than the winner with the smallest distance to the secret, a tie going to the earlier receive order, naming that the winner is not counted, as "Closest miss besides the winner: bot-01, missed by just 1 (92)." when it is 1 or 2 away, else "Closest miss besides the winner: bot-01, 7 away (85)."; without another player's wrong guess there is no line. The server computes it at the round's end and carries it only in the result view (DECISIONS T77), the viewer's own line highlighted, team standing when teams are on ([03](03-seasonal-specials.md) §5), the match standings, and the fairness proof. The result page has no player list of its own: the waiting area for the next round (§2) follows it, with the teams and the players. The host sees **Next round** with the last settings prefilled. The headline is about half the page title's size, on one line where it fits. On a desktop the result page fits one screen without scrolling (1280 × 720): the headline with the margin or closest miss and the fairness proof's disclosure across the top, the game's result (a board game's grid as tall as the space allows, the same grid component as in the round) on the left, the placings, team result and match standings on the right, the waiting area with the chat beside them. A phone scrolls the page: the result, its grid or list first, then the next round's box.
- **Points:** placings give match points from a table (`points.placement`, [08](08-admin-settings.md)): shared winner 10; individual 10, 7, 5, 3 for places 1–4 and 1 for every further solver. Match standings are the sum over the match's rounds. Ties are ordered by number of wins, then by the earliest win's receive time.
- **Leaderboard:** adopted from Bingo 01 §10 (a season board per meteorological season — spring March–May, summer June–August, autumn September–November, winter December–February, in UTC, owner decision 30; a winter is named after both years, "Winter 2026/27" — and the all-time board), with league points from match standings: a match that counts awards each account its match standing (points, round wins, solves) once per board, from its first ended round on, and the team board beside it sums the teams' round wins ([06](06-data-model-api-realtime.md) §2.6). The flag `countsForLeaderboard` is set per match (Bingo 01 §3a.3), default on. A board ranks by points, then round wins, then solves; equal rows share a rank. The player's profile shows their numbers, their place on each board, their last rounds and any staff adjustment with its reason. A round's **verification page** shows the commitment, the seed, the recomputed secret(s), the roster and the accepted guesses, and checks the seed against the commitment in the browser (§10).

## 10. Fairness proof (owner, decision 9)

When `fairness.commitReveal` is on (default on), the server publishes `sha256(roundSeed)` at round creation and the seed itself at round end. Anyone can recompute the secret or secrets, Spring Herald's hint, Leaf Fall's removals and the halving windows from the seed and the published settings ([04](04-software-architecture.md) §5.4). This is the same commit-reveal scheme as Bingo 01 §9, applied per round instead of per match.

## 11. What a spectator sees

A spectator is a guest, a match player not on the roster, or an admin who is not playing. A solved player in individual mode stays a player (§8.2, owner decision 25). The host is on the roster like every player (owner, decision 16).

| Visible | Never visible before the round ends |
|---|---|
| Season, its special and token visuals ([03](03-seasonal-specials.md) §6); halving badge | The secret or any secret |
| Current range; removed numbers; current cooldown value; time left | Any player's feedback, except under `full` visibility in shared mode |
| Roster: per player the number of guesses, "cooling down" or "ready", solved and placing (individual) | Guessed numbers, except under `numbers` or `full` |
| The round's one list: accepted guesses at the visibility of §6.2, with their closeness comments where the answer is shown (§6.3); specials as they happen ("Leaf Fall: 12 numbers fell") | Spring Herald's hint in individual mode (each player's hint is about their own number) |
| Team standing when teams are on | Anything a player sees only about their own number |

When a round runs, the host sees exactly the view every player sees and plays along: guesses, cooldown, placings and points like any player (owner, decision 16). The host controls (Start round, End round, Abort round, the next round's settings) sit in a small host menu behind one button in the top bar. The host never sees a secret of a running round, as Bingo's admins never see a running match's seed (Bingo 01 §9).

## 12. Player screen (fast mode)

The whole round view fits the screen without a page scrollbar (desktop 1280 × 720 and up, phone 390 × 844); only the guess list scrolls, inside its own box. Everyone gets the same view, the host included (decision 16). During a round the view shows only what matters for the next guess in this round: the other players' guesses, the viewer's own, and what is already found or ruled out (fallen numbers, digits or tiles, harmless wires, the hint, the halving area); match standings, team points and earlier rounds are not part of it and stay in the Players panel, the result page and the match summary (owner decision 54). One layout serves every game, chosen by the viewport: a landscape screen of 900 px or more is the desktop, anything else the phone (DECISIONS T141). Every game's round runs in **focus mode** (owner decision 46, DECISIONS T128–T132): from the countdown until the round ends the app header is hidden and the round has one slim bar of its own; chat, players and the host's controls are panels on demand; a full-screen button where the browser offers it:

- **Intro screen** (owner, decision 36): while the round counts down, the round view is one intro card in the season's colours: the season's token icon and name in large type (the halving badge on a halving round), the special's name and one plain sentence on what it does ([03](03-seasonal-specials.md) §2: "Everyone gets one free hint when the round opens.", "The waiting time between guesses gets shorter as the round goes on.", "Every so often, some wrong numbers fall out of the game.", "Answers arrive a few seconds late."; with the special off "No special this round."), the secret mode and range from the game ("Shared number between 1 and 100", "Everyone has their own number between 1 and 100", or "Hidden range"), the cooldown, and "Opens in 7 s", under the round bar. It fits 1280 × 720 and 390 × 844 without a page scrollbar, in light and dark.
- **Round bar, one row** (owner decisions 46 and 47; small text of about 14 px, at most 44 px high on a desktop with flat 36 px controls, 52 px on a phone with 44 px touch targets): the season pill in the season's colour with its icon, the season's and the special's name (and the halving badge); on a phone, with the special on, the pill is a button with a small "i" whose note says the mode and what the special does (owner decision 35), while a desktop's pill is plain and its info column has the special's line (DECISIONS T141); shared or individual (desktop); "9:50 left" once the round is open. The waiting time is not in the bar: the cooldown ring and the disabled button at the input are its only display (owner decision 47). Then **Chat** with an unread count (only when the match has a chat, [07](07-integration.md) §2), **Players** (the teams with their match points and every player of the round), **Host** (the host only) and **Full screen** where the browser offers the Fullscreen API (never on its own, never in the embedded frame). The buttons show icon and words on a desktop and the icon on a phone, where the words are read out.
- **Panels on demand:** Chat, Players, Host, the whole list ("All (N)") and on a phone the game's panel behind the info line open one at a time, without a backdrop: on a desktop as a column of 360 px on the right that pushes the game aside, so nothing of the game is covered (owner decision 48); on a phone as a sheet from under the bar down to the action dock, whose bottom edge ends above the dock, so the player can still guess. Each has a visible Close button and closes with Escape; the focus moves into the panel (its ring drawn only for the keyboard) and back to its button on closing. Teams are named "Team Spring" wherever they appear (owner decision 52). The chat stays mounted while closed, so it keeps its room and what was typed. The unread count counts the builtin chat's messages of others that arrive while the chat is closed (a host's embedded chat tells nothing, so it has no count).
- **The special in view** (owner decision 35; DECISIONS T110): when a special fires, a one-line banner in the season colour takes the place of the list head's title for 5 s, never pushing the list down and cut with an ellipsis rather than wrapping (DECISIONS T142), and says what happened ("Leaf Fall: 10 numbers fell.", "Heatwave: waiting time is now 4 s and keeps getting shorter.", "Range halved: the number is between 25 and 75.", "Spring Herald: everyone got a free hint.", and under Frost "Frost: answers arrive 3 s late." for the round's first 5 s; a held own answer is said by its row only, not again by the banner); the event's row is always in the All list, never in the list of guesses (DECISIONS T142). Spring Herald's hint stays in the range block for the whole round as a highlighted line ("Free hint: the number is even."). With the range shown, Leaf Fall's fallen numbers are dark gaps in the bar, at least 4 px wide even for one number; fallen numbers closer together than about 5 px of a phone's bar (1.5 % of the range) merge into one gap, solid where every number in it fell and hatched where some did not, so many falls still read as a bar with holes, never a solid black block; with it hidden, the banner and the list row are the display. Under Frost the player's held guess row says "answer arriving…" with the seconds left.
- **Range block:** "The number is somewhere between L and H" in large type, never broken between the two numbers ("1 and 1,000" stays on one line), and a full-width bar from L to H on which fallen numbers show as gaps; nothing narrowed from the answers (decision 17). With the range hidden: "Any whole number", with a note that negative numbers are possible. Spring Herald's hint under it, shown there once and not again as a list line (DECISIONS T135). In a Leaf Fall round a **Fallen numbers** panel names every fallen number, ascending, as compact chips with their count in its heading, updated live, behind a "Fallen (N)" button beside the range that opens it as a sheet over the round (DECISIONS T115; on a desktop too since focus mode, so the narrow right column keeps its rows, T132). Leaf Fall's row in the list stands out on the season's tint with the season icon, in bold. The round's **lists** (owner, decision 20; DECISIONS T142), newest at the top: the round's guesses, every guess the viewer may see (§6.2), under a one-line head with their count, in individual mode without the other players' rows and with their counts in the head instead ("bot-01: 8 guesses · bot-02: 5"); "Your guesses", the viewer's own; and **All (N)**, the guesses with the round's events, as a panel on demand. A guess row is one line: the player's colour dot, the name ("You" for the viewer), the number, higher or lower in colour, and on a desktop the closeness comment in smaller text on the same line, cut with an ellipsis and whole in its tooltip (§6.3); on a phone the newest row shows its comment as a second line and a tap on a row shows or hides its own. The viewer's own rows have a tint of the season colour behind them, with the text at 4.5:1 or more in light and dark. Under Frost an own row says "answer arriving in 2 s". Events (Spring Herald, Leaf Fall, Heatwave's announcement, once per round, halving, solves, the round opening and ending) are quieter one-line rows. The input row: the cooldown ring, the number field (it takes a minus sign; a ± button where negative numbers are possible, DECISIONS T57) and a large **Guess** button, disabled while the cooldown runs and while a guess is on its way; during the cooldown it reads "Wait 6 s" in readable text (DECISIONS T125); Enter sends. What the player types is never lost: it survives the round opening, and the field is emptied only when the guess sent from it is answered (DECISIONS T76).
- **Desktop** (DECISIONS T141): under the bar, the **stage** on the left with the round's guesses in wide rows, filling it (owner decision 50; at least 22 rows in view at 1280 × 720, larger text at 1920 × 1080), and the action dock at its bottom, from the list's left edge; the **info column** of 340 px on the right: the special's line, the game's own panel (the range block with the free hint, the Fallen numbers button; a spectator's panel for someone who watches), then "Your guesses" filling the rest (shared mode; in individual mode the stage holds the same rows). The team tiles and the chat are panels from the bar (owner decision 46).
- **Phone** (DECISIONS T141): the bar (the pill naming the season, the special named by its note, DECISIONS T114), the **info line** (one line of at most 48 px: "1–1,000" with a "Fallen 10" chip in a Leaf Fall round, and the free hint; a tap opens the range block and the Fallen numbers as a sheet), the list of **guesses**, filling the free height down to the action dock (at least 10 rows; owner decision 49) with **All (N)** for the whole list with the events, and the action dock at the bottom for the thumb. Season and system messages show in the banner and in the All list.
- Lobby, setup and result pages may scroll (the match summary does not, §2); the result's placings table (and the match summary's) fits a 390 px phone with all four columns and no sideways scrolling, names ending in an ellipsis without breaking inside a word (DECISIONS T85).
- **Numbers** of 1,000 and more are written with thousands separators, en-US style ("1,000,000"), everywhere a number is shown: range, guesses, the list, fallen numbers, intro, result, summary and the chat's round-end line. One formatter does it (`formatNumber` of `@smg/game-sdk`, DECISIONS T114); input fields take what the player types, unformatted.
- Every line is plain English, as in Bingo 01 §13 ("Your cooldown is now 7 s — Heatwave"). Server codes reach the screen as sentences. All animations respect `prefers-reduced-motion`. Sounds are off by default. Accessibility target WCAG 2.2 AA, with full keyboard play (type, Enter).

## 13. Out of scope for v1

- Long-running games and their own timing (owner, decision 3: they keep their own timing when they come).
- The other vision games (owner, decision 2).
- Anything with monetary value.
- Player-created matches with custom bounds; native apps; languages other than English.
