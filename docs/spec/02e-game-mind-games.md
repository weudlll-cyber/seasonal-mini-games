# 02e — Game Design: Seasonal Mind Games

> Part of the Seasonal Mini Games specification. Index: [README](README.md).
> Seasonal Mind Games (id `mind-games`) is the first game that is not a guess game (owner, decisions 76–90, 2026-11-12). It has no secret, does not use the guess engine ([04](04-software-architecture.md) §4.7) and runs in its own timing class, `phased`, which the game-module contract gains first as a contract change of its own ([04](04-software-architecture.md) §4.8). Hosting, sign-in, roles, standalone and embedded modes and the chat are those of the other Mini Games (owner, decision 88; [02](02-game-guess-the-number.md) §2, [07](07-integration.md)). Every number the owner did not give is a setting with a default, a minimum and a maximum ([08](08-admin-settings.md) §3.4); the value shown is the default. Rules the owner did not give are marked *(proposal)* and listed in [OPEN](../OPEN.md).

## 1. The game in one paragraph

Every player picks one of the four seasons, Spring, Summer, Autumn or Winter, each with its token's icon and original colour ([03](03-seasonal-specials.md) §6), or, when the host offers it, a fifth choice **All** (owner, decision 77). Whoever picked the **least chosen** option wins the round (owner, decision 83). Players may switch as often as they like until play ends, and everyone watches the others, but only **one delay late**: the feed always shows the round as it was 30 s earlier (owner, decisions 78–80). So every move is read by the others half a minute later, and the last half minute of play is only seen once choices are closed. A match is a series of rounds whose points add up (owner, decision 85).

## 2. Matches and rounds

- A match is always one game, chosen when creating it (owner, decision 41): a `mind-games` match runs only Mind Games rounds. Creating, joining, the waiting area, the host playing along, End match, the idle close and the match summary are [02](02-game-guess-the-number.md) §2, with the differences below. The match has no teams (§12).
- **A series of rounds** (owner, decision 85): a match is `mind.rounds` rounds (default 6). The host chooses the number in the first round's form; it holds for the whole match (*proposal*). After each round the result stays on screen for the **pause** (`mind.pauseS`, default 15 s, owner decision 86), with the waiting area beside it ([02](02-game-guess-the-number.md) §2); then the next round starts by itself, with its countdown (the intro screen, [02](02-game-guess-the-number.md) §12) and the settings of the host's next-round form. The host can always shorten the pause with one click, **Start next round now**, in the result's next-round box and in the host menu (owner, decision 86). After the last round's pause the match ends by itself with the match summary ("All 6 rounds are played.") (*proposal*); the host can end it earlier with End match, as in every game.
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
| Delay (`mind.delayS`) | 5 – 120 s; at most (total − 10 s) / 2, so the feed shows at least 10 s of the round while choices are still open | 30 s | Owner, decision 78 (default); bounds and the rule *(proposal)* |
| Join time follows the total (`mind.joinAuto`) | on: the join time is half the total, rounded down to whole seconds; off: `mind.joinS` applies | on | Owner, decision 78: half the total, following a change of the total unless the host sets it |
| Join time (`mind.joinS`) | 10 – 590 s, at most total − delay; used only while `mind.joinAuto` is off | 60 s | Owner, decision 78; bounds *(proposal)* |
| All (`mind.allOption`) | off or on: a fifth choice that counts like a season in every rule | off | Owner, decision 77 |
| Switches (`mind.switchVisibility`) | `hidden`, `visible`, `perPlayer` (§6.3) | `perPlayer` | Owner, decision 82 |
| Winner (`mind.winnerPlace`) | 1 (least chosen) – 4; 5 only with All on | 1 | Owner, decision 83 |
| Rounds (`mind.rounds`) | 1 – 20; chosen in the first round's form, held for the match | 6 | Owner, decision 85 (default); bounds *(proposal)* |
| Pause (`mind.pauseS`) | 5 – 120 s; held for the match; the host can always shorten it | 15 s | Owner, decision 86 (default); bounds *(proposal)* |

In the host form the join time shows the value in force: while "Join time follows the total" is on, the field shows half of the total and its help line says it follows the total; typing a value means turning the box off first (*proposal*). A refused value or pair is named under its field as for every setting (owner, decision 74): "The delay must be at most half the total minus 10 s.", "The join time must end by the time choices close (total − delay).", "The 5th least chosen needs the All option." (*proposal*). Every input of the form, like every input of the game, also has a tooltip (owner, decision 89).

## 4. The round timeline (owner, decision 78)

