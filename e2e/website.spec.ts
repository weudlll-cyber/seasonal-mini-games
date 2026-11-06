/**
 * @file   e2e/website.spec.ts
 * @module e2e
 * @brief  Journey 36: inside the website (website mode behind a stand-in website's nginx), a
 *         guest watches, sees the website's chat, signs in through the website, plays a guess,
 *         is deleted through the account feed and becomes "Deleted player".
 *
 * Responsibility: the stack of ./websiteStack (the game under /games/mini-games/ on 5430). A
 *                 member who may host signs in through the website and opens a match; a visitor
 *                 who is not signed in watches it, finds the website's chat room under the
 *                 waiting area (the frame titled "Chat" from /embed/chat?room=mini-games with the
 *                 game's theme, the stand-in's page in it) with "Log in", which goes through the
 *                 sign-in route to the website's login and back to the match, signed in as the
 *                 member the website names; the member joins, shows its Discord step beside its
 *                 name, plays a guess in a round the host starts and ends, during which the round
 *                 bar's closed Chat panel tells the website's chat it is hidden, the chat's two
 *                 `unread` messages show "2" on the Chat badge, and opening the panel tells it
 *                 visible and clears the badge (T237); the website deletes
 *                 the member, the server's next poll of the account feed ends its session, and
 *                 the host's page shows "Deleted player" in its place. The match is aborted and
 *                 the host's account deleted (DELETE /me), also when a step fails; so is the
 *                 member's when the feed did not. Chromium only (playwright.config, T241).
 * Depends on:     @playwright/test, ./devStack, ./play, ./screens, ./websiteStack, ./websiteStub
 * Spec:           docs/spec/09-testing-strategy.md §4 (journey 36); docs/spec/07-integration.md
 *                 §2, §7; DECISIONS T221, T236–T239, T241; Seasonal Entertainment docs/EMBED.md
 */
import { expect, test, type Browser, type BrowserContext } from '@playwright/test';

import { WEBSITE_URL } from './devStack.js';
import {
  abortMatch,
  attempt,
  call,
  closeAll,
  hostMenu,
  hostRound,
  ownRows,
  playerRow,
  roundOpen,
  visit,
  type Person,
  type Who,
} from './play.js';
import { DESKTOP } from './screens.js';
import { startWebsiteStack, type WebsiteStack } from './websiteStack.js';
import type { StubMember } from './websiteStub.js';

const GAME = `${WEBSITE_URL}/games/mini-games/`;
// Website user ids are never reused: new ones each run, as the journey's database is kept.
const RUN = Date.now();
const tag = String(RUN).slice(-6);
const HOST: StubMember = { id: RUN * 10 + 1, name: `Host${tag}`, canHost: true, steps: [] };
const PLAYER: StubMember = {
  id: RUN * 10 + 2,
  name: `Walter${tag}`,
  canHost: false,
  steps: [{ ladder: 'holder', name: 'Gold', icon: null }],
};

interface SessionView {
  readonly account: { readonly displayName: string } | null;
}

let stack: WebsiteStack | undefined;

test.beforeAll(async () => {
  // The client's production build and the server's start take a while.
  test.setTimeout(240_000);
  stack = await startWebsiteStack();
});

test.afterAll(async () => {
  await stack?.close();
});

async function sessionOf(ctx: BrowserContext): Promise<SessionView> {
  return (await (await ctx.request.get('api/v1/session')).json()) as SessionView;
}

async function visitor(browser: Browser, who: Who): Promise<Person> {
  const ctx = await browser.newContext({ baseURL: GAME, viewport: DESKTOP, colorScheme: 'light' });
  return { who, ctx, page: await ctx.newPage() };
}

// A member the website already knows signs in through the sign-in route.
async function member(browser: Browser, m: StubMember): Promise<Person> {
  const p = await visitor(browser, 'host');
  await p.ctx.addCookies([{ name: 'stub_user', value: String(m.id), url: WEBSITE_URL }]);
  await p.page.goto(`auth/website?next=${encodeURIComponent('/games/mini-games/')}`);
  expect((await sessionOf(p.ctx)).account?.displayName).toBe(m.name);
  return p;
}

// Not signed in, the visitor watches the match with the website's chat and its "Log in".
async function watchWithChat(guest: Person, code: string): Promise<void> {
  await visit(guest, code);
  const chat = guest.page.getByTestId('round-chat');
  const frame = chat.getByTestId('chat-frame');
  await expect(frame).toHaveAttribute('title', 'Chat');
  await expect(frame).toHaveAttribute('src', '/embed/chat?room=mini-games&theme=light');
  await expect(chat.frameLocator('[data-testid="chat-frame"]').getByTestId('stub-chat')).toHaveText(
    'Stub chat: room mini-games, theme light',
  );
  const logIn = chat.getByTestId('chat-log-in');
  await expect(logIn).toHaveAttribute(
    'href',
    `/games/mini-games/auth/website?next=${encodeURIComponent(`/games/mini-games/#/match/${code}`)}`,
  );
}

