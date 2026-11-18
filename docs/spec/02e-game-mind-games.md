# 02e — Game Design: Seasonal Mind Games

> Part of the Seasonal Mini Games specification. Index: [README](README.md).
> Seasonal Mind Games (id `mind-games`) is the first game that is not a guess game (owner, decisions 76–90). It has no secret, does not use the guess engine ([04](04-software-architecture.md) §4.7) and runs in its own timing class of the game-module contract, `phased` ([04](04-software-architecture.md) §4.8). Hosting, sign-in, roles, standalone and embedded modes and the chat are those of the other Mini Games (owner, decision 88; [02](02-game-guess-the-number.md) §2, [07](07-integration.md)). Every number the owner did not give is a setting with a default, a minimum and a maximum ([08](08-admin-settings.md) §3.4); the value shown is the default. Rules the owner did not give are marked *(proposal)* and listed in [OPEN](../OPEN.md).

## 1. The game in one paragraph

Every player picks one of the four seasons, Spring, Summer, Autumn or Winter, each with its token's icon and original colour ([03](03-seasonal-specials.md) §6), or, when the host offers it, a fifth choice **All** (owner, decision 77). Whoever picked the **least chosen** option wins the round (owner, decision 83). Players may switch as often as they like until play ends, and everyone watches the others, but only **one delay late**: the feed always shows the round as it was 30 s earlier (owner, decisions 78–80). So every move is read by the others half a minute later, and the last half minute of play is only seen once choices are closed. A match is a series of rounds whose points add up (owner, decision 85).

## 2. Matches and rounds

- A match is always one game, chosen when creating it (owner, decision 41): a `mind-games` match runs only Mind Games rounds. Creating, joining, the waiting area, the host playing along, End match, the idle close and the match summary are [02](02-game-guess-the-number.md) §2, with the differences below. The match has no teams (§12).
- **A series of rounds** (owner, decision 85): a match is `mind.rounds` rounds (default 6). The host chooses the number in the first round's form; it holds for the whole match (*proposal*).
  - After each round the result stays on screen for the **pause** (`mind.pauseS`, default 15 s, owner decision 86), with the waiting area beside it ([02](02-game-guess-the-number.md) §2); then the next round starts by itself, with its countdown (the intro screen, [02](02-game-guess-the-number.md) §12) and the settings of the host's next-round form.
  - The host can always shorten the pause with one click, **Start next round now**, in the result's next-round box and in the host menu (owner, decision 86).
  - After the last round's pause the match ends by itself with the match summary ("All 6 rounds are played.") (*proposal*); the host can end it earlier with End match, as in every game.
- **Settings per round:** the host's next-round form is open during the pause, prefilled with the last round's values; what the host saves before the next round starts applies to it (*proposal*). Settings are frozen when a round is created and never change while it runs ([02](02-game-guess-the-number.md) §2). The number of rounds and the pause are the match's and are shown read-only from the second round on (*proposal*).
- **Who plays a round:** every match player may play it, but only by making a first choice within the round's join time (owner, decision 79). There is no roster frozen at the countdown: a player is **in** the round once a first choice of theirs is accepted, by their own click or by a pre-pick at the round's start (§7). Every player chooses anew in each round; a player without a choice in a round does not score in it (owner, decision 85).
- **New players** join the match at any time, as in every game, and play every round whose join time is still running (owner, decision 85): one who joins during a round's join time can play that round at once; later, they watch it and play from the next one.
- **Starting:** the host starts the first round as in every game, and `match.minPlayersPerRound` ([08](08-admin-settings.md) §4) applies to it. The later rounds of the series start without that check, because pre-picks play for absent players; a round that nobody enters ends with "Nobody chose this round." (*proposal*).
- **Intro line** (`intro`, [04](04-software-architecture.md) §4.6): "Pick a season. The least chosen wins." (with another place: "The 2nd least chosen wins."), with All on "All counts as a fifth choice and scores 2.", and the timing in one line: "Join within 1:00 · choices close at 1:30 · everyone sees the round 30 s late" (*proposal*).

