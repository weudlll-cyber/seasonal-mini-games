# Night runs

The morning sheet of the current night, and an index of the past ones. The past nights' full sheets (their pieces, measurements, play-throughs and what was noticed) are in git history: `git show 592592e:docs/NIGHT-RUN.md` holds every sheet up to chain MG-N10 and this night's first pieces.

## Night chain MG-N11 (2026-11-16/17): the flights merged, browser runs, docs and code cleaned

Status, piece by piece (updated after every piece).

- **1. Merge `feat/mg-flight-speed`** (T371, T372, T376, T377): done, PR #17 merged as `297bb59`; its required checks green in the PR run and the push run; the branch deleted on origin and locally. The first runs found two defects, fixed before the merge (`69bfa7f`): a phone's All card shrank All's icons to 10.7 px (a card now shows at most what fits at 82 % of an icon's size, the rest joins "+N", T377), and two unhandled 57P01 errors after a green authorization matrix (the harness now expects its container's shutdown). Journey 12 failed once in a push run (known flake, BACKLOG). MG-FLIGHT-CLEAN: no brief for it reached this session and nothing of that name is in the repository; not started.
- **2. Browser tests** (O103, amends O69): done on `chore/cleanup`: CI's `e2e` job (a required check, name kept) runs Chromium only everywhere, master included; `.github/workflows/browsers.yml` runs Firefox and WebKit on master at 02:30 UTC every night and on manual dispatch (their specs, then each browser's timing specs one after the other). DECISIONS O103, spec 09 §1, CLAUDE.md and OPEN updated. The nightly run starts once the workflow is on master (piece 4's merge).
- **3. Docs** (`c7cfe31`): done. Sizes before → after: DECISIONS 1 140 295 → 282 119 bytes (tables → lists, 462 entries, every text unchanged); NIGHT-RUN 466 026 → 3 640; BACKLOG 90 741 → 46 274; OPEN 20 259 → 16 595; `docs/` 2 158 506 → 788 635. The living specs lost their history and long paragraphs (four helpers, one per file group); `reports/` left the tree, archived in the tag `archive/reports-2026-11-16` on `592592e`. Link check: 397 OK, 0 errors.
- **4. Code and tests** (`d5df850`): done. knip once: 57 names un-exported, an unused hook, type alias and re-export removed, three unused dependencies dropped; the 324-line league test split in three files; three assertions removed that only checked something removed stays absent. `pnpm verify` green (858 + 99 + 173); the full Playwright suite in Chromium green (14 + 42 tests); the docs link check green. PR to `master`: running.
- **5. Morning handover:** open.
- **Needs the owner's word:**
  - MG-FLIGHT-CLEAN: no brief reached this session and nothing of that name is in the repository; not started. `shots/mg-flight-3` (MG-FLIGHT-3's six shots) is kept for the morning look instead of `shots/mg-flight-clean`.
  - The flights on a phone: names of neighbouring flights overlap (a 66 px card cannot hold two names); proposal: a name only on a lone named flight in its card, or names cut to 8 characters.
  - O65 confirmed the rules of Safecracker, Bomb Defusal and Seasonal Target, and 02b–02d now say so; their settings still carry the status `proposal` in code (shown in the admin's settings) and in 08 §3.1–§3.3. Switching them to the owner's status changes the admin's display, so it waits for your word.
  - Bomb Defusal's explosion penalty: O65 makes it a host setting per round; 08 §3.2 and the setting's help text still say "per match".
  - Tests kept as doubtful: `packages/ui/src/index.test.ts` (a scaffold check that the runner finds the package; `PACKAGE_NAME` exists only for it); `apps/web/src/round/focus.test.tsx` "shows the time left but no waiting time" (checks only the absence; the rule is current, 02 §12); the identical `sentinel.test.tsx` bodies of three games (security, kept; a shared helper later); `base32Decode` in `apps/server/src/auth/totp.ts`, used only by tests.
  - Specs that no longer match the tree (changed neither): 10 §1 lists existing files as planned and 10 §5 says no CI exists; 01 §1 and 11 §3 call the later games "roadmap only"; 04 §4 and §4.3 call `phased` not built; 03 §6 and 02 §12 differ on the special's banner (3 s above the list vs 5 s in the list head); 04 §5.4's DRBG labels lack `comment/<receiveSeq>`; 02e §8.2 lacks O102's numeric-aware order; 02d §3 links to an OPEN section that is closed; 07 §5 still calls the website contract proposed.
  - Local `master` holds an old local merge commit (`82f0400`, task MG-MERGE) that never reached origin (the same merge went in as PR #11); not reset (no resets), the night worked from `origin/master`.

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
