# 02 — Game Design: Guess The Number (fast mode)

> Part of the Seasonal Mini Games specification. Index: [README](README.md).
> Every number in this document that the owner did not give is a setting with a default, a minimum and a maximum ([08](08-admin-settings.md)). The value shown here is the default.

## 1. The game in one paragraph

The server picks a secret whole number in a range (default 1–1 000). Players type guesses. After each guess the server answers whether the secret is higher or lower (§6). A player may guess whenever they want, and after each accepted guess a waiting time, the **cooldown**, applies to that player (owner, decision 3). With a **shared secret** everyone searches the same number, and the first correct guess the server receives wins. With an **individual secret** every player has their own number, and placings follow the order in which players solve them (owner, decisions 4 and 5).

**Fast mode** is the timing class of this game: per-player cooldown, no global tick. The platform enforces cooldowns for every game that declares this timing class ([04](04-software-architecture.md) §4.3). Long-running games keep their own timing (owner, decision 3) and are not part of v1.

## 2. Matches and rounds

- A host (permission `match.create`) opens a **match** for the game `guess-the-number`. The match lifecycle is Bingo's (Bingo 01 §7.6 start rules, Bingo 01 §13 cancelled-match page), with one difference: a match is not a fixed tournament. It is a lobby in which the host runs **rounds**, one after another, until the host closes it.
- Players join the match from the lobby. Joining the match does not put a player into a round that is already running. They watch it and play from the next round.
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
| Countdown before opening | 3 s – 30 s | 5 s | Setting |
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
| `countdown` | The host presses **Start round**, or immediately after creation if the host chose "start now". | The **roster** is frozen: every match player who has an open connection to the match at that moment, the host included (owner, decision 16: the host plays along; a player who drops later stays on the roster). The host joins their own match as a player when opening it. The server announces `opensAt` as an absolute server time = now + countdown. Spring Herald's free hint is delivered at `opensAt` ([03](03-seasonal-specials.md) §2.1). |
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
- **Lines.** A catalogue in the game module holds at least 25 lines per tier, 15 for a correct guess and 10 per trend direction, plus a few that only a round of their season uses. They are friendly and playful, teasing at the far end ("Well, that wasn't it."), never insulting, never about a name, without profanity and without digits.
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
- A solved player cannot guess again in the round. They watch the rest as a spectator, still seeing their own result.
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
- **Result screen:** the end reason in plain words ("Walter found 731 first — after 9 guesses"), placings (§8), in shared mode the **winning margin** (owner, decision 13: how much earlier the winning guess arrived than the next correct one, "found it 0.4 s before Anna"; the round closes at the winning guess, so the server keeps noting correct guesses that it answers `ROUND_OVER` for `round.marginWindowS` (*proposal*, default 2 s, 0.5–10 s) after it; the first one sets the margin, and without one the result says "nobody else was close"), the viewer's own line highlighted, team standing when teams are on ([03](03-seasonal-specials.md) §5), and the match standings. The host sees **Next round** with the last settings prefilled.
- **Points:** placings give match points from a table (`points.placement`, [08](08-admin-settings.md)): shared winner 10; individual 10, 7, 5, 3 for places 1–4 and 1 for every further solver. Match standings are the sum over the match's rounds. Ties are ordered by number of wins, then by the earliest win's receive time.
- **Leaderboard:** adopted from Bingo 01 §10 (season board per calendar quarter, all-time board), with league points from match standings. The flag `countsForLeaderboard` is set per match (Bingo 01 §3a.3), default on.

## 10. Fairness proof (owner, decision 9)

When `fairness.commitReveal` is on (default on), the server publishes `sha256(roundSeed)` at round creation and the seed itself at round end. Anyone can recompute the secret or secrets, Spring Herald's hint, Leaf Fall's removals and the halving windows from the seed and the published settings ([04](04-software-architecture.md) §5.4). This is the same commit-reveal scheme as Bingo 01 §9, applied per round instead of per match.

## 11. What a spectator sees

A spectator is a guest, a match player not on the roster, a solved player in individual mode, or an admin who is not playing. The host is on the roster like every player (owner, decision 16).

| Visible | Never visible before the round ends |
|---|---|
| Season, its special and token visuals ([03](03-seasonal-specials.md) §6); halving badge | The secret or any secret |
| Current range; removed numbers; current cooldown value; time left | Any player's feedback, except under `full` visibility in shared mode |
| Roster: per player the number of guesses, "cooling down" or "ready", solved and placing (individual) | Guessed numbers, except under `numbers` or `full` |
| The round's one list: accepted guesses at the visibility of §6.2, with their closeness comments where the answer is shown (§6.3); specials as they happen ("Leaf Fall: 12 numbers fell") | Spring Herald's hint in individual mode (each player's hint is about their own number) |
| Team standing when teams are on | Anything a player sees only about their own number |

When a round runs, the host sees exactly the view every player sees and plays along: guesses, cooldown, placings and points like any player (owner, decision 16). The host controls (Start round, End round, Abort round, the next round's settings) sit in a small host menu behind one button in the top bar. The host never sees a secret of a running round, as Bingo's admins never see a running match's seed (Bingo 01 §9).

## 12. Player screen (fast mode)

The whole round view fits the screen without a page scrollbar (desktop 1280 × 720 and up, phone 390 × 844); only the guess list scrolls, inside its own box. Everyone gets the same view, the host included (decision 16):

- **Top bar, one line:** the season chip in the season's colour with its icon and special (and the halving badge), shared or individual, the cooldown value (Heatwave's changes included), the time left (or "Opens in 3 s"), and for the host the host menu button (at least 44 px).
- **Main area, the largest part:** "The number is somewhere between L and H" in large type and a full-width bar from L to H on which fallen numbers show as gaps, with their count under it; nothing narrowed from the answers (decision 17). With the range hidden: "Any whole number", with a note that negative numbers are possible. Spring Herald's hint under it. Then the round's **one list** (owner, decision 20), filling the height that is left, newest at the top: every guess the viewer may see (§6.2) and the round's events. A guess row shows the player's colour dot, the name ("You" for the viewer), the number, higher or lower in colour, and the closeness comment in smaller text under it (§6.3). The viewer's own rows have a tint of the season colour behind them, with the text at 4.5:1 or more in light and dark. Under Frost an own row says "answer arriving in 2 s". Events (Spring Herald, Leaf Fall, Heatwave's steps, halving, solves, the round opening and ending) are quieter one-line rows. Then the input row: the cooldown ring, the number field (it takes a minus sign; a ± button where negative numbers are possible, DECISIONS T57) and a large **Guess** button, disabled while the cooldown runs; Enter sends.
- **Desktop:** the main area beside a right column about 380 px wide with, when teams are on, the four teams as small score tiles in one row at its top; the rest of the column stays free.
- **Phone:** the top bar shortened (season chip, cooldown, time, host button), the range block (compact), the guess list filling the remaining height, the team tiles in one row, and the input row pinned at the bottom for the thumb.
- Lobby, setup and result pages may scroll.
- Every line is plain English, as in Bingo 01 §13 ("Your cooldown is now 7 s — Heatwave"). Server codes reach the screen as sentences. All animations respect `prefers-reduced-motion`. Sounds are off by default. Accessibility target WCAG 2.2 AA, with full keyboard play (type, Enter).

## 13. Out of scope for v1

- Long-running games and their own timing (owner, decision 3: they keep their own timing when they come).
- The other vision games (owner, decision 2).
- Anything with monetary value.
- Player-created matches with custom bounds; native apps; languages other than English.
