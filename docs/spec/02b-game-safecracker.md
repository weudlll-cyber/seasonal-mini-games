# 02b — Game Design: Seasonal Safecracker

> Part of the Seasonal Mini Games specification. Index: [README](README.md).
> Seasonal Safecracker is one of the three next games (owner, decision 38). Every rule of its own below was proposed by the architect on 2026-11-01 and is built as written; each is marked *(proposal)* and listed in [OPEN](../OPEN.md). Everything not written here is inherited from Guess The Number ([02](02-game-guess-the-number.md)) and cited by section. Every number is a setting with a default, a minimum and a maximum ([08](08-admin-settings.md)); the value shown is the default.

## 1. The game in one paragraph

The server picks a secret **code** of 4 digits from 0–9; a digit may appear more than once. Players type full codes. After each guess the server answers how many digits are right and in the right place, and how many are right but in the wrong place (§5), as in the board game Mastermind *(proposal)*. Everything else is Guess The Number's: the per-player cooldown (owner, decision 3; [02](02-game-guess-the-number.md) §7), a shared or an individual secret (owner, decisions 4 and 5), the first correct guess received wins a shared round and solve order places an individual one ([02](02-game-guess-the-number.md) §8), the host plays along (owner, decision 16), and the fairness proof (owner, decision 9; [02](02-game-guess-the-number.md) §10). The game id is `safecracker`, its name "Seasonal Safecracker".

## 2. Matches and rounds

A match is always one game, which the host chooses when creating it (owner, decision 41): a match for `safecracker` runs only Safecracker rounds. Match lifecycle, end of a match, waiting area, Quick Test, rosters, round lifecycle and recovery are those of [02](02-game-guess-the-number.md) §2 and §4, including team matches (owner, decision 34), the intro screen (owner, decision 36) and the special banners (owner, decision 35). The intro screen's secret line *(proposal)*: "Shared 4-digit code, digits 0–9" or "Everyone has their own 4-digit code, digits 0–9".

## 3. Round settings

Secret mode, cooldown, season, season special, season teams, feedback visibility, closeness comments, countdown and longest round are as in [02](02-game-guess-the-number.md) §3. Range, show range and halving round do not exist in this game (§8). Its own settings, chosen by the host per round inside the admin's bounds ([08](08-admin-settings.md) §3, document `game.safecracker`):

| Setting | Values | Default | Source |
|---|---|---|---|
| Code length (`code.length`) | 3 – 6 digits | 4 | *(proposal)* |
| Digits in use (`code.digits`) | 4 – 10: the digits 0 … `code.digits` − 1 | 10 (0–9) | *(proposal)* |

The secret is drawn uniformly per position with the round's generator, under the label `secret/shared` in shared mode and `secret/<playerId>` per player in individual mode ([04](04-software-architecture.md) §5.4) *(proposal)*. Repeats are allowed, so there are `digits ^ length` codes (10 000 by default).

## 4. Guessing

