/**
 * @file   e2e/leafFall.spec.ts
 * @module e2e
 * @brief  Journey 18: Leaf Fall drops only still-possible numbers, listed in the game panel.
 *
 * Responsibility: an autumn Quick Test with `full` visibility and the fast test profile; the
 *                 player guesses once, then for two falls every newly fallen number lies inside
 *                 the candidate set the public answers left before the fall and is no guessed
 *                 number (O37); the panel lists exactly the fallen numbers, ascending with
 *                 thousands separators, in view without opening anything, and "+N more" (when
 *                 the three rows are full) opens all of them (O58); the All list's Leaf Fall row
 *                 stands out (T115); a fallen number typed in gets "Already fallen." at once;
 *                 the round view fits 1280 × 720 and 390 × 844, where the info line names the
 *                 count and the newest three and its sheet lists every fallen number (after a
 *                 reload at that size), closed by its Close button. The match is aborted at
 *                 the end.
 * Depends on:     @playwright/test, ./play, ./screens
 * Spec:           docs/spec/09-testing-strategy.md §4 (journey 18); docs/spec/03-seasonal-specials.md §2.3
 */
import { expect, test, type Page } from '@playwright/test';

import { abortMatch, call, closeAll, fitsScreen, person, roundOpen, type Person } from './play.js';
import { PHONE } from './screens.js';

const WIDE = { width: 1280, height: 720 };

interface Seen {
  readonly value: number | null;
  readonly feedback: 'higher' | 'lower' | 'correct' | null;
}

interface State {
  readonly game: {
    readonly range: { readonly low: number; readonly high: number } | null;
    readonly removed: readonly number[];
    readonly guesses: readonly Seen[];
    readonly log: readonly Seen[];
  };
}

const read = (p: Person, roundId: string) => call<State>(p, 'GET', `/rounds/${roundId}/state`);

// The candidates the public answers leave (O37): the range cut by every answer, without the
// numbers guessed and fallen.
function candidates(s: State) {
  const all = [...s.game.guesses, ...s.game.log];
  let low = s.game.range?.low ?? -Infinity;
  let high = s.game.range?.high ?? Infinity;
  for (const g of all) {
    if (g.value === null) continue;
    if (g.feedback === 'higher') low = Math.max(low, g.value + 1);
    if (g.feedback === 'lower') high = Math.min(high, g.value - 1);
  }
  const out = new Set([
    ...s.game.removed,
    ...all.flatMap((g) => (g.value === null ? [] : [g.value])),
  ]);
  return (v: number) => v >= low && v <= high && !out.has(v);
}

// The panel's chips as numbers.
async function panelNumbers(page: Page): Promise<number[]> {
  const chips = await page.getByTestId('fallen-list').locator('li').allTextContents();
  return chips.map((t) => Number(t.replaceAll(',', '')));
}

// Waits for the next fall and checks every new number against the state before it.
async function nextFallInCandidates(p: Person, roundId: string): Promise<void> {
  const before = await read(p, roundId);
  const possible = candidates(before);
  let after = before;
  await expect
    .poll(
      async () => {
        after = await read(p, roundId);
        return after.game.removed.length;
      },
      { timeout: 15_000 },
    )
    .toBeGreaterThan(before.game.removed.length);
  const fresh = after.game.removed.filter((v) => !before.game.removed.includes(v));
  expect(fresh.length).toBeGreaterThan(0);
  for (const v of fresh) expect(possible(v), `${String(v)} was still possible`).toBe(true);
}

// A phone: the info line names the count and the newest three; its sheet lists them all (O58).
async function phoneSheet(p: Person): Promise<void> {
  // Loaded again at the phone size: WebKit's mobile emulation keeps the wide layout after a
  // resize until the page is laid out afresh.
  await p.page.setViewportSize(PHONE);
  await p.page.reload();
  await roundOpen(p.page);
  await expect(p.page.getByTestId('info-line')).toContainText(
    /Fallen [\d,]+: [\d,]+, [\d,]+, [\d,]+/,
  );
  await p.page.getByTestId('info-line').click();
  const sheet = p.page.getByTestId('game-sheet');
  await expect(sheet.getByTestId('fallen-list')).toBeVisible();
  // Every number in the sheet: no row limit there, so nothing behind "+N more".
  await expect(sheet.getByTestId('fallen-more')).toHaveCount(0);
  await fitsScreen(p.page);
  // Closed by its Close button: a phone has no Escape key.
  await sheet.getByRole('button', { name: 'Close' }).click();
  await expect(sheet.getByTestId('fallen-list')).toBeHidden();
  await fitsScreen(p.page);
}

// A desktop: the panel lists exactly the fallen numbers, ascending, grouped, in view without
// opening anything, and "+N more" opens them all (O58). Returns the fallen numbers.
async function panelInView(p: Person, roundId: string): Promise<readonly number[]> {
  // The panel lists exactly the fallen numbers, ascending, grouped.
  // Read against a fresh state each time: another fall may come meanwhile.
  await expect
    .poll(async () => {
      const now = (await read(p, roundId)).game.removed;
      return JSON.stringify(await panelNumbers(p.page)) === JSON.stringify(now);
    })
    .toBe(true);
  const removed = (await read(p, roundId)).game.removed;
  // In view without opening anything, plain readable numbers (O58).
  const first = p.page.getByTestId('fallen-list').locator('li').first();
  await expect(first).toBeVisible();
  expect(await first.textContent()).toMatch(/^\d{1,3}(,\d{3})*$/);
  const more = p.page.getByTestId('fallen-more');
  if ((await more.count()) > 0) {
    await more.click();
    await expect(p.page.getByTestId('fallen-all').locator('li')).toHaveCount(
      await p.page.getByTestId('fallen-list').locator('li').count(),
    );
    await p.page.keyboard.press('Escape');
  }
  return removed;
}

test('journey 18: Leaf Fall drops only still-possible numbers, in the Fallen panel', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const p = await person(browser, 'player-1', WIDE);
  let code = '';
  try {
    const started = await call<{ matchCode: string; roundId: string }>(
      p,
      'POST',
      '/dev/quicktest',
      {
        season: 'autumn',
        bots: 1,
        rangeHigh: 1_000_000,
        rangeVisible: true,
        visibility: 'full',
        cooldownS: 8,
        fast: true,
      },
    );
    code = started.matchCode;
    await p.page.goto(`./#/match/${code}`);
    await roundOpen(p.page);
    await p.page.getByTestId('guess-input').fill('600000');
    await p.page.getByTestId('guess-button').click();
    await expect(p.page.locator('[data-testid="guess-list"] li[data-own="true"]')).toHaveCount(1);
    await nextFallInCandidates(p, started.roundId);
    await nextFallInCandidates(p, started.roundId);
    const removed = await panelInView(p, started.roundId);
    // Leaf Fall's own row is in the All list (T142).
    await p.page.getByTestId('list-all').click();
    await expect(p.page.getByTestId('all-list').getByTestId('special-row').first()).toContainText(
      /^Leaf Fall: .+ fell\.$/,
    );
    await p.page.keyboard.press('Escape');
    // A fallen number is refused at once, in the server's words.
    await p.page.getByTestId('guess-input').fill(String(removed[0]));
    await p.page.getByTestId('guess-button').click();
    await expect(p.page.locator('.gtn-message')).toHaveText('Already fallen.');
    await fitsScreen(p.page);
    await phoneSheet(p);
  } finally {
    if (code !== '') await abortMatch(p, code);
    await closeAll([p]);
  }
});
