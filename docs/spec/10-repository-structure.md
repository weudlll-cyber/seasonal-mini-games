# 10 — Repository Structure, Local Ports and Deployment

> Part of the Seasonal Mini Games specification. Index: [README](README.md). Bingo references: see [README](README.md) §2.

## 1. Layout

Everything except `README.md`, `CLAUDE.md`, `LICENSE`, `.gitignore` and `docs/` is *planned*. It arrives with the work package that needs it. Files whose role is the same as in Bingo (Bingo 10 §1) are listed by name only.

```
seasonal-mini-games/
├─ README.md  CLAUDE.md  LICENSE  SECURITY.md  CONTRIBUTING.md
├─ .editorconfig  .gitattributes  .gitignore  .nvmrc  .npmrc
├─ package.json  pnpm-workspace.yaml  pnpm-lock.yaml        workspaces: packages/*, games/*, apps/*, e2e, load
├─ tsconfig.base.json  eslint.config.js  prettier.config.js  vitest.config.ts  lefthook.yml  renovate.json
├─ .vscode/  .github/                                        as Bingo (workflows, shared setup action, PR template)
├─ assets/                                                   copied from Bingo assets/ with its manifest (03 §6)
├─ packages/
│  ├─ game-sdk/src/        contract.ts (GameModule and its types), random.ts, settings.ts, range.ts,
│  │                       crypto.ts (entry @smg/game-sdk/crypto: drbg.ts, commitment.ts), conformance/
│  ├─ domain/src/          match/, round/ (lifecycle, roster, cooldown, order, placings), specials/
│  │                       (scheduling, Heatwave, Frost), teams/, seasons/, standings/
│  ├─ application/src/     round/ (engine.ts: the round actor, batcher.ts, queue.ts), match/, seasons/,
│  │                       ports.ts (Clock, SecureRandom, RoundStore, Scheduler, EventBus, SeasonFeed), fakes.ts
│  ├─ contracts/src/       http/, ws/, events/, settings/ (schemas and defaults/), errors.ts
│  └─ ui/                  shared React components, design tokens (as Bingo)
├─ games/
│  ├─ registry/            src/index.ts (modules), web/index.ts (screens): the installed games (04 §3)
│  └─ guess-the-number/
│     ├─ src/              module.ts, feedback.ts, hints.ts, leafFall.ts, halving.ts, views.ts, events.ts,
│     │                    settings/ (schema.ts, defaults.ts), *.test.ts
│     └─ web/              GameScreen.tsx, RangeBar.tsx, CooldownRing.tsx, GuessList.tsx, strings.ts
├─ apps/
│  ├─ server/src/          main.ts, cli.ts, config/, http/, auth/, realtime/ (gateway, intents, inOrder),
│  │                       round/ (actor host, pgRoundStore, pgScheduler), seasons/ (feed client), db/, dev/
│  ├─ web/src/             shell/, lobby/, match/ (round host: loads the game's web entry), host/, account/,
│  │                       leaderboard/, chat/, embed/
│  ├─ admin/  embed-loader/                                  as Bingo
├─ e2e/                    Playwright specs (journeys of 09 §4)
├─ load/                   guessStorm.mjs (09 §5)
├─ ops/                    install.sh, smg, lib/, compose.yml, compose.website.yml, compose.dev.yml, Caddyfile,
│                          pull-backups.sh/.ps1, examples/ (as Bingo, renamed)
└─ docs/
   ├─ spec/                this specification
   ├─ BACKLOG.md  OPEN.md  DECISIONS.md  GAME-IDEAS.md
   └─ operator-guide.md  code-review-checklist.md            (planned, as Bingo)
```

## 2. Size and structure rules (adopted)