All times count from the round's opening (`opensAt`, [02](02-game-guess-the-number.md) §4). With total `T`, delay `D` and join time `J`:

| From – to | Phase | Players may | Everyone sees (§6) |
|---|---|---|---|
| 0 – `J` | **Join** (part of play) | join with a first choice; switch | from `D` on, the round as it was `D` earlier |
| `J` – (`T` − `D`) | **Play** | switch, if in the round; nobody joins | the round `D` earlier |
| (`T` − `D`) – `T` | **Replay** | nothing: every choice is frozen | the replay of the final playable `D` seconds |
| `T` | **End** | — | the result (§9) |

With the defaults (120, 30, 60): join until 1:00, switches until 1:30, the feed starts at 0:30, and 1:30–2:00 replays 1:00–1:30 of play. The phases are the round's plan, scheduled and enforced by the platform ([04](04-software-architecture.md) §4.8); the client only shows them. The platform's round lifecycle (created, countdown, open, ended, aborted) is unchanged: the three phases all lie in `open`.

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

Checks 1–4 are the platform's for every `phased` game ([04](04-software-architecture.md) §4.8), 5–7 the game's `validate`. A refused choice costs nothing, changes nothing and is seen only by the chooser ([02](02-game-guess-the-number.md) §5.1). The buttons are disabled where the client already knows the answer (after play ends, after the join time for someone not in the round, the current choice), but the server decides every case again ([05](05-security-threat-model.md) §3.2, DECISIONS S11).

### 5.3 First choice and switches

The first accepted choice puts the player in the round (owner, decision 79). Every later accepted choice is a **switch** from the current choice to another; a player may switch any number of times until play ends. The player's **final choice** is the one in force when play ends (or when the host ends the round, §9).

## 6. What everyone sees: the delayed feed (owner, decisions 80–82)

### 6.1 One delay late

From `D` after the opening, everyone sees a **feed** that always shows the round exactly as it was `D` earlier: at time `t` the round at `t − D`. Before `D` it is empty: "The first choices show in 12 s." (counting down, *proposal*). The feed is the same for every player, the host and every spectator; nobody, the host included, sees anything younger, by any route ([05](05-security-threat-model.md) §3.2). The only live part of anyone's view is their own: their current choice, their box, their pre-picks (§7).

The feed has two parts:

