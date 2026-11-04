/**
 * @file   e2e/bombDefusal.spec.ts
 * @module e2e
 * @brief  Journey 21: Seasonal Bomb Defusal through the lobby, shared and individual, with its specials.
 *
 * Responsibility: a shared spring round from the Quick Test form through the lobby: the intro
 *                 names the bomb, Spring's free hint names the first cut, whose colour stands
 *                 locked in slot 1 (O60); tapping wires builds the rest, Undo takes the last one
 *                 back and Clear empties it, the hint staying; a shared summer round: a cut,
 *                 and if its first wire was right one with another first wire, so a wrong
 *                 first cut is made: the row says "Boom!", and the cooldown ring counts the
 *                 round's cooldown plus the explosion's 5 s (O40); an individual autumn round: a wire
 *                 is marked harmless (its button "red, harmless", from the round's state: a fall
 *                 before the page loaded has no live row). Each round view fits 1280 × 720 and
 *                 390 × 844. The
 *                 matches are aborted.
 * Depends on:     @playwright/test, ./guessGames, ./play
 * Spec:           docs/spec/09-testing-strategy.md §4 (journey 21); docs/spec/02c-game-bomb-defusal.md
 */
import { expect, test, type Page } from '@playwright/test';

import { direct, fitsBoth, fromLobby, WIDE } from './guessGames.js';
import { abortMatch, closeAll, ownRows, person, roundOpen } from './play.js';

const WIRES = ['red', 'blue', 'yellow', 'green', 'white', 'black', 'orange', 'purple'];

const tap = (page: Page, wire: string) => page.getByTestId(`wire-${wire}`).click();

// A shared summer round with eight wires and six cuts: no hint, and the bot is no quick winner.
const SUMMER = { mode: 'shared', season: 'summer', settings: { 'bomb.wires': 8, 'bomb.cuts': 6 } };

// Cuts six wires in palette order; if the first was right, cuts again with another first wire,
// which then is wrong: the row says "Boom!".
async function wrongFirstCut(page: Page): Promise<void> {
  const cut = async (order: readonly string[]) => {
    for (const w of order) await tap(page, w);
    // Enabled once the sequence is full and the cooldown is over.
    await expect(page.getByTestId('cut-button')).toBeEnabled({ timeout: 10_000 });
    await page.getByTestId('cut-button').click();
    const answer = ownRows(page).first().locator('.round-answer');
    await expect(answer).not.toHaveText('', { timeout: 10_000 });
    return (await answer.textContent()) ?? '';
  };
  const order = WIRES.slice(0, 6);
  if ((await cut(order)).includes('Boom!')) return;
  await cut([order[1] ?? '', order[0] ?? '', ...order.slice(2)]);
  await expect(ownRows(page).first().locator('.round-answer')).toContainText('Boom!');
}

test('journey 21: Seasonal Bomb Defusal, shared through the lobby and individual', async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const p = await person(browser, 'player-1', WIDE);
  const codes: string[] = [];
  try {
    // Eight wires, six cuts: after Spring's hint 2,520 orders are left, so the bot does not
    // defuse the bomb with its first cut (it did with 6 wires and 4 cuts, 60 orders, in CI).
    codes.push(await fromLobby(p, 'bomb-defusal', 'spring', { Wires: '8', Cuts: '6' }));
    await expect(p.page.getByTestId('intro-secret')).toHaveText('Shared bomb: 8 wires, 6 cuts');
    await roundOpen(p.page);
    const hint = await p.page.getByTestId('hint').textContent();
    const first = WIRES.find((w) => hint?.includes(w)) ?? '';
    expect(first, 'the hint names a wire').not.toBe('');
    // The hint's colour stands locked in slot 1 (O60). Build, take back, clear: it stays.
    const slots = p.page.getByTestId('slots');
    await expect(p.page.getByLabel(`hint: ${first} in place 1`)).toBeVisible();
    const [one = '', two = ''] = WIRES.filter((w) => w !== first);
    await tap(p.page, one);
    await tap(p.page, two);
    await p.page.getByRole('button', { name: 'Undo' }).click();
    await expect(slots).not.toContainText(two);
    await p.page.getByRole('button', { name: 'Clear' }).click();
    await expect(slots).not.toContainText(one);
    await expect(slots).toContainText(first);
    await fitsBoth(p.page);

    codes.push((await direct(p, { ...SUMMER, gameId: 'bomb-defusal' })).matchCode);
    await wrongFirstCut(p.page);
    // The round's cooldown of 3 s plus the explosion's 5 s.
    const left = Number(
      /\d+/.exec((await p.page.getByTestId('cooldown').textContent()) ?? '')?.[0],
    );
    expect(left).toBeGreaterThan(3);
    await fitsBoth(p.page);

    // Individual, autumn: a wire is marked harmless.
    const started = await direct(p, {
      gameId: 'bomb-defusal',
      mode: 'individual',
      season: 'autumn',
      // Eight wires and three cuts: two sequences leave at least two wires outside both, so
      // Leaf Fall has wires to mark (O42 counts only wires outside every sequence).
      settings: { 'bomb.wires': 8, 'bomb.cuts': 3 },
    });
    codes.push(started.matchCode);
    // From the round's state, not the live row: a fall before the page had loaded would never
    // show its row (CI, night 6).
    await expect(p.page.getByRole('button', { name: /^\w+, harmless$/ }).first()).toBeVisible({
      timeout: 30_000,
    });
    await fitsBoth(p.page);
  } finally {
    for (const code of codes) await abortMatch(p, code);
    await closeAll([p]);
  }
});
