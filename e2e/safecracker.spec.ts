/**
 * @file   e2e/safecracker.spec.ts
 * @module e2e
 * @brief  Journey 20: Seasonal Safecracker through the lobby, shared and individual, with its specials.
 *
 * Responsibility: a shared spring round from the Quick Test form through the lobby: the intro
 *                 names the code, Spring's revealed digit stays highlighted, the digit boxes
 *                 take a code key by key with the focus moving on, and the own row shows the
 *                 code with its pegs and the counts in words; then an individual autumn round
 *                 started at once: a digit falls and the strip marks it (from the round's
 *                 state: a fall before the page loaded has no live row),
 *                 and a code with it is refused at once with "That digit has fallen.". Each
 *                 round view fits 1280 × 720 and 390 × 844. The matches are aborted.
 * Depends on:     @playwright/test, ./guessGames, ./play
 * Spec:           docs/spec/09-testing-strategy.md §4 (journey 20); docs/spec/02b-game-safecracker.md
 */
import { expect, test, type Page } from '@playwright/test';

import { direct, fitsBoth, fromLobby, WIDE } from './guessGames.js';
import { abortMatch, closeAll, ownRows, person, roundOpen } from './play.js';

// Types a code into the boxes from the first open one; the focus moves on by itself and steps
// over Spring's locked hint box (O59), which keeps its digit. Returns the code that stands.
async function typeCode(page: Page, code: string): Promise<string> {
  const locked = page.locator('.sc-box--hint');
  const testId = (await locked.count()) === 0 ? null : await locked.getAttribute('data-testid');
  const at = testId === null ? -1 : Number(testId.replace('code-box-', ''));
  const sent =
    at < 0 ? code : `${code.slice(0, at)}${await locked.inputValue()}${code.slice(at + 1)}`;
  await page.getByTestId(`code-box-${at === 0 ? '1' : '0'}`).click();
  await page.keyboard.type(
    Array.from(sent)
      .filter((_, i) => i !== at)
      .join(''),
  );
  return sent;
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
    // The hint's digit stands locked in its box, named for a screen reader (O59).
    await expect(p.page.locator('.sc-box--hint')).toHaveAttribute(
      'aria-label',
      /^Digit \d of 4, hint: \d in place \d$/,
    );
    const sent = await typeCode(p.page, '0123');
    await expect(p.page.getByTestId('code-box-3')).toHaveValue(sent.slice(3));
    await p.page.getByTestId('guess-button').click();
    const own = ownRows(p.page).first();
    await expect(own.locator('.round-value')).toHaveText(sent);
    await expect(own.locator('.round-answer')).toHaveText(
      /^(\d right( · \d wrong places?)?|\d wrong places?|no digit right|correct — the safe is open)$/,
      { timeout: 10_000 },
    );
    await fitsBoth(p.page);

    // Individual, autumn: a digit falls; a code with it is refused before sending.
    const started = await direct(p, {
      gameId: 'safecracker',
      mode: 'individual',
      season: 'autumn',
      // Outside shared `full` only digits nobody has guessed can fall (O37): with the bot
      // guessing every 3 s they ran out before the first fall in CI; every 30 s they do not.
      cooldownS: 30,
    });
    codes.push(started.matchCode);
    // From the round's state, not the live row: a fall before the page had loaded would never
    // show its row (CI, night 6). The strip marks the fallen digit.
    const fell = p.page.getByRole('listitem', { name: /^\d, fallen$/ }).first();
    await expect(fell).toBeVisible({ timeout: 30_000 });
    const digit = /^(\d)/.exec((await fell.getAttribute('aria-label')) ?? '')?.[1] ?? '';
    await typeCode(p.page, `${digit}${digit}${digit}${digit}`);
    await expect(p.page.locator('.sc-message')).toHaveText('That digit has fallen.');
    await fitsBoth(p.page);
  } finally {
    for (const code of codes) await abortMatch(p, code);
    await closeAll([p]);
  }
});