- **The counts:** how many players had each option at `t − D`, and how many players were in the round then ("The round 30 s ago: 23 players"). Options without a player show 0. After the join time has passed in the feed (from `J + D` on) the total is final, so a change in the counts can only be a switch; the feed says so once: "All 23 players are in. Every change now is a switch." (*proposal*).
- **The lines**, newest first, each with its age, counting on: "Anna chose Summer · 30 s ago" (owner, decision 81: a first choice is always shown with the player's name), and for a switch shown by §6.3 "Anna switched Summer → Winter · 31 s ago". The viewer's own lines say "You". A first choice made by a pre-pick reads like any other (no mark, so nobody learns who is away) (*proposal*). The view carries the newest 60 lines; the result has all of them (*proposal*).

The counts and the totals are computed by the server for every released step and carried with it; the client never counts ([04](04-software-architecture.md) §4.8).

### 6.2 The replay

When play ends (`T − D`) every choice is frozen. For the last `D` seconds the feed keeps running one delay late and so replays the final playable seconds; the stage says "Choices are closed. Replay of the last 30 s of play — the result follows in 18 s." (*proposal*). Nothing else happens until the end.

### 6.3 Switches (owner, decision 82)

The host chooses per round how switches show (`mind.switchVisibility`):

| Value | A switch in the feed |
|---|---|
| `hidden` | changes only the counts; no line |
| `visible` | a line with the name and from → to |
| `perPlayer` (default) | each player has a box **Hide my switches**. A switch made while it is set changes only the counts; one made while it is clear gets its line. |

The box stays as the player set it until they change it: for the rest of the match, kept by the server with the player's pre-picks (§7, *proposal*). It shows only in `perPlayer` rounds. A first choice is never hidden (owner, decision 81). The counts always change, so a hidden switch still shows as one fewer here and one more there, without a name. That is the rule as given.

## 7. Pre-picks (owner, decision 87)

- Once in the match, a player may fix their choice for any of the match's rounds in advance: **Your pre-picks**, one choice or none per round number, in the waiting area before the first round and in every pause (*proposal*). Rounds already played are locked; a pre-pick for the next round can be changed until it starts.
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

Every player whose final choice is a winning option gets **1 point**; one whose winning final choice is All gets **2** (owner, decision 84). Nobody else scores. Points add up over the match's rounds in the match standings; a round's winners each count one round win ([02](02-game-guess-the-number.md) §9 orders equal points by wins, then by the earliest win). The points are fixed by the owner and are not settings ([08](08-admin-settings.md) §3.4). Players are not placed against each other inside a round: every winner shares the win (§9).

## 9. Round end, result and match summary

- **End:** the round ends at `T` (reason "time is up", worded "The round is over."); with nobody in it, "Nobody chose this round." (reason "no players left"). **End round** in the host menu ends it at once, the final choices being those at that moment, reason "ended by the host"; **Abort round** works as everywhere ([02](02-game-guess-the-number.md) §8.3) (*proposal*). The result is decided by the game's own rule (§8), not by Solved signals ([04](04-software-architecture.md) §4.8).
- **Result** (the result page of [02](02-game-guess-the-number.md) §12, *proposal*): the headline names the winners in plain words ("Winter was the least chosen — 3 players win.", "Spring and Autumn share the least chosen place — 6 players win.", "Nobody wins: there is no 4th least chosen option this round."); the options in a row, each with its icon, its count and its place, the winning ones marked by a check and their word "wins", not by colour alone; under each option the players whose final choice it was, the viewer's own line highlighted, with "+1" or "+2"; the placings table with Player and Points only, the winners first, then the rest, each group in display-name order (owner, decision O91 of 2026-11-13); "Round 3 of 6" and the pause, "Next round in 12 s", with **Start next round now** for the host; the match standings. Switch histories and pre-picks are never shown, not even after the end (§6.3, §7); nor is any player's count of choices, which would reveal their switches: no route, view, table, summary, admin screen or export carries one (owner, decision O91).
- **Chat line** (`reveal`, [07](07-integration.md) §2): "Round 3: Winter was the least chosen (3 players)."; "Round 3 ended: nobody won." (*proposal*).
- **Match summary** ([02](02-game-guess-the-number.md) §2): the standings with each player's total points and round wins, and the rounds played with their winning options; after the last round it says "All 6 rounds are played." (*proposal*).
- **Leaderboard:** as in the other games (owner, decision 85; [02](02-game-guess-the-number.md) §9): with `countsForLeaderboard` on, each account's match standing (points, round wins) goes to the season and the all-time board, under the same minimum of distinct players; Mind Games adds no solves.

## 10. What a spectator and the host see

A spectator (a guest, a match player not in the round, an admin who is not playing) sees the round bar, the phases with their times, and the delayed feed of §6, exactly as a player does, without a choice of their own. The host plays along and, once the round has started, sees exactly what every player sees (owner, decision 88); the host menu holds Start round, End round, Abort round, Start next round now, the next round's settings and End match, and never shows a count, choice or pre-pick that the feed does not show ([05](05-security-threat-model.md) §3.2).

## 11. Player screen (owner, decision 89)

The rules of [02](02-game-guess-the-number.md) §12 apply: focus mode with the round bar and panels on demand, one screen without a page scrollbar at 1280 × 720 and 390 × 844 in light and dark, only the lines' list scrolling inside its own box, text at 4.5:1, touch targets of at least 44 px, never colour alone, `prefers-reduced-motion`, full keyboard play. The game's parts *(proposal)*:

- **Phase strip** (one row at the top of the stage): the round's timeline with its three parts, Join, Play and Replay, a marker for now and one for the moment the feed shows, and the next change in words: "Joining closes in 0:24 · choices close in 0:54"; then "Choices close in 0:12"; then "Replay · result in 0:18".
- **Choice buttons:** four (with All five) large buttons in one row, each in its season's colour with its icon and name (All in the neutral surface colour with the four icons), a radio group (`role="radiogroup"`, arrow keys move, Enter or Space chooses). The current choice is pressed, with a check and "Your choice" in words. Under each button its count from the feed, "30 s ago: 7", and a bar of that length, never the live count.
- **Hide my switches** (`perPlayer` rounds only): a checkbox under the buttons.
- **The lines:** the feed's list (§6.1), newest first, in its own scrolling box; the feed's head names its time ("The round 30 s ago: 23 players") and holds the empty-feed and replay sentences (§6.1, §6.2). The phase changes ("Joining has closed.", "Choices are closed.") are read out once to a screen reader; the counts are not announced on every step.
- **Desktop (1280 × 720):** the stage on the left holds the phase strip, the buttons with their counts and the box; the info column on the right holds the lines. The layout is laid out to stay whole with the **Chat** panel open beside it (360 px, pushing the game aside, [02](02-game-guess-the-number.md) §12): the stage keeps at least 560 px, enough for five buttons of 100 px, so the website's chat ([07](07-integration.md) §2) can stay open through the round. A **later call view** gets its space at the top of that same side column, about 360 × 203 px (16:9), above the chat, which keeps at least 400 px below it at 720 px height; nothing of a call is built: calls cannot be embedded in games today (the website's docs/GAME-INTEGRATION.md §8).
- **Phone (390 × 844):** the round bar; the phase strip; the buttons in one row (each at least 66 px wide and 72 px tall, also with All), the counts under them; the box; the lines filling the rest. The chat, as in every game, is the bar's Chat sheet; a later call view would be a sheet of its own, so the phone keeps no empty space for it.
- **Tooltips on every input** (owner, decision 89): every choice button ("Choose Winter. You can switch until 1:30."), the box ("While this is ticked, your switches show only in the counts."), Start next round now, every pre-pick field and every field of the host form has a tooltip, also shown on keyboard focus; the host form keeps its help lines ([08](08-admin-settings.md) §1).
- **Animation** (owner, decision 90): switches and first choices fly between the seasons as the feed shows them (§11.1).
- **Pre-picks panel** (waiting area, §7): "Your pre-picks" with one compact select per round ("Round 4: none, Spring, Summer, Autumn, Winter, All"), played rounds locked, and the line "Pre-picks play for you when you are away. If you are here, you can still switch."; on a phone a two-column grid of the rounds.
- **Result:** §9, under the slim result bar, the first part on one screen at both sizes ([02](02-game-guess-the-number.md) §12).

