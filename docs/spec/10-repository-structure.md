# 10 — Repository Structure, Local Ports and Deployment

> Part of the Seasonal Mini Games specification. Index: [README](README.md). Bingo references: see [README](README.md) §2.

## 1. Layout

Files whose role is the same as in Bingo (Bingo 10 §1) are listed by name only.

```
seasonal-mini-games/
├─ README.md  CLAUDE.md  LICENSE  SECURITY.md  CONTRIBUTING.md
├─ .editorconfig  .gitattributes  .gitignore  .nvmrc  .npmrc
├─ package.json  pnpm-workspace.yaml  pnpm-lock.yaml        workspaces: packages/*, games/*, apps/*, load
├─ tsconfig.base.json  eslint.config.js  prettier.config.js  vitest.config.ts  lefthook.yml  renovate.json
├─ .vscode/  .github/                                        as Bingo (workflows, shared setup action, PR template)
├─ assets/                                                   copied from Bingo assets/ with its manifest (03 §6)
├─ packages/
│  ├─ game-sdk/src/        module.ts (GameModule, its types and the ConformanceKit), phased.ts, web.ts,
│  │                       random.ts, settings.ts, range.ts, sentinel.ts, crypto.ts (entry
│  │                       @smg/game-sdk/crypto: drbg.ts, commitment.ts)
│  ├─ guess-engine/src/    the shared guess engine (04 §4.7): secrets, state, rules, comments, tiers,
│  │                       views, candidates, closestMiss, settings, module (guessModule)
│  ├─ domain/src/          round/ (types, lifecycle, guess, phased, specials, inactivity, results,
│  │                       closest, evolve), league/, audit/
│  ├─ application/src/     round/ (roundSession: the round's state machine over the domain,
│  │                       roundSettings, verify), settings/ (the settings service), audit/, fakes.ts
│  ├─ contracts/src/       http/ (the wire shapes per area), settings/ (platform, chat, security:
│  │                       definitions with their defaults), withoutEval.ts
│  └─ ui/                  shared React components, design tokens (as Bingo)
├─ games/
│  ├─ registry/            src/index.ts (modules), web/index.ts (screens): the installed games (04 §3);
│  │                       src/conformance.test.ts, phased.conformance.test.ts: the conformance suite
│  ├─ guess-the-number/
│  │  ├─ src/              module.ts, rules.ts, feedback.ts, closeness.ts, comments.ts, specials.ts,
│  │  │                    leafFall.ts, secrets.ts, state.ts, views.ts, settings.ts, *.test.ts
│  │  └─ web/              PlayerPanel.tsx, SpectatorPanel.tsx, ResultPanel.tsx, RangeBar.tsx,
│  │                       InfoLine.tsx, FallenNumbers.tsx, text.ts (the round's list and cooldown
│  │                       ring are the platform's, apps/web/src/round)
│  ├─ safecracker/         02b; src/ and web/ as above, on the guess engine
│  ├─ bomb-defusal/        02c; likewise
│  ├─ seasonal-target/     02d; likewise
│  └─ mind-games/          02e; src/ and web/, timing class phased, not on the guess engine
├─ apps/
│  ├─ server/src/          main.ts (entry), server.ts (start), cli.ts, config/, http/, auth/, realtime/ (gateway, intents, inOrder),
│  │                       round/ (actor, pgRoundStore, scheduler), match/, league/, chat/, admin/,
│  │                       integration/, seasons/ (feed client), db/, dev/
│  ├─ web/src/             shell/, lobby/, match/ (the waiting area and the host menu), round/ (round
│  │                       host: loads the game's web entry), account/, boards/, chat/, embed/, live/
│  ├─ admin/  embed-loader/                                  as Bingo
├─ e2e/                    Playwright specs (journeys of 09 §4)
├─ load/                   guessStorm.mjs, mindStorm.mjs (09 §5)
├─ ops/                    install.sh, smg, lib/, compose.yml, compose.website.yml, compose.website-nginx.yml,
│                          compose.dev.yml, Caddyfile, examples/, test/ (as Bingo, renamed; backup and pull scripts: the kit's, T431)
└─ docs/
   ├─ spec/                this specification
   ├─ BACKLOG.md  OPEN.md  DECISIONS.md  GAME-IDEAS.md
   └─ operator-guide.md  code-review-checklist.md            as Bingo
```

