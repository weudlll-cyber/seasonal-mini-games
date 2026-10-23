# 02 — Game Design: Guess The Number (fast mode)

> Part of the Seasonal Mini Games specification. Index: [README](README.md).
> Every number in this document that the owner did not give is a setting with a default, a minimum and a maximum ([08](08-admin-settings.md)). The value shown here is the default.

## 1. The game in one paragraph

The server picks a secret whole number in a range (default 1–1 000, *proposal*). Players type guesses. After each guess the server answers whether the secret is higher or lower (*proposal*, §6). A player may guess whenever they want, and after each accepted guess a waiting time, the **cooldown**, applies to that player (owner, decision 3). With a **shared secret** everyone searches the same number, and the first correct guess the server receives wins. With an **individual secret** every player has their own number, and placings follow the order in which players solve them (owner, decisions 4 and 5).

**Fast mode** is the timing class of this game: per-player cooldown, no global tick. The platform enforces cooldowns for every game that declares this timing class ([04](04-software-architecture.md) §4.3). Long-running games keep their own timing (owner, decision 3) and are not part of v1.

## 2. Matches and rounds

- A host (permission `match.create`) opens a **match** for the game `guess-the-number`. The match lifecycle is Bingo's (Bingo 01 §7.6 start rules, Bingo 01 §13 cancelled-match page), with one difference: a match is not a fixed tournament. It is a lobby in which the host runs **rounds**, one after another, until the host closes it.
- Players join the match from the lobby. Joining the match does not put a player into a round that is already running. They watch it and play from the next round (*proposal*).
- Before each round the host sets the round's settings (§3). They are frozen when the round is created and never change while it runs. The only exceptions are changes made by a special, which apply to everyone at once ([03](03-seasonal-specials.md)).
- Players needed to start a round: 2 (*proposal*, `match.minPlayersPerRound`). Players per match: at most 500 (*proposal*, `match.maxPlayers`).

## 3. Round settings (chosen by the host per round)

| Setting | Values | Default | Source |
|---|---|---|---|
| Secret mode | `shared` or `individual` | `shared` (*proposal*) | Owner, decision 5: chosen per round |
| Cooldown | 3 s – 60 s, whole seconds, the same for every player | 10 s (*proposal*) | Owner, decision 3: range 3–60 s |
| Range | lowest and highest number, both inclusive | 1–1 000 (*proposal*) | Setting |
| Season | `inSeason` (follow the website) or one of the four seasons | `inSeason` when the feed is available, otherwise the host must pick | Owner, decision 6 ([03](03-seasonal-specials.md) §3) |
| Season special | on or off | on | [03](03-seasonal-specials.md) §2 |
| Halving round | on or off; offered only on a halving day | off | [03](03-seasonal-specials.md) §4 |
| Season teams | on or off; shared mode only | on | [03](03-seasonal-specials.md) §5 |
| Feedback visibility | `own`, `numbers` or `full`; shared mode only | `own` (*proposal*, §6.2) | Setting |
| Countdown before opening | 3 s – 30 s | 5 s (*proposal*) | Setting |
| Longest round | 1 min – 60 min | 10 min (*proposal*) | Setting |

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
| `countdown` | The host presses **Start round**, or immediately after creation if the host chose "start now". | The **roster** is frozen: every match player except the host who has an open connection to the match at that moment (*proposal*; a player who drops later stays on the roster). The server announces `opensAt` as an absolute server time = now + countdown. Spring Herald's free hint is delivered at `opensAt` ([03](03-seasonal-specials.md) §2.1). |
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
4. The value is a whole number inside the round's **current** range ([03](03-seasonal-specials.md) §4 can shrink it) (`OUT_OF_RANGE`).
5. The value has not been removed by Leaf Fall (`NUMBER_REMOVED`).
6. The guesser has not guessed this value before in this round (`ALREADY_GUESSED`) (*proposal*: a repeat costs nothing and tells nothing).
7. The guesser's cooldown has ended (`COOLDOWN_ACTIVE`, with the time it ends).

A rejected guess does not start a cooldown, is not counted, and is not shown to anyone but the guesser. A guess that fails a check is never held back and retried later. The client sends it again if the player wants.

### 5.2 Receive order

The server puts every guess of a round into **one queue for that round**, in the order it takes the messages in. It processes them one at a time in that order ([04](04-software-architecture.md) §5.2). Each accepted guess gets the next **receive number** (`receiveSeq`, 1, 2, 3 …) and its **receive time** from the server clock. The client's clock and any time the client sends are ignored.

## 6. Feedback

### 6.1 The feedback rule (*proposal*)

For an accepted guess `g` and the guesser's secret `s`:

| Case | Feedback |
|---|---|
| `g < s` | `higher` — "The number is higher than 412." |
| `g > s` | `lower` — "The number is lower than 412." |
| `g = s` | `correct` |

Feedback goes to the guesser. Without Frost it is sent as soon as the guess is processed. With Frost it is sent after the Frost delay ([03](03-seasonal-specials.md) §2.4). The guesser's screen keeps the narrowed range ("between 413 and 731") computed **by the server** from their own feedback. The client renders it and never derives it.

