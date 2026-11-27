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
 *                 chat, docked under the round (O109), tells the website's chat on a phone that
 *                 it is hidden while the bar's sheet is closed, the chat's two `unread` messages
 *                 show "2" on the bar, opening the sheet tells it visible and clears the count,
 *                 and back on a desktop the dock in sight tells it visible (T237); on the result
 *                 the website's shared call shows while it is live, with "Back to the call", and
 *                 goes when it is unshared (T446); the website
 *                 deletes the member and changes the host's rights, the server's next poll of the
 *                 account feed ends both sessions, the host's reload signs in again through the
 *                 website without a form, back on the match page (T282), and shows "Deleted
 *                 player" in the member's place. The match is aborted and
 *                 the host's account deleted (DELETE /me), also when a step fails; so is the
 *                 member's when the feed did not. Chromium only (playwright.config, T241).
 * Depends on:     @playwright/test, ./testStack, ./play, @seasonal/kit/testing, ./websiteStack, ./websiteStub
 * Spec:           docs/spec/09-testing-strategy.md §4 (journey 36); docs/spec/07-integration.md
 *                 §2, §7; DECISIONS T221, T236–T239, T241, T282; Seasonal Entertainment docs/EMBED.md
 */
import { expect, test, type Browser, type BrowserContext } from '@playwright/test';
import { DESKTOP, PHONE, type StandInMember } from '@seasonal/kit/testing';

import { WEBSITE_URL } from './testStack.js';
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
import { startWebsiteStack, type WebsiteStack } from './websiteStack.js';

