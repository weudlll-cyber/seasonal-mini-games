# 03 — Seasonal Specials

> Part of the Seasonal Mini Games specification. Index: [README](README.md).
> The specials, their names and their basic effect are owner decisions (decision 6, 2026-10-24). How each one works in detail is written here. The owner accepted these details as written (decision 15, 2026-10-24). Every number is a setting ([08](08-admin-settings.md) §3).

## 1. Principles (how every special stays equal)

1. **Same moment, same effect.** A special changes the round for every roster player at the same instant and in the same way (owner, decision 6). It never depends on who a player is, how well they are doing, their team or their connection.
2. **One clock.** Every special timer counts from the round's `opensAt` on the server clock. Its due times are fixed when the round opens: `opensAt + k × interval`.
3. **One queue.** When a special is due, the scheduler puts it into the round's queue, the same single queue that guesses go through ([04](04-software-architecture.md) §5.2). It takes effect at that position. Every guess processed before it sees the old state, and every guess after it sees the new state, for everyone alike.
4. **One frame.** The change reaches all watchers in one broadcast frame of the match room (`special.fired`, [06](06-data-model-api-realtime.md) §4.4). In individual mode, the per-player parts go out in the same processing step.
5. **One seed.** Every random choice a special makes (which numbers fall, where a halving window sits) comes from the round seed ([04](04-software-architecture.md) §5.4). It is never made by `Math.random` and never by a client. With the fairness proof on, it can be checked afterwards ([02](02-game-guess-the-number.md) §10).
6. **Several at once.** If several specials are due at the same instant, they are processed in this order, in one step: halving, Leaf Fall, Heatwave.

## 2. Season rounds

Every round belongs to exactly one of the four seasons (owner). The season is chosen as described in §3. If the round's **season special** setting is on (default on), the special of that season applies:

| Season | Special | Effect in one line |
|---|---|---|
| Spring | Spring Herald | Every player receives one free hint at round start. |
| Summer | Heatwave | The cooldown shrinks step by step for everyone, never below 3 s. |
| Autumn | Leaf Fall | At intervals, some wrong numbers are removed from the range, visible to all. |
| Winter | Frost | Answers are delivered with a delay of a few seconds. |

With the special off, the round still carries its season for visuals and teams, but plays by the plain rules of [02](02-game-guess-the-number.md).

### 2.1 Spring — Spring Herald

- **Trigger:** `opensAt`, once.
- **Effect:** every roster player receives one hint about the secret, free (no cooldown, not counted as a guess). The hint type is the setting `spring.hintType` (default `parity`):

| Type | Hint |
|---|---|
| `parity` | "The number is odd." / "The number is even." |
| `half` | "The number is in the lower half (1–500)." / "… upper half (501–1 000)." The lower half runs from the low end to `floor((low + high) / 2)`. With the range hidden ([02](02-game-guess-the-number.md) §3) the hint is `parity`, because a half names numbers of the range (DECISIONS T56). |

- **Shared mode:** one hint, the same text for everyone. It is shown to spectators too.
- **Individual mode:** every player gets a hint of the same type about **their own** number. Spectators see only "Spring Herald: everyone received a hint".
- **Equality:** the hints are produced in one processing step at `opensAt`, before any guess can be accepted (guesses before `opensAt` are rejected, [02](02-game-guess-the-number.md) §5.1).

### 2.2 Summer — Heatwave

- **Trigger:** every `summer.stepIntervalS` (default 30 s) after `opensAt`.
- **Effect:** the round's cooldown becomes `max(3 s, cooldown − summer.stepS)` (step default 1 s). The floor of 3 s is the owner's ("never below 3 s") and is not a setting. When the floor is reached, the timer stops. A round that starts with a 3 s cooldown gets no steps, and the host form says so.
- **Running cooldowns:** a cooldown that is already running keeps its end time. The new value applies to every guess received from the step on ([02](02-game-guess-the-number.md) §7).
- **Equality:** one cooldown value for all at any instant. Every screen shows "Heatwave: cooldown now 7 s".

### 2.3 Autumn — Leaf Fall

- **Trigger:** every `autumn.intervalS` (default 20 s) after `opensAt`.
- **Effect:** `autumn.count` numbers (default 10) are removed from the range. They are chosen uniformly with the round seed from the **candidates**: numbers inside the current range that have not been removed yet and are not the secret of anyone in the round. A guess for a removed number is rejected without cost (`NUMBER_REMOVED`).
- **End:** falls stop when the numbers still in the range (removed ones excluded) would drop below `autumn.minRemaining` (default 10). The last fall removes only as many as that allows.
- **Visible to all:** the removed numbers go to every watcher, players and spectators alike. They show as gaps in the range bar, and the round's guess list names them in an event row ("Leaf Fall: 12, 57 and 300 fell"); with the range hidden that row is the only place (DECISIONS T54).
- **Individual mode:** there is one set of removed numbers for the whole round, chosen so that it contains no player's number. It is the same set for everyone.
- **Equality, stated honestly:** every player loses the same numbers at the same moment, and none of them is anyone's secret. How much a fall helps differs: a number that falls where one player is still searching helps that player more than one that falls where their answers already rule it out. The rule is equal; the luck of where the leaves fall is spread evenly by the uniform choice.

### 2.4 Winter — Frost