### 11.1 Animation (owner, decision 90)

The round view is animated, not text only. When a switch reaches the delayed feed, the icon of the season the player leaves flies off, turns into the icon of the season they switch to, and lands there.

- **Only the delayed feed drives it.** Every flight starts from a released feed step (§6.1) that the client already holds: the step's event (`ChoiceFed`, [06](06-data-model-api-realtime.md) §2.7) says from where to where, and its counts say what the options show afterwards. Nothing flies earlier than the feed shows it, and a flight shows nothing the step does not contain; the live-state rule of [05](05-security-threat-model.md) §3.2 holds unchanged. The client computes no count: the counts come with the step.
- **Where** *(proposal)*: every flight moves in a flight band of the stage between the choice buttons and their counts, from the old season's count to the new one's, and lands on the new count. The band is part of the one-screen layout (§11), so a flight never covers a choice button, the feed lines or the chat panel, and it is clipped at the stage's edges.
- **A first choice** *(proposal)*: the season's icon flies from the player's name line into that season's count: on a desktop it enters the band at the stage's edge beside the lines, with the name on it for the flight; on a phone from the band's lower edge, above the lines.
- **A hidden switch** (switches `hidden`, or "Hide my switches" ticked, §6.3) *(proposal)*: an icon still flies from the old season to the new one, without any name, exactly as the counts already show it.
- **Many at once** *(proposal)*: all switches of one feed step fly as one **wave**, at most 12 icons in flight at a time; a wave with more shows the first 12 in feed order and a "+8" tag in the band. A flight lasts about 0.8 s, so a wave ends before the next step a second later. The counts always change to the step's exact counts at the step, whatever flies.
- **At the round end** *(proposal)*: the winning season or seasons light up for about 2 s on the result's row of options, beside their check and "wins" (§9), so the light is never the only sign.
- **Reduced motion** *(proposal)*: with the device's reduced-motion setting there are no flights and no light-up: the counts change in place, and the lines say the rest.
- The flights are hidden from screen readers (`aria-hidden`); the lines and the counts carry the same information in words.

## 12. Not part of this game

- **No season specials, no halving, no teams** (the planning rule of 2026-11-12, DECISIONS T284; each one is an owner question in [OPEN](../OPEN.md)). The game implements no special hook and no halving ([04](04-software-architecture.md) §4.4), and its matches have no teams (`meta.teams` false). The round keeps its season like every round ([01](01-vision.md) §1): In Season or the host's pick, shown in the round bar's pill and on the intro, with "No special this round."; it changes no rule (*proposal*).
- **No cooldown, no Heatwave or Frost, no inactivity limit:** none of them exists in the `phased` class ([04](04-software-architecture.md) §4.8). A player who stops choosing keeps their last choice; pre-picks play for the absent.
- **No secret and no fairness proof:** nothing in a round is random, so a round has no commitment and no verification page; the result shows every final choice and every count, from which anyone can check it (*proposal*). The live state plays the secret's part instead: it never leaves the server before it is one delay old ([05](05-security-threat-model.md) §3.2).
- The work packages that build the game are listed in [11](11-roadmap.md) §4.
