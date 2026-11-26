/**
 * @file   e2e/sweepScreens.ts
 * @module e2e
 * @brief  The screens of the layout sweep (K67) and how each one opens itself.
 *
 * Responsibility: the player's pages, each game's waiting area, start card, running round (with
 *                 its Players panel and the chat where the size folds them away), result and
 *                 verify page, and the admin areas. A page is loaded anew for each window
 *                 size (the sweep resizes before `open`), its fonts and themes sharing that
 *                 load; a game's matches are made on first use (a start card and a running
 *                 round anew before they end, the one before aborted) and those still open
 *                 listed for the caller to abort. What a screen leaves out of the findings is
 *                 named with its reason.
 * Depends on:     @playwright/test, @seasonal/kit/testing, ./play, ./testStack
 * Used by:        ./sweep.spec
 * Spec:           docs/spec/09-testing-strategy.md §4 (journey 47)
 */
import { expect, type Page } from '@playwright/test';
import type { SweepScreen } from '@seasonal/kit/testing';

import { abortMatch, call, hostMenu, roundOpen, type Person } from './play.js';
import { ADMIN_URL } from './testStack.js';

// What each page last loaded: its address and the window it loaded in.
const loaded = new WeakMap<Page, string>();

// A page of an app, loaded anew for each address and window size (the fonts and themes of one
// size share a load: the sweep sets both on the page). True when it did load.
async function load(page: Page, url: string): Promise<boolean> {
  const size = page.viewportSize();
  const key = `${url} ${String(size?.width)}x${String(size?.height)}`;
  if (loaded.get(page) === key) return false;
  await page.goto(url);
  await page.reload();
  loaded.set(page, key);
  return true;
}

// The same, then waits for the part that says the page is there.
async function show(page: Page, url: string, ready: string | RegExp): Promise<boolean> {
  const anew = await load(page, url);
  await expect(page.getByTestId(ready).first()).toBeVisible({ timeout: 20_000 });
  return anew;
}

const pageScreen = (name: string, hash: string, ready: string | RegExp): SweepScreen => ({
  name,
  open: async (page) => {
    await show(page, `./#/${hash}`, ready);
  },
});

export const SIGNED_OUT: readonly SweepScreen[] = [
  pageScreen('lobby signed out', '', 'lobby'),
  pageScreen('sign-in', 'sign-in', 'sign-in-form'),
  pageScreen('leaderboard signed out', 'leaderboard', 'leaderboard'),
];

export const PLAYER_PAGES: readonly SweepScreen[] = [
  pageScreen('lobby', '', 'lobby'),
  pageScreen('quick test', 'quick-test', 'quick-test'),
  pageScreen('leaderboard', 'leaderboard', 'leaderboard'),
  pageScreen('profile', 'players/dev-player-1', /^profile-(facts|missing)$/),
  pageScreen('account', 'account', /^(account-no-password|password-form)$/),
];

// A part the size folds behind a button: opened where the button shows, else the screen as is.
async function unfold(page: Page, button: string): Promise<void> {
  const control = page.getByTestId(button);
  if (await control.isVisible()) await control.click();
}

// A screen's open from one that says whether it loaded the page.
const opening =
  (open: (page: Page) => Promise<unknown>) =>
  async (page: Page): Promise<void> => {
    await open(page);
  };

// What the sweep leaves out: two things the owner decided, which stay as they are, and findings
// whose cause is in a kit part (the night sheet's list for the kit planning, DECISIONS T444).
// Intended (O134, WCAG 2.5.8; O109's rows on a phone): a phone's guess row is 24 px high.
const GUESS_ROW = 'small control: [guess-list] button.round-row-line';
// Intended (T150, at 100 % text): a desktop row's comment gives way first, with an ellipsis,
// its whole text in its tooltip; never the guess or the answer.
const COMMENT = 'cut text: [guess-list] span.round-comment';
// Kit css/dock.css:154-164: the bar's newest message ends in an ellipsis inside its own box.
const CHAT_BAR = 'sk-chat-bar-last';
// Kit css/bar.css:49-55: a desktop's bar fact ends in an ellipsis where the bar is full.
const BAR_FACT = 'cut text: [game-bar] span.sk-bar-fact';
// Kit css/dock.css:177-202: the open chat sheet covers part of the round's "Log (N)".
const UNDER_SHEET = 'axe: target-size: .round-log-all';
const ROUND = [GUESS_ROW, COMMENT, CHAT_BAR, BAR_FACT];
// Kit css/frames.css:38-53: the start card cuts what its smallest scale cannot fit.
const CARD = [BAR_FACT, 'clipped fitted root: [start-card]'];
// Kit css/frames.css:199-207: the result's headline is two lines at the most.
const RESULT = [CHAT_BAR, BAR_FACT, 'cut text: [result-first] h1'];

// A start card keeps this long before the sweep takes a new one (its countdown runs 30 s).
const CARD_FRESH_MS = 15_000;

// A running round is taken anew after this long: its bots guess again after 120 s and could
// end it under the sweep.
const ROUND_FRESH_MS = 90_000;

