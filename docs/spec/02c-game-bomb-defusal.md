# 02c — Game Design: Seasonal Bomb Defusal

> Part of the Seasonal Mini Games specification. Index: [README](README.md).
> Game id `bomb-defusal`, name "Seasonal Bomb Defusal" (owner, decision 38). Everything not written here is as in [02](02-game-guess-the-number.md) and comes from the shared guess engine ([04](04-software-architecture.md) §4.7). Every game rule below was proposed by the architect on 2026-11-01 and is built as written: it is marked *(proposal)* and listed in [OPEN](../OPEN.md) to confirm after the owner has played. Every number is a setting with a default, a minimum and a maximum ([08](08-admin-settings.md)); the value shown is the default.

## 1. The game in one paragraph

A bomb has a few wires of different colours. The server picks a secret **order** in which some of them must be cut. A player sends a whole cutting sequence at once; the server answers how many cuts **from the start** were right ("The first 2 cuts were right"). If even the first cut was wrong, the bomb **explodes**: the screen shows an explosion and the player waits a little longer before the next sequence (owner, decision 40). The timing is fast mode with a per-player cooldown (02 §1, owner decision 3); the secret is shared or individual, and the first correct sequence received wins (owner, decisions 4 and 5) *(proposal for every rule of this game)*.

## 2. Matches and rounds

- A match is always one game, chosen by the host when creating the match (owner, decision 41). The match lifecycle, its end, the waiting area, the Quick Test, the roster, team matches and the host playing along are those of 02 §2 and §4 (owner, decisions 16, 23, 24, 26–28, 34, 36).
- The explosion penalty is chosen on the match form and holds for every round of the match (owner, decision 40); all other settings are chosen per round (§3).
- **Dev bot** *(proposal)*: keeps the sequences still consistent with its own answers and sends one of them, chosen with the round's randomness, when its cooldown ends, with the human-like delay of [09](09-testing-strategy.md) §5.

## 3. Round settings

Inherited unchanged from 02 §3: secret mode, cooldown, season, season special, season teams, feedback visibility, closeness comments, countdown, longest round. Range, show range and halving do not exist in this game (§8.5). Its own:

| Setting | Values | Default | Source |
|---|---|---|---|
| Wires `bomb.wires` | 4 – 8: the first N colours of the palette red, blue, yellow, green, white, black, orange, purple, in that order | 6 | *proposal* |
| Cuts `bomb.cuts` | 3 – 6, at most the number of wires | 4 | *proposal* |
| Explosion penalty `bomb.explosionPenaltyS` | 0 s – 30 s, whole seconds, per match | 5 s | 0 s allowed and the host chooses: owner, decision 40; default and maximum *proposal* |

**Secret** *(proposal)*: an ordered choice of `cuts` different wires of the round, uniform over all such orders (6 wires, 4 cuts: 360 orders), drawn with the round DRBG under `secret/shared` or `secret/<playerId>` (04 §5.4). **Intro line**: "Shared bomb: 6 wires, 4 cuts" / "Everyone defuses their own bomb: 6 wires, 4 cuts".

## 4. Guessing

The action is the shared guess intent with `{ value: ["red", "blue", "green", "white"] }` (zod-validated, [05](05-security-threat-model.md)); nothing is sent per tap. A sequence is accepted only if all of these hold, in this order; the first failure decides the code (02 §5.1) *(proposal)*:

| # | Check | Code | The player reads |
|---|---|---|---|
| 1 | The round is open | `ROUND_NOT_OPEN` / `ROUND_OVER` | as 02 §5.1 |
| 2 | On the roster | `NOT_IN_ROUND` | as 02 §5.1 |
| 3 | Individual mode: not solved yet | `ALREADY_SOLVED` | as 02 §5.1 |
| 4 | Exactly `cuts` entries, each a wire of this round, none twice | `SEQUENCE_INVALID` | "Choose 4 different wires of this bomb." |
| 5 | No wire Leaf Fall marked harmless (§8.3) | `WIRE_HARMLESS` | "That wire is harmless — it is not part of the sequence." |
| 6 | Not the same sequence as an earlier one of this player (`round.repeatGuessRejected`) | `ALREADY_GUESSED` | "You already tried that order." |
| 7 | Cooldown over, the explosion penalty included (§5.2) | `COOLDOWN_ACTIVE` | "You can cut again in 4 s." |

