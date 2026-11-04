/**
 * @file   packages/contracts/src/withoutEval.ts
 * @module contracts
 * @brief  In a browser, zod builds no code from strings: the pages' CSP forbids eval.
 *
 * Responsibility: zod 4 probes `new Function('')` when an object schema is created, to decide
 *                 whether it may compile fast parsers; under `script-src 'self'` the probe is a
 *                 CSP violation and, with the admin app's `require-trusted-types-for 'script'`,
 *                 a Trusted Types one (zod catches both, the browser still reports them). The
 *                 schemas of this package are created when it loads, so ./index imports this
 *                 module before any of them. The server (no `document`) keeps the compiled
 *                 parsers.
 * Depends on:     zod
 * Used by:        ./index
 * Spec:           Bingo 03 §7; DECISIONS T178
 */
import { config } from 'zod';

if ('document' in globalThis) config({ jitless: true });
