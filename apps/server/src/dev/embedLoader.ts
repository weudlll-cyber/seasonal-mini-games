/**
 * @file   apps/server/src/dev/embedLoader.ts
 * @module server/dev
 * @brief  Development only: builds `embed.js` from apps/embed-loader on each request.
 *
 * Responsibility: bundle the loader's TypeScript source in memory with esbuild (a dev
 *                 dependency), as apps/server/build.mjs does for the image, so a change to the
 *                 loader shows at once. The production bundle replaces this module (../../devStub.mjs).
 * Depends on:     esbuild, node:url
 * Used by:        ../http/app (with SMG_DEV=1 only)
 * Spec:           docs/spec/07-integration.md §1; Bingo 07 §3.2
 */
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const ENTRY = fileURLToPath(new URL('../../../embed-loader/src/index.ts', import.meta.url));

export async function devEmbedScript(): Promise<string> {
  const result = await build({
    entryPoints: [ENTRY],
    bundle: true,
    write: false,
    format: 'iife',
    target: 'es2022',
    minify: true,
    logLevel: 'silent',
  });
  return result.outputFiles[0]?.text ?? '';
}