- **Trigger:** the whole round.
- **Effect:** the answer to every accepted guess (the feedback of [02](02-game-guess-the-number.md) §6) reaches the guesser `winter.delayS` (default 3 s) after the guess's receive time. This spec reads "hints" in the owner's decision as these answers. Spring Herald's hint never meets Frost, because a round has one season.
- **Unchanged:** receive order, winning and placings. They are decided when the guess is processed, not when its answer arrives. The cooldown runs from the receive time as always, so a player may guess again before an answer has arrived. The player's own row in the guess list shows "answer arriving in 2 s". The guess's closeness comment ([02](02-game-guess-the-number.md) §6.3) travels with its answer and is held exactly as long; other players see the answer and the comment at the same delayed time (owner decision 21).
- **Round end under Frost:** in shared mode the round closes to guesses at the winning guess's receive time. A guess received after that is answered `ROUND_OVER` at once. The announcement of the winner and the reveal go to everyone, the winner included, at the winning guess's receive time plus the delay. In individual mode a solve is announced at its delayed time as well.
- **Equality:** one delay for everyone, measured from server receive time. A player's connection adds nothing to it and takes nothing from it.

## 3. In Season — which season a round has

- The host chooses per round: **In Season** or one of the four seasons by hand (owner).
- **In Season** takes the season of the token that is currently in season, as reported by the Seasonal Entertainment website (owner). The feed contract is in [07](07-integration.md) §5. The server polls it every `inSeason.pollS` (default 300 s) and keeps the last answer.
- An answer older than `inSeason.staleAfterH` (default 24 h) is not used. Without a usable answer, In Season is not offered and the host picks the season by hand. The form says why in one sentence.
- The season is fixed when the round is created. A change in the feed during a round affects only the next round.
- **Equality:** a round has one season for all players.

## 4. Halving round

- **Trigger:** the host turns **Halving round** on for a round. The option is offered only on a **real halving day** (owner): a calendar date in `halving.timeZone` (default UTC) on which a Seasonal Tokens halving takes place. Halving days come from the In Season feed if it provides them ([07](07-integration.md) §5), and otherwise from the admin-managed list `halving.days`. The server checks the day again when the round is created.
- **Effect:** every `halving.intervalS` (default 60 s) after `opensAt`, the current range is replaced by a **window** half its size, rounded up, that contains the secret. The window's position is chosen uniformly, with the round seed, among all positions of that size that contain the secret and lie inside the current range. The secret is therefore not predictably at the window's centre. Halving stops when the range has `halving.minRangeSize` numbers or fewer (default 8).
- **Guesses:** a guess outside the current range is rejected without cost (`OUT_OF_RANGE`). Removed numbers outside the window simply drop out of view.
- **Shared mode:** one window, shown to everyone.
- **Individual mode:** every player's own range halves around their own number, at the same moment and to the same size. The positions come from the seed per player. Spectators see "Halving: every range is now 125 numbers".
- **With a season special:** a halving round still has its season, and its special applies too (owner: every round belongs to a season). Order at the same instant: §1 rule 6.
- **With a hidden range** ([02](02-game-guess-the-number.md) §3): a window tells where the range is, so a normal season round of that season runs instead (*proposal*, DECISIONS T55, [OPEN](../OPEN.md)).
- **Equality:** the same moment and the same size for all. The halving tells every player the same amount: the size of the window is the same, and its position is random.

## 5. Season teams

- **Where:** shared mode only, when the round setting **Season teams** is on (default on). The owner decided teams for shared mode. Individual mode has no teams in v1.
- **Joining:** in the match lobby every player picks one of four teams: Spring, Summer, Autumn or Winter. A player may switch between rounds. Teams lock when a round's countdown starts. A roster player without a team at that moment is put in the smallest team; ties between teams are broken with the round seed.
- **Effect on play:** none. Team members play by the same rules, the same cooldown and the same feedback visibility as everyone else. The team does not change any player's information.
- **Team standing (owner, decision 12):** after each round the winner's team gets 1 point. Other teams get 0, and a round without a winner gives no team a point. A large team has more chances to win simply because it has more players guessing; this follows from the decision and is not corrected.
- **Shown:** the team standing (rank, team, points, wins) appears on the round result, in the match standings and on the season leaderboard beside the player board (owner, decision 6). Ties are ordered by wins, then by the earliest win.

## 6. Visuals

- Every round uses its token's original colours and icon (owner): the season's Seasonal Tokens icon and season colour on the round banner, the range bar accent, the team badges and the result screen.
- Assets as in Bingo: the season icons `assets/seasons/*.svg`, the font `assets/fonts/luxora-grotesk-*.woff2`, the emblem `assets/brand/emblem.webp`, and the colours from `assets/brand/colors.md` (Spring `#afb84e`, Summer `#e06e22`, Autumn `#f9a825`, Winter `#04aaf7`; text and icons on a season colour `#12161c`). They are copied from the Bingo repository into this repository's `assets/` with their manifest and licence note (Bingo `assets/README.md`) when the client is built. They are not covered by the AGPL licence.
- The Seasonal Entertainment look in light and dark (Bingo 01 §13) is adopted unchanged: theme logic, glows, pill buttons, headings in Luxora Grotesk Bold. Colour is never the only carrier of meaning: every season also shows its icon and name.
- A halving round adds a halving badge to the season chip of the round view's top bar ([02](02-game-guess-the-number.md) §12). Each special announces itself in one quiet event row of the round's guess list when it happens ("Leaf Fall: 12, 57 and 300 fell"; owner decision 20). A few closeness comments belong to one season and come up only in its rounds ("Found it — snow problem!").
