# 02d — Game Design: Seasonal Target

> Part of the Seasonal Mini Games specification. Index: [README](README.md).
> Seasonal Target (id `seasonal-target`) runs on the guess engine ([04](04-software-architecture.md) §4.7) and inherits every rule of Guess The Number ([02](02-game-guess-the-number.md)) that this section does not replace. Its game rules were proposed by the architect on 2026-11-01 and are built as written; each is marked *(proposal)* until the owner has played it ([OPEN](../OPEN.md)). Every number is a setting with a default, a minimum and a maximum ([08](08-admin-settings.md) §3); the value shown is the default.

## 1. The game in one paragraph

The server hides a target in one cell of a map of 50 × 50 cells. Players pick a cell on the map and press **Guess**. Depending on the host's choice, the server answers with how far away the target is and in which compass direction ("9 cells away, to the north-east", easier), only with how far away it is ("9 cells away", the default), or only with how warm or cold the guess was ("Warm", harder) (owner, decisions 39 and 43). Every guess stays on the map as a dot. Cooldown, shared or individual secret, the first correct guess received winning and placings by solve order are Guess The Number's (owner, decisions 3–5; [02](02-game-guess-the-number.md) §1, §7, §8).

## 2. Matches and rounds

- A match is always one game, chosen by the host when creating the match (owner, decision 41). A Seasonal Target match runs only Seasonal Target rounds.
- Everything else is [02](02-game-guess-the-number.md) §2 (lobby, waiting area, teams, Quick Test, end of a match, match summary), §4 (round lifecycle), §7 (cooldown), §10 (fairness proof: the secret cells, the quarter hint, the fallen cells and the halving windows are recomputed from the seed) and §8 (winning and round end; the host plays along, owner decision 16).
- **Intro line** (owner, decision 36; DECISIONS T109): "Shared target on a 50 × 50 map" / "Everyone has their own target on a 50 × 50 map" *(proposal)*.

## 3. Round settings

Guess The Number's round settings ([02](02-game-guess-the-number.md) §3) apply, except that **Range** and **Show range** are replaced by the map size; the map is always shown. Added:

| Setting | Values | Default | Source |
|---|---|---|---|
| Map width, map height | 20–100 cells each, whole numbers | 50 × 50 | *(proposal)* |
| Answers (`target.feedback`) | `direction` "distance and direction" (easier), `distance` "distance only", `closeness` "warm/cold only" (harder) | `distance` | Owner, decision 43 (2026-11-02, amends decision 39); built as the host's round setting, chosen in the round form and frozen per round: the next round's form keeps the last choice unless the host changes it ([OPEN](../OPEN.md), spec conflicts) |

## 4. Guessing

A guess is one cell, action `{ value: { x, y } }`: whole numbers, 1-based, `x` the column from the west edge, `y` the row from the top; row 1 is the north edge. Coordinates are shown as "column 12, row 34", short "(12, 34)". Anything that is not two whole numbers fails the action schema like any malformed intent ([06](06-data-model-api-realtime.md) §4.3). Checks in [02](02-game-guess-the-number.md) §5.1 order, the game's own replacing check 4 and 5 *(proposal)*:

1. `ROUND_NOT_OPEN` / `ROUND_OVER`, 2. `NOT_IN_ROUND`, 3. `ALREADY_SOLVED` — as 02 §5.1.
4. `OUT_OF_MAP`: the cell lies outside the map — "That cell is not on the map." — or outside the round's current halving window (§8.4) — "That cell is outside the target area."
5. `CELL_REMOVED`: the cell has fallen in Leaf Fall (§8.3) — "That cell has fallen."
6. `ALREADY_GUESSED` (`round.repeatGuessRejected`): "You already tried that cell."
7. `COOLDOWN_ACTIVE`, as 02 §5.1.

Rejections are free and private (02 §5.1). The input row says 4–6 at once without sending (as DECISIONS T113): the Guess button stays enabled and pressing it shows the sentence. Receive order: 02 §5.2.

## 5. Feedback (owner, decisions 39 and 43; rule *proposal*)

For a guess `g = (gx, gy)` and the guesser's secret `s = (sx, sy)` let `dx = sx − gx` (east positive) and `dy = gy − sy` (north positive, because row 1 is north), `n = dx² + dy²`. `g = s` is `correct` in every mode. Otherwise:

