# Night run 1 — morning sheet

Branch `feat/guess-the-number` (not merged; for the owner to look at first). Updated after every piece.

## Status

| Piece                               | State              | Commit                                           |
| ----------------------------------- | ------------------ | ------------------------------------------------ |
| P1 Record O8–O15, T21; spec updated | done               | `eaeadd5` on master (spec/v1 merged and deleted) |
| P2 Foundation                       | done               | `e9936aa`                                        |
| P3 GTN domain and application       | done               | see `git log` on this branch                     |
| P4 Server                           | running            |                                                  |
| P5 Seasonal specials                | open (needs P4)    |                                                  |
| P6 Player and host client           | open (needs P4)    |                                                  |
| P7 Admin client                     | open (needs P4)    |                                                  |
| P8 E2E, load gate, play-through     | open (needs P5–P7) |                                                  |
| P9 Dev servers and hand-over        | open (needs P8)    |                                                  |

## Needs the owner

- (q) Winning-margin window, proposal `round.marginWindowS` 2 s (0.5–10 s): [OPEN.md](OPEN.md).
- Spec conflict 1, check order of a guess (02 §5.1 against 04 §4.1–§4.2), built as 02 §5.1: [OPEN.md](OPEN.md). Please confirm.

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
