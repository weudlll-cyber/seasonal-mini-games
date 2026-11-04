/**
 * @file   vitest.config.ts
 * @module repo
 * @brief  Root Vitest config: every workspace package, game and app is one test project.
 *
 * Responsibility: let "pnpm test" run the projects in three Vitest runs: every project
 *                 but the server's, then the server's own unit tests (`src/`), then its
 *                 integration tests (`test/`, a Docker database each), each run on half the
 *                 cores but at most four (as Bingo, T206). "pnpm test:coverage"
 *                 measures game-sdk, domain, application and the game modules against the
 *                 targets of docs/spec/09-testing-strategy.md §1.
 * Spec:           docs/spec/09-testing-strategy.md §1, §2; docs/spec/10-repository-structure.md §1
 */
import { availableParallelism } from 'node:os';

import { defineConfig } from 'vitest/config';

// Half the logical cores, at most four (DECISIONS T206): the development laptop's Core Ultra 7
// 165U has 14 threads but two performance cores in a 15 W budget, and with seven forks its
// jsdom and property tests ran two to three times slower than alone, past 5 s, and forks
// timed out starting; four forks there, two on CI's four-core runners.
const WORKERS = Math.min(4, Math.max(1, Math.floor(availableParallelism() / 2)));

export default defineConfig({
  test: {
    // Each folder becomes a project named after its package.json "name" (e.g. @smg/domain).
    projects: ['packages/*', 'games/*', 'apps/*'],
    // jsdom tests beside the integration tests' databases starve otherwise (Bingo NIGHT-4
    // measurement); "pnpm test" runs the server's integration tests, each with its own
    // PostgreSQL container, after the rest, not beside them (DECISIONS T206).
    maxWorkers: WORKERS,
    // Off for "pnpm test"; "pnpm test:coverage" turns it on. Targets of 09 §1.
    coverage: {
      provider: 'v8',
      include: [
        'packages/game-sdk/src/**',
        'packages/guess-engine/src/**',
        'packages/domain/src/**',
        'packages/application/src/**',
        'games/*/src/**',
      ],
      exclude: ['**/*.test.ts', '**/fakes.ts', '**/test/**'],
      reporter: ['text-summary'],
      thresholds: {
        'packages/game-sdk/src/**': { lines: 95, branches: 90 },
        'packages/guess-engine/src/**': { lines: 95, branches: 90 },
        'packages/domain/src/**': { lines: 95, branches: 90 },
        'packages/application/src/**': { lines: 85, branches: 80 },
        'games/*/src/**': { lines: 95, branches: 90 },
      },
    },
  },
});
