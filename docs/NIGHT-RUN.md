# Night runs

The morning sheet of the current night, and an index of the past ones. The past nights' full sheets (their pieces, measurements, play-throughs and what was noticed) are in git history: `git show 592592e:docs/NIGHT-RUN.md` holds every sheet up to chain MG-N10 and this night's first pieces.

## Night chain MG-N12 (2026-11-17/18): the flights' loose ends, O102, docs, browser runs

All on `feat/mg-flight-clean` (from `e29e6b2`), not merged: the owner tests it in the morning. Status, piece by piece (updated after every piece).

- **1. Journey 44's unexplained miss** ("bot-11" Autumn → All without its feed line, MG-FLIGHT-END): done. Not reproduced in 30 runs of journey 44 (10 + 3 + 7 + 10); recorded in BACKLOG part one with the conditions, nothing changed for it. Found instead: the probe's `leftover` check failed in 8 of 17 runs (2 of 7 undisturbed; 6 of 10 while I edited files the test client reloads), flights "still in the band" 2.8–3.0 s after their start, connected, before the result. A probe fault: it compared wall time against a 0.4 s allowance while its own measuring in three windows with 40 bots held the pages up, delaying the band's removal timer too (unprobed: 2.40–2.44 s). Now judged on the page's own timers (a task after one due 0.2 s past the flight's life); after: 10 of 10 runs green.
- **2. The All card's labels under the pill; the refused-for-rate message** (T383, proposal): done. The band is 60 px (was 56) with its coin row 4 px lower: every name and "×N" keeps 4 px clear under the button and its "✓ Your choice"; the counts move those 4 px. Journey 44's probe checks it at all three sizes (jsdom lays nothing out, so no component test can); the pairing checks moved to `e2e/flightLines.ts` (`flightChecks.ts` was at 298 lines). The rate: my MG-FLIGHT-CLEAN-2 report was wrong, the platform did show its line, but as "…too many guesses at once."; Mind Games now says "Slow down a little — too many choices at once." (component test). Journeys 44 and 45 green; journey 45 failed once first on a click at a phone card's bottom: it measured the card, waited 0.3 s, then clicked, so the first counts arriving in between moved the card (now it waits first, then measures and clicks; green after).
- **3. O102 everywhere** (T382): done. The result rows of a phased round in O102's order; the comparison moved to `@smg/game-sdk` (`compareNames`) and used by the standings and the result rows.
- **4. Docs provably wrong:** done. Spec 10 §1 (the game-sdk files and the conformance suite as they are), §5 (the CI jobs that exist; no load job); spec 04 §5.4 (`spring/<who>`, `springHerald/<who>`, the Quick Test bots' `quicktest/…`); spec 03 §6 (event rows in the Log, not the main list); `SpecialBanner.tsx`'s header (wraps, T194). Link check: 400 OK, 0 errors.
- **5. Firefox/WebKit nightly runs** (`browsers.yml`): done for the runs so far: 43986481564 (dispatch, 2026-11-17 00:17 UTC) and 44004176312 (schedule, 02:35 UTC), both green (24 + 41 + 41 passed, 2 and 1 skipped: the Chromium-only specs); no findings. Tonight's run (02:30 UTC on 2026-11-18, master unchanged at `bd5f877`) had not started at the handover (01:14 UTC).
- **Final checks:** `pnpm verify` green (866 + 100 + 173) after one fix: a Mind Games text test used `RATE_LIMITED` as its example of a code left to the platform; it now expects the game's sentence and keeps `ROUND_BUSY` as the example. Journeys 38–46 in Chromium once: 9 of 9 green (journey 46's last step again between the ticks).
- **6. Morning handover:** done; see the report.
- **Needs the owner's word:**
  - The Quick Test on the server needs only a signed-in account (T381): answered on 2026-11-18, it stays so (DECISIONS O106 (2)).
  - T383's look: labels 4 px clear under the cards' buttons, the counts 4 px lower.

## Past nights and tasks

Date, the night or task, and the merge into `master` that carried it.

- 2026-10-24: specification v1 with the owner's answers (night 1, 24–26 October): `eaeadd5`.
- 2026-10-27 to 2026-11-01: night 2, night 3, night 4, Leaf Fall, the visible specials (Guess The Number and the platform, `night/2026-10-27`): `fd8ef34`.
- 2026-11-02 to 2026-11-04: night 5, tiles and focus mode, nights 6–8, the play-test fixes, the clean state, play-test round 2, the team column (Seasonal Safecracker, Seasonal Bomb Defusal, Seasonal Target, `feat/guess-games`, PR #1): `4b86ba6`.
- 2026-11-05 and 2026-11-06: website mode and night 9's pieces 1–2 (`feat/website-mode`, PR #2): `ff0af7f`; night 9's pieces 3–4 (`feat/round-polish`, PR #3): `66e2828`; the inactivity limit (`feat/inactivity`, PR #4): `59fd076`; the dress rehearsal of the live install.
- 2026-11-10: the website follow-ups (PR #5): `b53055e`; journey 36's resign (PR #6): `e3cfd56`; the countdown's contrast (PR #7): `67306ff`.
- 2026-11-12 and 2026-11-13: night MG-N1, the docs cleanup (PR #9): `c3b8a69`, then the `phased` contract on `feat/mind-games`.
- 2026-11-13 to 2026-11-16: chains MG-N2 and MG-N3, tasks MG-N4 to MG-N9 (Seasonal Mind Games on `feat/mind-games`); task MG-N5's test isolation (PR #10): `dc78140`; task MG-MERGE (PR #11): `fc044ab`.
- 2026-11-16: chain MG-N10: the flaky tests (PR #14): `5cea5ff`, (PR #15): `1708cb9`; the dev services' restart (PR #16): `295978b`; the flights MG-N10 piece 3, MG-FLIGHT-2 and MG-FLIGHT-3 (PR #17): `297bb59`.
- 2026-11-16/17: chain MG-N11: the flights merged (PR #17): `297bb59`; the browser runs, docs and code cleaned (PR #18): `bd5f877`. Tasks MG-FLIGHT-CLEAN, -2 and -END on `feat/mg-flight-clean`, not merged yet.