As Bingo 10 §2, enforced by ESLint and `tsc`: file ≤ 300 lines (tests ≤ 400), function ≤ 60 lines, complexity ≤ 12, at most 4 parameters, layer boundaries from [04](04-software-architecture.md) §3 (`eslint-plugin-boundaries`, with zones for `game-sdk`, `games/*/src`, `games/*/web` and the two halves of `games/registry`), no default exports, no `any`, no non-null `!`, no unused variables or imports. In addition, `Math.random` is forbidden in `packages/` and `games/*/src` ([05](05-security-threat-model.md) §4).

## 3. Standard file header (adopted from Bingo 10 §3)

Every source file (TS, TSX, SQL, shell, YAML workflow) starts with this header. Comment syntax follows the language: `#` lines for shell and YAML, `--` for SQL.

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
| Metrics port inside its container | **9465** | 9464 |

Container-side ports of the third-party images (PostgreSQL 5432, Mailpit 1025 and 8025) are not bound on the host and are the same in both repositories.

**Off-limits** (used by other projects on the development machine, as listed in Bingo 08 §1.1 and Bingo `ops/.env.dev.example`): 3800, 5380, 7880, 7881, 3478, 5349, 50000–50499 (Seasonal Entertainment), 4000, 5173, 4173 (race game), 5273, 8000 (mining game), and all Bingo ports above. Before starting anything on a port, check that it is free. If a port of this project is held by an earlier run of this project, stop that process first.

Every development page shows a small fixed badge **"Mini Games · dev · &lt;port&gt;"**, compiled out of production builds, as in Bingo 08 §1.1. Development features need `SMG_DEV=1`, which the server refuses unless `SMG_PUBLIC_URL` is a localhost address (fail closed, as Bingo).

## 5. DevOps (adopted)

Bingo 08 applies with the names of [04](04-software-architecture.md) §2.2: environments (§1), branching and release flow (§2), CI jobs including e2e on every push and the `load` job before a release (§3), containers (§4: multi-stage, non-root uid 10001, read-only root FS, healthcheck `/healthz`, image ≤ 250 MB), runtime configuration through validated env vars (§5), observability with the metrics of [06](06-data-model-api-realtime.md) §4.6 (§6), dependency and patch policy (§7), and developer experience (§8: `pnpm dev` starts server and both clients; PostgreSQL and Mailpit through `docker compose --env-file ops/.env.dev.example -f ops/compose.dev.yml up -d`; `pnpm verify` runs CI's blocking checks).

No CI exists until the first code work package (decision 7: specification first).

## 6. Deployment (adopted, with differences)

Bingo 09 applies with the names of [04](04-software-architecture.md) §2.2: single VPS with Docker Compose (§1), files on the server (§2), the one-command installer with both install types and every answer as a flag (§3), the `smg` CLI with `status`, `update`, `confirm`, `rollback`, `backup`, `restore`, `logs`, `admin create-super`, `maintenance` (§4), bootstrap (§5), age-encrypted backups pulled to the operator's machine (§6), one environment per server (§7), variants (§8), and the hardening checklist (§9).

Differences:

- **Website install type:** the website's Caddy forwards `/games/mini-games/*` (HTTP and WebSocket) to the app's port 3100 on the website's Docker network. The installer writes the route snippet to `/opt/smg/website-mini-games.caddy`. `SMG_BASE_PATH=/games/mini-games/`.
- **Next to Bingo on one server:** both can be installed as the website type on the same server. They keep separate databases, containers, volumes, env files and backup timers. Two **standalone** installs cannot share a server, because both need ports 80 and 443. The installer's port check refuses, as Bingo's does (Bingo `ops/lib/host.sh`).
- **Maintenance:** `smg maintenance on` stops new matches and new rounds. Running rounds finish.
- **Updates during play:** `smg update` waits up to 10 minutes for open rounds to end, or with `--now` restarts at once. Open rounds then resume from their event log ([04](04-software-architecture.md) §5.3); cooldowns and Frost-held answers are rebuilt.
- **Secrets generated at install:** `SMG_ROUND_KEY` (32 random bytes) in addition to Bingo's set.
