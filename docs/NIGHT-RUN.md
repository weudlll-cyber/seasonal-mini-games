# Night run 1 — morning sheet

Branch `feat/guess-the-number` (not merged; for the owner to look at first). Updated after every piece.

## Status

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

## Needs the owner

- (q) Winning-margin window, proposal `round.marginWindowS` 2 s (0.5–10 s): [OPEN.md](OPEN.md).
- Spec conflict 1, check order of a guess (02 §5.1 against 04 §4.1–§4.2), built as 02 §5.1: [OPEN.md](OPEN.md). Please confirm.
- Spec gap 1, `round_results.secret` stays empty (the server cannot name a game's secret): [OPEN.md](OPEN.md).
- Spec gap 2, the feed's host allowlist is the feed address itself: [OPEN.md](OPEN.md).
- (r) Load gate: 500 players pass except event-loop lag (87 ms, limit 50); 1 000 players fail the acknowledgement time (p95 4.6 s, limit 300 ms) on this laptop. Proposal: measure on the reference VPS first: [OPEN.md](OPEN.md).
- E2E journey 8 (embedded handoff) is blocked: the handoff is roadmap phase 7, not built yet.

## P2 — Foundation

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

## P3 — Guess The Number domain and application

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

## P4 — Server

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

## P5 — Seasonal specials

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

## P6 — Player and host client

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

## P7 — Admin client

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

## P8 — E2E, load gate, play-through

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

## P9 — Dev servers and hand-over

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
