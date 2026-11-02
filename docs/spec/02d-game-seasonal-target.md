# 02d — Game Design: Seasonal Target

> Part of the Seasonal Mini Games specification. Index: [README](README.md).
> Seasonal Target (id `seasonal-target`) runs on the guess engine ([04](04-software-architecture.md) §4.7) and inherits every rule of Guess The Number ([02](02-game-guess-the-number.md)) that this section does not replace. Its game rules were proposed by the architect on 2026-11-01 and are built as written; each is marked *(proposal)* until the owner has played it ([OPEN](../OPEN.md)). Every number is a setting with a default, a minimum and a maximum ([08](08-admin-settings.md) §3); the value shown is the default.
> **O45 (2026-11-02) amends the map rules of O38:** the fine 50 × 50 map is replaced by a square grid of large heat-coloured tiles, 20 × 20 by default, 8–30 per side chosen by the host. Sections 1, 3, 5–9 and 11 say what was built for it.

## 1. The game in one paragraph

The server hides a target in one tile of a square grid of 20 × 20 tiles (owner, decision 45). Players pick a tile and press **Guess**. Depending on the host's choice, the server answers with how far away the target is and in which compass direction ("9 tiles away, to the north-east", easier), only with how far away it is ("9 tiles away"), or only with how warm or cold the guess was ("Warm", harder, the default) (owner, decisions 39, 43 and 53). Every guessed tile is filled with a colour by closeness, from blue (cold) to red (hot), and shows the distance as a number where the mode gives one (O45). Cooldown, shared or individual secret, the first correct guess received winning and placings by solve order are Guess The Number's (owner, decisions 3–5; [02](02-game-guess-the-number.md) §1, §7, §8).

## 2. Matches and rounds

- A match is always one game, chosen by the host when creating the match (owner, decision 41). A Seasonal Target match runs only Seasonal Target rounds.
- Everything else is [02](02-game-guess-the-number.md) §2 (lobby, waiting area, teams, Quick Test, end of a match, match summary), §4 (round lifecycle), §7 (cooldown), §10 (fairness proof: the secret tiles, the quarter hint, the fallen tiles and the halving windows are recomputed from the seed) and §8 (winning and round end; the host plays along, owner decision 16).
- **Intro line** (owner, decision 36; DECISIONS T109): "Shared target on a 20 × 20 grid" / "Everyone has their own target on a 20 × 20 grid".

## 3. Round settings

Guess The Number's round settings ([02](02-game-guess-the-number.md) §3) apply, except that **Range** and **Show range** are replaced by the grid size; the grid is always shown. Added:

| Setting | Values | Default | Source |
|---|---|---|---|
| Grid size (`target.size`) | 8–30 tiles per side, whole numbers; the grid is square | 20 | Owner, decision 45 (amends O38's 50 × 50 map); the host's round setting, frozen while the round runs. The game's config keeps a width and a height, both the size, so the geometry below is written for `W × H` |
| Answers (`target.feedback`) | `direction` "distance and direction" (easier), `distance` "distance only", `closeness` "warm/cold only" (harder) | `closeness` | Owner, decision 43 (2026-11-02, amends decision 39), default `closeness` by decision 53 (2026-11-02; a host's stored choice keeps its value); built as the host's round setting, chosen in the round form and frozen per round: the next round's form keeps the last choice unless the host changes it ([OPEN](../OPEN.md), spec conflicts) |

The stops of Leaf Fall (`autumn.minCellsLeft`, default 10, 2–50) and halving (`halving.minCells`, default 16, 4–32) keep their defaults; their maxima lie below the smallest grid's 64 tiles, so on every grid size a fall can remove tiles and halving runs at least once *(proposal)*.

## 4. Guessing

A guess is one tile, action `{ value: { x, y } }`: whole numbers 1–30, 1-based, `x` the column from the west edge, `y` the row from the top; row 1 is the north edge. Coordinates are shown as "column 12, row 7", short "(12, 7)". Anything that is not two whole numbers fails the action schema like any malformed intent ([06](06-data-model-api-realtime.md) §4.3). Checks in [02](02-game-guess-the-number.md) §5.1 order, the game's own replacing check 4 and 5 *(proposal)*:

1. `ROUND_NOT_OPEN` / `ROUND_OVER`, 2. `NOT_IN_ROUND`, 3. `ALREADY_SOLVED` — as 02 §5.1.
4. `OUT_OF_MAP`: the tile lies outside the grid — "That tile is not on the grid." — or outside the round's current halving window (§8.4) — "That tile is outside the target area."
5. `CELL_REMOVED`: the tile has fallen in Leaf Fall (§8.3) — "That tile has fallen."
6. `ALREADY_GUESSED` (`round.repeatGuessRejected`): "You already tried that tile." A malformed action reads "Pick a tile on the grid."
7. `COOLDOWN_ACTIVE`, as 02 §5.1.

Rejections are free and private (02 §5.1). The input says 4–6 at once without sending (as DECISIONS T113): the Guess button stays enabled and pressing it shows the sentence. Receive order: 02 §5.2.

## 5. Feedback (owner, decisions 39, 43 and 45; rule *proposal*)

For a guess `g = (gx, gy)` and the guesser's secret `s = (sx, sy)` let `dx = sx − gx` (east positive) and `dy = gy − sy` (north positive, because row 1 is north), `n = dx² + dy²`. `g = s` is `correct` in every mode. Otherwise every answer carries the **tier** of §7, because the tier is the guessed tile's colour (O45) and the client never computes feedback:

- **`direction`:** `{ distance, direction, tier }`.
  - **Distance** = √n rounded to the nearest whole number, computed exactly in integers: `k = isqrt(n)`, distance `k + 1` if `n − k² > k`, else `k`. √n is never exactly half-way (k² + k + ¼ is no integer), so there is no tie. The smallest wrong-guess distance is 1.
  - **Direction** from the guess toward the secret, one of 8 sectors of 45° centred on N, NE, E, SE, S, SW, W, NW. Exactly, with `a = |dx|`, `b = |dy|`: if `(a + b)² < 2b²` the direction is N (`dy > 0`) or S; else if `(a + b)² < 2a²` it is E (`dx > 0`) or W; else the diagonal given by the signs (NE, SE, SW, NW). These are the boundaries at 22.5° off each axis (tan 22.5° = √2 − 1); a tile can never lie exactly on one, so no boundary rule is needed, and the integer test decides every case.
  - **Shown:** "9 tiles away, to the north-east"; short in the list "9 away, NE ↗"; on the tile the number with a small arrow, "9↗".
- **`distance`** (owner decision 43): `{ distance, tier }`: the rounded distance exactly as in `direction`, with no direction. Shown "9 tiles away" ("1 tile away"), short in the list "9 away"; on the tile the number alone.
- **`closeness`** (the default, owner decision 53): `{ tier }` only: the tier of §7 as a word ("Cold", "Warm", "Burning", "Just missed — right next to it"). The tier word is the answer, so it is shown even with `round.comments` off; the comment line comes on top when they are on. On the tile: the colour alone, no number.

Worked examples on a 20 × 20 grid (diagonal 26.87, §7):

| Guess | Secret | dx, dy | n | `direction` (`distance`: the number alone) | tier |
|---|---|---|---|---|---|
| (4, 14) | (12, 10) | 8, 4 | 80 | 9 tiles, NE (√80 = 8.94; `144 < 32` no, `144 < 128` no → diagonal) | 33.3 %, n > 40 → cold |
| (4, 14) | (17, 11) | 13, 3 | 178 | 13 tiles, E (√178 = 13.34; `256 < 18` no, `256 < 338` yes) | 49.7 %, n > 61 → way off |
| (10, 10) | (12, 12) | 2, −2 | 8 | 3 tiles, SE | n = 8, not > 8 → burning |
| (12, 11) | (12, 10) | 0, 1 | 1 | 1 tile, N | just missed |
| (19, 2) | (2, 18) | −17, −16 | 545 | 23 tiles, SW | 86.9 % → way off |

Feedback travels as in [02](02-game-guess-the-number.md) §6.1 (to the guesser, held by Frost). No candidate area is computed or drawn: no distance rings, no shaded sectors (owner, decision 17); the colour, number and arrow on a tile (§6) only restate its answer *(proposal)*.

## 6. What others learn, and the guessed tiles

Visibility (`round.feedbackVisibility`, owner decision 8) works as [02](02-game-guess-the-number.md) §6.2 through the engine's room line (04 §4.7). Each guess also marks its **tile** *(proposal)*:

| Mode / visibility | Others see in the list | Others' guessed tiles on the viewer's grid |
|---|---|---|
| Shared, `own` | "Anna guessed" | none |
| Shared, `numbers` | "Anna (12, 7)" | the tile with Anna's corner mark, no fill |
| Shared, `full` | "Anna (12, 7) — 9 away, NE ↗" or "— Warm", and the comment | the tile filled by its answer, with Anna's corner mark |
| Individual | "Anna guessed" | none (her tiles mean nothing on the viewer's grid) |

- **Fill:** a 5-step scale from the server's tier (O45): 1 cold (way off, cold), 2 cool, 3 warm, 4 hot, 5 burning (burning, just missed); `correct` its own dark fill with a target glyph ◎. A small legend "Cold ▮▮▮▮▮ Hot" heads the game's panel in the right column (O51). In the guess list a miss's answer is written in its tile's step colour (a text shade of the fill, 4.5:1 or more on the list's rows in both themes), never the platform's green; a found target keeps the platform's colour (O51). The colours are custom properties with a light and a dark value; every fill is at 3:1 or more against the empty tile and the number on it at 4.5:1 or more against the fill, in both themes *(proposal)*.
- **Own tiles:** a 3 px frame inside the tile in the season colour own list rows are highlighted in, set off from the fill by a thin line; always all shown. Under Frost an own tile shows the frame with "…" and no fill until its answer arrives.
- **Others' tiles:** a small corner dot in the one colour the platform's list gives that player (`colors` of the panel props), ringed 2 px in the empty tile's colour so it shows on every fill; the number moves down clear of it (O51); others' guesses are those the engine's view carries (the newest 60, 04 §4.7); others see them when the view's `releasedBefore` lets them (04 §4.1).
- **Several guesses on one tile:** the tile shows the closest answer (found, then the nearer tier, then the smaller distance), and its tooltip and label list every guess on it: "column 5, row 5: You — 9 tiles away, to the north-east; Anna — 4 tiles away, to the south". The guess list lists every guess too. Colour is never alone: every tile names its coordinates and its guesses in words.

## 7. Closeness tiers and comments (owner, decision 21; table *proposal*)

The tier uses the unrounded distance √n against two thresholds per tier: a share of the grid's diagonal `D = √((W − 1)² + (H − 1)²)` (the farthest two tiles can be) and a minimum in tiles. A guess is in a tier when its distance is more than **both**. The share sets the far tiers on large grids, the minimum the near ones on small grids, where a share alone would ask for less than one tile, so all five colour steps occur on every grid size 8–30 (O45). `D` is the full grid's, also in a halving window, so a tier means the same all round. Both columns grow from row to row, so the thresholds stay in order. The table is fixed in the game module, not a setting, because Leaf Fall's candidates depend on it (§8.3) *(proposal)*:

| Tier | Rule (first match wins), decided in integers as 10 000 · n > p² · D² and n > m |
|---|---|
| correct | on the tile |
| justMissed | the tiles touch: `max(a, b) = 1` with `a`, `b` of §5 |
| wayOff | share > 48 % and n > 61 (distance > 7.81) |
| cold | share > 32 % and n > 40 (> 6.32) |
| cool | share > 20 % and n > 20 (> 4.47) |
| warm | share > 12 % and n > 13 (> 3.61) |
| hot | share > 6 % and n > 8 (> 2.83) |
| burning | otherwise (two tiles away) |

What that gives, as distances √n (pinned by `geometry.test`):

| Grid | D | burning | hot | warm | cool | cold | way off |
|---|---|---|---|---|---|---|---|
| 8 × 8 | 9.90 | 2–2.83 | 3–3.61 | 4–4.47 | 5–6.32 | 6.40–7.81 | 8.06–9.90 |
| 20 × 20 | 26.87 | 2–2.83 | 3–3.61 | 4–5.10 | 5.39–8.54 | 8.60–12.81 | 13–26.87 |
| 30 × 30 | 41.01 | 2–2.83 | 3–4.47 | 5–8.06 | 8.25–13.04 | 13.15–19.65 | 19.70–41.01 |

Comments, trend and line picking are [02](02-game-guess-the-number.md) §6.3 through the engine: in the voice of a map and a treasure hunt ("Wrong continent.", "You can almost smell the campfire.", "Next door — knock again!", "Bullseye!"), at least 15 lines per tier and per trend pool (closer/farther), a few season lines per pool ("Snowed in right beside it!"), friendly, no digits, never about a name.

## 8. Season specials ([03](03-seasonal-specials.md))

### 8.1 Spring — Spring Herald: the quarter *(proposal)*

At `opensAt` the hint names the grid quarter of the secret: the west half is columns 1 … ⌈W/2⌉, the north half rows 1 … ⌈H/2⌉ (as 03 §2.1's lower half). "Free hint: the target is in the north-west quarter (columns 1–10, rows 1–10)." Shared: one hint for everyone and spectators; individual: each player their own quarter, spectators "Spring Herald: everyone received a hint" (03 §2.1). The quarter's empty tiles are tinted a clear green, the same in both themes (ink 8.5:1 on it), with a small "Hint" tag in the quarter's tile at the grid's corner (left out while that tile is guessed or fallen); filled tiles keep their fill, and the tint never looks like the hatch of fallen tiles or the faded area outside a halving (O51). The hint line stays in the game's panel all round; the list does not repeat it. `spring.hintType` does not apply. Intro and info sentence (`GameText.specialRule`): "Everyone learns which quarter of the grid hides the target."

### 8.2 Summer — Heatwave; Winter — Frost

Platform features, unchanged ([03](03-seasonal-specials.md) §2.2, §2.4). Under Frost the held own tile (§6) and the list row say the answer is arriving.

### 8.3 Autumn — Leaf Fall *(proposal)*

Every `autumn.intervalS`, `autumn.count` tiles fall (default 10), drawn uniformly with the DRBG under `leafFall/<k>` from the **candidates** (owner, decision 37; engine rule 04 §4.7). A tile `c` is a candidate when all hold:

1. `c` lies in the current window (shared mode; the whole grid without halving), or in individual mode in at least one player's current window;
2. `c` has not fallen, is no player's secret, and no player has guessed it in this round (any visibility, as DECISIONS T111);
3. only with a shared secret and visibility `full`: for every answer delivered before the Frost cut `releasedBefore` to a guess `g`, `c` gets the same answer from `g` as the secret did — in `direction` mode the same rounded distance, the same direction by the §5 rule and the same tier; in `distance` mode the same rounded distance and tier, whatever the direction (owner decision 43); in `closeness` mode the same tier by the §7 table with `c` in place of `s`. The tier counts in every mode because it is shown as the tile's colour and one rounded distance can span two tiers. With `own`, `numbers` or in individual mode no answer is public and rule 3 does not apply.

Falls stop when fewer than `autumn.minCellsLeft` candidates (default 10) would remain; the last fall removes only as many as that allows. Fallen tiles are hatched on every grid (a pattern, not colour alone), listed in the Fallen tiles panel and named in the special's list row ("Leaf Fall: 10 tiles fell."); a fallen tile is refused at no cost (§4, check 5). With `full`, falls lie where the target can still be: accepted by owner decision 37 ([03](03-seasonal-specials.md) §2.3). Intro and info sentence: "Every so often, some tiles without a target fall off the grid."

### 8.4 Halving *(proposal)*

Offered on a real halving day as [03](03-seasonal-specials.md) §4. Every `halving.intervalS` the current window `w × h` (at first the whole grid) is replaced by one of about half the area: the longer side is halved, rounded up (width on a tie). Its position is drawn uniformly with the DRBG under `halving/<k>/<shared|playerId>` among all positions of that size that lie inside the current window and contain the secret, so the secret is always inside and not predictably central. Halving runs only while the current area is larger than `halving.minCells` (default 16; on 20 × 20: 10 × 20, 10 × 10, 5 × 10, 5 × 5, 3 × 5). Shared: one window for everyone, spectators included; individual: each player's own window around their own secret, the same size for all, and the room line says only the size ("Halving: every target area is now 10 × 20 tiles").

- **Shown window:** the whole grid stays shown (no zoom, O45); the tiles outside the window are dimmed, and a line in the game's panel names the window ("Target area: columns 6–15, rows 1–20"); before a halving no line repeats the grid's size (O51). Guesses and fallen tiles outside it stay visible but dimmed.
- **Guesses** outside the window: `OUT_OF_MAP` (§4); the selection is clamped to the window.
- **With Leaf Fall:** halving runs first at the same instant (03 §1 rule 6); candidates count only inside the window(s), so a halving can end the falls by the `autumn.minCellsLeft` stop; fallen tiles inside the window stay fallen.

## 9. Winning, closest miss and the result

Winning, placings, margin and points are [02](02-game-guess-the-number.md) §8–§9. End line: "Walter hit the target first — after 9 guesses." The **closest miss** (shared, with a winner and no second hit in the margin window, owner decision 22) is the wrong guess of another player with the smallest `n`, the earlier on a tie *(proposal)*: "Closest miss besides the winner: Anna, right next to the target (13, 11)." when it touches, else "Closest miss besides the winner: Anna, 3 tiles away (9, 10)."

The **result grid** is the same tile grid, square and as tall as the result screen's box leaves free (the round's board box and measuring, O51): the secret tile ringed in the season colour, its coordinates in text ("Target: column 12, row 10"), and every guess of the round on its tile (filled, framed or marked as in §6; nothing is secret any more), the legend and the fallen tiles hatched. Individual mode: the viewer's grid shows their own target and their own guesses (another player's answers are about their own target); every player's target and guesses are listed in text, as 02 §9.

## 10. What a spectator sees

As [02](02-game-guess-the-number.md) §11, with the grid: others' tiles at shared `numbers` (corner marks) and `full` (filled by their answers), none under `own` or in individual mode; fallen tiles hatched; the shared quarter tinted and the shared window (tiles outside dimmed); individual: only the count or size lines; never a secret tile, an individual quarter or an individual window. The spectator's grid fills the stage like the player's input.

## 11. Player screen

Layout, top bar, banner, list, intro and accessibility follow [02](02-game-guess-the-number.md) §12 and the round's focus mode (O46); the grid is the input and takes the round's stage *(proposal)*:

- **One screen** without a page scrollbar at 1280 × 720 and 390 × 844, light and dark; only the list scrolls inside its box.
- **Grid:** one CSS grid of square tiles, as large as the stage allows: the platform hands the input its stage (the left column at full height) and the input draws the grid there through a portal (O51); the grid box is a size container and the grid the smaller of its width and height, square; no viewport arithmetic. On the 20 × 20 grid that is about 30 px a tile at 1280 × 720 and about 47 px at 1920 × 1080. The whole grid is always shown (no zoom). Numbers are left out on tiles under 20 px (`NUMBER_MIN_PX`, O51, measured with a ResizeObserver): those show colour and marks only; the tooltip, the label and the loupe still give the numbers.
- **Selection:** a click or tap selects the tile; the marker is a thick outline outside the tile in the text colour (unlike the own frame inside it). The selection is local only: nothing is sent until Guess. The grid is focusable as one stop (`aria-activedescendant` names the selected tile): the keyboard arrows move the selection, Enter guesses.
- **Coordinates as text:** "Selected: column 12, row 7" above the Guess button, read out live (`aria-live="polite"`). On a desktop the compact **Column** and **Row** fields and four arrow buttons N, W, E, S (44 × 44 px, "Move north" … for screen readers) are a second way to aim, behind a **Type coordinates** toggle, closed at first (Escape closes it, O51). During the cooldown the Guess button reads "Wait 6 s" (`buttonText`, T125).
- **Phone and loupe:** on a narrow viewport (under 900 px) or with a coarse pointer, and tiles smaller than 44 px, the whole grid stays visible and the first tap opens a **loupe** over it: about 5 × 5 tiles around the tap (clamped at the edges), each at least 44 px, with the same fills, numbers and marks. A tap in the loupe selects that tile; the loupe holds the Column and Row fields, the arrow buttons and a Close button (Escape closes it too); its window stays put while the selection is inside it and follows once the selection leaves. Guess, always visible outside the loupe, sends and closes it. With tiles of 44 px or more a tap selects directly. Outside the loupe a phone shows no fields or arrows, for space.
- **Desktop (O51):** the stage on the left at full height holds only the grid; the 320 px right column holds, top to bottom, the game's panel (legend, window line after a halving, hint, Fallen tiles), the guess list and the input row (selected tile; cooldown ring and Guess; a refusal; the Type coordinates toggle). No grid-size line and no "Last guess" line: the grid and the list carry them. **Phone:** the slim bar, the compact game panel, the list's newest rows, the stage with the grid taking the rest of the height, and the input row at the bottom. The Fallen tiles panel is a "Fallen (N)" button that opens a sheet, as DECISIONS T115.
- Never colour alone: own tiles by frame, others' by corner mark and name, fallen tiles by hatch, answers always in words on the tile's label and in the list.

## Decided while building (proposals)

- (night 4) Tiers are decided in whole numbers (10 000 · n against p² · D², and n against the minimum), so no tile is placed by float rounding.
- (night 4) A server `OUT_OF_MAP` for a tile inside the grid reads "outside the target area"; the input checks fallen and repeated tiles locally and keeps the selection inside the target area.
- (night 4) In individual mode Spring Herald also sends the room a line "everyone received a hint" (`HintGiven` with `quarter: null`).
- (night 4) The secret is stored with the round's answer rule (feedback mode and grid size) beside its tile, because the engine's `answer(value, secret)` gets no state; only the tile ever reaches a view, after the end.
- (night 5) Tiles take each player's list colour and name from the panel props (`names`, `colors`); "Another player" is gone.
- (O45) The tier table gained a minimum in tiles per tier (§7): with shares alone, `hot` and `burning` could not occur below about 30 × 30 and an 8 × 8 grid had no `warm`. The action schema takes 1–30 per coordinate. The conformance kit plays on the largest grid, 30 × 30.
- (O51) Every sentence a player sees says tiles and grid: the refusals, the answers ("9 tiles away"), Leaf Fall's line, the Fallen tiles panel and the closest miss; internal names and event types keep "cell" (`CellsFell`, `CELL_REMOVED`).
- (O51) The list rows carry the answer's own tier, prefixed `st-` (`data-tier="st-warm"`), so the game's styles colour only its own answers in the platform's list; the comment's tier (null with comments off) is not used for it.