// "Log in": the sign-in route, the website's login (which names the member), back to the match.
async function signInFromChat(guest: Person, site: WebsiteStack['site'], code: string) {
  site.loginAs = PLAYER.id;
  await guest.page.getByTestId('round-chat').getByTestId('chat-log-in').click();
  await guest.page.waitForURL(`${GAME}#/match/${code}`);
  await expect(guest.page.getByTestId('match')).toBeVisible();
  await expect(guest.page.getByTestId('chat-log-in')).toHaveCount(0);
  expect((await sessionOf(guest.ctx)).account?.displayName).toBe(PLAYER.name);
}

// The website's chat behind the round bar (T237): told hidden while its panel is closed, its
// unread count on the Chat badge, told visible (and the badge gone) once the panel opens.
async function chatBadge(player: Person): Promise<void> {
  const page = player.page;
  const chat = page.frameLocator('[data-testid="chat-drawer"] [data-testid="chat-frame"]');
  const sight = chat.getByTestId('stub-chat-sight');
  await expect(sight).toHaveText('hidden');
  for (let i = 0; i < 2; i += 1) {
    await sight.evaluate(() => {
      (window as unknown as { arrive: () => void }).arrive();
    });
  }
  await expect(page.getByTestId('chat-unread')).toHaveText('2 unread');
  await page.getByTestId('focus-chat').click();
  await expect(sight).toHaveText('visible');
  await expect(page.getByTestId('chat-unread')).toHaveCount(0);
  await page.getByTestId('focus-chat').click();
  await expect(sight).toHaveText('hidden');
}

// A shared round the host starts; the member's one guess comes back; the host ends the round.
async function playOneGuess(host: Person, player: Person): Promise<void> {
  await hostRound(host, { 'Countdown before opening': '3', Secret: 'shared' });
  await roundOpen(player.page);
  await chatBadge(player);
  await player.page.getByTestId('guess-input').fill('500');
  await player.page.getByTestId('guess-button').click();
  // 500 may be the secret: then the round is over at once.
  const ended = host.page.getByTestId('result');
  await expect(ownRows(player.page).first().or(player.page.getByTestId('result'))).toBeVisible();
  if (!(await ended.isVisible())) {
    await hostMenu(host);
    await host.page.getByTestId('host-console').getByTestId('end-round').click();
  }
  await expect(ended).toBeVisible({ timeout: 15_000 });
}

// Teardown: an account still signed in deletes itself with its typed display name.
async function deleteIfSignedIn(p: Person): Promise<void> {
  const account = (await sessionOf(p.ctx)).account;
  if (account === null) return;
  const r = await attempt(p, 'DELETE', '/me', { confirm: account.displayName });
  expect(r.status, `${account.displayName} deleted`).toBe(204);
}

test('journey 36: inside the website a guest watches, chats, signs in, plays and is deleted', async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const site = (stack as WebsiteStack).site;
  site.members.set(HOST.id, HOST).set(PLAYER.id, PLAYER);
  const host = await member(browser, HOST);
  const guest = await visitor(browser, 'guest');
  let code = '';
  try {
    const body = { gameId: 'guess-the-number', title: 'journey 36', maxPlayers: 10 };
    code = (await call<{ code: string }>(host, 'POST', '/matches', body)).code;
    await visit(host, code);
    await watchWithChat(guest, code);
    await signInFromChat(guest, site, code);
    await guest.page.getByTestId('join').click();
    const row = playerRow(host, PLAYER.name);
    await expect(row).toContainText('online');
    await expect(row.getByTestId('player-steps')).toHaveText('Gold');
    await playOneGuess(host, guest);
    // The website deletes the member; the server's next poll (every 15 s) ends its session.
    site.remove(PLAYER.id);
    await expect
      .poll(async () => (await sessionOf(guest.ctx)).account, { timeout: 45_000 })
      .toBeNull();
    await host.page.reload();
    const deleted = host.page.locator('span.player-name[title="Deleted player"]');
    await expect(deleted.first()).toBeVisible();
    await expect(host.page.locator(`span.player-name[title="${PLAYER.name}"]`)).toHaveCount(0);
  } finally {
    if (code !== '') await abortMatch(host, code);
    await deleteIfSignedIn(guest);
    await deleteIfSignedIn(host);
    await closeAll([host, guest]);
  }
});