## 3. Round settings

The game's own settings, chosen by the host per round inside the admin's bounds ([08](08-admin-settings.md) §3.4, document `game.mind-games`). Of the platform's round settings ([02](02-game-guess-the-number.md) §3) only the season and the countdown before opening apply (§12):

| Setting | Values | Default | Source |
|---|---|---|---|
| Total length (`mind.totalS`) | 30 – 600 s, whole seconds | 120 s | Owner, decision 78 (default); bounds *(proposal)* |
| Delay follows the total (`mind.delayAuto`) | on: the delay is a quarter of the total, rounded down to whole seconds (120 s → 30 s, 40 s → 10 s); off: `mind.delayS` applies | on | Owner, decision 96, built like the join time's box |
| Delay (`mind.delayS`) | 5 – 120 s; at most (total − 10 s) / 2, so the feed shows at least 10 s of the round while choices are still open; used only while `mind.delayAuto` is off | 30 s | Owner, decision 78 (default); bounds and the rule *(proposal)* |
| Join time follows the total (`mind.joinAuto`) | on: the join time is half the total, rounded down to whole seconds; off: `mind.joinS` applies | on | Owner, decision 78: half the total, following a change of the total unless the host sets it |
| Join time (`mind.joinS`) | 10 – 590 s, at most total − delay; used only while `mind.joinAuto` is off | 60 s | Owner, decision 78; bounds *(proposal)* |
| All (`mind.allOption`) | off or on: a fifth choice that counts like a season in every rule | off | Owner, decision 77 |
| Switches (`mind.switchVisibility`) | `hidden`, `visible`, `perPlayer` (§6.3) | `perPlayer` | Owner, decision 82 |
| Winner (`mind.winnerPlace`) | 1 (least chosen) – 4; 5 only with All on | 1 | Owner, decision 83 |
| Rounds (`mind.rounds`) | 1 – 20; chosen in the first round's form, held for the match | 6 | Owner, decision 85 (default); bounds *(proposal)* |
| Pause (`mind.pauseS`) | 5 – 120 s; held for the match; the host can always shorten it | 15 s | Owner, decision 86 (default); bounds *(proposal)* |

- **The form:** in the host form and the Quick Test form the delay and the join time show the value in force: while "Delay follows the total" is on, the delay field shows a quarter of the total, and while "Join time follows the total" is on, the join time field shows half of it, each off, with a help line saying it follows the total; typing a value means turning its box off first (owner, decision 96, for the delay; *proposal* for the join time).
- **The delay in force:** the rules below use the delay in force; a quarter of the total always meets the first one. While it follows the total the delay is not held to `mind.delayS`'s bounds: a total of 600 s gives 150 s (DECISIONS T349).
- **Refusals:** a refused value or pair is named under its field as for every setting (owner, decision 74): "The delay must be at most half the total minus 10 s.", "The join time must end by the time choices close (total − delay).", "The 5th least chosen needs the All option." (*proposal*).
- Every input of the form, like every input of the game, also has a tooltip (owner, decision 89).

## 4. The round timeline (owner, decision 78)

All times count from the round's opening (`opensAt`, [02](02-game-guess-the-number.md) §4). With total `T`, delay `D` and join time `J`:

| From – to | Phase | Players may | Everyone sees (§6) |
|---|---|---|---|
| 0 – `J` | **Join** (part of play) | join with a first choice; switch | from `D` on, the round as it was `D` earlier |
| `J` – (`T` − `D`) | **Play** | switch, if in the round; nobody joins | the round `D` earlier |
| (`T` − `D`) – `T` | **Reveal** (O97) | nothing: every choice is frozen | the reveal of the final playable `D` seconds |
| `T` | **End** | — | the result (§9), 1 s after `T` (below) |