A rejection costs nothing and tells nothing (02 §5.1). A sequence that only shares a start with an earlier one is not a repeat. Receive order is 02 §5.2.

## 5. Feedback and the explosion

### 5.1 The feedback rule *(proposal)*

For an accepted sequence `g` and the guesser's secret `s`, the answer is `{ correct: k }`: the largest `k` with `g[1..k] = s[1..k]`. Solved when `k = cuts`. A right wire in a later place counts for nothing once an earlier cut is wrong. The answer, its tier and its comment go to the guesser, held by Frost like every answer (02 §6.1, 03 §2.4).

**Worked example** (6 wires, 4 cuts, cooldown 10 s, penalty 5 s; secret red → blue → yellow → white):

| Sequence | `correct` | Player reads | Tier |
|---|---|---|---|
| red, blue, green, white | 2 | "The first 2 cuts were right." (white in place 4 does not count) | burning |
| blue, red, yellow, white | 0 | "Boom! The first cut was wrong. +5 s waiting time." Next cut at receive time + 15 s | wayOff |
| red, blue, yellow, black | 3 | "The first 3 cuts were right." | justMissed |
| red, blue, yellow, white | 4 | "Defused!" | correct |

### 5.2 The explosion (owner, decision 40)

- **When:** exactly when `correct = 0`. With Spring Herald (§8.1) a player who cuts the hinted wire first never explodes *(proposal)*.
- **Penalty:** the server adds `bomb.explosionPenaltyS` to that guess's cooldown through the accepted decision's `extraCooldownMs` (04 §4): `cooldownEndsAt = receivedAt + cooldown in force + penalty`. The same amount for every player, decided by the answer alone; with 0 s there is an explosion but no extra wait. Heatwave changes only the cooldown, never the penalty, and its 3 s floor applies to the cooldown (03 §2.2) *(proposal)*.
- **Frost:** the penalty is not delayed, because the cooldown is not (03 §2.4): it is added at once, as one platform cooldown end sent with the acceptance (DECISIONS T120); no special case for this game. **Residual risk** *(proposal, OPEN)*: under Frost the guesser's own cooldown ring shows the penalty before the answer arrives, so that player alone knows of a wrong first cut up to `winter.delayS` early; and where the platform shows other players' cooldown state (02 §11), a longer cooldown of another player may be noticed.
- **Animation** *(proposal)*: on the guesser's screen only, when the answer arrives: about 1 s of flash and shake over the main area with the explosion icon and "Boom!", then the row in the list. Never more than three flashes a second (WCAG 2.3.1). With `prefers-reduced-motion`: one static flash frame (tinted panel, icon, "Boom!") for about 1 s, no movement. Meaning is carried by the icon and the words, never by colour alone. Sound off by default (02 §12).
- **What others see** *(proposal)*: an explosion is feedback, so others see it exactly where they see the answer (§6): under `full` the row reads "Anna: blue → red → yellow → white — Boom!" with the explosion icon and its comment, without animation; under `own` and `numbers`, and in individual mode, no sign of it (the roster stays as 02 §11; see the residual risk above).

## 6. What others learn

As 02 §6.2 with the sequence in place of the number (owner, decision 8): `own` — "Anna cut a sequence — not defused."; `numbers` — also the sequence; `full` — also "The first 2 cuts were right." (or Boom), the explosion icon and the comment. Individual mode: only "Anna cut a sequence", plus solves and placings. Spectators see what `numbers` or `full` allow (§10).

## 7. Closeness tiers and comments *(proposal)*

