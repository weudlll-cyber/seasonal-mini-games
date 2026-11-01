/**
 * @file   e2e/bombDefusal.spec.ts
 * @module e2e
 * @brief  Journey 21: Seasonal Bomb Defusal through the lobby, shared and individual, with its specials.
 *
 * Responsibility: a shared spring round from the Quick Test form through the lobby: the intro
 *                 names the bomb, Spring's free hint names the first cut; tapping wires builds
 *                 the sequence, Undo takes the last one back and Clear empties it; a sequence
 *                 that does not start with the hinted wire is cut: the explosion shows, the row
 *                 says "Boom!", and the cooldown ring counts the round's cooldown plus the
 *                 explosion's 5 s (O40); then an individual autumn round started at once: a wire
 *                 is marked harmless. Each round view fits 1280 × 720 and 390 × 844. The
 *                 matches are aborted.
 * Depends on:     @playwright/test, ./guessGames, ./play
 * Spec:           docs/spec/09-testing-strategy.md §4 (journey 21); docs/spec/02c-game-bomb-defusal.md
 */
import { expect, test, type Page } from '@playwright/test';

import { direct, fitsBoth, fromLobby, WIDE } from './guessGames.js';
import { abortMatch, closeAll, ownRows, person, roundOpen } from './play.js';

const WIRES = ['red', 'blue', 'yellow', 'green', 'white', 'black'];

const tap = (page: Page, wire: string) => page.getByTestId(`wire-${wire}`).click();

test('journey 21: Seasonal Bomb Defusal, shared through the lobby and individual', async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const p = await person(browser, 'player-1', WIDE);
  const codes: string[] = [];
  try {
    codes.push(await fromLobby(p, 'bomb-defusal', 'spring'));
    await expect(p.page.getByTestId('intro-secret')).toHaveText('Shared bomb: 6 wires, 4 cuts');
    await roundOpen(p.page);
    const hint = await p.page.getByTestId('hint').textContent();
    const first = WIRES.find((w) => hint?.includes(w)) ?? '';
    expect(first, 'the hint names a wire').not.toBe('');
    // Build, take back, clear.
    const slots = p.page.getByTestId('slots');
    await tap(p.page, 'red');
    await tap(p.page, 'blue');
    await p.page.getByRole('button', { name: 'Undo' }).click();
    await expect(slots).not.toContainText('blue');
    await p.page.getByRole('button', { name: 'Clear' }).click();
    await expect(slots).not.toContainText('red');
    // A wrong first cut: four wires, none of them the hinted first one first.
    const order = WIRES.filter((w) => w !== first).slice(0, 4);
    for (const w of order) await tap(p.page, w);
    await p.page.getByTestId('cut-button').click();
    await expect(ownRows(p.page).first().locator('.round-answer')).toContainText('Boom!', {
      timeout: 10_000,
    });
    // The form's cooldown of 5 s plus the explosion's 5 s.
    const left = Number(
      /\d+/.exec((await p.page.getByTestId('cooldown').textContent()) ?? '')?.[0],
    );
    expect(left).toBeGreaterThan(5);
    await fitsBoth(p.page);

    // Individual, autumn: a wire is marked harmless.
    const started = await direct(p, {
      gameId: 'bomb-defusal',
      mode: 'individual',
      season: 'autumn',
    });
    codes.push(started.matchCode);
    await expect(p.page.getByTestId('special-row').first()).toHaveText(
      /^Leaf Fall: the \w+ wire is harmless\.$|^Leaf Fall: every harmless wire is marked\.$/,
      { timeout: 20_000 },
    );
    await fitsBoth(p.page);
  } finally {
    for (const code of codes) await abortMatch(p, code);
    await closeAll([p]);
  }
});
