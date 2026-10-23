# 01 — Vision and Priorities

> Part of the Seasonal Mini Games specification. Index: [README](README.md).

## 1. Vision

Seasonal Mini Games is a platform for short multiplayer games that people play **together, at the same time**. A host opens a match, players join, and the host runs one round after another. Every round belongs to one of the four Seasonal Tokens seasons. Its season changes the rules for every player at the same moment and in the same way.

The platform comes first and the games plug into it. Accounts, matches, rounds, timing, ordering, seasons, teams, leaderboards, chat, embedding and administration are platform features. A game supplies only its own rules and its own screen (the game-module contract, [04](04-software-architecture.md) §4).

The first game is **Guess The Number** ([02](02-game-guess-the-number.md)). Later games are listed in the [roadmap](11-roadmap.md) §3 and in [GAME-IDEAS.md](../GAME-IDEAS.md). They have no design yet (owner, decision 2).

## 2. Fixed product facts

| Fact | Source |
|---|---|
| The platform foundation is adopted from Seasonal Bingo Royale: stack, layering, working rules, installer, identity adapters, embedding, chat providers, file header and size limits. | Owner, 2026-10-24 (decision 1) |
| The first game is Guess The Number. The other vision games are in the roadmap only. | Owner, 2026-10-24 (decision 2) |
| Specification first, code afterwards. | Owner, 2026-10-24 (decision 7) |
| No prizes of monetary value: no payouts, wagers, purchases, wallets or token transfers. Players compete for placings and leaderboard rank. The data model has no currency, balance or wallet fields. | Owner, 2026-10-24 (decision 14; as Bingo 01 §1.1) |
| Standalone product that can also be embedded in the Seasonal Entertainment website. | Owner, 2026-10-24 (decision 14; as Bingo 01 §1.1, Bingo 07) |
| Everything in the repository is English; the player-facing UI is English. | Standing rule |
| Launch sizing: up to 500 concurrent players in one round, 1 000 on one server across rounds. | Owner, 2026-10-24 (decision 15). Load gate in [09](09-testing-strategy.md) §5 |

Nothing of value can be won or bought, so the games stay games without stake, as in Bingo. Any later change that adds a stake or a prize of value is a separate project that starts with a legal review.

## 3. Priority order

When two goals conflict, the higher one wins. Every design choice in this spec and every later task follows this order:

| # | Priority | What it means here |
|---|---|---|
| 1 | **Maintainability** | Small, layered modules. The platform and the games are separated by one contract, and a new game never edits platform code. One source per concept. |
| 2 | **Security** | The server decides everything. Secrets never reach a client before the round ends. Cooldowns and ordering are enforced on the server only. Defaults are safe, and admin actions are audited. |
| 3 | **Documentation** | The spec governs. Every decision has its reason in `DECISIONS.md`. Headers, comments and docs change in the same commit as the code. |
| 4 | **Testability** | Pure domain with injected clock and randomness. Every rule in [02](02-game-guess-the-number.md) and [03](03-seasonal-specials.md) maps to an invariant in [09](09-testing-strategy.md). Rounds are reproducible from their seed. |
| 5 | **Simplicity** | The fewest moving parts that meet the rules. One process, one database, no extra services until the scale path needs them. No generality before a second game needs it. |
| 6 | **Scalability** | Sized for the launch target with a documented path beyond it (Bingo 02 §8). A round stays on one instance, so its order stays single. |
| 7 | **Performance** | Fast enough that waiting times and ordering are what players feel, not the server. Targets are in [09](09-testing-strategy.md) §5. |
| 8 | **Features** | Last. A feature that costs any of the above waits. |

The same order is the first part of the criteria for future games ([GAME-IDEAS.md](../GAME-IDEAS.md)).

## 4. Glossary

| Term | Meaning |
|---|---|
| **Platform** | Everything except the rules and screens of an individual game. |
| **Game** | One kind of play, such as Guess The Number. It is delivered as a game module. |
| **Game module** | A package implementing the game-module contract ([04](04-software-architecture.md) §4): rules, settings, views and the client screen of one game. |
| **Host** | The account that opened a match and runs its rounds (permission `match.manage`). |
| **Match** | A lobby with players in which the host runs rounds of one game, one after another, until the host closes it. |
| **Round** | One play of a game inside a match, with its own settings, season and outcome. |
| **Secret** | The value a round's players search for. In Guess The Number, a whole number in the round's range. It never leaves the server before the round ends. |
| **Shared secret / individual secret** | The two secret modes (owner, decision 5). With a shared secret every player searches the same secret. With an individual secret every player has their own. |
| **Guess** | One attempt by a player to name the secret. |
| **Feedback** | The server's answer to a guess (for example "higher"). |
| **Hint** | Extra information about the secret given by a special (for example "the number is odd"). |
| **Cooldown** | The waiting time that applies to a player after each accepted guess (owner, decision 3). It is the same for every player of a round. |
| **Receive order** | The order in which the server's round queue takes guesses in. It decides who wins (owner, decision 4). |
| **Placing** | A player's final position in a round. |
| **Spectator** | Someone watching a round without playing it: a guest, a player who has not joined it, or the host. |
| **Season round** | A round with its season's special switched on ([03](03-seasonal-specials.md) §2). |
| **Special** | A seasonal rule change that applies to every player at the same moment ([03](03-seasonal-specials.md)). |
| **In Season** | The season that follows the token currently in season, as reported by the Seasonal Entertainment website ([03](03-seasonal-specials.md) §3). |
| **Halving round** | A special round on a real halving day in which the number range halves at intervals ([03](03-seasonal-specials.md) §4). |
| **Season team** | One of four teams, one per season, that players join in shared mode ([03](03-seasonal-specials.md) §5). |