Fixed rule, not settings: `correct` when `k = cuts`; `justMissed` when `k = cuts − 1`; `wayOff` when `k = 0` (the explosion lines). The values `k = 1 … cuts − 2` are spread evenly over the five tiers cold, cool, warm, hot, burning (index 0–4): with `cuts = 3`, `k = 1` is cold; otherwise the index is `round(4 · (k − 1) / (cuts − 3))`, rounded to the nearest whole number, so `k = 1` is always cold and `k = cuts − 2` always burning. What that gives:

| Cuts | k = 0 | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|---|
| 3 | wayOff | cold | justMissed | correct | | | |
| 4 | wayOff | cold | burning | justMissed | correct | | |
| 5 | wayOff | cold | warm | burning | justMissed | correct | |
| 6 | wayOff | cold | cool | hot | burning | justMissed | correct |

Every tier occurs at some number of cuts. Comments, trend lines (`comments.trendPercent`), the no-repeat choice and who sees them are 02 §6.3 (owner, decision 21). The catalogue in the game module: at least 15 lines per tier and per trend pool in a bomb voice ("Boom. That was the loud one.", "Steady hands — almost there.", "One wire away from glory."), a few per season ("Cool hands, cold wires." in winter), no digits, never insulting.

## 8. Specials per season

### 8.1 Spring — Spring Herald *(proposal)*

At `opensAt` the free hint names the first cut's colour: shared mode one hint to everyone, spectators included ("Free hint: cut red first."); individual mode each player about their own bomb, spectators see "Spring Herald: everyone received a hint" (03 §2.1). The hint stays highlighted in slot 1 of the sequence (§11). `spring.hintType` does not apply.

### 8.2 Summer — Heatwave

Platform feature, unchanged (03 §2.2). The explosion penalty is added on top of the cooldown in force and is never shortened (§5.2).

### 8.3 Autumn — Leaf Fall (owner, decision 42)

Every `autumn.intervalS` **one** wire that is not part of the sequence is **marked harmless**, chosen uniformly with the round DRBG under `leafFall/<k>` from the **candidates**: the round's wires minus the wires already marked and minus every wire in any secret of the round (shared: the one sequence; individual: every roster player's), so no secret wire is ever marked. Whether anyone has cut a wire, and every answer, play no part (decision 42 replaces the decision-37 candidate rule for this game). `autumn.count` and `autumn.minRemaining` do not apply, and the game has no setting for the number of wires per fall. The fall that marks the last candidate also adds one event row "Leaf Fall: every harmless wire is marked." and the falls end; the line appears only then. With a shared secret of 6 wires and 4 cuts there are two harmless wires in all, marked by the first two falls. In individual mode, with several players, there is often no wire that is in no bomb from the start: then no fall marks anything and no line appears *(proposal)*. One set of marks for everyone, at one moment (03 §1). A sequence with a marked wire is refused at no cost (`WIRE_HARMLESS`); the client says so without sending it. Banner and row: "Leaf Fall: the orange wire is harmless." on the season's tint with the season icon (02 §12).

### 8.4 Winter — Frost

Platform feature, unchanged (03 §2.4): answers, comments and explosions arrive `winter.delayS` late; the row says "answer arriving in 2 s". The explosion penalty is not delayed, because the cooldown is not (§5.2).

### 8.5 Halving

None. On a halving day this game runs a normal season round of that season, as owner decision 29 does for a hidden range; the host form does not offer the option *(proposal)*.

## 9. Winning, closest miss and the result page

- Winning, placings, end conditions, winning margin, points, leaderboard and fairness proof are 02 §8–§10. The seed reproduces every secret, the Spring hints and the Leaf Fall marks.
- **Reveal:** the secret sequence as numbered wire chips (swatch and name); in individual mode every player's sequence in the result.
- **Closest miss** (owner, decision 22; shared mode with a winner and no margin line): the other player's wrong sequence with the longest correct start, the earlier receive order on a tie: "Closest: Anna, the first 3 cuts right (red → blue → yellow → black)." With a best start of 0 there is no line: an explosion is not a near miss *(proposal)*.

## 10. Spectator view