The action is `{ value: "0427" }`: a string of digits, so leading zeros are kept *(proposal)*. A guess is accepted only if all of these hold, checked in this order ([02](02-game-guess-the-number.md) §5.1; the game's checks are its `validate`, [04](04-software-architecture.md) §4.2); the first that fails decides the code:

| # | Check | Code | Words on screen |
|---|---|---|---|
| 1 | The round is open | `ROUND_NOT_OPEN` / `ROUND_OVER` | as [02](02-game-guess-the-number.md) §5.1 |
| 2 | The guesser is on the roster | `NOT_IN_ROUND` | as 02 |
| 3 | Individual mode: not solved yet | `ALREADY_SOLVED` | as 02 |
| 4 | Exactly `code.length` characters, each a digit below `code.digits` *(proposal)* | `CODE_INVALID` | "Enter 4 digits, each from 0 to 9." |
| 5 | No digit of the guess has fallen in Leaf Fall (§7.3) *(proposal)* | `DIGIT_REMOVED` | "That digit has fallen." |
| 6 | Not the same code as one of the guesser's earlier guesses (`round.repeatGuessRejected`) | `ALREADY_GUESSED` | "You already tried that code." |
| 7 | The guesser's cooldown has ended | `COOLDOWN_ACTIVE` | as 02 |

Rejections cost nothing and are seen only by the guesser ([02](02-game-guess-the-number.md) §5.1). The input row catches checks 4 and 5 at once without sending (as DECISIONS T113); the server checks again. Receive order is [02](02-game-guess-the-number.md) §5.2.

## 5. Feedback

### 5.1 The feedback rule *(proposal)*

For a guess `g` and the guesser's secret `s`, both of length `L`:

- `exact` = the number of positions `i` with `g[i] = s[i]`.
- `near` = Σ over every digit `d` of min(count of `d` in `g`, count of `d` in `s`), minus `exact`. A digit counts at most as often as it appears in the code, and a digit already counted as exact is not counted again.
- The answer is `{ exact, near }`. The guess is **solved** when `exact = L`.

Worked example with the secret **1123**:

| Guess | Exact | Common digits (min per digit) | Near | Words |
|---|---|---|---|---|
| 1312 | 1 (first 1) | 1: 2, 2: 1, 3: 1 → 4 | 3 | "1 right · 3 wrong places" |
| 1111 | 2 (first two 1s) | 1: min(4, 2) = 2 → 2 | 0 | "2 right" — the extra 1s count for nothing |
| 2211 | 0 | 1: 2, 2: 1 → 3 | 3 | "3 wrong places" — only one 2 counts |
| 1123 | 4 | — | 0 | correct |

Feedback goes to the guesser, held by Frost like every answer ([02](02-game-guess-the-number.md) §6.1, [03](03-seasonal-specials.md) §2.4). No deduction is computed for anyone: the server never shows which codes or digits are still possible, apart from Leaf Fall's fallen digits (owner, decisions 17 and 37).

### 5.2 What others learn (owner, decision 8)

Shared mode, per `round.feedbackVisibility` ([02](02-game-guess-the-number.md) §6.2): `own` — that a player tried a code that did not open the safe; `numbers` — also the code; `full` (default) — also `{ exact, near }` with its pegs, text and comment. Individual mode: others see only that a guess happened, and solves with their places. All in the round's one list (owner, decision 20).

## 6. Closeness tiers and comments (owner, decision 21)

The tier comes from this fixed table *(proposal)*, with the score `t = (2·exact + near) / (2·L)`:

| Tier | When |
|---|---|
| correct | `exact = L` |
| just missed | `exact = L − 1` (then `near` is always 0) |
| way off | otherwise, `t = 0` (no digit of the guess is in the code) |
| cold | `t` < 0.25 |
| cool | `t` < 0.45 |
| warm | `t` < 0.60 |
| hot | `t` < 0.75 |
| burning | otherwise |

In the example of §5.1, 1312 scores 5/8 (hot), 1111 4/8 (warm), 2211 3/8 (cool); at length 4, 2 exact + 2 near scores 0.75 (burning), so every tier is reachable at the default length. The bounds are a fixed table, not settings *(proposal)*. Who sees a comment, trend lines (`comments.trendPercent`), the choice of lines and the no-repeat rule are [02](02-game-guess-the-number.md) §6.3. The catalogue is the game's own, in the voice of a safe ("The tumblers didn't even twitch.", "Click… click… so close."): at least 15 lines per tier and per trend pool, a few per season, without digits *(proposal)*.

## 7. Seasonal specials

Principles, scheduling and order are [03](03-seasonal-specials.md) §1. With the special off the round plays by the plain rules above.

### 7.1 Spring — Spring Herald *(proposal)*

At `opensAt` one position's digit is revealed, free: "Free hint: the 2nd digit is 7." Shared mode: one position, drawn with the round generator, the same line to everyone, spectators included. Individual mode: each player one position of their own code, drawn per player; spectators see only "Spring Herald: everyone got a free hint." `spring.hintType` does not apply.

### 7.2 Summer — Heatwave and Winter — Frost

Platform features, unchanged ([03](03-seasonal-specials.md) §2.2, §2.4; [04](04-software-architecture.md) §4.4). Under Frost the `{ exact, near }` answer and its comment are held together.

### 7.3 Autumn — Leaf Fall (owner, decision 37) *(proposal)*

Every `autumn.intervalS` ([03](03-seasonal-specials.md) §2.3) `autumn.digitsPerFall` digits (default 1) fall out: "Leaf Fall: 7 is not in the code." The platform's `autumn.count` and `autumn.minRemaining` do not apply. The fallen digits are drawn uniformly with the round generator (label `leafFall/<k>`) from the **candidates**, computed at the fall:

1. Start with the digits in use, 0 … `code.digits` − 1, minus the digits already fallen.
2. Remove every digit that occurs in any secret of the round (the shared code; in individual mode every player's code). No secret's digit ever falls.
3. Shared mode with visibility `full`: remove every digit **proven absent** by a delivered public answer, that is every digit of a guess answered `exact = 0, near = 0` whose receive time is before `releasedBefore` (an answer Frost still holds does not count). No other deduction is used. Guessed digits with any other answer stay candidates.
4. Otherwise (`own`, `numbers`, individual mode): remove every digit that occurs in any accepted guess of the round so far.

If fewer candidates remain than `digitsPerFall`, the fall takes all of them; with none left the falls end (an empty hook result, [04](04-software-architecture.md) §4.4). The fallen digits are the same for everyone and visible to everyone. A guess containing one is refused at no cost (`DIGIT_REMOVED`, §4).

### 7.4 Halving

None *(proposal)*. Safecracker implements no `halving` hook and sets `halvingAllowed` off, so on a halving day the option is not offered and a normal season round runs, as owner decision 29 does for a hidden range (DECISIONS T55; [04](04-software-architecture.md) §4.4).

## 8. Winning, closest miss and the result page A time-up result without a winner shows the round's closest guess instead, "Closest guess: …" (DECISIONS T145).

Winning, placings, end conditions, points and the winning margin are [02](02-game-guess-the-number.md) §8 and §9. The reveal shows the code (shared) or every player's code (individual), and the result's secret line reads "Code: 1123 (4 digits, 0–9)" (DECISIONS T150).

**Closest miss** *(proposal)*, shared mode with a winner and no second correct guess inside the margin window (owner, decision 22): among the wrong guesses of players other than the winner, the one with the most `exact`, then the most `near`, then the earlier receive order: "Closest miss besides the winner: Anna, 3 right places, 1 right digit, wrong place (0427)." Without such a guess there is no line. It is computed at the round's end and carried only in the result view ([02](02-game-guess-the-number.md) §9, DECISIONS T77).

## 9. What a spectator sees

As [02](02-game-guess-the-number.md) §11, with the code taking the number's place: codes only under `numbers` or `full`, `{ exact, near }` and comments only under `full`; the fallen digits, the code's length and digits in use, and a shared Spring Herald hint always; an individual hint never; any secret never.

## 10. Player screen

The rules of [02](02-game-guess-the-number.md) §12 apply: one screen without a page scrollbar at 1280 × 720 and 390 × 844 with all necessary information visible, only the guess list scrolling inside its own box, text at 4.5:1 in light and dark, touch targets at least 44 px, never colour alone, `prefers-reduced-motion`, full keyboard play. The game's parts *(proposal)*:

- **Code block** (in the range block's place): "4-digit code, digits 0–9" in large type; a **digit strip** with one chip per digit in use, in one row (0–9 side by side on a desktop too), a fallen digit kept in full-contrast text, struck through with a thick line, on a dashed border and marked with a small × badge inside its own chip, never over the next one (its label says "7, fallen"), so the strip itself is the Leaf Fall panel (at most 10 digits, no separate panel or sheet); Spring Herald's hint as a highlighted line under it for the whole round.
- **Input row:** the cooldown ring, one box per digit (each at least 44 × 44 px, `inputmode="numeric"`, one character, with a border of at least 3:1 against the background even when empty, light and dark), and a large **Try code** button. Typing a digit moves the focus to the next box; Backspace in an empty box goes back and clears it; arrow keys move between boxes; pasting a full code fills every box; Enter sends when every box is filled. A digit outside the digits in use or a fallen digit is refused in its box with the sentence of §4. The button is disabled during the cooldown, while a guess is on its way, and until the code is complete; during the cooldown it reads "Wait 6 s" in readable text (`buttonText`, T125). Typed digits are never lost (DECISIONS T76).
- **History rows** (the round's one list, newest first): the player's dot and name ("You" for the viewer), the code in a monospaced face with spaced digits, then **pegs**: one filled disc per exact and one hollow ring per near (a right digit in a wrong place), in the text colour with at least 3:1 against the row, so shape and not colour carries the meaning; then the counts in text ("2 right places, 1 right digit, wrong place"; singular for exactly 1, plural otherwise, everywhere: rows, result, closest miss), and the comment in smaller text. Under `numbers` the code without pegs or text; under `own` "Anna tried a code." Own rows on the season tint; under Frost "answer arriving in 2 s".
- **Desktop (1280 × 720):** the list with the banner above it fills the main area above the input row (at least 14 rows, owner decisions 35 and 50); the right column holds the code block only (the line, the digit strip, the hint, the fallen digits); the teams and the chat are panels from the bar ([02](02-game-guess-the-number.md) §12).
- **Phone (390 × 844):** the short top bar; the code block compact (the line and the digit strip in one row of chips at least 28 px wide, not interactive); the list of guesses only filling the remaining height, with "All (N)" for the events too (owner decision 49); Players and Chat in the bar; the input row pinned at the bottom on two lines when it does not fit one (the boxes on the first, the ring and **Try code** on the second): six boxes need 6 × 44 px plus gaps, inside 358 px. A history row fits one line for the code and pegs, the text and comment on a second.

## Decided while building (night 4, proposals)

- The answer carries `{ exact, near, solved }`; `solved` is exact = length, because the guess engine's `solved(answer)` does not see the code length.
- Spring Herald draws the position under `springHerald/shared` or `springHerald/<playerId>`, uniformly; in individual mode the room gets one line "Spring Herald: everyone got a free hint." without any digit.
- The answer's words leave out a zero part: "2 right · 1 wrong place", "2 right", "1 wrong place", and "no digit right" when both are zero; the code panel says once what they mean: "right = right digit, right place · wrong place = right digit in the wrong place" (DECISIONS T143).
- A list row's tone is "close" (green) once at least half the digits are in the right place, the same rule for every row (DECISIONS T139), "far" below it, "correct" when solved; its words "N right places, M right digits, wrong place" (singular for 1) or "correct — the safe is open"; a hidden code reads "tried a code".
- The digit strip shows in every season (with Leaf Fall it also marks the fallen digits).
- A Leaf Fall takes `min(autumn.digitsPerFall, candidates)` digits under `leafFall/<k>`; with no candidate it adds nothing and the falls end.
- The conformance kit plays codes of length 6: sentinel secrets of the digits 5–9, guesses of the digits 0–4, so every answer is "no digit right".