- **`direction`:** `{ distance, direction }`.
  - **Distance** = √n rounded to the nearest whole number, computed exactly in integers: `k = isqrt(n)`, distance `k + 1` if `n − k² > k`, else `k`. √n is never exactly half-way (k² + k + ¼ is no integer), so there is no tie. The smallest wrong-guess distance is 1.
  - **Direction** from the guess toward the secret, one of 8 sectors of 45° centred on N, NE, E, SE, S, SW, W, NW. Exactly, with `a = |dx|`, `b = |dy|`: if `(a + b)² < 2b²` the direction is N (`dy > 0`) or S; else if `(a + b)² < 2a²` it is E (`dx > 0`) or W; else the diagonal given by the signs (NE, SE, SW, NW). These are the boundaries at 22.5° off each axis (tan 22.5° = √2 − 1); a cell can never lie exactly on one, so no boundary rule is needed, and the integer test decides every case.
  - **Shown:** "9 cells away, to the north-east" with an arrow glyph ↗; short in the list "9 away, NE ↗".
- **`distance`** (the default, owner decision 43): `{ distance }` only: the rounded distance exactly as in `direction`, with no direction. Shown "9 cells away" ("1 cell away"), short in the list "9 away"; a dot carries no arrow.
- **`closeness`:** `{ tier }` only: the tier of §7 as a word ("Cold", "Warm", "Burning", "Just missed — right next to it"). The tier word is the answer, so it is shown even with `round.comments` off; the comment line comes on top when they are on.

Worked examples on a 50 × 50 map (diagonal 69.30, §7):

| Guess | Secret | dx, dy | n | `direction` (`distance`: the number alone) | `closeness` |
|---|---|---|---|---|---|
| (12, 34) | (20, 30) | 8, 4 | 80 | 9 cells, NE (√80 = 8.94; `144 < 32` no, `144 < 128` no → diagonal) | 8.94 / 69.30 = 12.9 % → cool |
| (12, 34) | (25, 31) | 13, 3 | 178 | 13 cells, E (√178 = 13.34; `256 < 18` no, `256 < 338` yes) | 19.3 % → cool |
| (20, 31) | (20, 30) | 0, 1 | 1 | 1 cell, N | just missed |
| (49, 2) | (3, 47) | −46, −45 | 4 141 | 64 cells, SW | 92.9 % → way off |

Feedback travels as in [02](02-game-guess-the-number.md) §6.1 (to the guesser, held by Frost). No candidate area is computed or drawn: no distance rings, no shaded sectors (owner, decision 17); the arrow on a dot (§6) only restates its answer *(proposal)*.

## 6. What others learn, and the map's dots

Visibility (`round.feedbackVisibility`, owner decision 8) works as [02](02-game-guess-the-number.md) §6.2 through the engine's room line (04 §4.7). Each guess is also a **dot** on its cell *(proposal)*:

| Mode / visibility | Others see in the list | Dots of others on the viewer's map |
|---|---|---|
| Shared, `own` | "Anna guessed" | none |
| Shared, `numbers` | "Anna (12, 34)" | yes, plain |
| Shared, `full` | "Anna (12, 34) — 9 away, NE ↗" or "— Warm", and the comment | yes, with the answer's arrow (`direction`) |
| Individual | "Anna guessed" | none (her cells mean nothing on the viewer's map) |

- Every player's dots take the one colour the platform's list gives that player (the colour of their list row, `colors` of the panel props). The viewer's own dots carry a ring and a bolder fill, in the season colour own list rows are highlighted in (the viewer's list colour on the result), and are always all shown; others' dots are those the engine's view carries (the newest 60, 04 §4.7) *(proposal)*. Colour is never alone: every dot is focusable, and focusing or hovering it names the player (by display name, "You" for the viewer), the cell and the answer; a small legend under the map lists each player with dots, own first (desktop; left out on a phone for space); every dot's guess is also a list row in words.
- Under Frost an own dot shows at once, hollow with "…" until its answer arrives; others see it when the view's `releasedBefore` lets them (04 §4.1).

## 7. Closeness tiers and comments (owner, decision 21; table *proposal*)

The tier uses the unrounded distance √n as a share of the map's diagonal `D = √((W − 1)² + (H − 1)²)` (the farthest two cells can be). `D` is the full map's, also in a halving window, so a tier means the same all round. The table is fixed in the game module, not a setting, because Leaf Fall's candidates in `closeness` mode depend on it (§8.3) *(proposal)*:

| Tier | Rule (first match wins) |
|---|---|
| correct | on the cell |
| justMissed | the cells touch: `max(a, b) = 1` with `a`, `b` of §5 |
| wayOff | share > 40 % |
| cold | share > 25 % |
| cool | share > 12 % |
| warm | share > 6 % |
| hot | share > 3 % |
| burning | otherwise |

Comments, trend and line picking are [02](02-game-guess-the-number.md) §6.3 through the engine: in the voice of a map and a treasure hunt ("Wrong continent.", "You can almost smell the campfire.", "Next door — knock again!", "Bullseye!"), at least 15 lines per tier and per trend pool (closer/farther), a few season lines per pool ("Snowed in right beside it!"), friendly, no digits, never about a name.

## 8. Season specials ([03](03-seasonal-specials.md))

### 8.1 Spring — Spring Herald: the quarter *(proposal)*

At `opensAt` the hint names the map quarter of the secret: the west half is columns 1 … ⌈W/2⌉, the north half rows 1 … ⌈H/2⌉ (as 03 §2.1's lower half). "Free hint: the target is in the north-west quarter (columns 1–25, rows 1–25)." Shared: one hint for everyone and spectators; individual: each player their own quarter, spectators "Spring Herald: everyone received a hint" (03 §2.1). The map outlines the quarter with a dashed border and its name in a corner label; the hint line stays above the map all round. `spring.hintType` does not apply. Intro and info sentence (`GameText.specialRule`): "Everyone learns which quarter of the map hides the target."

### 8.2 Summer — Heatwave; Winter — Frost

Platform features, unchanged ([03](03-seasonal-specials.md) §2.2, §2.4). Under Frost the held own dot (§6) and the list row say "answer arriving in 2 s".

### 8.3 Autumn — Leaf Fall *(proposal)*

Every `autumn.intervalS`, `autumn.count` cells fall (default 10), drawn uniformly with the DRBG under `leafFall/<k>` from the **candidates** (owner, decision 37; engine rule 04 §4.7). A cell `c` is a candidate when all hold:

1. `c` lies in the current window (shared mode; the whole map without halving), or in individual mode in at least one player's current window;
2. `c` has not fallen, is no player's secret, and no player has guessed it in this round (any visibility, as DECISIONS T111);
3. only with a shared secret and visibility `full`: for every answer delivered before the Frost cut `releasedBefore` to a guess `g`, `c` gets the same answer from `g` as the secret did — in `direction` mode the same rounded distance **and** the same direction by the §5 rule with `c` in place of `s`; in `distance` mode the same rounded distance, whatever the direction (owner decision 43); in `closeness` mode the same tier by the §7 table with `c` in place of `s`. With `own`, `numbers` or in individual mode no answer is public and rule 3 does not apply.

Falls stop when fewer than `autumn.minCellsLeft` candidates (default 10) would remain; the last fall removes only as many as that allows. Fallen cells are greyed and hatched on every map (shape, not colour alone), listed in the Fallen cells panel and named in the special's list row ("Leaf Fall: 10 cells fell."); a fallen cell is refused at no cost (§4, check 5). With `full`, falls lie where the target can still be: accepted by owner decision 37 ([03](03-seasonal-specials.md) §2.3).

### 8.4 Halving *(proposal)*

Offered on a real halving day as [03](03-seasonal-specials.md) §4. Every `halving.intervalS` the current window `w × h` (at first the whole map) is replaced by one of about half the area: the longer side is halved, rounded up (width on a tie). Its position is drawn uniformly with the DRBG under `halving/<k>/<shared|playerId>` among all positions of that size that lie inside the current window and contain the secret, so the secret is always inside and not predictably central. Halving runs only while the current area is larger than `halving.minCells` (default 16). Shared: one window for everyone, spectators included; individual: each player's own window around their own secret, the same size for all, and the room line says only the size ("Halving: every target area is now 25 × 50 cells").

- **Shown window:** the map draws only the current window, scaled up to the same space (cells grow), coordinates staying absolute; a line above it names it ("Target area: columns 13–37, rows 1–50"). Dots and fallen cells outside it drop out of view; the result shows the whole map again.
- **Guesses** outside the window: `OUT_OF_MAP` (§4); the selection is clamped to the window.
- **With Leaf Fall:** halving runs first at the same instant (03 §1 rule 6); candidates count only inside the window(s), so a halving can end the falls by the `autumn.minCellsLeft` stop; fallen cells inside the window stay fallen.

## 9. Winning, closest miss and the result

Winning, placings, margin and points are [02](02-game-guess-the-number.md) §8–§9. End line: "Walter hit the target first — after 9 guesses." The **closest miss** (shared, with a winner and no second hit in the margin window, owner decision 22) is the wrong guess of another player with the smallest `n`, the earlier on a tie *(proposal)*: "Anna just missed — the next cell (21, 31)." when it touches, else "Closest miss: Anna, 3 cells away (17, 30)."

The **result map** marks the secret cell with a target icon, a ring in the season colour and its coordinates in text ("Target: column 20, row 30"), over the whole map with every guess of the round as dots (nothing is secret any more) and the fallen cells. Individual mode: the viewer's map shows their own target and dots; every player's target is listed in text, as 02 §9.

## 10. What a spectator sees

As [02](02-game-guess-the-number.md) §11, with the map: dots at shared `numbers`/`full` (with arrows under `full` and `direction`), none under `own` or in individual mode; fallen cells; the shared quarter hint and window (individual: only the count or size lines); never a secret cell, an individual quarter or an individual window.

## 11. Player screen

Layout, top bar, banner, list, intro and accessibility follow [02](02-game-guess-the-number.md) §12; the map takes the range block's place as the main area *(proposal)*:

- **One screen** without a page scrollbar at 1280 × 720 and 390 × 844, light and dark; only the list scrolls inside its box (only inside one list on a phone).
- **Map:** a square-celled grid scaled to the largest size the space allows (at 1280 × 720 about 520 px, 10 px cells on 50 × 50; on a phone the width minus 16 px gutters, about 358 px), edge ticks every 10 cells with their numbers, grid lines and dots at 3:1 or more against the map, text at 4.5:1. The drawing keeps a margin on every edge, so the last tick numbers ("50") are never cut off; on a phone the tick numbers are at least 11 px. No zoom in v1; fine aiming is done with the arrows.
- **Selection:** a tap or click selects the nearest cell; the marker is a thick square outline with crosshair ticks on the edges (a different shape from every dot). The selection is local only: nothing is sent until Guess.
- **Arrows:** four buttons N, W, S, E (≥ 44 px, a compact cross, labelled "Move north" … for screen readers) move it by one cell; with the map focused the keyboard arrows do the same, Enter guesses.
- **Coordinates as text:** "Selected: column 12, row 34" beside the Guess button, read out live (`aria-live="polite"`). Two compact number fields **Column** and **Row** also set the selection and follow it, on a desktop and on a phone. The arrow buttons are 44 × 44 px. During the cooldown the Guess button reads "Wait 6 s" (`buttonText`, T125).
- **Desktop:** the map on the left with the hint or window line above it and the input row (cooldown ring, selected cell, fields, arrow cross, Guess) under it; a right column about 380 px wide holds the banner and the one list on top, then the team tiles, then the chat. **Phone:** top bar, hint line, the map at full width, the list filling the rest, team tiles with the Chat button, and the input row pinned at the bottom (ring, selected cell, fields, arrow cross, Guess). The Fallen cells panel is a "Fallen (N)" button that opens a sheet, as DECISIONS T115.
- Never colour alone: own dots by ring, fallen cells by hatch, the quarter by dashed outline and label, answers always in words.

## Decided while building (night 4, proposals)

- On maps up to about 30 × 30, two cells apart is already over 6 % of the diagonal, so `hot` and `burning` cannot occur there; tiers are decided in whole numbers (10 000 · d² against p² · D²), so no cell is placed by float rounding.
- The input takes 1–100 per coordinate; a server `OUT_OF_MAP` for a cell inside the map reads "outside the target area"; the input row checks fallen and repeated cells locally and keeps the selection inside the target area.
- In individual mode Spring Herald also sends the room a line "everyone received a hint" (`HintGiven` with `quarter: null`).
- The secret is stored with the round's answer rule (feedback mode and map size) beside its cell, because the engine's `answer(value, secret)` gets no state; only the cell ever reaches a view, after the end.
- Until the platform has a board layout for map games, the map sits in the input row under the list, at most `min(52dvh, 520px)` high (OPEN).
- (night 5) Dots take each player's list colour and name from the panel props (`names`, `colors`); "Another player" is gone. The player panel does not know the viewer's own key, so the viewer's own dots there use the season colour of own list rows rather than the viewer's list colour; the result panel (which has `viewerKey`) uses the viewer's list colour.