With the defaults (120, 30, 60): join until 1:00, switches until 1:30, the feed starts at 0:30, and 1:30–2:00 reveals 1:00–1:30 of play. The phases are the round's plan, scheduled and enforced by the platform ([04](04-software-architecture.md) §4.8); the client only shows them. Every move the server accepted shows in the feed and the counts before the result (owner, 2026-11-17, DECISIONS T380): the last second of play is released at each move's own time, not on the once-a-second tick, and the round's time-up, and with it the result, comes 1 s after `T`, so each page has loaded the last step before the result replaces it. The platform's round lifecycle (created, countdown, open, ended, aborted) is unchanged: the three phases all lie in `open`.

## 5. Choosing

### 5.1 The action

A choice is one action, `{ choice, hide }`: `choice` one of `spring`, `summer`, `autumn`, `winter`, `all`; `hide` the state of the player's "Hide my switches" box at that moment (§6.3), ignored unless the round's switches are `perPlayer`. A click on a choice button sends it at once; there is no separate Send (*proposal*). Choosing does not cost or wait: there is no cooldown in this game (§12).

### 5.2 Who may choose

A choice is accepted only if all of these hold, checked in this order on the server at the action's receive time; the first that fails decides the code *(proposal)*:

| # | Check | Code | Words on screen |
|---|---|---|---|
| 1 | The round is open | `ROUND_NOT_OPEN` / `ROUND_OVER` | as [02](02-game-guess-the-number.md) §5.1 |
| 2 | The chooser is a player of the match | `NOT_IN_ROUND` | "Join the match to play." |
| 3 | Play has not ended (before `T` − `D`) | `PLAY_OVER` | "Choices are closed for this round." |
| 4 | The chooser is in the round, or the join time is still running (before `J`) | `JOIN_CLOSED` | "Joining this round has closed. You can play the next round." |
| 5 | The choice is one of the five names | `CHOICE_INVALID` | "Pick one of the seasons." |
| 6 | `all` only with All on | `CHOICE_UNAVAILABLE` | "All is not offered in this round." |
| 7 | Not the player's current choice | `SAME_CHOICE` | "That is already your choice." |

Checks 1–4 are the platform's for every `phased` game ([04](04-software-architecture.md) §4.8), 5–7 the game's `validate`. Before them the gateway refuses more than 4 choices a second per account (`RATE_LIMITED`, [05](05-security-threat-model.md) §5), worded "Slow down a little — too many choices at once." (the platform's sentence with this game's word, *proposal*, DECISIONS T383). A refused choice costs nothing, changes nothing and is seen only by the chooser ([02](02-game-guess-the-number.md) §5.1). The buttons are disabled where the client already knows the answer (after play ends, after the join time for someone not in the round, the current choice), but the server decides every case again ([05](05-security-threat-model.md) §3.2, DECISIONS S11).

### 5.3 First choice and switches

The first accepted choice puts the player in the round (owner, decision 79). Every later accepted choice is a **switch** from the current choice to another; a player may switch any number of times until play ends. The player's **final choice** is the one in force when play ends (or when the host ends the round, §9).

## 6. What everyone sees: the delayed feed (owner, decisions 80–82)

### 6.1 One delay late

From `D` after the opening, everyone sees a **feed** that always shows the round exactly as it was `D` earlier: at time `t` the round at `t − D`. Before `D` it is empty: "The first choices show in 12 s." (counting down, *proposal*). The feed is the same for every player, the host and every spectator; nobody, the host included, sees anything younger, by any route ([05](05-security-threat-model.md) §3.2). The only live part of anyone's view is their own: their current choice, their box, their pre-picks (§7).

The feed has two parts:

