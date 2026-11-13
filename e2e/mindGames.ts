/**
 * @file   e2e/mindGames.ts
 * @module e2e
 * @brief  Helpers of the Seasonal Mind Games journeys (38–41): a Quick Test from the lobby,
 *         pre-picks, the feed's head and the round's ids.
 *
 * Responsibility: the Quick Test form for Mind Games with seed `acorn` and the game's fields by
 *                 label, 7 bots by default, from the lobby, a 3 s countdown; the viewer's own
 *                 pre-picks in the waiting area, saved before the host starts; the round's id
 *                 from the match; a guess through the HTTP fallback.
 * Depends on:     @playwright/test, ./play
 * Used by:        ./mindGames.spec, ./mindGamesSeries.spec, ./mindGamesPrePicks.spec,
 *                 ./mindGamesDelay.spec
 * Spec:           docs/spec/09-testing-strategy.md §4 (journeys 38–41), §4.2
 */
import { expect, type Page } from '@playwright/test';

import { attempt, call, hostMenu, playerRow, type Person } from './play.js';

export interface MindQuick {
  // The game's own fields by label ("Total length": "60").
  readonly fields: Readonly<Record<string, string>>;
  readonly bots?: number;
  // The viewer's pre-picks by round number, set in the waiting area before the start.
  readonly picks?: Readonly<Record<number, string>>;
}

// The Quick Test form filled for Mind Games and started from the lobby; the match code.
export async function mindQuickTest(p: Person, q: MindQuick): Promise<string> {
  await p.page.goto('./#/quick-test');
  const form = p.page.getByTestId('quick-test');
  await form.getByTestId('quick-game').selectOption('mind-games');
  await expect(form.getByTestId('quick-lobby')).toBeChecked();
  await form.getByTestId('seed').fill('acorn');
  await form.getByLabel('Bots').fill(String(q.bots ?? 7));
  await form.getByLabel('Countdown before opening', { exact: true }).fill('3');
  for (const [label, value] of Object.entries(q.fields)) {
    // A select's accessible name also holds its options' text: it is found by label alone.
    const exact = form.getByLabel(label, { exact: true });
    if ((await exact.count()) === 0) {
      await form.getByLabel(label).and(form.locator('select')).selectOption(value);
    } else if ((await exact.getAttribute('type')) === 'checkbox') {
      await exact.setChecked(value === 'on');
    } else await exact.fill(value);
  }
  await form.getByTestId('start-quick-test').click();
  await expect(p.page.getByTestId('waiting-area')).toBeVisible();
  await expect(playerRow(p, 'bot-01')).toBeVisible({ timeout: 10_000 });
  await prePick(p.page, q.picks ?? {});
  return /#\/match\/(\w+)/.exec(p.page.url())?.[1] ?? '';
}

// The viewer's pre-picks in the waiting area's panel, saved (2.1 s after the last change).
export async function prePick(page: Page, picks: Readonly<Record<number, string>>): Promise<void> {
  const panel = page.locator('.mg-prefs');
  for (const [round, choice] of Object.entries(picks)) {
    await panel.getByLabel(`Round ${round}`, { exact: false }).selectOption(choice);
  }
  if (Object.keys(picks).length > 0) {
    await expect(panel.getByRole('status')).toHaveText('Saved.', { timeout: 8_000 });
  }
}

// The host starts the next round from the Host menu.
export async function startRound(host: Person): Promise<void> {
  await hostMenu(host);
  await host.page.getByTestId('host-console').getByTestId('start-round').click();
  await expect(host.page.getByTestId('round-intro')).toBeVisible();
}

export const feedHead = (page: Page) => page.getByTestId('feed-head');

// The match's running round.
export async function roundIdOf(p: Person, code: string): Promise<string> {
  const m = await call<{ round: { id: string } | null }>(p, 'GET', `/matches/${code}`);
  return m.round?.id ?? '';
}

// A row's player: "you" for the viewer, else the name as shown.
const who = (text: string) =>
  /\(you\)|^You\b/.test(text) ? 'you' : text.replace(/\s*\+\d+$/, '').trim();

// The points by player of the result's option cards (no "+N" is 0), of its placings table
// (every row, its last cell) and of the match standings (their third cell) (T340).
export async function resultPoints(page: Page) {
  const cards: Record<string, number> = {};
  for (const li of await page.locator('[data-testid="mind-result"] .mg-option-players li').all()) {
    const text = (await li.innerText()).trim();
    cards[who(text)] = Number(/\+(\d+)$/.exec(text)?.[1] ?? 0);
  }
  const more = page.getByTestId('all-placings');
  if ((await more.count()) > 0 && (await more.getAttribute('aria-expanded')) === 'false')
    await more.click();
  const rows = async (table: string, cell: string) => {
    const out: Record<string, number> = {};
    for (const tr of await page.locator(`[data-testid="${table}"] tbody tr`).all()) {
      const name = await tr.locator('.round-player').innerText();
      out[who(name)] = Number(await tr.locator(cell).innerText());
    }
    return out;
  };
  return {
    cards,
    table: await rows('placings', 'td:last-child'),
    standings: await rows('match-standings', 'td:nth-child(3)'),
  };
}

// A choice sent through the HTTP fallback, whatever its answer.
export const guessHttp = (p: Person, roundId: string, choice: string) =>
  attempt(p, 'POST', `/rounds/${roundId}/guesses`, { value: { choice, hide: false } });
