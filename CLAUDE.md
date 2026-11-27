# CLAUDE.md — Working rules for this repository

## Language

Everything in this repository is English: code, comments, commit messages, docs, UI strings.

## Source of truth

- The specification in `docs/spec/` governs behaviour. Read the sections a task names before changing code, and cite them in the report.
- If the spec is silent or contradictory on a point you need, do not invent a rule: implement the rest, and list the question in the report.
- Decisions and their reasons are in `docs/DECISIONS.md`. Do not reverse one without a task that says so.
- Settings definitions with their defaults live in `packages/contracts/src/settings/` (platform) and `games/<game>/src/settings.ts` (per game), as catalogued in docs/spec/08-admin-settings.md. Do not change a default unless the task says so.

## Architecture rules

- Layers: `domain` ← `application` ← `apps/server`. `domain` and every `games/<game>/src` have no I/O, no clock, no randomness except injected ports. `contracts` holds every shape shared across the wire.
- A game plugs in through the game-module contract (docs/spec/04-software-architecture.md §4). Adding a game never changes platform code; if it seems to, stop and report it.
- Client code never computes feedback, cooldowns, placings or standings, and never receives a secret before the round has ended. The server decides; the client renders.
- File ≤ 300 lines, function ≤ 60 lines, complexity ≤ 12. Split by responsibility, not by line count.
- Every source file starts with the standard header (docs/spec/10-repository-structure.md §3). Important blocks get inline comments.

## Hygiene in every task

- Before writing a helper, search for an existing one; name reused helpers in the report.
- No dead code, no unused variables or exports in the area you touched; things noticed elsewhere are reported, not changed.
- Update header comments, inline comments, docs and line references in the same commit as the code.
- When a task closes an item, move it in `docs/BACKLOG.md` from part one to part two in the same commit, then align `docs/OPEN.md`.
- New dependencies: name each one and the reason in the report.
- The reference project `seasonal-bingo-royale` is read-only from this repository. Something there that looks wrong is reported, not changed.

## Git

- Work on the branch the task names. Push after every finished piece of work.
- Merge only when the task explicitly allows it. After a merge, check CI for the merge commit (`gh run list --branch master`) and report it.
- Never force-push or reset. After a branch is merged and the CI run on `master` for the merge commit is green, delete the branch on origin and locally.
- Accounts created for a test are removed by that test; matches it created are aborted, never deleted (the round event log is append-only, docs/spec/06-data-model-api-realtime.md §2.3).
- Never disable a trigger, constraint or other protection. If a task needs that, list it under the owner's questions in the report and continue without it.
- Screenshots never go into a working branch: images under `reports/` are git-ignored; push a run's screenshots, with their `play-through.txt`, only to an orphan branch of their own (`shots/<night>`, nothing else in it), which the owner deletes after the review (DECISIONS T146).
- Screenshots only when the owner is to look at something new, or when a defect is visible only in a picture: at most about 10 per task, light mode only (dark only when the change is about dark mode); no multi-agent screenshot reviews; the author looks at their own few shots and reports only what is wrong (DECISIONS O70, amending O55).
- Checks run on GitHub, never twice and not on the owner's machine, which also runs other projects (DECISIONS O147, amending O64): a branch gets a draft PR to master (draft, its title starting "Draft:"), so every push to it runs the full CI once, as the pull request's run (CI runs on pull requests to master and on pushes to master only, DECISIONS O156); what CI finds is fixed and pushed again. Locally only the fast tests of the package or game being changed run, and a single journey only to reproduce a CI failure; no full local `pnpm verify` and no full local e2e. The proof of a task is the draft PR's CI run on its last push (report its run id and result). Repeated runs only when a test's flakiness is the subject; screenshots per O70. The merge gate and every push to master run `pnpm verify` plus the full e2e suite in Chromium only; Firefox and WebKit run every night on master (and when started by hand, `.github/workflows/browsers.yml`), nobody waits for them, and a failure there is listed in OPEN's "Firefox/WebKit findings" and fixed later in a batch (DECISIONS O103, amending O69).
- Run commands one at a time. Do not chain them with `&&`, `;` or `|` unless a single tool needs a pipe; chained commands do not match the permission rules and make the owner approve them by hand.

## How we check

The kit's handbook, "How we check" (kit K82, K110; taken with the move to v0.36.0, T445). Where it
and a line under Git differ for a task, the task block names which holds.

