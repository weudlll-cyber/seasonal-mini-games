/**
 * @file   e2e/mindGamesLastMove.spec.ts
 * @module e2e
 * @brief  Journey 46: the last switch the server accepts stands on the stage for the hold.
 *
 * Responsibility: 09 §4 journey 46 (the owner's decisions of 2026-11-17 and 2026-11-18, DECISIONS
 *                 T380, T384): in a Quick Test round (total 30 s: choices close at 23 s, the
 *                 plan ends at 30 s, the result follows the default hold of 5 s later) the
 *                 player switches between Winter and Summer every 0.26 s until the server
 *                 refuses; a page observer records every change of the stage's counts and own
 *                 feed line, every flight, when the status line starts saying "Choices closed ·
 *                 result in", and the result. The stage stands through the hold (the result
 *                 comes 4–6.5 s after that line), and before the result it shows the last
 *                 accepted switch as the player's newest line, for at least 3 s of the hold,
 *                 with counts equal to the result's; that switch's coin flies in full
 *                 (1.6 s) and lands before the result.
 * Depends on:     @playwright/test, ./mindGames, ./play
 * Spec:           docs/spec/09-testing-strategy.md §4 (journey 46); docs/spec/02e-game-mind-games.md §11.1
 */
import { expect, test, type Page } from '@playwright/test';

import { mindQuickTest, startRound } from './mindGames.js';
import { abortMatch, closeAll, person, roundOpen } from './play.js';

interface Seen {
  readonly t: number;
  readonly counts: string;
  readonly own: string;
}
interface Watch {
  readonly seen: Seen[];
  readonly flights: { t: number; from: string; to: string; fly: number }[];
  // When the status line first said the hold ("Choices closed · result in …").
  hold: number | null;
  result: { t: number; counts: string } | null;
}

// Records the stage's counts and own newest line at each change, each flight, the hold's
// status line, and the result.
function observe(): void {
  const w: Watch = { seen: [], flights: [], hold: null, result: null };
  (window as unknown as { __last: Watch }).__last = w;
  const countsOf = (sel: string, n: string) =>
    [...document.querySelectorAll<HTMLElement>(sel)]
      .map((e) => `${e.dataset['choice'] ?? ''} ${e.querySelector(n)?.textContent ?? ''}`)
      .join(', ');
  const flightsIn = (records: readonly MutationRecord[], t: number) => {
    for (const r of records)
      for (const n of r.addedNodes)
        if (n instanceof HTMLElement && n.classList.contains('mg-flight'))
          w.flights.push({
            t,
            from: n.dataset['from'] ?? '',
            to: n.dataset['to'] ?? '',
            fly: parseFloat(n.style.getPropertyValue('--mg-fly')),
          });
  };
  const stage = (t: number) => {
    const counts = countsOf('.mg-count[data-choice]', '.mg-count-n');
    const own =
      [...document.querySelectorAll('[data-testid="guess-list"] li')]
        .map((li) => li.textContent.replace(/·.*/, '').trim())
        .find((x) => x.startsWith('You')) ?? '';
    const last = w.seen.at(-1);
    if (counts !== '' && (last?.counts !== counts || last.own !== own))
      w.seen.push({ t, counts, own });
    const line = document.querySelector('[data-testid="next-change"]')?.textContent ?? '';
    if (w.hold === null && line.startsWith('Choices closed · result in')) w.hold = t;
  };
  new MutationObserver((records) => {
    const t = performance.now();
    flightsIn(records, t);
    if (w.result !== null) return;
    if (document.querySelector('[data-testid="mind-result"]') === null) stage(t);
    else w.result = { t, counts: countsOf('.mg-option[data-choice]', '.mg-option-count') };
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
}

// Switches Winter/Summer every 0.26 s (under 4 a second) until refused; the last one taken.
async function switchToTheEnd(page: Page): Promise<string> {
  let last = 'Spring';
  for (let k = 0; k < 60; k += 1) {
    const c = k % 2 === 0 ? 'Winter' : 'Summer';
    const radio = page.locator(`.mg-choice[data-choice="${c.toLowerCase()}"]`);
    if (await radio.isDisabled()) break;
    await radio.click({ timeout: 1_000 }).catch(() => undefined);
    const took = await radio
      .and(page.locator('[aria-checked="true"]'))
      .waitFor({ timeout: 600 })
      .then(
        () => true,
        () => false,
      );
    if (!took) break;
    last = c;
  }
  return last;
}

// The hold against the result, and the stage just before the result: the last switch's line,
// how long it stood, the counts and the coin.
function judge(w: Watch, last: string): void {
  const result = w.result ?? { t: 0, counts: '' };
  const held = result.t - (w.hold ?? result.t);
  expect(w.hold, 'the status line says the hold').not.toBeNull();
  expect(held, 'the stage stands for the hold of 5 s').toBeGreaterThanOrEqual(4_000);
  expect(held, 'the stage stands for the hold of 5 s').toBeLessThanOrEqual(6_500);
  const before = w.seen.filter((s) => s.t < result.t);
  const shown = before.at(-1);
  expect(shown?.own, 'the newest own line is the last switch').toMatch(
    new RegExp(`switched \\w+ → ${last}$`),
  );
  expect(shown?.counts, 'the stage counts as the result').toBe(result.counts);
  const lineAt = before.find((s) => s.own === shown?.own)?.t ?? result.t;
  expect(result.t - lineAt, 'the last switch stands for most of the hold').toBeGreaterThanOrEqual(
    3_000,
  );
  const coin = w.flights.filter((f) => f.to === last.toLowerCase()).at(-1);
  expect(coin?.fly, 'the last switch flies in full').toBe(1_600);
  expect((coin?.t ?? 0) + (coin?.fly ?? 0), 'it lands before the result').toBeLessThan(result.t);
  console.log(
    `last switch ${last}: its line ${String(Math.round(result.t - lineAt))} ms before the result, the hold line ${String(Math.round(held))} ms`,
  );
}

test('journey 46: the last switch the server accepts stands for the hold before the result', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const p = await person(browser, 'host', { width: 1440, height: 900 });
  let code = '';
  try {
    const fields = { 'Total length': '30', 'Hold before the result': '5', All: 'on' };
    code = await mindQuickTest(p, { fields, bots: 3 });
    await p.page.evaluate(observe);
    await startRound(p);
    await roundOpen(p.page);
    const opened = Date.now();
    await p.page.locator('.mg-choice[data-choice="spring"]').click();
    await p.page.waitForTimeout(21_000 - (Date.now() - opened));
    const last = await switchToTheEnd(p.page);
    await expect(p.page.getByTestId('mind-result')).toBeVisible({ timeout: 20_000 });
    judge(await p.page.evaluate(() => (window as unknown as { __last: Watch }).__last), last);
  } finally {
    if (code !== '') await abortMatch(p, code);
    await closeAll([p]);
  }
});
