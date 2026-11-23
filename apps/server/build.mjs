/**
 * @file   apps/server/build.mjs
 * @module server
 * @brief  Production build of the server: one bundle per entry point plus the SQL migrations.
 *
 * Responsibility: bundle src/main.ts (the server) and src/cli.ts (the operator commands,
 *                 e.g. create-super) with esbuild into dist/ (or the folder given as the
 *                 first argument), the workspace packages (@smg/* and the games @smg-game/*,
 *                 TypeScript sources) and the shared kit (@seasonal/kit) inlined and the npm
 *                 dependencies left as imports for
 *                 node_modules, without comments or spacing; the development modules (src/dev/*,
 *                 the Quick Test and dev sign-in routes) replaced by ./devStub.mjs (the kit's
 *                 devStubPlugin); the embed loader (apps/embed-loader) as a browser script
 *                 <out>/public/embed.js, which GET /embed.js serves; copy
 *                 src/db/migrations to <out>/migrations, where the bundled migrator looks for
 *                 them. Run by the Dockerfile.
 * Depends on:     esbuild, @seasonal/kit/devtools (devStubPlugin), node:fs, node:path,
 *                 ./devStub.mjs
 * Used by:        Dockerfile, test/productionBundle.test.ts
 * Spec:           Bingo 08 §4; Bingo 09 §1
 */
import { cpSync, rmSync } from 'node:fs';
import path from 'node:path';

import { devStubPlugin } from '@seasonal/kit/devtools';
import { build } from 'esbuild';

const out = process.argv[2] ?? 'dist';

// npm packages stay imports for node_modules; the workspace packages (@smg/* and the games,
// @smg-game/*: TypeScript sources Node cannot load from node_modules) and the shared kit
// (@seasonal/kit, a dev dependency: its git-hosted install needs git, which the image's
// `pnpm deploy` does not have, as in Bingo) are compiled into the bundle.
const INLINED = /^(@smg(-game)?\/|@seasonal\/kit(\/|$))/;
const npmExternal = {
  name: 'npm-external',
  setup(builder) {
    builder.onResolve({ filter: /^[^./]/ }, (args) =>
      INLINED.test(args.path) ? undefined : { path: args.path, external: true },
    );
  },
};

// Development code stays out of the production bundle (audit B): the app registers these
// modules only with SMG_DEV=1, so the stub is never called in a production install. The
// plugin is the kit's; the modules and the stub are the game's.
const DEV_MODULE = /[\\/]src[\\/](dev[\\/][^\\/]+|http[\\/]routes[\\/](quickTest|devSignIn))\.js$/;
const devStub = devStubPlugin({ devModule: DEV_MODULE, stub: path.resolve('devStub.mjs') });

rmSync(out, { recursive: true, force: true });
await build({
  entryPoints: ['src/main.ts', 'src/cli.ts'],
  outdir: out,
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  // Drops comments and spacing; the source map still points at the sources.
  minifyWhitespace: true,
  plugins: [npmExternal, devStub],
  // Bundled CommonJS code may still call require().
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
  logLevel: 'info',
});
// The loader host pages include (07 §1): one small script without dependencies.
await build({
  entryPoints: ['../embed-loader/src/index.ts'],
  outfile: path.join(out, 'public', 'embed.js'),
  bundle: true,
  format: 'iife',
  target: 'es2022',
  minify: true,
  logLevel: 'info',
});
cpSync('src/db/migrations', path.join(out, 'migrations'), { recursive: true });