- **The counts:** how many players had each option at `t − D`, and how many players were in the round then ("The round 30 s ago: 23 players"). Options without a player show 0. After the join time has passed in the feed (from `J + D` on) the total is final, so a change in the counts can only be a switch; the feed says so once: "All 23 players are in. Every change now is a switch." (*proposal*).
- **The lines**, newest first, each with its age, counting on: "Anna chose Summer · 30 s ago" (owner, decision 81: a first choice is always shown with the player's name), and for a switch shown by §6.3 "Anna switched Summer → Winter · 31 s ago". The viewer's own lines say "You". A first choice made by a pre-pick reads like any other (no mark, so nobody learns who is away) (*proposal*). The view carries the newest 60 lines; the result has all of them (*proposal*).

The counts and the totals are computed by the server for every released step and carried with it; the client never counts ([04](04-software-architecture.md) §4.8).

### 6.2 The reveal

When play ends (`T − D`) every choice is frozen. For the last `D` seconds the feed keeps running one delay late and so reveals the final playable seconds; the stage says "Choices are closed. Revealing the last 30 s of play — the result follows in 18 s." (*proposal*). Nothing else happens until the end.

### 6.3 Switches (owner, decision 82)

The host chooses per round how switches show (`mind.switchVisibility`):

| Value | A switch in the feed |
|---|---|
| `hidden` | changes only the counts; no line |
| `visible` | a line with the name and from → to |
| `perPlayer` (default) | each player has a box **Hide my switches**. A switch made while it is set changes only the counts; one made while it is clear gets its line. |

The box stays as the player set it until they change it: for the rest of the match, kept by the server with the player's pre-picks (§7, *proposal*). It shows only in `perPlayer` rounds. A first choice is never hidden (owner, decision 81). The counts always change, so a hidden switch still shows as one fewer here and one more there, without a name. That is the rule as given.

## 7. Pre-picks (owner, decision 87)

- Once in the match, a player may fix their choice for any of the match's rounds in advance: **Your pre-picks**, one choice or none per round number, in the waiting area before the first round and in every pause (*proposal*). Only the rounds still to play are offered (a played round's pre-pick is gone from the panel, O97); a pre-pick for the next round can be changed until it starts.
- At each round's opening a pre-pick enters as the player's first choice, with the opening as its time, so it counts as joined within the join time and makes no line of its own until the feed reaches it (§6.1). The player is then played automatically, whether present or not. A player who is present can switch normally, like everyone else.
- A pre-pick of All for a round with All off cannot enter: the player has no choice in that round unless they make one, and their own view says "Your pre-pick All was not offered in round 3." (*proposal*).
- Pre-picks are the player's own: no other player, no spectator, not the host and no admin screen sees them, before or after the round; the result shows only final choices (§9). A player who leaves the match or is removed from it loses their pre-picks (*proposal*).

## 8. Winner and points (owner, decisions 83 and 84)

### 8.1 The winning options

At the end, count every final choice per option. Only options chosen by at least one player take part. Order them from the least to the most chosen; **options with equal counts share one place**, and the next count takes the next place (*proposal*: dense places, 1, 1, 2, …; owner decision 83 does not say whether a tie skips the following place). The winning options are those at the host's place (`mind.winnerPlace`, default 1, the least chosen). If the round has no such place, nobody wins, and the result says so. All counts like a season in every step (owner, decision 77).

| Final counts (Sp, Su, Au, Wi, All) | Winner place | Places | Winners |
|---|---|---|---|
| 3, 5, 3, 9, off | 1 | 1: Spring, Autumn (3); 2: Summer (5); 3: Winter (9) | the 6 players on Spring and Autumn |
| 3, 5, 3, 9, off | 2 | as above | the 5 players on Summer |
| 3, 5, 3, 9, off | 4 | only three places | nobody: "There is no 4th least chosen option this round." |
| 0, 4, 2, 0, off | 1 | 1: Autumn (2); 2: Summer (4); Spring and Winter take no part | the 2 players on Autumn |
| 2, 2, 2, 2, 1 | 1 | 1: All (1); 2: the four seasons (2) | the player on All, with 2 points |
| 5, 0, 0, 0, off | 1 | 1: Spring (5) | all 5 players: the only chosen option is the least chosen |

### 8.2 Points

Every player whose final choice is a winning option gets **1 point**; one whose winning final choice is All gets **2** (owner, decision 84). Nobody else scores.