- **"Done" for a piece means built, pushed and quick-checked.**
- **A small task:** before each push, the fast tests of the changed files, quiet; where the change
  touches what a browser spec checks, that one spec file in one browser. The full checks run on
  GitHub through the draft PR; do not wait for CI between the pieces of a chain, look at the latest
  run once at its end and before a merge, and fix a red run on the same branch.
- **A big move** (a kit adoption, a migration, many known changes):
  1. Build all changes first; between them only the typecheck, the lint of the touched files and
     the unit tests of the touched package. Then one round of the real checks, each once: the
     browser specs that cover the changes, the sweep, a rehearsal where ops changed, the draft
     PR's CI. A fault is fixed and only what the fix can have changed is checked again.
  2. The sweep runs once, at the end. What it finds is fixed together, and only this is checked
     again: a colour change, the contrast of the screens concerned; a size or spacing change of a
     shared part, the screens that show it; anything else, the one screen. No further full run.
  3. No walks or measurements between pieces. A walk of its own only for what the sweep cannot
     check, named with its reason.
  4. The report says how many full runs there were and why. An exemption names its reason: a kit
     part (`file:line` in the kit) or an owner decision (its number). Anything else is fixed.
  5. Line counts come once, at the hand-over, for the whole branch against `master`.
  6. One written report (the night sheet) holds fixes, exemptions, decisions and kit findings; the
     final message gives only the pushed commits, the CI result, the open questions with a
     proposal, new kit findings and the report's path.
  7. A rehearsal covers only what the change can have altered: first list what changed in those
     paths (the CHANGELOG and the diff, `file:line`), then rehearse those.
- **The sweep:** a game server's request limit is met with the screen's `setup` (a fresh sign-in),
  never by loosening the limit; an owner's floor of visible items is declared as `floors`.
- Never re-run a check on an unchanged tree. Wait for CI with one blocking command.
- Until Mini Games' own way to the server, the full browser suite stays on pull requests (O160).

### Where a check may look and write

The kit's handbook, "Where a check may look and write" (kit K125; taken with the move to v0.40.0,
T450).

| Rule                                                                                                                                                                                                     | Why                                                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| A change that matters only on a server (a database health check over TCP, say) is made with the game's way to the server and rehearsed there with a fresh install, not as a change of its own before it. | Where it matters is the only place it can be seen to work; a change made apart is checked by nothing and found wrong during the move to the server.  |
| Browser tests, sweeps and measurements never write the owner's development database: they use their own database or schema, created fresh and thrown away.                                               | The owner looks at the game in that database; test accounts and matches left there cannot be told from the owner's own, and some tables only append. |
| Browser journeys use fixed seeds and handle every outcome chance can give. A test that fails on a lucky outcome is a test defect, not a flaky run to repeat.                                             | A run repeated until it passes hides the defect and costs a run each time; the same seed shows the same screen to whoever reads the failure.         |
| A website-mode part is looked at in the local preview before a merge (OPERATIONS.md "The local website-mode preview"); the real shared call only on the website.                                         | The back link, the step badges, the header and the call's slot appear in website mode only, and the preview's call is a stand-in.                    |

Here: the runs' databases are `smg_test`, `smg_e2e_website` and `smg_load`, dropped at each run's
end (docs/spec/09-testing-strategy.md §1.1); a measurement by hand runs against such a stack, never
against `pnpm dev`; the preview is `pnpm preview:website`.

## Working cheaply

Spend fewer tokens without testing or checking less (the rules Seasonal Bingo Royale has had since 2026-11-06, DECISIONS T421).

- Test runs print failures only: `pnpm exec vitest run --reporter=dot <project or file>` and `pnpm e2e --reporter=dot <file>` (the repository has no quiet script). Never read a passing run's output.
- Long logs (installer tests, load checks, CI job logs) go to a file in the git-ignored `logs/` folder; read only the failing part (search or tail).
- Screenshots are for the owner, not for checking: check with assertions, and open an image only when an assertion cannot decide it (when to take them: Git, O70).
- Wait for CI with one blocking command, `gh run watch <id> --exit-status` with its output sent to a file in `logs/`, not by polling.
- Read large files by searching first and reading only the lines needed.
- Never re-run a check on an unchanged tree.
- A flaky test is fixed at its cause the first time it flakes, not re-run (the nightly Firefox/WebKit findings stay batched, Git, O103).

## Before reporting

Push; the proof is the draft PR's CI run on the last push, not a local full run (Git, O147). Report the CI run id and its result, and: lines before/after per touched file, what was removed, what was extracted, what was reused, what was noticed but left alone, test results, and for visible changes what the owner should look at (Quick Test seed when available).
