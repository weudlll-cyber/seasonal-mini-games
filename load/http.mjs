/**
 * @file   load/http.mjs
 * @module load
 * @brief  HTTP helpers of the load check: development sign-in, API calls, paced groups.
 *
 * Responsibility: sign in a development account (`host`, `admin`, `load-NNNN`) and return its
 *                 cookie, CSRF token and account id; call the API as that account; run work in
 *                 groups with an optional pause; count HTTP problems with a few examples.
 *                 Adapted from Bingo's load/drawLatency.mjs.
 * Depends on:     nothing (Node's fetch)
 * Used by:        ./guessStorm
 * Spec:           docs/spec/09-testing-strategy.md §5
 */

export const BASE = 'http://127.0.0.1:3910';
export const ORIGIN = 'http://localhost:5410';

export const problems = { http: 0, socket: 0, examples: [] };
export function fail(kind, detail) {
  problems[kind] += 1;
  if (problems.examples.length < 10) problems.examples.push(`${kind}: ${detail}`);
}

export async function signIn(as) {
  const r = await fetch(`${BASE}/api/v1/dev/sign-in`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN },
    body: JSON.stringify({ as }),
  });
  if (!r.ok) fail('http', `sign-in ${as} → ${String(r.status)}`);
  const cookie = (r.headers.get('set-cookie') ?? '').split(';')[0];
  const { accountId } = await r.json();
  const session = await (await fetch(`${BASE}/api/v1/session`, { headers: { cookie } })).json();
  return { as, cookie, csrf: session.csrfToken, id: accountId };
}

export async function call(client, method, path, body) {
  const r = await fetch(`${BASE}/api/v1${path}`, {
    method,
    headers: {
      cookie: client.cookie,
      origin: ORIGIN,
      'x-csrf-token': client.csrf,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const answer = r.status === 204 ? null : await r.json().catch(() => null);
  if (!r.ok) fail('http', `${method} ${path} → ${String(r.status)} ${JSON.stringify(answer)}`);
  return answer;
}

// In groups, so a thousand sign-ins do not open a thousand requests at once; `pauseMs`
// between groups keeps sign-ins (no session yet) under the per-address limit of 600 a minute.
export async function inGroups(items, size, work, pauseMs = 0) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(work))));
    if (pauseMs > 0) await new Promise((r) => setTimeout(r, pauseMs));
  }
  return out;
}
