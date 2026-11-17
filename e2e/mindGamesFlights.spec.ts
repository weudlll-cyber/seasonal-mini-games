/**
 * @file   e2e/mindGamesFlights.spec.ts
 * @module e2e
 * @brief  Journey 44: Seasonal Mind Games' flights measured in the browser, wave by wave.
 *
 * Responsibility: 09 §4 journey 44, Chromium: 02e §11.1 points 2–7 measured on two Quick
 *                 Test rounds watched at once at 1440 × 900, 1280 × 720 and 390 × 844 (the
 *                 host's own windows), every wave by ./flightProbe as it starts: one flight
 *                 "×N" per from → to with N the step's lines; names on single first choices and
 *                 visible switches only, none on the phone, a lone one's always where it fits
 *                 its card; the coin turning over into the pure new icon; the label centred
 *                 above it, whole, as visible as it; the landings on their cards' middles,
 *                 overlapping by at most a fifth, at 82 % or more, coins, labels and "+N" inside
 *                 their card's frame; the coin standing still after its flight; a standing coin
 *                 fading at once beside a newer one; nothing left after a wave's life. Round
 *                 one: 40 bots, switches `visible`, All on. Round two: 12 bots, switches
 *                 `hidden`: a switch flies without a name, a first choice with one (on the
 *                 desktop windows).
 * Depends on:     @playwright/test, ./flightProbe, ./mindGames, ./play, ./screens
 * Spec:           docs/spec/09-testing-strategy.md §4 (journey 44); docs/spec/02e-game-mind-games.md §11.1
 */
import { expect, test, type Browser } from '@playwright/test';

import { probeScript, type ProbeResult } from './flightProbe.js';
import { mindQuickTest, startRound } from './mindGames.js';
import { abortMatch, closeAll, person, visit, type Person } from './play.js';
import { PHONE } from './screens.js';

// A flight's times (games/mind-games/web/flights.ts FLIGHT_MS, STAND_MS, FADE_MS, GONE_MS).
const TIMES = { fly: 1_600, stand: 500, fade: 300, gone: 150 };
const SIZES = [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, PHONE] as const;
const CHECKS = [
  'groups',
  'names',
  'coin',
  'label',
  'landing',
  'size',
  'inside',
  'standing',
  'leftover',
] as const;

// One round watched in three windows; each window's probe result.
async function watchRound(
  browser: Browser,
  fields: Readonly<Record<string, string>>,
  bots: number,
): Promise<ProbeResult[]> {
  const host = await person(browser, 'host', SIZES[0]);
  const others: Person[] = [];
  let code = '';
  try {
    code = await mindQuickTest(host, { fields, bots });
    for (const size of SIZES.slice(1)) {
      const p = await person(browser, 'host', size);
      await visit(p, code);
      others.push(p);
    }
    for (const p of [host, ...others])
      await p.page.evaluate(probeScript(TIMES, fields['Switches'] === 'visible'));
    await startRound(host);
    await expect(host.page.getByTestId('result')).toBeVisible({ timeout: 90_000 });
    return await Promise.all(
      [host, ...others].map((p) =>
        p.page.evaluate(() => (window as unknown as { __flightProbe: ProbeResult }).__flightProbe),
      ),
    );
  } finally {
    if (code !== '') await abortMatch(host, code);
    await closeAll([host, ...others]);
  }
}

// Every check of every window, softly, so one run names all that fail.
function judge(results: readonly ProbeResult[], round: string): void {
  results.forEach((r, i) => {
    const size = `${String(SIZES[i]?.width)} × ${String(SIZES[i]?.height)}`;
    console.log(
      `${round} at ${size}: ${String(r.waves)} waves, ${String(r.flights)} icons, ${String(r.named)} named, ${String(r.dropped)} names without room, ${String(r.groups)} groups, ${String(r.replaced)} coins replaced`,
    );
    expect.soft(r.waves, `${round} at ${size}: waves flew`).toBeGreaterThan(3);
    for (const check of CHECKS)
      expect.soft(r.problems[check] ?? [], `${round} at ${size}: ${check}`).toEqual([]);
  });
}

test('journey 44: every Mind Games flight lands centred, named where it fits, and inside its card', async ({
  browser,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'measured in Chromium (09 §4 journey 44)');
  test.setTimeout(300_000);
  const crowd = await watchRound(
    browser,
    { 'Total length': '60', Switches: 'visible', All: 'on' },
    40,
  );
  judge(crowd, 'switches visible, 40 bots');
  const hidden = await watchRound(
    browser,
    { 'Total length': '40', Switches: 'hidden', All: 'on' },
    12,
  );
  judge(hidden, 'switches hidden, 12 bots');
  expect(
    hidden.some((r) => r.named > 0),
    'first choices fly with names',
  ).toBe(true);
});
