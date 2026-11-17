/**
 * @file   e2e/mindGamesLastMove.spec.ts
 * @module e2e
 * @brief  Journey 46: the last switch the server accepts shows before the result screen.
 *
 * Responsibility: 09 §4 journey 46 (the owner's decisions of 2026-11-17, DECISIONS T380): in a
 *                 Quick Test round (total 30 s: choices close at 23 s, the result at 30 s) the
 *                 player switches between Winter and Summer every 0.26 s until the server
 *                 refuses; a page observer records every change of the stage's counts and own
 *                 feed line, every flight and the result. Before the result screen the stage
 *                 shows the last accepted switch as the player's newest line, with counts equal
 *                 to the result's, and that switch's coin has landed (or appeared) by the time
 *                 the result shows. Whether the last feed frame came between the release ticks
 *                 (released at its own time near the end) is logged: that is the case the end
 *                 used to swallow.
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
  result: { t: number; counts: string } | null;
}

// Records the stage's counts and own newest line at each change, each flight, and the result.
function observe(): void {
  const w: Watch = { seen: [], flights: [], result: null };
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

// The stage just before the result against the result, the last switch's line and coin.
function judge(w: Watch, last: string): void {
  const result = w.result ?? { t: 0, counts: '' };
  const before = w.seen.filter((s) => s.t < result.t);
  const shown = before.at(-1);
  expect(shown?.own, 'the newest own line is the last switch').toMatch(
    new RegExp(`switched \\w+ → ${last}$`),
  );
  expect(shown?.counts, 'the stage counts as the result').toBe(result.counts);
  const coin = w.flights.filter((f) => f.to === last.toLowerCase()).at(-1);
  expect(coin, 'the last switch flies').toBeDefined();
  expect((coin?.t ?? 0) + (coin?.fly ?? 0), 'it lands by the result').toBeLessThanOrEqual(
    result.t + 50,
  );
  const lineAt = before.find((s) => s.own === shown?.own)?.t ?? 0;
  console.log(
    `last switch ${last}: its line ${String(Math.round(result.t - lineAt))} ms before the result, coin flying ${String(coin?.fly)} ms`,
  );
}

// The arrival times of the room's frames with feed steps: the last one off the earlier
// frames' one-second grid was released at its own time, the case the end used to swallow.
function frameTimes(page: Page): number[] {
  const times: number[] = [];
  page.on('websocket', (ws) => {
    ws.on('framereceived', (f) => {
      if (String(f.payload).includes('"ChoiceFed"')) times.push(Date.now());
    });
  });
  return times;
}

function offTick(times: readonly number[]): boolean {
  const last = times.at(-1) ?? 0;
  const off = times.slice(0, -1).map((t) => (last - t) % 1_000);
  return off.length > 0 && off.every((d) => d > 60 && d < 940);
}

test('journey 46: the last switch the server accepts shows before the result', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const p = await person(browser, 'host', { width: 1440, height: 900 });
  let code = '';
  try {
    const frames = frameTimes(p.page);
    code = await mindQuickTest(p, { fields: { 'Total length': '30', All: 'on' }, bots: 3 });
    await p.page.evaluate(observe);
    await startRound(p);
    await roundOpen(p.page);
    const opened = Date.now();
    await p.page.locator('.mg-choice[data-choice="spring"]').click();
    await p.page.waitForTimeout(21_000 - (Date.now() - opened));
    const last = await switchToTheEnd(p.page);
    await expect(p.page.getByTestId('mind-result')).toBeVisible({ timeout: 20_000 });
    console.log(`the last feed step released between the ticks: ${String(offTick(frames))}`);
    judge(await p.page.evaluate(() => (window as unknown as { __last: Watch }).__last), last);
  } finally {
    if (code !== '') await abortMatch(p, code);
    await closeAll([p]);
  }
});
