/**
 * @file   eslint.config.js
 * @module repo
 * @brief  ESLint flat config: strict typed TypeScript rules, size limits and layer rules.
 *
 * Responsibility: enforce the size and structure rules of 10 §2, the dependency rule of
 *                 04 §3 (via eslint-plugin-boundaries) and the ban on Math.random in pure
 *                 code (05 §4). Formatting is left to Prettier. Adapted from Bingo's config.
 * Depends on:     tsconfig.json of the root and of every workspace project (typed linting),
 *                 tsconfig.base.json (the "@smg/*" and "@smg-game/*" aliases)
 * Spec:           docs/spec/10-repository-structure.md §2, docs/spec/04-software-architecture.md §3,
 *                 docs/spec/05-security-threat-model.md §4
 */
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';
import boundariesModule from 'eslint-plugin-boundaries';
import tseslint from 'typescript-eslint';

// The package types declare an ESM default export, but the package is CommonJS and its
// module.exports is the plugin itself, so the default import already is the plugin.
const boundaries = /** @type {import('eslint').ESLint.Plugin} */ (
  /** @type {unknown} */ (boundariesModule)
);

// One boundaries element per workspace project. The registry's two halves come before the
// generic game patterns so they match first.
const ELEMENTS = [
  { type: 'game-sdk', pattern: 'packages/game-sdk' },
  { type: 'domain', pattern: 'packages/domain' },
  { type: 'application', pattern: 'packages/application' },
  { type: 'contracts', pattern: 'packages/contracts' },
  { type: 'ui', pattern: 'packages/ui' },
  { type: 'registry', pattern: 'games/registry/src' },
  { type: 'registry-web', pattern: 'games/registry/web' },
  { type: 'game', pattern: 'games/*/src' },
  { type: 'game-web', pattern: 'games/*/web' },
  { type: 'server', pattern: 'apps/server' },
  { type: 'web', pattern: 'apps/web' },
  { type: 'admin', pattern: 'apps/admin' },
  { type: 'embed-loader', pattern: 'apps/embed-loader' },
];

/**
 * Which element may import which (04 §3). Anything not listed is disallowed: game-sdk and
 * embed-loader import nothing from other workspace projects, contracts only the SDK, a game imports
 * only game-sdk, and no platform package names a game. Only the server and the player
 * client reach games, and only through the registry.
 * @param {string} from
 * @param {string[]} to
 */
const allow = (from, to) => ({
  from: { element: { type: from } },
  allow: { to: { element: { types: { anyOf: to } } } },
});
const LAYER_POLICIES = [
  allow('domain', ['game-sdk']),
  allow('application', ['domain', 'contracts', 'game-sdk']),
  // Contracts carry the SDK's setting definitions to the admin app (types and pure checks).
  allow('contracts', ['game-sdk']),
  allow('ui', ['contracts']),
  allow('game', ['game-sdk']),
  allow('game-web', ['game-sdk', 'game', 'ui']),
  allow('registry', ['game', 'game-sdk']),
  allow('registry-web', ['game-web', 'game-sdk']),
  allow('server', ['domain', 'application', 'contracts', 'game-sdk', 'registry']),
  allow('web', ['contracts', 'ui', 'game-sdk', 'registry-web']),
  allow('admin', ['contracts', 'ui']),
];

// Default exports are banned so every import names what it uses.
const NO_DEFAULT_EXPORT = [
  { selector: 'ExportDefaultDeclaration', message: 'Use a named export.' },
  { selector: 'ExportSpecifier[exported.name="default"]', message: 'Use a named export.' },
];

export default defineConfig(
  // Build and test output, and the git-ignored scratch folder of runs.
  {
    ignores: [
      '**/node_modules/',
      '**/dist/',
      '**/coverage/',
      'tmp/',
      'test-results/',
      'playwright-report/',
      'reports/',
      // Static files served as they are (the plain early theme script, outside the TS
      // projects); apps/web/src/shell/theme.test.tsx runs it.
      'apps/web/public/',
      // The load check: a plain Node script against a running stack, outside the TS projects.
      'load/',
    ],
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { boundaries },
    settings: {
      'boundaries/elements': ELEMENTS,
      // The resolver only needs the aliases, which live in the base config.
      'import/resolver': { typescript: { project: 'tsconfig.base.json' } },
    },
    rules: {
      'no-restricted-syntax': ['error', ...NO_DEFAULT_EXPORT],
      'max-lines': ['error', { max: 300 }],
      'max-lines-per-function': ['error', { max: 60 }],
      complexity: ['error', 12],
      'max-params': ['error', 4],
      // Underscore-prefix is the TS convention for a deliberately unused parameter.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'boundaries/dependencies': ['error', { default: 'disallow', policies: LAYER_POLICIES }],
    },
  },
  {
    // Pure code draws every random value from the round DRBG (05 §4, S3).
    files: ['packages/**/*.ts', 'games/*/src/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the round DRBG (05 §4).' },
      ],
    },
  },
  {
    // The server's build script and its stub: plain JavaScript run by Node, outside the TS projects.
    files: ['apps/server/build.mjs', 'apps/server/devStub.mjs'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      parserOptions: { projectService: false, project: false, program: null },
      globals: { console: 'readonly', process: 'readonly' },
    },
  },
  {
    // Test files of every kind, the Playwright specs included, may run to 400 lines.
    files: ['**/*.test.ts', '**/*.test.tsx', 'e2e/**/*.spec.ts'],
    rules: { 'max-lines': ['error', { max: 400 }] },
  },
  {
    // Tool config files must default-export their configuration (Vite, Vitest, etc.);
    // so must Playwright's global setup.
    files: ['*.config.js', '*.config.ts', '**/*.config.js', '**/*.config.ts', 'e2e/globalSetup.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  prettier,
);