As 02 §11, with these differences *(proposal)*: visible are the wires of the round, the number of cuts, the marked harmless wires, the explosion penalty, and the round's list at the visibility of §6; a roster row shows the number of cuts and "cooling down" or "ready" as 02 §11. Never visible before the end: any secret sequence, any answer or explosion outside shared `full`, and individual Spring hints.

## 11. Player screen

Inherited from 02 §12: intro card, top bar, banner above the list, the one list, host menu, team tiles, chat, plain English, WCAG 2.2 AA. Own *(proposal)*:

- **Bomb block** (desktop: top of the right column; phone: compact line under the top bar): "6 wires, cut 4 in the right order", the explosion penalty ("Wrong first cut: +5 s"), the free hint, and the harmless wires as chips with a crossed swatch and a struck name.
- **Sequence slots:** `cuts` numbered slots ("1", "2", …) above the wires, at least 44 px tall; a filled slot shows swatch and colour name; slot 1 shows the free hint as a highlighted outline with "hint: red", which wraps rather than being cut off on a phone.
- **Wire buttons:** one per wire, colour swatch plus colour name, at least 44 × 44 px, in palette order. Tapping appends to the next free slot. A wire already in the slots is disabled and shows its slot number; a harmless wire is disabled with a crossed, dimmed swatch, a struck name and the accessible label "red, harmless" (no word "harmless" inside the button, so nothing overflows). Swatches have a border of 3:1 against the background (white and black included); every label meets 4.5:1 in light and dark. Never colour alone: every wire, chip and list entry carries its name.
- **Undo** removes the last slot, **Clear** empties all, **Cut** sends; Cut is enabled only with every slot filled, the cooldown over and no cut on its way, and reads "Wait 6 s" during the cooldown (DECISIONS T125). A wire marked harmless while in the slots stays there, marked, with "The orange wire is harmless now — take it out." The sequence survives the round opening and is cleared only when its answer arrives (as DECISIONS T76). Keyboard: Tab and Space, keys 1–8 for the wires in order, Backspace = Undo, Escape = Clear, Enter = Cut.
- **List rows:** name, the sequence as small chips with names, "The first 2 cuts were right." ("The first cut was right.") in text (or the explosion icon and "Boom!"), the comment under it; own rows tinted as 02 §12.
- **Desktop 1280 × 720:** the list fills the left column (at least 12 rows, owner decision 35); under it the input area: slots, wire buttons in one row (two rows of four with 8 wires), and the cooldown ring with Undo, Clear and Cut; right column as 02 §12 with the bomb block in place of the range block.
- **Phone 390 × 844:** top bar, bomb line, the list filling the height left (the only thing that scrolls), team tiles and Chat, then pinned at the bottom: slots in one row, wire buttons (at least 44 px tall) in two even rows of up to four (3 + 3 with six wires, 4 + 4 with eight, 3 + 2 with five, 4 + 3 with seven; one row with four), and a row with the ring, Undo, Clear and Cut.
- Both sizes fit one screen without a page scrollbar, light and dark, with every necessary item visible.

## Decided while building (night 4, proposals)

- The answer carries `{ correct, defused }`; `defused` is correct = cuts, because the guess engine's `solved(answer)` does not see the number of cuts.
- "Leaf Fall: every harmless wire is marked." is its own event (`HarmlessOver`), sent with the fall that marks the last candidate (O42); the next due fall then adds nothing and the falls end.
- The server's `SEQUENCE_INVALID` reads "Choose a different wire of this bomb for every slot."; the input row says "Choose 4 different wires of this bomb." before sending anything.
- Under `own`, other players' rows read "cut a sequence".
- The explosion overlay covers the whole screen for its moment and lets taps through; the row says "Boom!" with the icon in text.
- Cut stays enabled with a harmless wire in the slots: pressing it refuses locally with the sentence of §11 and sends nothing; wire buttons are disabled once every slot is filled.
- `bomb.explosionPenaltyS` is a host round setting like every other: owner decision 40 says the host chooses it, the round form keeps the last choice (OPEN, spec conflicts).
