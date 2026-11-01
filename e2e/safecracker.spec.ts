/**
 * @file   e2e/safecracker.spec.ts
 * @module e2e
 * @brief  Journey 20: Seasonal Safecracker through the lobby, shared and individual, with its specials.
 *
 * Responsibility: a shared spring round from the Quick Test form through the lobby: the intro
 *                 names the code, Spring's revealed digit stays highlighted, the digit boxes
 *                 take a code key by key with the focus moving on, and the own row shows the
 *                 code with its pegs and the counts in words; then an individual autumn round
 *                 started at once: a digit falls ("… is not in the code."), the strip marks it,
 *                 and a code with it is refused at once with "That digit has fallen.". Each
 *                 round view fits 1280 × 720 and 390 × 844. The matches are aborted.
 * Depends on:     @playwright/test, ./guessGames, ./play
 * Spec:           docs/spec/09-testing-strategy.md §4 (journey 20); docs/spec/02b-game-safecracker.md
 */
import { expect, test, type Page } from '@playwright/test';

import { direct, fitsBoth, fromLobby, WIDE } from './guessGames.js';
import { abortMatch, closeAll, ownRows, person, roundOpen } from './play.js';

// Types a code into the boxes, starting at the first; the focus moves on by itself.
async function typeCode(page: Page, code: string): Promise<void> {
  await page.getByTestId('code-box-0').click();
  await page.keyboard.type(code);
}

test('journey 20: Seasonal Safecracker, shared through the lobby and individual', async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const p = await person(browser, 'player-1', WIDE);
  const codes: string[] = [];
  try {
    codes.push(await fromLobby(p, 'safecracker', 'spring'));
    await expect(p.page.getByTestId('intro-secret')).toHaveText('Shared 4-digit code, digits 0–9');
    await roundOpen(p.page);
    await expect(p.page.getByTestId('hint')).toHaveText(/^Free hint: the \w+ digit is \d\.$/);
    await typeCode(p.page, '0123');
    await expect(p.page.getByTestId('code-box-3')).toHaveValue('3');
    await p.page.getByTestId('guess-button').click();
    const own = ownRows(p.page).first();
    await expect(own.locator('.round-value')).toHaveText('0123');
    await expect(own.locator('.round-answer')).toHaveText(
      /\d right place, \d wrong place|correct — the safe is open/,
      { timeout: 10_000 },
    );
    await fitsBoth(p.page);

    // Individual, autumn: a digit falls; a code with it is refused before sending.
    const started = await direct(p, {
      gameId: 'safecracker',
      mode: 'individual',
      season: 'autumn',
    });
    codes.push(started.matchCode);
    const fell = p.page.getByTestId('special-row').first();
    await expect(fell).toHaveText(/^Leaf Fall: \d is not in the code\.$/, { timeout: 20_000 });
    const digit = /(\d)/.exec((await fell.textContent()) ?? '')?.[1] ?? '';
    // The strip marks it once the round's state has caught up with the live row.
    await expect(p.page.getByRole('listitem', { name: `${digit}, fallen` })).toBeVisible();
    await typeCode(p.page, `${digit}${digit}${digit}${digit}`);
    await expect(p.page.locator('.sc-message')).toHaveText('That digit has fallen.');
    await fitsBoth(p.page);
  } finally {
    for (const code of codes) await abortMatch(p, code);
    await closeAll([p]);
  }
});
