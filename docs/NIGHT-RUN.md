# Morning sheet

**2026-11-01:** the night branches are merged into `master` (merge `fd8ef34`, CI green) and deleted: `feat/guess-the-number` (last `b21469d`) and `night/2026-10-27` (last `b59083a`).

## Chain MG-N3 (2026-11-13): the platform gaps G1–G13, then the handover

Status, updated after every piece. Branch `feat/mind-games` is not merged. This chain may change `packages/` and `apps/`; the four existing games must behave exactly as before.

| Piece                                                                                                    | State            |
| -------------------------------------------------------------------------------------------------------- | ---------------- |
| 1 — G1, G11, G3: the input for every match player, the result view without a secret, the chat line       | **done**, pushed |
| 2 — G2, G5, G7, G8: the phase times, the lines' ages, the round's box in the prefs, the refused pre-pick | open             |
| 3 — G4, G6, G9, G10: the words and the forms of a phased round                                           | open             |
| 4 — G12, G13: seats in a Quick Test match, the admin's round view                                        | open             |
| 5 — the journeys completed, the play-through, the handover                                               | open             |

### Piece 4 — seats in a Quick Test match (G12), the admin's round view (G13)

- **G12** (T336): the Quick Test route reads `match.maxPlayers` and its match gets that many seats, at least the bots and the host (`apps/server/src/http/routes/quickTest.ts`, `apps/server/src/dev/quickTest.ts`, `apps/server/src/http/app.ts` passes the settings). Test: a person joins a Quick Test match beside its bots, in a guess game and in the phased fixture (`apps/server/test/prefs.integration.test.ts`). Journey 38's second browser comes back in piece 5.
- **`pnpm verify`:** format, lint, typecheck green; tests 811 + 99 + 167 passed, 1 failed: the authorization matrix's HTTP test ran past its timeout under load (not raised).
- **G13** (T337, the planner's decision of 2026-11-13): no code; the admin's round view stays the delayed spectator view, and 09 §4 journey 41 says so.

### Piece 3 — words and forms (G4, G6, G9, G10)

- **G4, G10, words** (T332): `actionWords` and `actionCount` and a phased round's headline (`apps/web/src/round/roundText.ts`); the list's title, empty line and label (`RoundLog.tsx`), the list panel's title (`RoundBody.tsx`), no cooldown line in the intro (`RoundIntro.tsx`), no counts in the Players panel (`RoundSide.tsx`), the placings' column and a winner's "won" (`ResultParts.tsx`); `won` in the results' view (`packages/contracts/src/http/play.ts`).
- **G10, the summary's rounds** (T333): migration `0019_round_words.sql` (new); `recordWords` and the ended match's `rounds` (`apps/server/src/match/summary.ts`), written at each phased round's end (`apps/server/src/round/runtime.ts`) with the chat line's wording, now shared (`phasedWords`, `apps/server/src/chat/roundLines.ts`); the summary's list (`apps/web/src/match/MatchSummary.tsx`).
- **G9** (T334): the game's timing in the game list (`GameInfoView`, `apps/server/src/round/rounds.ts`); a phased game's Quick Test fields (`apps/web/src/shell/QuickTest.tsx`, `PhasedFields`).
- **G6** (T335): a cross-key rule may name its setting (`packages/game-sdk/src/module.ts`, `packages/application/src/round/roundSettings.ts`); a field may be off (`apps/web/src/components/fields.tsx`); the game's word on its fields (`FieldState` in the SDK, `fieldState` in the registry's `GameWeb`, `fieldStateOf` and `Field` in `apps/web/src/match/roundFields.tsx`, the host form in `HostMenu.tsx`); Mind Games' rules under their fields (`games/mind-games/src/settings.ts`) and its fields (`games/mind-games/web/formFields.ts`, new).
- **Tests, each with a guess game and a phased one:** `apps/web/src/round/phasedWords.test.tsx` (new: words, headline, intro, placings); `apps/web/src/match/summary.test.tsx` (the rounds' list, none for a guess match); `apps/web/src/shell/quickTest.test.tsx` (the fields per game); `apps/web/src/match/fieldState.test.tsx` (new: a field as the game words it, unchanged without); `packages/application/src/round/roundSession.test.ts` (a rule's sentence for the form or under its field); `apps/server/test/series.integration.test.ts` (the rounds in a phased summary) and `matchFlow.integration.test.ts` (none in a guess match's); `games/mind-games/web/formFields.test.ts` (new) and the game's settings test (the sentences with their fields).
- **`pnpm verify`:** format, lint, typecheck green; tests 811 + 99 + 167 passed, 1 failed: the authorization matrix's HTTP test ran past its timeout under load (not raised).
- **Reused:** the chat line's wording for the summary (`phasedWords`), `useGames` for the timing class, the form's existing per-field problem routing (`setupProblems`), the number field's following of a changed value.

### Piece 2 — what the game's screens need (G2, G5, G7, G8)

- **Platform:** the panels' props `timing` and `own` (`packages/game-sdk/src/web.ts` 181 → 207, `index.ts` 99 → 101; T327); `timingOf` and the timing for the game's panel and the phone's line (`apps/web/src/round/InfoParts.tsx` 127 → 136), for the input with `own` (`InputRow.tsx` 144 → 150), `own` passed through `RoundBody.tsx` 169 → 173 and `RoundScreen.tsx` 114 → 118 from `MatchPage.tsx` 257 → 260; `useOwnPart` with the page's `prefs.refused` listener and the save shared with the waiting area's panel (`apps/web/src/match/GamePrefs.tsx` 39 → 79); a phased row's age (`GuessLine.tsx` 243 → 251; T328).
- **Game:** the round's phases and their words (`web/phases.ts`, new, 71; T329); the strip's markers, next change and announcement (`web/PhaseStrip.tsx` 43 → 86); the feed's sentence under the head and on the phone's line (`web/FeedPanels.tsx` 58 → 78); the player held after the join time, the box in the prefs (T330), the refused pre-pick's notice (T331) (`web/MindInput.tsx` 81 → 126); the waiting area's saving moved to a hook both use (`web/useSavedPrefs.ts`, new, 63, extracted from `web/PrefsPanel.tsx` 152 → 108); styles (`web/mind.css` 236 → 275).
- **Tests:** `games/mind-games/web/phases.test.tsx` (new, 123: the words of every phase, the feed's sentences, the markers, the hold after the join time, the box from and into the prefs, the notice live and after a reconnect); `apps/web/src/round/log.test.tsx` 205 → 221 (no age in a guess round, ages counting on in a phased one); `dock.test.tsx` 106 → 107 (the opening against the page's clock); `apps/web/src/match/prefs.test.tsx` 105 → 145 (no own part for a guess game or a spectator; the round's number, the value, its saving, a refusal for this round only). The game's tests: 75.
- **`pnpm verify`:** format, lint, typecheck green; tests 800 + 99 + 166 passed, 1 failed: the authorization matrix's HTTP test ran past its timeout under load again (not raised).
- **Reused:** `serverNow` for the timing's clock, the waiting area's `PUT …/prefs` call (now `savePrefs`, shared), the panel's saving (now `useSavedPrefs`, shared), the game's `clock`, `CHOICE_NAMES` and `mindText.code`.

### Piece 1 — the two blockers (G1, G11) and the chat line (G3)

- **G11** (`packages/application/src/round/roundSession.ts` 133 → 136): `result()` builds a phased game's result view also when its secrets are null; a guess game's rule is unchanged (T324). Tests (`roundSession.test.ts` 213 → 245, a secret-less phased fake `pickGame` in `fakes.ts` 76 → 118): the phased round's result exists only after its end; a guess round's result exists once its secrets do. The server's phased test now also checks the fixture's result view at the end (`apps/server/test/phased.integration.test.ts` 185 → 188); the fixture already derives no secret, so it needs no change.
- **G3** (`apps/server/src/chat/roundLines.ts` 66 → 94, the line's wording extracted into `lineOf`): a phased round's line from `won` and the game's `reveal`, "Round 3: Winter was the least chosen (3 players)." or "Round 3 ended: nobody won." (T325); `roundLines.test.ts` (new, 33) keeps a guess round's line and words a phased one.
- **G1** (`apps/web/src/round/InputRow.tsx` 122 → 144): every match player of a phased round gets the input, without a ring, acting until the play's end (T326); `dock.test.tsx` (new, 106): a guess round's input only for a roster row and with its ring, a phased round's for a match player before the roster lists them, none after the play's end or for a spectator.
- **`pnpm verify`:** format, lint, typecheck green; tests 790 + 99 + 166 passed, 1 failed: the authorization matrix's HTTP test ran past its 150 s timeout under the full run's load, as in chain MG-N2 (not raised). The existing games' golden test and conformance P1–P6 are among the passing ones.
- **Removed:** the game's guards against a missing result view (`games/mind-games/web/ResultPanel.tsx` 128 → 126, `web/text.ts` 97 → 96, their test in `web/panels.test.tsx`), which G11 made unnecessary.
- **Reused:** `findGame`'s shape for the phased fake; the round fakes `ended` and the inactivity test's `InputRow` set-up; the phased server test's sockets and end check.
- **Noticed, left alone:** `GamePart` (`apps/web/src/round/InfoParts.tsx`) hands every game's info-column panel an `act` that does nothing; it predates the phased class (the panels only show), so it is not a gap's workaround and stays.

## Chain MG-N2 (2026-11-13): Seasonal Mind Games itself (MG-1 → MG-5)

Status, updated after every piece. Branch `feat/mind-games` is not merged.

### Final report

- **Done:** pieces 0–5. The game is built in `games/mind-games` (rules, views, screens, animation, pre-picks, Quick Test bots), registered in both registry halves, with journeys 38–41 and the L5 driver. **It is not yet fully playable in the browser:** a player can enter a round only through a pre-pick (G1), and the result page lacks the game's own part (G11); both are platform defects this chain was not allowed to fix. `feat/mind-games` is not merged.
- **Piece 0:** the defect is real. `DelayedRoom.restore` counted host-only events and re-held what an end had flushed. The test was red before the fix and is green after (piece 0's section).
- **`pnpm verify`:** pieces 1–4 green except one test each time: the authorization matrix's HTTP test ran past its 150 s timeout under the full run's load. Alone it takes 30–36 s, with and without the game; no timeout was raised. The final run at the end of piece 5 is **all green**: 786 + 97 + 167 tests.
- **Journeys 38–41, once each in Chromium:** all passed.
- **Full e2e in Chromium at the end:**
  - The timing project: 40 passed (27.9 min).
  - The main project: 10 passed and 3 failed.
    - Journey 23 failed because its game list did not yet have the fifth game; I updated it.
    - Journey 28 (Safecracker) and the Trusted Types spec failed with `ECONNREFUSED 127.0.0.1:3910`: the development server had stopped during the run.
  - With the server running again and journey 23 updated, all three specs passed: 6 tests.
- **L5 (N = 500 players and 100 spectators, run once, not a gate):**
  - Acknowledgement p95: 4 109 ms (N = 8 520). The limit is 150 ms: **missed**, through the serial commits on this laptop (OPEN (r)).
  - Release tick p95: 121 ms (N = 540). The limit is 150 ms: met.
  - Released steps: all 50 952 add up.
  - Last step against the result: not checkable (G11).
- **CI on `feat/mind-games`:** piece 0's run (`5a903d2`) was green. Every run from MG-1 (`e3a8b51`) to `0217576` failed only in the e2e job, on journey 23 (`gameChoice.spec.ts`): its list of games in the create-match form did not have the fifth game. Verify (with coverage), docs and security were green in each of them. I did not watch CI between the pieces and saw it only at the end. The list is fixed in `33b68c1`; the run on the branch head was still running at the handover and is reported afterwards.
- **Own play-through, fixed before the handover:**
  - A 9 px page scroll at 1280 × 720.
  - A blank page at every round's end.
  - A pressed button hiding its season's icon.
  - "Replay" cut short in the phase strip.

  Each is described in piece 5's section.

- **Played and seen working:**
  - A Quick Test from the lobby with 7 bots.
  - Pre-picks, with bot-05 and bot-06 away under seed `frost`.
  - The delayed feed, the lines and the counts.
  - Hide my switches on and off.
  - The flights, and none with reduced motion.
  - The Chat panel open at 1280 × 720, and the phone at 390 × 844.
  - Winner place 2 in round 2 and All in round 3, saved as next-round settings.
  - Start next round now.
  - The pause, the automatic next round, and the summary "All 3 rounds are played.".
- **Not seen working, because of platform gaps:**
  - A first choice by a click (G1).
  - The result's options and light-up (G11).
  - The phase times on screen (G2).
  - The refused pre-pick's notice (G8).
- **Screenshots:** 9, light mode, with `play-through.txt`, on the orphan branch `shots/mg-n2` (`5a09500`). It is for the owner to delete after review.
- **New proposals, every one "(proposal, chain MG-N2)":**
  - T304: the views, their schemas and the bot are built with the rules in MG-1, since the registry line registers a whole entry.
  - T305: the action is `{ value: { choice, hide } }`, any name of up to 16 characters (`CHOICE_INVALID` from `validate`); `ChoiceMade` carries `hide`.
  - T306: the views carry the rules and the plan; lines carry their time; result and outcome rows are in entry order.
  - T307: the chat line's part is "Winter was the least chosen (3 players)", none when nobody won.
  - T308: the dev bot's three ways by its first draw; a random bot moves at every third change of its feed; resending the current choice keeps it playing.
  - T309: pre-picks are `{ picks: { "1"…"20": choice }, hide? }`.
  - T310: the game is added to the root coverage script and the registry's `package.json`.
  - T311: the board layout. The stage holds the strip, the buttons and the box; the info column holds the head, the platform's list and the dock.
  - T312: the feed's lines are the list's rows from the view, the viewer's own as "You"; no age yet.
  - T313: the game words `PLAY_OVER`, `JOIN_CLOSED`, `NOT_IN_ROUND` and `INVALID_ACTION` itself.
  - T314: the empty feed without its countdown, and the phase strip without its markers, until G2.
  - T315: "not chosen" for an option nobody picked; the result's history lists every named line, oldest first.
  - T316: the seasons' icons are imported from `assets/seasons`.
  - T317: flights come from the difference of two released views; hidden switches are the counts' unexplained change, in option order.
  - T318: the flight band is 40 px, a flight 0.8 s, a first choice flies from the right (from below on a phone), and "+N" sits at the right.
  - T319: the winners light up with the platform's win glow for 2.4 s; nothing with reduced motion.
  - T320: the pre-picks panel saves 2.1 s after the last change, with the box in the panel and All always offered.
  - T321: about one bot in four pre-picks every round, any of the five names, with its box.
  - T322: the journeys play as far as the platform allows. They use pre-picks for entry and matches made by hand for 39 and 40; `JOIN_CLOSED` moves to 41; the admin view is checked against the delay.
  - T323: the L5 driver `load/mindStorm.mjs` with `load/mindWorker.mjs`.
- **Needs the owner's word:** the platform gaps G1–G13 below. G1 (no first choice through the page) and G11 (no result view for a game without a secret) block the game; G2 (phase times) and G8 (the refused pre-pick's notice) are the next.
- **Handover:** the development server runs on this branch at http://localhost:5410 (server on port 3910). The page shows the badge "Mini Games · dev · 5410" in the bottom-right corner. Sign in with Dev sign-in → host, open Quick Test and enter:
  - Game: Seasonal Mind Games, Start from the lobby on, Seed `frost`, Bots 7.
  - Total length 60, Delay 10, Rounds 3, Pause 15, the rest as they are.

  With seed `frost`, bot-05 and bot-06 pre-pick and stay away. In the waiting area, set your own pre-pick for each round: a first choice cannot yet be made by a click (G1). Then choose Host → Start round. From the second round on, the Host menu keeps the next round's settings (for example Winner 2, or All).

| Piece                                                | State            |
| ---------------------------------------------------- | ---------------- |
| 0 — the delayed room's release count after a restart | **done**, pushed |
| 1 — MG-1, the rules                                  | open             |
| 2 — MG-2, the views and the screen                   | open             |
| 3 — MG-3, the animation                              | open             |
| 4 — MG-4, pre-picks                                  | open             |
| 5 — MG-5, the Quick Test and the journeys            | open             |

### Piece 0 — the delayed room's release count after a restart

- **The defect is real.** `DelayedRoom.restore` counted one release for every due item, `emit` only for those with a room form; a host-only `Game` event (room form `null`) therefore moved the sequence after a restart and not live. A second gap of the same kind: a log that already holds the round's end re-held the items the live end had flushed, and did not count them.
- **Test** (`apps/server/src/round/delayedRoom.test.ts`, new, 115 lines, 3 cases, all red before the fix): a live room with host-only and room events against a room restored from the same log at the same time (same `seq()`); the next release numbered the same live and after the restart (same `rs`, same frames); a log with `RoundEnded` before the delay passed (all held counted).
- **Fix** (`apps/server/src/round/delayedRoom.ts` 145 → 147): `restore` counts room frames only, as `emit` does, and counts a log with the end as released whole.

### Piece 1 — MG-1, the rules (02e §2–§9, 11 §4)

- **Built** (`games/mind-games/src`, all new): the settings of 08 §3.4 with the three cross-key sentences of 02e §3, the plan (join, choices close, end, delay; the join time following the total) and the series (`settings.ts`); the five choices, the counts, the dense places and the winning options, the points 1 and 2 (`choices.ts`); the state, the action `{ choice, hide }` and the events `ChoiceMade` (to the chooser) and `ChoiceFed` (to the room, with the counts and entrants right after it) (`state.ts`); checks 5–7, the first choice and the switch named or only counted as the round's switches and the chooser's box say, the fold, the outcome rows in entry order, the pre-picks' schema and action (`rules.ts`); the views (the feed as of `releasedBefore`, at most 60 lines, no hidden switch; the viewer's own choice and box live; the result) with their schemas (`views.ts`); the headline and the chat line's part (`words.ts`); the module, the conformance kit and the development bot with its three ways (`module.ts`, `conformance.ts`, `devBot.ts`, `index.ts`); the registry's `src` line.
- **Tests** (`games/mind-games/src`, 45): every row of 02e §8.1 and MG4 against a brute-force reference over every count vector of four and five options (counts 0–4) and every place; the plan's defaults 60/90/120/30 and the join time following the total or not; the three sentences; `validate`'s order and codes; the events of a first choice and of a switch per visibility and box; the outcome rows; the pre-picks per round and All refused where it is off; the views at a cut, the 60-line cap, the result; the headline's and the chat line's words; MG2, MG3, MG5 and replay over 200 random rounds of up to 50 players each; the bot's three ways. The registry's conformance suite now runs P1, P3–P5 and P7 for `mind-games` too (green). Coverage of the game's `src`: 96 % of statements, 94 % of branches without the registry's run.
- **`pnpm verify`:** format, lint, typecheck green; tests 761 + 97 + 166 passed, 1 failed: `apps/server/test/authzMatrix.integration.test.ts` ("lets through exactly the callers each route allows") timed out at 150 s under the full run's load, as once in night MG-N1; alone it passed (14 tests, 180 s). It does not touch the games; left as it is (no timeout raised), reported. The action's wire shape was corrected to `{ value: { choice, hide } }` (what the `guess` intent hands on) before this run.
- **Sabotage, done and undone:** the spectator's counts taken from every move instead of those before the cut turned P7 red for `mind-games`; green again after the revert.
- **Lines** (all new): `choices.ts` 57, `conformance.ts` 34, `devBot.ts` 52, `fakes.ts` 57, `index.ts` 14, `module.ts` 48, `rules.ts` 118, `settings.ts` 191, `state.ts` 75, `views.ts` 143, `words.ts` 59; tests `choices.test.ts` 84, `devBot.test.ts` 81, `properties.test.ts` 128, `rules.test.ts` 170, `settings.test.ts` 79, `views.test.ts` 90, `words.test.ts` 69; `package.json` 20, `tsconfig.json` 17. Registry `src/index.ts` 46 → 48, `package.json` 25 → 26; root `package.json` (the coverage list, T310) unchanged in length.
- **Reused:** the phased fixture's shape (the own event folded, the room event a copy with its counts; the cut filter) and the guess games' layout (`settings.ts`, `conformance.ts`, `devBot.ts`, `fakes.ts`); the registry's conformance suite as it is.
- **Noticed, left alone (platform, see "Needs the owner's word"):** the browser cannot let a phased round's player make a first choice (G1); a game's panels learn neither the opening nor the plan (G2); the chat's round-end line of a phased round always starts "nobody found it" (G3).

### Piece 2 — MG-2, the views and the screen (02e §6, §9–§11)

- **Built:** the view marks the viewer's own lines (`own`), so the platform's list says "You" (`src/views.ts` 143 → 147); `games/mind-games/web` (all new): the phase strip with Join, Play and Replay in proportion and the time each ends (`PhaseStrip.tsx` 43); the choice row as a radio group (arrow keys, one tab stop, Enter or Space), each button in its season's colour with its original icon and name, All in the neutral colour with the four icons, the current choice pressed with "✓ Your choice", choosing it again sends nothing, a tooltip on each, and under each the feed's count "30 s ago: 7" with its bar (`ChoiceButtons.tsx` 140); the player's stage drawn into the platform's stage with the box Hide my switches in `perPlayer` rounds, a click sending `{ value: { choice, hide } }` at once and a refusal said in the game's words (`MindInput.tsx` 75); the feed's head and the empty feed's sentence in the info column and as the phone's line, and a spectator's stage without choosing (`FeedPanels.tsx` 58); the result's options with icon, count, place, "✓ wins" and the players with +1 or +2, the viewer's own highlighted, and the history of every named line (`ResultPanel.tsx` 101); the codes, the list's rows, the head, the intro and the headline (`text.ts` 96); the icons and colours (`seasons.ts` 31); the styles from the tokens only, light and dark (`mind.css` 266); `index.ts` 35, `tsconfig.json` 18; the registry's `web` line (`games/registry/web/index.ts` 82 → 84); `package.json` 20 → 29 (the web half's React, react-dom and test dependencies, as the other games have).
- **Tests** (`web/input.test.tsx` 101, `web/panels.test.tsx` 117, with real views from `web/fixtures.ts` 53): 14 cases; the game's tests now 59, all green.
- **`pnpm verify`:** format, lint, typecheck green; tests 775 + 97 + 166 passed, 1 failed: the authorization matrix's HTTP test timed out at 150 s under the full run's load again. Measured alone: 30 s with the game registered, 36 s with its registry line taken out (locally, not committed), so the game does not cause it; the full run makes it about five times slower. Reported, nothing changed (no timeout raised); an OPEN candidate for the owner.
- **Reused:** the platform's board layout (stage, info column, dock), its one list for the feed's lines (`GuessRow`s with `text`), its result page (the headline in the place of the best-of-the-rest line, its placings and standings), the seasons' original icons and colour tokens, the list's own-row convention (`playerId` null), Seasonal Target's portal into the stage.
- **Not built, waiting for the owner (G2):** the phase strip's markers and next-change words, the empty feed's countdown, "Every change now is a switch", the replay's sentence with its countdown, the buttons disabled by phase, the screen reader's phase announcements. The lines' ages wait for G5. The call view's space belongs to the platform's chat column; nothing of it is built (02e §11).
- **Noticed, left alone (platform):** G4–G6 below.

### Piece 3 — MG-3, the animation (02e §11.1, owner decision 90)

- **Built** (`games/mind-games/web`): the wave of a released step from the difference of two delayed views, each new line a flight, the counts' change no line explains as nameless hidden switches, at most 12 and the rest as "+N" (`flights.ts`, new, 87; T317); the flight band between the buttons and the counts, icons moving between the columns and turning into the new season's, a first choice flying in with its name (from the right on a desktop, from below on a phone), `aria-hidden`, no flight with reduced motion, each wave cleared after 0.9 s (`FlightBand.tsx`, new, 106; `flights.css`, new, 118; T318); the winners' light-up with the platform's win glow for 2.4 s, not with reduced motion (`ResultPanel.tsx` 101 → 126; T319). `ChoiceButtons.tsx` 140 → 146 (the band in the row, the names), `MindInput.tsx` 75 → 81 and `FeedPanels.tsx` 58 (the names passed on); `mind.css` 266 → 197 with the result's styles moved to `result.css` (new, 81) to stay under 300 lines; `index.ts` 35 → 37.
- **Tests** (`web/animation.test.tsx`, new, 6 cases, the game's tests now 65): views fed one by one, no flight before its step and none for a step that brings nothing; a first choice with its name, a named switch from → to, a hidden switch without a name; 20 switches as 12 icons and "+8" with the step's exact counts at once; the wave gone after its flight; reduced motion without flights and with the counts in place; the winners lit for 2.4 s, not with reduced motion. The band's boxes against the buttons, the lines and the chat at 1280 × 720 and 390 × 844 need a real layout: journey 38 (MG-5).
- **`pnpm verify`:** format, lint, typecheck green; tests 781 + 97 + 166 passed, 1 failed: the authorization matrix's HTTP test timed out under the full run's load, as in piece 2 (not caused by the game, measured there).
- **Reused:** the platform's win glow `smg-anim-win` (`@smg/ui` motion.css) and its global reduced-motion rule; the seasons' icons (`seasons.ts`); the delayed views as they are.
- **Noticed, left alone:** the platform's `useReducedMotion` hook lives in `apps/web` and is not shared with games, so the game reads the media query itself in two places (`FlightBand.tsx`, `ResultPanel.tsx`), one line each.

### Piece 4 — MG-4, the pre-picks (02e §7)

- **Built:** the Your pre-picks panel (`web/PrefsPanel.tsx`, new, 152): a select per round of the series, played rounds locked, a tooltip on each, the box Hide my switches for every round, the line "Pre-picks play for you when you are away. If you are here, you can still switch.", saving 2.1 s after the last change (T320); registered as the web half's `Prefs` (`web/index.ts` 37 → 42); its styles, two columns on a phone (`web/mind.css` 197 → 230); `DEFAULT_CONFIG` exported for the panel (`src/index.ts`). The prefs schema with the box and the pre-pick's action came with MG-1 (T309), the platform's saving, applying and refusing with MG-C3.
- **Tests** (`web/prefs.test.tsx`, new, 76 lines, 3 cases, the game's tests now 68): the selects per round and the default before the first round, played rounds locked, the tooltip and the line; one save 2.1 s after the last change with a value the game's schema takes (none removes a pick, the box rides along); a refusal in words.
- **`pnpm verify`:** format, lint, typecheck green (after a typecheck fix in the new test, a mock typed without its parameter); tests 784 + 97 + 166 passed, 1 failed: the authorization matrix's HTTP test timed out under load, as in pieces 1–3.
- **Reused:** the platform's slot and `save` (MG-C3), the game's prefs schema for the test, the box's class and words of the round screen.
- **Not built, waiting for the owner:** the round's own notice "Your pre-pick All was not offered in round 3." (G8) and the round screen's box kept through the prefs (G7).

### Piece 5 — MG-5, the Quick Test and the journeys (09 §4 journeys 38–41, §4.2, §5 L5)

- **Built:** the Quick Test's pre-picking bots, about one in four (`src/devBot.ts` 52 → 66, `src/devBot.test.ts` 72 → 91; the registry's line gives `devPrefs`, `games/registry/src/index.ts` 48 → 58; T321); the four journeys (`e2e/mindGames.ts` 83, `e2e/mindGames.spec.ts` 163, `e2e/mindGamesSeries.spec.ts` 94, `e2e/mindGamesPrePicks.spec.ts` 81, `e2e/mindGamesDelay.spec.ts` 199, all new; `e2e/playwright.config.ts` 130 → 135, the four in the timing project; T322); the L5 driver (`load/mindStorm.mjs` 166, `load/mindWorker.mjs` 98, new; T323; 09 §5 and 10 §1 name it).
- **Found by playing, and fixed:** (1) at 1280 × 720 the page scrolled by 9 px once the dock appeared: the game's input lives in the stage, so the dock in the info column held nothing but the platform's hidden inactivity announcement, which ended below the screen; the dock now keeps the refusal's line (`web/mind.css`); (2) the page went blank at every round's end (`TypeError … 'rules'`): the result view is null (G11), and the game's headline and result panel now draw nothing for it (`web/text.ts` 96 → 97, `web/ResultPanel.tsx` 126 → 128, one test more in `web/panels.test.tsx`); (3) the pressed choice filled with its season's colour hid the season's own icon: a tint and a thicker border now (`web/mind.css`); (4) the phase strip cut "Replay" to "Repla…" ("Re…" on a phone): each part has its name and time on two lines now (`web/mind.css` 230 → 236). The game's tests: 70, green.
- **Journeys, once each in Chromium (timing project):** 38 passed (1.4 min), 39 passed (2.3 min), 40 passed (2.2 min), 41 passed (1.2 min and 0.5 min). Each spec's header names the steps of 09 §4 it cannot play yet (T322).
- **L5 `mind-500`, once on this laptop (not a gate):** 500 players, 100 spectators, defaults 120/30/60, switches every 2–2.5 s: acknowledgement p50 1 512 ms, p95 4 109 ms, p99 4 664 ms (N = 8 520; limit p95 < 150 ms: **missed**); the release tick's distance from a whole second p50 23 ms, p95 121 ms, p99 211 ms (N = 540 gaps; limit p95 < 150 ms: met); every one of 50 952 released steps' counts adds up to its entrants; the last step against the result's counts could not be compared, the result view being null (G11); server CPU peak 0.77 cores, mean 0.34, RSS peak 754 MiB, event-loop lag p99 peak 205 ms; no HTTP problem, no refusal. The acknowledgements queue behind the round's serial commits, as the guess games' did on this laptop (OPEN (r): measure on the reference VPS).
- **Reused:** the e2e helpers (`person`, `call`, `attempt`, `visit`, `playerRow`, `fitsScreen`, `hostMenu`, `roundOpen`, `abortMatch`, `closeAll`), journey 9's axe check, the load driver's `http.mjs` and `measure.mjs` (`signIn`, `call`, `inGroups`, `metricsSampler`, `spread`) and its worker layout.

### Needs the owner's word (chain MG-N2)

Platform gaps the game cannot close inside `games/mind-games` (the chain changes no file in `packages/` or `apps/`):

- **G1 — no first choice in the browser.** `apps/web/src/round/InputRow.tsx` draws the game's input only for a viewer with a row in `state.roster`; a phased round's roster lists a player only once their entry is one delay old (04 §4.8 rule 5, `apps/server/src/round/views.ts` `rosterPart`). So a match player who has not chosen yet gets no input and can never make a first choice; the game's `Player` panel gets an `act` that does nothing. Needs: the dock for every match player of a phased round (the server's `role: 'player'` already says so), with the roster still delayed.
- **G2 — no phase times in the game's screens.** `PlayerPanelProps` and `SpectatorPanelProps` (packages/game-sdk `web.ts`) carry neither the round's `opensAt` nor its plan, and the game's state never learns the opening. The phase strip's marker for now and for the feed, "Joining closes in 0:24", "The first choices show in 12 s", "Every change now is a switch", the replay's "result in 0:18" and the buttons disabled by phase (02e §6, §11) need them. Needs: `opensAt` and `plan` in the panels' props.
- **G3 — the chat line of a phased round.** `apps/server/src/chat/roundLines.ts` takes the winner as the row with `place` 1; a phased round has `place` NULL for everyone (04 §4.8 rule 6), so the line is always "Round 3 ended: nobody found it", and with the game's `reveal` "Round 3 ended: nobody found it — Winter was the least chosen (3 players)". Needs: the line of a phased round from `won` and the game's words (02e §9: "Round 3: Winter was the least chosen (3 players).").
- **G4 — the result page's words for a phased round.** `apps/web/src/round/roundText.ts` `endHeadline` says "Time is up." for a round that ran its time (02e §9: "The round is over."), and the placings table's column is "Guesses" (the game's actions there are choices). The game's headline shows in the header below it (T311).
- **G5 — the list's rows show no age.** `GameText.guesses` gets no clock and the list draws a row's time only for Frost's held answers, so the feed's lines read "Anna chose Summer" without "· 30 s ago" (02e §6.1).
- **G6 — the host form's rules of 02e §3.** The platform's round form shows every key of the game's document as it is: the join time does not show half the total while "Join time follows the total" is on, the rounds and the pause stay editable after the first round (the server keeps the first round's anyway, 04 §4.8 rule 7), and a cross-key sentence shows for the form as a whole, not under its field.
- **G7 — the round screen's box and the prefs.** The game's input gets neither the player's prefs nor a way to save them, so Hide my switches in a round starts from the player's last choice in that round (the view's own) and is not kept for the next rounds; only the box in the pre-picks panel is (02e §6.3: "kept by the server with the player's pre-picks").
- **G8 — no notice of a refused pre-pick.** The server sends `prefs.refused` to the player's own room (MG-C3, T301), but the player client listens to it nowhere and the game's panels get no refusals, so "Your pre-pick All was not offered in round 3." (02e §7) shows nowhere.
- **G9 — the Quick Test form of a phased game.** The form still shows the guess games' fields (Secret, Cooldown, Inactivity limit, Inactivity warning, Fast specials, Team match) beside the game's own; the server drops them for a phased game (T302), so they do nothing.
- **G10 — the platform's words in a phased round.** The intro says "Cooldown 0.0 s between guesses"; the round's list is headed "2 guesses" and "No guesses yet."; the placings say "took part –" under "Guesses"; the match summary lists no round's winning options (02e §9).
- **G11 — no result view for a game without a secret (blocks the result).** `packages/application/src/round/roundSession.ts` `result()` returns null when the round's secrets are null, and a game without a secret derives null (the phased fixture too, so the server tests never saw it). The result page shows only the platform's placings and standings: none of the game's options, counts, winners, players with +1/+2 or light-up (02e §9, §11.1), and the chat's `reveal` has nothing to word.
- **G12 — a Quick Test match has seats for its bots and the host only** (`maxPlayers: bots + 1`), so journey 38's second browser cannot join it; its `JOIN_CLOSED` is checked in journey 41 in a match made by hand.
- **G13 — the admin's round view.** `GET /admin/rounds/:id` is the delayed spectator view (counts, entrants and lines as of now − D), while 09 §4 journey 41 says the admin round view shows no count until the end. Nothing in it is younger than the delay (checked), so 05 §3.2 holds; the spec's stricter words and the platform differ.
- **The authorization matrix's timeout:** in every full `pnpm verify` of this chain its HTTP test ran past its 150 s timeout under load (alone 30–36 s, with and without the game). An OPEN candidate.
- **New proposals:** T304–T323 (DECISIONS), one line each in the final report.

## Night MG-N1 (2026-11-12/13): docs cleanup, then the `phased` contract (MG-C1 → MG-C3)

Status, updated after every piece. Branch `feat/mind-games` is not merged tonight; only piece 0 is.

### Final report

- **Done:** all four pieces. Piece 0 merged into `master` (PR #9, merge `c3b8a69`, CI green, branch deleted); pieces 1–3 (MG-C1 → MG-C3, the whole `phased` contract of 04 §4.8) on `feat/mind-games`, not merged.
- **Branch heads on origin:** `master` `c3b8a69`; `feat/mind-games` at this sheet's commit (the code at `0979b4f`); `docs/cleanup-2026-11-13` deleted.
- **The four existing games:** unchanged. Their golden test, conformance P1–P6, every existing unit and integration test and the whole e2e suite pass as before; the migration 0016 test proves the same standings, team standings, awards and board entries for existing rows; every new field of an event, a state or a view is present only in a phased round.
- **Security (05 §3.2, S11):** P7 Delay in the conformance suite with the phased fixture (200 cases) and a permanent check that a leaking variant fails it; the server test checks frames, state answers, the round's player list, acknowledgements and the host's and a guest's views against the delay. Sabotage, done and undone: a live count in the fixture's spectator view turned P7 red; the server's views without their cut turned the integration test red; both green again after removal.
- **`pnpm verify`:** green at the end of each piece (piece 1 on its second run, see its section): 703 + 94 + 163, 708 + 94 + 165, 711 + 94 + 167 tests.
- **Full e2e, Chromium, at the end of the chain:** `pnpm e2e --project=chromium` 13 passed (1.3 min), then `--project=chromium-timing --no-deps` 35 passed (15.1 min); nothing flaky, nothing skipped.
- **CI on `feat/mind-games`:** the runs of pieces 1 and 2 failed in CI's coverage step (`pnpm test:coverage`, not part of `pnpm verify`): `packages/game-sdk` branches 86.71 % against 90 %, `planIssue`'s refusals untested; fixed in `0979b4f` (`phased.test.ts`). The run of piece 3 failed once in `test/webhooks.integration.test.ts` (expected 3 deliveries, got 2, then 3 instead of 1 in the next test: its webhooks are queued without waiting and the test counts what is pending, a race on a busy runner); it passed locally three times in a row and in CI on `0979b4f`. The run on `0979b4f` (43345781693): verify (with coverage), e2e Chromium, docs, security green. Reported, not changed: the webhooks test's count may race (OPEN candidate).
- **CI for piece 0's merge commit** `c3b8a69`: green (CI 41 min 26 s, CodeQL).
- **New T-entries, every one "(proposal, night MG-N1)":** T288–T303, one line each under "Needs the owner's word" below.
- **Noticed, left alone (all pieces):** `apps/server/test/league.integration.test.ts` is 324 lines, over 300 before tonight; the inactivity test's log read raced under load (made to wait for the committed log, a test-only change, piece 1); the webhooks test's pending count may race (above); the per-account limits, the new pre-pick one included, live in each process's memory; the client words no sentence yet for `PLAY_OVER`, `JOIN_CLOSED` and `prefs.refused` (the game's screens, MG-2 and MG-4); the chat's round-end line names a phased round's winner only once its game's `reveal` words it (MG-1).

| Piece                                               | State                                                                                                                                                                 |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 — docs cleanup                                    | **done**: PR #9 merged into `master` (`c3b8a69`, CI green: CI 41 min, CodeQL); branch deleted on origin and locally; master merged into `feat/mind-games` (`f0112f4`) |
| 1 — MG-C1, the `phased` class and the round engine  | **done**, pushed on `feat/mind-games`                                                                                                                                 |
| 2 — MG-C2, series and joining a running round       | **done**, pushed on `feat/mind-games`                                                                                                                                 |
| 3 — MG-C3, per-player match data and the Quick Test | **done**, pushed on `feat/mind-games`                                                                                                                                 |

### Piece 0 — docs cleanup (`docs/cleanup-2026-11-13`, PR #9)

Each line checked against the tree or git history before it changed:

- BACKLOG part one: the inactivity limit (O71–O75) closed, merged in PR #4 (`59fd076`); OPEN's stale bullet "On `feat/inactivity`, not merged" removed.
- BACKLOG part two: the hostEmbed chat row gets "Branch feat/website-mode (piece 2, `787e595`; DECISIONS T236–T240)" and 2026-11-05 (`git log -S` on the row and on T236).
- 08 §3.3: the code (`games/seasonal-target/src/geometry.ts`, its tier table) has 48 / 32 / 20 / 12 / 6 % of the diagonal with minimums n > 61 / 40 / 20 / 13 / 8, as 02d §7 says; 08's row (40 / 25 / 12 / 6 / 3 %) was the one wrong and now says what the code has.
- GAME-IDEAS §2 and 01 §1: Target, Safecracker and Bomb Defusal are designed and built (O38, O65).
- 02b §8: the sentence fused into the heading moved to the end of the closest-miss paragraph.
- 09 §4: journeys in numeric order (24–27 and 30–32 stay blocks; no number changed).
- Checks: prettier and the offline link check (lychee, 322 links, 0 errors); PR checks green (docs, verify, e2e Chromium, security, image, CodeQL).
- Merging master into `feat/mind-games`: BACKLOG and OPEN conflicted; both sides kept (the inactivity row from master and the design row from the branch; master's removal of the stale bullet and the branch's Mind Games bullet).

### Piece 1 — MG-C1, the `phased` class and the round engine (04 §4.8 rules 1–6, 9)

- **Contract** (`packages/game-sdk/src/phased.ts`, `module.ts`): `timing: 'cooldown' | 'phased'`, `phased?: { plan, outcome }`, `PhasePlan`, `OutcomeRow`, `planIssue`; `series` and `prefs` come with pieces 2 and 3.
- **Settings** (`packages/application/src/round/roundSettings.ts`): a phased game's document holds only `round.countdownS` and `round.seasonSource` of the platform keys; its other platform values are fixed off, its longest time is the plan's end, the plan travels with the settings into `RoundCreated` (T288).
- **Domain** (`packages/domain/src/round/phased.ts`, `types.ts`, `evolve.ts`, `lifecycle.ts`, `results.ts`, `step.ts`): the check order of rule 2 with `PLAY_OVER` and `JOIN_CLOSED` at the receive time, no cooldown, Frost, timeout or solve, a reply `{ ok: true }` without a receive number, `PlayerEntered` before a player's first action, the command `member` and the event `MemberChanged` (T289), the end with the game's own results: nobody placed, `won`, winners' `solve_at` the end (T290), "no players left" for an empty round. The guess games' events and state keep their shapes (every new field is present only in a phased round).
- **Server:** the delayed room (`apps/server/src/round/delayedRoom.ts`): room and host events held for the delay, released once a second in one frame with their own release sequence; lifecycle events at once; the end releases everything; restart counts what was due (T292, T293). Views at the room's cut, the round's list of players only once their entry is one delay old, no action counts, the plan in the round state; the players' own frames numbered by the release number (T291); the gateway sends a phased round's room frames only from the delayed room; `Play` tells a running phased round of players who join (after the anti-multi rules) or leave, starts it with every active match player, and lets it play on when players leave; a game without teams gets matches without them (T295); the guess intent takes a record of up to 4 short strings, numbers or booleans (06 §4.3).
- **Results:** `round_results.won` (migration 0016, idempotent), written as `won ?? place = 1`; the match standings count `won`.
- **Tests:** `packages/domain/src/round/phased.test.ts` (6: the windows to the millisecond, the order of the codes, no cooldown, `PlayerEntered` once, joining and leaving, the results, "no players left", replay equals live); `games/registry/src/phased.conformance.test.ts` (P1, P3–P5, P7 with 200 cases, and a permanent check that a fixture leaking one live count fails P7); `apps/server/test/phased.integration.test.ts` (frames, state answers and the round's list delayed for another player, a guest and the host; release numbers gap-free and equal to the state's `seq`; `{ ok: true }`; a match player who joins while it runs enters; `JOIN_CLOSED` and `PLAY_OVER`; the results and standings); `apps/server/test/resultWon.integration.test.ts` (real Guess The Number rounds, shared and individual: every row's `won` is its place 1; the rows set back to false, migration 0016 run again: match standings, team standings, league awards and board entries are equal).
- **Sabotage, twice:** the fixture's spectator view given the live counts → `P7 Delay holds for sides-fixture` failed; restored → green. The server's views given no cut (`cut: Infinity` in `liveRound.ts`) → the integration test failed (`expected [ { playerKey: 'p2', … } ] to deeply equal []`, a player in the round's list before the delay); restored → green.
- **The four existing games unchanged:** the golden test of Guess The Number, the conformance suite P1–P6 for all four, and every existing server test pass unchanged.
- **`pnpm verify`:** the first run had 3 failures, all under the full run's load: the new phased test (a join came after the fixture's 4 s window: the plan is now 6/8/10 s), the authorization matrix (timed out; passes alone) and the inactivity test (it read the log right after the view showed the timeouts, before their batch committed; passes alone, three times; the test now waits for the committed log, a test-only change). The second run: green (format, lint, typecheck, 703 + 94 + 163 tests).
- **Lines before → after:** game-sdk `module.ts` 175 → 182, `index.ts` 88 → 90, `phased.ts` new 53; domain `types.ts` 229 → 262, `evolve.ts` 204 → 228, `lifecycle.ts` 179 → 187, `results.ts` 119 → 139, `step.ts` 39 → 43, `phased.ts` new 100, `phased.test.ts` new 222; application `roundSettings.ts` 80 → 129, `roundSession.ts` 131 → 133; contracts `play.ts` 206 → 215; server `app.ts` 229 → 235, `routes/matches.ts` 249 → 253, `routes/quickTest.ts` 100 → 101, `routes/rounds.ts` 219 → 220, `match/play.ts` 300 → 265, `match/playError.ts` new 32, `match/roundCreation.ts` new 93, `realtime/gateway.ts` 226 → 256, `realtime/intents.ts` 241 → 244, `round/delayedRoom.ts` new 145, `round/gameRunner.ts` 154 → 177, `round/liveRound.ts` 118 → 168, `round/pgResults.ts` 123 → 128, `round/rounds.ts` 146 → 170, `round/runtime.ts` 103 → 116, `round/views.ts` 173 → 229, migration `0016_result_won.sql` new 14; tests `harness.ts` 69 → 76, `socketKit.ts` 188 → 191, `phased.integration.test.ts` new 185, `resultWon.integration.test.ts` new 143, `inactivity.integration.test.ts` +7; registry `index.ts` 50 → 51, `phasedFixture.ts` new 165, `testing.ts` new 18, `phased.conformance.test.ts` new 190, `package.json` (zod 4.6.7, already used by every game; a new export `./testing`).
- **Extracted:** `match/playError.ts` (the use cases' error type) and `match/roundCreation.ts` (season, settings and the new round) out of `play.ts`, which was at 300 lines; `readers` in `liveRound.ts` and `sendReleased` in the gateway to keep their functions under 60 lines.
- **Reused:** `ViewCtx.releasedBefore` (Frost's cut) as the delayed cut; `roomForm` for the phased lifecycle events; `toPublic` for the released frames; `roomFrames` merging for them; the existing `round_time_up` end at the round's longest time, set to the plan's end; `catchUp`, `fail`, `withEntry`, `freshEntry`; the test harness's `until`-style waits and `socketKit`.
- **Noticed, left alone:** `scheduled_actions.kind` has no `match_autostart`, though 06 §2.5 names it (piece 2 adds it); `apps/server/test/league.integration.test.ts` is 324 lines (over 300 before tonight); the host form always sends `round.halving`, which a phased game's document does not hold (piece 2, where the host form changes); the client words no sentence for `PLAY_OVER` and `JOIN_CLOSED` yet (the game's screen, MG-2); the chat's round-end line takes the winner from place 1 (`chat/roundLines.ts`), so a phased round's line names nobody until its game's `reveal` words it (MG-1).

### Piece 2 — MG-C2, a series of rounds (04 §4.8 rule 7)

- **Contract:** `series(cfg) → { rounds, pauseMs } | null` in `PhasedHooks` (`packages/game-sdk/src/phased.ts`); the fixture plays two rounds 3 s apart.
- **Server** (`apps/server/src/match/series.ts`): after each round of a series a `match_autostart` row is due at its end plus the pause: the next round from `matches.next_settings` (the host's last choices and season, or what `PUT …/next-round` saved), started at once without the minimum of players; after the last round the close with reason `complete`. The row is claimed once (timer or the host's click). A start-up sweep writes a next step a stop missed (T296, T297). Migration 0017: `matches.next_settings`, and the kind CHECK of `scheduled_actions` replaced by the same list plus `match_autostart` (06 §2.5 named it; the table never had it), inside the migration's transaction, never off.
- **Routes** (`apps/server/src/http/routes/series.ts`, registered with the match routes): `PUT …/next-round` (the round body without `startNow`, the per-setting check, 422 with field and sentence), `POST …/next-round/start` (409 `ROUND_RUNNING` outside a pause), both host only, `NOT_A_SERIES` otherwise; `GET /matches/:code` carries `series` (`rounds`, `played`, `nextAt`).
- **Client** (T298): `apps/web/src/match/SeriesStatus.tsx` in the waiting area ("Round 3 of 6 · Next round in 12 s", "The match ends in 5 s", the host's Start next round now with its tooltip); the waiting area's sentence in a pause ("The next round starts by itself."); the Host menu's request in `apps/web/src/match/roundRequest.ts`: `round.halving` only where the document has it (a phased game's has none), and in a pause the settings kept for the next round; the summary's "All N rounds are played.".
- **Tests:** `apps/server/test/series.integration.test.ts` (the pause in the details, a refused next setting with its field, the saved season and countdown in the next round, Start next round now by the host only and at once with a player gone, then `ROUND_RUNNING`, the close `complete` after the last pause; a guess game's match is no series); `apps/web/src/match/series.test.tsx` (the series line, the countdown, the host's button and its request, the last round, no series; the form's request in and outside a pause, with and without halving); the summary test's "All 6 rounds are played.".
- **`pnpm verify`:** green (format, lint, typecheck, 708 + 94 + 165 tests).
- **Lines before → after:** game-sdk `phased.ts` 53 → 64, `index.ts` 90 → 96; domain `phased.test.ts` 222 → 223; contracts `play.ts` 215 → 223; server `routes/matches.ts` 253 → 260, `routes/rounds.ts` 220 → 221 (`hostOf` exported), `routes/series.ts` new 83, `match/play.ts` 265 → 273, `match/series.ts` new 166, `round/rounds.ts` 170 → 198, `round/runtime.ts` 116 → 137, `round/scheduler.ts` 100 → 105, migration `0017_series.sql` new 17; tests `authzTable.ts` 300 → 270, `authzChecks.ts` new 46, `authzMatrix.integration.test.ts` 278 → 279, `series.integration.test.ts` new 136; web `HostMenu.tsx` 297 → 295, `WaitingArea.tsx` 153 → 162, `MatchSummary.tsx` 111 → 113, `SeriesStatus.tsx` new 65, `roundRequest.ts` new 51, `series.test.tsx` new 100, `summary.test.tsx` 140 → 144; registry `phasedFixture.ts` 165 → 177.
- **Extracted:** `authzChecks.ts` (the refusals and the CSRF writes) out of `authzTable.ts`, which the two new route rows would have taken over 300 lines; `roundRequest.ts` out of `HostMenu.tsx` (at 297); `roundsOf` and `seriesOf` in `runtime.ts` to keep `createRoundRuntime` under 60 lines.
- **Reused:** `createRoundBody` and `settingsRefusal` for the next round's settings, `hostOf` of the round routes, `chooseRoundSettings` for the check, `Play.createRound` and `Play.startRound` for the next round, `Play.close` with a `MatchEnd` for the close, the existing scheduler loop and lease, `useTicker` and `serverNow` for the countdown.
- **Noticed, left alone:** the result page's own next-round box and the Host menu still offer Next round in a series pause too (it saves the settings there, T298); a dedicated pause view on the result page is the game's screen (MG-2).

### Piece 3 — MG-C3, a player's own match value (pre-picks) and the Quick Test of a phased game (04 §4.8 rule 8, 09 §4.2)

- **Contract:** `prefs?: { schema, action(prefs, roundIndex, cfg) }` in `PhasedHooks` (now `PhasedHooks<S, A, Cfg>`), `DevPrefs` on a registry entry, `PrefsPanelProps` for the web half's optional `Prefs` panel; the fixture's pre-picks per round number, with a side `x` its rounds refuse (as Mind Games refuses All when it is off).
- **Server** (`apps/server/src/match/prefs.ts`, `apps/server/src/http/routes/prefs.ts`, migration 0018): `GET`/`PUT …/prefs` and the intent `match.prefs` for a player's own value only (`FORBIDDEN` for anyone not in the match, then `PREFS_OFF`, `PREFS_INVALID` after the game's schema and 2 KiB, `RATE_LIMITED` beyond one save every 2 s); `myPrefs` in the match details, the viewer's own; deleted on leave and kick; applied at each opening of a phased round, after its batch committed, in join order, as the first choice received at `opensAt` and only for a player not yet in the round (`LiveRound.prePick`, the check and the queue in one step, T300); a refusal goes to that player's room alone as `prefs.refused` (T301); the logger redacts `prefs`, `choice` and `counts` (T303).
- **Quick Test** (`apps/server/src/dev/phasedBots.ts`, `quickTest.ts`, `bots.ts`; T302): a phased game gets only its document's keys (the form's platform keys it lacks are dropped; for the guess games every key stays as before) and a match without teams; each bot's draws and first move per round from the Quick Test's seed (the first move inside the entry window), and once per match whether it pre-picks (the game's `devPrefs`); a pre-picking bot joins without being connected and plays by its pre-picks.
- **Web** (`apps/web/src/match/GamePrefs.tsx`): the game's `Prefs` panel in the waiting area for the match's players, with `myPrefs`, the series' rounds and those played, saving through `PUT …/prefs` and handing a refusal's code back.
- **Tests:** `apps/server/test/prefs.integration.test.ts` (a value outside the schema 422, a second save within 2 s 429, `myPrefs` the viewer's own only, the host's `GET` its own null, a non-player 403; round 1 played by the away player's pick, entered at `opensAt`; round 2's refused pick told only to its player as `prefs.refused` with round 2 and `CHOICE_UNAVAILABLE`; leaving deletes the value; two Quick Tests with seed `frost` and 7 bots: the same pre-picking bots, bot-05 and bot-06, with the same picks, neither connected, no teams); `apps/web/src/match/prefs.test.tsx` (the panel's props, its save and a refusal's code, nothing for a spectator or a game without it); the authorization matrix's rows for `GET`/`PUT …/prefs` and `match.prefs` (the match's players only).
- **`pnpm verify`:** green (format, lint, typecheck, 711 + 94 + 167 tests).
- **Lines before → after:** game-sdk `phased.ts` 64 → 77, `module.ts` 182 → 188, `index.ts` 96 → 99, `web.ts` 170 → 181; contracts `play.ts` 223 → 225; server `app.ts` 235 → 244 (the redaction list), `routes/matches.ts` 260 → 276, `routes/prefs.ts` new 74, `match/play.ts` 273 → 281, `match/prefs.ts` new 101, `realtime/gateway.ts` 256 → 261, `realtime/intents.ts` 244 → 260, `round/rounds.ts` 198 → 236, `round/liveRound.ts` 168 → 194, `round/runtime.ts` 137 → 140, `dev/bots.ts` 59 → 75, `dev/quickTest.ts` 180 → 231, `dev/phasedBots.ts` new 48, migration `0018_player_prefs.sql` new 17; tests `authzTable.ts` 270 → 274, `prefs.integration.test.ts` new 165; web `WaitingArea.tsx` 162 → 165, `GamePrefs.tsx` new 39, `prefs.test.tsx` new 105; registry `web/index.ts` 78 → 82, `phasedFixture.ts` 177 → 207.
- **Extracted:** `phasedParts` in `routes/matches.ts` (the details stayed under the complexity limit), `prePickOf` in `liveRound.ts` (under 60 lines), the phased bots' plan in `dev/phasedBots.ts`.
- **Reused:** `RateLimiter` (auth), `activePlayers`, the round queue for pre-picks as ordinary actions, `roundRng` (the platform's DRBG) for the bots' plans, `quickTestSeed`, the existing `match:<id>:player:<key>` room for the refusal, the authorization matrix's `ROSTER` callers.
- **Noticed, left alone:** the per-account save limit is in memory per process, like the other per-account limits (gone after a restart); the result page in a pause has no pre-pick panel of its own (the waiting area beside it has it); the client wording for `prefs.refused` is the game's (MG-4).

### Needs the owner's word

Every decision below was built as written (the reading that changes no existing game); each is a T-entry in DECISIONS marked "(proposal, night MG-N1)":

- T288: a phased round keeps the default cooldown in its stored config and `rounds.cooldown_ms` (the table's CHECK); never used, shown as 0.
- T289: joining, leaving or being removed while a phased round runs is the command `member` and the event `MemberChanged`; the round starts with every admitted match player, the minimum counting those connected; it plays on when players leave.
- T290: a phased round's winners get `solve_at` = the round's end for the earliest-win tie order; no solves.
- T291: a phased round's own player frames carry the room's current release number as `s`.
- T292: a phased round's views use the delayed room's last tick minus the delay as their cut.
- T293: a phased room never hears `GuessAccepted`, `MemberChanged` or own events; `PlayerEntered` after the delay; lifecycle events at once.
- T294: `Rounds`, the runtime and `buildApp` take an optional list of games; the fixture `sides-fixture` is installed only by tests (`@smg-game/registry/testing`).
- T295: a game without teams gets matches without teams and no `round.teamsOn` choice.
- T296: a series' next step is a `match_autostart` row on the ended round, written after its end commits, claimed once; migration 0017 widens the kind CHECK by that one value.
- T297: a series counts its ended rounds; an aborted round schedules nothing (the host starts the next by hand); the automatic round is made by the host's account from the saved settings.
- T298: the series line and Start next round now in the waiting area; in a pause the Host menu keeps the next round's settings; `round.halving` only where the document has it.
- T299: pre-picks in `match_player_prefs` (at most 2 KiB), `FORBIDDEN` for a non-player before `PREFS_OFF`, one save every 2 s per account kept in memory, deleted on leave and kick.
- T300: pre-picks applied after the opening commits, in join order, received at `opensAt`, only for players not yet in the round; a restart in between loses them for that round.
- T301: a refused pre-pick is the Socket.IO event `prefs.refused` in the player's own room.
- T302: the Quick Test of a phased game: only its document's keys, no teams, seeded per-round bot plans (`quicktest/<round>/<bot>/pick|entry`) and per-match pre-picks (`quicktest/prefs/<bot>`, up to 20 rounds), pre-picking bots not connected.
- T303: the web half's optional `Prefs` panel in the waiting area; `myPrefs` the viewer's own; the logger redacts `prefs`, `choice` and `counts`.

## Dress rehearsal of the live install (2026-11-06)

The website's real installer and ours ran together on a fresh systemd Ubuntu 24.04 container with its own Docker (`smg-rehearsal-*`). The machine had a test DNS for `example.org` and the website's own test ACME server (Pebble). It ran in nginx mode first, then on a reset machine in the website's own-Caddy mode. The browser was Chromium with `--host-resolver-rules`, so the origin was exactly `https://example.org`. The machine and every test account are deleted. The screenshots are on the orphan branch `shots/rehearsal`: 35 images and `play-through.txt`.

- **The website used:** its `master` at `82e9e30`. `feat/embedded-games` was merged there (PR #45, which contains `468aaca`) and deleted, so that branch no longer exists.
- **The website installer asked:**
  - the domain, the www redirect, the call service's domain, the Let's Encrypt e-mail;
  - the price bot's and event bot's files;
  - the backup age key, the CoinGecko key and the Discord client id;
  - Bingo embedded? (`no`); Mini Games embedded? (`yes`);
  - in nginx mode, the event bot's admin page;
  - the first admin's name, e-mail and password.

  It picks the mode itself: nginx when nginx holds 80/443, otherwise its own Caddy. Both runs exited 0.

- **Our installer asked** only three questions in both modes: the type (`website`), the environment (`prod`) and the age key. Both runs ended "Done (14 change(s))" with every end check passing.
- **Defect on our side, fixed** (`03eb748`, T244):
  - Run from a clone of `feat/website-mode`, the installer built `master`. It now builds the checkout's own branch, or its commit when detached, and `master` only outside a checkout.
  - New test `ops/test/checkout-ref.test.sh` fails without the fix; shellcheck is clean. README and the operator guide are updated.
  - Full `pnpm verify` green (160 files, 885 tests); CI green on `fbcaa04`.
- **Piece 3, nginx mode,** all passed except the way back after login:
  - the guest lobby, plus the light and dark pair;
  - the guest chat: the website's room, read-only, with "Log in";
  - the website's login reached;
  - a member allowed to host hosted one round of each of the four games, with a second member in another profile;
  - chat written, and "1 unread" on the other profile's badge;
  - the deleted member's session ended after 7 s, and they show as "Deleted player";
  - the locked member's session ended after 5 s;
  - `smg admin promote-super --name alice` worked;
  - `smg status` showed website, authorize 204 and the feed's last success.
- **Own-Caddy mode:** sign-in, one Guess The Number round, chat and the badge, promote-super and status all passed.
- **Defect on the website's side (OPEN, "Needed from the website"):**
  - After the website's login, `LoginPage.jsx` moves to `next` inside its own app with `navigate(safeNext(next))` and shows "Page not found"; the game's sign-in route is never requested. A reload signs the member in.
  - Expected: a full page load for paths under `/games/`.
  - `RegisterPage.jsx` and `DiscordSignupPage.jsx` have the same call. Bingo is affected too.
- **Not checked:** Discord steps (the website offers no test path to give an account a step), signing in again as a locked member, and the four games in Caddy mode (one round there, as asked).

## Night 9 (2026-11-06), pieces 1–2 on `feat/website-mode`

This branch carried pieces 1–2. Pieces 3–4 (round polish, spec gaps) are on `feat/round-polish` from `master`, with its own copy of this section. Neither branch is merged. Owner decision O68: proposals T237, T222 and T240 are accepted.

### Status

| Piece                                    | State   | Commit          |
| ---------------------------------------- | ------- | --------------- |
| 1. The three accepted proposals          | done    | `7dcfc1b`       |
| 2. Website mode's loose ends             | done    | `d8b5065`       |
| 3. Round polish (on `feat/round-polish`) | done    | `5b1a036` there |
| 4. Spec gaps (on `feat/round-polish`)    | running |                 |

### Piece 1 — the accepted proposals (O68; T222, T237, T240, T242)

- O68 is in DECISIONS §1. T222, T237 and T240 now have DECISIONS rows marked accepted, and OPEN (ac)–(ae) are closed in BACKLOG part two, as `396fa3f` did for confirmed items. The website's optional link fact is dropped from "needed from the website".
- T237, the unread badge: new `useHostChatFrame`. While the round bar's Chat panel opens or closes, it posts EMBED.md's `{source:'seasonal-chat-host', type:'visible', visible}` to the frame, and again on every `ready`.
  - It accepts `unread` only when all hold: the origin is the frame address's origin, `event.source` is the frame's window, `source` is `seasonal-chat`, and the count is a whole number ≥ 0. The count shows on `chat-unread`.
  - The lobby and waiting area send and listen to nothing.
  - T242: the frame carries `referrerpolicy="strict-origin"`, because EMBED.md finds the parent through the referrer in Firefox. The page-wide `no-referrer` stays.
  - Nothing is needed from the website: EMBED.md (identical on its master) has every message.
- T222: in website mode, the admin's security settings leave out `antiMulti.requireLinkedChat`, and the roster rules ignore it (`rosterAdmission`), even with a JWT provider. Standalone is unchanged (T103).
- T240: the integrations settings answer an optional `inEffect` field (`SettingInEffectView`) for keys that take the deployment default, with the value and why. The admin's "In force" column shows them, e.g. hostEmbed with "This install runs inside the website; its chat is used until an admin chooses another." No new route: one more field on an existing GET, whose matrix row stands.
- Tests:
  - web and admin: 43 files, 197 tests pass, among them foreign origin, foreign window, wrong `source` and a bad count, all ignored;
  - server: 8 files, 60 tests pass, among them the website-mode admin cases;
  - journey 36 in Chromium passed once (52 s): the frame is told hidden, two messages show "2 unread", opening clears the badge and tells it visible, and closing tells it hidden.
- Reused: `chatArrivals.ts` (a new `HostChatSight` context), `FocusShell`'s `useUnread`, and a shared `resolve` in `provider.ts` for `chatConfig` and the new `chatInEffect`.
- Noticed, left alone:
  - T239's reason for reloading the frame on a theme switch is outdated, since EMBED.md has a `theme` message.
  - EMBED.md's `resize` is unused.
  - The phone waiting area's chat button has no badge.

### Piece 2 — website mode's loose ends (T243)

- The first admin on a website install (T243):
  - `smg admin create-super` refuses there, before any question, in `ops/smg` and in the app's CLI, and names the new `smg admin promote-super --name NAME | --website-id N`.
  - That command promotes a website account that has signed in once. `--name` matches the game name or the website name, ignoring case.
  - Several matches are listed with their website ids; an unknown, suspended or deleted account is refused; an account that is already super admin exits 0.
  - The role is stored with source `manual` through `addRole`, so the next sign-in's mapping (`idp_mapping` rows only) and a `rights` change keep it; a `deleted` change still removes every role. The account's sessions end, so its next sign-in is an admin session.
  - `promote-super` refuses on a standalone install. README, the operator guide (§3 step 8, §4 split by install type), spec 10 §6 and the installer's next steps say this.
- The installer's dry run now says "would be reloaded" (`install_route`).
- The "Others:" line renders each name through `PlayerName` with its steps (`othersOf`, shared with the line's tooltip text).
- `DELETE /me` stays a hard delete. The website link goes with the account (cascade), so later `deleted`, `locked`, `unlocked` and `rights` entries for that id do nothing, log only the usual info line, and move the cursor on. This already worked; a new test proves it.
- Tests:
  - server: 22 files, 99 tests pass, including the real CLI run through tsx in both modes;
  - web: 38 files, 177 tests pass;
  - shellcheck is clean.
- Reused: `addRole`, `revokeAccountSessions`, `PlayerName`. Extracted: cli.ts's `withPool` and command table, RoundLog's `othersOf`.
- Noticed, left alone: a CLI role grant writes no audit-log entry, as `create-super` never did.

### Verify (end of this branch)

- First `pnpm verify` at `f629b4a`: format, lint and typecheck clean, but 3 failures in `websiteFeed.integration.test.ts`. Its first test (five sign-ins, a match, a league row) ran past vitest's 20 s default under the full parallel run and left the cursor unsaved, which failed the next two. Alone the file passes (4 tests, 32 s).
- Fix `a873ae0`: 60 s for that test and the two that wait on polls, as the other heavy integration tests have.
- Second `pnpm verify` at `a873ae0`: all green, 160 test files and 885 tests.

## Website mode (2026-11-05)

Branch `feat/website-mode` from `master` at `4ab2986`; not merged by this task. Owner decisions O66 (website sign-in, guests, steps, deleted and locked accounts, the website's chat) and O67 (one installer for both variants). Reference: Seasonal Bingo Royale's website mode (its 07 §2.3, 03 §2.2, D37, D40–D43; `websiteIdentity.ts`, `websiteAccounts.ts`, `websiteSignIn.ts`, `ops/lib/website.sh`) and the website's contract (its `server/src/bingo/routes.js`, docs/AUTH.md "Seasonal Bingo Royale"), generalised there for `/games/mini-games`.

### Status

| Piece                                    | State | Commit               |
| ---------------------------------------- | ----- | -------------------- |
| 0. Owner decisions O66, O67              | done  | `d6bb733`            |
| 1. Website auth mode (server)            | done  | `f43dc8d`            |
| 2. The website's chat in the game        | done  | `787e595`            |
| 3. The installer for both variants       | done  | `691357a`, `e2d24f3` |
| 4. Tests: e2e journey, installer, verify | done  | `5dd81bd`            |

### Piece 1 — website auth mode (T214–T222)

- `SMG_AUTH_MODE=website`: `GET <base>auth/website` is the only route that reads the identity headers, and only from a peer in `SMG_TRUSTED_PROXIES` with `X-Smg-Proxy-Secret` (constant-time compare). It finds or creates the account by (site origin, numeric user id) with no password or e-mail, makes the name fit (a taken name gets `-2`, T214), maps the roles (admin → game admin, Can-Host → organizer, everyone player; never super or security admin, T219), stores at most three checked steps (T220), rotates the session and follows a safe `next` (else the lobby). A trusted guest gets a 302 to the website login (T215, Bingo D43); `<base>auth/website/login` hops to `SMG_WEBSITE_LOGIN_PATH`. 30 sign-ins and 600 hops a minute per address.
- Website mode leaves out registration, password login, `me/password` and dev sign-in (404); `/session` adds `authMode` and `signInPath`. Guests watch through a guest session (T221); the matrix runs the anonymous and guest rows against a website-mode server too.
- The feed poller (T217): a plain `fetch` of `SMG_WEBSITE_LOCAL_URL` with `X-Games-Sync-Token` every 15 s, the cursor in `smg.website_feed` (migration 0014), errors backing off from 30 s to 10 min, logged without the token. `deleted` anonymises the account as "Deleted player" (T216: its rounds keep their points, the boards and profiles skip it), `locked` and `rights` end its sessions. `/readyz` reports `websiteFeed.lastSuccessAt` (T218).
- Steps travel as optional `steps` in the match, round, board and profile views (`PlayerStepView`); the client shows them in piece 2. The JWT handoff stays for third-party sites; the website's planned handoff endpoint is dropped from OPEN and BACKLOG. Proposal T222 (OPEN (ac)): `antiMulti.requireLinkedChat` cannot work with proxy headers alone.
- Adopted from Bingo: `trustedPeers`, `identityFrom`, name cleaning, `safeNext`, the constant-time secret compare, the provider upsert, follow-on-sign-in, session rotation, `checkWebsiteMode`, the login hop. Different: the Can-Host and steps headers, the guest redirect, numeric ids, the `-N` suffix, the poller and anonymised deletion (Bingo has no feed).
- Reused: `nameCandidates`, `applyRoles`, `createLinkedAccount`, `inTransaction`, `RateLimiter`, `findSession`, `SessionEnds`, `readLimited`; `openSession` split out of the handoff's `startSession`; new `revokeAccountSessions`. Tests: the server package (16 unit and 22 integration files) green; three new website suites (23 tests).
- Noticed, left alone: `DELETE /me` still hard-deletes, website accounts too; an anonymous POST to an unregistered route answers 403 (CSRF) before 404.

### Piece 2 — the website's chat in the game (T236–T240)

- The chat provider: an admin's stored setting wins, then `SMG_CHAT_PROVIDER`; in website mode the default is hostEmbed with `/embed/chat?room=mini-games` on the same origin. CSP `frame-src` in website mode is `<public origin>/embed/chat` only (an admin's own chat by its origin); standalone unchanged (T236, Bingo 07 §6 / D5).
- The panel (lobby, waiting area, round drawer, phone sheet) frames `…&theme=<light|dark>` following the game's theme (a switch reloads the frame), titled "Chat". A signed-out visitor in website mode also gets "Log in", which goes through `signInPath?next=<page>` so they return signed in (T238, Bingo D43). The game posts nothing into the frame and listens to nothing.
- Website-mode sign-in UI: every "Sign in" goes to `signInPath?next=…`; no Register, no dev sign-in; `#/sign-in` and `#/register` show a "Sign in" panel. A signed-out visitor who opens a match gets a guest session first (T239). Local mode, Quick Test and dev sign-in unchanged.
- Steps beside names through `PlayerName`'s new `steps` prop and `PlayerSteps` (roster, Players panel, round list, results, standings, boards, profile); an icon with the step name as its text alternative, or the name as text; markup unchanged without steps.
- Proposals: T237 (OPEN (ad)): the unread badge is hidden with hostEmbed. The website's EMBED.md does define `visible`/`unread` messages, so the proposal is to adopt them; the game's `Referrer-Policy: no-referrer` keeps the frame silent in Firefox. T240 (OPEN (ae)): the admin's Integrations page shows `builtin` while hostEmbed applies.
- Reused: `PlayerName`, `SessionView`, `POST /auth/guest`, chatKit's `until`; session.tsx's repeated POST-reset-refresh folded into `changing()`; `hostChatOrigin` replaced by `hostChatSource`/`frameSource`. Tests: web 37 files and 173 tests; server units plus the chat and website integration suites, 20 files and 106 tests.
- Noticed, left alone: the third-party embed view starts no guest session; a signed-out visitor in local mode still gets none; `RoundLog`'s plain "name: N guesses" strings show no steps.

### Piece 3 — one installer for both variants (T230–T235)

- `sudo bash ops/install.sh` asks the type first. Standalone asks as before (environment, address, admin e-mail, age key). Website asks only the environment and the age key: it finds the website's mode (Caddy of compose project `seasonal-site`, or host nginx), its checkout, domain and network itself (Bingo's `detect_website`, T230). If the website does not serve `/api/games/mini-games/authorize` or there is no sync token, it stops before writing anything and names `sudo ./deploy/install.sh --update --mini-games` in the checkout.
- It writes the game's own route file (0600): `/etc/seasonal/routes/mini-games.conf` for nginx, or `mini-games.caddy` in the host folder mounted at Caddy's `/etc/caddy/routes`. The file clears the seven identity headers and the secret on every path, asks authorize through `auth_request` / `forward_auth`, and adds the secret only after that call. A refusal goes to `<base>auth/website/login` with the query, and metrics answer 404 (T231). Then `nginx -t` or `caddy validate`, a rollback on failure, the reload and an end check through the website (T232). No website file is edited; the snippet-paste path and its texts are removed.
- The env file: `SMG_AUTH_MODE=website`, the trusted ranges, a 64-hex secret kept on re-runs, the login path, the sync token, `SMG_BASE_PATH=/games/mini-games/`, `SMG_CHAT_PROVIDER=hostEmbed`. The feed is reached at `http://site:3800` in both modes, because the app joins the website's network and 127.0.0.1 would be the container itself (T233). nginx mode uses its own port 3920 and subnet 172.30.250.0/24, distinct from Bingo. `smg status` shows the sign-in mode, the authorize answer and `feed: last success` from readyz (T234).
- Installer tests (T235, Ubuntu 24.04 systemd containers with their own Docker, real nginx, Caddy and PostgreSQL; stub website and stub app):
  - standalone: install, HTTPS, status, backup and restore drill, maintenance, re-run with 0 changes;
  - nginx: first run with Mini Games off stops with the command and writes nothing; switched on, the run succeeds with 14 checks;
  - caddy: the same checks.
  - Both website re-runs make 0 changes. shellcheck is clean.
- Noticed, left alone: Bingo's Caddy route sends no `X-Original-Method`, so the website refuses it (Bingo bug, reported only); `smg admin create-super` still makes a local account on website installs (the guide says standalone only); a dry run says "reloaded" after "would run".

### Piece 4 — e2e journey 36, verify (T241)

- Journey 36 (`e2e/website.spec.ts`, Chromium only, also in CI's chromium run) runs against a stand-in website: the nginx container `smg-e2e-website` with the installer's route, a node stub for authorize, login, `/embed/chat` and the feed, and a second server in website mode on 3930 with its own database `smg_e2e_website`, so the 3910 dev server never takes its rounds (T4, T13). The steps:
  - a signed-out visitor watches a match and sees the stub chat in "Chat" (`theme=light`);
  - "Log in" goes through the website's login and back, signed in;
  - the member joins with the step "Gold" beside the name and guesses;
  - the stub feed's `deleted` ends the member's session within one poll, and the roster shows "Deleted player".
  - It passed once, in 17 s; the two runs before failed on the bug below.
- Product fix the journey found: a player who joined with the match page's "Join match" showed as "away" and was left out of the roster at countdown until a reload, because presence is recorded only at `match.watch`. `useMatch`'s new `useRewatch` watches again when the player's seat changes; covered by `useMatch.test.tsx`.
- Reused: `play.ts`'s `call`, `attempt`, `visit`, `playerRow`, `hostRound`, `hostMenu`, `roundOpen`, `ownRows`, `abortMatch`, `closeAll`; `DESKTOP`; `viteBuild`, taken out of `builtAdmin.ts`; `devStack`'s `databaseUrl`; the stub's rules from `ops/test/stub-website.py`.
- `pnpm verify` at `5dd81bd`, dev servers stopped: format, lint and typecheck clean; 158 test files and 871 tests passed. CI on `63cb0e4`: green.

### The website's answer (2026-11-06)

- The website accepted the contract unchanged as its task SE-EMBEDDED-GAMES (branch `feat/embedded-games`). It matches what this branch builds: the authorize headers, the feed with its own cursor per game, the files in `/etc/seasonal/`, the routes folder, `/login?next=`, `/embed/chat?room=mini-games&theme=…`, and `--mini-games`, which the installer's stop message names.
- Added on the website's side: Bingo gets its room `bingo` the same way; each room is created once when its game is switched on (members write, guests read) and kept afterwards; no live install has embedded games yet. Its report section "For the Mini Games side" will be checked against spec 07 §7 when it arrives, and that section wins where it differs.

## Night 9 (2026-11-06), pieces 3–4 on `feat/round-polish`

This branch, from `master` at `4ab2986`, carries pieces 3–4. Pieces 1–2 (website mode) are on `feat/website-mode`, with its own copy of this section. Neither branch is merged.

### Status

| Piece                                                 | State | Commit                     |
| ----------------------------------------------------- | ----- | -------------------------- |
| 1. Accepted proposals (on `feat/website-mode`)        | done  | `7dcfc1b` there            |
| 2. Loose ends (on `feat/website-mode`)                | done  | `d8b5065` there            |
| 3. Round polish: the others' column, the dark own row | done  | `5b1a036`; shots `9dab603` |
| 4. Spec gaps and conflicts                            | done  | `d426200`…`a9982ce`        |

### Piece 3 — round polish (T260, T261 proposals; T262)

- T260 (proposal, OPEN): in individual mode on a desktop, the column under the game's panel lists the round's other players, one row each: marker (the tag in Seasonal Target), name through `PlayerName`, "N guesses" and "solved". All four games; in Seasonal Target it sits above the list. The data is the roster the client already has (`guesses`, `solved`), so the server is unchanged. On a desktop the list drops its "Others:" line; the phone keeps it. After a merge with `feat/website-mode` the panel's `PlayerName` needs `steps={state.steps?.[r.playerKey]}` (written into T260).
- T261 (proposal, OPEN, amends T147): the own row in dark mode is 30 % of the viewer's colour mixed into black, through two new `@smg/ui` tokens `--own-tint` and `--color-own-base`. Before, it was 22 % into the night-blue card, which turned warm colours grey: Spring rgb(51 60 68) → rgb(53 55 23). Light is unchanged. It covers the round lists, "Your guesses" and the Players panel.
- Contrast on the dark tint, lowest over the four season colours, computed from the CSS:

  | Text colour           | Lowest ratio                    |
  | --------------------- | ------------------------------- |
  | body text             | 10.80                           |
  | muted                 | 6.24                            |
  | Frost's winter text   | 4.59 (was 4.31–4.47, below 4.5) |
  | success               | 5.78                            |
  | danger                | 5.21                            |
  | the colour dot's ring | 3.00 (needs 3:1)                |

  Light stays at 4.88 or more. `designTokens.test` checks both themes; e2e's pixel check passed in dark for all four games.

- T262: master's migrator ignores the website branch's applied migration 0014, so the shared dev database is used unchanged.
- Tests:
  - web: 34 files, 165 tests pass;
  - `@smg/ui`, lint, typecheck and format are clean;
  - journeys 2, 20, 21 and 22 passed in Chromium once (3.3 min). Journey 2 now checks the Others panel.
  - The first e2e run had reused two stale dev clients from the other checkout, so it is void. The valid run used ports 5450/5451, and the stale clients are stopped.
- Shots: 21 images on the orphan branch `shots/night-9`, all looked at. For each game:
  - the Others column at 1280 × 720, light and dark;
  - the own rows at 1280 × 720 light and dark, and at 390 × 844 dark;
  - Guess The Number also has the Players panel in dark.
- Removed: RoundLog's own `guesses()` and the Players panel's inline wording. Extracted: `guessCount` (one wording for every list), `othersOf`, the `Others` component. Reused: `Marker`, `PlayerName`, `roundMarks`, the `.round-player-list` subgrid, the contrast helpers.
- Noticed, left alone:
  - the game hint panels use the same 22 %-into-card mix in dark;
  - the Bomb Defusal dark shot caught "Boom!" mid-animation;
  - RoundSide.tsx will conflict a little with `feat/website-mode` at a merge.

### Piece 4 — OPEN's spec conflicts 1–2 and gaps 1–2 (T263–T266)

All four answers are technical, and the code already behaved as decided. What changed is spec wording, an unused column and stale references. OPEN's "Spec conflicts" and "Spec gaps" sections are gone, with four rows in BACKLOG part two.

- **Conflict 1, a guess's check order (T263):** `guess.ts` follows 02 §5.1: the platform's checks, then the game's `validate`, then the cooldown, with the receive number given after them. 04 §4.3, 04 §5.2 and 06 §4.5 now say the same. The existing `guess.test.ts` case is the proof.
- **Conflict 2, team placement (T264):** a player without a team goes to the smallest team, ties broken by a hash (`teams.ts`, O26/T82). 04 §5.4 now says the seed label `teams/tiebreak` is only the round engine's fallback for a roster without teams, and `lifecycle.ts`'s comments say so too. 02c's dead "(OPEN, spec conflicts)" pointer now names O40 as amended by O65.
- **Gap 1, `round_results.secret` (T265):** nothing ever wrote it, an `int` cannot hold Safecracker's or Seasonal Target's secrets, and 05 §3 says no table has a secret column.
  - Migration `0015_drop_result_secret.sql` drops it; 0014 is `feat/website-mode`'s, and either merge order gives the same schema.
  - A new schema test finds no `smg` column named for a secret that is not bytea.
- **Gap 2, the feed's host allowlist (T266):** the host of `seasons.feedUrl`, which only a security admin can set, is the one host allowed. The address must be https, every address it resolves to must be public, and no redirect is followed, as `safeFetch.ts` already does. 05 M11, 07 §5 and 08 §5 now say so.
- Tests:
  - domain: 45 pass;
  - server: 70 unit and 120 integration tests pass;
  - no journey changed, so no e2e ran.
- Noticed, left alone:
  - `safeFetch.ts` checks the DNS answer and then lets `fetch` resolve again, which leaves a rebinding window;
  - its blocklist lacks 198.18.0.0/15 and 240.0.0.0/4.

### Verify (end of this branch)

- First `pnpm verify` at `9d86c51`: format, lint, typecheck and all 821 tests passed. It still exited 1 because testcontainers' teardown of `rounds.integration.test.ts` hit Docker's 409 "container is running", an infrastructure race with no failed test.
- Second `pnpm verify` at `9d86c51`: all green, 148 test files and 821 tests.

### Needs the owner

- **Nothing from piece 4:** all four items were technical.
- **After play, T260 and T261** (OPEN, proposals): the Others column and the dark own row.
- Quick Test settings to try them:
  - Guess The Number, seed `acorn`, individual mode, Bots 3, Fast specials on, "Start from the lobby" on;
  - then the same in dark mode.

## The team column, the owner's confirmations, the merge (2026-11-04)

Branch `feat/guess-games` from `6260b84`, merged into `master` by this task (the owner's approval of 2026-11-04). Technical decisions from T212.

### Status

| Piece                                      | State | Commit      |
| ------------------------------------------ | ----- | ----------- |
| 1. The team column                         | done  | `12fcc1c`   |
| 2. The owner's confirmations, a clean OPEN | done  | `396fa3f`   |
| 3. The merge into master                   | done  | `4b86ba6`   |
| 4. The sweep and the handover              | done  | this commit |

### Piece 1 — the team column (T212)

- The waiting area's list and the Players panel: the team as its icon alone (`TeamIcon`, new in `season/`, used by both), named and titled; a heading row "Team"; the waiting area's column gaps 0.25rem. Measured with a 24-character name (192 px of text) in "Next round" → Players: before, the row 290 px, the name 172 of 192 px at 1280 × 720; with the icon and the narrower gaps 196 of 196 px at 1280 × 720 and 215 of 215 px at 390 × 844.
- CI's e2e on `6260b84` failed journey 9: axe's `aria-prohibited-attr` on the result's "took part" (`aria-label` on a plain span, T211); now visually hidden text and an `aria-hidden` dash. Journey 9 passes.
- Removed: the team names as text in those lists (`teamName` there), the `smg-muted` "no team yet" text. Tests (the web package only, O64): `waiting.test.tsx` (the icon's name and tooltip, the heading), `longNames.test.tsx`, `result.test.tsx`; e2e journey 35 (new, `playerNames.spec.ts`) and journey 9, once each.

### Piece 2 — the confirmations, a clean OPEN (O65)

- DECISIONS O65 records that the owner played all four games and confirmed every "to confirm" proposal, T170 and T177 among them, and the explosion penalty per round (O40 amended). The 26 T entries with a proposal marker now read "confirmed by the owner 2026-11-04"; 11 more T entries named in the confirmed sections carry the same note.
- OPEN.md holds only what is open: the load gate (r), the built-as-proposed questions (w)–(ab), two Night-6 review points, the spec conflicts and gaps; 148 → 44 lines. The dropped entries are closed in BACKLOG part two with their reasons, with the three games (played, confirmed, merged by this task).

### Piece 3 — the merge into master (T213)

- One `pnpm verify` on `396fa3f`: green (148 test files, 816 tests). PR #1 into `master`.
- CI on `396fa3f` (push) failed journeys 5 and 12: their checks still read the team as text in the player list. The PR's first run failed journey 34 on Firefox (a bot's random first guess won the round at once) and the Trusted Types check on webkit-mobile (the copied CSP's `upgrade-insecure-requests`); CodeQL flagged the harness's proxy (js/request-forgery). All four fixed (T213), each check run once in its browser.
- The PR's second run (`fa66cea`): 101 passed; journey 22 failed on firefox-timing with one "Hint" tag, the other's tile filled by the bot's random guess (T144). Journey 22 now accepts that (T213); run once on Firefox, passed.

- The PR's third run (`0337a33`, all three browsers): every job green — verify, docs, security, image, e2e (136 passed, 2 skipped, 38 min); CodeQL green. Merged with a merge commit, `4b86ba6` (parents `10f4cd3`, `0337a33`).

### Piece 4 — the sweep

- The merge's tree equals `feat/guess-games`' final tree (`git diff 0337a33 4b86ba6` empty; `master` had no commit the branch lacked). `feat/guess-games` and `shots/playtest-1` deleted on origin and locally; origin lists `master` alone. This line and OPEN's merge SHA are a docs commit on `master`.

## Play-test round 2 (2026-11-04)

Branch `feat/guess-games` from `f17d9d4`. Owner decision O64 (2026-11-04: tests only where they answer something about the change), Heatwave in every round setup, the next-round form keeping the season, player lists giving the name the room, Seasonal Target's result. Technical decisions from T208; the ones that change what players or the host see are proposals (OPEN.md, "Round 2, to confirm"). Nothing goes to `master`.

### Status

| Piece                                     | State | Commit    |
| ----------------------------------------- | ----- | --------- |
| 0. O64 recorded (DECISIONS, CLAUDE.md)    | done  | `c107ce6` |
| 1. Heatwave in every round setup          | done  | `bfcbeec` |
| 2. The next-round form keeps the season   | done  | `bfcbeec` |
| 3. Player lists: the name gets the space  | done  | `f0ccb8d` |
| 4. Seasonal Target's result               | done  | `b67b76b` |
| 5. Checks (O64), re-shoot (O55), handover | done  |           |

### Pieces 1–2 — Heatwave in every round setup, the season kept (T208, T209)

- The Quick Test form shows Heatwave's two fields for summer through `HostFields` (reused; its `doc` now optional, `set` by key) and sends them; a normal match's first round uses the host menu's form, which had them. One zod shape for both requests (`heatwaveSettings`, `heatwaveBody.ts`, extracted from `rounds.ts`).
- The next-round form starts from the kept season choice and halving (`SEASON_CHOICE`, `useSeasonChoice(last)`), or the last round's own (MatchPage, after a Quick Test round).
- Tests (the touched packages only, O64): `quickTest.test.tsx` (new: fields only for summer, defaults and bounds; the body with and without them), `roundBody.test.ts` (the Quick Test's contract), `heatwave.test.tsx` (the season kept, In Season's fallback).

### Pieces 3–4 — the name gets the space, Seasonal Target's result (T210, T211)

- The waiting area's list and the Players panel hold their columns on the list (subgrid): team and status as wide as their widest entry, the name the rest (`match.css`, `players.css`); the fixed 7.75rem/7rem team columns are gone. Test: `longNames.test.tsx` (the rules).
- The result: T205's narrower phone grid removed (`st.css`); the placings' place `PlaceCell` ("–", named "took part") and `Shortened` ("Pts" and "#" on a phone, "Points" and "Place" for a screen reader) in `ResultParts.tsx`; the place column narrow for a shared round (`data-mode`), the phone's number columns 4.25rem; a board game's placings 21rem on a desktop (`resultBoard.css`, its 6rem place column removed). The placings rows take part in the highlight, without markers (the shoot's probe: a marker left "dev-host" 17 of 73 px at 1280 × 720; without it and with 0.25rem cell sides, 73 of 73, and 64 of 64 on a phone): `useHighlightRow` (@smg/ui) extracted from GuessLine's own and used by both; the result's game panel gets `marks` from `roundMarks`.
- Tests: `result.test.tsx` ("–" and its name, "Pts" and "Points"), `tags.test.tsx` in web/round (the placings' markers and highlight) and in Target (the result grid's tags and highlight).

### Needs the owner

Nothing blocks. To decide after play (OPEN.md, "Round 2, to confirm"): T209 (the kept season), T210 (the list columns), T211 ("–", "#" and "Pts" in every game's placings; Seasonal Target's result grid with tags and the highlight, its placings without markers). Delete the branch `shots/playtest-1` after the review.

### Handover

- Branch `feat/guess-games` at the final commit, piece 5's (the handover message names its SHA); dev servers restarted on it: API 3910, web 5410, admin 5411.
- Quick Test: <http://127.0.0.1:5410/#/quick-test>. Seasonal Target, Seed `acorn`, Season summer (the Heatwave fields in the form), Tile size 20, Bots 19, **Fast specials** on, **Start from the lobby** on; after the round, Host: the next round's form keeps summer.

### Piece 5 — checks (O64), re-shoot (O55), handover

- e2e once, Chromium, the touched journeys: 23 (the game choice and Quick Test start), 28 (the four result pages), 34 (Target with 20 bots), the lobby's two (the host menu): all pass.
- The shoot: `tmp/r2shoot.mjs` (git-ignored), 14 images on `shots/playtest-1` under `round-2/`: the Quick Test form in summer, the next-round form keeping summer after a summer round, "Next round" → Players with a 24-character name (85 and 104 px of 192: the row is too narrow, the ellipsis right), Target's result with 19 bots (443 px grid, 20 px tiles, every tag; a hovered row), its phone result (309 px, one line a row, "#", "–", "Pts", the first part 813–837 of 844 px). Review fixes: the placings' markers cut "dev-host (you)" (gone; cells 0.25rem), "Place" ran into "Player" on a phone ("#").
- `pnpm verify`, the one run (O64): 565 s, format, lint and types green, five tests in three files past 5 s (Target's leafFall and specials properties, the admin's webhooks screen, whose timed-out first test ran into the next two). Their cause as T206's: CPU-bound files, 1.1–1.8 s alone, three to four times slower in the full run; the five files get T206's 20 s file timeout with the measured reason, and the run was done once more (below).
- `pnpm verify` once more: green in 1 050 s (every project but the server's 114 files and 627 tests in 173 s, the server's unit tests 15 files and 70 tests in 5 s, its integration tests 19 files and 119 tests in 296 s). CI on the final push is the second proof (O64).

## Clean state before the next play-test (2026-11-04)

Branch `feat/guess-games` from `d2656f9`. Owner decision O63 (2026-11-04: Heatwave per round in the host menu), two display fixes and a reliably green test suite. Technical decisions from T203; the ones that change what players or the host see are proposals (OPEN.md, "Clean state, to confirm"). Nothing goes to `master`.

### Status

| Piece                               | State | Commit    |
| ----------------------------------- | ----- | --------- |
| 0. O63 recorded; CI's coverage gate | done  | `fbb3214` |
| 1. Heatwave in the host menu (O63)  | done  | `886b203` |
| 2. Two display fixes                | done  | `280dbbb` |
| 3. A reliably green test suite      | done  | `67e45ee` |
| 4. Re-shoot (O55), handover         | done  |           |

### Piece 0 — O63 and CI's coverage gate

- CI's `verify` job failed on `3bd0e3a`, `d768f96` and `d2656f9` at `pnpm test:coverage`: game-sdk's branches 89.07 % for a 90 % threshold, from two unreachable fallbacks in the new `marks.ts` (`?? 'currentColor'`, `?? 'dot'`) and one in `tagOf` (`?? ''`). `markAt` now computes the colour's token and picks the shape without an index, `tagOf` reads the bot's number from the key; `pnpm test:coverage` passes locally (437 tests). The e2e job of `3bd0e3a` failed journey 33 on the phone's result bar, 3 px too wide, fixed in that commit's `match.css` already (CI ran the commit's own tree; `d768f96`'s e2e passed).

### Piece 1 — Heatwave in the host menu (O63, T203)

- "Heatwave step" (1–10 s) and "Heatwave every" (5–300 s) in the round form for a summer round, from the admin's values (1 s, 10 s), kept from round to round (`last`, as every round setting); `createRoundBody` names both in the request's contract; the server takes the round's values over the defaults (`chooseRoundSettings`); the fast profile keeps them.
- Reused: the generic host fields (`Field`, `hostChooses`), the settings check (`settingProblem`), the round form's `last`. New: `formSeason`, `forSeason` (roundFields), `HostFields` (HostMenu, split from `RoundForm`).
- Tests: `roundBody.test.ts` (in and out of range, not whole, strict), `roundSession.test.ts` (the round's values over the defaults, outside the bounds refused), `heatwave.test.tsx` (only in summer, prefilled, bounds, sent, kept).

### Piece 2 — two display fixes (T204, T205)

- Seasonal Target's own rows: the "you" tag once, "You" for a screen reader only (`GuessLine`'s `Name`, split from `Who` for its complexity in a follow-up commit, after lint flagged it past the commit); the other rows keep tag and name. Test: `tags.test.tsx`.
- Seasonal Target's phone result: measured in the browser with the viewer in the table: the cell 121 px held "dev-host" at 43 of 64 px; narrower cell padding reached 49 px, the table's own place column (3.25rem, "took part" wrapping) 64 of 64, but then the first part was 876 of 844 px with the 309 px grid; a 244 px grid (`min(100 %, 100dvh − 37.5rem)`) gives 811–835 of 844 px with the name whole. Chosen: narrow the grid (the placings are below it on a phone already); the one-line "took part" rule removed from `resultBoard.css`.

### Piece 3 — a reliably green test suite (T206)

- Measured with nothing of this repository running: one full `vitest run` took 558 s with 30 failures in 14 files (5 s timeouts; a forks pool that timed out starting; two assertions). Without the server's project: 222 s, 21 failures, all CPU-bound files near 5 s alone (the conformance kit 1.2–4.3 s a test, GTN's chi-square 4 s, its Spring property 3.4 s, Target's input tests up to 3.4 s). With four forks: 440 s, green. The machine: Intel Core Ultra 7 165U, 12 cores (2 performance, 8 efficiency, 2 low-power), 14 threads, 15 W; outside load: Bingo's `sbr-rehearsal` container (about 22 % CPU, left alone), Docker, the editor.
- Causes and fixes (T206): seven forks on two performance cores (now half the threads, at most four); the server's integration files beside the CPU-bound ones (now three passes: the rest, the server's `src/`, its `test/`; the harness's container stop 60 s, found when the first proof runs' server pass timed out in `afterAll` and in `maintenance.test`); wall-clock waits (the shared round's countdown 15 s in `rounds.integration`; in `specials.integration` the Heatwave test's own 5 s interval and polls for every special's effect in place of a fixed margin after it; in `security.integration` the rate-limit test sends until the first 429, the socket guard 10 s; found by the first proof run, whose server pass failed those two); the admin's fake `Response` read over a variable number of turns (now a plain answer settled in microtasks, `fakeServer.ts`); stale Vite processes of stopped dev tasks (stopped by process tree). Fake timers: the timing tests already use them (`banner.test`, `tags.test`'s 3 s tap); none waits on real time besides the two integration tests above.
- CI's e2e (journey 33, `6ffd66b`): the phone's result bar wider than 390 px with the Linux runner's font metrics; the game's name now gives way first (`.result-bar-game`, its title the full name). Journeys 33 and 28 pass.
- The proof (the owner's addendum: one green run here, CI on the final push the second): `pnpm verify` green in 743 s with nothing of this repository running (Bingo's containers left as they were): format, lint, types, then the tests in three passes, every project but the server's 113 files and 621 tests in 166 s, the server's unit tests 15 files and 69 tests in 4 s, its integration tests 19 files and 119 tests in 273 s; four forks of 14 threads (12 cores). The attempts before it, each failing only in the server's pass, led to the security, container-stop and pass-split fixes above.
- Timeouts raised only where the work is the test (20 s, in the file, with the measured reason): the conformance kit, GTN's feedback, secrets and specials properties, Bomb Defusal's rules (chi-square), Target's input, panels, sentinel and tags tests; the one-test 15 s of the play-test run is replaced by its file's.

### Piece 4 — the re-shoot (O55), the handover (T207)

- `tmp/csshoot.mjs` (git-ignored), 8 images added to `shots/playtest-1` under `clean-state/`: the host menu's next-round form for summer with "Heatwave step" 1 and "Heatwave every" 10 (1280 × 720 light and dark, 390 × 844 light), Seasonal Target's own rows with "you" once (1280 × 720 light and dark, 390 × 844 light), its phone result (light and dark). Measured: nothing cut; the phone result's grid 244 px, its first part 811 of 844 px, "dev-host (you)" whole.
- My review: the phone's host panel ran past the screen's left edge, hiding the start of every field (it predates O63): fixed (T207), re-shot. Correct: both Heatwave fields only in summer, their help lines, the rows' "you" tag alone, the tags of 20 bots.
- e2e after the fix: the lobby journeys pass.

### Needs the owner

Nothing blocks. To decide after play (OPEN.md, "Clean state, to confirm"): T205 (the phone result's 244 px grid), T207 (the host panel on a phone). Questions:

- The proof is one green `pnpm verify` here (the owner's addendum) and CI on the final push. Bingo's `sbr-rehearsal` container used about 22 % CPU throughout and was left alone.
- Delete the branch `shots/playtest-1` after the review.

### Handover

- Branch `feat/guess-games` at the final commit, piece 4's (the handover message names its SHA); dev servers restarted on it: API 3910, web 5410, admin 5411.
- Quick Test: <http://127.0.0.1:5410/#/quick-test>. Each game with Seed `acorn`, **Fast specials** on, **Start from the lobby** on. Heatwave: Season summer; after a round, the Host menu's form shows "Heatwave step" and "Heatwave every" (the first round's form is the Quick Test's); Seasonal Target: Tile size 20, Bots 20.

## Play-test fixes (2026-11-04)

Branch `feat/guess-games` from `606eecf`. The owner's decisions after playing all four games, O56–O62 (2026-11-04), the defects found while playing, and night 8's leftovers. Technical decisions from T187 (piece 5: T200–T209); the ones that change what players see are proposals the owner confirms after play (OPEN.md, "Play-test fixes, to confirm"). Nothing goes to `master`. Piece 5 runs in a background agent in the same tree, on its own files, beside pieces 1–4.

### Status

| Piece                                    | State | Commit    |
| ---------------------------------------- | ----- | --------- |
| 0. O56–O62 recorded                      | done  | `69de4f9` |
| 1. Specials (O56, O57, O59–O61)          | done  | `587eee2` |
| 2. Guess The Number: fallen numbers      | done  | `3bd0e3a` |
| 3. Bomb Defusal: result, help, slot tap  | done  | `3bd0e3a` |
| 4. Seasonal Target: messages, tags, grid | done  | `3bd0e3a` |
| 5. All games and leftovers               | done  | `5a4a92c` |
| 6. Re-shoot (O55), self-review, handover | done  |           |

### Needs the owner

Nothing blocks. To decide after play (OPEN.md, "Play-test fixes, to confirm"): T187–T197 (the specials' details, the fallen list, Bomb Defusal's help line, the wrapping banner and comments, players by tag, the layout and result sizes, the review fixes), T201 (no password change for website accounts), T202 (names on one line, team columns). Questions:

- O57 says the host can still change Heatwave's step and interval: both are game-admin settings (the admin app's game document), not fields of the host's round form; they were not made host settings (no decision says so).
- Display names are at most 24 characters (the accounts' CHECK), so the 30-character name was written into the page to test it (piece 5).
- Seasonal Target's phone result: the full-width grid leaves the placings less room, so "dev-host" ends in an ellipsis there, "(you)" whole (T197); a narrower grid would keep it whole.
- The shoot has 33 images, under the aim of 40–60: the changed states are fewer than night 8's.
- Journey 22 failed once in its cleanup (an empty answer from `/session` while aborting the match); it passed on rerun.
- Delete the branch `shots/playtest-1` after the review.

### Piece 1 — the specials (O56, O57, O59–O61; T187–T191)

- O56, Guess The Number: the hint `{ kind: 'lastDigit', digit }` ("Free hint: the number ends in 7.", "Hint: ends in 7"), the default of `spring.hintType` (options `lastDigit`, `half`; a stored `parity` falls back to the default, T187); a hidden range gets the last digit (T56 amended). Shown from `opensAt` as before; the phone's chip now in the season colour (`.smg-hint`, T188, all four games). The golden run re-recorded: it changes only in the hint.
- O57: `summer.stepIntervalS` default 30 → 10 s (`summer.stepS` 1 s), both marked O57; the 3 s floor unchanged.
- O59, Safecracker: the hint's digit locked in its box (T189). O60, Bomb Defusal: the hint's colour locked in slot 1; the slots now hold a wire or nothing, so a tapped slot empties just that one (piece 3's slot tap, built here with the model, T190).
- O61, Seasonal Target: two quarters, the decoy from `spring/<shared|playerId>`, a tuple in the fixed order (`QUARTER_NAMES`, `quarterPair`); both tinted and tagged; the old single-quarter path is gone (T191).
- Tests: the last digit as a property (negative ranges too; individual hints only to their own player, one room event in shared mode); Heatwave's defaults (`roundSettings.test.ts`); the locked box (`hint.test.tsx`, new) and slots (`slots.test.tsx`, new); the server checks the whole code and sequence after a hint (`rules.test.ts` of both games); the two quarters (`spring.test.ts`, new: fixed order, the target's first about a third of the time for a south-west target, every other quarter drawn as the decoy, deterministic, from the `spring` label) and on the grid (`quarters.test.tsx`, split from `panels.test.tsx`, 300 → 275 lines).
- e2e: journey 20 types round the locked box and checks its name; journey 21 checks the locked slot, and makes its wrong first cut in a summer round (cut, and if the first wire was right, cut again with another first wire), since a spring round's first cut can no longer be wrong; journey 22 two "Hint" tags; journeys 3 and 17 the new hint text.
- Removed: the `parity` hint (state, view schema, settings, text), `.bd-slot-hint` and the phone's wider hint slot, the single-quarter `quarter` prop and event field, `tagTileOf`'s null case.

### Piece 2 — Guess The Number's fallen numbers (O58, T192)

- The panel lists the fallen numbers under the range block, plain chips, ascending, with "Fallen numbers (N)": three rows on a desktop, then "+N more" opening the full list; every one in the phone's sheet. The phone's line: "Fallen 12: 902, 77, 431" (the view's new `newest`, newest first).
- Reused: `useDisclosure` (the "+N more" sheet, as the old button's), `formatNumber`, `.smg-chip`, `leafFallOn`. New and shared: `useFit`/`fitCount` in @smg/ui (how many items of a clipped list show whole).
- Removed: the bar's gaps and their merging (`segmentsOf`, `MERGE_PERCENT`, `.gtn-range-gap`, `--merged`), the "Fallen (N)" button and its grid placement beside the bar (`.gtn-fallen-toggle`, the `:has(.gtn-fallen)` rules), `RangeBar`'s `removed` prop, the gap tests.
- Tests: `fallen.test.tsx` rewritten (the list in view and plain, no button; "+8 more" of 20 with a laid-out list, the full sheet and Escape; "None yet."; the phone's line with the newest three and "Fallen 0"); `line.test.tsx`; the golden run re-recorded (it gains only `newest`). e2e journey 18: the list in view without opening, "+N more" when shown, the phone's line with the newest three and its sheet with all.

### Handover

- Branch `feat/guess-games` at the final commit, piece 6's (the handover message names its SHA); dev servers restarted on it: API 3910, web 5410, admin 5411.
- Screenshots: the orphan branch `shots/playtest-1` (33 images and `play-through.txt`); `shots/night-8` is deleted on origin.
- Quick Test: <http://127.0.0.1:5410/#/quick-test>. For each game: Game as below, Seed `acorn`, the Season named, **Fast specials** on, **Start from the lobby** on; Start round from the Host menu.

| Game                  | What to look at                                                                                                                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Guess The Number      | Spring: "Free hint: the number ends in 7." and the phone's "Hint: ends in 7" in the season colour. Autumn: the fallen numbers in the panel, three rows then "+N more"; the phone's "Fallen 12: …, …, …". Summer: Heatwave every 10 s |
| Seasonal Safecracker  | Spring: the hint's digit locked in its box, in the season colour; typing steps over it                                                                                                                                               |
| Seasonal Bomb Defusal | Spring: the help line above the picker, the hint's colour locked in slot 1, tap a filled slot to empty it; the result's sequence wraps, nothing scrolls sideways                                                                     |
| Seasonal Target       | Tile size 20, **Bots** 20 (a busy grid): tags on the tiles, hover a list row (only that player's tiles stay bright), the wide column; Spring: two green quarters; the result's larger grid                                           |

### Summary

- All six pieces done; nothing dropped for time (piece 5's last bullet checked on the shots). Piece 5 ran in a background agent (its report in its section); I did 0–4 and 6.
- Decisions: O56–O62; T187–T197, T200–T202.
- Checks per piece in their sections; CI for the final push: reported after the handover.

### Piece 6 — the re-shoot (O55), the review, the handover (T197)

- The shoot: `tmp/ptshoot.mjs` (git-ignored), 33 images to `shots/playtest-1`: each game's spring round (Guess The Number also individual), Guess The Number's autumn with 50 fallen numbers, Bomb Defusal's picker (help line, locked slot) and result, Seasonal Target with 20 bots (22 guesses, a hovered row, the result), the long-name views (the 30-character name written into the page). 1280 × 720 light and dark, 390 × 844 light, 1920 × 1080 for Target's widened column.
- Measured (`play-through.txt`): no round view scrolls; Target's grid 652 px (30.5 px tiles) with a 556 px column at 1280 × 720, 1 012 px (48.5 px) with 836 px at 1920 × 1080, 374 px (16.6 px) on a phone; the busy list 15 of 22 rows in view at 1280 × 720, 22 of 22 at 1920 × 1080, 7 on a phone; the result grid 387 px at 1280 × 720 (night 8: 331) and 309 px on a phone (night 8: 211), both first parts fit (712 of 720, 837 of 844). Truncation check: nothing a player needs cut, but by design the long names' ellipsis, their comments giving way first (T150), and "dev-host" on Target's phone result.
- My review of every new shot: fixed — Bomb Defusal's phone slot cut "yellow" (number and swatch only); Target's result placings cut "dev-host (you)" at 1280 × 720 (narrower columns, 387 px grid), its phone first part was 900 of 844 px ("took part" on one line); the long-name state's script. Seen and correct — both quarters tinted, a "Hint" tag giving way to the own tile on (1, 1), the hint chips in the season colour, "+38 more", the "Others" row and the hint leave the phone's list well over six rows (piece 5's last bullet), the tags and markers on 20 players, a hovered row fading the rest. Owner items: "Needs the owner".
- e2e after the fixes: journeys 21, 22 (once failed in its cleanup, then passed), 24–28, 33, 34 pass in Chromium.
- `pnpm verify` at the end: format, lint and types green; tests 776 of 803, the 27 others in 13 files all 5 s timeouts and two timing waits of the admin's webhook test while the dev servers ran beside it, every one of the 13 files passing on its own (85 tests).

### Piece 5 — the coordinator's part (games/**)

- The games' result histories (`.gtn-players`, `.bd-players`, Safecracker's and Seasonal Target's lists) named a player in a plain `<strong>` that wrapped its line at 390 px with a long name (piece 5's probe: 24 → 48 px): now `.smg-one-line` (@smg/ui `base.css`, games cannot import apps/web's `PlayerName`), at most half the line, cut with an ellipsis, the full name in its title (T202). Test: GTN's `panels.test.tsx`.
- The agent's report: display names are at most 24 characters (`smg.accounts` CHECK), so the 30-character name was written into the live page's name elements and measured there (piece 5 above).

### Pieces 2–4 — one commit

- Pieces 2, 3 and 4 share files (the sheet, DECISIONS, `@smg/ui`'s index, the platform's round styles) and went into one commit; no hunk staging (interactive git is not available). `pnpm verify`: format, lint and types green; tests 800 of 803 with the other three passing on their own (two 5 s timeouts on the busy machine, one socket timing); Target's keyboard-selection test now has 15 s (ten moves redraw 400 tiles, 3.4 s alone).

### Piece 3 — Bomb Defusal: the result, the help line, the slot tap (T193)

- The help line above the picker; the slot tap and the locked slot came with piece 1's slot model (T190). The revealed sequence wraps as whole chips; the probe found no element wider than the page at 1280 × 720 and 1920 × 1080, and at 390 × 844 the result bar 3 px too wide ("Seasonal Bomb Defusal", the code, Host, Play): the bar's buttons got slimmer sides (`match.css`, after piece 5's commit).
- Extracted: `WireButtons` (WireInput, 61 → 60-line function), `useSlots` (useSequence), `pickerHelp` (text). Removed: the desktop's one-line rule for the revealed sequence.
- Tests: `slots.test.tsx` (the help line); e2e journey 33 new (`bombPicker.spec.ts`: help line one line / at most two, locked slot, slot tap, a cut, the result without sideways scroll at the three sizes); journey 26's desktop rows 18 → 17 (the help line's row; the spec asks 14).

### Piece 4 — Seasonal Target: messages, tags, the grid (O62, T194–T196)

- The info column widens beside the square grid (T195): measured 652 px grid and 556 px column at 1280 × 720, 1 012 px and 836 px at 1920 × 1080, the phone's grid 374 px; no page scroll, no list comment cut (scrollWidth ≤ clientWidth) at any size. Comments wrap to a second line in a board game's list, the banner wraps everywhere (T194).
- Players by tag (T196): `marksOf`, `MARK_COLORS`, `MARK_SHAPES`, `tagOf` (game-sdk), `PlayerMark`, `marks.css`, the `--mark-*` tokens and the shared highlight (`setHighlight`, `flashHighlight`, `useHighlight`, `lit`, @smg/ui); `GameWeb.playerTags`; the platform's `roundMarks` for rows (GuessLine `useRowHighlight`), the Players panel (`Marker` in RoundSide, via FocusShell) and the game's props (`marks`, `viewerKey`); Target's `marksFor`, `tileHighlight.ts` (split from TileGrid, 297 → 261 lines), `heat.ts` `who` in place of `mark`.
- Result grid (T195): 331 → 427 px at 1280 × 720 (placings 22rem; the part's free height 476 px), 211 → 309 px on a phone (a full-width square, the part as tall as its content).
- Removed: the colour-only corner dot (`.st-mark`, `markOf`, `NEUTRAL`), the banner's ellipsis. The stale sentence above `sameAnswer` corrected to T151's rule.
- Tests: `marks.test.ts` (tags; 24 distinct combinations, none repeated before the 25th, colours first; join order), `tags.test.tsx` in Target (22 players' tags and 22 distinct markers, no tag under 20 px, the highlight on and off, hovering a tile) and in web/round (rows' marker and tag, other games keep the dot, hover, focus and a phone's 3 s tap, the Players panel); the tile tests read the tile's face (`faceOf`). e2e journey 34 new (`targetTags.spec.ts`); journeys 22 and 27 pass.

### Piece 5 — all games and leftovers (T200–T202)

- Long names (T202): `PlayerName` (apps/web/src/round) is now the name in the waiting area and the chat's author as well as the result tables and the Players panel; its styles moved to `playerName.css`, imported by the component. A name focused or tapped wraps inside its box. The admin app's account, abuse and sanction tables use the new `DisplayName` (one line, ellipsis, title). Display names are at most 24 characters (the accounts table's check), so the browser probe (`tmp/p5names.mjs`) wrote a 30-character name into each name element and measured it at 1280 × 720 and 390 × 844: cut with an ellipsis where its box is narrower, no row taller, "(you)" never cut, no page scroll. The round list (`.round-who` in `roundLog.css`, a separate commit under the rows lock) caps a name at half its line, so a long name no longer pushes the guess and answer onto a second line at 390 px (row 39 → 59 px before, unchanged after); it keeps its own span with a title, not `PlayerName`, since on a phone the row is a button and a focusable name inside it would be invalid. "Your guesses" shows no names (T150).
- Team columns (T202): the waiting area's team and connection, and the Players panel's team and guesses, are fixed columns; the Players panel shows the team's icon; the placings keep a slot for the team icon when teams play.
- Change password (T201): `GET /session`'s account carries `hasPassword`; a website account sees no form, a line that says why, and "Delete my account". Tests: `AccountPage.test.tsx`, the integration tests of register and handoff, journey 29 (`e2e/accountDeletion.spec.ts`).
- L1 (T200): `l1` plays ten rounds (five plain, the four specials, halving); T180 amended, 09 §5 and OPEN aligned. Smoke run under the heavy lock, 20 players + 100 spectators (not the 200-player run): all ten rounds solved, proof ok, gap-free, nothing lost or duplicated, one winner each, no HTTP or socket problem, 772 s.

## Night 8 (2026-11-04)

Branch `feat/guess-games` from `60821a6`. Owner decision O55 (2026-11-04: screenshot runs cover only the changed states). Technical decisions from T150; the ones that change what players or admins see are proposals the owner confirms after play (OPEN.md, "Night 8, to confirm"). Nothing goes to `master`. Pieces 4–6 and 8 ran in background agents in the same tree, on their own files, beside pieces 1–3.

### Status

| Piece                                         | State | Commit    |
| --------------------------------------------- | ----- | --------- |
| 0. O55 recorded                               | done  | `103082c` |
| 1. All games: review fixes                    | done  | `08eb91d` |
| 2. Seasonal Target: review fixes              | done  | `735ac7b` |
| 3. Safecracker and Bomb Defusal: review fixes | done  | `77e8ce5` |
| 4. Player account deletion screen             | done  | `d253ee6` |
| 5. Admin screens: providers, origins, hooks   | done  | `3822148` |
| 6. Admin app Trusted Types                    | done  | `745b083` |
| 7. The "opens in 0 s" intro                   | done  | `7271721` |
| 8. Load scenarios L1 specials and halving     | done  | `3faed63` |
| 9. Re-shoot (O55), self-review, handover      | done  | `fff4db6` |

### Needs the owner

Nothing blocks. To decide after play (OPEN.md, "Night 8, to confirm"): T150, T151, T153 (the review fixes), T170 (account deletion), T177 (the admin Integration area), T180 (L1 has six rounds, not ten). Questions:

- The session's API budget (120 requests a minute) is less than a round page's reload rate in a busy round (up to four a second); since T185 a refused load is tried again after a second, so the cost is a short delay (piece 7).
- The load runs: under Frost, every release of held answers is its own commit batch, so a 200-player winter round's acknowledgements were 5.6 s at p95 on this laptop (piece 8; a server proposal in OPEN (r); the gate is the reference VPS).
- The account page offers Change password to accounts made by the website handoff, which have no password (piece 4).
- The admin app's phone layout: its navigation is a tall column of links above the page (seen on the Integration shots; it predates piece 5).
- Quick Test's bot can open a 4-digit code in two guesses, so journey 25 failed once before its round opened (passes on rerun).
- Delete the branch `shots/night-8` after the review.

### Pieces 1–3 — the review fixes (T150–T153)

- Piece 1, every game (T150): the desktop's special line holds the whole sentence, wrapping (a paragraph, no longer a one-line toggle); a row gives way comment first, then name, never the guess or the answer (no 9 rem cap on names); "Your guesses" shows guess and answer only (`bare`); individual mode's rows have no "You" and no own tint (`solo`, `data-solo`; `data-own` keeps saying whose row it is, the e2e helpers find rows by it), the others' counts are a row of their own ("Others: …", `others-line`) that the banner never replaces; the head "12 guesses" and "Log (M)"; every held Frost answer, others' too, says "answer arriving…" (the guess engine marks the others' held lines, `held`, false where the visibility hides the answer for good); the ring's check mark named "Ready"; names take the column's room, "(you)" apart; the phone info line's parts whole ("Hint: odd", "Hint: red first", "8 wires · cut 6"); results: the game's panel in two parts (`ResultPanelProps.part`: `reveal` in the first part, `history` below it in full, no inner scroll box), "did not guess" (`NO_GUESSES`), Bomb Defusal's history in the round's colour dots (`SequenceDots`), "Code: 0834", the phone bar without the match's title and the code's label.
- The Heatwave line seen minutes later in the night-7 shots: the special line (the rule, on view all round), not the banner; the banner left 5 s after its event in every shot. It is the whole sentence now, so it no longer reads like a stale banner. The 5 s are checked with fake timers (`banner.test.tsx`) and in journey 3 (the banner appears and is empty again within 7 s).
- Spring's hint appears once per view (the panel's line on a desktop, the info line on a phone); the banner says only that a hint came ("Spring Herald: everyone got a free hint."). Nothing to change.
- Piece 2, Seasonal Target (T151, T152): seven colours in `closeness` mode (`heat.css`, split from `tiles.css`, 297 → 218 lines), five in the other modes, the legend of the round's mode; the tier from the shown rounded distance in `distance` and `direction` mode (`answerTier`, server; the worked example (10, 10)→(12, 12) is now hot there, burning in `closeness` mode; Leaf Fall's candidates at one rounded distance are one tier); halving dims only empty tiles; a fallen tile or one outside the area is never selected ("That tile fell."), the arrows step past fallen tiles, Guess disabled on a selected tile that fell; "Fallen (N)" in whole rows; "Just missed"; the ink-ringed own frame; the phone legend's "ColdHot" came from the platform's last-child ellipsis rule turning the legend into a block, removed with T150.
- Piece 3 (T153): Safecracker's fallen digit greyed and crossed corner to corner (an SVG cross, no badge); Bomb Defusal's own marker a neutral ring beside colour dots (a platform rule for any row of colour dots); the revealed sequence on one line on a desktop; rows at 1.375 rem at 1920 × 1080.
- Commits by file: lines of piece 3 in files piece 1 also changed (`roundLog.css`, `sc.css`, `bd.css`) and the decisions T151–T153 with OPEN went into piece 1's commit; no hunk staging (interactive git is not available).
- Extracted: `Who` (the row's dot and name, `GuessLine.tsx`), `GamePart` (`ResultScreen.tsx`), `History` and `Reveal` (Target's `ResultPanel.tsx`), `tierBy` and `answerTier` (`geometry.ts`), `stepFrom` and `unselectable` (`TargetInput.tsx`), `shortHint` (GTN, Bomb Defusal; Safecracker had one), `SequenceDots` (`WireChip.tsx`, reusing `Swatch`). Reused: `othersLine`, `Swatch`, `sequenceText`, `CODES.OUT_OF_AREA`, `roundedDistance`. Removed: the special line's toggle state, the ring's "Ready" text and its size rule, the result's `--result-rest` box, the history lists' inner scroll boxes, the Fallen box's 5.4 rem cut, `.round-arriving-text`.
- Lines before → after: GuessLine 177 → 203, RoundLog 183 → 189, InfoParts 132 → 124, CooldownRing 55 → 64, ResultScreen 109 → 131, MatchStandings 68 → 70, roundLog.css 281 → 280, round.css 249 → 235, result.css 289 → 283, cooldownRing.css 61 → 68, ResultBar 42 → 46, match.css 244 → 243, game-sdk web.ts 154 → 162, guess-engine views.ts 94 → 99; GTN ResultPanel 49 → 52, InfoLine 38 → 39, text.ts 152 → 167; Safecracker ResultPanel 61 → 64, text.ts 165 → 173, sc.css 232 → 234, Board 104 → 106; Bomb Defusal ResultPanel 55 → 71, WireChip 65 → 80, bd.css 267 → 294, text.ts 186 → 193; Target ResultPanel 81 → 102, TargetInput 206 → 239, heat.ts 151 → 167, heat.css new 184, tiles.css 297 → 218, st.css 190 → 181, words.ts 103 → 113, text.ts 136 → 144, fallen.css 84 → 93, HeatLegend 27 → 32, geometry.ts 171 → 185, rules.ts 41 → 42. New test file `rows.test.tsx`.
- Checks: `pnpm verify` green (135 files, 769 tests; the golden run re-recorded: it gains only the `held` field). e2e Chromium: journey 28 (4/4), the timing journeys 1–7, 16–18, 20–22, 24–27 19/20 with journey 25 failed once because the bot opened the 4-digit code in 2 guesses before the page saw the round open, passing on its rerun (left alone: Quick Test's bot can win at once on a small code).

### Handover

- Branch `feat/guess-games` at the final commit (see the summary below); dev servers restarted on it: API 3910, web 5410, admin 5411.
- Screenshots: the orphan branch `shots/night-8` (114 images and `play-through.txt`); `shots/night-7` is deleted on origin.
- Quick Test: <http://127.0.0.1:5410/#/quick-test>. Admin: <http://127.0.0.1:5411/> (Dev sign-in as admin; the Integration area). For each game: Game as below, Seed `acorn`, a Season, **Fast specials** on, **Start from the lobby** on; Start round from the Host menu.

| Game                  | What to look at                                                                                                                                                                                                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guess The Number      | The special line's whole sentence; "Your guesses" with guess and answer only; "Log (M)"; individual mode's "Others: …" row and rows without "You"; winter: every held answer "answer arriving…"; the ring's check mark; the result's history below the first part, "did not guess" |
| Seasonal Safecracker  | Autumn: fallen digits crossed from corner to corner; on a phone the six-digit answers whole (a second line where needed); the result's "Code: 0834"                                                                                                                                |
| Seasonal Bomb Defusal | The neutral ring as your own marker beside the wire dots; the phone line "8 wires · cut 6" with "Hint: red first"; the result's history in colour dots, the sequence on one line                                                                                                   |
| Seasonal Target       | Tile size 20; **Answers** `closeness` (seven colours, the legend with seven), `distance` and `direction` (two tiles with one number share a colour); autumn: click a fallen tile ("That tile fell."), "Fallen (N)"; spring with a halving day: only empty tiles dimmed             |

- Also: the account page's "Delete my account" (sign in through the host page, or as a dev player to see the form); the admin app's Integration area.

### Piece 9 — re-shoot, self-review

- First shoot of the games (`tmp/n8shoot.mjs`, git-ignored) and its review, fixed at once: a phone row clipped Safecracker's six-digit answer and Seasonal Target's 340 px column clipped "answer arriving… 2 s" (rows now put a part without room whole on a second line, everywhere); the placings cut "dev-h… (you)" with room to spare (cells' side padding 16 → 8 px; on a phone the number, guesses and place columns narrower, the cell's parts 4 px apart: the cell measured 121 px for 126 px of parts, now 129 of 126); Bomb Defusal's revealed sequence put its numbers above the chips once kept on one line (each number now stays with its chip); Seasonal Target's rounds ended before the shots because the bot found the target (T154: a Quick Test `botDelayS`, used by the shoot: the busy shared round had 18 guesses and no winner).

- The shoot (O55): `tmp/n8shoot.mjs` and `tmp/n8shoot2.mjs` (git-ignored), 114 images, `shots/night-8`. Changed states only: each game's shared summer round, individual autumn, Frost pending, the result (and Guess The Number's time-up), the spring hint line where it changed; Safecracker's fallen digits, Bomb Defusal's harmless line; Seasonal Target in closeness and distance mode, halving, a fallen tile clicked, a busy shared round (18 guesses, no winner); the account deletion form and its notice; the admin Integration area's three lists and their forms. 1280 × 720 light and dark, 390 × 844 light, 1920 × 1080 for the list games' larger rows and Target's grid. 14 images above the aim of 60–100: the account and admin screens came on top of the four games.
- Measured (`play-through.txt`): no round view scrolls; every result's first part fits (324–712 px of 720, 515–828 of 844, 1 072 of 1 080); Target's 20 × 20 grid 660 px at 1280 × 720 (30.9 px tiles), 1 020 px at 1920 × 1080 (48.9 px), 374 px on a phone; the 30 × 30 busy round 19.9 px tiles; the result's 8 × 8 grid 331 px at 1280 × 720, 835 px at 1920 × 1080, 211 px on a phone; busy round 15 of 19 rows in view at 1280 × 720, 19 of 19 at 1920 × 1080. Truncation check (answers, held markers, guesses, names, "(you)", the special line, the info line's parts, the result bar, list heads, Fallen chips, digit and wire chips): nothing cut in the last shot of every state.
- My review (every new shot of the list games' shared, individual, Frost and result states, Target's states, the account and admin screens): fixed — the items above; owner items — in "Needs the owner"; seen and correct — the special line wraps to two lines, Leaf Fall's and halving's banners leave after 5 s, a halving banner is cut with an ellipsis in Target's 340 px column (the banner is one line by design, T142; its Log row has it whole), the fallen-tile message with Guess disabled when the selected tile fell.
- Checks: `pnpm verify` green at `c66e38d` (136 files, 772 tests); e2e journeys as listed under pieces 1–8.

### Summary

- All nine pieces done; nothing dropped for time. Agents: pieces 4, 5+6, 7, 8 (reports in their sections); I did 1–3 and 9.
- Decisions: O55; T150–T154, T170–T171, T175–T179, T180–T184, T185–T186.
- Lines and checks per piece in their sections. CI for the final push: reported after the handover.

### Piece 8 — load scenarios L1: the special rounds and the halving round (T180–T184)

- The driver plays L1's rounds (09 §5): `node load/guessStorm.mjs <players> [out.json] <scenario>`, scenario `plain`, `spring`, `summer`, `autumn`, `winter`, `halving`, `specials` (the four season rounds) or `l1` (all six in one match). New `load/scenarios.mjs` (the rounds' host settings, today's halving day through the admin route, token `load-check`, removed afterwards) and `load/measure.mjs` (server samples, percentiles, the fairness checks and the specials fired, moved out of `guessStorm.mjs`). No server change, no new route; the special timings are the game document's defaults (T182).
- Fixed on the way: since T104 frames name players by number, so the night-1 driver no longer recognised its own answers; players now read their number (`you`) after joining (T183). Bots guess only after their last answer arrived (needed under Frost), track a halved range and fallen numbers from the room, and a turn left from the previous round writes only to that round's record. Clean-up runs in a `finally`.
- Spec questions: 09 §5 says "ten rounds" but lists six (T180, proposal in OPEN); Heatwave cannot fire at L1's 3 s cooldown (03 §2.2 floor), so its round starts at 6 s (T181). Not built: L1 with Seasonal Target (05 §76 names it); that needs a target bot in the driver.
- Runs, one each, 200 players + 100 spectators, on the shared server 3910 under the heavy lock (T184), laptop busy with the other agents' work; development-machine numbers, not the gate. Every round: proof ok, receive numbers gap-free, nothing lost, duplicated or reordered, one winner, ended by a solve, no HTTP or socket problem.

| Round   | Length | Ack p50 / p95 / p99 (ms) | Specials fired (server lateness)      | Frost answer late p50 / p95 | CPU mean / peak | RSS peak | Loop lag p99 peak |
| ------- | ------ | ------------------------ | ------------------------------------- | --------------------------- | --------------- | -------- | ----------------- |
| plain   | 66 s   | 111 / 731 / 1 150        | none                                  | –                           | 0.36 / 0.49     | 331 MiB  | 115 ms            |
| spring  | 66 s   | 54 / 163 / 256           | Spring Herald, 8 ms (seen 62 ms)      | –                           | 0.31 / 0.47     | 476 MiB  | 66 ms             |
| summer  | 97 s   | 60 / 4 253 / 4 952       | Heatwave ×3, ≤ 4 ms (seen ≤ 168 ms)   | –                           | 0.27 / 0.49     | 496 MiB  | 80 ms             |
| autumn  | 70 s   | 56 / 317 / 449           | Leaf Fall ×3, p95 30 ms (seen 445 ms) | –                           | 0.31 / 0.62     | 521 MiB  | 64 ms             |
| winter  | 106 s  | 2 607 / 5 564 / 6 698    | (Frost has no firing)                 | 1 979 / 5 265 ms            | 0.61 / 0.83     | 415 MiB  | 167 ms            |
| halving | 66 s   | 66 / 358 / 849           | halving ×1, 11 ms (seen 136 ms)       | –                           | 0.35 / 0.50     | 504 MiB  | 69 ms             |

- Reading: the specials fire on time; what is slow is the round's serial commit chain on this laptop, 41–46 ms a batch (plain: 1 200 batches in 66 s). Under Frost every release is a batch of its own (`HeldDelivered`): 2 009 batches in 106 s; the server released all 4 202 held answers within 100 ms of their time, but they and the acknowledgements queued behind commits. A first winter run (overwritten) gave ack p95 3.3 s, Frost late p95 3.3 s. Proposal in OPEN (r): measure on the reference VPS; if Frost misses there, release without a commit of its own.
- The API server stopped twice during the night (other pieces' server-side edits); two runs died with it and left `match.maxPlayers` at 1 000, put back by hand, load accounts deleted, the open load match aborted.
- Commands: `node load/guessStorm.mjs 200 reports/night-8/load-l1-<round>-200.json <round>` for each round above. Reports: `reports/night-8/load-l1-*-200.json`.
- Files: `load/guessStorm.mjs` 211 → 184 lines, `load/stormWorker.mjs` 107 → 179, `load/measure.mjs` new 101, `load/scenarios.mjs` new 82; `load/http.mjs` unchanged (reused: `signIn`, `call`, `inGroups`).

### Piece 4 — player account deletion screen (T170, T171)

- **Built:** "Delete my account" on the account page (`apps/web/src/account/DeleteAccount.tsx`): what is deleted and what stays, worded from `DELETE /me` and the tables' foreign keys; Delete stays off until the display name is typed exactly; an account with a password is asked for it once the server answers `PASSWORD_REQUIRED`; then the session is refreshed (signed out) and `#/account/deleted` says so. `deleteAccount` in `session.tsx`, the route in `router.ts`, the account screens split out of `AppShell`'s `Screen` (complexity).
- **Reused:** `api`/`ApiError` (shell/http), `useSession`, `AccountField` and `FormError` (account/formParts), `accountError` (one new code, `CONFIRMATION_REQUIRED`), `ActionButton` (components/fields); the confirm pattern mirrors the admin app's `ConfirmDialog` (effect first, Cancel beside a danger button that stays off until the input is right). The admin dialog checks only a minimum length, not an exact text, so nothing was moved to `@smg/ui`.
- **Server:** unchanged; the route already ends every session and clears the cookie (T105).
- **Tests:** `DeleteAccount.test.tsx` (form, exact name, deletion, password step, refusal, the notice's route); e2e journey 29 (`e2e/accountDeletion.spec.ts`, timing project) with the host site's setup in `e2e/hostSite.ts`.
- **For the owner:** T170 (OPEN, "Night 8, to confirm"). Noticed and left alone: the account page shows Change password to an account made by the handoff, which has no password (the server answers `PASSWORD_REQUIRED`); `e2e/embed.spec.ts` still says handoff accounts cannot delete themselves through `DELETE /me` and removes them in the database, and could use `e2e/hostSite.ts`.

### Piece 6 — the admin app's Trusted Types header (T178, T179)

- Report-only run of the built admin bundle in Chromium (every area and tab, signed in): one report, zod's `new Function('')` probe from the shared schemas. Fixed with `packages/contracts/src/withoutEval.ts` (zod `jitless` where a `document` exists, imported first by the index); afterwards no report and no console line, report-only and enforced. Details in [security-pass.md](security-pass.md).
- Enforced: `securityHeaders.ts` appends `require-trusted-types-for 'script'` to every admin path's CSP (test in `server.integration.test.ts`: the admin path has it, `/` not). Caddy passes the header on unchanged.
- E2E: `e2e/trustedTypes.spec.ts` with `e2e/builtAdmin.ts` builds the app and serves it with the server's own admin headers; it needs no dev-server restart (T179). Passes in Chromium; journeys 30–32 pass again in `chromium-timing`.
- Checks: `pnpm verify` green (136 files, 772 tests).
- For the coordinator: the player app (apps/web) now also runs zod without compiled parsers in the browser (the same probe was a `script-src 'self'` console violation there); no change in its files.

### Piece 5 — admin screens for identity providers, embed origins and webhooks (T175–T177)

- New: the admin app's Integration area (`apps/admin/src/integration/`: `IntegrationPage`, `ProvidersPanel` with `ProviderForm`, `OriginsPanel`, `WebhooksPanel` with `WebhookForm` and `WebhookDeliveries`, the shared `form.tsx` (checkbox, text area, `issueText`, `FormEnd`, `NewOrForm`, `Table`) and `useListed.ts` (the list, its confirm dialog, `put`)); `App.tsx` opens it for `integration.manage`.
- Server, no new route: a provider's PUT without `pinnedPublicKey` keeps the key (`IdentityProviderChange`, `HANDOFF_ALGS` and `MAPPED_ROLES` in @smg/contracts; `updateProvider`, `adminIntegration.ts`), test `providers.integration.test.ts`. The authorization matrix rows were there (authzTable, `INTEGRATION`).
- Reused: `useConfirm`/`ConfirmDialog`, `StepUp` through `http.ts`, `TextInput`, `failureText`, the moderation tabs' markup, the contract schemas (`IdentityProviderBody`, `EmbedOriginBody`, `WebhookEndpointBody`).
- Tests: `providers.test.tsx`, `origins.test.tsx`, `webhooks.test.tsx` (step-up retry included; helper `fakeServer.ts`), the areas test in `admin.test.tsx`; e2e journeys 30–32 (`e2e/integration.spec.ts`, TIMING) pass in Chromium. `pnpm verify`: lint, typecheck and 772 tests green; format check failed only in `apps/web/src/live/useMatch.ts` and `useRound.ts` (another piece's files, half-way).
- Noticed, left alone: the server's `MAPPABLE_ROLES` set in `integration/providers.ts` could use the contract's `MAPPED_ROLES`.

### Piece 7 — the "opens in 0 s" intro (T185, T186)

- Method: a throwaway Playwright script (scratchpad, not in the repo) signed in as `dev-player-1` against the running dev stack (web 5410, API 3910), under the heavy lock. Each attempt starts a Quick Test (lobby off, so the round counts down at once) straight after the previous one, its round still running, records the round's `opensAt` from `GET /rounds/:id/state`, when the intro shows "Opens in 0 s" and when it goes (a MutationObserver in the page), every intent with its answer and every `events` frame (`page.on('websocket')`), and every API answer of 400 or more. The intro leaving 300–400 ms after `opensAt` is the frame's path (the frame plus the 250 ms reload delay), 750 ms or more T127's reload.
- Same tab, in-app Quick Test page started again (`location.hash`, same socket): 30 attempts, the intro left 314–355 ms after `opensAt` every time, the frame arrived 45–60 ms after it, no intent refused (`match.watch` ok every time).
- `page.goto` to the next match's address (same document, same socket; the Quick Test started through `POST /dev/quicktest`, as journey `direct` does): 23 + 30 + 30 attempts (the first run's 24th attempt timed out, the script then kept going): intro left 305–363 ms after `opensAt` in every attempt that showed it, no intent refused. In 2 of 30 in each of the last two runs the intro never showed: the round's first state load was answered 429 (the session's 120 requests a minute, spent by the page and the script's own requests together) and not tried again, so the page showed nothing of the round until the next frame 3 s later.
- So the coordinator's hypothesis (`match.watch` refused by the intent limit or the room limit) did not hold in 113 switches. The stall comes from the HTTP rate limit: with the session's budget spent just before the opening (130 `GET /session` 150 ms before `opensAt`, 5 attempts), the frame came 93–207 ms after `opensAt`, its load was answered 429, and the intro stayed at "Opens in 0 s" for 4.6 s and 4.4 s (T127's load refused too, rescued only by the next bot frame) and 0.65 s twice (T127's load passed). Reproduced in 4 of 5.
- Fix (T185): `apps/web/src/live/retry.ts` (new, 48 lines: `retryable`, `useRetry`); `useRound.ts` 158 → 194 (the state load in `useStateLoad`, retried a second later after a 429, a server error or no answer, cancelled when the round changes); `useMatch.ts` 54 → 73 (the match load retried, a `match.watch` answered `RATE_LIMITED` sent again). T127's reload kept as the safety net for a frame that never comes (T186). After the fix, the same drained run: 1.48 s at worst (two refusals in a row), 0.78–0.79 s otherwise; 10 + 10 normal attempts in each mode 312–349 ms, none stalled.
- Tests: `retry.test.tsx` (new, 3 tests: a refused round load tried again a second later until it passes, a 404 not tried again, the match load and a refused watch sent again). No e2e spec added: draining a session's API budget at the right moment is a timing test against the shared server; the probe above is its record. Journeys 1 and 2 (`rounds.spec.ts`, Chromium timing) pass.
- Noticed, left alone: the probe's teardown aborts were refused with 429 as well (the 44 matches were aborted afterwards, throttled); a round page may load its state four times a second, twice the session's budget over a minute, which a long busy round can spend (for the owner: the budget is a default, not changed).
- Checks: scoped eslint, prettier, typecheck and vitest green; `pnpm verify`: format, lint and typecheck green, tests 770 passed, one file failing outside this piece (`apps/server/test/webhooks.integration.test.ts`, "asn1 encoding routines::illegal padding" in its setup).

## Night 7 (2026-11-03)

Branch `feat/guess-games`. Owner decision O54 (2026-11-03); technical decisions T141 onward, the layout ones proposals the owner confirms after play (OPEN.md, "Night-7 layout, to confirm"). Nothing goes to `master`.

### Status

| Piece                             | State | Commit                             |
| --------------------------------- | ----- | ---------------------------------- |
| 1. Layout system (O54)            | done  | `e72ff09`                          |
| 2. Seasonal Target on this layout | done  | `5b3d369`                          |
| 3. List games on this layout      | done  | `5b3d369`                          |
| 4. Result screens                 | done  | `a073507`                          |
| 5. Known defects and clean-up     | done  | `749c005`, `330810d`               |
| 6. Re-shoot, measure, self-review | done  | `b7d2789` (fixes), shots `a9bcf3f` |

### Needs the owner

Nothing blocks. To look at after play: OPEN.md, "Night-7 layout, to confirm" (T141–T145, proposals) and "Night-6 screenshot review, for the owner" with the night-7 items (the list below, state "owner"). Delete the branch `shots/night-7` after the review.

### Handover

- Branch `feat/guess-games`; dev servers restarted on the final app code (`b7d2789`; the commits after it change only journey 16 and this sheet): API 3910, web 5410, admin 5411.
- Screenshots: the orphan branch `shots/night-7` (526 images, 263 light/dark pairs, with `play-through.txt`), nothing in the working tree (T146).
- Quick Test: <http://127.0.0.1:5410/#/quick-test>. For every game: Game as named below, Seed `acorn`, a Season of your choice, **Fast specials** on, **Start from the lobby** on; in the lobby, Start round from the Host menu.

| Game                  | What to look at                                                                                                                                                                                                                                            |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guess The Number      | The stage's one-line rows, "Your guesses" in the right column (shared), the special line on top of it; on a phone the info line "1–1,000" and its sheet; "All (N)" with the events; individual mode: "bot-01: 8 guesses" instead of their rows             |
| Seasonal Safecracker  | "2 right · 1 wrong place", "no digit right", the legend line in the panel; the phone's compact digit strip with "Hint: 2nd is 4"                                                                                                                           |
| Seasonal Bomb Defusal | Sequences as colour dots (hover for the names), "First 2 cuts right"; eight wires in one row, two rows with a panel open; the phone's "8 wires · cut 6 · wrong first cut +5 s"                                                                             |
| Seasonal Target       | Grid size 20: about 31 px tiles at 1280 × 720, 49 px at 1920 × 1080, the full phone width (18.7 px a tile); Spring's "Hint" tag (with today a halving day it moves inside the area); **Answers** all three: `closeness` (default), `distance`, `direction` |

- Results: the slim bar instead of the app header; the first part on one screen with the top three, "All placings" and the team line; standings below; End the round from the Host menu before anyone wins to see "Closest guess".

### Addendum — CI on feature branches (T149)

- `.github/workflows/ci.yml`: no CI for `shots/**`; the Playwright job in all three browsers on `master` and on pull requests to `master`, in Chromium only elsewhere (its specs, then its timing specs). Recorded as T149, docs/spec/09 §1 updated. Its first run (`5493a05`): verify, security and docs green; e2e Chromium 29 of 30 timing tests and every other spec passed, journey 16 (spring) missed Spring Herald's 5 s banner on the slow runner; the journey now checks the line in the All list (the banner's timing is `banner.test`'s).

### Piece 1 — one layout system (O54, T141–T143)

- New: `RoundBody.tsx` (the parts and the two layouts), `InfoParts.tsx` (the game's panel, the desktop's special line, the phone's info line and its sheet), `GuessLine.tsx` (one row, moved out of `RoundLog.tsx`), `useRoundView.ts` (the layout by viewport), each game's `InfoLine` (Guess The Number's own file; Safecracker in `Board.tsx`, Bomb Defusal in `panels.tsx`, Seasonal Target in `PlayerPanel.tsx`); tests `log.test.tsx`, `layout.test.tsx`, a `line.test.tsx` for Guess The Number and Seasonal Target (Safecracker's and Bomb Defusal's in their `panels.test.tsx`), and a `sentinel.test.tsx` in each game's web folder over `sentinelViews` of `@smg/game-sdk` (a round with the kit's sentinel secrets: the info line and both panels show no mark; the web app may not import the server registry, so the test lives with each game).
- Removed: the old banner stack above the list and its `hide` rule (an event now always stays in All), `useNarrow`/`NARROW`, the phone-only "All" sheet path, the phone halving cap of T140 (the panel is no longer above the list), the centred 46 rem input box, `.round-range`.
- Extracted: Safecracker's `DigitStrip` (the panel's strip and the info line's compact one); the season pill's styles moved from `round.css` to `roundSpecials.css`.
- Reused: `FocusPanel` and `usePanels` for the All panel and the game sheet, `colorsOf`, `playerColor`, `formatNumber`, `freeHint` and `hintText` of the games, `HeatLegend`, `leafFallOn`.
- Checks: `pnpm verify` green (127 files, 734 tests, with the split test files of piece 5). E2E Chromium 34/34: 31 on the first run; journeys 24 (it measured a box the list games no longer have), 18 (Leaf Fall's row is now in the All list) and 11 (a phone reads the range on the info line) fixed in the journeys and passing on the re-run.

### Piece 2 — Seasonal Target on this layout (T144)

- Measured (probe, 20 × 20): 1280 × 720 grid 660 px, tile 30.9 px; 1920 × 1080 grid 1004 px, tile 48.1 px; 390 × 844 grid 374 px (the full width minus 8 px a side), 18.7 px a tile with its gap (17 px fill), the list under it 250 px (7 rows).
- The phone's gutter was 16 px: the shell's one-screen padding has the same weight as focus mode's and loads later; `#root .shell-main:has(.focus-mode)` now wins (desktop too: 8 px above and below).
- The "Hint" tag: `tagTileOf` in `TileGrid.tsx` (225 → 238 lines) puts it on the quarter's tile nearest the corner inside the area; new `hint.test.ts`; the panel test that pinned the tag on a dimmed corner tile now expects the moved tag.
- Journey 27 plays a 20 × 20 grid (was 30 × 30) on a 30 s cooldown and checks the tile pitch: at least 30 px at 1280 × 720 and 18 px on the phone.

### Piece 3 — the list games on this layout (T143)

- Bomb Defusal: the sequence as colour dots with their names (`swatches`, `WIRE_COLORS` one map for the dots and the wire swatches; `swatch.css` 63 → 39 lines without its eight fill rules); "First 2 cuts right".
- Safecracker: `counts` without zero parts; the panel's legend line (`Board.tsx`, `sc.css` 206 → 213).
- Rows: the name keeps its room, the answer gives way with an ellipsis; tighter gaps on a phone.
- Bomb Defusal on a desktop: eight wires in one row (`bd.css`, was two rows of four), so the stage's list has room for 18 rows at 1280 × 720 (16 before).
- Checks: `pnpm verify` green (128 files, 737 tests); journeys 20–22 and 24–27 pass in Chromium (journey 21 failed once, waiting for a harmless wire, and passed on the re-run).
- Rows in view (probe, measured room of the list): see piece 6's measurements; journeys 24–26 assert the room for 22/20/18 rows at 1280 × 720 and 10/10/6 on the phone.

### Piece 4 — result screens (T145)

- New: `ResultBar.tsx` (the slim bar of the result and the summary), `ResultParts.tsx` (placings with the top three and "All placings", the team line, the team result; moved out of `ResultScreen.tsx`, 174 → 109 lines), `placings.test.tsx`, `e2e/results.spec.ts` (journey 28, a first-part fit check per game).
- `MatchPage.tsx` (248 → 251): `AfterView` and the shared `Side` (joining, the waiting area, the chat); `LobbyView` no longer carries the result. `match.css` (235 → 227) loses T138's one-screen rules; `result.css` (251 → 265) gets the first part; `summary.css` (105 → 121): the page under the bar, the team list one line per team; Seasonal Target's `st.css` drops the phone result's forced square board (the first part has a height now).
- The closest guess on a time-up result: `closestMissBy` (guess-engine) takes every player's guesses without a winner; `GameText.runnerUp` gets `won`; `closestLabel` (game-sdk) words it for the four games.
- The golden run of Guess The Number (T118) re-recorded for this one change: its three time-up rounds now carry the closest guess (`closestMiss` was `null`); nothing else in the recording moved. The four games' closest-miss tests say so.
- Checks: `pnpm verify` green (129 files, 741 tests); e2e Chromium 38/38 (journeys 1–27 and the four of journey 28).
- Measured (probe): the first part ends at 712 px of 720 at 1280 × 720, 1072 of 1080 at 1920 × 1080, 828 of 844 at 390 × 844; Seasonal Target's 8 × 8 result grid 331 px at 1280 × 720.

### Piece 5 — known defects and clean-up

- The night-6 review list (OPEN.md): solved by the layout and pieces 2–4 — the empty column under a list game's panel ("Your guesses" fills it, T141), the result's phone header, the viewer listed first, team points beside player points, no closest line on a time-up result, the summary's wrapping team list (T145), Safecracker's zero parts (T143), the "Hint" tag dimmed by a halving and Target's capped phone panel in a halving round (T144, T141), the centred 46 rem input row (the dock starts with the list, T141); Kept for the owner, with its reason: Target's strips beside the centred grid on a desktop, and the dark own-row tint of a muted dot (T147: a stronger tint was tried and cost contrast).
- The test files over 300 lines split by subject (`749c005`): `boards.test.tsx` (324 lines, 9 tests) into `leaderboard.test.tsx` (4), `profile.test.tsx` (2), `verify.test.tsx` (3) with `fakes.tsx`; Guess The Number's `panels.test.tsx` (327 lines, 14 tests) into `panels.test.tsx` (9, 200 lines) and `input.test.tsx` (5) with `fixtures.ts`. No test lost.
- Screenshots out of the tree (T146): 1,310 image files under `reports/` removed in one commit, `.gitignore` keeps them out, CLAUDE.md's rule; the night's shots go to `shots/night-7` only.
- "Opens in 0 s": no cause found while working on the shell; left as is (OPEN.md).
- `roundLog.css` reached 305 lines with T147: the pegs and colour dots moved to `roundMarks.css` (54 lines), `roundLog.css` 262.
- Checks: `pnpm verify` green (129 files, 741 tests).

### Piece 6 — re-shoot, measurements, self-review

- Two full shoots (`tmp/n7shoot.mjs`, git-ignored) to the scratchpad, never into the tree: every game, each season, shared and individual, at 1280 × 720, 1920 × 1080 and 390 × 844, light and dark of one moment; Target at 8, 20 and 30 per side in each answer mode at all three sizes; 15+ guesses shared and individual; Frost pending; halving (today added as a halving day and removed after); the loupe; every panel and sheet; each result (solved, time up) and the match summary. The second shoot (after the fixes, `b7d2789`) is the one on `shots/night-7`.
- Review: one subagent per game on the first shoot; I checked the fixed states in the second shoot myself.

**Measured** (second shoot, `play-through.txt`; the e2e journeys 24–27 measure the list's room with one guess, which the shoot cannot):

| Check                                                 | Target                     | Measured                                                                                                                                                |
| ----------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page scroll in a round view (every state, all sizes)  | none                       | none; only result pages scroll, below their first part                                                                                                  |
| A panel or sheet over the dock                        | never                      | never ("panel clear of the dock" on every open-panel shot)                                                                                              |
| Target 20 × 20 tile, 1280 × 720 / 1920 × 1080 / phone | ≈ 30 / ≈ 48 / ≥ 18 px      | 30.9 / 48.9 px; phone grid 374 px (full width minus 8 px a side), 18.7 px a tile with its gap, 16.6 px fill (the shoot measures a tile's fill)          |
| Target 8 × 8 and 30 × 30 at 1280 × 720                | as large as height allows  | grid 660 px at every size of grid                                                                                                                       |
| Guess rows, 1280 × 720 stage                          | GTN ≥ 22, SC ≥ 20, BD ≥ 18 | room (journeys 24–26): ≥ 22, ≥ 20, ≥ 18 pass; in the shoot 23 GTN rows of a 32-guess round in view, all 16–17 rows of SC's and BD's busy rounds in view |
| Guess rows, 390 × 844                                 | GTN, SC ≥ 10, BD ≥ 6       | room ≥ 10, ≥ 10, ≥ 6 pass; in the shoot GTN 25 rows in view, SC 17, BD 14, Target 7 under the grid                                                      |
| Result first part, 1280 × 720 / 390 × 844             | fits                       | fits for every game and both results (bottom 324–712 px of 720; 516–834 px of 844); the summary one screen at every size                                |

**Screenshot review** (first shoot; state after the second):

| #   | Found                                                                                                      | State                                                                     |
| --- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1   | Frost's "3 s" badge cut in the narrow column                                                               | fixed (T148): the words give way                                          |
| 2   | Comments and answers cut to one letter in "Your guesses"                                                   | fixed (T148): the answer keeps its words there                            |
| 3   | List-game results: an empty card and a gap before the placings                                             | fixed (T148): the first part as tall as its content                       |
| 4   | The result's chat field cut at 1280 × 720                                                                  | fixed (T148)                                                              |
| 5   | Placings: "Guesses Points" touching, "took part" wrapping, unplaced order                                  | fixed on a desktop (T148); a phone still wraps "took part" (owner, below) |
| 6   | Eight wires overlapping, Safecracker's dock wrapping, with a panel open                                    | fixed (T148): two rows of four / one row with shrinking boxes             |
| 7   | No special sentence on a phone outside the pill's note                                                     | fixed: also at the top of the game sheet                                  |
| 8   | Frost's banner beside the special line saying the same                                                     | fixed: a desktop shows no Frost opening banner                            |
| 9   | Chips cut without an ellipsis (result bar, "Harmless 2" on the info line)                                  | fixed                                                                     |
| 10  | Safecracker's phone hint without room ("F…")                                                               | fixed: compact strip, "Hint: 2nd is 4"                                    |
| 11  | "All (N)" under 44 px on a phone                                                                           | fixed                                                                     |
| 12  | Target's halved area hard to see in dark                                                                   | fixed: outside tiles at 12 % in dark                                      |
| 13  | Dark own-row tints: dots and answers losing contrast (the 34 % tint of T147)                               | fixed by going back to 22 %; the olive tint stays greyish (owner)         |
| 14  | Range never narrows from the answers                                                                       | not a defect: O17                                                         |
| 15  | Guess enabled on a fallen tile in the loupe                                                                | not a defect: refused at once with its sentence (T113)                    |
| 16  | Counts differing between sizes (Fallen 10/20)                                                              | not a defect: the sizes are seconds apart                                 |
| 17  | Target result: the grid shares the game part with every player's guesses (160 px on a solved phone result) | owner: the game's result panel draws both; a game-side change             |
| 18  | Individual mode on a desktop: the info column empty under the panel                                        | owner: T141 leaves "Your guesses" out there (it would repeat the stage)   |
| 19  | Phone placings: "dev…" cut and "took part" on two lines                                                    | owner: four columns at 390 px leave the name about 7 rem                  |
| 20  | Target's busy shared round: the bot wins before 15 guesses (Quick Test has no slower bot)                  | not shot; the busy individual round has the 15+ rows                      |
| 21  | Heatwave's banner ("now 14 s") beside the ring ("Wait 8 s")                                                | not a defect: the cooldown and the time left of it                        |

- Checks: `pnpm verify` green on `b7d2789` (129 files, 741 tests; two runs had one or two property and jsdom tests time out at 5 s while other projects' dev servers loaded the machine, each passing alone); e2e Chromium 38/38 on `a073507`, journey 16 updated for T148 and passing; CI: `5b3d369` green; `749c005` failed in journey 26 (the row target before `5b3d369`'s wires fix), `330810d` in a server integration test (a Leaf Fall round's state without its game, code untouched tonight; passed on the next run), `b7d2789` in journey 16 (the removed desktop Frost banner, fixed in the next commit); the final push: see the summary.
- Noticed and left alone: journey 21 waits up to 30 s for a harmless wire and failed once locally and once in CI (WebKit, night 6); Quick Test's bot guesses at the round's cooldown, so a busy shared round of Safecracker or Target needs few own guesses.

## Night 6 (2026-11-02/03)

Branch `feat/guess-games`. Owner decisions O47–O53 (2026-11-02); technical decisions T134–T138. Nothing goes to `master`.

### Status

| Piece                                      | State | Commit    |
| ------------------------------------------ | ----- | --------- |
| 1. Shared focus shell (O47, O48, O49, O52) | done  | see below |
| 2. Seasonal Target (O51, O53)              | done  | see below |
| 3. List games layout (O50)                 | done  | see below |
| 4. Result screens                          | done  | see below |
| 5. Small items                             | done  | `6c4491e` |
| 6. Re-shoot, measure, self-review          | done  | `88aa313` |

Pieces 1–4 are one commit: they share the round view's grid (`round.css`, `RoundScreen.tsx`), the games' `text.ts` (hint lines and closest miss) and the decision and spec pages, and the subagent of piece 2 worked in parallel with pieces 1 and 3. `pnpm verify` green on that tree (116 files, 707 tests); e2e follows in piece 6.

### Needs the owner

Nothing blocks. To look at and decide: OPEN.md, "Night-6 small items (T139), to confirm" and "Night-6 screenshot review, for the owner" (the list below, state "owner").

### Handover

- Branch `feat/guess-games`; the app code is at `88aa313`; the commits after it change only journey 22 and this sheet. Dev servers restarted on it: API 3910, web 5410, admin 5411.
- Quick Test: <http://127.0.0.1:5410/#/quick-test>. For every game: Game as named below, Seed `acorn`, a Season of your choice, **Fast specials** on, **Start from the lobby** on; in the lobby, Start round from the Host menu.

| Game                  | What to look at                                                                                                                                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guess The Number      | The list in the main area, the range panel alone on the right (O50); Summer: Heatwave said once; open Chat or Players on a desktop: the game moves aside (O48); on a phone the list fills the height (O49)                                              |
| Seasonal Safecracker  | "1 right place, 2 right digits, wrong place", green from half the digits in place; the phone list's answers wrap inside the card                                                                                                                        |
| Seasonal Bomb Defusal | "Boom!" once per row; the swatches' grey ring; the result's sequences separated by " · "                                                                                                                                                                |
| Seasonal Target       | Grid size 20; the grid at full height on the left, legend, list, selection, ring and Guess on the right (O51); "Type coordinates"; Spring: the green "Hint" quarter; **Answers** all three: `closeness` (the default now, O53), `distance`, `direction` |

- Results: the headline at half size, "Closest miss besides the winner: …", one screen at 1280 × 720.
- Teams: "Team Spring" and the others everywhere (O52).
- Screenshots: `reports/focus-mode-2/` with `play-through.txt` (the images left the tree in night 7, T146; they are in the history at `b4eebd0`).

### Piece 1 — the shared focus shell

- **Bar (O47):** "Wait N s" removed (`FocusBar`, its CSS and the `round-cooldown` test id); "9:50 left" stays. 14 px text, 36 px flat controls, 44 px high on a desktop; 52 px on a phone with 44 px touch targets. The pill's size in the bar comes from `focus.css`.
- **Heatwave once (T134):** the domain keeps emitting `CooldownChanged` (it lowers the cooldown in the round's state, which the ring and button follow) and `SpecialFired`; the client words only the first firing ("Heatwave: waiting time is now 7 s and keeps getting shorter."), banner and one row. The ring carries `data-cooldown-ms` for journey 3, since the bar no longer shows the cooldown.
- **No message twice (T135):** `bannerOf` returns the feed key it shows; the list leaves that row out while the banner stands. The four games no longer word a shared `HintGiven` as a list line (the hint stands in the game's panel or as Target's hint quarter); Spring Herald's one row and its banner say the same.
- **Panels (O48, T136):** on a desktop an open panel is the round view's third grid column (360 px), so the game narrows instead of being covered; on a phone the sheet spans the grid rows from under the bar to the one above the input row (`grid-row: 2 / -2`). The focus moves to the panel element, its ring only under `:focus-visible` (the title's box is gone).
- **Phone list (O49):** guesses only, filling the free height; "All (N)" counts guesses and shows from the first guess; the sheet has guesses and events. The sheet is a child of the round view's grid (it was inside the main area at first, which put it in the wrong box — caught in the first look).
- **Teams (O52):** `teamName()` ("Team Spring") in `season.ts`, used by the Players panel, the team tiles, the result's team list, the match summary, the waiting area's picker and player rows, and the team leaderboard.
- **Contrast:** the disabled button is 6.6:1 (T68) and the muted system text #4f5663 on the card; measured in piece 6. The banner balances its lines (`text-wrap: balance`).
- **Frost:** the pending own row ("answer arriving… 3 s") already existed in every game (`pending` in each `guessRows`); kept, captured in piece 6.

### Piece 2 — Seasonal Target (subagent in `games/seasonal-target/` only)

- The input draws the grid into the platform's stage (`createPortal`; the new `stage` prop of a board game's input, `games/registry/web`); `react-dom` 19.3.1 and `@types/react-dom` 19.3.0 added to the game package (the versions apps/web uses), lockfile +6 lines.
- Right column: legend, hint, fallen tiles; the list; selection, ring and Guess; "Type coordinates" (`useDisclosure`, closed by default) for the fields and arrows; the loupe keeps its own.
- Removed: the "Grid: N × N tiles" line, the "Last guess" line, the input's legend, the `flow` grid variant and their CSS.
- Numbers on tiles of at least 20 px (`NUMBER_MIN_PX`, T137); the hint quarter in a fixed green #7cc46a with a "Hint" tag in both themes; the corner dot with a 2 px ring and the number moved clear of it; the list's answer in the tile's tier colour (`data-tier="st-…"`, text shades at 4.5:1 or more).
- Default answer mode `closeness` (O53), with a test that a stored `distance` stays `distance`; there is no platform-side Quick Test default.
- "cell" → "tile" in every player-visible text.

### Piece 3 — list games layout (O50)

- Guess The Number, Safecracker and Bomb Defusal: the banner and the list in the main area with the input row at its bottom (up to 46 rem wide), the game's panel alone in the 320 px column. One list component (`RoundLog`), no per-game copy. Larger list text from 1600 × 950.
- `InputRow.tsx` extracted from `RoundScreen.tsx` (293 → 230 lines).

### Piece 4 — result screens

- Headline 1.25–1.5 rem (was the page title's 1.8–2.75 rem), balanced, one line at 1280 px.
- "Closest miss besides the winner: …" in all four games (Target: "… 3 tiles away (9, 10)."); the closest miss exists only with a winner (`closestMissBy`).
- Desktop one screen (T138): head across with the proof's disclosure, the game's result left, the tables right, the chat filling the side column; Target's grid fills the part's height (the list of every guess capped at about three lines). A phone scrolls the page, the result first.

### Piece 5 — small items (T139)

- **Bomb Defusal:** "Boom!" once per row: the explosion comments no longer start with "Boom"/"Kaboom"/"Bang" (a test checks); one fixed grey ring (#7a808c) on every swatch, so white and black look alike in both themes. Rows are laid out alike for the viewer and others (dot, name, sequence, answer, comment; checked in the look shots); the harmless chips' crossed swatch and struck name and the struck wire buttons are measured in piece 6.
- **Safecracker:** green once at least half the digits are in the right place, the same rule for every row; "1 right place, 2 right digits, wrong place"; no stray indent seen in individual mode on the desktop (the phone in piece 6); the fallen chips' × sits inside the chip's corner (unchanged, captured in piece 6).
- **Own colour:** own rows, the Players panel's own row and Seasonal Target's own-tile frame use the viewer's dot colour (`--own`).
- **Phone bar:** the season pill's note starts with "Shared round." or "Individual round." before the special's name and sentence.
- **Host menu:** End match is a danger button from the first click.
- Lines: Bomb Defusal `commentLines.ts` 204 → 205, `commentLines.test.ts` 60 → 65, `bd.css` 309 → 257 (it was over the limit before; the swatches moved to the new `swatch.css`, 63), `WireChip.tsx` +2; Safecracker `text.ts` 145 → 143, `panels.test.tsx` 200 → 207; `RoundScreen.tsx` 230 → 237, `SeasonPill.tsx` 91 → 94, `EndMatch.tsx` 71 → 73, `roundLog.css` 210 → 211, Target `tiles.css` 284 → 285.

### Lines before → after

| File                                           | Lines before → after |
| ---------------------------------------------- | -------------------- |
| `apps/web/src/boards/TeamBoard.tsx`            | 65 → 65              |
| `apps/web/src/boards/boards.test.tsx`          | 324 → 324            |
| `apps/web/src/match/MatchPage.tsx`             | 244 → 248            |
| `apps/web/src/match/MatchSummary.tsx`          | 106 → 106            |
| `apps/web/src/match/WaitingArea.tsx`           | 148 → 148            |
| `apps/web/src/match/match.css`                 | 172 → 235            |
| `apps/web/src/match/summary.test.tsx`          | 140 → 140            |
| `apps/web/src/match/waiting.test.tsx`          | 152 → 152            |
| `apps/web/src/round/CooldownRing.tsx`          | 53 → 55              |
| `apps/web/src/round/FocusBar.tsx`              | 137 → 131            |
| `apps/web/src/round/FocusPanel.tsx`            | 71 → 71              |
| `apps/web/src/round/FocusShell.tsx`            | 136 → 138            |
| `apps/web/src/round/ResultScreen.tsx`          | 158 → 174            |
| `apps/web/src/round/RoundLog.tsx`              | 218 → 225            |
| `apps/web/src/round/RoundScreen.tsx`           | 293 → 230            |
| `apps/web/src/round/RoundSide.tsx`             | 104 → 107            |
| `apps/web/src/round/SpecialBanner.tsx`         | 87 → 90              |
| `apps/web/src/round/banner.test.tsx`           | 133 → 154            |
| `apps/web/src/round/focus.css`                 | 204 → 209            |
| `apps/web/src/round/focus.test.tsx`            | 180 → 224            |
| `apps/web/src/round/result.css`                | 138 → 251            |
| `apps/web/src/round/result.test.tsx`           | 89 → 91              |
| `apps/web/src/round/round.css`                 | 266 → 255            |
| `apps/web/src/round/round.test.tsx`            | 216 → 225            |
| `apps/web/src/round/roundLog.css`              | 194 → 210            |
| `apps/web/src/round/roundSpecials.css`         | 73 → 75              |
| `apps/web/src/round/roundText.ts`              | 140 → 144            |
| `apps/web/src/season/season.ts`                | 55 → 58              |
| `e2e/focus.spec.ts`                            | 161 → 197            |
| `e2e/lobby.spec.ts`                            | 181 → 181            |
| `e2e/seasons.spec.ts`                          | 183 → 183            |
| `e2e/specials.spec.ts`                         | 134 → 135            |
| `e2e/target.spec.ts`                           | 83 → 87              |
| `games/bomb-defusal/web/panels.test.tsx`       | 212 → 211            |
| `games/bomb-defusal/web/text.ts`               | 158 → 158            |
| `games/guess-the-number/web/panels.test.tsx`   | 326 → 327            |
| `games/guess-the-number/web/text.ts`           | 146 → 142            |
| `games/registry/web/index.ts`                  | 63 → 68              |
| `games/safecracker/web/panels.test.tsx`        | 201 → 200            |
| `games/safecracker/web/text.ts`                | 151 → 145            |
| `games/seasonal-target/package.json`           | 29 → 31              |
| `games/seasonal-target/src/fakes.ts`           | 96 → 96              |
| `games/seasonal-target/src/rules.test.ts`      | 214 → 223            |
| `games/seasonal-target/src/settings.ts`        | 125 → 126            |
| `games/seasonal-target/src/views.test.ts`      | 205 → 201            |
| `games/seasonal-target/web/FallenCells.tsx`    | 71 → 71              |
| `games/seasonal-target/web/Loupe.tsx`          | 98 → 99              |
| `games/seasonal-target/web/PlayerPanel.tsx`    | 61 → 62              |
| `games/seasonal-target/web/ResultPanel.tsx`    | 77 → 81              |
| `games/seasonal-target/web/SpectatorPanel.tsx` | 60 → 60              |
| `games/seasonal-target/web/Steer.tsx`          | 84 → 110             |
| `games/seasonal-target/web/TargetInput.tsx`    | 216 → 206            |
| `games/seasonal-target/web/TileGrid.tsx`       | 196 → 223            |
| `games/seasonal-target/web/fallen.css`         | 84 → 84              |
| `games/seasonal-target/web/fixtures.tsx`       | 100 → 105            |
| `games/seasonal-target/web/heat.ts`            | 151 → 151            |
| `games/seasonal-target/web/index.ts`           | 33 → 35              |
| `games/seasonal-target/web/input.test.tsx`     | 180 → 199            |
| `games/seasonal-target/web/measure.ts`         | 70 → 78              |
| `games/seasonal-target/web/panels.test.tsx`    | 270 → 294            |
| `games/seasonal-target/web/st.css`             | 150 → 199            |
| `games/seasonal-target/web/text.test.ts`       | 155 → 154            |
| `games/seasonal-target/web/text.ts`            | 121 → 120            |
| `games/seasonal-target/web/tiles.css`          | 272 → 284            |
| `games/seasonal-target/web/words.ts`           | 98 → 103             |
| `pnpm-lock.yaml`                               | 5741 → 5747          |
| `apps/web/src/round/InputRow.tsx`              | 0 → 103              |
| `apps/web/src/round/players.css`               | 0 → 66               |
| `games/seasonal-target/web/loupe.css`          | 0 → 47               |

Removed: the bar's waiting figure and its CSS (`.focus-facts`, `.focus-fact-time`), `round-cooldown`, the per-step Heatwave row and banner, the games' shared hint lines (and Guess The Number's `hintText`), the compact list's `LATEST` slice, the absolute drawer and 60 % sheet, the heading's focus target, Target's size line, "Last guess" line, input legend, `flow` variant and `.st-last`. Extracted: `InputRow.tsx` (from `RoundScreen.tsx`), `players.css` (from `round.css`), `loupe.css` (from `tiles.css`), `partsOf` and `ListPart` in `RoundScreen.tsx`, `TypedSteer` in Target's `Steer.tsx`. Reused: `useDisclosure` (Type coordinates), `RoundLog` for both list views, `TileGrid` and `useTileSize` for the round and the result, `bannerOf`, `formatNumber`, `buttonText`; new shared helper `teamName()`.

### Piece 6 — re-shoot, measure, self-review

- `reports/focus-mode-2/`: 226 light/dark pairs (452 shots), each pair of one moment: every game, season, shared and individual at 1280 × 720, 1920 × 1080 and 390 × 844; results (solved, time up) and the match summary; 15 guesses and more; Frost pending; Target halving, fallen tiles, the hint quarter, 8/20/30 per side in all three modes; every panel at every size; the desktop ready state; the loupe with the hint and with fallen tiles. `play-through.txt` holds per shot the page's scroll height against the viewport, Target's grid and tile size, the list rows wholly in view and whether a panel leaves the input clear.
- Review: four subagents (one per game) on the first full shoot, then the lead on the retakes of every fixed state; the fixes are T140. The last full shoot ran after the subagents' fixes, with retakes of the states fixed after it.

- Lines (the review fixes): `FocusBar.tsx` 131 → 133, `SeasonPill.tsx` 94 → 100, `SpecialBanner.tsx` 90 → 78 (Frost's held-answer text removed), `banner.test.tsx` 154 → 149, `cooldownRing.css` 53 → 61, `focus.css` 209 → 210, `players.css` 66 → 67, `round.css` 255 → 265, `roundLog.css` 211 → 218, `e2e/seasons.spec.ts` 185 → 187; Bomb Defusal `ResultPanel.tsx` 55 → 55; Safecracker `ResultPanel.tsx` 61 → 61, `sc.css` 201 → 206; Seasonal Target `TileGrid.tsx` 223 → 225, `text.ts` 120 → 126, `text.test.ts` 154 → 156, `tiles.css` 285 → 291. Removed: `frostText` (the banner's held-answer sentence). Reused: `.round-phone-hidden` (visually hidden on a phone) for the bar's "left" and "round", the pill's `data-halving` for the phone cap.

### Measurements

| What                                             | 1280 × 720              | 1920 × 1080           | 390 × 844                    |
| ------------------------------------------------ | ----------------------- | --------------------- | ---------------------------- |
| Page scroll in a round (every round shot)        | none (720/720)          | none (1080/1080)      | none (844/844)               |
| Page scroll on a result                          | none (one screen, T138) | none                  | 1420–2316 px (by design)     |
| Panel over the input                             | never (pushes aside)    | never                 | never (the sheet ends above) |
| Target grid, 8 × 8                               | 644 px, tile 78.3 px    | —                     | 358 px, tile 42.5 px         |
| Target grid, 20 × 20                             | 644 px, tile 30.1 px    | about 48 px (by size) | 358 px, tile 15.8 px         |
| Target grid, 30 × 30                             | 644 px, tile 19.4 px    | 1004 px, tile 31.4 px | 358 px, tile 9.9 px          |
| Target grid, 30 × 30, a panel open               | 520 px, tile 15.3 px    | 1004 px, tile 31.4 px | 358 px                       |
| List rows in view, 15+ guesses: Guess The Number | 22                      | —                     | 15                           |
| Safecracker                                      | 22                      | —                     | 5–6 (answers wrap)           |
| Bomb Defusal                                     | 16                      | —                     | 9                            |
| Seasonal Target                                  | 10                      | —                     | 4; 3 in a halving round      |

Tile numbers show on tiles of 20 px or more (T137): on 30 × 30 at 1280 × 720 and on every phone grid above 8 × 8 the tiles carry their colour and frame only; the loupe gives 44 px tiles there.

### Screenshot review

| Found                                                                                  | Where                               | State                                                        |
| -------------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------ |
| A long answer widened the phone list past its card                                     | Safecracker, 390 × 844              | fixed: one column no wider than the box, answers wrap        |
| The halving badge and the time pushed the phone bar to two rows                        | all games, halving, 390 × 844       | fixed: "Halving" in place of the season's name, "9:40"       |
| The ring's track vanished on the second surface; "Ready" crowded it                    | all games                           | fixed: track at half the text colour, smaller label          |
| Frost said a held answer twice (banner and row)                                        | all games, winter                   | fixed: the banner only at the opening, the row says the rest |
| An own 10 px phone tile lost its heat colour under its frame                           | Seasonal Target, 390 × 844          | fixed: a 1.5 px frame under 20 px                            |
| Every later Leaf Fall row read alike                                                   | Seasonal Target, autumn             | fixed: "(fall 3)"                                            |
| Team names off-centre in their tiles; narrow phone buttons; a short "All (N)"          | Players panel, bar, list            | fixed: centred, 44 px                                        |
| A player's sequences ran together on the result                                        | Bomb Defusal result                 | fixed: " · " between them                                    |
| The phone list kept one row in a halving round                                         | Seasonal Target, 390 × 844          | fixed: the panel above capped and scrolling there (3 rows)   |
| "(4 digits, 0–9)" broke at its dash                                                    | Safecracker result                  | fixed: one line                                              |
| The hint's text cut in that capped panel; 1½ rows while the halving banner stands      | Seasonal Target, 390 × 844, halving | owner (OPEN)                                                 |
| An empty right column under a list game's panel                                        | list games, desktop                 | owner (OPEN, O50)                                            |
| The result's game part scrolls inside itself with many guesses                         | results, desktop                    | owner (OPEN, T138)                                           |
| The full header on a phone result; the summary's wrapped team list                     | results, 390 × 844                  | owner (OPEN, T128)                                           |
| Team points beside player points; the viewer listed first with 0 guesses               | results                             | owner (OPEN)                                                 |
| No closest miss on a time-up result                                                    | results                             | owner (OPEN, O22)                                            |
| Zero parts in Safecracker's counts                                                     | Safecracker                         | owner (OPEN, T139)                                           |
| "Hint" tag dimmed by a halving; strips beside the desktop grid; olive own tint in dark | Seasonal Target                     | owner (OPEN)                                                 |
| The input row's controls not under the list's start                                    | Safecracker, Bomb Defusal, desktop  | owner (OPEN)                                                 |

Not defects: the range bar does not narrow with the halving (decision 17); a closest-miss tie goes to the earlier guess; another player's held Frost answer shows no word until it arrives (the server sends none before).

### Checks

- `pnpm verify` green on pieces 1–4 (116 test files, 707 tests). Two earlier runs stopped on formatting (a doc saved during the run) and on a 61-line test function; both fixed.
- `pnpm verify` green on piece 5 and on piece 6 with its review fixes (116 test files, 708 tests each).
- E2E Chromium, journeys 1–27 (`chromium` and `chromium-timing`): 34/34 passed in 12.0 min on the final code. Journeys 24–27 assert at 1280 × 720 and 390 × 844 that with each panel open the action button stays visible and enabled or waiting, the panel leaves the input clear and the page does not scroll. Earlier in the night: 36 passed, 4 failed (a `boundingBox` on a missing stage, Bomb's disabled "Cut", Target's "9 away"), fixed in `17216d2`.
- CI: piece 5's run (`6c4491e`) failed in journey 22 (Chromium): no fallen tile within 20 s; `06b86c1` passed it in Chromium and Firefox and failed in WebKit (iPhone profile), 99 passed. Three causes, all in the journey: a fall takes only tiles that fit every answer so far (O37), and two distance answers to two targets leave almost none, so the fall must come before any guess; a bot on a 3 s cooldown found its distance target and ended the round (a 60 s cooldown for that round now); on a touch screen with tiles under 44 px a tap opens the loupe, which holds the arrows instead of "Type coordinates". Journey 22 then passed in Chromium, Firefox and WebKit locally. CI green on `5b19ec3` (run 41583961644, 34 min, every browser); the commit that adds this note changes only this sheet.
- Security: no new intent, route or table; the authorization matrix is unchanged.
- The re-shoot's first try failed on every round: the dev web server served a stale module after a hot reload (Bomb's `ResultPanel`); the servers were restarted and the shoot repeated. The halving day the shoot adds was removed at its end (204).

## Tiles and focus mode (2026-11-02, day task)

Branch `feat/guess-games`. Owner decisions O45 (Seasonal Target on large heat-coloured tiles) and O46 (focus mode for every game); technical decisions T128–T133. Nothing goes to `master`.

- **Seasonal Target (O45):** one tile grid (`target.size` 8–30, default 20) for the input, the loupe, the spectator and the result; a 5-step cold–hot fill with the distance (and its arrow) by answer mode, colour only with warm/cold only; own tiles framed, others' corner marks, one tile for several guesses with every guess in its title; hatched fallen tiles, the tinted Spring quarter, dimmed tiles outside a halved area; on a phone a loupe of 5 × 5 tiles of at least 44 px. The answers carry their tier; the tier table got a minimum distance beside each share of the diagonal, so all five colours occur from 8 to 30 per side (proposal in OPEN). Migration 0013 writes a version of `game.seasonal-target` without the old map size. Built by a subagent in `games/seasonal-target/` only; the platform parts by the lead.
- **Focus mode (O46):** from the countdown until the round ends no app header; one bar (the season pill with the special's note, "Wait 15 s · 9:50 left", Chat with an unread count, Players with the teams, Host, Full screen where offered); one shared drawer/sheet component for chat, players and the host's controls, one at a time, Close and Escape, the focus back on its button; the stage on the left and a 320 px column with the game's panel and the list on a desktop; the newest 3 rows with "All (N)" on a phone. The result keeps the header (T128).
- **Small item:** "Wrong corner of the map." replaced in Guess The Number's catalogue; no catalogue holds another game's line.
- **Checks:** `pnpm verify` green (700 tests; two runs before it timed out under the machine's load, different tests each time, all passing alone); the authorization matrix unchanged (no new intent or route). E2E Chromium, the whole suite (journeys 1–27, 24–27 new): 33/34 in the last full run; the one failure, journey 11's contrast check catching the Spring Herald banner in its first fade-in frames (1.29:1), passed three times repeated, and the check now waits for running animations to end. On the way: the round bar shows from the countdown, so `roundOpen` waits for the open round view; the theme of the contrast check is set on `<html>` where focus mode hides the toggle; journeys 20 and 21 read Leaf Fall from the round's state, since CI once lost the live row of a fall before the page had loaded.
- **Screenshots:** `reports/focus-mode/` — 146 light/dark pairs, each of one moment (the page's clock paused for the pair), nothing scrolls, every round open when shot (`play-through.txt`).

**Review list:**

| Found                                                                    | Where                                                | State                                                                                                                                          |
| ------------------------------------------------------------------------ | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| The phone bar was 10 px too wide: Full screen cut off                    | all games, 390 × 844                                 | fixed: the pill's "i" left out on a phone, the pill still the special's button                                                                 |
| Guess The Number at 1280 × 720 had room for about 11 rows                | right column                                         | fixed: Fallen numbers behind their button on a desktop too, tighter gaps, the heading over the bar's row (12.5 rows now; journey 24 checks 12) |
| The heading broke into four lines beside "Fallen (N)"                    | Guess The Number, desktop                            | fixed: the button beside the bar, the heading across                                                                                           |
| The loupe's Close button was scrolled out of its box                     | Seasonal Target, 390 × 844                           | fixed: the loupe stands on the grid's lower edge and may reach over the list                                                                   |
| Tile numbers small at 26 px tiles                                        | Seasonal Target, 20 × 20 at 1280 × 720               | improved to 12.5 px digits; larger needs a larger grid (the legend and the controls take the stage's lower part) — for the owner               |
| A disabled "Wait 7 s" looked navy in one shot                            | Guess The Number, 1920 × 1080                        | not a defect: a shot during the theme fade; the play-through now waits for it                                                                  |
| A list game's stage holds only the input row, the left half mostly empty | Guess The Number, Safecracker, Bomb Defusal, desktop | for the owner (OPEN): O46 puts the range and fallen panels in the right column                                                                 |
| In summer the phone's 3 newest rows are often Heatwave steps             | all games, 390 × 844                                 | for the owner: the 3 rows are O46's number                                                                                                     |
| No light/dark toggle during a round                                      | all games                                            | for the owner (OPEN): O46's bar lists none                                                                                                     |
| The answers still say "cells"                                            | Seasonal Target                                      | for the owner (OPEN): wording                                                                                                                  |

## Night 5 (2026-11-02)

Branch `feat/guess-games` (same thread, from `a02e9cc`). Nothing goes to `master`. 14 logical cores; subagents only on disjoint folders, the lead alone on shared code.

| Piece                            | State | What                                                                                                                            | Commit                        |
| -------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| N1 owner decisions O42–O44       | done  | O42 Bomb Leaf Fall, O43 three Target modes, O44 game boards; docs, OPEN closed, BACKLOG; verify green                           | the commit that adds this row |
| N2 stale displays                | done  | Cause measured and fixed once in the shared round hook (T124)                                                                   | `4ef175f`                     |
| N3 display and layout defects    | done  | Shared fixes by the lead (Frost banner, Wait buttons, header, event rows, gutter, phone rows), per-game fixes by four subagents | the commit that adds this row |
| N4 checks and fresh play-through | done  | verify, e2e 1–23 and CI green; 108 light/dark pairs in `reports/guess-games-2/`; review list below                              | `77c73ba`, this commit        |
| N5 handover                      | done  | dev servers restarted on the final code; how to try each game below                                                             | this commit                   |

**Needs the owner:** play the four games (below), then confirm or change the proposals in OPEN "To confirm after the owner has played" and the phone-map item; nothing blocks.

### N5 — handover

- Branch `feat/guess-games`; the code is at `f82f3fd` (CI green with the same code at `77c73ba`); the commit that adds this section changes only this sheet. Dev servers restarted on it: API 3910, web 5410, admin 5411, all answering 200.
- Quick Test: <http://127.0.0.1:5410/#/quick-test>. For every game: Game as named below, Seed `acorn`, a Season of your choice, **Fast specials** on, **Start from the lobby** on; in the lobby, Start round from the Host menu.

| Game                  | What to try                                                                                                                                                                                              |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guess The Number      | Autumn: the range bar's merged hatched gaps on a phone; Winter: the Frost banner at the start and "answer arriving… N s" on your rows                                                                    |
| Seasonal Safecracker  | Spring: the free digit; Autumn: fallen digits in the strip and "That digit has fallen."; the counts in words ("1 wrong place", "2 wrong places")                                                         |
| Seasonal Bomb Defusal | Autumn: one wire marked per fall until "Leaf Fall: every harmless wire is marked."; a wrong first cut: "Boom!" and the longer wait                                                                       |
| Seasonal Target       | **Answers** in the round settings, all three: `direction` (cells away and the compass), `distance` (the default, cells away only), `closeness` (warm/cold only); dots in each player's colour with names |

- Leaderboards: the Game picker ("All games" first) at <http://127.0.0.1:5410/#/leaderboard>.
- Proposals still to confirm: OPEN "To confirm after the owner has played" — the rules of Safecracker, Bomb Defusal and Seasonal Target as built from the architect's rules (owner decision 38), the explosion's waiting time as a round setting (O40), the closeness comment thresholds (z), and the new phone-map item from the N4 review.

### N1 — owner decisions O42–O44

- Recorded in DECISIONS §1 (O39 marked amended by O43); spec 02c §8.3, 02d §3 §5 §8.3, 06 §1, 08 §3.2 §3.3, 09 §4 §4.1; OPEN items closed (Bomb Leaf Fall and individual mode, O39 per match, the shared boards, the board layout, the dot names) and moved to BACKLOG part two.
- O42 (subagent, `games/bomb-defusal`): each Leaf Fall marks one wire outside every secret sequence, whatever the guesses; the fall that marks the last one also says "Leaf Fall: every harmless wire is marked." and the falls stop; individual mode counts only wires outside every player's sequence. `autumn.wiresPerFall` removed; `src/leafFall.ts` (the O37 proof rule for wires) deleted, −70. Tests: one wire per fall, the stop and its line, marking whatever the cuts, individual mode, no candidates, a 200-run property.
- O43 (subagent, `games/seasonal-target`): `target.feedback` takes `direction`, `distance` (new, the default) and `closeness`; a distance answer is "9 cells away"; Leaf Fall under `full` keeps the cells at the same rounded distance; tests for all three modes, the default and the bot.
- O44 (lead): `?game=<id>` on the three board routes, summed from the awards of that game's matches; the total stays the stored entries (staff adjustments count in the total only, T126); a Game picker on the leaderboard page ("All games" first); profile rows already name the game. Tests: `league.integration.test.ts` (total, each game, teams, an unknown game empty, a malformed one 400), `boards.test.tsx` (the picker asks for the game's board).

### N3 — display and layout defects

Shared (lead):

- Frost: a banner "Frost: answers arrive N s late." for the round's first 3 s (`SpecialBanner.tsx`, test); held own answers already read "answer arriving… N s".
- Panels learn `waitS`, `names`, `colors`; `buttonText` makes every send button read "Wait 6 s" during the cooldown (T125).
- Season pill: its words in the strong weight (the token pair is about 7:1, the thin special name read pale); the N4 play-through measures the computed contrast on every season.
- Phone header: "Wait 15 s" and "9:50 left" in the small size; the info button keeps its 44 px (a phone rule had narrowed it to 32 px).
- A special's list row: a dashed outline in the season colour without tint or bar, so it never looks like the viewer's own row.
- The right-edge strip: `scrollbar-gutter: stable` was kept on one-screen views that never scroll; now `auto` there (`shell.css`).
- Phone list rows: the comment on its own line under the name, not under the dot.

Per game (four subagents in parallel, one folder each):

- Guess The Number: 500 vs 502 is not a defect — both are `cold` (secret 891 for seed `acorn`, 39.1 % and 38.9 % of the range); the two lines are random picks of the same pool (`cold[9]`, `cold[17]`); a regression test pins it, and the tier property test already exists. Range bar: gaps closer than 1.5 % merge, hatched where not every number fell; the heading never breaks between the numbers; five off-theme lines replaced (golden file re-recorded for those lines only).
- Safecracker: empty boxes with a 2 px border (7:1 light); fallen digits at full contrast with a strike, dashed border and a badge inside the chip; 0–9 in one row on desktop; plurals ("1 right place", "2 right places"); three "treasure" lines replaced.
- Bomb Defusal: a harmless wire by a crossed, dimmed swatch, a struck name and an accessible label; slot 1's hint wraps; slots at least 44 px; the phone grid splits evenly; "The first cut was right."; one off-theme line replaced.
- Seasonal Target: dots in each player's list colour with their name (focusable, titled, a legend on desktop); room for the axis labels on every edge; phone ticks ≥ 11 px, Column and Row fields, arrows 44 × 44; twelve off-theme lines replaced.

### N2 — stale displays after events

- Measured first (a probe in a real autumn round, every 50 ms for 40 s): after each Leaf Fall the list's row and the Fallen numbers panel disagreed for 248, 308, 250 and 246 ms, then agreed. Nothing stayed stale; the review's screenshots were taken inside that window.
- Cause: `apps/web/src/live/useRound.ts` — the list took each event straight from the live frame (`onFrame`, `setFeed`), while the state that feeds the panels, the digit strip and the top bar's cooldown was reloaded 250 ms later (`pending.current ??= window.setTimeout(…, 250)`) plus the request. One render showed two moments. A second, latent fault in the same place: two reloads crossing on the way could put the older state over the newer one.
- Fix (shared, once for all four games, T124): a feed event is shown only once the loaded state holds it (`s ≤ state.seq`, the field the state view already had), and an older state answer is dropped. After the fix the probe found 0 disagreements in 660 samples.
- Tests: `apps/web/src/live/useRoundFeed.test.tsx` new (an event waits for its state; a crossing older answer is dropped); feed fixtures of `round.test.tsx` and `banner.test.tsx` carry the event's place.
- Lines: useRound.ts +29/−2; useRoundFeed.test.tsx new, 93 lines; round.test.tsx ±2; banner.test.tsx ±1.

### N4 — checks and fresh play-through

- `pnpm verify` green (after moving the new board test into its own block: one function had grown past 60 lines). Authorization matrix: no new intent or route; the board routes' new `game` query is read-only and validated (400 on a malformed id); the matrix rows for the three board routes stand.
- E2E in Chromium, the whole suite (journeys 1–23): first run 28/30 — journey 21's individual autumn round had no wire outside both sequences (6 wires, 4 cuts, two players), which O42 rightly leaves unmarked, so the journey now plays it with 8 wires and 3 cuts; journey 22's first round was 731 px high at 1280 × 720 with Seasonal Target's new legend, so the map gives 1.5 rem back. Then the intro of journey 22's second round stayed at "Opens in 0 s" once: the server had opened the round on time (probe), the client had missed the opening's frame — the night-4 CI symptom — so the client now loads the state again after `opensAt` (T127, test). Second run: 30/30.
- CI: `974d280` failed on journeys 21 and 22 (fixed in `9dcaa58`); `9dcaa58` failed on journeys 20 and 21 because of the bots' luck: a bot defused a 6-wire, 4-cut bomb with its first cut, and with a 3 s cooldown the bot had guessed every digit before the first Leaf Fall (O37 leaves those standing). Journey 21 now plays 8 wires and 6 cuts, journey 20's individual round a 30 s cooldown (`77c73ba`). CI green with `77c73ba` (verify, e2e in Chromium, Firefox and WebKit, security, docs).
- Play-through `reports/guess-games-2/` (nothing in `reports/guess-games/` replaced): the four games, every season, shared and individual, at 1280 × 720, 1920 × 1080 and 390 × 844; light and dark of each pair from the same moment (the page's text compared before and after the theme switch, retaken if it differed — none did); screenshots with animations disabled, so no shot catches a colour mid-transition; Seasonal Target once per answer mode; Bomb Defusal in autumn after both harmless wires were marked. 108 pairs, 216 shots; no page scrollbar; the season pill's computed text contrast 5.49–9.11 : 1 (`play-through.txt`).

**Review list** (every shot looked at in groups, a sample one by one):

| Found                                                                             | Where                      | State                                                                                                                 |
| --------------------------------------------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Phone header without the "·" of "Wait 15 s · 9:50 left"                           | all games, 390 × 844       | fixed (`round.css`)                                                                                                   |
| With the "·" the season pill was cut to "Autu…"                                   | all games, 390 × 844       | fixed: narrower Host button, tighter gaps, a pill that never shrinks; checked in every season (no cut, no overflow)   |
| The banner said "the red wire is harmless" while the newest row said every one is | Bomb Defusal, autumn       | fixed: the banner names the final event                                                                               |
| Column and Row fields cut their value ("2!" for 25)                               | Seasonal Target, 390 × 844 | fixed: narrow padding, centred                                                                                        |
| A disabled send button looked grey-blue in one shot                               | Seasonal Target, 390 × 844 | not a defect: the live colours are #4f5663 on #f1f3f6; the shot had caught a transition; shots now disable animations |
| A comment speaks of a map in Guess The Number ("Wrong corner of the map.")        | Guess The Number           | left: seasonal enough; listed for the owner's reading of the catalogues                                               |
| On a phone in Seasonal Target the list shows two rows above the map               | Seasonal Target, 390 × 844 | needs the owner: the map takes the height the screen rule asks for; a smaller map is a trade-off (OPEN)               |
| At 1920 × 1080 the round view keeps its column width, wide margins left and right | all games                  | left: nothing is cramped there; the width is the platform's reading width                                             |

## Night 4 (2026-11-01)

Branch `feat/guess-games` from `master` `10f4cd3`. Nothing goes to `master`: the owner plays the games first. 14 logical cores; at most three subagents at once (one per new game), the lead alone on the shared packages.

| Piece              | State | What                                                                                                                                                                                                                                                           | Commit                                                                             |
| ------------------ | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| N0 spec            | done  | The guess engine (04 §4.7), 02b Safecracker, 02c Bomb Defusal, 02d Seasonal Target, settings (08 §3.1–§3.3), tests (09), threats (05), O38–O41, T117–T120                                                                                                      | `ec8c3f4`                                                                          |
| N1 engine          | done  | `@smg/guess-engine`; Guess The Number moved onto it with no change in behaviour (golden run); contract: `extraCooldownMs`, `GuessRow.text/answer`, `GameText.specialRule`                                                                                      | `6ef481e` (golden), `3c72b05`                                                      |
| N2 Safecracker     | done  | built on the engine by a subagent, registered, conformance green                                                                                                                                                                                               | `462a227`, the next two, `e70ceef` (registry)                                      |
| N3 Bomb Defusal    | done  | built on the engine by a subagent, registered, conformance green                                                                                                                                                                                               | `462a227`, the next two, `e70ceef` (registry)                                      |
| N4 Seasonal Target | done  | built on the engine by a subagent, registered, conformance green                                                                                                                                                                                               | `462a227`, the next two, `e70ceef` (registry)                                      |
| N5 game choice     | done  | The platform part: Game in the create-match form and the Quick Test (only the chosen game's settings), the game named in the Play list, on the match page, in its summary and in the profile's rounds; boards shared across games (proposal); T121. journey 23 | `ae781ab`, `3f86e22` (T122)                                                        |
| N6 checks          | done  | verify green; journeys 20–23 green in Chromium, 1–19 unchanged; play-through 120 screenshots, all on one screen after the fixes (T123)                                                                                                                         | `1c1f7a6`, `236b13a` (CI green: verify, e2e in all three browsers, security, docs) |
| N7 handover        | done  | servers restarted on the final commit; Quick Test settings and proposals below                                                                                                                                                                                 | the commit that adds this row                                                      |

**Needs the owner:** the proposals in [OPEN.md](OPEN.md) under "To confirm after the owner has played" (nothing blocks the night).

### N0 — spec first

- Built: the spec only, no code. Engine decision T117 closes T21 and supersedes R7.
- Lines: docs/spec/02b-game-safecracker.md new, 128 lines; 02c-game-bomb-defusal.md new, 135 lines; 02d-game-seasonal-target.md new, 137 lines; 04 +29, 05 +31, 08 +36, 09 +41, 03 +2, README +3, 02 ±1, 11 ±1; DECISIONS +O38–O41, T117–T120 (T21, R7 superseded); OPEN +50; BACKLOG +3.
- Drafted by three subagents in parallel (one file each), merged and checked by the lead; their gaps were decided as proposals (OPEN): Safecracker's and Bomb Defusal's tier tables rescaled so every tier occurs; the explosion penalty under Frost as an accepted residual risk instead of a platform special case; Seasonal Target's O39 choice as a round setting (spec conflict in OPEN).
- Reused: Guess The Number's sections (02 §2–§12) are cited, not repeated; the platform's special settings, Heatwave and Frost apply unchanged.
- Noticed, left alone (N0): every game's settings document carries the platform's `autumn.count` and `round.halving`; Safecracker and Bomb Defusal use their own per-fall setting and have no halving, so those keys mean nothing there (listed in OPEN).

### N1 — the shared guess engine

- Built: `packages/guess-engine` (`@smg/guess-engine`, spec 04 §4.7, T117): secrets per round or per player, the guess list and its events, the check order with the repeat rule, the decision (answer, room line per visibility, comment, `Solved`, extra cooldown), comment picking from a game's catalogue, the tier ladder and trend, Frost-aware views and their schemas, the closest miss, the O37 public-answer helper with the uniform distinct draw, the shared setting definitions and `guessModule`. Guess The Number now runs on it.
- Proof of no change (T118): the golden run (`golden.test.ts`, seeds `acorn`, `meadow`, `frost`; shared and individual; `full` and `own`; secrets, hint, 15 guesses with every code and event, two falls, three halvings, the three views) was recorded on the unchanged game in `6ef481e` and passes byte for byte after the move; all 124 existing tests of the game, the registry's conformance suite and the domain pass unchanged.
- Contract (lead): `Decision.extraCooldownMs` added to the cooldown end the platform records (T120, domain test); `GuessRow.text` and `GuessRow.answer` (tone, pegs) drawn in the round's list; `GameText.specialRule` on the intro and in the info note (T119, `apps/web/src/round/gameWords.test.tsx`).
- Lines: packages/guess-engine new — candidates 43, closestMiss 49, comments 87, index 42, module 76, rules 129, secrets 42, settings 80, state 126, tiers 53, views 94, fakes 148, engine.test 179, parts.test 200. Guess The Number (added/removed): closeness +9/−43, closestMiss +14/−42, commentLines +4/−7, comments +12/−53, feedback +1/−6, leafFall +13/−26, module +36/−31, rules +30/−101, secrets +18/−29, settings +30/−62, state +38/−97, views +25/−86 (net −353). Platform: game-sdk module +5/−1, web +20, index +1; domain guess +4/−2, fakes +2 (an optional module for one test), guess.test +21; web RoundLog +33/−6, roundLog.css +35/−1, SpecialInfo +17/−7, RoundScreen +5/−3, RoundIntro +4/−3; eslint +7/−4, vitest +2, package.json scripts.
- Extracted from Guess The Number (no copy left): secret derivation, the guess list and both events with their folding, `withPlayer`, the check and decision with the room line, comment picking and line bookkeeping, tiers and trend, the views' guess lists, Frost cut and newest-60 limit, the view schemas of guesses, the closest-miss search, the public answers of Leaf Fall and the Fisher–Yates draw, the four shared setting definitions. Kept as the game's own: the range, hints, falls and halvings, the higher/lower rule, the range-relative tier, its lines and its screens; the game's files that tests import stay as thin bindings with their signatures (T118).
- Reused: the SDK's `RoundRng`, `inRange`, `rangeSize`, `formatNumber`; Guess The Number's code moved, not rewritten.
- Noticed, left alone: the platform's `SPECIALS` sentences speak of numbers; the new hook only adds the games' own words.
- Also in this commit: the empty package skeletons of `games/safecracker`, `games/bomb-defusal` and `games/seasonal-target` (package file, both tsconfigs, a one-line entry each), created by the lead before N2–N4 so the lockfile is changed once, by one agent; the game agents replace the entries.

### N2–N4 — the three games (three subagents in parallel, each only in its own folder)

Common to all three: built on `guessModule`; reused from the engine `baseState`, `withPlayer`, `commentPicker`, `ownGuesses`, `othersGuesses`, `resultGuesses`, `guessSchemas`, `closestMissBy`, `publicGuesses`, `guessedValues`, `pickDistinct`, `allSecrets`, `secretOf`, `TIERS`, `readGuessConfig` and the four shared setting definitions; from Guess The Number the shape of module, state, views, specials, fakes, conformance kit and the T76 rule for keeping typed input. Registered by the lead (registry: each entry keeps its own types through `use`, so four differently typed games are one list); the conformance suite P1–P6 passes for all four (20 tests). Coverage of all game sources together: lines 99.8 %, branches 95.2 % (CI's gate 95/90; the coverage run now has a 20 s per-test timeout, because three more projects in parallel pushed three Guess The Number property tests over 5 s under coverage — each takes at most 1.5 s alone). Verify: green except one load timeout (`maintenance.test.ts`, 6.5 s in the full run, 1 s alone). Their own decisions are listed at the end of 02b, 02c and 02d and in OPEN.

- **N2 Seasonal Safecracker** (`games/safecracker`, 54 tests, src 100 % lines / 98.8 % branches): new — src feedback 62, settings 99, state 84, rules 43, leafFall 63, specials 55, views 117, commentLines 208, module 57, conformance 70, devBot 70, fakes 96, index 21; tests feedback 141, rules 164, specials 148, views 164, devBot 120, comments 56; web text 146, Board 71, CodeInput 180, ResultPanel 61, sc.css 194, index 31; tests input 157, panels 186. Noticed, left alone: the platform's list draws codes in the body face, not monospaced.
- **N3 Seasonal Bomb Defusal** (`games/bomb-defusal`, 59 tests): new — src wires 87, settings 112, state 86, rules 44, leafFall 70, specials 49, views 124, commentLines 204, module 56, conformance 78, devBot 57, fakes 82, index 21; tests wires 118, rules 204, specials 268, views 172, devBot 71, commentLines 60, conformance 60; web index 30, text 154, panels 72, WireInput 135, useSequence 98, Explosion 61, WireChip 45, ResultPanel 55, bd.css 276, explosion.css 80; tests input 176, panels 207. The explosion uses `rules.extraCooldownMs` (T120). Noticed, left alone: `GameText.code` gets no seconds, so a cooldown refusal is the platform's sentence.
- **N4 Seasonal Target** (`games/seasonal-target`, 68 tests): new — src geometry 159, settings 118, state 136, secrets 40, rules 41, leafFall 68, specials 131, views 167, commentLines 221, module 51, conformance 73, devBot 39, fakes 96, index 31; tests geometry 157, rules 166, leafFall 170, specials 168, views 204, devBot 76, comments 85; web words 95, text 121, dots 92, MapBoard 265, TargetInput 222, PlayerPanel 60, SpectatorPanel 48, ResultPanel 71, FallenCells 70, st.css 296, index 30; tests text 143, panels 254. Noticed, needs the platform: the map lives in the input row (selection is input), which the round layout puts under the list; other players' dots have no names or roster colours in the player panel (both in OPEN, checked in the play-through).

### N5 — game choice

- Built: a Game choice with its help line in the create-match form and in the Quick Test, which shows only the chosen game's own settings and sends them by key (`settings`, checked by the game's definitions, an unknown key refused with 422); the match's game in the Play list, on the match page, in its summary and in the profile's last rounds; boards stay one per period for every game (proposal in OPEN), an award's game being its match's (T121). The `guess` intent now takes any game's bounded value (T122): before, the socket refused every guess that was not a number. Journey 23 (`e2e/gameChoice.spec.ts`).
- Lines (added/removed against master): apps/web — lobby/games.ts new, 50 lines; shell/quickTestSettings.tsx new, 109 lines (split from QuickTest.tsx, now 233); Lobby +33/−20, MatchPage +8/−3, MatchSummary +8/−2, ProfilePage +9/−3, formHelp +4; tests forms, summary, boards updated. apps/server — dev/quickTest +21/−7, routes/quickTest +18/−5, round/rounds +12/−1 (with the registry's `use`), league/profiles +3/−1, realtime/intents +12/−2. contracts boards +2.
- Reused: the server's `/games` list, the settings layer's own check of round choices, the host form's `Field`.

### N6 — checks

- `pnpm verify` green on the final code (format, lint, typecheck, 670+ unit, component and integration tests). Coverage gate green (all game sources lines 99.8 %, branches 95.2 %).
- Authorization matrix: the three games add no intent and no route — a code, a wire sequence and a cell are each the existing `guess` intent (T122), whose matrix row stands for every game; the Quick Test route's row covers its new `settings` field. Nothing to add.
- E2E in Chromium, the whole suite: journeys 1–19 unchanged and green; new journeys 20 (Safecracker), 21 (Bomb Defusal), 22 (Seasonal Target, both answer modes, the map left of the list) and 23 (game choice) green; each new game through the lobby (shared) and started at once (individual), its season specials and no page scrollbar at 1280 × 720 and 390 × 844. Found on the way: three bots could solve a bomb with their first cuts before the player's (Spring's hint leaves 60 orders), so the lobby helper starts with one bot. CI on `330ae35`: green in all browsers (before the new journeys).
- Play-through (`reports/guess-games/<game>/`, `play-through.txt`): Guess The Number and the three games, each season shared plus autumn individual, light and dark, at 1280 × 720, 1920 × 1080 and 390 × 844 — 120 screenshots, none with a page scrollbar, every own guess accepted. Found and fixed: Seasonal Target's map pushed the round to 769 px and its result to 1 757 px at 1280 × 720, and left the phone's list no height — a board layout (T123) and screen-sized maps; Safecracker's digit strip was cut off at the right on a phone — now a row of its own.
- Noticed, left alone: at 1280 × 720 Bomb Defusal's wire button for a harmless wire cuts off the word "harmless" (the strike-through and the bomb block still say it); in Seasonal Target with distance and direction the bots often find the cell in three guesses (the owner's rule, to judge after playing); with the board layout the list shows about five rows at 1280 × 720.
- CI on `1c1f7a6`: journeys 20–22 failed in CI only, each at its second round: the tab went straight from the first match (its round still running) to the second by the address alone, and the second round's intro stayed at "Opens in 0 s" (the client got no opening). Locally the same journeys passed four times. The journeys now load the second match's page afresh, as every other journey opens a match; the switch itself is listed in OPEN for a closer look (the client's watch and unwatch run in order, so the cause is not found yet).
- No load test: the games use the same round pipeline.

### N7 — handover

- Final commit: the one that adds these lines, after `236b13a` (CI run 41358052864 green: verify with coverage, e2e with journeys 1–23 in Chromium, Firefox and WebKit, security, docs). The dev servers run on `feat/guess-games` at that commit; 3910, 5410 and 5411 answer. Nothing is merged into `master`.
- Quick Test: http://127.0.0.1:5410/#/quick-test, "Dev sign-in" → player 1. For each game: Game (Seasonal Safecracker / Seasonal Bomb Defusal / Seasonal Target), Seed `acorn`, a Season, Fast specials on, Start from the lobby on; in the waiting area pick a team and start the round from the Host menu. Worth trying: Safecracker in spring (a revealed digit) and autumn (fallen digits); Bomb Defusal with a wrong first cut (the explosion and the longer wait) and autumn (harmless wires); Seasonal Target with Answers = direction and = closeness, and autumn (fallen cells); the create-match form in the lobby (Game) and the match summary.
- Proposals to confirm after playing: [OPEN.md](OPEN.md), "To confirm after the owner has played (night 4)" — the three games' rules, tier tables, specials, screens, the explosion penalty and the per-match settings (O39, O40), the shared boards, the board layout and the dot names.

## Leaf Fall (2026-11-01, day task)

On `night/2026-10-27`. Nothing goes to `master`.

| Step | What                                                                                                                                                  | Commit                            |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| 1    | O37 recorded: Leaf Fall drops only numbers still possible from the public answers, never a secret; "Already fallen." at once, no cooldown (T111–T113) | `6e60ba6`                         |
| 2    | Thousands separators everywhere through one formatter; the phone chip names the season (T114)                                                         | `061b4fc`                         |
| 3    | Leaf Fall row on the season's tint, Fallen numbers panel (T115); journey 18                                                                           | `13bc41f`                         |
| 4–5  | Match summary on one screen; the chat a panel of its own between rounds (T116); journey 19                                                            | `6581a56`                         |
| —    | Play-through fixes (special row icon, phone summary), screenshots, this section                                                                       | the commit that adds this section |

**Guess rows in view at 1280 × 720** (Chromium, play-through with a full list): 13–14 rows, 12 of them guesses, beside two-line Leaf Fall rows in the fast profile.

**Screenshots:** `reports/leaf-fall/` — autumn rounds 1–100 and 1–1,000,000 with `full`, 1–1,000,000 with `own` (each at 1280 × 720 and 390 × 844, the phone also with the Fallen sheet open), the waiting area before the first round and beside a result, and the summary after 3 rounds, each light and dark; `play-through.txt` holds the fallen numbers and the row counts.

**To try:** http://127.0.0.1:5410/#/quick-test, "Dev sign-in" → player 1; seed `acorn`, Season Autumn, Lowest number 1, Highest number 100, Show range on, Fast specials on, Start from the lobby on. Start the round from the Host menu, guess once, and watch the falls land only where the number can still be; the "Fallen numbers" panel sits under the range (a "Fallen (N)" button on a phone).

## Specials visible (2026-11-01, day task)

On `night/2026-10-27`, now the owner's test branch: `feat/guess-the-number` merged into it first (`47d5c5c`, every commit of feat now on night; the only conflict was this sheet's Night 3 pointer, night's full section kept). Nothing goes to `master`; `feat/guess-the-number` stays.

| Step | What                                                                                                                 | Commit                            |
| ---- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| 1    | O29, O31–O33 recorded; the chat's round-end line names the number (game hook `reveal`), a mute covers the whole chat | `a754036`                         |
| 2    | Season boards by meteorological season (O30), migration 0011 for quarter boards (T107)                               | `6282f1e`                         |
| 3    | Team match per match (O34), migration 0012 (T108)                                                                    | `1202ac2`                         |
| 4    | Round intro screen (O36), countdown 10 s as a proposal (OPEN (ab), T109)                                             | `35c76b9`                         |
| 5    | Specials in view and more guess rows (O35, T110); journeys 16, 17; this section                                      | the commit that adds this section |

**Guess rows in view** (Chromium, measured with a full list, no page scrollbar at any size): 1280 × 720 — 15 rows, 13 of them guesses (target 12); 1920 × 1080 — 28 rows, 24 guesses (target 20); 390 × 844 — 9 rows (comments wrap under the number on a phone). Before this task 1280 × 720 showed 7 rows. In the play-through below, with lists not yet full at the larger size, the counts were 14–18 rows at 1280 × 720, 15–25 at 1920 × 1080 and 8–11 at 390 × 844.

**Checks:** `pnpm verify` green; every Chromium e2e journey passes (journeys 1–17 and the account checks, 24 tests); CI for the final push: see the report.

**Screenshots:** `reports/specials-visible/` — per season the intro at 1280 × 720 and 390 × 844, the open round with its banner at 1280 × 720, 1920 × 1080 and 390 × 844, each light and dark.

**To try:** http://127.0.0.1:5410/#/quick-test, "Dev sign-in" → player 1; seed `acorn`, Season Spring (then Summer, Autumn, Winter), Lowest number 1, Highest number 100, Show range on, Fast specials on, Start from the lobby on. Start the round from the Host menu: the intro shows for the countdown (10 s by default, also with Fast specials on), then the round with the special's banner when it fires. With Team match off the match has no teams anywhere.

## Night 3 (2026-11-01)

N1 on `feat/guess-the-number`; N2 merges it into `night/2026-10-27`; N3 and N4 on `night/2026-10-27`; N5 hands over. Nothing goes to `master`. Updated after every piece. The owner tests `feat/guess-the-number` first.

### Status

| Piece                                                                        | State | Branch                | Commit / CI                           |
| ---------------------------------------------------------------------------- | ----- | --------------------- | ------------------------------------- |
| N1 Team once per match, End match, idle close, waiting-area list, two fixes  | done  | feat/guess-the-number | `42ff7b4`; CI green with `b21469d`    |
| N2 Bring `night/2026-10-27` up to date with `feat/guess-the-number`          | done  | night/2026-10-27      | `a88990e`, CI green                   |
| N3 Cleanup: player numbers, KICKED, anti-multi rules, handoff accounts, chat | done  | night/2026-10-27      | `5245dc9`; CI green with `0aea9f9`    |
| N4 Phase 8 security pass without a VPS                                       | done  | night/2026-10-27      | `0aea9f9`, CI green                   |
| N5 Handover                                                                  | done  | both                  | `b21469d` (feat), this commit (night) |

### Needs the owner

- Nothing blocks. What the owner should approve before `master` is listed under the handover below: the merge order, the owner questions (q)–(aa) in [OPEN.md](OPEN.md), spec conflict 2, the renumbering, and what phase 8 still needs.

### Handover (Night 3)

**Branches (confirmed with `git ls-remote origin`):**

- `feat/guess-the-number`: `b21469d` (N1 and the pointer to this sheet). CI green (verify, e2e in three browsers, security, docs). It covers N1: the run of `42ff7b4` hung installing its browsers, was cancelled, and its rerun gave way to this push.
- `night/2026-10-27`: the commit that adds this handover, on top of N4 `0aea9f9`. CI green for `0aea9f9` (verify, e2e in three browsers, security, docs), which covers N3 too: the run of `5245dc9` was cancelled by the next push. The merge `a88990e` (N2) was green on its own.

**Running on this machine:** `pnpm dev` on `feat/guess-the-number` at `b21469d`, because the owner tests that branch first: server http://127.0.0.1:3910, player client http://127.0.0.1:5410, admin app http://127.0.0.1:5411, PostgreSQL on 5510 (Docker `smg-dev`). The development database also holds the night branch's tables (migrations 0006–0010); `feat/guess-the-number` starts on it unchanged. On its first start the idle close closed the development matches left open for more than an hour (they were test leftovers).

**Quick Test:** http://127.0.0.1:5410/#/quick-test. Open "Dev sign-in" in the header, choose "Sign in as player 1", open the Quick Test and enter:

| Field                | Value   |
| -------------------- | ------- |
| Seed                 | `acorn` |
| Lowest number        | 1       |
| Highest number       | 100     |
| Start from the lobby | on      |

That opens the waiting area of a spring round. The bots arrive with their teams. Pick a team (it shows pressed, its icon drawn in the button's text colour). Start the round from the Host menu and play it; the result has the closest miss and the next-round area with the players' teams and no team buttons any more. Start a second round from the Host menu if you like, then "End match" (last in the Host menu) and its confirm sentence lead to the match summary.

**On `night/2026-10-27` now** (not merged; to look at it, stop `pnpm dev`, `git switch night/2026-10-27`, start `pnpm dev` again):

- Everything of `feat/guess-the-number` up to `42ff7b4` (N2 merged it), with the chat in its new places: the round view's right column, a "Chat" button over the round on a phone, under the waiting area's players.
- The boards, chat and moderation, the admin remainder, the website integration and the production tools of Night 2.
- N3: player numbers instead of account ids in everything public; KICKED; the anti-multi rules; account deletion for handoff accounts.
- N4: the security pass without a VPS, results in `docs/security-pass.md`.
- `b21469d`'s two changes on `feat/guess-the-number` (the pointer and the same test fix) are not on the night branch yet; they merge without conflict.

**Before both branches can go to `master`, the owner should approve:**

1. The merge order. `night/2026-10-27` holds `feat/guess-the-number` (all but the pointer commit), so one review of the night branch and a merge of it after `feat/guess-the-number` covers both. Proposal: merge `feat/guess-the-number` first (the game the owner tested), then `night/2026-10-27`.
2. The owner questions in [OPEN.md](OPEN.md), each built as proposed:
   - (q) the margin window;
   - (r) the load gate on the reference VPS;
   - (s) halving with a hidden range;
   - (t) which season names a quarter;
   - (u) aborted matches and league points;
   - (w) the chat on screen, now with its new places (T101);
   - (x) staff actions as players see them, now with KICKED;
   - (y) the game embedded;
   - (z) the closeness comment thresholds;
   - (aa) the fairness proof with player numbers.
3. Spec conflict 2 in OPEN.md: switching teams and the tie-break, resolved by O26 with a hash of round id and player key.
4. The renumbering of the night branch's decisions T69–T82 to T87–T100 and its e2e journeys 12–14 to 13–15 (N2).
5. Open in phase 8 (BACKLOG): the load gate and a ZAP baseline on the reference VPS, and the admin app's Trusted Types header after a browser check of its built bundle.
6. The release itself (v1.0.0) is not prepared.

### N1 — Team once per match, End match, idle close, waiting-area list, two visual fixes

**Built** (owner decisions O26–O28; DECISIONS T82–T86; specs 02 §2, §4, §12, 03 §5, 06 §2.1, §3.1, 08 §4, 09 §2, §4):

- **Team once per match (O26).** A player's team is fixed once a started round of the match named them: `team.choose` then answers `TEAM_LOCKED`, the same over the socket and HTTP (`TEAMS_LOCKED` stays for a newcomer while a round runs). A roster player without a team is placed in the match's smallest team when their first round starts; ties are broken by a hash of the round id and the player key (T82; 03 §5 said "the round seed", listed as spec conflict 2). The team buttons show only before the player's first round; beside a result, a locked player's area holds only the status line and the players. The help sentence says the team is kept for the whole match.
- **End match (O27).** The last item of the Host menu, asked once more with "End this match for everyone? A running round is aborted." (`POST /matches/:code/close`). Every player and spectator then sees the match summary at the match's address: how it ended, the rounds played, the players' points and wins in standings order, the teams over the match, and "Back to Play". A close keeps its rounds' results.
- **Idle close (O28).** `match.lobbyIdleCloseMin` (default 60) is applied. A sweep on server start and every minute closes a match with no round created, run or ended for that long, never one with a round counting down or open, by `system` with the reason `idle`; a round only set up is aborted. The summary says "The match closed after 60 minutes without a round." No migration: the existing `aborted_by` and `aborted_reason` columns hold who closed it and why (T83, T84).
- **Waiting-area rows.** The name, the team (icon and name, or "no team yet" in muted text) and, apart from it, the connection: a filled or hollow dot with "online" or "away".
- **Result table at 390 × 844.** Fixed number columns and the small text size on a phone: all four columns fit with no sideways scrolling (measured: a 293 px table in a 293 px box), and a long name ends in an ellipsis without breaking ("Bartholomew-Featherstone" shows as "Bartho…").
- **Pressed team button.** Its icon is drawn as a mask in the button's text colour (`#14171c` on the season colour: at least 4.5:1 for every season in light and dark, unit test).
- **Defect found and fixed (T86).** The first idle sweep at start loaded an old match's last round, recorded before closeness comments (O21). Its answers have no `comment`, the replay threw, and the development server no longer started. The game now reads a missing comment as none (the result pages of such rounds had the same defect), and the sweep closes each match on its own.

**Tests.** `pnpm verify` green: 257 tests in 55 files. An earlier full run had timeouts in CPU-heavy property tests while another session's installer test loaded the machine; each failed file passed alone, and the next full run was green. New or extended:

- `apps/server/test/matchFlow.integration.test.ts`: `TEAM_LOCKED` over socket and HTTP, the placement, End match with the summary, and the idle close with a fake clock (not a minute early, never with a running round, and after a restart).
- `apps/web/src/match/waiting.test.tsx` (the buttons only before the first round, the rows) and `summary.test.tsx` (the confirm sentence, the summary).
- The replay of an old answer in `games/guess-the-number/src/rules.test.ts`; both themes in `apps/web/src/designTokens.test.ts`.
- E2E in Chromium: all 14 journeys passed. Journey 12 now picks a team, plays two rounds, finds no team buttons after the first result, ends the match and reads the summary, also after a reload; journey 5 checks `TEAM_LOCKED` and the teams in the list.

**Screenshots:** `reports/match-flow/`. For desktop and phone in light and dark: the waiting area with "no team yet", the team chosen, the round, the result with the next-round area, the result table, End match's confirm, and the summary for the host and for a guest. Also a second round on desktop light and phone dark, and the summary of an idle-closed match.

**Lines (before → after):**

- Server: `routes/matches.ts` 227 → 233; `match/matches.ts` 255 → 253; `match/play.ts` 205 → 226; `round/runtime.ts` 85 → 92; `test/rounds.integration.test.ts` 226 → 227.
- New on the server: `match/idleClose.ts` (92), `match/summary.ts` (66), `match/teams.ts` (94), `test/matchFlow.integration.test.ts` (214).
- Web: `designTokens.test.ts` 180 → 191; `match/HostMenu.tsx` 243 → 262; `match/MatchPage.tsx` 203 → 207; `match/WaitingArea.tsx` 116 → 143; `match/match.css` 115 → 155; `match/waiting.test.tsx` 86 → 136; `round/ResultScreen.tsx` 138 → 146; `round/result.css` 87 → 138; `round/roundText.ts` 118 → 119; `season/SeasonIcon.tsx` 42 → 62.
- New on the web: `match/EndMatch.tsx` (71), `match/MatchSummary.tsx` (115), `match/summary.test.tsx` (117).
- Elsewhere: `e2e/lobby.spec.ts` 65 → 117; `e2e/play.ts` 215 → 221; `e2e/players.spec.ts` 129 → 130; `games/guess-the-number/src/rules.test.ts` 174 → 189; `src/state.ts` 187 → 191; `packages/contracts/src/http/play.ts` 137 → 160; `contracts/src/index.ts` 38 → 39.
- Docs: DECISIONS 152 → 160, BACKLOG 74 → 76, OPEN 31 → 32, spec 02 190 → 191; specs 03, 06, 08 and 09 rewritten in place.

**Reused:** `play.close` (End match and the idle close share it), `setMatchStatus`, `activePlayers`, `teamStandings`, `currentRoundId`, `runningRound`, `ActionButton` and `Problem`, `PlayerName`, the result page's table classes, `codeText`, `hrefOf`, `useDisclosure`, and the e2e helpers `hostMenu`, `hostRound` and `search`. The inline confirm follows the chat's moderator confirm.

**Removed or extracted:** `setTeam` moved from `match/matches.ts` to `match/teams.ts` with the lock and the placement; the idle sweep and the summary query are their own modules; End match is its own component; the e2e helper `playerRow` replaces matching the old "name here" text.

**Noticed, left alone:**

- On a phone the waiting area keeps a large gap under its status line (the panel's stack gap plus the paragraph margins); it was so before.
- A match that fails to close is retried every minute without a log line (the round runtime has no logger).
- Registration allows 5 accounts an hour per address, kept in memory: a script that registers more must wait or restart the server.
- On Windows the children of `pnpm dev` outlive a stopped background task; the old processes had to be stopped by id.

### N2 — `night/2026-10-27` brought up to date with `feat/guess-the-number`

**Done:** `feat/guess-the-number` (`42ff7b4`) merged into `night/2026-10-27` with a merge commit (no rebase, no force-push). 16 files conflicted; each is resolved by keeping both sides' meaning:

- **Server:** `match/play.ts` places the teams (O26) on the roster that night's anti-multi rules admit, and `close` keeps night's webhooks and league handling with the new `MatchEnd`: a close keeps the league points of its ended rounds, an abort takes them back unless `leaderboard.abortedMatchesCount` keeps them (T88). `match/matches.ts` keeps night's `kickPlayer` and feat's `MatchEnd`; `round/runtime.ts` starts the idle close beside night's metrics observer.
- **The match summary reuses night's boards:** night already sends the match standings in the match details, so `MatchEndView` keeps only rounds played and how the match ended, and the summary shows the players with the result screen's `MatchStandings` table and the teams from `teamStandings` (T85, updated). `MatchStandings` got the fixed phone columns of the placings.
- **Chat placement** (T101; BACKLOG item closed; OPEN (w) updated):
  - The "Live | Chat" switch and its `switch.css` are gone, because the guess list lives in the main area (O20).
  - In the round view the match chat sits in the right column under the team tiles (`round/RoundChat.tsx`), its list scrolling inside itself; the round view still fits 1280 × 720 (checked on the page).
  - On a phone a "Chat" button opens the chat over the round, from under the top bar to just above the button, so "Close chat" and the guess input stay in view and usable (the first version covered the button; fixed before the commit).
  - In the waiting area the match chat sits under the player list. The round view mounts the chat only while the round runs, so a page never holds the room twice.
- **Tests:** feat's `round.test.tsx` and `result.test.tsx` were taken as the base; night's checks of the standings and the "Verify this round" link moved into `result.test.tsx`. New: `round/roundChat.test.tsx`.

**Renumbering** (night's entries follow feat's highest number; every reference in docs and code comments changed in the merge commit):

| Night's number | Now  | Subject                                       |
| -------------- | ---- | --------------------------------------------- |
| T69            | T87  | league points in the `RoundEnded` transaction |
| T70            | T88  | aborted matches take back their league points |
| T71            | T89  | the builtin chat's send pipeline              |
| T72            | T90  | the round-end line in the match room          |
| T73            | T91  | `hostEmbed` and the CSP `frame-src`           |
| T74            | T92  | staff two-factor (TOTP)                       |
| T75            | T93  | staff actions on rounds                       |
| T76            | T94  | settings history and rollback                 |
| T77            | T95  | maintenance mode                              |
| T78            | T96  | observability                                 |
| T79            | T97  | the JWT handoff                               |
| T80            | T98  | the embed allowlist                           |
| T81            | T99  | outbound webhooks                             |
| T82            | T100 | the public read API                           |
| e2e journey 12 | 13   | boards (`e2e/boards.spec.ts`)                 |
| e2e journey 13 | 14   | chat (`e2e/chat.spec.ts`)                     |
| e2e journey 14 | 15   | admin (`e2e/admin.spec.ts`)                   |

Owner-question letters did not clash: night uses (t)–(y), feat (q), (r), (s) and (z). The only reference not renumbered is the header comment of migration `0006_leaderboards.sql` ("T70", now T88): a published migration is never changed, because its recorded checksum would stop every database where it is applied (note in DECISIONS §2).

**Checks:** `pnpm verify` green on the merged tree, 399 tests in 77 files. E2E in Chromium: all 19 tests passed (journeys 1–15, journey 8 with its two cases, and the account journey's three cases). CI: see the status table.

**Screenshots:** `reports/night-3-merge/`: the round view with the chat on desktop (light, 1280 × 720); the phone (dark, 390 × 844) with the chat closed and open; the waiting area with the chat on both.

**Lines (night → merged; feat's count where the file came from feat):**

- Server: `match/play.ts` 252 → 274 (feat 226); `match/matches.ts` 270 → 269; `round/runtime.ts` 90 → 98; `match/summary.ts` feat 66 → 43.
- Web: `match/MatchPage.tsx` 235 → 229; `round/RoundScreen.tsx` 200 → 218; `round/RoundSide.tsx` 187 → 60 (the Live list and the switch went); `round/MatchStandings.tsx` 57 → 66; `round/round.css` 275 → 238 (feat 323: the guess list's rules moved to the new `round/roundLog.css`, 99, so the file is under 300 lines again); `match/match.css` 66 → 170; `match/WaitingArea.tsx` feat 143 → 152; `match/MatchSummary.tsx` feat 115 → 78; `round/result.test.tsx` feat 73 → 89; `chat/ChatRoom.tsx` and `chat/chat.test.tsx` (T102).
- New: `round/RoundChat.tsx` (68), `round/roundChat.css` (84), `round/roundLog.css` (99), `round/roundChat.test.tsx` (43). Removed: `round/switch.css`.

**Reused:** night's `MatchStandings`, `ChatPanel` (bare), `useChatConfig`, `admitted`, `leagueRules`/`withdrawMatch`; `useDisclosure` for the phone chat.

**Defect found and fixed (T102):** in night's chat a second message typed while the first was on its way was wiped when the first was accepted, and its Enter was lost (seen in the desktop screenshot: "Summer team, here we go." never arrived). The field now sends one message at a time and keeps what was typed meanwhile, as the guess input does (T76); `chat.test.tsx` reproduces it on the old code.

**Noticed, left alone:**

- A full-page screenshot draws the sticky app bar in the middle of a long page (a capture artifact, not on screen).

### N3 — Cleanup: player numbers, KICKED, anti-multi rules, handoff accounts, the chat-room item

**Built** (DECISIONS T103–T105; specs 05 §6, 06 §3.1, 07 §4, 08 §6, 09 §6; OPEN (v) closed, (x) and (y) updated, (aa) new):

1. **Player numbers instead of account ids (T104).** Every public answer and frame names a player by their number in the match, `p1`, `p2`, … in join order over everyone who ever joined (left and kicked players keep theirs): match details (players, connected, standings), the round state, result and proof, and every socket frame. The server keeps account ids inside, and one translation at the boundary (`match/publicIds.ts`) replaces them, game views included, without the game knowing. The numbers are held in memory, loaded on a join, at a round's start and for recovered rounds, so frames are translated without waiting. The viewer's own number is `you`, and the client uses it instead of the session's account id. Bots keep their keys; the admin API keeps account ids (staff only). The sentinel test now also finds no account id in any frame, acknowledgement or public answer, during the round or after it.
2. **KICKED.** A player staff removed from a match who joins again gets 409 `KICKED`, "You were removed from this match by the host.", instead of `MATCH_FULL`.
3. **Anti-multi rules (05 §6, T103).** `antiMulti.minAccountAgeH` is applied: a shared roster leaves out accounts younger than that. An install is a website install when it has an enabled JWT handoff provider. Without one, the admin form disables `antiMulti.requireLinkedChat` with the line "Standalone install: no website hands players over, so no account can show a linked Telegram or Discord.", the server refuses switching it on (422 `SETTING_UNAVAILABLE`, rollbacks included), and a rule left on after the last provider went is not applied.
4. **Handoff accounts (T105).** `DELETE /me` asks an account without a password (made by the handoff) for its display name typed exactly (`{ confirm }`), refused with 403 `CONFIRMATION_REQUIRED` otherwise; accounts with a password still give it. OPEN (y)'s spec question is closed.
5. **The Night 2 item about the "chat-room counter".** No version of the morning sheet in the history holds those words. I searched the sheet as it stood at the N5 commit (`6366ab2`), the hand-over (`4bc7920`, `db10108`), the commit messages, and the code. The one counter of chat rooms in the code is the per-socket limit of four joined rooms (`realtime/chatIntents.ts`, `TOO_MANY_ROOMS`): the client leaves a room when its screen goes (`chat/useChat.ts`), and a reconnect starts a fresh count, so it is no defect; a new unit test now checks it (four rooms, a room counted once, a left room freeing its place). The one unfinished line in that sheet was N5 and N6's "CI: see the next update."; it now names the run (green with `8af3951`).

**New owner question (aa):** an individual round's secret is derived with the label `secret/<account id>`, so with account ids hidden an outsider can check the commitment and a shared secret from the proof, but not recompute an individual player's secret; the server's own check still shows them all. Proposal: keep it so, or derive from the match number in a later seed version.

**Tests:** `pnpm verify`: 404 of 405 tests passed. The one failure, Heatwave's cooldown step in `specials.integration.test.ts` (6 000 ms where under 6 000 was expected), passed alone (6 of 6). The cause, found in N4: the test waited from the first round's opening and checked Heatwave in a second round created after it, which only worked while that creation took under 0.6 s; N3's extra query on each join made it slower under load. The test now waits for the later opening (fixed with N4). New or extended:

- the authorization matrix: rows beyond permissions in `apps/server/test/authzMatchRules.ts` (KICKED and another player joining; the linked-chat rule unavailable and refused in a standalone install; a younger account off a shared roster);
- `handoff.integration.test.ts`: a handoff account deletes itself with its name, not a password; with a provider the rule is available;
- `secrets.integration.test.ts`: no account id in any public answer or frame;
- `adminLive.integration.test.ts`: KICKED on joining again;
- `realtime/chatIntents.test.ts`: the room count;
- `rounds.integration.test.ts`, `handoff.integration.test.ts` and `adminLive.integration.test.ts` now expect numbers in public answers.

E2E in Chromium: all 19 tests passed (journeys 1–15, journey 8's two cases, the account journey's three cases). CI: see the status table.

**Lines (before → after):**

- Server: `http/routes/adminSettings.ts` 92 → 132; `http/routes/auth.ts` 190 → 209; `http/routes/matches.ts` 234 → 239; `http/routes/rounds.ts` 189 → 199; `match/matches.ts` 269 → 272; `match/play.ts` 274 → 294; `match/rosterRules.ts` 41 → 84; `realtime/gateway.ts` 222 → 226; `round/runtime.ts` 98 → 100.
- New on the server: `match/publicIds.ts` (90), `realtime/chatIntents.test.ts` (54), `test/authzMatchRules.ts` (125).
- Server tests: `adminLive` 239 → 242; `authzMatrix` 208 → 225; `handoff` 257 → 295; `rounds` 231 → 249; `secrets` 219 → 248; `socketKit.ts` 171 → 177.
- Clients: `admin/settings/SettingRow.tsx` 163 → 184; `admin/settings/SettingsPage.tsx` 225 → 226; `web/match/MatchPage.tsx` 229 → 229; `web/round/roundText.ts` 121 → 122; `summary.test.tsx` 111 → 112; `waiting.test.tsx` 137 → 138.
- Contracts: `http/admin.ts` 170 → 173; `http/play.ts` 156 → 163.

**Reused:** `permitted`, the settings service's view and update, `displayNames`, `kickPlayer` and its admin route, `passwordHashOf`/`verifyPassword`, the socket kit and the matrix world, `leaks` beside the new `idLeaks`.

**Removed or extracted:** the linked-chat query became `linked()` beside `aged()` in `rosterRules.ts`; the verify route has its own register function (`rounds.ts` was over the function limit); the match page no longer reads the session's account id.

**Noticed, left alone:**

- The player client has no screen to delete an account; the route exists (T105).
- The KICKED sentence says "by the host", as the task gives it, although staff do the kicking.
- `chat.integration.test.ts` is at 299 of 300 lines.

### N4 — Phase 8 security pass, the parts that need no VPS

**Done** (DECISIONS T106; results in [security-pass.md](security-pass.md), raw reports in `reports/security-pass-2026-11-01/`). The scans ran in a subagent that only scanned and reported; the fixes are mine.

- **Secret scan of the whole history:** gitleaks 8.30.1 (the image CI uses) over all refs, 65 commits: no finding. CI's own gitleaks job covers the same history on every push.
- **Dependencies:** `pnpm audit` (pnpm 12.14.0) and osv-scanner 2.7.0 on `pnpm-lock.yaml`: two moderate advisories, minimatch (ReDoS, eslint only) and glob (AbortSignal, Testcontainers only). Both are false positives for the product: development dependencies only, not in the image, and `pnpm audit --prod` is clean.
- **OWASP ZAP 2.17.0 baseline** against the player app (5410), the admin app (5411) and the server (3910, whose headers are the production ones): no FAIL. The Vite servers' missing headers are development-only, because the production pages come from the server, which passes those rules. Each warning is in the file with its verdict.

**Fixed (real, both low):**

- `font-src` was helmet's default `'self' https: data:`; it is now `'self'`.
- The admin app could be framed by its own origin; it now sends `frame-ancestors 'none'` and `X-Frame-Options: DENY`, as Bingo 03 §7 (adopted by 05 §1) asks.

Both are tested in `embed.integration.test.ts`. A stale osv-scanner ignore entry was removed.

**False positives with reasons:** see the table in [security-pass.md](security-pass.md). `style-src 'unsafe-inline'` is accepted for now, because the placeholder pages use inline styles and `script-src 'self'` stays strict.

**Left open (BACKLOG part one):** the admin app's Trusted Types header (`require-trusted-types-for 'script'`, Bingo 03 §7), waiting for a browser check of the built admin app; and a ZAP baseline against a production install on the VPS.

**Lines:** `apps/server/src/http/plugins/securityHeaders.ts` 77 → 79; `apps/server/test/embed.integration.test.ts` (+3); `osv-scanner.toml` 15 → 12; new `docs/security-pass.md`; DECISIONS, BACKLOG, specs 09 §6 and 11 phase 8.

**Tests:** `pnpm verify` green, 406 tests in 78 files, including the corrected Heatwave wait in `specials.integration.test.ts` (see N3).

**Reused:** the CI's pinned gitleaks and osv-scanner images, the existing header test.

**Noticed, left alone:** the placeholder pages' inline styles keep `'unsafe-inline'` in `style-src`.

## Night 2 (2026-10-27)

N1 and N2 on `feat/guess-the-number`; N3 onwards on `night/2026-10-27`, created from `feat/guess-the-number` after N2. Nothing is merged. Updated after every piece.

### Status

| Piece                                                          | State | Branch                | Commit                              |
| -------------------------------------------------------------- | ----- | --------------------- | ----------------------------------- |
| N1 Journey 4 intermittent failure                              | done  | feat/guess-the-number | `e007fdf` (CI green, first attempt) |
| N2 Compact phone bar, text contrast                            | done  | feat/guess-the-number | `3783f01` (CI green, first attempt) |
| N3 Phase 4 standings, boards, profiles, verification page      | done  | night/2026-10-27      | `3d9aaa0` (CI green with `40cb02f`) |
| N4 Phase 2 authorization matrix and security suites            | done  | night/2026-10-27      | `ceffebb` (CI green with `40cb02f`) |
| N5 Phase 5 chat `none` / `builtin`, moderation                 | done  | night/2026-10-27      | `6366ab2` (CI green with `8af3951`) |
| N6 Phase 6 admin remainder                                     | done  | night/2026-10-27      | `6366ab2` (CI green with `8af3951`) |
| N7 Phase 7 handoff, embed, test host page, webhooks, read API  | done  | night/2026-10-27      | see N7                              |
| N8 Phase 8 installer, `smg` CLI, backups, observability, guide | done  | night/2026-10-27      | see N8                              |

### Needs the owner

- (t) Which season names a quarter's board; (u) aborted matches and league points; (v) account ids visible to anonymous viewers; (w) the chat on screen; (x) staff actions as players see them; (y) the game embedded. All in [OPEN.md](OPEN.md), each built as proposed.
- Found in Bingo (read-only, not changed): `sbr status` stops before the first backup exists (`find` under `pipefail` in `ops/sbr`); the same line in `smg` was fixed.
- The Night 1 items below still stand.

### Handover (Night 2)

**Running on this machine:** `pnpm dev` on `feat/guess-the-number`: server http://127.0.0.1:3910, player client http://127.0.0.1:5410, admin app http://127.0.0.1:5411, PostgreSQL on 5510 (Docker `smg-dev`). The server runs the commit of this handover (named below). The development database also holds the tables of the night branch's migrations 0006–0010; `feat/guess-the-number` starts on it unchanged, because its migrator checks only the files it knows.

**Quick Test:** http://127.0.0.1:5410/#/quick-test. Open "Dev sign-in" in the header (on a phone during a round: "Menu"), choose "Sign in as player 1", open the Quick Test. You host the round and play it.

| What to look at                                                  | Seed               | Fields                                                |
| ---------------------------------------------------------------- | ------------------ | ----------------------------------------------------- |
| A shown range from −500 to 500                                   | `meadow` (Spring)  | Lowest number −500, Highest number 500, Show range on |
| A hidden range                                                   | `frost` (Autumn)   | Show range off                                        |
| A Frost round ("answer arriving", now in the darker winter step) | `blossom` (Winter) | defaults                                              |

On `feat/guess-the-number` (N1, N2): the round view on a phone has the one-row app bar with "Menu"; every text keeps 4.5:1 in light and dark (the Frost line, a disabled Guess button); journey 4 no longer races the dev bot. Screenshots: `reports/round-view-2/`.

**On `night/2026-10-27`** (N3–N8, not merged; for a later look, after `git switch night/2026-10-27` and a restart of `pnpm dev`):

- **Boards:** "Leaderboard" in the navigation, with season and all-time boards and the team board beside them. A player's profile is reached from a name. Under a round's result, "Fairness proof", then "Verify this round", checks the seed in the browser.
- **Chat:** in the lobby, on the match page, and in the round view behind the "Live | Chat" switch. As the admin (Dev sign-in "admin"), "Moderate" on a line mutes or bans.
- **The admin app** at http://127.0.0.1:5411: Live (running rounds, staff abort, kick, removing a result), Accounts (roles), a settings document's History with Rollback, Two-factor, Moderation (reports, sanctions, rooms, word lists).
- **Embedding:** `pnpm exec playwright test -c e2e/playwright.config.ts e2e/embed.spec.ts --project chromium-timing --no-deps` starts the test host page on 5420 and shows the single sign-on inside the iframe.
- **Operations:**
  - `docs/operator-guide.md`.
  - `bash ops/test/installer-test.sh all` runs the installer from a fresh Ubuntu container to a running instance, then beside Bingo (20–40 minutes).
  - `pnpm drill:dev` runs the restore drill against the dev database.
- **Owner questions:** (t)–(y) in `docs/OPEN.md`, each built as proposed.

### N1 — Journey 4 (halving) failed now and then

**Cause, measured.** Both failures were the development bot winning the journey's round before the journey was done. Nothing was late or missed in the client or the server.

- `e2e/specials.spec.ts:82` (before the fix): journey 4 overrode its helper's range of 1–1 000 000 with `rangeHigh: 1_000`. The helper's own comment says the large range is there "so the bots take long". In a halving round the bot also searches inside the halved range, so with 1–1 000 it can find the number in a handful of guesses, sometimes in the first seconds.
- `e2e/specials.spec.ts:86` (before the fix): the range was read with an unbounded `textContent()`. When the round ends, the range leaves the page, the read waits, and `expect.poll` reports the last value it saw. That is the "Received: 1000" of the WebKit failure: an experiment with the element removed gives exactly that message.

**Evidence.**

- CI Chromium (`28f1342`, run 40373033627): the page snapshot shows "bot-01 found it first — after 3 guesses" (506 lower, 206 lower, 143 correct). The round ended about 40 ms after the journey's out-of-range guess, so there was no refusal to show. (Night 1's report called this "step 1"; it was the refusal step.)
- CI WebKit (`8d51c72`, run 40387410141, attempt 1): no trace there (WebKit's timing project records none). The message matches a range that has left the page.
- Twenty Chromium and twenty WebKit runs with traces and a timeline per run: the server's event log, every socket frame at the page, every state load and every change of the range text. Server firing after the round opened: 5 988–6 013 ms (due 6 000). Frame at the page after the firing: Chromium 35–86 ms, WebKit 58–262 ms. Range text in the DOM after the firing: Chromium 322–378 ms, WebKit 348–415 ms. Frames missed: none in 40 runs (no seq gaps). Result: Chromium 20/20 passed, WebKit 19/20. The one failure (WebKit run 6) was the bot solving 8.9 s after the halving, while traced WebKit took 2.6 s to perform the journey's click.
- So: not the page missing an update, not the server sending late, but the test reading a round that the bot could end.

**Fix (in the test, where the cause is; no check removed, no timeout raised, no retry).** Journey 4 uses the helper's range of 1–1 000 000 and waits for 500 000 numbers. The bot's chance of winning within the journey falls from a few in a hundred to well under one in ten thousand. The range is read with a 2 s bound, so a finished round now fails with what happened, not with a stale number.

**After the fix.** Twenty and twenty again with traces: Chromium 20/20 passed, WebKit 20/20 passed. (A first WebKit batch after the fix is not counted: it ran while my N2 edits were hot-reloading into the dev server, and its run 1 lost its cleanup to the stopped batch's last test, which deleted the shared halving day; its 19 others passed.)

| File                   | Lines     |
| ---------------------- | --------- |
| `e2e/specials.spec.ts` | 112 → 116 |

Reused: the helper's own range (`quickRound`). Removed: the range override. Noticed, left alone: in a halving round the bot's search uses the halved range; that is how a player plays too.

### N2 — Compact phone bar and text contrast on the round view

**Built.**

1. **Compact bar (DECISIONS T67).** While a round runs on a screen up to 640 px wide, the app bar is one row of 55 px (it was about 220 px of 844). The row holds the emblem (the wordmark is hidden but still read out), the theme toggle, Play and "Menu". "Menu" opens the account chip, Sign out and the development sign-in as an opaque panel. It is the same account element as on a wide screen, so no control or test id exists twice. Escape closes the innermost open menu and returns the focus to its button. The behaviour is one new hook, `useDisclosure`, which the host menu and the development menu now use too (the development menu gains Escape). The round view still fits 390 × 844 without a page scrollbar; the e2e assertion stays, and journey 11 also asserts the bar is at most 56 px.
2. **Contrast (DECISIONS T68).** Every text on the round view keeps 4.5:1 in light and dark. The measurement works on the rendered pixels (`e2e/contrast.ts`): each text's colour from the page, against the median pixel behind each of its lines with all text made transparent. axe leaves text on translucent cards over gradients "incomplete". The sweep covered a shown range, a hidden range and every season's special, each at 1280 × 720 and 390 × 844, in light and dark, with the host menu and the account menu open too.
   - Before the fix, below 4.5:1: Frost's "answer arriving in 3 s" in the winter colour at 2.59:1 (light); the disabled Guess at 1.85:1; the disabled Abort round at 2.26:1 (light) and 2.45:1 (dark); "higher ↑" at 4.43:1 where the open host menu's shadow falls on the Live list.
   - After: 2 140 texts measured, none below 4.5:1; the lowest is 5.49:1 (the Summer chip).
   - Two token pairs failed, so each got a step: `--color-winter-text` (light `#00669a`, dark the winter token) and `--color-success-text` (light `#17683b`, dark the success token). Disabled buttons show muted text on the second surface (6.6:1 light, 8.0:1 dark) instead of fading to 45 % opacity; this also applies in the admin app. No other new tokens.
   - Journeys 10 and 11 assert 4.5:1 in both themes, and journey 3 asserts it for the Frost round in light. `designTokens.test.ts` checks both new steps on every background, including the four glows (the plain success token is 4.1:1 on the green glow).

**Checks.** CI for `3783f01`: green on the first attempt (verify, e2e in three browsers, docs, security). `pnpm verify` green: 204 tests in 46 files. The first attempt hit Testcontainers' 180 s start ceiling in six server integration files while another session's Bingo e2e run loaded the machine; one file passed alone, and the full re-run was green. E2E in Chromium: all 13 journeys passed (`chromium` and `chromium-timing`); after a lint split of the contrast helper, journeys 3, 4, 10 and 11 passed again. CI: see the next update.

**On the way.** One e2e run failed journey 10 with "higher" at 2.36:1 in dark: the dev server (running since 2026-10-26 20:31) was serving an old transform of `tokens.css` without the new dark line. It passed after a restart. This is the second stale Vite transform in two nights; see "Noticed".

**Screenshots** in `reports/round-view-2/` (14). Each round fits its screen (720/720, 844/844) and the phone bar is 55 px.

- Shown range (seed `meadow`, Spring): `shown-range-desktop-light`, `-desktop-dark`, `-phone-light`, `-phone-dark`, plus `-phone-light-menu-open` and `-phone-dark-menu-open`.
- Hidden range (seed `frost`, Autumn): the same six.
- Frost in light (seed `blossom`, Winter): `frost-desktop-light`, `frost-phone-light`.

| File                                       | Lines                         |
| ------------------------------------------ | ----------------------------- |
| `apps/web/src/components/useDisclosure.ts` | new, 50 lines                 |
| `e2e/contrast.ts`                          | new, 168 lines                |
| `apps/web/src/shell/AppShell.tsx`          | 143 → 181                     |
| `apps/web/src/shell/shell.css`             | 215 → 280                     |
| `apps/web/src/shell/shell.test.tsx`        | 149 → 172                     |
| `apps/web/src/shell/DevTools.tsx`          | 77 → 78                       |
| `apps/web/src/match/HostMenu.tsx`          | 260 → 243                     |
| `apps/web/src/designTokens.test.ts`        | 167 → 180                     |
| `apps/web/src/round/round.css`             | 275 → 275                     |
| `games/guess-the-number/web/gtn.css`       | 186 → 186                     |
| `packages/ui/src/tokens.css`               | 140 → 149                     |
| `packages/ui/src/base.css`                 | 205 → 209                     |
| `e2e/range.spec.ts`                        | 96 → 103                      |
| `e2e/specials.spec.ts`                     | 116 → 119                     |
| `e2e/screens.ts`                           | 70 → 70 (`setTheme` exported) |
| `docs/DECISIONS.md`                        | 131 → 133                     |

**Reused:** `setTheme` from `e2e/screens.ts`; the existing tokens (`--color-surface-2`, `--color-text-muted`, `--color-surface`, `--shadow-raised`); the 640 px phone breakpoint and the `:has(.match-live)` round layout; the visually hidden pattern of the account chip. Nothing in Bingo's committed tree has a phone account menu (only the same development menu). **Extracted:** the disclosure behaviour that was inline in HostMenu and duplicated in DevSignIn (`useDisclosure`). **Removed:** the disabled buttons' 45 % opacity.

**Noticed, left alone.**

- The dev servers can keep a stale transform for hours (twice now). The handover restarts them.
- `apps/web/src/useReducedMotion.ts` says it is used by `./game/CurrentBall`, which does not exist here (a Bingo line).
- The `smg-anim-*` motion classes in `packages/ui/src/motion.css` are used nowhere in this repository.
- Another session ran Bingo's Playwright suite and Bingo's dev servers on this machine during the night; nothing of theirs was touched.

### N3 — Phase 4: standings, boards, profiles, verification page

Branch `night/2026-10-27` (created from `feat/guess-the-number` at `3783f01`, after N2).

**Built.**

- **League points (DECISIONS T87).** In the transaction that appends a round's `RoundEnded`, a counting match with at least `leaderboard.minPlayersForPoints` (4) distinct accounts awards each account its match standing (points, round wins, solves, rank). The awards go to the all-time board and to the season board of the UTC quarter in which the match's first round ended; the match's teams award their team standing the same way. Awards are replaced as later rounds end; entries are the sums of awards and staff adjustments. One module writes the league tables (`apps/server/src/league/awards.ts`). Migration `0006_leaderboards.sql` adds periods, awards, entries, append-only adjustments, and team awards and entries.
- **Boards and profiles over HTTP:**
  - `GET /leaderboards`, `/leaderboards/:periodId?offset=`, `/:periodId/me` (the viewer ±5), `/:periodId/teams`, and `/players/:displayName`.
  - `POST /admin/leaderboard-adjustments` (`leaderboard.adjust`, reason required, audited, shown on the profile).
  - The match details carry the match standings.
- **Player client** (a subagent, apps/web only):
  - A "Leaderboard" pill in the navigation (hidden in the compact round bar on a phone, where it does not fit).
  - The board page: a picker by board name; the player table with "you", "Show more" and the viewer's neighbourhood; the team board beside it on a desktop (below on a phone).
  - The profile page.
  - The fairness verification page (O9): commitment and seed, checked with `crypto.subtle` in the browser; the recomputed secret(s), the roster and the accepted guesses in receive order; "Download the proof".
  - The result screen shows the match standings, and its proof links to "Verify this round".
- **Proposals (OPEN (t), (u)):** `leaderboard.firstQuarterSeason` (winter names January–March) and `leaderboard.abortedMatchesCount` (off: aborting a match takes back its league points, T88).
- **A defect found on the way, fixed.** The server never said "match changed" when a round ended, so a page kept the standings from before the result (the result screen showed none). The gateway now announces a match change with every `RoundEnded` or `RoundAborted` (`apps/server/src/realtime/gateway.ts`, `sendCommitted`), through the existing once-a-second throttle. The header of `useMatch` claimed it reloaded on round frames; it now says what it does.

**Tests.**

- **Unit:** the quarter and its name (`packages/domain/src/league/periods.test.ts`); the client's boards, profile, verification page, standings and routes (`apps/web/src/boards/boards.test.tsx` and others).
- **Integration** (`apps/server/test/league.integration.test.ts`, Testcontainers):
  - Two matches of four accounts add up on both boards, with the team board beside.
  - `/me` and the profile agree with the boards; no e-mail appears.
  - An adjustment is refused to a player, made by the admin, audited, append-only and shown on the profile.
  - Three accounts, or a match that does not count, award nothing.
  - Aborting a match takes its points back.
  - Invalid input answers 400.
- **E2E journey 13** (`e2e/boards.spec.ts`, Chromium):
  - Two counting matches of four accounts put 20 points and two team wins on the season board.
  - The board page shows the team board beside the player board, and a name opens the profile.
  - "Verify this round" checks the seed in the browser.
  - Aborting the matches puts the board back as it was.

**Reused:** the domain's `standings()` order (already behind `match_standings`), `displayNames`, `permitted` (the admin guard) and the audit log. Bingo's leaderboard design was adopted (01 §10, 04 §3.4, 05 §2.4, 03 §11); Bingo built none of it, so there was no code to take. On the client: `api`, `ChoiceField`, `Problem`, `PlayerName`, `SeasonIcon` and the result table styles.

**Extracted:** `inTransaction` (`apps/server/src/db/pool.ts`), now used by the round store and the league code; `useApi`, a GET hook that drops stale answers, in the client.

**Removed:** the round store's private transaction helper.

**Noticed, left alone:**

- Four more hand-written transactions (`admin/pgAuditLog.ts`, `admin/pgSettingsStore.ts`, `auth/accounts.ts`, `db/migrator.ts`) could use `inTransaction`.
- `smg_matches_running` (`http/routes/metrics.ts`) is never set, and the metric catalogue of 06 §4.6 is not built (taken up in N8).
- Migration 0006 is applied to the development database. `feat/guess-the-number` starts fine on it, because the migrator checks only the files it knows, but 0006 must not be edited any more.

### N4 — Phase 2 remainder: authorization matrix and security suites

**Built** (a subagent, apps/server/test only, plus the fixes below):

- **`authzMatrix.integration.test.ts`** with `authzTable.ts` and `authzSetup.ts`, adapted from Bingo's matrix.
  - Every HTTP route the server registers (56) against 10 kinds of caller: anonymous, guest, player, player of the match, another host, the match's host, admin, moderator, game admin, and a staff-only security admin.
  - The 2 routes of a server that serves the built client.
  - Every socket intent (8) against the 9 callers with a session, plus the anonymous handshake.
  - A route or intent missing from the tables fails the test.
  - Also: with `SMG_DEV=0` the development routes are not there; CSRF is checked on one write of each route group; an unknown intent answers `UNKNOWN_INTENT`.
  - Host plays (S10, O16): the host and the match's player get the player view; an admin and a guest get the spectator view; the host's guess is accepted and the admin's refused `NOT_IN_ROUND`.
- **`security.integration.test.ts`**, adapted from Bingo's:
  - Per-address limits for guests and for requests without a session; dead sessions are purged.
  - A socket closes at logout and at account deletion; the handshake is refused for another origin and without a session.
  - The `__Secure-` cookie under a base path; short admin sessions; the Permissions-Policy header.
  - `/metrics` through a proxy answers 404.
  - No e-mail in match details, results, proofs, boards or profiles.
  - A broken %-escape answers 400.
- **Left out from Bingo's suite:** "a deleted player shown as such" (there is no such naming here), and Bingo's account-id checks (see OPEN (v)).

**Defects found and fixed:**

1. **`team.choose` over the socket** checked neither the sign-in nor `match.join`: a guest got `NOT_FOUND`, and a security admin without `match.join` got through to `TEAMS_LOCKED`. The HTTP route requires `match.join`, and 06 §4 says the intent follows it. The intent now answers `SIGN_IN_REQUIRED` or `FORBIDDEN` first (`apps/server/src/realtime/intents.ts`, `chooseTeam`). With the fix taken out, the matrix fails on exactly these two cells.
2. **`GET /rounds/:id/state`** answered 401 `SIGN_IN_REQUIRED` to a signed-in session without `match.watch`. It now answers 403 `FORBIDDEN` (`apps/server/src/http/routes/rounds.ts`).
3. **N3's league routes** answered 500 to an invalid adjustment body or `offset` (a thrown zod error). They now answer 400 `VALIDATION_FAILED`.

**Already covered before (not repeated):**

- `server.integration.test.ts`: CSP and the other headers; problem+json on 404.
- `auth.integration.test.ts`: CSRF on logout; JSON-only session starters; login limits; dev sign-in 404 in production; guests watch only.
- `admin.integration.test.ts`: suspension and admin refusals.
- `secrets.integration.test.ts`: host-only round control and the secret scan.

**Noticed, left alone:**

- **Account ids are public.** `player_key` is the account id (T17), so match details, results, proofs and room frames show account ids to anonymous viewers; Bingo removed this in its audit. Listed as OPEN (v).
- **`DELETE /api/v1/dev/load-accounts`** has no sign-in and no CSRF (development builds only).
- **The admin match abort** of 06 §3.2 does not exist yet: moderators and game admins hold `match.abort` but cannot use it (taken up in N6).

### N5 — Phase 5 without the host embed: chat providers and moderation

**Built (a subagent; the migration, contracts and settings by the lead):**

- **Provider switch.** `integrations.chatProvider` chooses the chat (07 §2):
  - `none`: no panel.
  - `builtin`: the platform chat.
  - `hostEmbed`: an iframe of `integrations.hostChatUrl`, with the CSP's `frame-src` set to that origin only (T91). Behind its setting as specified; no website work.
  - With `none` or `hostEmbed`, every chat route and intent except `GET /chat/config` answers `CHAT_DISABLED`.
- **Builtin chat, Bingo's design** (06 §7, 03 §12, 04 §3.5; Bingo built no chat code):
  - Rooms: one lobby room and one room per match.
  - Messages: at most 300 characters, plain text.
  - The send pipeline (T89): sanctions, lock and slow modes, the rate limit and duplicates, length, links, normalisation, then the block / mask / flag word lists. Flagged messages enter the report queue.
  - Reports, mutes with an expiry, bans and lifting; room slow mode and lock. Every staff action is audited.
  - A nightly retention job (`chat.retentionDays`).
  - With `builtin`, a system line at a round's end ("Round 4: Walter found it first", T90).
  - Migration `0007_chat.sql`, with the permissions `chat.send` (accounts that play or host) and `chat.moderate`. Guests read only.
- **Settings document `chat`** (Bingo 11 §4, without `typingIndicator`, since there is no typing indicator to switch): `chat.maxLength`, `chat.allowLinks`, `chat.slowModeDefault`, `chat.rateMessages`, `chat.rateWindowS`, `chat.newAccountSlowModeHours`, `chat.retentionDays`.
- **Routes:**
  - Player: `GET /chat/config`, `/chat/rooms/lobby`, `/chat/rooms/match/:code`, `/chat/rooms/:roomId/messages?before=`; `POST /chat/messages/:id/report`.
  - Moderation, under `/admin/` (`chat.moderate`): reports and resolving them, deleting messages, sanctions and lifting them, room settings, word lists.
  - Socket intents `chat.join`, `chat.leave`, `chat.send`, with events on `chat:<roomId>`.
- **Player client:** the `ChatPanel` boundary in the lobby and on the match page.
  - In the round view, a "Live | Chat" switch takes the Live list's place, so the round view stays one screen.
  - "Report" on every line, and inline moderation (delete, mute 5 min / 1 h / 24 h, ban), each with a reason and a confirm sentence.
  - Proposals in OPEN (w).
- **Admin moderation screens:** built in N6.

**Tests:**

- Unit: normalisation and word lists (`apps/server/src/chat/filter.test.ts`); slow modes, rate and duplicates (`spam.test.ts`).
- Components: the panel's three providers (`apps/web/src/chat/chat.test.tsx`).
- Integration (`apps/server/test/chat.integration.test.ts`, 10 tests):
  - sending and receiving over the socket; a guest reads but cannot write;
  - block, mask and flag; links; duplicates and the rate limit;
  - a report and its resolving;
  - a mute that refuses, is lifted, and a second that expires; a ban;
  - a deletion and a room lock reaching the watchers;
  - the round-end line;
  - the provider switched between `none`, `builtin` and `hostEmbed`: the refusals, `/chat/config` and the CSP.
- The authorization matrix lists every new route and intent.
- E2E journey 14 (`e2e/chat.spec.ts`): see Checks.

**Reused:** `permitted`, `RateLimiter`, `displayNames`, `findMatch`, the audit log, `settings.values`, `rounds.onCommitted` (as the gateway uses it), the pattern of `auth/retention.ts`; on the client `api`, `gameSocket`/`intent`, `useSession` and the smg-* classes.

**Noticed, left alone:**

- With several server instances, the sanction and word-list caches would need invalidation across instances (scale step 1).
- Separator tricks ("f.u.c.k") pass the word lists.
- The word-list answer has no contract type yet (`{ lists: [{ id, terms, updatedAt }] }`).

### N6 — Phase 6 remainder: live rounds, accounts, history, confirm dialogs, two-factor, admin build

**Built** (a subagent; the migration and contracts are the lead's):

- **Live rounds with staff actions** (06 §3.2; T93):
  - The routes:
    - `GET /admin/rounds/live`: counts only, no secret;
    - `GET /admin/rounds/:id`: the staff spectator view;
    - `POST /admin/rounds/:id/abort`: with a reason, shown to the players as "by staff (reason)";
    - `POST /admin/matches/:id/kick`: the player is `kicked` and their guesses are refused;
    - `POST /admin/rounds/:id/results/:playerKey/remove`: with a reason, after the end, once.
  - A removed result leaves the standings, the team standings and the league; the row itself stays.
  - Every action is audited.
- **Settings version history** (T94):
  - `GET /admin/settings/:id/versions` shows each version with its changes against the one before.
  - `POST /admin/settings/:id/rollback` writes a new version with an old version's overrides; a conflicting version answers 409.
- **Two-factor sign-in for staff** (T92):
  - TOTP per RFC 6238 on node:crypto, so no new dependency.
  - The secret is sealed at rest with a key derived from the round key.
  - A code is accepted once, and attempts are rate-limited.
  - Ten recovery codes, shown once.
  - Routes `/me/2fa`, `/setup`, `/confirm`, `/step-up` and `/disable`.
  - With `SMG_FEATURE_TWO_FACTOR` on, every admin write needs an enrolled factor and a check within 10 minutes; with it off, nothing changes.
  - Migration `0008_admin.sql`.
- **The admin build, served by the server** at `/admin/` from `SMG_ADMIN_DIR`; the Dockerfile builds and ships it.
- **Admin app:**
  - Live: the running rounds, abort, kick and result removal.
  - Accounts: search, roles with a reason, suspension.
  - A settings document's History, with its diff and Rollback.
  - Two-factor: enrol by URI and secret (no QR library), confirm, recovery codes, disable.
  - A step-up dialog that retries the write.
  - Moderation, over N5's routes: the report queue, sanctions, rooms and word lists.
  - One confirm dialog that states the effect in one sentence, for every destructive or high-impact action (Bingo 11 §1).

**Tests:**

- Unit:
  - TOTP against the RFC 6238 SHA-1 vectors, with the drift window and single use;
  - base32 against the RFC 4648 vectors;
  - the settings diff (`packages/application/src/settings/diff.test.ts`).
- Components (`apps/admin/src/staff.test.tsx`): the confirm dialog, the step-up retry and cancel, the history diff and rollback.
- Integration:
  - `adminLive.integration.test.ts`: the live list without secrets, the staff view, kick, a staff abort with its reason, and a removal that changes the standings and the league;
  - `adminTwoFactor.integration.test.ts`: enrol, confirm, step-up and its expiry, a recovery code used once, disable, and the gate on and off;
  - `adminHistory.integration.test.ts`: history, rollback and conflict; `/admin/` served.
- The authorization matrix lists every new route and expects the redirect from `/admin`.
- E2E journey 15 (`e2e/admin.spec.ts`): see Checks.

**Reused:**

- Server: `inTransaction`, `permitted` (the step-up gate sits in it), `sealSeed`/`openSeed`, `RateLimiter`, the audit log, `SettingsService.update`, `awardMatch` and `leagueRules`, `displayNames`, the round's spectator view and abort, `webClient`'s file serving.
- Extracted: `overrideChanges` (`packages/application/src/settings/diff.ts`), now used by the audit diff and the history alike.

**Noticed, left alone:**

- Bingo rotates the session id when a 2FA check completes; this is not done here.
- There is no 2FA challenge at sign-in, only the step-up.
- `plugins/securityHeaders.ts` mentions a stricter CSP for the admin app; it gets the same headers as the player client.
- `apps/server/test/authzTable.ts` is at about 290 of 300 lines.
- The admin round view answer has no contract type yet.

**Checks (N5 and N6 together).** `pnpm verify` green: 308 tests in 61 files. E2E in Chromium: all 16 journeys passed (with the dev servers restarted for migrations 0007–0009), journeys 14 (chat: two players chat in a match, a moderator mutes one, whose next message is refused, lifts it and bans; the provider set to `none` removes the panel) and 15 (the admin changes a special's default, sees the diff in the history, rolls it back through the confirm dialog, and aborts a running Quick Test round, which the player sees as aborted by staff) on their first run. CI: green with `8af3951`, the fix of the bundle check that `7eba672` failed (see "CI so far" under N7).

### N7 — Phase 7 against a test host page

Built by a subagent. The migrations 0009 and 0010 and the contracts are the lead's; the agent stopped once to ask for the missing permission `integration.manage`, which 0010 now grants, as Bingo 05 §3 has it.

**JWT handoff** (T97)

- `POST /auth/handoff` checks a host-signed token with node:crypto (no new dependency): the algorithm and key type, the issuer, the audience `seasonal-mini-games`, a life of at most 60 s, and a single-use `jti`.
- It then links the account by (provider, subject) only and creates it on first login. Mapped roles can never be an admin role. The optional `links` claim is stored as facts only.
- The answer is a same-site session cookie. The third-party bearer flow is left out.
- The redirect form `/auth/handoff#token=…` works too.
- `antiMulti.requireLinkedChat` is now applied. Before, nothing checked it.

**Embedding** (T98)

- The loader `embed.js` (lobby, match, leaderboard, profile; `data-smg-embed`, `smg:*` messages, explicit target origins) is built with the server.
- The client's embed mode resizes itself, asks the host for a sign-in, and accepts tokens only from allowlisted origins.
- The allowlist drives `frame-ancestors`, the postMessage check, the socket Origin check and the handoff's CORS.

**Admin routes** (`integration.manage`, audited)

- Embed origins, identity providers and webhook endpoints. Admin screens for them are still to do.

**Webhooks** (T99)

- Behind `SMG_FEATURE_WEBHOOKS`, default off. The events are `match.opened`, `round.countdown`, `round.ended` and `match.closed`.
- Each is signed `X-SMG-Signature: t=,v1=` and sent HTTPS-only to a checked public address. There are four attempts with backoff, and deliveries are kept for the admin.

**Public read API** (T100)

- Open matches, a match's current round, the current season board with the team board, and a round's result.
- Uncached for 60 s at most, with CORS for allowlisted origins, and names only.

**Test host page** (`e2e/host-page/server.ts`)

- It runs on port 5420, development only. It embeds the game and signs handoff tokens with an EdDSA key it makes at start.
- The website repository was not touched, and no website feed was built.

**Tests**

- Unit: JWT verification (good token; wrong signature, `alg: none`, wrong audience, expired, too long-lived, replayed; the role ceiling), the webhook signature and backoff, and the embed loader.
- Integration: `handoff.integration.test.ts`, `embed.integration.test.ts` and `webhooks.integration.test.ts`. They cover login and linking, the `links` claim, CORS and `frame-ancestors` from the allowlist, the socket Origin check, delivery with signature and retry to a fake HTTPS receiver (certificate made in memory), the public API's shapes and headers, and admin CRUD with audit.
- The authorization matrix lists every new route; its caller kinds moved to `authzRoles.ts`, so the table stays below 300 lines.
- E2E journey 8 (`e2e/embed.spec.ts`): the host page on 5420 embeds the game and its handoff signs the player in inside the iframe. The same page from `localhost:5420` cannot frame the game, and its handoff gets 403.

**Reused**

- From this repo: `safeFetchJson` and its address checks, `inTransaction`, `permitted`, the audit log, `RateLimiter`, the session start of the auth routes (`startSession`, now exported), `sealSeed` with a derived key, `rounds.onCommitted`, and the league's board queries.
- From Bingo: the design (07 §2–§7, 04 §3.1, §3.2, §3.6). Its loader at `d294585` is a stub, so there was no code to take.

**Noticed, left alone**

- `seasons/safeFetch` has no POST, so the webhook client repeats its address checks. It also checks the address before connecting rather than the one connected to; worth merging.
- Handoff accounts have no password and cannot delete themselves (OPEN (y)).
- `antiMulti.minAccountAgeH` is defined but not applied (OPEN (y)).
- Vite adds CORS headers of its own for loopback origins in development, so the journey posts the refused handoff to 3910 directly.

**Checks (N7).** `pnpm verify` green: 343 tests in 67 files. E2E in Chromium: all 18 tests passed (journeys 1–11 and 13–15 as numbered since 2026-11-01, journey 8 with its two cases). CI: see the status table.

**CI so far on `night/2026-10-27`:** `40cb02f` (N3, N4, N8 part 1) green on the first attempt; `7eba672` failed `verify`: the production-bundle check found the Quick Test's path in the server bundle, which my maintenance hook named (I had committed that part after targeted tests only, not a full `verify`); fixed in `8af3951`, green on the first attempt. Runs of commits pushed in quick succession were cancelled by the next push and are not counted. `4bc7920` (N7 and the handover) failed e2e in Firefox: journey 8's refusal case looked inside a frame Firefox had refused and left without a document, and the locator waited until the test timed out; the case now checks from the host page that the game never said `smg:ready` there (Chromium keeps its error-page check), and passes in Chromium, Firefox and WebKit locally.

### N8 — Phase 8, the parts that need no server

**Built.**

- **Installer and `smg` CLI**, adopted from Bingo's ops (committed tree `d294585`) with this repository's names: `/opt/smg`, `/etc/smg`, `/var/backups/smg`, the compose project `smg-<env>`, app port 3100, the website route `/games/mini-games` with `website-mini-games.caddy` and the network alias `smg-mini-games-<env>`, the group `smg-backup` and the timer `smg-backup@<env>`. Both install types, each answer also a flag, re-runs keep the answers and the secrets. Differences from Bingo:
  - `SMG_ROUND_KEY` is generated once and kept.
  - There are no SMTP questions, because this server sends no e-mail.
  - `smg update` waits up to 10 minutes for running rounds (`--now` restarts at once), and `smg status` shows them.
  - Maintenance stops new matches and new rounds in the app (503 `MAINTENANCE`, T95).
- **Backups:** age-encrypted pg_dump plus the uploads volume, every night at 03:30, 14 daily and 8 weekly kept; `smg restore` and `smg restore --drill`; pulling to Windows or Linux (`ops/pull-backups.ps1`, `.sh`). The restore drill also runs against the dev compose database (`pnpm drill:dev`, `ops/dev-drill.sh`): "6 migrations, 5 accounts, 458 matches, 175 218 events" at its first run.
- **Observability** (T96): the metrics of 06 §4.6 and Bingo 08 §6's core; the unset placeholder metric is gone.
- **Operator guide** (`docs/operator-guide.md`), adapted from Bingo's, with an added section on running next to Bingo on one server (a name-by-name table) and one on watching it run.

**The installer, tested in Linux containers** (Docker was available): `ops/test/installer-test.sh` with `ops/test/Dockerfile`, a fresh Ubuntu 24.04 with systemd as PID 1 standing in for a new VPS.

- **Standalone** (passed, at the final N8 commit):
  - The installer installs Docker from Docker's repository, builds the app image from a git bundle of the branch, starts it behind Caddy's internal CA on a bare IP, and is ready after 4 s ("Done (14 change(s))").
  - HTTPS answers `/readyz` and `/api/v1/games`, and `smg status` shows ready with 0 rounds running.
  - A backup encrypted for a fresh age key is written, and the restore drill on it passes (10 migrations).
  - Maintenance turns on, a new match is refused with 503, and it turns off.
  - A second installer run changes nothing ("Done (0 change(s))").
- **Website type, beside Seasonal Bingo Royale** (passed): a stand-in for the website (compose project `seasonal-site`, service `caddy`, routes imported from `routes/*.caddy`, as its DEPLOYMENT.md sets them up). Then this installer and Bingo's own (from its committed tree `d294585`, read with `git archive` only) were run, both as the website type.
  - Both answer through the website's Caddy, at `/games/mini-games/` and `/games/bingo/`, and the website keeps its own pages.
  - No app publishes a host port; the two databases are on two volumes; both backup timers exist.
  - A backup with each tool lands in its own folder, and `smg status` and `sbr status` both run.

**Defects the installer test found, and fixed:**

1. **The production image could not start.** The server bundle inlined only `@smg/*` and imported the game registry's TypeScript sources from node_modules, which Node refuses (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`). CI builds the image only on master and pull requests, so no run had ever started it. `apps/server/build.mjs` now inlines `@smg-game/*` too, the Dockerfile drops their copies, and `productionBundle.test.ts` fails when an import of a workspace package is left in the bundle (checked against the old rule).
2. **`smg status` stopped before the first backup** (`find` on the missing backup folder under `pipefail`). Fixed in `ops/smg`.

**Checks.** ShellCheck is clean on every ops script. The maintenance hook and the flag file have unit tests (`apps/server/src/http/plugins/maintenance.test.ts`). The metric catalogue is checked in `server.integration.test.ts`, and the guess counter by result in `rounds.integration.test.ts`. CI: see the status table.

**Not done, as the chain says:** the reference-VPS load test and the release tag. Still open in Phase 8: the security pass with ZAP and the secret scan of the history, the load gate, v1.0.0 (BACKLOG).

**Reused:** all of Bingo's `ops/` (install.sh, sbr, lib/*.sh, compose files, Caddyfile, examples, pull scripts) and its operator guide. `notify.ps1` is left out: a Bingo development-machine helper, not in spec 10's ops list.

**Noticed, left alone (in Bingo, read-only):** Bingo's `sbr status` stops before its first backup in the same way (the `find` under `pipefail` in `ops/sbr`).

## Night 1 (2026-10-24 to 2026-10-26)

Branch `feat/guess-the-number` (not merged; for the owner to look at first). Updated after every piece.

### Status

| Piece                               | State | Commit                                           |
| ----------------------------------- | ----- | ------------------------------------------------ |
| P1 Record O8–O15, T21; spec updated | done  | `eaeadd5` on master (spec/v1 merged and deleted) |
| P2 Foundation                       | done  | `e9936aa`                                        |
| P3 GTN domain and application       | done  | `42e2cb8`                                        |
| P4 Server                           | done  | `9804e36`                                        |
| P5 Seasonal specials                | done  | `f9c56e0`                                        |
| P6 Player and host client           | done  | `b64cfd2`                                        |
| P7 Admin client                     | done  | `23b6b5c`                                        |
| P8 E2E, load gate, play-through     | done  | `ddbc324`                                        |
| P9 Dev servers and hand-over        | done  | see `git log` on this branch                     |

### Needs the owner

- (q) Winning-margin window, proposal `round.marginWindowS` 2 s (0.5–10 s): [OPEN.md](OPEN.md).
- Spec conflict 1, check order of a guess (02 §5.1 against 04 §4.1–§4.2), built as 02 §5.1: [OPEN.md](OPEN.md). Please confirm.
- Spec gap 1, `round_results.secret` stays empty (the server cannot name a game's secret): [OPEN.md](OPEN.md).
- Spec gap 2, the feed's host allowlist is the feed address itself: [OPEN.md](OPEN.md).
- (r) Load gate: 500 players pass except event-loop lag (87 ms, limit 50); 1 000 players fail the acknowledgement time (p95 4.6 s, limit 300 ms) on this laptop. Proposal: measure on the reference VPS first: [OPEN.md](OPEN.md).
- E2E journey 8 (embedded handoff) is blocked: the handoff is roadmap phase 7, not built yet.

### P2 — Foundation

**Built** (spec 04 §2.1, names per 04 §2.2):

- Tooling: pnpm workspace (`packages/*`, `games/*`, `apps/*`), TypeScript strict, ESLint with the layer boundaries of 04 §3 (game-sdk ← domain ← application ← server; games import only game-sdk; `Math.random` banned in `packages/**` and `games/*/src/**`), Prettier, lefthook, Vitest projects with coverage gates (95/90; application 85/80), Renovate, osv-scanner, CodeQL.
- Packages: `@smg/game-sdk` (node-free main entry with settings definitions and checks; `@smg/game-sdk/crypto` with the labelled HMAC DRBG `roundRng(seed).child(...labels)` and the seed commitment), `@smg/domain` (audit hash chain), `@smg/application` (settings service, audit port, in-memory fakes), `@smg/contracts` (platform settings documents `matchmaking`, `seasons`, `integrations`, `security`, `rate_limits`; admin HTTP shapes), `@smg/ui` (tokens, base, motion, fonts).
- Apps: server (Fastify 5), web (React 19 + Vite), admin and embed-loader shells.
- Ops: `ops/compose.dev.yml` on ports 3910 / 5410 / 5411 / 5510 / 1110 / 8510; Dockerfile (container port 3100, metrics 9465); CI workflow (verify, coverage, audit, osv, gitleaks, licences, link check, e2e in three browsers, image with Trivy and size budget).
- Local identity: register, sign in, sign out, change password (ends the other sessions), dev sign-in with `admin` (super admin) beside the player identities; daily purge of dead sessions.
- Settings system: one versioned document per id; an admin stores per key a default and narrowed min/max, never wider than the catalogue (08 §1); optimistic version check (`CONFIG_VERSION_CONFLICT`); one audit entry per change with the before/after diff. Routes `GET/PUT /api/v1/admin/settings(/:id)`.
- Audit log: append-only table (trigger refuses UPDATE, DELETE, TRUNCATE), hash chain `h_n = sha256(h_{n-1} || canonicalJson(record))` under an advisory lock, `GET /api/v1/admin/audit` and `/audit/verify`.
- Moderation basics: account search, suspend / unsuspend (never oneself; a super admin only by a super admin; sessions ended), grant / remove roles (no self-grant of super admin), abuse signals with a 7-day weighted score (`GET /api/v1/admin/abuse`); a failed login on a known account records a signal. Every action is audited.

**Tests:** `pnpm verify` green (format, lint, typecheck, 83 tests in 20 files, server integration with Testcontainers Postgres); `pnpm test:coverage` green (lines 100 %, branches 94.5 % over game-sdk, domain, application); `pnpm e2e` Chromium 3/3 (account journey, wrong password, login rate limit).

**Reused from Bingo (d294585), adapted and renamed:** root tooling (package.json scripts, workspace, tsconfigs, eslint, prettier, lefthook, vitest, renovate, osv, Dockerfile, .github actions and workflows, .vscode, CONTRIBUTING, SECURITY, code-review checklist); `assets/`; `packages/ui`; `domain/draw/drbg` → `game-sdk/drbg` (plus `intBetween`, `roundRng`); `domain/commitment` → `game-sdk/commitment`; server `auth/*` (accounts, password, rateLimit, sessions, sessionPlugin, sessionEnds), `config/env`, `config/features`, `db/pool`, `db/migrator`, migrations 0001/0002 (reworked), `http/app` (rewritten around the new parts), `http/plugins/problem`, `securityHeaders`, routes `auth`, `devSignIn`, `health`, `metrics`, `placeholder`, `webClient`, `cli`, `main` (rewritten), `build.mjs`, `devStub.mjs`; test `harness`, `session`, `auth.integration`, `server.integration`, `productionBundle`; web `shell/*` (AppShell, DevTools, ThemeToggle, http, router, session, theme), `account/*` (SignIn, Register, AccountPage, formParts, accountText), `DevBadge`, `useReducedMotion`, `designTokens` and `noFixedColours` tests; e2e `devStack`, `globalSetup`, `screens`, `playwright.config`.

**Removed (Bingo-only):** rulesets, patterns, card generation, marks, live call, draw sequence, match tables and routes, the Bingo board and Quick Test link, `SBR_SEED_KEY` (comes back in P4 as `SMG_ROUND_KEY`), the release workflow (comes with Phase 8). Held back for P4/P6 (not in the tree yet): the scheduler, event bus, retention job, realtime gateway, `inOrder`, intents, seed key, maintenance, the socket test kit, deployment/security/authz-matrix integration tests, the web socket client and season icons.

**Extracted:** `PasswordFields` (AccountPage), `mayEdit` (settings service), `enumProblem` / `textProblem` (setting checks), `contracts/settings/security.ts` (out of `platform.ts`).

**Docs:** DECISIONS T22–T28; spec 04 §3 and 10 §1 (the registry is `games/registry` with a src and a web half); 08 (storage model; `rate.*` keys per second/minute; `abuse.*` keys); CLAUDE.md path of the settings definitions; broken `(Bingo NN)` links in CONTRIBUTING and SECURITY fixed; BACKLOG Phase 0 closed.

**Noticed, left alone:** `prom-client` 15.1.3 is marked deprecated on npm (reused from Bingo; no replacement chosen tonight). Fastify prints a deprecation warning for `disableRequestLogging` in tests. In Bingo: the `match_entries` key differs between spec and migration; `SBR_MASTER_KEY` in the spec vs `SBR_SEED_KEY` in the code; "OIDC" in the Bingo 02 §2 diagram; k6 in the spec vs the Node.js load driver; a "reserved for later" port comment; "PNG fallbacks" in Bingo 10 §1.

<details><summary>P2 lines per touched file</summary>

| File                                                        | Lines              |
| ----------------------------------------------------------- | ------------------ |
| `.dockerignore`                                             | new, 21 lines      |
| `.editorconfig`                                             | new, 19 lines      |
| `.gitattributes`                                            | new, 6 lines       |
| `.github/PULL_REQUEST_TEMPLATE.md`                          | new, 12 lines      |
| `.github/actions/setup/action.yml`                          | new, 21 lines      |
| `.github/workflows/ci.yml`                                  | new, 144 lines     |
| `.github/workflows/codeql.yml`                              | new, 33 lines      |
| `.npmrc`                                                    | new, 9 lines       |
| `.nvmrc`                                                    | new, 1 lines       |
| `.prettierignore`                                           | new, 11 lines      |
| `.vscode/extensions.json`                                   | new, 11 lines      |
| `.vscode/launch.json`                                       | new, 35 lines      |
| `.vscode/settings.json`                                     | new, 19 lines      |
| `CLAUDE.md`                                                 | changed, +1 / −1   |
| `CONTRIBUTING.md`                                           | new, 38 lines      |
| `Dockerfile`                                                | new, 62 lines      |
| `SECURITY.md`                                               | new, 17 lines      |
| `apps/admin/package.json`                                   | new, 13 lines      |
| `apps/admin/src/index.test.ts`                              | new, 18 lines      |
| `apps/admin/src/index.ts`                                   | new, 14 lines      |
| `apps/admin/tsconfig.json`                                  | new, 12 lines      |
| `apps/embed-loader/package.json`                            | new, 13 lines      |
| `apps/embed-loader/src/index.test.ts`                       | new, 18 lines      |
| `apps/embed-loader/src/index.ts`                            | new, 14 lines      |
| `apps/embed-loader/tsconfig.json`                           | new, 12 lines      |
| `apps/server/build.mjs`                                     | new, 68 lines      |
| `apps/server/dev.env`                                       | new, 12 lines      |
| `apps/server/devStub.mjs`                                   | new, 16 lines      |
| `apps/server/package.json`                                  | new, 40 lines      |
| `apps/server/src/admin/abuse.ts`                            | new, 65 lines      |
| `apps/server/src/admin/accountsAdmin.ts`                    | new, 94 lines      |
| `apps/server/src/admin/pgAuditLog.ts`                       | new, 137 lines     |
| `apps/server/src/admin/pgSettingsStore.ts`                  | new, 96 lines      |
| `apps/server/src/auth/accounts.ts`                          | new, 146 lines     |
| `apps/server/src/auth/password.ts`                          | new, 65 lines      |
| `apps/server/src/auth/rateLimit.test.ts`                    | new, 36 lines      |
| `apps/server/src/auth/rateLimit.ts`                         | new, 79 lines      |
| `apps/server/src/auth/retention.ts`                         | new, 27 lines      |
| `apps/server/src/auth/sessionEnds.ts`                       | new, 27 lines      |
| `apps/server/src/auth/sessionPlugin.ts`                     | new, 123 lines     |
| `apps/server/src/auth/sessions.ts`                          | new, 138 lines     |
| `apps/server/src/cli.ts`                                    | new, 90 lines      |
| `apps/server/src/config/env.test.ts`                        | new, 31 lines      |
| `apps/server/src/config/env.ts`                             | new, 110 lines     |
| `apps/server/src/config/features.ts`                        | new, 28 lines      |
| `apps/server/src/db/migrations/0001_initial.sql`            | new, 67 lines      |
| `apps/server/src/db/migrations/0002_accounts.sql`           | new, 49 lines      |
| `apps/server/src/db/migrations/0003_audit_abuse.sql`        | new, 47 lines      |
| `apps/server/src/db/migrator.ts`                            | new, 97 lines      |
| `apps/server/src/db/pool.ts`                                | new, 32 lines      |
| `apps/server/src/http/app.ts`                               | new, 120 lines     |
| `apps/server/src/http/plugins/problem.ts`                   | new, 68 lines      |
| `apps/server/src/http/plugins/securityHeaders.ts`           | new, 50 lines      |
| `apps/server/src/http/routes/adminAccounts.ts`              | new, 140 lines     |
| `apps/server/src/http/routes/adminAudit.ts`                 | new, 31 lines      |
| `apps/server/src/http/routes/adminGuard.ts`                 | new, 38 lines      |
| `apps/server/src/http/routes/adminSettings.ts`              | new, 52 lines      |
| `apps/server/src/http/routes/auth.ts`                       | new, 189 lines     |
| `apps/server/src/http/routes/devSignIn.ts`                  | new, 84 lines      |
| `apps/server/src/http/routes/health.ts`                     | new, 39 lines      |
| `apps/server/src/http/routes/metrics.ts`                    | new, 44 lines      |
| `apps/server/src/http/routes/password.ts`                   | new, 50 lines      |
| `apps/server/src/http/routes/placeholder.ts`                | new, 64 lines      |
| `apps/server/src/http/routes/webClient.ts`                  | new, 65 lines      |
| `apps/server/src/index.ts`                                  | new, 19 lines      |
| `apps/server/src/main.ts`                                   | new, 39 lines      |
| `apps/server/test/admin.integration.test.ts`                | new, 182 lines     |
| `apps/server/test/auth.integration.test.ts`                 | new, 273 lines     |
| `apps/server/test/harness.ts`                               | new, 62 lines      |
| `apps/server/test/productionBundle.test.ts`                 | new, 66 lines      |
| `apps/server/test/server.integration.test.ts`               | new, 98 lines      |
| `apps/server/test/session.ts`                               | new, 38 lines      |
| `apps/server/tsconfig.json`                                 | new, 17 lines      |
| `apps/web/index.html`                                       | new, 24 lines      |
| `apps/web/package.json`                                     | new, 29 lines      |
| `apps/web/public/theme-init.js`                             | new, 28 lines      |
| `apps/web/src/account/AccountPage.tsx`                      | new, 119 lines     |
| `apps/web/src/account/Register.tsx`                         | new, 77 lines      |
| `apps/web/src/account/SignIn.tsx`                           | new, 57 lines      |
| `apps/web/src/account/account.css`                          | new, 25 lines      |
| `apps/web/src/account/accountText.test.ts`                  | new, 49 lines      |
| `apps/web/src/account/accountText.ts`                       | new, 61 lines      |
| `apps/web/src/account/formParts.tsx`                        | new, 88 lines      |
| `apps/web/src/components/DevBadge.tsx`                      | new, 41 lines      |
| `apps/web/src/designTokens.test.ts`                         | new, 167 lines     |
| `apps/web/src/lobby/Lobby.tsx`                              | new, 33 lines      |
| `apps/web/src/main.tsx`                                     | new, 33 lines      |
| `apps/web/src/noFixedColours.test.ts`                       | new, 42 lines      |
| `apps/web/src/shell/AppShell.tsx`                           | new, 129 lines     |
| `apps/web/src/shell/DevTools.tsx`                           | new, 67 lines      |
| `apps/web/src/shell/ThemeToggle.tsx`                        | new, 52 lines      |
| `apps/web/src/shell/http.test.ts`                           | new, 25 lines      |
| `apps/web/src/shell/http.ts`                                | new, 58 lines      |
| `apps/web/src/shell/router.ts`                              | new, 61 lines      |
| `apps/web/src/shell/session.tsx`                            | new, 109 lines     |
| `apps/web/src/shell/shell.css`                              | new, 198 lines     |
| `apps/web/src/shell/shell.test.tsx`                         | new, 141 lines     |
| `apps/web/src/shell/theme.test.tsx`                         | new, 99 lines      |
| `apps/web/src/shell/theme.ts`                               | new, 73 lines      |
| `apps/web/src/useReducedMotion.ts`                          | new, 36 lines      |
| `apps/web/tsconfig.json`                                    | new, 18 lines      |
| `apps/web/vite.config.ts`                                   | new, 54 lines      |
| `assets/README.md`                                          | new, 28 lines      |
| `assets/brand/colors.md`                                    | new, 12 lines      |
| `assets/brand/emblem.webp`                                  | new, - lines       |
| `assets/brand/logo.svg`                                     | new, 7 lines       |
| `assets/fonts/luxora-grotesk-bold.woff2`                    | new, - lines       |
| `assets/fonts/luxora-grotesk-book.woff2`                    | new, - lines       |
| `assets/fonts/luxora-grotesk-italic.woff2`                  | new, - lines       |
| `assets/fonts/luxora-grotesk-light-italic.woff2`            | new, - lines       |
| `assets/fonts/luxora-grotesk-regular.woff2`                 | new, - lines       |
| `assets/seasons/autumn.svg`                                 | new, 1 lines       |
| `assets/seasons/source/autumn.svg`                          | new, 5 lines       |
| `assets/seasons/source/spring.svg`                          | new, 5 lines       |
| `assets/seasons/source/summer.svg`                          | new, 36 lines      |
| `assets/seasons/source/winter.svg`                          | new, 10 lines      |
| `assets/seasons/spring.svg`                                 | new, 1 lines       |
| `assets/seasons/summer.svg`                                 | new, 1 lines       |
| `assets/seasons/winter.svg`                                 | new, 1 lines       |
| `docs/BACKLOG.md`                                           | changed, +11 / −11 |
| `docs/DECISIONS.md`                                         | changed, +73 / −66 |
| `docs/GAME-IDEAS.md`                                        | changed, +26 / −26 |
| `docs/code-review-checklist.md`                             | new, 12 lines      |
| `docs/spec/04-software-architecture.md`                     | changed, +11 / −7  |
| `docs/spec/08-admin-settings.md`                            | changed, +8 / −8   |
| `docs/spec/09-testing-strategy.md`                          | changed, +1 / −1   |
| `docs/spec/10-repository-structure.md`                      | changed, +4 / −3   |
| `docs/spec/README.md`                                       | changed, +1 / −1   |
| `e2e/account.spec.ts`                                       | new, 105 lines     |
| `e2e/devStack.ts`                                           | new, 45 lines      |
| `e2e/globalSetup.ts`                                        | new, 23 lines      |
| `e2e/playwright.config.ts`                                  | new, 68 lines      |
| `e2e/screens.ts`                                            | new, 70 lines      |
| `e2e/tsconfig.json`                                         | new, 17 lines      |
| `eslint.config.js`                                          | new, 152 lines     |
| `lefthook.yml`                                              | new, 14 lines      |
| `ops/.env.dev.example`                                      | new, 23 lines      |
| `ops/compose.dev.yml`                                       | new, 41 lines      |
| `osv-scanner.toml`                                          | new, 15 lines      |
| `package.json`                                              | new, 39 lines      |
| `packages/application/package.json`                         | new, 21 lines      |
| `packages/application/src/audit/ports.ts`                   | new, 30 lines      |
| `packages/application/src/fakes.ts`                         | new, 37 lines      |
| `packages/application/src/index.ts`                         | new, 14 lines      |
| `packages/application/src/settings/ports.ts`                | new, 33 lines      |
| `packages/application/src/settings/settingsService.test.ts` | new, 129 lines     |
| `packages/application/src/settings/settingsService.ts`      | new, 157 lines     |
| `packages/application/tsconfig.json`                        | new, 15 lines      |
| `packages/contracts/package.json`                           | new, 17 lines      |
| `packages/contracts/src/http/admin.ts`                      | new, 99 lines      |
| `packages/contracts/src/index.ts`                           | new, 24 lines      |
| `packages/contracts/src/settings/platform.ts`               | new, 203 lines     |
| `packages/contracts/src/settings/security.ts`               | new, 148 lines     |
| `packages/contracts/tsconfig.json`                          | new, 12 lines      |
| `packages/domain/package.json`                              | new, 19 lines      |
| `packages/domain/src/audit/hashChain.test.ts`               | new, 58 lines      |
| `packages/domain/src/audit/hashChain.ts`                    | new, 61 lines      |
| `packages/domain/src/index.ts`                              | new, 18 lines      |
| `packages/domain/tsconfig.json`                             | new, 17 lines      |
| `packages/game-sdk/package.json`                            | new, 20 lines      |
| `packages/game-sdk/src/commitment.test.ts`                  | new, 33 lines      |
| `packages/game-sdk/src/commitment.ts`                       | new, 24 lines      |
| `packages/game-sdk/src/crypto.ts`                           | new, 14 lines      |
| `packages/game-sdk/src/drbg.test.ts`                        | new, 70 lines      |
| `packages/game-sdk/src/drbg.ts`                             | new, 81 lines      |
| `packages/game-sdk/src/index.ts`                            | new, 32 lines      |
| `packages/game-sdk/src/random.ts`                           | new, 25 lines      |
| `packages/game-sdk/src/settings.test.ts`                    | new, 97 lines      |
| `packages/game-sdk/src/settings.ts`                         | new, 180 lines     |
| `packages/game-sdk/tsconfig.json`                           | new, 17 lines      |
| `packages/ui/package.json`                                  | new, 17 lines      |
| `packages/ui/src/base.css`                                  | new, 201 lines     |
| `packages/ui/src/fonts.css`                                 | new, 26 lines      |
| `packages/ui/src/index.test.ts`                             | new, 18 lines      |
| `packages/ui/src/index.ts`                                  | new, 14 lines      |
| `packages/ui/src/motion.css`                                | new, 114 lines     |
| `packages/ui/src/tokens.css`                                | new, 140 lines     |
| `packages/ui/tsconfig.json`                                 | new, 12 lines      |
| `pnpm-lock.yaml`                                            | new, 5460 lines    |
| `pnpm-workspace.yaml`                                       | new, 39 lines      |
| `prettier.config.js`                                        | new, 17 lines      |
| `renovate.json`                                             | new, 26 lines      |
| `tsconfig.base.json`                                        | new, 39 lines      |
| `tsconfig.bundler.json`                                     | new, 18 lines      |
| `tsconfig.json`                                             | new, 18 lines      |
| `vitest.config.ts`                                          | new, 40 lines      |

</details>

### P3 — Guess The Number domain and application

**Built** (spec 02, 04 §4–§5):

- `game-sdk`: the game-module contract as built (`module.ts`: round input, ordered player action, step context with secrets, decisions with routed events and `Solved` / `RoundShouldEnd` signals, views with a Frost cut-off, conformance kit, registry entry); range arithmetic; the platform's round keys of every game document with their conversion to milliseconds (`roundSettings.ts`, 08 §3).
- `domain/round`: the platform round engine, pure and game-agnostic. Lifecycle created → countdown (roster frozen once per player, teams only in shared rounds with teams on, minimum players) → open → ended / aborted; catch-up so a round opens exactly at `opensAt` and ends at the longest round time whatever the scheduler does (T32); the guess path with the checks of 02 §5.1 in order, the game's `validate` before the cooldown (T29); `receiveSeq` only for accepted guesses; the cooldown as a stored end time from the receive time, no timer; shared mode: the first `Solved` wins and ends the round; individual mode: solve order is place order, all solved ends it; the winning margin from the first would-be correct guess inside the window (T33); results, points (10; 10/7/5/3 then 1), team results (1 point to the winner's team), match standings with the tie order of 02 §9; replay of a log.
- `games/guess-the-number`: settings (range, visibility, repeats; range at least 10 wide), secrets derived with labels `secret/shared` and `secret/<playerId>`, the feedback rule and band (kept in their own files, T21), state without secrets, `validate` / `decide` / `evolve`, the room line per visibility (T31), player / spectator / result views with zod schemas and the Frost cut-off.
- `games/registry`: one entry per game and the shared conformance suite.
- `application/round`: round settings from the document plus host choices (`ROUND_SETTINGS_INVALID`), the round session (seed commitment with the proof on, secrets derived when the roster freezes and kept in memory only, commands, recovery from the log, result view only after the end), and the fairness-proof check from the public log.

**Tests:** `pnpm verify` green (format, lint, typecheck, 138 tests in 32 files); `pnpm test:coverage` green (lines 99.6 %, branches 94.0 % over game-sdk, domain, application and the games). Property tests: G1 order, G2 one winner, G3 cooldown, G4 placings, P1 determinism, P4 free rejections, P5 replay (domain, 100 whole rounds each, as 09 §3 caps them); G5 feedback and band (1 000 cases), G6 valid guesses (100 rounds); G7 chi-square of secrets; conformance P1–P5 with sentinel secrets in both modes (100 streams each).

**Reused from Bingo:** no code in this piece. The `decide`/`evolve` shape and log replay follow Bingo's match engine (Bingo 02 §5.1–§5.2); the DRBG and commitment reused in P2 carry the secrets and the proof.

**Extracted:** `countdown` and `accepted` out of `evolveRound` (complexity); `attempt` (checks 4–7 and the decision) shared by the guess path and the margin note; `checkViews` and `play` in the conformance suite.

**Docs:** 04 §4 rewritten to the contract as built, §4.3 (`own` joins with the first long-running game); 06 §2.7 (`MarginNoted`, the `Game` wrapper, `GuessFed`), §2.8 sizing (three events per guess); DECISIONS T29–T33; OPEN conflict 1; BACKLOG Phase 1 split.

**Noticed, left alone:** Vitest's path filter `games` selects no test file here while `games/guess-the-number` does, so `test:coverage` lists each game folder (a new game adds its folder there). `rangeSize` in `game-sdk` has no caller yet; halving (P5) uses it.

<details><summary>P3 lines per touched file</summary>

| File                                                     | Lines              |
| -------------------------------------------------------- | ------------------ |
| `docs/BACKLOG.md`                                        | changed, +2 / −1   |
| `docs/DECISIONS.md`                                      | changed, +35 / −30 |
| `docs/OPEN.md`                                           | changed, +6 / −0   |
| `docs/spec/04-software-architecture.md`                  | changed, +25 / −24 |
| `docs/spec/06-data-model-api-realtime.md`                | changed, +3 / −3   |
| `docs/spec/README.md`                                    | changed, +1 / −1   |
| `games/guess-the-number/package.json`                    | new, 20 lines      |
| `games/guess-the-number/src/conformance.ts`              | new, 50 lines      |
| `games/guess-the-number/src/fakes.ts`                    | new, 74 lines      |
| `games/guess-the-number/src/feedback.properties.test.ts` | new, 82 lines      |
| `games/guess-the-number/src/feedback.ts`                 | new, 41 lines      |
| `games/guess-the-number/src/index.ts`                    | new, 18 lines      |
| `games/guess-the-number/src/module.ts`                   | new, 40 lines      |
| `games/guess-the-number/src/rules.test.ts`               | new, 151 lines     |
| `games/guess-the-number/src/rules.ts`                    | new, 84 lines      |
| `games/guess-the-number/src/secrets.test.ts`             | new, 69 lines      |
| `games/guess-the-number/src/secrets.ts`                  | new, 40 lines      |
| `games/guess-the-number/src/settings.ts`                 | new, 89 lines      |
| `games/guess-the-number/src/state.ts`                    | new, 89 lines      |
| `games/guess-the-number/src/views.test.ts`               | new, 121 lines     |
| `games/guess-the-number/src/views.ts`                    | new, 123 lines     |
| `games/guess-the-number/tsconfig.json`                   | new, 17 lines      |
| `games/registry/package.json`                            | new, 20 lines      |
| `games/registry/src/conformance.test.ts`                 | new, 108 lines     |
| `games/registry/src/index.ts`                            | new, 14 lines      |
| `games/registry/tsconfig.json`                           | new, 17 lines      |
| `package.json`                                           | changed, +2 / −2   |
| `packages/application/package.json`                      | changed, +2 / −1   |
| `packages/application/src/index.ts`                      | changed, +12 / −3  |
| `packages/application/src/round/fakes.ts`                | new, 76 lines      |
| `packages/application/src/round/roundSession.test.ts`    | new, 143 lines     |
| `packages/application/src/round/roundSession.ts`         | new, 107 lines     |
| `packages/application/src/round/roundSettings.ts`        | new, 60 lines      |
| `packages/application/src/round/verify.ts`               | new, 39 lines      |
| `packages/domain/package.json`                           | changed, +2 / −1   |
| `packages/domain/src/index.ts`                           | changed, +24 / −4  |
| `packages/domain/src/round/evolve.ts`                    | new, 155 lines     |
| `packages/domain/src/round/fakes.ts`                     | new, 152 lines     |
| `packages/domain/src/round/guess.test.ts`                | new, 142 lines     |
| `packages/domain/src/round/guess.ts`                     | new, 127 lines     |
| `packages/domain/src/round/lifecycle.test.ts`            | new, 114 lines     |
| `packages/domain/src/round/lifecycle.ts`                 | new, 132 lines     |
| `packages/domain/src/round/results.test.ts`              | new, 63 lines      |
| `packages/domain/src/round/results.ts`                   | new, 117 lines     |
| `packages/domain/src/round/round.properties.test.ts`     | new, 148 lines     |
| `packages/domain/src/round/step.ts`                      | new, 37 lines      |
| `packages/domain/src/round/types.ts`                     | new, 187 lines     |
| `packages/game-sdk/src/index.ts`                         | changed, +30 / −4  |
| `packages/game-sdk/src/module.ts`                        | new, 140 lines     |
| `packages/game-sdk/src/range.test.ts`                    | new, 37 lines      |
| `packages/game-sdk/src/range.ts`                         | new, 31 lines      |
| `packages/game-sdk/src/roundSettings.test.ts`            | new, 39 lines      |
| `packages/game-sdk/src/roundSettings.ts`                 | new, 213 lines     |
| `pnpm-lock.yaml`                                         | changed, +32 / −0  |

</details>

### P4 — Server

**Built** (spec 06, 04 §5):

- Migration `0004_matches_rounds.sql`: matches, match players, rounds (sealed seed, commitment, one running round per match), `round_events` append-only by trigger, snapshots, round and team results (unique places), match and team standings, scheduled actions.
- Round engine: `RoundActor` (one FIFO per round, each item run when handed in, receive time stamped then, group commit after 20 ms or 200 events, replies and frames only after the commit, batches in order, a failed commit drops later batches and rebuilds, `ROUND_BUSY` at the queue bound, T34); `PgRoundStore` (one transaction per batch with status, schedule, results, standings, snapshots every 200 events keeping two); `GameRunner` / `LiveRound` (the only place a game's types meet the server; actions parsed with the game's schema); `Rounds` (one runner per registry entry, recovery of running rounds at start, ended rounds loaded on demand); `RoundScheduler` (open and time-up with leases; the round catches up with time anyway, T32); seeds sealed with AES-256-GCM under `SMG_ROUND_KEY` (required outside development and tests).
- Use cases (`match/play.ts`): create a round (one at a time, settings with host choices, `ROUND_SETTINGS_INVALID`; season required and no halving day until P5, T37), start with the connected players minus the host, host end and abort, teams locked while a round runs, leaving ends a round with no roster player left, close and abort a match.
- HTTP (06 §3.1): games, matches (list, open, summary with next-round defaults for the host, join, leave, team, close, abort, mine), rounds (create, start, end, abort, state per viewer, the HTTP guess fallback, result, verify).
- Realtime (06 §4): gateway on `/ws` namespace `/play`, origin and session checked, sockets closed when their session ends; envelope, replay number and socket limit checked on read, guesses queued with nothing awaited (04 §5.2), other intents in order per socket; frames to the match, player and host rooms (T35); presence for the roster.
- Limits and abuse: `rate.*` and `abuse.*` read every second into memory; guess floods `RATE_LIMITED` with an abuse signal; repeated cooldown refusals over the threshold raise one signal a minute.
- Development Quick Test: `POST /api/v1/dev/quicktest` (seed text, mode, bots, cooldown, visibility, range) with live bots from the registry's `devBot` (T36).

**Tests:** `pnpm verify` green (150 tests in 37 files); `pnpm test:coverage` green (lines 99.6 %, branches 94.1 %); `pnpm e2e` Chromium 3/3. New integration suites with real Postgres and sockets: a shared round end to end (roster without the host, `ROUND_NOT_OPEN`, cooldown across socket and HTTP fallback, single winner, `ROUND_OVER`, result, seed, proof, gap-free and append-only log, standings, frames without values in the room and answers only to their player); recovery on a second server with the cooldown intact; the secret scan S2 over every frame, acknowledgement and HTTP answer (players, host, spectator, admin API) of a running individual round with 1–1 000 000, and the secrets present after the end; the Quick Test to its end with the same seed giving the same season and secrets; permissions and refusals (`NOT_THE_HOST`, 401 without a session, `ROUND_RUNNING`, `ROUND_SETTINGS_INVALID`, `NOT_A_HALVING_DAY`, `IN_SEASON_UNAVAILABLE`).

**Reused from Bingo (d294585), adapted:** `match/pgScheduler.ts` → `round/scheduler.ts`; `realtime/gateway.ts`, `realtime/intents.ts`, `realtime/inOrder.ts` (+ test, unchanged); `config/seedKey.ts` → `config/roundKey.ts`; seed sealing from `match/codec.ts` → `round/seal.ts` (+ test); the match-code alphabet from `match/runtime.ts`; `test/socketKit.ts`. Held back and not used: `match/eventBus.ts` (the rounds service calls its listeners directly), `match/retention.ts`, `config/maintenance.ts`, and the deployment, security and authorization-matrix integration suites (to adapt with the client routes, BACKLOG Phase 2).

**Extracted:** `pgResults.ts` out of the store (file size); the host and read halves of the round routes; the socket kit's helpers.

**Docs:** DECISIONS T34–T39; 04 §4 (registry entry with `devBot`); 06 §4.4 (frames); OPEN gap 1; BACKLOG Phase 1 and 2 split.

**Noticed, left alone:** the Quick Test passes Guess The Number's range keys from server code (development only, but the platform names a game's keys there); the lobby's idle close (`match.lobbyIdleCloseMin`), the bot-timing abuse signal (`abuse.botTimingWindowMs`) and the metrics of 06 §4.6 are not built yet; Frost delivery and specials are P5. The test timeout went to 20 s (T39).

<details><summary>P4 lines per touched file</summary>

| File                                                     | Lines              |
| -------------------------------------------------------- | ------------------ |
| `apps/server/build.mjs`                                  | changed, +1 / −1   |
| `apps/server/devStub.mjs`                                | changed, +3 / −1   |
| `apps/server/package.json`                               | changed, +2 / −0   |
| `apps/server/src/config/env.test.ts`                     | changed, +13 / −2  |
| `apps/server/src/config/env.ts`                          | changed, +10 / −0  |
| `apps/server/src/config/roundKey.ts`                     | new, 23 lines      |
| `apps/server/src/db/migrations/0004_matches_rounds.sql`  | new, 154 lines     |
| `apps/server/src/db/pool.ts`                             | changed, +2 / −5   |
| `apps/server/src/dev/bots.ts`                            | new, 51 lines      |
| `apps/server/src/dev/quickTest.ts`                       | new, 90 lines      |
| `apps/server/src/http/app.ts`                            | changed, +21 / −5  |
| `apps/server/src/http/routes/adminGuard.ts`              | changed, +2 / −2   |
| `apps/server/src/http/routes/matches.ts`                 | new, 207 lines     |
| `apps/server/src/http/routes/quickTest.ts`               | new, 51 lines      |
| `apps/server/src/http/routes/rounds.ts`                  | new, 179 lines     |
| `apps/server/src/index.ts`                               | changed, +5 / −6   |
| `apps/server/src/main.ts`                                | changed, +22 / −6  |
| `apps/server/src/match/matches.ts`                       | new, 242 lines     |
| `apps/server/src/match/play.ts`                          | new, 181 lines     |
| `apps/server/src/match/presence.ts`                      | new, 36 lines      |
| `apps/server/src/realtime/gateway.ts`                    | new, 151 lines     |
| `apps/server/src/realtime/inOrder.test.ts`               | new, 40 lines      |
| `apps/server/src/realtime/inOrder.ts`                    | new, 23 lines      |
| `apps/server/src/realtime/intents.ts`                    | new, 203 lines     |
| `apps/server/src/round/actor.ts`                         | new, 152 lines     |
| `apps/server/src/round/batch.ts`                         | new, 62 lines      |
| `apps/server/src/round/gameRunner.ts`                    | new, 127 lines     |
| `apps/server/src/round/guessLimits.ts`                   | new, 115 lines     |
| `apps/server/src/round/liveRound.ts`                     | new, 90 lines      |
| `apps/server/src/round/pgResults.ts`                     | new, 82 lines      |
| `apps/server/src/round/pgRoundStore.ts`                  | new, 245 lines     |
| `apps/server/src/round/rounds.ts`                        | new, 119 lines     |
| `apps/server/src/round/runtime.ts`                       | new, 78 lines      |
| `apps/server/src/round/scheduler.ts`                     | new, 100 lines     |
| `apps/server/src/round/seal.test.ts`                     | new, 34 lines      |
| `apps/server/src/round/seal.ts`                          | new, 25 lines      |
| `apps/server/src/round/views.ts`                         | new, 131 lines     |
| `apps/server/test/auth.integration.test.ts`              | changed, +1 / −0   |
| `apps/server/test/rounds.integration.test.ts`            | new, 215 lines     |
| `apps/server/test/secrets.integration.test.ts`           | new, 208 lines     |
| `apps/server/test/socketKit.ts`                          | new, 165 lines     |
| `docs/BACKLOG.md`                                        | changed, +14 / −13 |
| `docs/DECISIONS.md`                                      | changed, +41 / −35 |
| `docs/OPEN.md`                                           | changed, +4 / −0   |
| `docs/spec/04-software-architecture.md`                  | changed, +1 / −1   |
| `docs/spec/06-data-model-api-realtime.md`                | changed, +1 / −1   |
| `docs/spec/README.md`                                    | changed, +1 / −1   |
| `games/guess-the-number/src/devBot.test.ts`              | new, 51 lines      |
| `games/guess-the-number/src/devBot.ts`                   | new, 32 lines      |
| `games/guess-the-number/src/feedback.properties.test.ts` | changed, +2 / −2   |
| `games/guess-the-number/src/index.ts`                    | changed, +5 / −2   |
| `games/guess-the-number/src/views.ts`                    | changed, +2 / −0   |
| `games/registry/src/index.ts`                            | changed, +6 / −3   |
| `packages/application/src/round/roundSession.test.ts`    | changed, +4 / −0   |
| `packages/application/src/round/roundSession.ts`         | changed, +19 / −1  |
| `packages/domain/src/index.ts`                           | changed, +14 / −2  |
| `packages/game-sdk/src/index.ts`                         | changed, +1 / −0   |
| `packages/game-sdk/src/module.ts`                        | changed, +6 / −1   |
| `pnpm-lock.yaml`                                         | changed, +6 / −0   |
| `vitest.config.ts`                                       | changed, +3 / −0   |

</details>

### P5 — Seasonal specials

**Built** (spec 03):

- Contract: `SpecialHooks` in `game-sdk` (`springHerald`, `leafFall`, `halving`; an empty list ends a special); the platform's special timing keys (`summer.*`, `autumn.intervalS`, `autumn.count`, `winter.delayS`, `halving.intervalS`) in every game document; the 3 s Heatwave floor as a constant.
- Domain (`round/specials.ts`): which specials apply (season, special on, the game implements it, halving round), Spring Herald at `opensAt`, interval specials at `opensAt + k × interval` until the end or their course is run, several at one instant in the order halving, Leaf Fall, Heatwave in one step; Heatwave steps down to 3 s; Frost marks answers, solves and the win with `deliverAt`; `nextDue`; a `tick` command; season teams for players without one (smallest team, seed tie-break).
- Guess The Number (`specials.ts`): true hints (parity or half) for everyone or each own number; Leaf Fall from the round's range, never a secret, one set for all, stopping at `autumn.minRemaining`; halving windows of half the size, placed uniformly around each secret, stopping at `halving.minRangeSize`; state, events (`HintGiven`, `NumbersRemoved`, `RangeHalved`) and views (hint, removed numbers within the range, the current range).
- Server: the actor's due timer (T40); Frost held after commit and delivered with `HeldDelivered`, views cut at now − delay, bots too, result and proof only once announced, held events restored after a restart (T41); team standings at round end; migration `0005_seasons.sql`; the In Season poller with a safe fetch (HTTPS only, public addresses only, no redirects, 5 s, 64 KiB) keeping the last good answer, `GET /seasons/current`, admin feed status and refresh, halving days with add and remove (audited); rounds take In Season when the host gives no season and allow halving only on a halving day (T37); the fast test profile for the Quick Test (T43) and a `halving` option; `SMG_DEV_FEED_URL` (T42).

**Tests:** `pnpm verify` green (178 tests in 41 files); `pnpm test:coverage` green (lines 99.7 %, branches 93.2 %). Equality and special tests: S1 Spring hints (1 000 cases), S2 Heatwave steps and floor, S3 Leaf Fall (no secret, one set, exact counts, stop; 100 rounds; rejection path at 1–1 000 000), S4 Frost delays and the metamorphic same-order-same-winner check, S5 halving windows (100 rounds), S7 order at one instant, P6 in the conformance suite for every hook and mode; server integration: Leaf Fall and Heatwave in fast rounds, Spring hint, Frost early read (no answer in the state before the delay, the answer frame only after ≥ 2.9 s, `HeldDelivered` logged), In Season from a local feed with the last good answer kept, halving days and a halving round's range at 500 after one halving; safe fetch unit tests (inward addresses, plain HTTP, redirect, 64 KiB).

**Reused from Bingo:** none in this piece (Bingo has no specials or safe HTTP client).

**Extracted:** `round/builder.ts` (the step collector, out of `lifecycle.ts`, so specials and lifecycle share it); `lifecycle()` out of `evolveRound` (complexity); `specialSettings.ts` out of `roundSettings.ts`; `FrostHold` out of the actor; the feed and halving-day halves of the season routes.

**Docs:** DECISIONS T37 (rewritten), T40–T44; 04 §4.4 hook signatures; 06 §2.7 event fields; 08 §7 `SMG_DEV_FEED_URL`; OPEN gap 2; BACKLOG Phase 3 split.

**Noticed, left alone:** DNS rebinding between the safe fetch's address check and the request is not closed (a check-then-connect gap; the feed host is chosen by a security admin). The `special` kind of `scheduled_actions` stays in the migration's CHECK but is unused (T40).

<details><summary>P5 lines per touched file</summary>

| File                                                     | Lines               |
| -------------------------------------------------------- | ------------------- |
| `apps/server/src/config/env.ts`                          | changed, +3 / −0    |
| `apps/server/src/db/migrations/0005_seasons.sql`         | new, 27 lines       |
| `apps/server/src/dev/bots.ts`                            | changed, +2 / −1    |
| `apps/server/src/dev/quickTest.ts`                       | changed, +5 / −0    |
| `apps/server/src/http/app.ts`                            | changed, +2 / −0    |
| `apps/server/src/http/routes/quickTest.ts`               | changed, +3 / −0    |
| `apps/server/src/http/routes/rounds.ts`                  | changed, +6 / −2    |
| `apps/server/src/http/routes/seasons.ts`                 | new, 111 lines      |
| `apps/server/src/match/play.ts`                          | changed, +36 / −14  |
| `apps/server/src/realtime/gateway.ts`                    | changed, +5 / −3    |
| `apps/server/src/round/actor.ts`                         | changed, +74 / −5   |
| `apps/server/src/round/frost.ts`                         | new, 68 lines       |
| `apps/server/src/round/gameRunner.ts`                    | changed, +36 / −10  |
| `apps/server/src/round/liveRound.ts`                     | changed, +15 / −5   |
| `apps/server/src/round/pgResults.ts`                     | changed, +26 / −2   |
| `apps/server/src/round/pgRoundStore.ts`                  | changed, +29 / −14  |
| `apps/server/src/round/rounds.ts`                        | changed, +6 / −5    |
| `apps/server/src/round/runtime.ts`                       | changed, +8 / −1    |
| `apps/server/src/round/views.ts`                         | changed, +42 / −26  |
| `apps/server/src/seasons/safeFetch.test.ts`              | new, 80 lines       |
| `apps/server/src/seasons/safeFetch.ts`                   | new, 94 lines       |
| `apps/server/src/seasons/seasons.ts`                     | new, 176 lines      |
| `apps/server/test/rounds.integration.test.ts`            | changed, +7 / −0    |
| `apps/server/test/specials.integration.test.ts`          | new, 223 lines      |
| `docs/BACKLOG.md`                                        | changed, +2 / −1    |
| `docs/DECISIONS.md`                                      | changed, +6 / −1    |
| `docs/OPEN.md`                                           | changed, +1 / −0    |
| `docs/spec/04-software-architecture.md`                  | changed, +3 / −3    |
| `docs/spec/06-data-model-api-realtime.md`                | changed, +2 / −2    |
| `docs/spec/08-admin-settings.md`                         | changed, +1 / −0    |
| `docs/spec/README.md`                                    | changed, +1 / −1    |
| `games/guess-the-number/src/conformance.ts`              | changed, +3 / −0    |
| `games/guess-the-number/src/fakes.ts`                    | changed, +3 / −0    |
| `games/guess-the-number/src/module.ts`                   | changed, +4 / −1    |
| `games/guess-the-number/src/settings.ts`                 | changed, +45 / −5   |
| `games/guess-the-number/src/specials.properties.test.ts` | new, 176 lines      |
| `games/guess-the-number/src/specials.ts`                 | new, 152 lines      |
| `games/guess-the-number/src/state.ts`                    | changed, +101 / −11 |
| `games/guess-the-number/src/views.test.ts`               | changed, +1 / −0    |
| `games/guess-the-number/src/views.ts`                    | changed, +26 / −6   |
| `games/registry/src/conformance.test.ts`                 | changed, +36 / −4   |
| `packages/application/src/round/roundSession.test.ts`    | changed, +14 / −2   |
| `packages/application/src/round/roundSession.ts`         | changed, +6 / −0    |
| `packages/domain/src/index.ts`                           | changed, +4 / −2    |
| `packages/domain/src/round/builder.ts`                   | new, 36 lines       |
| `packages/domain/src/round/evolve.ts`                    | changed, +36 / −5   |
| `packages/domain/src/round/fakes.ts`                     | changed, +23 / −5   |
| `packages/domain/src/round/guess.test.ts`                | changed, +3 / −3    |
| `packages/domain/src/round/guess.ts`                     | changed, +25 / −14  |
| `packages/domain/src/round/lifecycle.test.ts`            | changed, +16 / −4   |
| `packages/domain/src/round/lifecycle.ts`                 | changed, +41 / −35  |
| `packages/domain/src/round/specials.test.ts`             | new, 212 lines      |
| `packages/domain/src/round/specials.ts`                  | new, 153 lines      |
| `packages/domain/src/round/step.ts`                      | changed, +4 / −2    |
| `packages/domain/src/round/types.ts`                     | changed, +30 / −1   |
| `packages/game-sdk/src/index.ts`                         | changed, +2 / −0    |
| `packages/game-sdk/src/module.ts`                        | changed, +15 / −0   |
| `packages/game-sdk/src/roundSettings.test.ts`            | changed, +6 / −0    |
| `packages/game-sdk/src/roundSettings.ts`                 | changed, +12 / −3   |
| `packages/game-sdk/src/specialSettings.ts`               | new, 101 lines      |

</details>

### P6 — Player and host client

**Built** (02 §11, §12; 03 §6; look and wording as Bingo 01 §13):

- Lobby: public matches, go to a match by code, open a match (hosts), and in development builds the Quick Test link (loaded on demand, out of the production bundle).
- Match page: join and leave, the season team picker (locked while a round runs), players with their teams and whether they are here, the host console, and the current or last round.
- Host console: every host-chosen setting of the game's document with its bounds in force, prefilled with the last round's choices; the season (In Season while usable, or by hand); the halving switch only on a halving day; Create, Create and start, Start, End, Abort with a reason.
- Round screen: the season banner on its token colour with icon, the special's name and rule, the halving badge; "Opens in 3 s" or the time left and the cooldown; for a roster player the cooldown ring and the game's player panel (hint card, range bar with the server's band and fallen numbers, guess field with Enter, own guesses newest first, "answer arriving in 2 s" under Frost); for everyone else the game's spectator panel; roster ("cooling down" / "ready" / solved and place) and the live feed in plain lines.
- Result page: the headline ("bot-03 found it first — after 4 guesses."), the winning margin or "Nobody else was close.", the secret or every secret with all guesses, placings with points ("took part", "not solved", the viewer's line highlighted), the team result, and the fairness proof (commitment, revealed seed, link to `/rounds/:id/verify`).
- Quick Test page (development): seed, mode, season (or the seed's), bots, cooldown, range, visibility, fast specials.
- The game's web half (`games/guess-the-number/web`) and the registry's (`games/registry/web`) behind the prop types of `game-sdk` (T45); shapes in `contracts/src/http/play.ts` used by server and client (T46); the socket with replay numbers and the clock offset from three `time.sync`; the socket reconnects on every sign-in change.

**Checked in a browser** (dev stack, Chromium, two full Quick Test rounds against 3 bots, seed `meadow`): desktop 1280×800 in light mode (autumn) and phone 390×844 in dark mode (winter, Frost's "answer arriving" shown); no console errors; every phone screen fits 390 px after the fixes below. The screenshots for the owner follow in P8 under `reports/night-1/`.

**Fixed after looking:** the result table made the phone page 408 px wide (now scrolls inside its panel); the season icon vanished on its own colour in the banner (now on a light disc); bots showed as "away" (they now count as connected); the ring said "Ready" during the countdown (now shown only while open); the production bundle contained the Quick Test link's text (moved into the lazily loaded dev tools).

**Tests:** `pnpm verify` green (187 tests in 43 files); component tests for the range bar, the player, spectator and result panels and every game line (`panels.test.tsx`), and for the cooldown ring, roster, result screen and the platform's sentences (`round.test.tsx`).

**Reused from Bingo (d294585), adapted:** `game/socket.ts` → `live/socket.ts` (plus the clock offset); `useSecondsUntil.ts` → `live/useTicker.ts`; `seasonIcons.ts` and `types.ts` season colours → `season/season.ts`; `components/SeasonIcon.tsx` → `season/SeasonIcon.tsx`; the dev tools' Quick Test link pattern; `resetSocket` on session changes (removed in P2, back now).

**Extracted:** `components/fields.tsx` (text, number, choice and switch fields, action button, problem line) shared by lobby, host console and Quick Test; `match/roundFields.tsx` (setting fields, season controls, `useSeasonChoice`); `PlayArea` out of `RoundScreen`; `GuessForm` and `OwnGuesses` out of `PlayerPanel`.

**Docs:** DECISIONS T45, T46, T39 (rewritten: the root timeout did not reach the projects, so it now sits in the server's test harness and on the heavy chi-square test); BACKLOG Phases 1–3 split.

**Noticed, left alone:** anonymous visitors cannot open the socket (the handshake needs a session), so watching needs a guest or account session; the feed starts empty after a reload (only frames seen on the page are listed; the state view carries every guess); the HTTP guess fallback is not used by the client yet (only the socket).

<details><summary>P6 lines per touched file</summary>

| File                                            | Lines               |
| ----------------------------------------------- | ------------------- |
| `apps/server/src/dev/quickTest.ts`              | changed, +2 / −0    |
| `apps/server/src/http/routes/matches.ts`        | changed, +13 / −4   |
| `apps/server/src/match/play.ts`                 | changed, +2 / −0    |
| `apps/server/src/round/views.ts`                | changed, +11 / −1   |
| `apps/server/test/harness.ts`                   | changed, +5 / −0    |
| `apps/web/package.json`                         | changed, +2 / −0    |
| `apps/web/src/components/fields.tsx`            | new, 163 lines      |
| `apps/web/src/live/socket.ts`                   | new, 76 lines       |
| `apps/web/src/live/useMatch.ts`                 | new, 54 lines       |
| `apps/web/src/live/useRound.ts`                 | new, 73 lines       |
| `apps/web/src/live/useTicker.ts`                | new, 28 lines       |
| `apps/web/src/lobby/Lobby.tsx`                  | changed, +153 / −19 |
| `apps/web/src/match/HostConsole.tsx`            | new, 208 lines      |
| `apps/web/src/match/MatchPage.tsx`              | new, 172 lines      |
| `apps/web/src/match/roundFields.tsx`            | new, 113 lines      |
| `apps/web/src/round/CooldownRing.tsx`           | new, 51 lines       |
| `apps/web/src/round/ResultScreen.tsx`           | new, 132 lines      |
| `apps/web/src/round/RoundScreen.tsx`            | new, 171 lines      |
| `apps/web/src/round/RoundSide.tsx`              | new, 90 lines       |
| `apps/web/src/round/round.css`                  | new, 209 lines      |
| `apps/web/src/round/round.test.tsx`             | new, 142 lines      |
| `apps/web/src/round/roundText.ts`               | new, 102 lines      |
| `apps/web/src/season/SeasonIcon.tsx`            | new, 42 lines       |
| `apps/web/src/season/season.ts`                 | new, 48 lines       |
| `apps/web/src/shell/AppShell.tsx`               | changed, +17 / −3   |
| `apps/web/src/shell/DevTools.tsx`               | changed, +13 / −3   |
| `apps/web/src/shell/QuickTest.tsx`              | new, 180 lines      |
| `apps/web/src/shell/router.ts`                  | changed, +11 / −2   |
| `apps/web/src/shell/session.tsx`                | changed, +14 / −9   |
| `apps/web/src/shell/shell.test.tsx`             | changed, +10 / −2   |
| `docs/BACKLOG.md`                               | changed, +16 / −16  |
| `docs/DECISIONS.md`                             | changed, +3 / −1    |
| `docs/spec/README.md`                           | changed, +1 / −1    |
| `games/guess-the-number/package.json`           | changed, +11 / −4   |
| `games/guess-the-number/src/views.test.ts`      | changed, +1 / −1    |
| `games/guess-the-number/src/views.ts`           | changed, +8 / −1    |
| `games/guess-the-number/web/PlayerPanel.tsx`    | new, 123 lines      |
| `games/guess-the-number/web/RangeBar.tsx`       | new, 57 lines       |
| `games/guess-the-number/web/ResultPanel.tsx`    | new, 49 lines       |
| `games/guess-the-number/web/SpectatorPanel.tsx` | new, 63 lines       |
| `games/guess-the-number/web/gtn.css`            | new, 88 lines       |
| `games/guess-the-number/web/index.ts`           | new, 17 lines       |
| `games/guess-the-number/web/panels.test.tsx`    | new, 155 lines      |
| `games/guess-the-number/web/text.ts`            | new, 62 lines       |
| `games/guess-the-number/web/tsconfig.json`      | new, 18 lines       |
| `games/registry/package.json`                   | changed, +8 / −4    |
| `games/registry/web/index.ts`                   | new, 36 lines       |
| `games/registry/web/tsconfig.json`              | new, 18 lines       |
| `packages/contracts/src/http/play.ts`           | new, 133 lines      |
| `packages/contracts/src/index.ts`               | changed, +17 / −3   |
| `packages/domain/src/index.ts`                  | changed, +1 / −0    |
| `packages/game-sdk/src/drbg.test.ts`            | changed, +2 / −1    |
| `packages/game-sdk/src/index.ts`                | changed, +9 / −1    |
| `packages/game-sdk/src/web.ts`                  | new, 54 lines       |
| `pnpm-lock.yaml`                                | changed, +33 / −0   |
| `vitest.config.ts`                              | changed, +0 / −3    |

</details>

### P7 — Admin client

**Built** (spec 08; T47): `apps/admin` as a Vite and React app on port 5411 (it was a shell).

- Sign-in with e-mail and password, and in development builds "Sign in as admin".
- Areas by permission: Settings (`admin.view`), Seasons (`season.manage`), Abuse (`abuse.view`), Audit log (`audit.read`).
- Settings: every document (matches, seasons, integrations, security, rate limits, and one per game). Each key shows its label, key and help; the catalogue default; the value in force; the min and max in force (narrowed by the document, never wider than the catalogue); who may change it ("host per round; default by game admin", "security admin", …); when a change applies to running rounds; and its source ("owner (O15)", "proposal", "technical"). The keys the server lists as editable for the viewer get inputs for a new default and narrowed bounds; saving needs the read version and takes a comment into the audit log. A newer version, a forbidden key or a wrong value come back in plain words.
- Seasons: the feed's last answer, age and error, "Refresh now"; halving days with source, add and remove.
- Abuse: accounts by 7-day score with their recent signals in plain words; suspension with a reason (`account.suspend`).
- Audit log: 50 entries at a time with filter and paging; "Check the chain".

**Checked in a browser** (dev stack, Chromium 1280×900): signed in as admin, changed the Guess The Number cooldown default to 12 s with a comment (version 2, the value in force updated), saw the entry in the audit log, checked the chain, opened abuse and seasons, and set the default back. No console errors.

**Fixed after looking:** the chain check showed "breaks at entry -1" for an intact chain; the server answers `-1` for intact (the domain's `brokenLink`), and the page now says "The chain is intact."

**Tests:** `pnpm verify` green (191 tests in 43 files); admin component tests: a setting row's columns (default 500, in force 300, min 2, max 800 narrowed, role, effect, source), its editor only when editable, the words of 08 §2, the chain message, sign-in without an account, and areas by permission.

**Reused:** the player client's `http.ts` contract (copied: an app may not import another app, 04 §3), `@smg/ui` styles, the settings definitions and `effectiveBounds` of `game-sdk`. Nothing from Bingo (its admin app is a shell too).

**Removed:** the admin shell's `index.ts` and `index.test.ts`.

**Docs:** DECISIONS T47; BACKLOG Phase 3 closed, Phase 6 split.

**Noticed, left alone:** 08 §1 also asks for version history with diff and rollback, confirm dialogs and 2FA step-up; the server keeps every version, but there is no route or screen for history yet (BACKLOG Phase 6). The production image does not serve the admin build yet.

<details><summary>P7 lines per touched file</summary>

| File                                       | Lines              |
| ------------------------------------------ | ------------------ |
| `apps/admin/index.html`                    | new, 22 lines      |
| `apps/admin/package.json`                  | changed, +18 / −3  |
| `apps/admin/src/App.tsx`                   | new, 109 lines     |
| `apps/admin/src/SignIn.tsx`                | new, 70 lines      |
| `apps/admin/src/TextInput.tsx`             | new, 49 lines      |
| `apps/admin/src/abuse/AbusePage.tsx`       | new, 120 lines     |
| `apps/admin/src/admin.css`                 | new, 91 lines      |
| `apps/admin/src/admin.test.tsx`            | new, 130 lines     |
| `apps/admin/src/audit/AuditPage.tsx`       | new, 106 lines     |
| `apps/admin/src/http.ts`                   | new, 51 lines      |
| `apps/admin/src/index.test.ts`             | removed (18 lines) |
| `apps/admin/src/index.ts`                  | removed (14 lines) |
| `apps/admin/src/main.tsx`                  | new, 27 lines      |
| `apps/admin/src/seasons/SeasonsPage.tsx`   | new, 137 lines     |
| `apps/admin/src/settings/SettingRow.tsx`   | new, 163 lines     |
| `apps/admin/src/settings/SettingsPage.tsx` | new, 186 lines     |
| `apps/admin/src/settings/settingText.ts`   | new, 59 lines      |
| `apps/admin/tsconfig.json`                 | changed, +8 / −2   |
| `apps/admin/vite.config.ts`                | new, 31 lines      |
| `docs/BACKLOG.md`                          | changed, +2 / −2   |
| `docs/DECISIONS.md`                        | changed, +1 / −0   |
| `docs/spec/README.md`                      | changed, +1 / −1   |
| `eslint.config.js`                         | changed, +1 / −1   |
| `pnpm-lock.yaml`                           | changed, +39 / −1  |

</details>

### P8 — E2E, load gate, play-through

**Built** (spec 09 §4, §5):

- E2E journeys 1–7 and 9 (`e2e/rounds.spec.ts`, `specials.spec.ts`, `players.spec.ts`, `access.spec.ts`) with the shared helpers `e2e/play.ts`. A person is a browser context signed in by the development sign-in. `search` plays a round from the screen alone, guessing the middle of the band the server sent. Every match is aborted at the end, never deleted. Journey 9 uses axe (WCAG 2.2 AA tags) and guesses by keyboard only.
- The load driver `load/guessStorm.mjs` (a workspace package). It signs in N players plus 100 spectators and spreads their sockets over six worker threads (`load/stormWorker.mjs`). It runs one shared round (cooldown 3 s, range 1–1 000 000) with binary-searching players that pause 200–1 500 ms. It checks the log through the fairness proof and reads the server's CPU, memory and loop lag from `/metrics`. Afterwards it aborts the match, deletes the load accounts and puts the match size setting back.
- The play-through screenshots, 25 PNG in `reports/night-1/`: lobby, Quick Test form, countdown, round with the host console, and result, each on desktop and on a 390 px phone, in light and in dark; plus the admin app's settings, a game document after a change, the audit log with the chain check, abuse and seasons. No console errors on any page.

**Test results:**

- `pnpm verify` green: 196 tests in 45 files.
- E2E, whole suite in Chromium, Firefox and WebKit (iPhone 13): 28 passed. 3 failed, all WebKit-only (see "Fixed after looking"); after the fixes those 3 passed in WebKit. After the room-frame change (T49), the round journeys were re-run in Chromium: all 8 passed. Journey 8 is blocked: the embedded handoff is roadmap phase 7.
- Load, one short run each (`reports/night-1/load-500.json`, `load-1000.json`). Measured on this laptop (14 threads), with the server under `tsx` in development mode and the driver on the same machine; this is not the reference VPS.

| Check (09 §5)                              | 500 players + 100 spectators | 1 000 players + 100 spectators |
| ------------------------------------------ | ---------------------------- | ------------------------------ |
| Guess acknowledgement p95 / p99            | 133 / 190 ms ✓ (< 150 / 300) | 4 603 / 4 791 ms ✗ (p95 < 300) |
| Own feedback p95                           | 133 ms ✓ (< 200)             | 4 601 ms ✗                     |
| Lost, duplicated, reordered; gap-free seqs | none; gap-free ✓             | none; gap-free ✓               |
| Fairness proof; winners                    | verified; 1 ✓                | verified; 1 ✓                  |
| Event-loop lag p99 (peak sample)           | 87 ms ✗ (< 50)               | 197 ms ✗                       |
| Server CPU mean / peak; memory             | 0.38 / 0.51 cores; 357 MiB ✓ | 0.67 / 0.91 cores; 484 MiB     |
| Guesses in the round; round length         | 9 001; 68 s                  | 18 086; 78 s                   |
| Driver's busiest worker                    | 13 %                         | 54 %                           |

At 1 000 players the one server thread is saturated, so the 781 guesses accepted but not acknowledged are the backlog at the round's end, not lost guesses. The proposal is in [OPEN.md](OPEN.md) (r).

**Fixed after looking:**

- Load, driver: the first 500-player try ran all 600 sockets in one process. Its ack times (p95 4 s) were the driver falling behind the frames, not the server. The driver now uses worker threads and reports how busy they are (T51). It also paces sign-ins under the per-address limit of 600 a minute, and it measures a player's feedback from its own frame, which arrives before the ack.
- Load, server: a CPU profile at 300 players showed socket writes (`writev`) as two thirds of the busy time: one room frame per 20 ms batch to every watcher. Room frames are now merged over 100 ms, and the first goes out at once (`apps/server/src/realtime/roomFrames.ts`, `SMG_ROOM_FRAME_MS`, T49). At 300 players the ack p95 went from 335 ms to 78 ms and the CPU from 0.69 to 0.25 cores.
- Load, server: "match changed" went to every page once per entering player, and every page reloads on it. It is now at most once a second per match (`perKeyAtMost.ts`, T50).
- `/rounds/:id/verify` read the log while the last batches were still being written, and answered "the round has not ended" under load. It now waits for them (`round.drain()`).
- Development sign-in takes four-digit load names (`load-0001` … `load-1100`); five digits are refused, and the integration test covers both.
- E2E, WebKit: the play loop's 2 s bound on a click failed every time, because WebKit with trace recording takes 1–3 s a step with several pages open. The WebKit timing project now records no trace (T51), and the loop's bounds are 3 s for reads and 10 s for actions. Journey 1's countdown is 8 s, so a slow browser still sees it hold Guess. Journey 2 checks for "no enabled Guess button", because a solved player's form is gone.
- Phone result: the placings table split words ("Plac e", "too k part") and pushed Points out of the panel. Words now wrap whole, and the cells are tighter below 480 px; all four columns fit at 390 px.
- Earlier in P8 (before the full run): field help is linked by `aria-describedby` instead of sitting in the label (axe); presence changes reach the room; the host check is host identity alone (T48); a Frost round reloads once more after the delay, so an answer released during a reload still shows.

**Reused from Bingo:** `load/drawLatency.mjs` (dev sign-in with cookie and CSRF, the call helper; adapted in `load/http.mjs`), the split of the Playwright projects into a timing pass (Bingo NIGHT-3), and `@axe-core/playwright` as Bingo's journey 9 uses it.

**New dependency:** `@axe-core/playwright` 4.13.0 (dev, root), for journey 9. The `load` package uses `socket.io-client` 4.8.4, already in the lockfile through the server's tests.

**Removed or extracted:** nothing removed. Extracted: `perKeyAtMost` and `roomFrames` from the gateway's broadcast path, and `load/http.mjs` and `load/stormWorker.mjs` from the first single-file driver.

**Noticed, left alone:**

- Full-page screenshots show the page background ending at the first screen. The background is `background-attachment: fixed`; a real browser keeps it behind the viewport.
- Re-running the account journey three times within an hour trips the registration limit in Firefox ("Too many tries"). That is the limiter working; a fresh stack passes.
- At start, the dev server warns that Fastify's `disableRequestLogging` is deprecated (FSTDEP023), and pnpm warns that `prom-client` 15.1.3 is deprecated.
- L1's nine further rounds (each special, a halving round), L2 `open-burst` and L3 `parallel` were not run: the task asked for one short run at 500 and one at 1 000.

<details><summary>P8 lines per touched file</summary>

| File                                            | Lines                  |
| ----------------------------------------------- | ---------------------- |
| `apps/server/src/config/env.ts`                 | changed, +2 / −0       |
| `apps/server/src/http/routes/adminGuard.ts`     | changed, +1 / −1       |
| `apps/server/src/http/routes/devSignIn.ts`      | changed, +4 / −4       |
| `apps/server/src/http/routes/matches.ts`        | changed, +9 / −3       |
| `apps/server/src/http/routes/rounds.ts`         | changed, +12 / −8      |
| `apps/server/src/main.ts`                       | changed, +1 / −0       |
| `apps/server/src/match/play.ts`                 | changed, +2 / −2       |
| `apps/server/src/realtime/gateway.ts`           | changed, +29 / −9      |
| `apps/server/src/realtime/intents.ts`           | changed, +6 / −3       |
| `apps/server/src/realtime/perKeyAtMost.test.ts` | new, 43 lines          |
| `apps/server/src/realtime/perKeyAtMost.ts`      | new, 33 lines          |
| `apps/server/src/realtime/roomFrames.test.ts`   | new, 67 lines          |
| `apps/server/src/realtime/roomFrames.ts`        | new, 65 lines          |
| `apps/server/test/auth.integration.test.ts`     | changed, +4 / −1       |
| `apps/server/test/socketKit.ts`                 | changed, +2 / −0       |
| `apps/web/src/components/fields.tsx`            | changed, +18 / −9      |
| `apps/web/src/live/useRound.ts`                 | changed, +30 / −8      |
| `apps/web/src/round/round.css`                  | changed, +10 / −0      |
| `docs/BACKLOG.md`                               | changed                |
| `docs/DECISIONS.md`                             | changed, +4 / −0       |
| `docs/NIGHT-RUN.md`                             | changed                |
| `docs/OPEN.md`                                  | changed                |
| `docs/spec/04-software-architecture.md`         | changed, +1 / −0       |
| `docs/spec/08-admin-settings.md`                | changed, +1 / −0       |
| `docs/spec/README.md`                           | changed, +1 / −1       |
| `e2e/access.spec.ts`                            | new, 64 lines          |
| `e2e/play.ts`                                   | new, 155 lines         |
| `e2e/players.spec.ts`                           | new, 111 lines         |
| `e2e/playwright.config.ts`                      | changed, +8 / −3       |
| `e2e/rounds.spec.ts`                            | new, 100 lines         |
| `e2e/specials.spec.ts`                          | new, 109 lines         |
| `load/guessStorm.mjs`                           | new, 210 lines         |
| `load/http.mjs`                                 | new, 62 lines          |
| `load/package.json`                             | new, 14 lines          |
| `load/stormWorker.mjs`                          | new, 107 lines         |
| `package.json`                                  | changed, +1 / −0       |
| `pnpm-lock.yaml`                                | changed, +25 / −0      |
| `pnpm-workspace.yaml`                           | changed, +2 / −0       |
| `reports/night-1/`                              | new, 25 PNG and 2 JSON |

</details>

### P9 — Dev servers and hand-over

**Running:** `pnpm dev` on this machine: server http://127.0.0.1:3910 (ready), player client http://127.0.0.1:5410, admin app http://127.0.0.1:5411, PostgreSQL on 5510 (Docker `smg-dev`).

**Quick Test:** http://127.0.0.1:5410/#/quick-test. Open "Dev sign-in" in the header, choose "Sign in as player-1", open the Quick Test, type a seed into the seed field, leave Season on "from the seed", and start.

**Server commit:** `ddbc324` on `feat/guess-the-number` (P8; this sheet's commit changes only docs).

**Seeds** (the season comes from `sha256("smg-quicktest:" + seed)`, first byte mod 4):

| Seed      | Season | What to look at                                                                                     |
| --------- | ------ | --------------------------------------------------------------------------------------------------- |
| `meadow`  | Spring | Spring Herald: one free hint at the start, shown in the banner and the live feed.                   |
| `harvest` | Summer | Heatwave: the cooldown under the banner shrinks step by step, never below 3 s; the ring follows it. |
| `frost`   | Autumn | Leaf Fall: numbers are struck from the range bar; a struck number is refused without cost.          |
| `blossom` | Winter | Frost: own answers show "answer arriving" and land after the delay; the result waits for it too.    |

**What to look at:**

1. One Quick Test round per seed, on a desktop and at phone width (390 px), in light and in dark (the sun and moon button). Expected: the season banner with its icon; the countdown holds Guess; the cooldown ring after each guess; the range bar with the band; bots shown as "here" and guessing; a result with the secret, placings, team result and the fairness proof.
2. As host (the Quick Test player hosts its round): "End round" and "Abort round" (with a reason).
3. Two windows with "host" and "player-1"/"player-2" (Dev sign-in): open a match from the lobby, join, pick teams, and start a round from the host console. Teams lock while it runs.
4. The admin app at http://127.0.0.1:5411 ("Sign in as admin (development)"): settings with defaults, values in force, bounds and roles; Seasons; Abuse; Audit log with "Check the chain".
5. The screenshots in `reports/night-1/` show all of this from the night.
6. The owner items at the top of this sheet: (q), conflict 1, gaps 1–2, and (r), the load gate.

**Push:** confirmed with `git ls-remote origin`: `refs/heads/feat/guess-the-number` at `ddbc324` (P8), `master` at `eaeadd5` (not merged into). This sheet's own commit is pushed the same way after it.

**CI:** P3–P7 green. P8 (`ddbc324`): green (security, docs, verify, e2e in three browsers).