const GAME = `${WEBSITE_URL}/games/mini-games/`;
// Website user ids are never reused: new ones each run, as the journey's database is kept.
const RUN = Date.now();
const tag = String(RUN).slice(-6);
const HOST: StandInMember = { id: RUN * 10 + 1, name: `Host${tag}`, role: 'member', canHost: true };
const PLAYER: StandInMember = {
  id: RUN * 10 + 2,
  name: `Walter${tag}`,
  role: 'member',
  steps: [
    {
      ladder: 'holder',
      name: 'Gold',
      icon: `/media/step-icons/${'0123456789abcdef'.repeat(2)}.webp`,
    },
  ],
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
async function member(browser: Browser, m: StandInMember): Promise<Person> {
  const p = await visitor(browser, 'host');
  await p.ctx.addCookies([{ name: 'se.sid', value: String(m.id), url: WEBSITE_URL }]);
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
  // The stand-in shows what the game asked it for (the kit, since v0.36.0).
  await expect(chat.frameLocator('[data-testid="chat-frame"]').locator('p')).toHaveText(
    'chat (stand-in), room mini-games, theme light',
  );
  const logIn = chat.getByTestId('chat-log-in');
  await expect(logIn).toHaveAttribute(
    'href',
    `/games/mini-games/auth/website?next=${encodeURIComponent(`/games/mini-games/#/match/${code}`)}`,
  );
}

// "Log in": the sign-in route, the website's login (which names the member), back to the match.
async function signInFromChat(guest: Person, site: WebsiteStack['site'], code: string) {
  site.signInAs(PLAYER.id);
  await guest.page.getByTestId('round-chat').getByTestId('chat-log-in').click();
  await guest.page.waitForURL(`${GAME}#/match/${code}`);
  await expect(guest.page.getByTestId('match')).toBeVisible();
  await expect(guest.page.getByTestId('chat-log-in')).toHaveCount(0);
  expect((await sessionOf(guest.ctx)).account?.displayName).toBe(PLAYER.name);
}

// What the stand-in's chat frame keeps and says (the kit's frame: the game's messages in
// `received`, `say` posts the website's).
interface ChatFrame {
  readonly received: readonly { readonly type: string; readonly visible?: boolean }[];
  readonly say: (type: string, fields: Readonly<Record<string, unknown>>) => void;
}

// The website's chat docked under the round (T237, O109): on a phone, told hidden while the
// bar's sheet is closed, its unread count on the bar, told visible (and, once the chat says it
// is read, the count gone) when the sheet opens; back on a desktop the dock is in sight, so it
// is told visible.
async function chatBadge(player: Person): Promise<void> {
  const page = player.page;
  await page.setViewportSize(PHONE);
  const chat = page.frameLocator('[data-testid="chat-dock"] [data-testid="chat-frame"]');
  const frame = chat.locator('body');
  const sight = () =>
    frame.evaluate(() => {
      const told = (window as unknown as ChatFrame).received.filter((m) => m.type === 'visible');
      return told.at(-1)?.visible;
    });
  const unread = (count: number) =>
    frame.evaluate((_body, n) => {
      (window as unknown as ChatFrame).say('unread', { room: 'mini-games', count: n });
    }, count);
  await expect.poll(sight).toBe(false);
  await unread(2);
  await expect(page.getByTestId('chat-unread')).toHaveText('2 unread');
  await page.getByTestId('chat-bar').click();
  await expect.poll(sight).toBe(true);
  await unread(0);
  await expect(page.getByTestId('chat-unread')).toHaveCount(0);
  await page.getByTestId('chat-bar').click();
  await expect.poll(sight).toBe(false);
  await page.setViewportSize(DESKTOP);
  await expect.poll(sight).toBe(true);
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
    // The secret's end may reach the host only now: then "End round" is gone and the click
    // would wait for good (1 run in 20, 2026-11-22), so its failure counts only while the
    // round is still running.
    const endRound = host.page.getByTestId('host-console').getByTestId('end-round');
    await endRound.click({ timeout: 10_000 }).catch(async (error: unknown) => {
      if (!(await ended.isVisible())) throw error;
    });
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

// The website's one shared call on the docked result (kit K77, its CHANGELOG v0.37.0): shown
// only while the view says it is live, with the way back to it; gone once it is unshared.
async function sharedCall(p: Person): Promise<void> {
  const slot = p.page.getByTestId('shared-call-slot');
  const back = p.page.getByTestId('back-to-call');
  const view = p.page.frameLocator('[data-testid="shared-call-frame"]').locator('body');
  // The stand-in view's own `say`, as the website's view posts its messages.
  const say = (type: string, fields: Readonly<Record<string, unknown>>) =>
    view.evaluate(
      (_, message) => {
        const page = window as unknown as { say: (t: string, f: object) => void };
        page.say(message.type, message.fields);
      },
      { type, fields },
    );
  await expect(
    p.page.frameLocator('[data-testid="shared-call-frame"]').locator('p'),
  ).toBeAttached();
  await expect(slot).toBeHidden();
  await say('ready', { call: 7, status: 'live', signedIn: true });
  await expect(slot).toBeVisible();
  await expect(back).toHaveAttribute('href', '/calls/7');
  await say('ended', { reason: 'unshared' });
  await expect(slot).toBeHidden();
  await expect(back).toHaveCount(0);
}

test('journey 36: inside the website a guest watches, chats, signs in, plays and is deleted', async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const site = (stack as WebsiteStack).site;
  site.members.push(HOST, PLAYER);
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
    await expect(row.getByTestId('steps').locator('img')).toHaveAttribute('alt', 'Gold');
    await playOneGuess(host, guest);
    await sharedCall(guest);
    // The website deletes the member and changes the host's rights; the server's next poll
    // (every 15 s) ends both game sessions.
    site.remove(PLAYER.id);
    site.rights(HOST.id);
    await expect
      .poll(async () => (await sessionOf(guest.ctx)).account, { timeout: 45_000 })
      .toBeNull();
    // The host signs in again through the website, back on the same page, without a form
    // (T282): the open page may do it on its own (an answer with the ended-session header
    // sends it through the sign-in route), else its next load does. A reload while that
    // navigation runs is refused ("Not attached to an active page", CI on b53055e), so it is
    // tried only while signed out, and its failure waits for the next try.
    await expect
      .poll(
        async () => {
          const name = (await sessionOf(host.ctx)).account?.displayName;
          if (name === undefined) await host.page.reload().catch(() => undefined);
          return name;
        },
        { timeout: 30_000, intervals: [2_000] },
      )
      .toBe(HOST.name);
    await expect(host.page).toHaveURL(new RegExp(`#/match/${code}$`));
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