## 2. Size and structure rules (adopted)

As Bingo 10 §2, enforced by ESLint and `tsc`: file ≤ 300 lines (tests ≤ 400), function ≤ 60 lines, complexity ≤ 12, at most 4 parameters, layer boundaries from [04](04-software-architecture.md) §3 (`eslint-plugin-boundaries`, with zones for `game-sdk`, `games/*/src`, `games/*/web` and the two halves of `games/registry`), no default exports, no `any`, no non-null `!`, no unused variables or imports. In addition, `Math.random` is forbidden in `packages/` and `games/*/src` ([05](05-security-threat-model.md) §4).

## 3. Standard file header (adopted from Bingo 10 §3)

Every source file (TS, TSX, SQL, shell, YAML workflow) starts with this header. Comment syntax follows the language: `#` lines for shell and YAML, `--` for SQL. The headers stay in the sources only: the files the production build serves carry no developer comments (owner decision O128; the bundles are minified, the pages and `theme-init.js` stripped by `apps/web/productionFiles.ts` and the admin app's Vite config, checked by `apps/server/test/productionBundle.test.ts`).

```ts
/**
 * @file   games/guess-the-number/src/leafFall.ts
 * @module games/guess-the-number
 * @brief  Chooses the numbers that fall in one Leaf Fall step.
 *
 * Responsibility: pick `count` candidates uniformly with the round DRBG, never a secret,
 *                 never below minRemaining. Pure function.
 * Depends on:     @smg/game-sdk (drbg, range)
 * Used by:        ./module.ts (specials.leafFall)
 * Spec:           docs/spec/03-seasonal-specials.md §2.3
 */
```

`@brief` is one line. `Responsibility` is at most three lines. `Spec` points at the governing section. Header and inline comments change in the same commit as the code they describe. Naming (Bingo 10 §4), Conventional Commits and the PR review checklist (Bingo 10 §5) are adopted. The checklist adds one item: "a new game changes nothing in `packages/` or `apps/`".

## 4. Local development ports

Every port of this repository differs from every port used in the Bingo repository. All are bound to `127.0.0.1`.

| Service | This repository | Bingo (master `d294585`) |
|---|---|---|
| Server (HTTP + WS) | **3910** | 3900 |
| Player client (Vite) | **5410** | 5390 |
| Admin client (Vite) | **5411** | 5391 |
| PostgreSQL (dev compose) | **5510** | 5490 |
| Mailpit SMTP (dev compose) | **1110** | 1090 |
| Mailpit web UI (dev compose) | **8510** | 8490 |
| App port inside its container | **3100** | 3000 |
| Test host page for e2e journey 8 (development only) | **5420** | — |
| Browser tests' own server, player client and admin app ([09](09-testing-strategy.md) §1.1; 3940, 5440 and 5441 until 2026-11-21, when another project on the development machine took 3940, DECISIONS T398) | **3740**, **5740**, **5741** | — |
| Journey 36's website-mode server and stand-in website | **3960**, **5430** | — |
| Load check's own server ([09](09-testing-strategy.md) §1.1) | **3950** | — |
| Website-mode preview (`pnpm preview:website`, DECISIONS O166, T450): the game's server and the kit's stand-in website, on a database of its own | **3965**, **4400** | — |
| Metrics port inside its container | **9465** (reserved, not used: `/metrics` is served on the app's own port) | 9464 |

Container-side ports of the third-party images (PostgreSQL 5432, Mailpit 1025 and 8025) are not bound on the host and are the same in both repositories.

**Off-limits** (used by other projects on the development machine, as listed in Bingo 08 §1.1 and Bingo `ops/.env.dev.example`): 3800, 5380, 7880, 7881, 3478, 5349, 50000–50499 (Seasonal Entertainment), 4000, 5173, 4173 (race game), 5273, 8000 (mining game), 3930 (another project), and all Bingo ports above. Before starting anything on a port, check that it is free. If a port of this project is held by an earlier run of this project, stop that process first.

The development PostgreSQL holds the developer's database `smg` and the automated runs' own `smg_test` and `smg_load` ([09](09-testing-strategy.md) §1.1). `pnpm dev:reset-db` gives the developer's database a clean start: it drops and creates `smg` and runs the migrations (`apps/server/tools/resetDevDatabase.ts`). It refuses anything but the settings of `apps/server/dev.env` (development mode, `SMG_DEV=1`, the database `smg` on 127.0.0.1:5510) and refuses while a server answers on 3910; everything in that database is lost. No row is deleted past a trigger or constraint: the whole database is replaced (DECISIONS O94, T345).

- Every page of the player client ends with a small **build badge** at its bottom right, in every build (DECISIONS O95, T346): "Mini Games · &lt;short commit&gt; · &lt;build date&gt;", and in a development build "Mini Games · dev · &lt;branch&gt; · &lt;commit&gt; · &lt;date&gt;" (the values of the dev server's start). It stands in the page's flow, under the screen, so it covers nothing. A Docker build has no `.git`: the installer and CI pass the commit as the build argument `SMG_BUILD_COMMIT`.
- Development features need `SMG_DEV=1`, which the server refuses unless `SMG_PUBLIC_URL` is a localhost address (fail closed, as Bingo).

## 5. DevOps (adopted)

Bingo 08 applies with the names of [04](04-software-architecture.md) §2.2:

- environments (§1);
- branching and release flow (§2);
- CI (`.github/workflows/ci.yml`) on every pull request to `master` and every push to `master` (DECISIONS O156): `verify`, `security`, `docs`, the e2e journeys in Chromium and the `image` job; Firefox and WebKit every night on master (`browsers.yml`, O103); the load scenarios (`load/`, 09 §5) run in `.github/workflows/load.yml` on a push to a `load/**` branch and when started by hand (§3);
- containers (§4: multi-stage, non-root uid 10001, read-only root FS, healthcheck `/healthz`, image ≤ 250 MB unpacked);
- runtime configuration through validated env vars (§5);
- observability with the metrics of [06](06-data-model-api-realtime.md) §4.6 (§6);
- dependency and patch policy (§7);
- developer experience (§8: `pnpm dev` starts server and both clients; PostgreSQL and Mailpit through `docker compose --env-file ops/.env.dev.example -f ops/compose.dev.yml up -d`; `pnpm verify` runs CI's blocking checks).

CI in `.github/workflows/` (DECISIONS O103):

- `ci.yml` on every pull request to master and every push to master, so a commit of a branch is checked once, by its pull request (DECISIONS O156); any red job blocks the merge:
  - `verify`: `pnpm verify` and `pnpm test:coverage`;
  - `security`: `pnpm audit` (production), osv-scanner, gitleaks (full history), license check;
  - `docs`: lychee link check of the repository's Markdown, offline;
  - `e2e`: the browser tests in Chromium (`chromium`, then `chromium-timing`);
  - `image`: Docker build, Trivy (HIGH/CRITICAL with a fix), the 250 MB size budget of the unpacked file system (`docker export` of a container; `docker image inspect` gives the compressed size on the runner's containerd store, owner decision O133).
- `codeql.yml`: `analyze` on pushes and pull requests to master and weekly.
- `browsers.yml`: Firefox and WebKit (their specs, then their timing specs) every night on master and when started by hand; nobody waits for it.

## 6. Deployment (adopted, with differences)

Bingo 09 applies with the names of [04](04-software-architecture.md) §2.2:

- single VPS with Docker Compose (§1);
- files on the server (§2);
- the one-command installer with both install types and every answer as a flag (§3);
- the `smg` CLI (§4): the kit's admin command (`status`, `update`, `confirm`, `rollback`, `backup`, `restore`, `logs`, `uninstall`) with the game's `admin create-super` (standalone; a website install promotes a website account with `admin promote-super`, DECISIONS T243), and `maintenance` (DECISIONS T437, T443);
- bootstrap (§5);
- age-encrypted backups pulled to the operator's machine (§6), which also hold the round and recovery keys (owner decision 157);
- one environment per server (§7);
- variants (§8);
- the hardening checklist (§9): a standalone install applies the kit's host baseline itself (firewall, security updates, fail2ban; SSH stays the operator's).

Differences:

- **One installer for both types (O67):** `sudo bash ops/install.sh` asks the type first, then only what that type needs. Standalone asks the environment, the address, the age key and the operator's e-mail address (the kit's `/etc/seasonal/operator.env`, shared by the Seasonal installers). Website asks the environment and the age key; it finds everything else on the server. A re-run keeps the earlier answers and, when nothing changed, changes nothing.
- **Website install type (O66):** players sign in only through the website's login, as in Bingo (`SMG_AUTH_MODE=website`). `SMG_BASE_PATH=/games/mini-games/`. The installer does the whole setup and never edits a website file (DECISIONS T230–T234):
  - It detects the website's mode: its own Caddy (compose project `seasonal-site`) or host nginx in front of the site container. It reads what the website's installer prepared: the routes folder (`/etc/seasonal/routes/` for nginx; for Caddy, the host folder mounted at `/etc/caddy/routes` in the website's Caddy container), the site's local port (`/etc/seasonal/site-local-port`, nginx) and the sync token (`/etc/seasonal/games-sync-token`).
  - It probes `/api/games/mini-games/authorize` from the server. A 404, or a missing token, means the website has Mini Games switched off: the installer stops and names the website's command, `cd <website checkout> && sudo ./deploy/install.sh --update --mini-games`.
  - It writes the game's own route file, mode 0600 because it holds the proxy secret: `/etc/seasonal/routes/mini-games.conf` (nginx) or `mini-games.caddy` in the website's Caddy routes folder.
    - The route sends `/games/mini-games/` (HTTP and WebSocket) to the app and clears client-sent `X-Acting-User*`, `X-Acting-Guest` and `X-Smg-Proxy-Secret` on every path.
    - Only the sign-in route `/games/mini-games/auth/website` asks the website's authorize endpoint (`auth_request` / `forward_auth`, with `X-Original-Method`) and passes its identity headers. The secret is added only after that call. A refusal goes to `/games/mini-games/auth/website/login` with the same query, and `/games/mini-games/metrics` answers 404.
    - The website's session cookie (`__Host-se.sid`, `se.sid`) goes to the authorize call with the browser's Cookie but never to the app (HTTP and WebSocket); the game's own cookies pass (DECISIONS T281).
  - It checks the proxy's configuration (`nginx -t`, `caddy validate`). On a failure it puts the earlier file back and stops; otherwise it reloads the proxy.
  - It ends with a check through the website: `/games/mini-games/` answers, the sign-in route without a session ends at the website's `/login?next=…`, and `/embed/chat?room=mini-games` answers.
  - The app joins the website's Docker network as `smg-mini-games-<env>:3100` in both modes. It reads the account-changes feed there (`SMG_WEBSITE_LOCAL_URL=http://site:3800`). Behind host nginx it also publishes `127.0.0.1:3920` on its own edge network `172.30.250.0/24`.
  - The env file gets `SMG_AUTH_MODE`, `SMG_TRUSTED_PROXIES`, `SMG_WEBSITE_PROXY_SECRET` (made once, kept), `SMG_WEBSITE_LOGIN_PATH` (`/login?next=`), `SMG_WEBSITE_LOCAL_URL`, `SMG_WEBSITE_SYNC_TOKEN` and `SMG_CHAT_PROVIDER=hostEmbed`.
  - `smg status` reports the sign-in mode, whether the authorize endpoint answers, and the account feed's last success.
- **Next to Bingo on one server:** both can be installed as the website type on the same server. They keep separate databases, containers, volumes, env files, route files, loopback ports (3920 and Bingo's 3900), edge subnets (`172.30.250.0/24` and Bingo's `172.30.249.0/24`) and backup timers. Two **standalone** installs cannot share a server, because both need ports 80 and 443. The installer's port check refuses, as Bingo's does (Bingo `ops/lib/host.sh`).
- **Maintenance:** `smg maintenance on` stops new matches and new rounds (503 `MAINTENANCE` for opening a match, creating a round and the Quick Test). Running rounds finish (DECISIONS T95).
- **Updates during play:** `smg update` waits up to 10 minutes for open rounds to end, or with `--now` restarts at once. Open rounds then resume from their event log ([04](04-software-architecture.md) §5.3); cooldowns and Frost-held answers are rebuilt.
- **Secrets generated at install:** `SMG_ROUND_KEY` and `SMG_RECOVERY_KEY` (32 random bytes each, made once and kept; an install made before the second gains it on its next run) in addition to Bingo's set, and the passwords of the two database roles ([06](06-data-model-api-realtime.md) §1). The operator guide ([../operator-guide.md](../operator-guide.md)) follows the kit's section order.
- **Containers:** every service of `ops/compose.yml` carries the kit's hardening (read-only root, no new privileges, all capabilities dropped but those it is shown to need); `apps/server/test/containers.test.ts` holds the file to it.