- Points add up over the match's rounds in the match standings; a round's winners each count one round win.
- Unlike the guess games ([02](02-game-guess-the-number.md) §9), players with the same total share the same place, listed by display name in a numeric-aware order (case-insensitive, accents kept, numbers in their numeric order: "bot-9" before "bot-10"; DECISIONS O102, T369); round wins and the earliest win do not count (O100), after every round and in the final match summary.
- A shared place is carried into the leaderboards' awards: every player of it gets that place (O102).
- The points are fixed by the owner and are not settings ([08](08-admin-settings.md) §3.4).
- Players are not placed against each other inside a round: every winner shares the win (§9).

## 9. Round end, result and match summary

- **End:** the round ends at `T` (reason "time is up", worded "The round is over."); with nobody in it, "Nobody chose this round." (reason "no players left"). **End round** in the host menu ends it at once, the final choices being those at that moment, reason "ended by the host"; **Abort round** works as everywhere ([02](02-game-guess-the-number.md) §8.3) (*proposal*). The result is decided by the game's own rule (§8), not by Solved signals ([04](04-software-architecture.md) §4.8).
- **Result** (the result page of [02](02-game-guess-the-number.md) §12; O97, O98 and O99; the design reference is [docs/design/mind-games-screens.html](../design/mind-games-screens.html), screens 2A, 2B, 4a and 4b): on a desktop one screen that never scrolls, under the slim result bar:
  - **the headline row:** "Winter wins!", "Spring and Winter win!", "Nobody wins this round." (36 px) with "Least chosen season · 160 players" beside it (16 px muted: the winning place in words and the players in the round) and "Every line" (every line the feed showed) small at the far right; under it a left column and a right one.
  - **The left column:** **the winners**, every winner of the round as a chip in a green panel of their own, titled with the points ("36 winners · +1 each", "1 winner · +1", "3 winners · +1 each, +2 for All", "1 winner · +2 for All"), the viewer's "You" first, each name whole in its tooltip and cut at 220 px, at most four rows of chips and then "+N more", which opens every winner; without a winner a neutral panel "Nobody wins this round.";
  - then **the cards**, one row (4, or 5 with All) of equal columns: the season's icon, its name and its final count on one line, under it "✓ WINNER" for a winning option or the reason at 4.5:1 ("not least chosen", "not chosen"); a winning card lifted, with a gradient of its season's colour, its frame, a green ring and a glow, so colour is never the only sign; **no player names in the cards** (O99);
  - then **the standings**, "Standings after round N" with the number of players, a plain ranking by the match total, equal totals sharing a place and listed by name (§8.2, O100) (place, name, this round's "+1" or "0", total; "—" for a player not in the round), the viewer's row bold in amber and no winner colouring, in two columns, taking the rest of the height and scrolling inside their panel when needed, opening with the viewer's row in view; there is no "All N players" link.
  - **The right column** (from the winners' top to the foot, 376 px): **the next round**, "Round 2 in 0:21" with **Start now** for the host (the accent blue, dark text, a pill at least 44 px high), a 6 px bar from the round's end, "Your pre-picks · play for you while you are away" and one row per round still to play (its label, a select), only that list scrolling when it does not fit, and "Hide my switches" at the foot.
  - **On a phone** (screens 4a, 4b) the same parts stacked in the page, which is the only thing that scrolls above the chat bar: the headline (26 px) with its line, the winners (chips at most 150 px, at most three rows), the cards in one row (icon, name, count, a "✓" pill on a winner), the next round (pre-picks two to a row), then the standings in one column as part of the page, starting with the viewer's own line "You · place 37" *(proposal, T361)* and then every row.
  - There is no placings table (O97; the match summary keeps its standings table). Switch histories and pre-picks are never shown, not even after the end (§6.3, §7); nor is any player's count of choices, which would reveal their switches: no route, view, table, summary, admin screen or export carries one (owner, decision O91).
- **Chat line** (`reveal`, [07](07-integration.md) §2): "Round 3: Winter was the least chosen (3 players)."; "Round 3 ended: nobody won." (*proposal*).
- **Match summary** ([02](02-game-guess-the-number.md) §2): the standings with each player's total points and round wins, equal totals sharing a place and listed by name (§8.2, O100), and the rounds played with their winning options; after the last round it says "All 6 rounds are played." (*proposal*).
- **Leaderboard:** as in the other games (owner, decision 85; [02](02-game-guess-the-number.md) §9): with `countsForLeaderboard` on, each account's match standing (points, round wins) goes to the season and the all-time board, under the same minimum of distinct players; Mind Games adds no solves.

## 10. What a spectator and the host see

A spectator (a guest, a match player not in the round, an admin who is not playing) sees the round bar, the phases with their times, and the delayed feed of §6, exactly as a player does, without a choice of their own. The host plays along and, once the round has started, sees exactly what every player sees (owner, decision 88); the host menu holds Start round, End round, Abort round, Start next round now, the next round's settings and End match, and never shows a count, choice or pre-pick that the feed does not show ([05](05-security-threat-model.md) §3.2).

## 11. Player screen (owner, decision 89)

The rules of [02](02-game-guess-the-number.md) §12 apply: focus mode with the round bar and panels on demand, one screen without a page scrollbar at 1280 × 720 and 390 × 844 in light and dark, only the lines' list scrolling inside its own box, text at 4.5:1, touch targets of at least 44 px, never colour alone, `prefers-reduced-motion`, full keyboard play. The game's parts *(proposal)*:

- **Phase strip** (across the round view's full width under the bar; O92, O97): the round's timeline with its three parts, Join, Play and Reveal, as segments whose widths follow their durations, each with its name and its end ("until 1:00"; a phone shows the names only).
  - The part the round is in has a strong frame, a progress fill as it runs and the words "· now" (`aria-current` too); the others stay plain, so colour is never the only sign.
  - Under the strip one line: "You see the round 30 s late · Joining closes in 0:24 · Choices close in 0:54", only the parts that still apply ("… · Choices close in 0:12", "… · Reveal · result in 0:18"). There are no markers for the feed's moment.
- **Choice cards** (O97): four (with All five) cards in one row, each in its season's colour (All in the neutral colour with the four icons): the season's icon (about 64 px; 32 px on a phone), its name, and the count from the feed in large type with "players, 30 s ago" under it (a phone shows icon, name and count), never the live count.
  - The top of each card is its button, a radio group (`role="radiogroup"`, arrow keys move, Enter or Space chooses). A click or tap anywhere inside a card's frame (its top, its flight band, its count) is that button's, with the same rules (disabled when choosing is not possible, nothing sent for the own choice); the band and the counts never catch a click (owner's finding, 2026-11-17, DECISIONS T379).
  - The own choice has a strong frame in its season's colour (All's in the text colour) and the pill "✓ Your choice"; a phone names it in a line under the row, "Your choice: Autumn".
- **Hide my switches** (`perPlayer` rounds only): a checkbox under the cards.
- **The lines:** the delayed feed panel on the right (about 2/5 of the width; on a phone under the cards, filling the rest): its head names its time ("30 seconds ago · 23 players") and holds the empty-feed and reveal sentences (§6.1, §6.2), then the feed's list (§6.1), newest first, each line with its age, in its own scrolling box, with the Log button for every line and event. The phase changes ("Joining has closed.", "Choices are closed.") are read out once to a screen reader; the counts are not announced on every step.
- **The chat, docked below** (O97, O99; the module's `meta.chatDock: 'below'`, [07](07-integration.md) §2; the design reference [docs/design/mind-games-screens.html](../design/mind-games-screens.html)):
  - on a desktop (a landscape viewport of at least 900 px) the match chat is a full-width strip of 190 px (150 px in a window under 760 px high) under the round view and under the result and pause; the round bar has no Chat button;
  - on a phone the screen is two parts: the content, the only part that scrolls, and the chat bar under it, part of the layout, never over the content and never moving: "Chat · <newest message>" with the unread count, which opens the full chat as a sheet above the bar, and under it a field "Write a message…" with **Send**, which sends without opening the sheet, in the round and on the result; with the on-screen keyboard open the bar stays directly above it;
  - the chat is mounted once for the round, the result and the next round, so the room and what was typed survive the switch;
  - there is no call view: the chat takes the full width. A **later call view** would take a slot at the right end of the docked strip (about 320 × 180 px, 16:9) with the chat beside it; nothing of a call is built: calls cannot be embedded in games today (the website's docs/GAME-INTEGRATION.md §8).
- **Desktop (1280 × 720 and 1920 × 1080):** the round bar; the phase strip and its line across the width; under it on the left (about 3/5) the cards and the box, on the right (about 2/5) the feed panel; the chat docked under both (the platform's split layout, T351; the reference's screen 1).
- **Phone (390 × 844):** in the content above the chat bar, scrolling as one page (screen 3): the round bar; the compact strip and its line; the cards in one row (each at least 66 px wide and 72 px tall, also with All); "Your choice: Autumn"; the box; the feed's head and lines at their own height.
- **Tooltips on every input** (owner, decision 89): every choice button ("Choose Winter. You can switch until 1:30."), the box ("While this is ticked, your switches show only in the counts."), Start next round now, every pre-pick field and every field of the host form has a tooltip, also shown on keyboard focus; the host form keeps its help lines ([08](08-admin-settings.md) §1).
- **Animation** (owner, decision 90): switches and first choices fly between the seasons as the feed shows them (§11.1).
- **Pre-picks panel** (the waiting area and the next round's box under the result, §7, §9; the design reference's screens 2A and 4a): "Your pre-picks" (15 px bold) with "play for you while you are away" beside it (13 px muted; its tooltip the whole sentence "Pre-picks play for you when you are away. If you are here, you can still switch.");
  - one row per round still to play, its label at the left and a select at the right ("none, Spring, Summer, Autumn, Winter, All", 170 px, at least 44 px high), on a phone two to a row with the label above;
  - "Hide my switches" at the foot. After the last round there is no panel (O97).
- **Result and pause** (O97, O99): §9;
  - at 1280 × 720, 1440 × 900, 1900 × 860 and 1920 × 1080 nothing scrolls but the standings' own panel, and the headline, the winners, the cards, the next round's countdown and its first pre-pick show with at least three standings rows;
  - a window under 760 px high shows the headline, the cards' icon and count at 28 px, the winners in two rows of chips, the chat at 150 px, and 12 px of page padding and tighter standings rows (O101);
  - on a phone the winners, the cards and the countdown show above the chat bar without scrolling at 390 × 844 and 360 × 740, and nothing ever lies behind the bar.

### 11.1 Animation (owner, decision 90)

The round view is animated, not text only. When a switch reaches the delayed feed, the icon of the season the player leaves flies off, turns into the icon of the season they switch to, and lands there.

- **Only the delayed feed drives it.** Every flight starts from a released feed step (§6.1) that the client already holds: the step's event (`ChoiceFed`, [06](06-data-model-api-realtime.md) §2.7) says from where to where, and its counts say what the options show afterwards. Nothing flies earlier than the feed shows it, and a flight shows nothing the step does not contain; the live-state rule of [05](05-security-threat-model.md) §3.2 holds unchanged. The client computes no count: the counts come with the step.
- **The flights** (owner, 2026-11-16 and 2026-11-17, DECISIONS T378, T379) run in a flight band of the stage between the choice buttons and their counts. The band is part of the one-screen layout (§11), so a flight never covers a choice button, the feed lines or the chat panel, and it is clipped at its edges.
  1. **Trigger.** Each released feed step that moves someone starts one **wave**. A new wave never cuts an earlier one short.
  2. **Grouping.** Within one step, all moves with the same from → to fly as one flight; first choices into the same season count as one path. A group of N ≥ 2 shows a count "×N" and no name.
  3. **Names.** A single flight shows the player's name if it is a first choice or a visible switch, and only if its whole label, where the coin lands, lies inside the target card's frame, clear of the labels beside it; otherwise that flight flies without a name all the way (crossing other cards in mid-flight is fine; T379). A hidden switch (switches `hidden`, or the player's "Hide my switches", §6.3) never shows one. On the phone layout no flight shows a name; the feed lines show them. Names come only from the released feed.
  4. **Path.** From the source card's horizontal middle to the target card's, both measured from the cards at the wave's start. A first choice comes in from the band's right edge on a desktop, from below on the phone layout.
  5. **Look.** The coin is the season's icon at full size; All's is its 2 × 2 square at its button's proportions. In the first half of the flight it turns over like a coin into the new season's icon, so it always arrives as the pure new icon. A name, or a group's "×N" (15 px bold in a pill, T379), sits centred above its coin, fully readable, and appears and disappears with it.
  6. **Landing.** A lone flight lands exactly on its card's middle. Several landing in one card at the same time spread evenly and symmetrically around the middle, and shrink only as much as needed (never below 82 % of full size) so that no two overlap by more than a fifth. Coins, their "×N" and the "+N" land wholly inside the card's frame (the spread uses its inner width). Flights that would not fit at 82 % join one "+N" in that card's last slot. After landing, coin and label stand still, then shrink and fade into the card; a coin still standing where a newer one lands in the same card fades at once, so coins never pile up. After a flight nothing of it remains.
  7. **Length** *(proposal, T379)*. The flight 1.6 s (`FLIGHT_MS`), standing 0.5 s, the fade 0.3 s; a coin replaced fades in 0.15 s. **Near the end** (owner, 2026-11-17, T380): a wave that starts with less than 1.6 s + 0.5 s left before the plan's end (`T`, from the round's public timing; nothing new reaches the client) flies in the time left less 0.3 s, at least 0.4 s and at most 1.6 s, and stands for the rest; with less than 0.4 s left (or none: a step shown in the second after `T`) its coin appears at its landing at once and stands 0.5 s, until the result replaces it. So the last flights land before the result screen.
  8. **Reduced motion.** No flights at all (below).
- The counts always change to the step's exact counts at the step, whatever flies.
- **At the round end** *(proposal)*: the winning season or seasons light up for about 2 s on the result's row of options, beside their check and "wins" (§9), so the light is never the only sign.
- **Reduced motion** *(proposal)*: with the device's reduced-motion setting there are no flights and no light-up: the counts change in place, and the lines say the rest.
- The flights are hidden from screen readers (`aria-hidden`); the lines and the counts carry the same information in words.

## 12. Not part of this game

- **No season specials, no halving, no teams** (DECISIONS T284; each one is an owner question in [OPEN](../OPEN.md)). The game implements no special hook and no halving ([04](04-software-architecture.md) §4.4), and its matches have no teams (`meta.teams` false).
  - A round still stores a season like every round (In Season, or the seed's in a Quick Test), but for now the game shows none (O93): no season pill in the round bar, no season and no "No special this round." on the intro, whose heading is the game's name, and nothing about seasons in the host form or the Quick Test.
  - The module says so with `meta.seasons: false` ([04](04-software-architecture.md) §4); the season changes no rule.
- **No cooldown, no Heatwave or Frost, no inactivity limit:** none of them exists in the `phased` class ([04](04-software-architecture.md) §4.8). A player who stops choosing keeps their last choice; pre-picks play for the absent.
- **No secret and no fairness proof:** nothing in a round is random, so a round has no commitment and no verification page; the result shows every final choice and every count, from which anyone can check it (*proposal*). The live state plays the secret's part instead: it never leaves the server before it is one delay old ([05](05-security-threat-model.md) §3.2).
  - With no secret there is no secret mode either: the round bar says neither "Shared" nor "Individual" (the module's `meta.secretModes` is empty, DECISIONS T347), and the admin's live list gives a round of this game no guess total and no mode ("—", T348, T354).
- The work packages that build the game are listed in [11](11-roadmap.md) §4.