// The matches one game's screens use, made when a screen first needs one; one taken anew
// aborts the one before, so a run never holds many rounds open.
function matchesOf(p: Person, game: string, codes: string[]) {
  const make = async (body: Readonly<Record<string, unknown>>): Promise<string> => {
    const started = await call<{ matchCode: string }>(p, 'POST', '/dev/quicktest', {
      gameId: game,
      seedText: 'acorn',
      bots: 3,
      rangeHigh: 1_000_000,
      botDelayS: 120,
      fast: false,
      // A round that stays: nobody timed out while the sweep looks, and Mind Games one long
      // round rather than a series that moves on.
      settings: {
        'round.inactivityLimitS': 0,
        // A series of long rounds, so a result always has a pause and a next round after it.
        ...(game === 'mind-games'
          ? { 'mind.totalS': 600, 'mind.rounds': 10, 'mind.pauseS': 120 }
          : {}),
      },
      ...body,
    });
    codes.push(started.matchCode);
    return started.matchCode;
  };
  // A match that stays fresh for `ms`; `keep` holds the one in use from then on.
  const lasting = (ms: number, body: Readonly<Record<string, unknown>>) => {
    let current = { code: '', at: 0 };
    let kept = false;
    return {
      code: async (): Promise<string> => {
        if (current.code === '' || (!kept && Date.now() - current.at > ms)) {
          if (current.code !== '') await end(current.code);
          current = { code: await make(body), at: Date.now() };
        }
        return current.code;
      },
      keep: () => {
        kept = true;
      },
      // The one in use is over: the next ask makes another.
      drop: async (): Promise<void> => {
        await end(current.code);
        current = { code: '', at: 0 };
      },
    };
  };
  const end = async (code: string): Promise<void> => {
    await abortMatch(p, code);
    codes.splice(codes.indexOf(code), 1);
  };
  const waiting = lasting(Number.POSITIVE_INFINITY, { lobby: true });
  const round = lasting(ROUND_FRESH_MS, { countdownS: 3 });
  const card = lasting(CARD_FRESH_MS, { countdownS: 30 });
  return {
    waiting: waiting.code,
    round: round.code,
    card: card.code,
    keepRound: round.keep,
    dropRound: round.drop,
  };
}

type Matches = ReturnType<typeof matchesOf>;

// The running round, open; true when this look loaded it. A bot can solve a round at any
// guess: then another is taken.
async function showRound(page: Page, matches: Matches): Promise<boolean> {
  const url = async () => `./#/match/${await matches.round()}`;
  let anew = await load(page, await url());
  const result = page.getByTestId('result').first();
  await expect(result.or(page.getByTestId('round-view')).first()).toBeVisible({
    timeout: 20_000,
  });
  if (await result.isVisible()) {
    await matches.dropRound();
    anew = await show(page, await url(), 'round-view');
  }
  await roundOpen(page);
  return anew;
}

// The running round with a folded part unfolded.
function unfolded(
  name: string,
  button: string,
  matches: Matches,
  allow: readonly string[] = ROUND,
): SweepScreen {
  return {
    name: `round, ${name}`,
    allow: [...allow],
    open: async (page) => {
      if (await showRound(page, matches)) await unfold(page, button);
    },
  };
}

// The round's result: where the page shows the round running (the first time, or a series that
// went on to its next round) the host ends it.
function resultOf(p: Person, matches: Matches): (page: Page) => Promise<void> {
  return async (page) => {
    const anew = await load(page, `./#/match/${await matches.round()}`);
    const result = page.getByTestId('result').first();
    await expect(result.or(page.getByTestId('round-view')).first()).toBeVisible({
      timeout: 20_000,
    });
    if (!anew || (await result.isVisible())) return;
    await roundOpen(page);
    await hostMenu(p);
    await page.getByTestId('end-round').click();
    await expect(result).toBeVisible({ timeout: 20_000 });
    matches.keepRound();
    // Loaded afresh next time, as the result's own page.
    loaded.delete(page);
    await load(page, page.url());
    await expect(result).toBeVisible({ timeout: 20_000 });
  };
}

// The verify page of that result, found once from its fairness proof.
function verifyOf(result: (page: Page) => Promise<void>): (page: Page) => Promise<void> {
  let verify = '';
  return async (page) => {
    if (verify === '') {
      await result(page);
      await page.getByTestId('proof').getByText('Fairness proof').click();
      await page.getByRole('link', { name: 'Verify this round' }).click();
      await expect(page.getByTestId('seed-check')).toBeVisible();
      verify = page.url();
    }
    await show(page, verify, 'seed-check');
  };
}

export function gameScreens(p: Person, game: string, codes: string[]): readonly SweepScreen[] {
  const matches = matchesOf(p, game, codes);
  const result = resultOf(p, matches);
  const match = async (page: Page, code: Promise<string>, ready: string) =>
    show(page, `./#/match/${await code}`, ready);
  const screens: SweepScreen[] = [
    { name: 'waiting', open: opening((page) => match(page, matches.waiting(), 'waiting-area')) },
    {
      name: 'start card',
      allow: CARD,
      open: opening((page) => match(page, matches.card(), 'start-card')),
    },
    { name: 'round', allow: ROUND, open: opening((page) => showRound(page, matches)) },
    unfolded('players', 'focus-players', matches),
    unfolded('chat', 'chat-bar', matches, [...ROUND, UNDER_SHEET]),
    { name: 'result', allow: RESULT, open: result },
  ];
  // Mind Games shows no fairness proof, so it has no verify page.
  if (game !== 'mind-games') screens.push({ name: 'verify', open: verifyOf(result) });
  return screens;
}

const ADMIN_AREAS = [
  'live',
  'settings',
  'accounts',
  'seasons',
  'moderation',
  'abuse',
  'audit',
  'integration',
  'two-factor',
];

export const ADMIN_SCREENS: readonly SweepScreen[] = ADMIN_AREAS.map((area) => ({
  name: `admin ${area}`,
  open: async (page) => {
    await load(page, `${ADMIN_URL}/#/${area}`);
    const main = page.locator('.admin-main');
    await expect(main.locator('h1, h2').first()).toBeVisible({ timeout: 20_000 });
    await expect(main).not.toContainText('Loading');
  },
}));