### 6.2 What other players learn in shared mode (*proposal*)

Setting `feedbackVisibility`, chosen per round:

| Value | Every other player sees for each accepted guess |
|---|---|
| `own` (default) | That a player guessed, and that it was not correct. Not the number. |
| `numbers` | The player and the number guessed. Not the feedback. |
| `full` | The player, the number and the feedback. The search becomes a fully shared one. |

In individual mode other players always see only that a player guessed, plus their solve and placing. Their numbers and feedback mean nothing for anyone else.

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
- **Placings (*proposal*):** the winner is 1st. Everyone else on the roster is listed below as "took part", with their number of guesses and without a place. A round without a correct guess has no winner.

### 8.2 Individual secret (owner, decision 5)

- A player who guesses their own number has **solved** it. Their placing is the order of their correct guess in the round's receive order: the first solver is 1st, the next 2nd, and so on. Ties cannot happen.
- A solved player cannot guess again in the round. They watch the rest as a spectator, still seeing their own result.
- The round ends when every roster player has solved, when the longest round time is reached, or when the host ends it.
- **Players who did not solve (*proposal*):** listed after the placed players as "not solved", without a place.

### 8.3 Other end conditions (both modes)

| Condition | Result |
|---|---|
| Longest round time reached (`opensAt` + `roundMaxDuration`) | `ended`, reason "time is up". Placings as above; shared mode then has no winner. |
| Host presses **End round** | `ended`, reason "ended by the host". Placings as far as reached. |
| Host presses **Abort round** (with a reason) | `aborted`: no placings, no points (§4). |
| Every roster player left the match | `ended`, reason "no players left". |

## 9. After the round

- **Reveal:** shared mode shows the secret to everyone. Individual mode shows every player their own number and lists every player's number in the result. If the fairness proof is on (§10), the round seed is published as well.
- **Result screen:** the end reason in plain words ("Walter found 731 first — after 9 guesses"), placings (§8), the viewer's own line highlighted, team standing when teams are on ([03](03-seasonal-specials.md) §5), and the match standings. The host sees **Next round** with the last settings prefilled.
- **Points (*proposal*):** placings give match points from a table (`points.placement`, [08](08-admin-settings.md)): shared winner 10; individual 10, 7, 5, 3 for places 1–4 and 1 for every further solver. Match standings are the sum over the match's rounds. Ties are ordered by number of wins, then by the earliest win's receive time.
- **Leaderboard:** adopted from Bingo 01 §10 (season board per calendar quarter, all-time board), with league points from match standings. The flag `countsForLeaderboard` is set per match (Bingo 01 §3a.3), default on.

## 10. Fairness proof (*proposal*, owner question (a))

When `fairness.commitReveal` is on (default on), the server publishes `sha256(roundSeed)` at round creation and the seed itself at round end. Anyone can recompute the secret or secrets, Spring Herald's hint, Leaf Fall's removals and the halving windows from the seed and the published settings ([04](04-software-architecture.md) §5.4). This is the same commit-reveal scheme as Bingo 01 §9, applied per round instead of per match.

## 11. What a spectator sees

A spectator is a guest, a match player not on the roster, a solved player in individual mode, or the host.

| Visible | Never visible before the round ends |
|---|---|
| Season, its special and token visuals ([03](03-seasonal-specials.md) §6); halving badge | The secret or any secret |
| Current range; removed numbers; current cooldown value; time left | Any player's feedback, except under `full` visibility in shared mode |
| Roster: per player the number of guesses, "cooling down" or "ready", solved and placing (individual) | Guessed numbers, except under `numbers` or `full` |
| Live feed of accepted guesses at the visibility of §6.2; specials as they happen ("Leaf Fall: 12 numbers fell") | Spring Herald's hint in individual mode (each player's hint is about their own number) |
| Team standing when teams are on | Anything a player sees only about their own number |

The host sees what a spectator sees, plus the host controls (Start round, End round, Abort round, Next round). The host never sees a secret of a running round, as Bingo's admins never see a running match's seed (Bingo 01 §9).

## 12. Player screen (fast mode)

- A range bar from the current low to the current high end, with the player's own narrowed band highlighted, removed numbers struck through, and the halving window when a halving round runs.
- A number field and **Guess**, disabled while the cooldown runs. The cooldown ring shows the seconds left. Under Frost, a frosted marker shows "answer arriving in 2 s".
- The player's own guesses, newest first, each with its feedback.
- The season banner with the token's colours and icon; Spring Herald's hint as a card; Heatwave's current cooldown value when it changes.
- The live feed and the roster (§11); the team standing when teams are on.
- Every line is plain English, as in Bingo 01 §13 ("Your cooldown is now 7 s — Heatwave"). Server codes reach the screen as sentences. All animations respect `prefers-reduced-motion`. Sounds are off by default. Accessibility target WCAG 2.2 AA, with full keyboard play (type, Enter).

## 13. Out of scope for v1

- Long-running games and their own timing (owner, decision 3: they keep their own timing when they come).
- The other vision games (owner, decision 2).
- Anything with monetary value.
- Player-created matches with custom bounds; native apps; languages other than English.
