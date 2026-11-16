# Night runs

The morning sheet of the current night, and an index of the past ones. The past nights' full sheets (their pieces, measurements, play-throughs and what was noticed) are in git history: `git show 592592e:docs/NIGHT-RUN.md` holds every sheet up to chain MG-N10 and this night's first pieces.

## Night chain MG-N11 (2026-11-16/17): the flights merged, browser runs, docs and code cleaned

Status, piece by piece (updated after every piece).

- **1. Merge `feat/mg-flight-speed`** (T371, T372, T376, T377): done, PR #17 merged as `297bb59`; its required checks green in the PR run and the push run; the branch deleted on origin and locally. The first runs found two defects, fixed before the merge (`69bfa7f`): a phone's All card shrank All's icons to 10.7 px (a card now shows at most what fits at 82 % of an icon's size, the rest joins "+N", T377), and two unhandled 57P01 errors after a green authorization matrix (the harness now expects its container's shutdown). Journey 12 failed once in a push run (known flake, BACKLOG). MG-FLIGHT-CLEAN: no brief for it reached this session and nothing of that name is in the repository; not started.
- **2. Browser tests** (O103, amends O69): done on `chore/cleanup`: CI's `e2e` job (a required check, name kept) runs Chromium only everywhere, master included; `.github/workflows/browsers.yml` runs Firefox and WebKit on master at 02:30 UTC every night and on manual dispatch (their specs, then each browser's timing specs one after the other). DECISIONS O103, spec 09 §1, CLAUDE.md and OPEN updated. The nightly run starts once the workflow is on master (piece 4's merge).
- **3. Docs:** running.
- **4. Code and tests:** dead code, files over the limit, tests that check nothing current: open.
- **5. Morning handover:** open.
- **Needs the owner's word:** the MG-FLIGHT-CLEAN brief (never received; `shots/mg-flight-3` from MG-FLIGHT-3 kept instead for the morning look); from MG-FLIGHT-3: names of neighbouring flights overlap on a phone (proposal: a name only on a lone named flight in its card, or names cut to 8 characters).

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
