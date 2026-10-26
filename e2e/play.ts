/**
 * @file   e2e/play.ts
 * @module e2e
 * @brief  People, matches and rounds for the journeys: one browser context per person.
 *
 * Responsibility: a person is a browser context signed in with the development sign-in (or a
 *                 guest session) and its page; `call` reaches the API as that person with the
 *                 CSRF header; a host opens a match the players join and watch; the host's form
 *                 creates a round; `search` plays a player's round from the screen only — the
 *                 middle of the band the server sent, until the round ends or the player
 *                 solved — exactly as a person reading the screen would. Matches are aborted at
 *                 the end, never deleted (CLAUDE.md).
 * Depends on:     @playwright/test, ./devStack, ./screens
 * Used by:        ./rounds.spec, ./specials.spec, ./players.spec, ./access.spec
 * Spec:           docs/spec/09-testing-strategy.md §4; docs/spec/02-game-guess-the-number.md §12
 */
import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

import { CLIENT_URL } from './devStack.js';
import { DESKTOP } from './screens.js';

export type Who = 'host' | 'admin' | 'player-1' | 'player-2' | 'player-3' | 'guest';

export interface Person {
  readonly who: Who;
  readonly ctx: BrowserContext;
  readonly page: Page;
}

export async function person(browser: Browser, who: Who, viewport = DESKTOP): Promise<Person> {
  const ctx = await browser.newContext({ baseURL: `${CLIENT_URL}/`, viewport });
  const r =
    who === 'guest'
      ? await ctx.request.post('api/v1/auth/guest', { data: {} })
      : await ctx.request.post('api/v1/dev/sign-in', { data: { as: who } });
  expect(r.ok(), `${who} signed in`).toBe(true);
  const page = await ctx.newPage();
  await page.goto('./');
  return { who, ctx, page };
}

export async function call<T>(
  p: Person,
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  data?: unknown,
): Promise<T> {
  const session = (await (await p.ctx.request.get('api/v1/session')).json()) as {
    csrfToken: string | null;
  };
  const r = await p.ctx.request.fetch(`api/v1${path}`, {
    method,
    headers: { 'x-csrf-token': session.csrfToken ?? '' },
    ...(data === undefined ? {} : { data }),
  });
  expect(r.status(), `${method} ${path}`).toBeLessThan(400);
  return (r.status() === 204 ? undefined : await r.json()) as T;
}

export async function visit(p: Person, code: string): Promise<void> {
  await p.page.goto(`./#/match/${code}`);
  await expect(p.page.getByTestId('match')).toBeVisible();
}

// A host's match with the players joined, every page on the match.
export async function openMatch(
  host: Person,
  players: readonly Person[],
  title = 'e2e',
): Promise<string> {
  const m = await call<{ code: string }>(host, 'POST', '/matches', {
    gameId: 'guess-the-number',
    title,
    maxPlayers: 10,
  });
  for (const p of players) await call(p, 'POST', `/matches/${m.code}/join`, {});
  for (const p of [host, ...players]) await visit(p, m.code);
  // Players count for the roster once their page watches the match (02 §4): wait for it.
  for (const p of players) {
    const name = p.who === 'admin' ? 'dev-admin' : `dev-${p.who}`;
    await expect(host.page.getByTestId('match-players')).toContainText(`${name} here`);
  }
  return m.code;
}

// The host fills the round form by the fields' labels and creates (and starts) the round.
export async function hostRound(
  host: Person,
  fields: Readonly<Record<string, string>>,
  start = true,
): Promise<void> {
  const form = host.page.getByTestId('round-form');
  for (const [label, value] of Object.entries(fields)) {
    // Not exact: a select's accessible name also holds its options' text.
    const field = form.getByLabel(label);
    if ((await field.evaluate((el) => el.tagName)) === 'SELECT') await field.selectOption(value);
    else await field.fill(value);
  }
  if (start) await form.getByTestId('create-start').click();
  else await form.getByRole('button', { name: 'Create round' }).click();
  await expect(host.page.getByTestId('round-banner')).toBeVisible();
}

// The band the server sent, read from the range bar ("Between 51 and 100" or "1 to 100").
async function band(page: Page): Promise<{ low: number; high: number }> {
  const text =
    (await page
      .getByTestId('band')
      .textContent({ timeout: 3_000 })
      .catch(() => '')) ?? '';
  const [low, high] = [...text.matchAll(/\d+/g)].map((m) => Number(m[0]));
  return { low: low ?? 1, high: high ?? low ?? 1 };
}

// Plays from the screen until the round ends or this player solved; returns the guesses made.
export async function search(p: Person, deadline = 120_000): Promise<number> {
  const page = p.page;
  const button = page.getByTestId('guess-button');
  const end = Date.now() + deadline;
  let guesses = 0;
  while (Date.now() < end) {
    if (await page.getByTestId('result').isVisible()) return guesses;
    // Every read is bounded: the round can end between two reads and take the list away.
    // The bounds leave room for a slow browser on a busy machine.
    const own = await page
      .getByTestId('own-guesses')
      .textContent({ timeout: 3_000 })
      .catch(() => '');
    const solved = own?.includes('is the number!') ?? false;
    if (solved) return guesses;
    if (await button.isEnabled({ timeout: 3_000 }).catch(() => false)) {
      const b = await band(page);
      // The round may end between the check and the click: a short wait, then look again.
      const filled = await page
        .getByTestId('guess-input')
        .fill(String(Math.floor((b.low + b.high) / 2)), { timeout: 10_000 })
        .then(() => button.click({ timeout: 10_000 }))
        .then(() => true)
        .catch(() => false);
      if (filled) guesses += 1;
    }
    await page.waitForTimeout(250);
  }
  const seen = (await page.getByTestId('match').textContent())?.slice(0, 600) ?? '';
  throw new Error(`${p.who} did not finish in time; the page shows: ${seen}`);
}

export async function closeAll(people: readonly Person[]): Promise<void> {
  for (const p of people) await p.ctx.close();
}

// Teardown: the host aborts the match (never deleted: the event log is append-only).
export async function abortMatch(host: Person, code: string): Promise<void> {
  await call(host, 'POST', `/matches/${code}/abort`, { reason: 'e2e done' });
}
