/**
 * @file   vitest.config.ts
 * @module repo
 * @brief  Root Vitest config: every workspace package, game and app is one test project.
 *
 * Responsibility: let "pnpm test" run all projects in one Vitest process, on half the
 *                 cores so timing-free tests are not starved (as Bingo). "pnpm test:coverage"
 *                 measures game-sdk, domain, application and the game modules against the
 *                 targets of docs/spec/09-testing-strategy.md §1.
 * Spec:           docs/spec/09-testing-strategy.md §1, §2; docs/spec/10-repository-structure.md §1
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Each folder becomes a project named after its package.json "name" (e.g. @smg/domain).
    projects: ['packages/*', 'games/*', 'apps/*'],
    // Half the cores: jsdom tests beside the integration tests' databases starve otherwise
    // (Bingo NIGHT-4 measurement).
    maxWorkers: '50%',
    // Off for "pnpm test"; "pnpm test:coverage" turns it on. Targets of 09 §1.
    coverage: {
      provider: 'v8',
      include: [
        'packages/game-sdk/src/**',
        'packages/domain/src/**',
        'packages/application/src/**',
        'games/*/src/**',
      ],
      exclude: ['**/*.test.ts', '**/fakes.ts', '**/test/**'],
      reporter: ['text-summary'],
      thresholds: {
        'packages/game-sdk/src/**': { lines: 95, branches: 90 },
        'packages/domain/src/**': { lines: 95, branches: 90 },
        'packages/application/src/**': { lines: 85, branches: 80 },
        'games/*/src/**': { lines: 95, branches: 90 },
      },
    },
  },
});
