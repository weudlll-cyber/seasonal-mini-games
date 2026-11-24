/**
 * @file   apps/web/productionFiles.ts
 * @module web
 * @brief  Build only: the files the player client ships carry no developer comments.
 *
 * Responsibility: owner decision O128. The page's HTML comments (the file header, the note on
 *                 the early theme script) are removed from the built index.html, and the early
 *                 theme script, which the kit's themeInit() writes as it is, header comment
 *                 included, is written again minified without its comments (Vite's own
 *                 minifier, as for the bundle). The sources keep their comments; `vite dev`
 *                 serves them unchanged.
 * Depends on:     vite, node:fs, node:path
 * Used by:        ./vite.config.ts
 * Spec:           docs/security-pass.md (2026-11-22, ZAP 10027); docs/spec/10-repository-structure.md §3
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { minifySync, type Plugin } from 'vite';

// Every HTML comment; the pages hold none inside a script or a style.
const HTML_COMMENT = /\s*<!--[\s\S]*?-->/g;

// The scripts the page loads as they are written (index.html): the kit's early theme script.
const EARLY_SCRIPTS = ['theme-init.js'] as const;

// The page without its comments, removed until none is left (one pass could join the parts
// of a nested or broken one into a new one).
function withoutComments(html: string): string {
  let out = html;
  for (let before = ''; before !== out;) {
    before = out;
    out = out.replace(HTML_COMMENT, '');
  }
  return out;
}

export function productionFiles(): Plugin {
  return {
    name: 'smg-production-files',
    apply: 'build',
    transformIndexHtml: { order: 'post', handler: withoutComments },
    // After the output is written, the kit's emitted early script included.
    writeBundle(options) {
      const dir = options.dir ?? 'dist';
      for (const name of EARLY_SCRIPTS) {
        const file = join(dir, name);
        const result = minifySync(name, readFileSync(file, 'utf8'), {
          compress: true,
          mangle: false,
        });
        if (result.errors.length > 0)
          throw new Error(`${name}: ${result.errors[0]?.message ?? 'minify failed'}`);
        writeFileSync(file, result.code);
      }
    },
  };
}
